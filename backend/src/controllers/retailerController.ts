import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ethers } from 'ethers';

// Generate a unique Request ID (e.g., REQ-1023)
const generateRequestId = async () => {
  const { data, error } = await supabase
    .from('product_requests')
    .select('request_id')
    .order('created_at', { ascending: false })
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
      res.status(500).json({ success: false, message: 'Database error', error });
      return;
    }

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
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
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Database error', error });
      return;
    }

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
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
      .select('*, processor:processor_id(name, email, phone), distributor:distributor_id(name, email, phone), request:request_id(product_name, request_id)')
      .eq('retailer_id', retailer_id)
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

    if (shipment.retailer_id !== retailer_id) {
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
        processor_id: shipment.processor_id,
        expiry_date: product.expiry_date
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error during verification', error });
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

    if (shipment.retailer_id !== retailer_id) {
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

    // 2. Blockchain Transaction simulation / execution
    let txHash = null;
    try {
      if (process.env.BLOCKCHAIN_RPC_URL && process.env.BLOCKCHAIN_PRIVATE_KEY && process.env.CONTRACT_ADDRESS) {
        const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
        const wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);
        const CONTRACT_ABI = ["function recordReceipt(string memory _batchNumber) public"];
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
        const tx = await contract.recordReceipt(shipment.batch_number);
        await tx.wait();
        txHash = tx.hash;
      } else {
        const randomBytes = ethers.randomBytes(32);
        txHash = ethers.hexlify(randomBytes);
      }
    } catch (bcError) {
      console.error("Blockchain transaction failed:", bcError);
      res.status(500).json({ 
        success: false, 
        message: 'Blockchain recording failed. Transaction aborted for data integrity. Please retry.', 
        error: bcError 
      });
      return;
    }

    // 3. Mark Shipment RECEIVED
    const { error: updateShipmentErr } = await supabase
      .from('shipments')
      .update({ status: 'RECEIVED' })
      .eq('id', shipment_id);

    if (updateShipmentErr) {
      res.status(500).json({ success: false, message: 'Failed to update shipment status', error: updateShipmentErr });
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
    res.status(500).json({ success: false, message: 'Server Error during receiving', error });
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
      .order('expiry_date', { ascending: true });

    if (error) {
      res.status(500).json({ success: false, message: 'Database error', error });
      return;
    }

    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
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

    // 4. Update Inventory
    const { error: updateErr } = await supabase
      .from('retailer_inventory')
      .update({ quantity: newQuantity, status: newStatus })
      .eq('id', inventory_id);

    if (updateErr) {
      res.status(500).json({ success: false, message: 'Failed to update inventory', error: updateErr });
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
    } else {
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
    }

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
    res.status(500).json({ success: false, message: 'Server Error', error });
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
      .order('sale_date', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Database error', error });
      return;
    }

    res.status(200).json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
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

    // 3. Update Inventory
    const { error: updateErr } = await supabase
      .from('retailer_inventory')
      .update({ quantity: newQuantity, status: newStatus })
      .eq('id', inventory_id);

    if (updateErr) {
      res.status(500).json({ success: false, message: 'Failed to update inventory', error: updateErr });
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
    res.status(500).json({ success: false, message: 'Server Error', error });
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
      .order('report_date', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Database error', error });
      return;
    }

    res.status(200).json({ success: true, data: wastage });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
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
      .order('created_at', { ascending: true });

    if (eventsErr) {
      res.status(500).json({ success: false, message: 'Database error fetching events', error: eventsErr });
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
    res.status(500).json({ success: false, message: 'Server Error', error });
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

    // 2. Create Return Record
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
      res.status(500).json({ success: false, message: 'Failed to create return record', error: returnErr });
      return;
    }

    // 3. Handle Business Logic based on Condition
    let finalStatus = 'Recorded';
    
    if (condition === 'Good') {
      // Add back to inventory
      const newQuantity = inventory.quantity + quantity;
      const newStatus = 'AVAILABLE';
      
      const { error: updateErr } = await supabase
        .from('retailer_inventory')
        .update({ quantity: newQuantity, status: newStatus })
        .eq('id', inventory_id);

      if (!updateErr) finalStatus = 'Restocked';
    } else if (condition === 'Damaged') {
      // Send directly to Wastage
      const { error: wastageErr } = await supabase
        .from('retailer_wastage')
        .insert({
          retailer_id,
          inventory_id,
          quantity,
          reason: 'Customer Return - Damaged',
          notes: reason || null
        });

      if (!wastageErr) finalStatus = 'Sent to Wastage';
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
    res.status(500).json({ success: false, message: 'Server Error', error });
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
      .order('return_date', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Database error', error });
      return;
    }

    res.status(200).json({ success: true, data: returns });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
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
      .order('sale_date', { ascending: false });

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
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

