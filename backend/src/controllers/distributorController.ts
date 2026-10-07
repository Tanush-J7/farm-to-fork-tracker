import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

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
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Database error', error });
      return;
    }

    res.status(200).json({ success: true, data: shipments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
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
      res.status(500).json({ success: false, message: 'Database error', error: updateShipmentErr });
      return;
    }

    // Update Product Ownership
    const { error: updateProdErr } = await supabase
      .from('products')
      .update({ current_owner_id: distributor_id })
      .eq('id', shipment.product_id);

    if (updateProdErr) {
      res.status(500).json({ success: false, message: 'Database error updating ownership', error: updateProdErr });
      return;
    }

    // Traceability event
    await supabase.from('traceability_events').insert({
      product_id: shipment.product_id,
      batch_number: shipment.batch_number,
      event_type: 'DISTRIBUTOR_RECEIVED',
      actor_id: distributor_id,
      location: 'Distributor Hub',
      metadata: { shipment_id: shipment.id, quantity: shipment.quantity }
    });

    res.status(200).json({ success: true, message: 'Shipment received' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
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
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Database error', error });
      return;
    }

    res.status(200).json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
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

    const trackingId = `TRK-${Date.now()}`;
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
      res.status(500).json({ success: false, message: 'Database error creating shipment', error: shipErr });
      return;
    }

    // Traceability event
    await supabase.from('traceability_events').insert({
      product_id: product.id,
      batch_number: product.batch_number,
      event_type: 'DISTRIBUTOR_SHIPPED',
      actor_id: distributor_id,
      location: 'In Transit',
      metadata: { shipment_id: shipment.id, quantity: shipment.quantity, to_retailer_id: request.retailer_id }
    });

    res.status(201).json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};
