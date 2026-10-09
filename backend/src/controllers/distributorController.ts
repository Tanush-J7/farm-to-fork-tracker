import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { blockchainService, BlockchainStatus } from '../services/blockchainService';
import crypto from 'crypto';

// GET /api/distributor/shipments/incoming
export const getIncomingShipments = async (req: Request, res: Response): Promise<void> => {
  try {
    const distributor_id = (req as any).user?.id;
    if (!distributor_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: shipments, error } = await supabase
      .from('shipments')
      .select('*, sender:sender_id(name, email), request:request_id(product_name, request_id)')
      .eq('receiver_id', distributor_id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('error occurred');
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }

    res.status(200).json({ success: true, data: shipments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/distributor/shipments/:id/receive
export const receiveShipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const distributor_id = (req as any).user?.id;
    const { id } = req.params;

    if (!distributor_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: shipment, error: fetchErr } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !shipment) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }

    if (shipment.receiver_id !== distributor_id) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    if (shipment.status === 'RECEIVED') {
      res.status(400).json({ success: false, message: 'Already received' });
      return;
    }

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', shipment.product_id)
      .single();

    if (prodErr || !product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    // Mark as RECEIVED
    const { error: updateShipmentErr } = await supabase
      .from('shipments')
      .update({ status: 'RECEIVED' })
      .eq('id', id);

    if (updateShipmentErr) {
      res.status(500).json({ success: false, message: 'Database error'});
      return;
    }

    // Update Product Ownership
    const { error: updateProdErr } = await supabase
      .from('products')
      .update({ current_owner_id: distributor_id })
      .eq('id', shipment.product_id);

    if (updateProdErr) {
      console.error('error occurred');
      res.status(500).json({ success: false, message: 'Database error updating ownership'});
      return;
    }

    // Blockchain integration
    let txHash = null;
    let blockchainError = null;
    try {
      const bcResult = await blockchainService.recordReceipt(shipment.product_id);
      if (bcResult.status === BlockchainStatus.ON_CHAIN_VERIFICATION_FAILED) {
        console.warn("Blockchain transaction failed. Continuing with database only.");
        blockchainError = 'ON_CHAIN_VERIFICATION_FAILED';
      } else {
        txHash = bcResult.txHash;
      }
    } catch (bcError) {
      console.error("Blockchain transaction exception:", bcError);
      blockchainError = 'EXCEPTION';
    }

    // Traceability event
    await supabase.from('traceability_events').insert({
      product_id: shipment.product_id,
      batch_number: shipment.batch_number,
      event_type: 'DISTRIBUTOR_RECEIVED',
      actor_id: distributor_id,
      location: 'Distributor Hub',
      blockchain_hash: txHash,
      metadata: { shipment_id: shipment.id, quantity: shipment.quantity }
    });

    res.status(200).json({ success: true, message: 'Shipment received' });
  } catch (error) {
    console.error('error occurred');
      res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/distributor/batches
export const getDistributorBatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const distributor_id = (req as any).user?.id;
    if (!distributor_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: batches, error } = await supabase
      .from('products')
      .select('*')
      .eq('current_owner_id', distributor_id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }

    res.status(200).json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/distributor/shipments
// Create shipment to Retailer
export const createShipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const distributor_id = (req as any).user?.id;
    const { product_id, request_id, quantity } = req.body;

    if (!distributor_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!product_id || !request_id || !quantity) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (prodErr || !product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    if (product.current_owner_id !== distributor_id) {
      res.status(403).json({ success: false, message: 'You do not own this product' });
      return;
    }

    const { data: existingShipments, error: existingErr } = await supabase
      .from('shipments')
      .select('quantity')
      .eq('product_id', product_id)
      .eq('sender_id', distributor_id)
      .neq('status', 'CANCELLED');

    if (existingErr) {
      res.status(500).json({ success: false, message: 'Database error checking inventory' });
      return;
    }

    const shippedQuantity = existingShipments.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const availableQuantity = product.quantity - shippedQuantity;

    if (quantity <= 0 || quantity > availableQuantity) {
      res.status(400).json({ success: false, message: `Invalid quantity. Only ${availableQuantity} available out of ${product.quantity}.` });
      return;
    }

    const { data: request, error: reqErr } = await supabase
      .from('product_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (reqErr || !request) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    // Verify receiver is a retailer (just checking the user role)
    const { data: receiver, error: recErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', request.retailer_id)
      .single();

    if (recErr || !receiver || receiver.role !== 'retailer') {
      res.status(400).json({ success: false, message: 'Invalid receiver (must be a retailer)' });
      return;
    }

    // Wait, do we need to split the batch?
    // "Use the existing product_requests table and existing retailer request workflow...
    // Distributor cannot ship more than available quantity"
    // I will ship the original product id. If quantity < product.quantity, it's just a partial shipment for the same product_id.
    // The Retailer receives it and records it in retailer_inventory anyway.
    
    // BUT what if we want to deduct the quantity from the distributor?
    // "Ownership must change only after confirmed physical receipt. Shipment creation does NOT transfer ownership."
    // If they ship part of it, the available quantity should probably drop, but we don't have an `available_quantity` column.
    // Let's just create the shipment.

    const trackingId = `TRK-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .insert({
        shipment_tracking_id: trackingId,
        request_id: request_id,
        product_id: product.id,
        batch_number: product.batch_number,
        sender_id: distributor_id,
        receiver_id: request.retailer_id,
        quantity: quantity,
        unit: product.unit || 'units',
        status: 'IN_TRANSIT'
      })
      .select()
      .single();

    if (shipErr) {
      res.status(500).json({ success: false, message: 'Database error creating shipment'});
      return;
    }

    // Blockchain Integration
    let txHash = null;
    try {
      const bcResult = await blockchainService.updateStage(product.id, 'IN_TRANSIT', `Shipped ${quantity} units`);
      if (bcResult.status === BlockchainStatus.ON_CHAIN_CONFIRMED) {
        txHash = bcResult.txHash;
      } else {
        console.warn("Blockchain update failed. Continuing with DB only.");
      }
    } catch (err) {
      console.error("Blockchain transaction exception:", err);
    }

    // Traceability event
    await supabase.from('traceability_events').insert({
      product_id: product.id,
      batch_number: product.batch_number,
      event_type: 'DISTRIBUTOR_SHIPPED',
      actor_id: distributor_id,
      location: 'In Transit',
      blockchain_hash: txHash,
      metadata: { shipment_id: shipment.id, quantity: shipment.quantity, to_retailer_id: request.retailer_id }
    });

    res.status(201).json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
