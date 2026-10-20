import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { blockchainRelayer } from '../services/blockchainRelayer';

/**
 * GET /api/processor/requests
 * Fetch all retailer demand requests for the processor desk
 */
export const getRetailerRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: requests, error } = await supabase
      .from('product_requests')
      .select(`
        *,
        retailer:users!retailer_id(id, name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch retailer requests', error: error.message });
      return;
    }

    res.status(200).json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * PUT /api/processor/requests/:id/fulfill
 * Fulfill retailer request directly from processor's existing in-stock batch
 */
export const fulfillRequestFromStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { product_id, notes, distributor_id } = req.body;
    const processorId = (req as any).user?.id;

    if (!product_id) {
      res.status(400).json({ success: false, message: 'product_id of the in-stock batch is required to fulfill' });
      return;
    }

    // 1. Fetch Request
    const { data: request, error: reqErr } = await supabase
      .from('product_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (reqErr || !request) {
      res.status(404).json({ success: false, message: 'Retailer request not found' });
      return;
    }

    // 2. Fetch Selected Product
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (prodErr || !product) {
      res.status(404).json({ success: false, message: 'Selected product batch not found in inventory' });
      return;
    }

    // 3. Update Request Status to PROCESSING
    const fulfillmentNotes = notes 
      ? `${notes} (Fulfilled with Batch ${product.batch_number})`
      : `Fulfilled with Batch ${product.batch_number}`;

    const { error: updateReqErr } = await supabase
      .from('product_requests')
      .update({
        status: 'PROCESSING',
        processor_id: processorId,
        notes: request.notes ? `${request.notes} | ${fulfillmentNotes}` : fulfillmentNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateReqErr) {
      res.status(500).json({ success: false, message: 'Failed to update request status', error: updateReqErr.message });
      return;
    }

    // 4. Create Shipment Record for Retailer & Distributor
    const trackingId = `TRK-${Date.now()}`;
    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .insert({
        shipment_tracking_id: trackingId,
        request_id: request.id,
        batch_number: product.batch_number,
        product_id: product.id,
        distributor_id: distributor_id || null,
        quantity: request.quantity,
        unit: request.unit,
        status: 'IN_TRANSIT',
        sender_id: processorId,
        receiver_id: request.retailer_id,
        expected_delivery: request.required_date || null
      })
      .select()
      .single();

    if (shipErr) {
      console.warn('Shipment record creation error (non-fatal):', shipErr.message);
    }

    // 5. Update Product Status to In Transit
    let txHash: string | null = null;
    const { error: prodUpdateErr } = await supabase
      .from('products')
      .update({
        status: 'In Transit',
        current_owner_id: distributor_id || processorId,
        updated_at: new Date().toISOString()
      })
      .eq('id', product.id);

    if (prodUpdateErr) {
      console.warn('Product status update error:', prodUpdateErr.message);
    }

    // 6. Record on Ethereum Sepolia Blockchain via Relayer
    if (product.product_id && product.product_id > 0) {
      try {
        const receipt = await blockchainRelayer.updateStage(
          product.product_id,
          'In Transit',
          `Dispatched from Processor facility for Retailer Order ${request.request_id || ''}`
        );
        txHash = receipt.txHash;
        await supabase
          .from('products')
          .update({ blockchain_hash: txHash })
          .eq('id', product.id);
      } catch (bcErr: any) {
        console.warn('Blockchain relay failed (continuing gracefully):', bcErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully fulfilled request ${request.request_id || ''} from warehouse stock`,
      data: {
        request_id: request.request_id,
        batch_number: product.batch_number,
        tracking_id: trackingId,
        shipment,
        blockchain_hash: txHash
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * PUT /api/processor/requests/:id/source-farmers
 * When stock is insufficient, processor broadcasts a procurement order to farmers
 */
export const sourceFromFarmers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { offered_price, target_quantity, procurement_notes } = req.body;
    const processorId = (req as any).user?.id;

    const { data: request, error: reqErr } = await supabase
      .from('product_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (reqErr || !request) {
      res.status(404).json({ success: false, message: 'Retailer request not found' });
      return;
    }

    const priceText = offered_price ? `₹${offered_price}/${request.unit}` : 'Market Competitive';
    const sourcingNote = `[FARMER SOURCING ORDER] Target: ${target_quantity || request.quantity} ${request.unit} ${request.product_name} | Offered: ${priceText} | By: ${request.required_date || 'Urgent'} | ${procurement_notes || 'Fresh harvest required'}`;

    const { data: updated, error: updateErr } = await supabase
      .from('product_requests')
      .update({
        status: 'SOURCING_FROM_FARMERS',
        processor_id: processorId,
        notes: request.notes ? `${request.notes} \n${sourcingNote}` : sourcingNote,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      res.status(500).json({ success: false, message: 'Failed to broadcast procurement order to farmers', error: updateErr.message });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Procurement request broadcasted to farmers for ${request.product_name}`,
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/processor/farmer-sourcing
 * Allows farmers (and processors) to view active procurement orders waiting to be harvested/fulfilled
 */
export const getFarmerSourcingOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: orders, error } = await supabase
      .from('product_requests')
      .select(`
        *,
        processor:users!processor_id(id, name, email)
      `)
      .eq('status', 'SOURCING_FROM_FARMERS')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch farmer sourcing orders', error: error.message });
      return;
    }

    res.status(200).json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
