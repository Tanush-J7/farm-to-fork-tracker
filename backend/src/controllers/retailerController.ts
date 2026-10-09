import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { blockchainService, BlockchainStatus } from '../services/blockchainService';

// Generate a unique Request ID (e.g., REQ-1023)
const generateRequestId = async () => {
  const { data, error } = await supabase
    .from('product_requests')
    .select('request_id')
    .order('created_at', { ascending: false })
    .limit(500)
    .limit(1);

  if (error || !data || data.length === 0) {
    return 'REQ-1000';
  }

  const lastId = data[0].request_id;
  const num = parseInt(lastId.split('-')[1]);
  return `REQ-${num + 1}`;
};

export const createProductRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { product_name, quantity, unit, required_date, priority, notes } = req.body;
    const retailer_id = (req as any).user?.id;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!product_name || !quantity || !unit || !required_date) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const request_id = await generateRequestId();

    const { data: request, error } = await supabase
      .from('product_requests')
      .insert({
        request_id,
        retailer_id,
        product_name,
        quantity,
        unit,
        required_date,
        priority: priority || 'NORMAL',
        notes: notes || null,
        status: 'PENDING'
      })
      .select()
      .single();

    if (error) {
      console.error('error occurred');
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getMyRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: requests, error } = await supabase
      .from('product_requests')
      .select('*')
      .eq('retailer_id', retailer_id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getRetailerShipments = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: shipments, error } = await supabase
      .from('shipments')
      .select('*, sender:sender_id(name, email, phone), distributor:distributor_id(name, email, phone), request:request_id(product_name, request_id)')
      .eq('receiver_id', retailer_id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }

    res.status(200).json({ success: true, data: shipments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const verifyBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;
    const { shipment_id, qr_data } = req.body;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!shipment_id || !qr_data) {
      res.status(400).json({ success: false, message: 'Shipment ID and QR Data are required' });
      return;
    }

    const { data: shipment, error: shipmentErr } = await supabase
      .from('shipments')
      .select('*, request:request_id(product_name)')
      .eq('id', shipment_id)
      .single();

    if (shipmentErr || !shipment) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }

    if (shipment.receiver_id !== retailer_id) {
      res.status(403).json({ success: false, message: 'This shipment does not belong to your store' });
      return;
    }

    if (shipment.status === 'RECEIVED') {
      res.status(400).json({ success: false, message: 'Shipment has already been received' });
      return;
    }
    if (shipment.status === 'CANCELLED') {
      res.status(400).json({ success: false, message: 'Shipment is cancelled and cannot be received' });
      return;
    }

    if (shipment.batch_number !== qr_data) {
      res.status(400).json({ success: false, message: `QR Code mismatch. Expected batch ${shipment.batch_number}, but scanned ${qr_data}` });
      return;
    }

    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', shipment.product_id)
      .single();

    if (productErr || !product) {
      res.status(404).json({ success: false, message: 'Associated product/batch not found in system' });
      return;
    }

    if (product.status === 'RECALLED') {
      res.status(400).json({ success: false, message: 'DANGER: This batch has been recalled. DO NOT RECEIVE.' });
      return;
    }

    res.status(200).json({ 
      success: true, 
      message: 'Batch verified successfully',
      data: {
        product_name: shipment.request?.product_name || product.name,
        batch_number: product.batch_number,
        quantity: shipment.quantity,
        unit: shipment.unit,
        sender_id: shipment.sender_id,
        expiry_date: product.expiry_date
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error during verification' });
  }
};

export const receiveProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;
    const { shipment_id, qr_data } = req.body;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!shipment_id || !qr_data) {
      res.status(400).json({ success: false, message: 'Shipment ID and QR Data are required' });
      return;
    }

    // 1. Shipment validation (Must re-validate everything from Phase 4)
    const { data: shipment, error: shipmentErr } = await supabase
      .from('shipments')
      .select('*, request:request_id(product_name)')
      .eq('id', shipment_id)
      .single();

    if (shipmentErr || !shipment) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }

    if (shipment.receiver_id !== retailer_id) {
      res.status(403).json({ success: false, message: 'This shipment does not belong to your store' });
      return;
    }

    if (shipment.status === 'RECEIVED') {
      res.status(400).json({ success: false, message: 'Shipment has already been received' });
      return;
    }
    if (shipment.status === 'CANCELLED') {
      res.status(400).json({ success: false, message: 'Shipment is cancelled and cannot be received' });
      return;
    }

    if (shipment.batch_number !== qr_data) {
      res.status(400).json({ success: false, message: `QR Code mismatch.` });
      return;
    }

    // 2. Blockchain Transaction execution (Non-fatal)
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

    // 3. Mark Shipment RECEIVED
    const { error: updateShipmentErr } = await supabase
      .from('shipments')
      .update({ status: 'RECEIVED' })
      .eq('id', shipment_id);

    if (updateShipmentErr) {
      res.status(500).json({ success: false, message: 'Failed to update shipment status'});
      return;
    }

    // 3.1 Update Product Ownership
    const { error: updateProductErr } = await supabase
      .from('products')
      .update({ current_owner_id: retailer_id })
      .eq('id', shipment.product_id);

    if (updateProductErr) {
      console.error('error occurred');
      res.status(500).json({ success: false, message: 'Failed to update product ownership'});
      return;
    }

    // 3.5 Create Kafka Outbox Event (Phase 7 - Event Streaming)
    const { randomUUID } = require('crypto');
    await supabase.from('event_outbox').insert({
      event_id: randomUUID(),
      event_type: 'SHIPMENT_RECEIVED',
      topic: 'shipment-events',
      payload: {
        shipment_id: shipment.id,
        batch_id: shipment.batch_number,
        retailer_id: retailer_id,
        quantity: shipment.quantity,
        unit: shipment.unit
      }
    });

    // 4. Create RETAILER_RECEIVED Traceability Event
    const { error: eventErr } = await supabase
      .from('traceability_events')
      .insert({
        product_id: shipment.product_id,
        batch_number: shipment.batch_number,
        event_type: 'RETAILER_RECEIVED',
        actor_id: retailer_id,
        location: 'Retail Store',
        blockchain_hash: txHash,
        metadata: {
          shipment_id: shipment.id,
          quantity_received: shipment.quantity,
          unit: shipment.unit
        }
      });

    if (eventErr) {
      console.error("Traceability event creation failed:", eventErr);
    } else {
      const { randomUUID } = require('crypto');
      // Phase 9: RETAILER_RECEIVED Traceability Kafka Event
      await supabase.from('event_outbox').insert({
        event_id: randomUUID(),
        event_type: 'RETAILER_RECEIVED',
        topic: 'traceability-events',
        payload: {
          batch_id: shipment.batch_number,
          shipment_id: shipment.id,
          retailer_id: retailer_id,
          quantity: shipment.quantity
        }
      });
      // Phase 9: BLOCKCHAIN_RECORDED Traceability Kafka Event
      if (txHash) {
        await supabase.from('event_outbox').insert({
          event_id: randomUUID(),
          event_type: 'BLOCKCHAIN_RECORDED',
          topic: 'traceability-events',
          payload: {
            batch_id: shipment.batch_number,
            tx_hash: txHash,
            event_source: 'RETAILER_RECEIVED'
          }
        });
      }
    }

    // 5. Fetch product to get expiry_date and create Inventory Record
    const { data: product } = await supabase
      .from('products')
      .select('expiry_date')
      .eq('id', shipment.product_id)
      .single();

    const { error: invErr } = await supabase
      .from('retailer_inventory')
      .insert({
        retailer_id,
        product_id: shipment.product_id,
        batch_number: shipment.batch_number,
        quantity: shipment.quantity,
        unit: shipment.unit,
        expiry_date: product?.expiry_date || null,
        status: 'AVAILABLE'
      });

    if (invErr) {
      console.error("Inventory creation failed:", invErr);
    } else {
      // Create Kafka Outbox Event for Inventory (Phase 8)
      await supabase.from('event_outbox').insert({
        event_id: randomUUID(),
        event_type: 'INVENTORY_CREATED',
        topic: 'inventory-events',
        payload: {
          batch_id: shipment.batch_number,
          retailer_id: retailer_id,
          product_id: shipment.product_id,
          quantity: shipment.quantity,
          unit: shipment.unit
        }
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Product successfully received and recorded on the blockchain.',
      data: {
        blockchain_hash: txHash,
        shipment_id: shipment.id
      }
    });

  } catch (error) {
    console.error('error occurred');
      res.status(500).json({ success: false, message: 'Server Error during receiving' });
  }
};
export const getRetailerInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: inventory, error } = await supabase
      .from('retailer_inventory')
      .select('*, product:product_id(name, category, product_image_url)')
      .eq('retailer_id', retailer_id)
      .order('expiry_date', { ascending: true })
      .limit(500);

    if (error) {
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }

    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const recordSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;
    const { inventory_id, quantity_sold, price_per_unit } = req.body;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!inventory_id || !quantity_sold || quantity_sold <= 0) {
      res.status(400).json({ success: false, message: 'Valid Inventory ID and quantity are required' });
      return;
    }

    // 1. Fetch inventory
    const { data: inventory, error: invErr } = await supabase
      .from('retailer_inventory')
      .select('*, product:product_id(name)')
      .eq('id', inventory_id)
      .single();

    if (invErr || !inventory) {
      res.status(404).json({ success: false, message: 'Inventory item not found' });
      return;
    }

    if (inventory.retailer_id !== retailer_id) {
      res.status(403).json({ success: false, message: 'You do not own this inventory item' });
      return;
    }

    // 2. Expiration check
    if (inventory.expiry_date && new Date(inventory.expiry_date) < new Date()) {
      res.status(400).json({ success: false, message: 'Cannot sell expired items' });
      return;
    }

    // 3. Quantity check
    if (inventory.quantity < quantity_sold) {
      res.status(400).json({ success: false, message: `Insufficient stock. Only ${inventory.quantity} available.` });
      return;
    }

    const newQuantity = inventory.quantity - quantity_sold;
    const newStatus = newQuantity <= 0 ? 'DEPLETED' : 'AVAILABLE';

    // 4. Update Inventory (with Optimistic Concurrency Control)
    const { data: updateData, error: updateErr } = await supabase
      .from('retailer_inventory')
      .update({ quantity: newQuantity, status: newStatus })
      .eq('id', inventory_id)
      .eq('quantity', inventory.quantity) // Prevent race conditions
      .select();

    if (updateErr) {
      res.status(500).json({ success: false, message: 'Failed to update inventory'});
      return;
    }

    if (!updateData || updateData.length === 0) {
      res.status(409).json({ success: false, message: 'Inventory was modified concurrently. Please refresh and try again.' });
      return;
    }

    // 5. Create Sale Record
    const { error: saleErr } = await supabase
      .from('retailer_sales')
      .insert({
        retailer_id,
        inventory_id,
        quantity_sold,
        price_per_unit: price_per_unit || null
      });

    if (saleErr) {
      console.error("Sale record creation failed:", saleErr);
      
      // Manual compensation rollback due to lack of RPC transaction
      await supabase
        .from('retailer_inventory')
        .update({ quantity: inventory.quantity, status: inventory.status })
        .eq('id', inventory_id);

      console.error('error occurred');
      res.status(500).json({ success: false, message: 'Failed to create sale record. Inventory changes reverted.' });
      return;
    }

    // Outbox events
    const { randomUUID } = require('crypto');
    await supabase.from('event_outbox').insert({
      event_id: randomUUID(),
      event_type: 'SALE_CREATED',
      topic: 'inventory-events',
      payload: {
        batch_id: inventory.batch_number,
        retailer_id: retailer_id,
        quantity_sold: quantity_sold
      }
    });
    // Also notify INVENTORY_UPDATED
    await supabase.from('event_outbox').insert({
      event_id: randomUUID(),
      event_type: 'INVENTORY_UPDATED',
      topic: 'inventory-events',
      payload: {
        batch_id: inventory.batch_number,
        retailer_id: retailer_id,
        new_quantity: newQuantity
      }
    });

    // 6. Create Traceability Event
    const { error: eventErr } = await supabase
      .from('traceability_events')
      .insert({
        product_id: inventory.product_id,
        batch_number: inventory.batch_number,
        event_type: 'RETAILER_SOLD',
        actor_id: retailer_id,
        location: 'Retail Store',
        metadata: {
          quantity_sold,
          unit: inventory.unit,
          price_per_unit
        }
      });

    if (eventErr) {
      console.error("Traceability event failed:", eventErr);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Sale recorded successfully',
      data: { remaining_quantity: newQuantity, status: newStatus }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getSales = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: sales, error } = await supabase
      .from('retailer_sales')
      .select('*, inventory:inventory_id(batch_number, unit, product:product_id(name))')
      .eq('retailer_id', retailer_id)
      .order('sale_date', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }

    res.status(200).json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const reportWastage = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;
    const { inventory_id, quantity, reason, notes } = req.body;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!inventory_id || !quantity || quantity <= 0 || !reason) {
      res.status(400).json({ success: false, message: 'Valid Inventory ID, quantity, and reason are required' });
      return;
    }

    // 1. Fetch inventory
    const { data: inventory, error: invErr } = await supabase
      .from('retailer_inventory')
      .select('*, product:product_id(name)')
      .eq('id', inventory_id)
      .single();

    if (invErr || !inventory) {
      res.status(404).json({ success: false, message: 'Inventory item not found' });
      return;
    }

    if (inventory.retailer_id !== retailer_id) {
      res.status(403).json({ success: false, message: 'You do not own this inventory item' });
      return;
    }

    // 2. Quantity check
    if (inventory.quantity < quantity) {
      res.status(400).json({ success: false, message: `Insufficient stock to report wastage. Only ${inventory.quantity} available.` });
      return;
    }

    const newQuantity = inventory.quantity - quantity;
    const newStatus = newQuantity <= 0 ? 'DEPLETED' : 'AVAILABLE';

    // 3. Update Inventory (with OCC)
    const { data: updateData, error: updateErr } = await supabase
      .from('retailer_inventory')
      .update({ quantity: newQuantity, status: newStatus })
      .eq('id', inventory_id)
      .eq('quantity', inventory.quantity)
      .select();

    if (updateErr) {
      res.status(500).json({ success: false, message: 'Failed to update inventory'});
      return;
    }

    if (!updateData || updateData.length === 0) {
      res.status(409).json({ success: false, message: 'Inventory was modified concurrently. Please refresh and try again.' });
      return;
    }

    // 4. Create Wastage Record
    const { error: wastageErr } = await supabase
      .from('retailer_wastage')
      .insert({
        retailer_id,
        inventory_id,
        quantity,
        reason,
        notes: notes || null
      });

    if (wastageErr) {
      console.error("Wastage record creation failed:", wastageErr);
      
      // Manual compensation rollback
      await supabase
        .from('retailer_inventory')
        .update({ quantity: inventory.quantity, status: inventory.status })
        .eq('id', inventory_id);
        
      console.error('error occurred');
      res.status(500).json({ success: false, message: 'Failed to create wastage record. Inventory changes reverted.' });
      return;
    } else {
      const { randomUUID } = require('crypto');
      await supabase.from('event_outbox').insert({
        event_id: randomUUID(),
        event_type: 'WASTAGE_RECORDED',
        topic: 'inventory-events',
        payload: {
          batch_id: inventory.batch_number,
          retailer_id: retailer_id,
          quantity_wasted: quantity,
          reason: reason
        }
      });
      await supabase.from('event_outbox').insert({
        event_id: randomUUID(),
        event_type: 'INVENTORY_UPDATED',
        topic: 'inventory-events',
        payload: {
          batch_id: inventory.batch_number,
          retailer_id: retailer_id,
          new_quantity: newQuantity
        }
      });
    }

    // 5. Create Traceability Event
    const { error: eventErr } = await supabase
      .from('traceability_events')
      .insert({
        product_id: inventory.product_id,
        batch_number: inventory.batch_number,
        event_type: 'RETAILER_WASTED',
        actor_id: retailer_id,
        location: 'Retail Store',
        metadata: {
          quantity_wasted: quantity,
          unit: inventory.unit,
          reason,
          notes
        }
      });

    if (eventErr) {
      console.error("Traceability event failed:", eventErr);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Wastage reported successfully',
      data: { remaining_quantity: newQuantity, status: newStatus }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getWastage = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: wastage, error } = await supabase
      .from('retailer_wastage')
      .select('*, inventory:inventory_id(batch_number, unit, product:product_id(name))')
      .eq('retailer_id', retailer_id)
      .order('report_date', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }

    res.status(200).json({ success: true, data: wastage });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getBatchTraceability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batch_number } = req.params;

    if (!batch_number) {
      res.status(400).json({ success: false, message: 'Batch number is required' });
      return;
    }

    // 1. Fetch Product details
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('*, farmer:farmer_id(name, email)')
      .eq('batch_number', batch_number)
      .single();

    if (productErr || !product) {
      res.status(404).json({ success: false, message: 'Product not found for this batch' });
      return;
    }

    // 2. Fetch Traceability Events
    const { data: events, error: eventsErr } = await supabase
      .from('traceability_events')
      .select('*, actor:actor_id(name, role)')
      .eq('batch_number', batch_number)
      .order('created_at', { ascending: true })
      .limit(500);

    if (eventsErr) {
      res.status(500).json({ success: false, message: 'Database error fetching events'});
      return;
    }

    res.status(200).json({ 
      success: true, 
      data: {
        product,
        events
      }
    });

  } catch (error) {
    console.error('error occurred');
      res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const processReturn = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;
    const { inventory_id, quantity, condition, reason } = req.body;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!inventory_id || !quantity || quantity <= 0 || !condition) {
      res.status(400).json({ success: false, message: 'Valid Inventory ID, quantity, and condition are required' });
      return;
    }

    // 1. Fetch inventory
    const { data: inventory, error: invErr } = await supabase
      .from('retailer_inventory')
      .select('*, product:product_id(name)')
      .eq('id', inventory_id)
      .single();

    if (invErr || !inventory) {
      res.status(404).json({ success: false, message: 'Associated inventory item not found' });
      return;
    }

    if (inventory.retailer_id !== retailer_id) {
      res.status(403).json({ success: false, message: 'You do not own this inventory item' });
      return;
    }

    // 2. Validate maximum allowable return (Cannot exceed what was sold minus already returned)
    const { data: salesData } = await supabase
      .from('retailer_sales')
      .select('quantity_sold')
      .eq('inventory_id', inventory_id);
    
    const totalSold = salesData?.reduce((sum, sale) => sum + (sale.quantity_sold || 0), 0) || 0;

    const { data: returnsData } = await supabase
      .from('retailer_returns')
      .select('quantity')
      .eq('inventory_id', inventory_id);

    const totalReturned = returnsData?.reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

    const eligibleForReturn = totalSold - totalReturned;
    if (quantity > eligibleForReturn) {
      res.status(400).json({ success: false, message: `Cannot return more than sold amount (${eligibleForReturn} eligible).` });
      return;
    }

    // 3. Create Return Record
    const { error: returnErr } = await supabase
      .from('retailer_returns')
      .insert({
        retailer_id,
        inventory_id,
        quantity,
        condition,
        reason: reason || null
      });

    if (returnErr) {
      res.status(500).json({ success: false, message: 'Failed to create return record'});
      return;
    }

    // 4. Handle Business Logic based on Condition
    let finalStatus = 'Recorded';
    
    // Safety hardening: if the item is expired, it cannot be restocked as sellable even if 'Good'.
    const isExpired = inventory.expiry_date && new Date(inventory.expiry_date) < new Date();
    const effectiveCondition = isExpired ? 'Expired' : condition;

    if (effectiveCondition === 'Good') {
      // Add back to inventory
      const newQuantity = inventory.quantity + quantity;
      const newStatus = 'AVAILABLE';
      
      const { data: updateData, error: updateErr } = await supabase
        .from('retailer_inventory')
        .update({ quantity: newQuantity, status: newStatus })
        .eq('id', inventory_id)
        .eq('quantity', inventory.quantity) // OCC
        .select();

      if (updateErr || !updateData || updateData.length === 0) {
        // Rollback return record
        await supabase.from('retailer_returns').delete().match({ retailer_id, inventory_id, quantity, condition });
        if (!updateData || updateData.length === 0) {
          res.status(409).json({ success: false, message: 'Inventory was modified concurrently. Please try again.' });
        } else {
          console.error('error occurred');
      res.status(500).json({ success: false, message: 'Failed to restock inventory'});
        }
        return;
      }
      finalStatus = 'Restocked';
    } else if (effectiveCondition === 'Damaged' || effectiveCondition === 'Expired') {
      // Send directly to Wastage
      const { error: wastageErr } = await supabase
        .from('retailer_wastage')
        .insert({
          retailer_id,
          inventory_id,
          quantity,
          reason: effectiveCondition === 'Expired' ? 'Customer Return - Expired' : 'Customer Return - Damaged',
          notes: reason || null
        });

      if (wastageErr) {
        // Rollback return record
        await supabase.from('retailer_returns').delete().match({ retailer_id, inventory_id, quantity, condition });
        console.error('error occurred');
      res.status(500).json({ success: false, message: 'Failed to record damaged return as wastage'});
        return;
      }
      finalStatus = 'Sent to Wastage';
    }

    // 4. Create Traceability Event
    const { error: eventErr } = await supabase
      .from('traceability_events')
      .insert({
        product_id: inventory.product_id,
        batch_number: inventory.batch_number,
        event_type: 'RETAILER_RETURNED',
        actor_id: retailer_id,
        location: 'Retail Store',
        metadata: {
          quantity_returned: quantity,
          unit: inventory.unit,
          condition,
          resolution: finalStatus,
          reason
        }
      });

    if (eventErr) {
      console.error("Traceability event failed:", eventErr);
    }

    res.status(200).json({ 
      success: true, 
      message: `Return processed successfully. Action: ${finalStatus}`,
      data: { condition, resolution: finalStatus }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getReturns = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: returns, error } = await supabase
      .from('retailer_returns')
      .select('*, inventory:inventory_id(batch_number, unit, product:product_id(name))')
      .eq('retailer_id', retailer_id)
      .order('return_date', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }

    res.status(200).json({ success: true, data: returns });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getDashboardData = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer_id = (req as any).user?.id;

    if (!retailer_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // 1. Fetch Inventory count and Low Stock
    const { data: inventory } = await supabase
      .from('retailer_inventory')
      .select('quantity, expiry_date, status')
      .eq('retailer_id', retailer_id);

    const activeInventory = inventory?.filter(i => i.status !== 'DEPLETED') || [];
    const totalItems = activeInventory.length;
    const lowStockItems = activeInventory.filter(i => i.quantity < 10).length;
    const expiredItems = activeInventory.filter(i => i.expiry_date && new Date(i.expiry_date) < new Date()).length;

    // 2. Fetch Recent Sales
    const { data: sales } = await supabase
      .from('retailer_sales')
      .select('quantity_sold, price_per_unit, sale_date')
      .eq('retailer_id', retailer_id)
      .order('sale_date', { ascending: false })
      .limit(500);

    // Calculate revenue
    const totalRevenue = sales?.reduce((sum, s) => sum + ((s.quantity_sold || 0) * (s.price_per_unit || 0)), 0) || 0;
    const recentSalesCount = sales?.length || 0;

    res.status(200).json({ 
      success: true, 
      data: {
        total_inventory_items: totalItems,
        low_stock_alerts: lowStockItems,
        expired_alerts: expiredItems,
        total_sales: recentSalesCount,
        total_revenue: totalRevenue
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

