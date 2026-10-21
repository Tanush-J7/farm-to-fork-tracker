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

/**
 * GET /api/processor/distributors
 * Returns available logistics distributors based strictly on real registered distributor
 * accounts created in the project and their actual live status (availability_status in DB
 * + active in-transit shipments count).
 */
export const getAvailableDistributors = async (req: Request, res: Response): Promise<void> => {
  try {
    const [distRes, retRes, shipRes, prodRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, email, wallet_address, role, availability_status, created_at')
        .eq('role', 'distributor')
        .order('created_at', { ascending: false }),
      supabase.from('users').select('id, name, email, role').eq('role', 'retailer'),
      supabase.from('shipments').select('id, distributor_id, sender_id, receiver_id, status, batch_number'),
      supabase.from('products').select('id, current_owner_id, status').eq('status', 'In Transit')
    ]);

    if (distRes.error) {
      res.status(500).json({ success: false, message: 'Failed to fetch distributors', error: distRes.error.message });
      return;
    }

    const allShipments = shipRes.data || [];
    const inTransitProducts = prodRes.data || [];

    const hubs = [
      'Kolar Cold Hub & Logistics Park',
      'Yeshwanthpur Agro-Terminal Hub',
      'Whitefield Refrigerated Depot',
      'Azadpur Mandi Cold Distribution Center',
      'APMC Electronic City Terminal'
    ];

    const rawDistributors = distRes.data || [];

    // Map each real distributor account to their live operational profile
    const processedDistributors = rawDistributors.map((d) => {
      // 1. Calculate active deliveries in transit for this distributor
      const activeShipments = allShipments.filter(
        (s) => (s.distributor_id === d.id || s.sender_id === d.id) && s.status === 'IN_TRANSIT'
      );
      const activeOwnedProducts = inTransitProducts.filter(
        (p) => p.current_owner_id === d.id
      );
      const activeDeliveriesCount = activeShipments.length + activeOwnedProducts.length;

      // 2. Calculate completed deliveries
      const completedShipments = allShipments.filter(
        (s) => (s.distributor_id === d.id || s.sender_id === d.id) && (s.status === 'RECEIVED' || s.status === 'DELIVERED')
      );

      // 3. Evaluate real availability based on account's availability_status and active deliveries
      const userSetStatus = (d.availability_status || '').trim();
      let currentStatus: 'AVAILABLE' | 'ON_ROUTE' | 'UNAVAILABLE' = 'AVAILABLE';
      let statusReason = 'Ready for dispatch';

      if (
        userSetStatus.toLowerCase().includes('unavailable') ||
        userSetStatus.toLowerCase().includes('off duty') ||
        userSetStatus.toLowerCase().includes('inactive')
      ) {
        currentStatus = 'UNAVAILABLE';
        statusReason = userSetStatus || 'Off Duty';
      } else if (activeDeliveriesCount > 0) {
        currentStatus = 'ON_ROUTE';
        statusReason = `${activeDeliveriesCount} active cargo in transit`;
      } else if (
        userSetStatus.toLowerCase().includes('route') ||
        (userSetStatus.toLowerCase().includes('trip') && !userSetStatus.toLowerCase().includes('available'))
      ) {
        currentStatus = 'ON_ROUTE';
        statusReason = userSetStatus;
      } else {
        currentStatus = 'AVAILABLE';
        statusReason = userSetStatus || 'Available for Trip';
      }

      // Consistent deterministic vehicle number and hub based on account ID
      const charSum = (d.id || '').split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
      const vehicleNum = `KA-04-E${1000 + (charSum % 8999)}`;
      const hub = hubs[charSum % hubs.length];

      return {
        id: d.id,
        name: d.name || `Distributor (${d.email.split('@')[0]})`,
        email: d.email,
        wallet_address: d.wallet_address,
        fleet_name: `${d.name || d.email.split('@')[0]} Cold Fleet`,
        vehicle_type: 'Heavy Reefer Truck (Cold-Chain)',
        vehicle_number: vehicleNum,
        temperature_control: '2°C to 6°C (Precision Chilled)',
        payload_capacity: '3,000 kg',
        current_status: currentStatus,
        status_reason: statusReason,
        availability_status: d.availability_status || 'Available for Trip',
        base_hub: hub,
        active_deliveries: activeDeliveriesCount,
        completed_trips: completedShipments.length,
        rating: 4.8,
        phone: `+91 9845${(charSum * 7) % 90000 + 10000}`
      };
    });

    // Sort: AVAILABLE accounts first, and primary registered accounts (e.g. distributor@gmail.com) prioritized
    processedDistributors.sort((a, b) => {
      if (a.email === 'distributor@gmail.com') return -1;
      if (b.email === 'distributor@gmail.com') return 1;
      if (a.current_status === 'AVAILABLE' && b.current_status !== 'AVAILABLE') return -1;
      if (a.current_status !== 'AVAILABLE' && b.current_status === 'AVAILABLE') return 1;
      return 0;
    });

    res.status(200).json({
      success: true,
      distributors: processedDistributors,
      retailers: retRes.data || []
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/processor/assign-distributor
 * Explicitly assigns an available distributor to an inspected/processed batch,
 * creating the active shipment and broadcasting custody to Sepolia testnet.
 */
export const assignDistributor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { product_id, distributor_id, retailer_id, destination_store, dispatch_notes } = req.body;
    const processorId = (req as any).user?.id;

    if (!product_id || !distributor_id) {
      res.status(400).json({ success: false, message: 'product_id and distributor_id are required' });
      return;
    }

    // 1. Fetch product
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .or(`id.eq.${product_id},batch_number.eq.${product_id}`)
      .limit(1)
      .maybeSingle();

    if (prodErr || !product) {
      res.status(404).json({ success: false, message: 'Product batch not found' });
      return;
    }

    // 2. Fetch distributor
    const { data: distributor, error: distErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', distributor_id)
      .single();

    if (distErr || !distributor) {
      res.status(404).json({ success: false, message: 'Distributor not found' });
      return;
    }

    const targetStore = destination_store || 'Metro Fresh Mart Koramangala Store #104';

    // 3. Update Product record
    const { error: prodUpdateErr } = await supabase
      .from('products')
      .update({
        status: 'In Transit',
        current_owner_id: distributor_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', product.id);

    if (prodUpdateErr) {
      res.status(500).json({ success: false, message: 'Failed to update product owner', error: prodUpdateErr.message });
      return;
    }

    // 4. Create or update shipment
    const trackingId = `TRK-${Date.now()}`;
    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .insert({
        shipment_tracking_id: trackingId,
        batch_number: product.batch_number,
        product_id: product.id,
        distributor_id: distributor_id,
        receiver_id: retailer_id || null,
        sender_id: processorId,
        quantity: product.quantity,
        unit: 'kg',
        status: 'IN_TRANSIT',
        expected_delivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (shipErr) {
      console.warn('[assignDistributor] Non-fatal shipment insert warning:', shipErr.message);
    }

    // 5. Broadcast to Sepolia Blockchain
    let txHash: string | null = null;
    if (product.product_id && Number(product.product_id) > 0 && blockchainRelayer.isConfigured()) {
      try {
        const extra = `Handed over to ${distributor.name || 'Distributor'} for delivery to ${targetStore}. ${dispatch_notes || 'Cold-chain SLA verified.'}`;
        const relayRes = await blockchainRelayer.updateStage(
          Number(product.product_id),
          'In Transit',
          extra
        );
        txHash = relayRes.txHash;
        await supabase
          .from('products')
          .update({ blockchain_hash: txHash })
          .eq('id', product.id);
      } catch (bcErr: any) {
        console.warn('[assignDistributor] Blockchain relayer warning:', bcErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Batch ${product.batch_number} successfully assigned to ${distributor.name} and dispatched to ${targetStore}`,
      data: {
        product_id: product.id,
        batch_number: product.batch_number,
        distributor_id: distributor.id,
        distributor_name: distributor.name,
        destination_store: targetStore,
        tracking_id: trackingId,
        blockchain_hash: txHash,
        shipment
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
