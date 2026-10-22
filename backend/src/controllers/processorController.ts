import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { blockchainRelayer } from '../services/blockchainRelayer';
import { getActiveProfile } from '../services/profileService';

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

    // Filter out dummy/test accounts so only real registered distributor accounts are returned
    const isRealAccount = (u: any) => {
      const email = (u.email || '').toLowerCase();
      const name = (u.name || '').toLowerCase();
      if (email.includes('example.com') || email.includes('@t.com') || email.includes('@test.com')) return false;
      if (/_\d{10,}@/.test(email)) return false;
      if (/dist\d/i.test(name) && /\d{4,}/.test(name)) return false;
      return true;
    };

    const rawDistributors = (distRes.data || []).filter(isRealAccount);

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

/**
 * POST /api/processor/request-delivery
 * Processor sends a formal delivery dispatch request to a distributor.
 * The request is recorded with status 'REQUESTED'.
 * The distributor will view the full manifest and decide whether to accept or decline.
 */
export const sendDeliveryRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      product_id,
      distributor_id,
      retailer_id,
      destination_store,
      pickup_location,
      required_date,
      temperature_sla,
      dispatch_notes,
      quantity
    } = req.body;
    const processorId = (req as any).user?.id;

    if (!product_id || !distributor_id) {
      res.status(400).json({ success: false, message: 'product_id and distributor_id are required' });
      return;
    }

    // 1. Fetch product & processor
    const [prodRes, distRes, procRes] = await Promise.all([
      supabase.from('products').select('*').or(`id.eq.${product_id},batch_number.eq.${product_id}`).limit(1).maybeSingle(),
      supabase.from('users').select('*').eq('id', distributor_id).single(),
      supabase.from('users').select('*').eq('id', processorId).single()
    ]);

    const product = prodRes.data;
    const distributor = distRes.data;
    const processor = procRes.data;

    if (!product) {
      res.status(404).json({ success: false, message: 'Product batch not found' });
      return;
    }

    if (!distributor) {
      res.status(404).json({ success: false, message: 'Distributor not found' });
      return;
    }

    const trackingId = `REQ-${Date.now()}`;

    // Look up verified active profile locations
    const processorProfile = await getActiveProfile(processorId);
    const retailerProfile = retailer_id ? await getActiveProfile(retailer_id) : null;

    // The verified profile location is the definitive source of truth
    const pickupLoc = processorProfile.address;
    const targetStore = retailerProfile
      ? `${retailerProfile.business_name}, ${retailerProfile.address}`
      : (destination_store || "Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034");

    const tempSla = temperature_sla || '2°C to 6°C Precision Chilled';
    const notes = dispatch_notes || 'Cold-chain SLA verified. Quality certified batch ready for cargo transfer.';

    // 2. Create shipment with status 'REQUESTED'
    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .insert({
        shipment_tracking_id: trackingId,
        batch_number: product.batch_number,
        product_id: product.id,
        distributor_id: distributor_id,
        receiver_id: retailer_id || distributor_id,
        sender_id: processorId,
        quantity: quantity || product.quantity,
        unit: 'kg',
        status: 'REQUESTED',
        expected_delivery: required_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (shipErr) {
      res.status(500).json({ success: false, message: 'Failed to create delivery request', error: shipErr.message });
      return;
    }

    // 3. Log traceability event with full manifest metadata
    await supabase.from('traceability_events').insert({
      product_id: product.id,
      batch_number: product.batch_number,
      event_type: 'DELIVERY_REQUEST',
      actor_id: processorId,
      location: targetStore,
      metadata: {
        shipment_id: shipment.id,
        tracking_id: trackingId,
        distributor_id: distributor.id,
        distributor_name: distributor.name,
        processor_id: processorId,
        processor_name: processorProfile.business_name || processor?.name || 'Processor',
        processor_phone: processorProfile.phone,
        processor_license: processorProfile.license_number,
        processor_coordinates: processorProfile.coordinates,
        retailer_id: retailer_id || null,
        retailer_name: retailerProfile?.business_name || null,
        retailer_phone: retailerProfile?.phone || null,
        retailer_license: retailerProfile?.license_number || null,
        retailer_coordinates: retailerProfile?.coordinates || null,
        pickup_location: pickupLoc,
        destination_store: targetStore,
        required_date: required_date || null,
        temperature_sla: tempSla,
        dispatch_notes: notes,
        requested_at: new Date().toISOString()
      }
    });

    // 4. Send notification to distributor
    await supabase.from('notifications').insert({
      user_id: distributor.id,
      type: 'DELIVERY_REQUEST',
      title: 'Incoming Delivery Request',
      message: `Processor ${processor?.name || 'Admin'} requested delivery for Batch ${product.batch_number} (${product.name}, ${product.quantity} kg) to ${targetStore}`,
      related_entity_type: 'shipment',
      related_entity_id: shipment.id
    });

    res.status(200).json({
      success: true,
      message: `Delivery request for Batch ${product.batch_number} sent to ${distributor.name}. Awaiting distributor acceptance.`,
      data: {
        shipment_id: shipment.id,
        tracking_id: trackingId,
        status: 'REQUESTED',
        product_id: product.id,
        batch_number: product.batch_number,
        distributor: {
          id: distributor.id,
          name: distributor.name,
          email: distributor.email
        },
        destination_store: targetStore,
        pickup_location: pickupLoc,
        temperature_sla: tempSla,
        notes
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/processor/delivery-requests
 * Returns all delivery requests sent by the logged-in processor with live status,
 * pickup tokens, QR payload, and driver vehicle handoff manifests.
 */
export const getProcessorDeliveryRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const processorId = (req as any).user?.id;
    if (!processorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: shipments, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('sender_id', processorId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch processor delivery requests', error: error.message });
      return;
    }

    const distIds = (shipments || []).map((s) => s.distributor_id).filter(Boolean);
    const prodIds = (shipments || []).map((s) => s.product_id).filter(Boolean);

    const [distRes, prodRes, eventsRes, procProfile] = await Promise.all([
      distIds.length > 0 ? supabase.from('users').select('id, name, email, phone').in('id', distIds) : { data: [] },
      prodIds.length > 0 ? supabase.from('products').select('*').in('id', prodIds) : { data: [] },
      prodIds.length > 0
        ? supabase
            .from('traceability_events')
            .select('*')
            .in('product_id', prodIds)
            .in('event_type', [
              'DELIVERY_REQUEST',
              'DELIVERY_ACCEPTED',
              'PICKUP_QR_GENERATED',
              'PICKUP_VERIFIED',
              'DISPATCHED_TO_RETAILER',
              'DELIVERY_QR_GENERATED',
              'RETAILER_ACCEPTED',
              'DELIVERY_DECLINED',
              'DELIVERY_DISPUTED'
            ])
            .order('created_at', { ascending: false })
        : { data: [] },
      getActiveProfile(processorId)
    ]);

    const distMap = new Map((distRes.data || []).map((d) => [d.id, d]));
    const prodMap = new Map((prodRes.data || []).map((p) => [p.id, p]));

    const result = await Promise.all(
      (shipments || []).map(async (s) => {
        const dist = distMap.get(s.distributor_id);
        const prod = prodMap.get(s.product_id);
        const relatedEvents = (eventsRes.data || []).filter(
          (e) => e.product_id === s.product_id && (e.metadata?.shipment_id === s.id || !e.metadata?.shipment_id)
        );

        const reqEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_REQUEST');
        const acceptEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_ACCEPTED');
        const pickupQrEvent = relatedEvents.find((e) => e.event_type === 'PICKUP_QR_GENERATED');
        const pickupVerifiedEvent = relatedEvents.find(
          (e) => e.event_type === 'PICKUP_VERIFIED' || e.event_type === 'DISPATCHED_TO_RETAILER'
        );
        const deliveryAcceptedEvent = relatedEvents.find((e) => e.event_type === 'RETAILER_ACCEPTED');
        const declineEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_DECLINED');
        const disputeEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_DISPUTED');

        const meta = reqEvent?.metadata || {};
        const pickupMeta = pickupQrEvent?.metadata || {};
        const verifiedMeta = pickupVerifiedEvent?.metadata || {};

        let retProfile = null;
        if (s.receiver_id) {
          retProfile = await getActiveProfile(s.receiver_id).catch(() => null);
        }

        const destinationStoreName = retProfile?.business_name || meta.destination_store || "Metro Fresh Supermarket (Koramangala)";
        const destinationStoreAddress = retProfile?.address || meta.destination_store_address || "80 Feet Main Road, 4th Block, Koramangala, Bengaluru 560034";
        const pickupAddress = procProfile.address || meta.pickup_location || 'Agro-Processing Unit #4, Yeshwanthpur Industrial Suburb, APMC Yard, Bengaluru 560022';

        // Pre-build QR payload if ready for pickup
        const pickupToken = pickupMeta.pickup_token || null;
        let pickupQrPayload = null;
        if (pickupToken) {
          pickupQrPayload = JSON.stringify({
            qr_type: 'PROCESSOR_PICKUP',
            pickup_token: pickupToken,
            shipment_id: s.id,
            tracking_id: s.shipment_tracking_id,
            batch_number: s.batch_number,
            product_name: prod?.name || 'Produce Batch',
            quantity: s.quantity,
            unit: s.unit || 'kg',
            processor_id: processorId,
            processor_name: procProfile.business_name,
            distributor_id: s.distributor_id,
            destination_store: destinationStoreName,
            generated_at: pickupQrEvent?.created_at
          });
        }

        return {
          id: s.id,
          tracking_id: s.shipment_tracking_id,
          status: s.status, // REQUESTED, ACCEPTED, PICKUP_QR_GENERATED, IN_TRANSIT, DELIVERED, COMPLETED, DECLINED, DISPUTED
          batch_number: s.batch_number,
          product_id: s.product_id,
          product_name: prod?.name || 'Produce Batch',
          category: prod?.category || 'Fresh Produce',
          quantity: s.quantity,
          unit: s.unit || 'kg',
          quality_score: prod?.ai_quality_score || 94,
          quality_label: prod?.ai_quality_label || 'Grade A',
          expiry_date: prod?.expiry_date || null,
          blockchain_hash: prod?.blockchain_hash || null,
          created_at: s.created_at,
          accepted_at: acceptEvent?.created_at || null,
          distributor: {
            id: dist?.id,
            name: dist?.name || 'Distributor',
            email: dist?.email,
            phone: dist?.phone || '+91 98111 87654'
          },
          // Pickup & Dispatch QR details
          pickup_token: pickupToken,
          pickup_qr_token: pickupToken,
          pickup_qr_payload: pickupQrPayload,
          pickup_qr_data: pickupQrPayload,
          dispatch_snapshot: pickupMeta.dispatch_snapshot || null,
          // Collected Driver & Vehicle Details
          distributor_driver: verifiedMeta.driver_name || null,
          distributor_vehicle: verifiedMeta.vehicle_number || null,
          distributor_phone: verifiedMeta.driver_phone || null,
          departure_temperature: verifiedMeta.departure_temperature || null,
          pickup_verified_at: verifiedMeta.pickup_verified_at || null,
          delivery_verified_at: deliveryAcceptedEvent?.created_at || null,
          // Logistics Locations
          destination_store: destinationStoreName,
          destination_store_address: destinationStoreAddress,
          pickup_location: pickupAddress,
          temperature_sla: meta.temperature_sla || '2°C to 6°C Precision Chilled',
          dispatch_notes: meta.dispatch_notes,
          decline_reason: declineEvent?.metadata?.decline_reason || null,
          dispute_details: disputeEvent?.metadata || null
        };
      })
    );

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/processor/delivery-requests/:id/generate-pickup-qr
 * Generates an immutable blockchain-backed pickup QR for an accepted order.
 */
export const generatePickupQR = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const processorId = (req as any).user?.id;
    if (!processorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // 1. Fetch shipment
    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .eq('sender_id', processorId)
      .single();

    if (shipErr || !shipment) {
      res.status(404).json({ success: false, message: 'Delivery request not found or unauthorized' });
      return;
    }

    if (shipment.status === 'REQUESTED') {
      res.status(400).json({
        success: false,
        message: 'The distributor must review and accept this delivery request before the Pickup QR can be generated.'
      });
      return;
    }

    if (shipment.status === 'IN_TRANSIT' || shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED') {
      res.status(400).json({
        success: false,
        message: `Shipment is already ${shipment.status}. Pickup QR cannot be regenerated after cargo collection.`
      });
      return;
    }

    // 2. Fetch associated product, processor profile, retailer profile, distributor user & profile
    const [prodRes, procProfile, retProfile, distUserRes, distProfile] = await Promise.all([
      supabase.from('products').select('*').eq('id', shipment.product_id).single(),
      getActiveProfile(processorId),
      shipment.receiver_id ? getActiveProfile(shipment.receiver_id).catch(() => null) : Promise.resolve(null),
      supabase.from('users').select('id, name, email, phone').eq('id', shipment.distributor_id).single(),
      getActiveProfile(shipment.distributor_id).catch(() => null)
    ]);

    const product = prodRes.data;
    const distributor = distUserRes.data;

    // 3. Generate secure cryptographic pickup token
    const randomHex = crypto.randomBytes(12).toString('hex');
    const pickupToken = `PKP_${shipment.id.slice(0, 8)}_${randomHex}_${Date.now()}`;

    // 4. Build authoritative dispatch snapshot
    const dispatchSnapshot = {
      order_id: shipment.id,
      shipment_tracking_id: shipment.shipment_tracking_id,
      dispatch_id: `DSP-${Date.now()}`,
      pickup_token: pickupToken,
      created_at: shipment.created_at,
      pickup_qr_generated_at: new Date().toISOString(),
      status: 'PICKUP_QR_GENERATED',
      product: {
        id: product?.id,
        name: product?.name || 'Packaged Produce',
        category: product?.category || 'Perishables',
        batch_number: shipment.batch_number,
        quantity: shipment.quantity,
        unit: shipment.unit || 'kg',
        quality_score: product?.ai_quality_score || 94,
        quality_label: product?.ai_quality_label || 'Grade A',
        expiry_date: product?.expiry_date || null,
        organic_status: product?.organic_status || false,
        blockchain_hash: product?.blockchain_hash || null,
        on_chain_product_id: product?.product_id || 0
      },
      processor: {
        id: processorId,
        facility_name: procProfile.business_name || (req as any).user?.name || 'Agro-Processing Facility',
        license_number: procProfile.license_number || 'FSSAI-VERIFIED',
        address: procProfile.address,
        city: procProfile.city,
        state: procProfile.state,
        pincode: procProfile.pincode,
        phone: procProfile.phone,
        email: (req as any).user?.email
      },
      retailer: {
        id: shipment.receiver_id,
        store_name: retProfile?.business_name || 'Retail Supermarket',
        license_number: retProfile?.license_number || 'TRADE-VERIFIED',
        address: retProfile?.address || 'Store Dock',
        city: retProfile?.city || 'Bengaluru',
        phone: retProfile?.phone
      },
      distributor: {
        id: shipment.distributor_id,
        name: distributor?.name || 'Distributor',
        company_name: distProfile?.business_name || distributor?.name,
        phone: distProfile?.phone || distributor?.phone,
        email: distributor?.email,
        license_number: distProfile?.license_number || 'MVA-CARRIER'
      },
      logistics: {
        pickup_address: procProfile.address,
        delivery_address: retProfile?.address,
        temperature_sla: '2°C to 6°C Precision Chilled',
        approved_dispatch_quantity: shipment.quantity
      }
    };

    // 5. Update shipment status to PICKUP_QR_GENERATED
    await supabase
      .from('shipments')
      .update({
        status: 'PICKUP_QR_GENERATED',
        updated_at: new Date().toISOString()
      })
      .eq('id', shipment.id);

    // 6. Record in traceability_events
    await supabase.from('traceability_events').insert({
      product_id: shipment.product_id,
      batch_number: shipment.batch_number,
      event_type: 'PICKUP_QR_GENERATED',
      actor_id: processorId,
      location: procProfile.address || 'Processor Dispatch Bay',
      metadata: {
        shipment_id: shipment.id,
        tracking_id: shipment.shipment_tracking_id,
        pickup_token: pickupToken,
        dispatch_snapshot: dispatchSnapshot
      }
    });

    // 7. On-chain update via Gasless Relayer
    let txHash: string | null = null;
    if (product && product.product_id && Number(product.product_id) > 0 && blockchainRelayer.isConfigured()) {
      try {
        const relayRes = await blockchainRelayer.updateStage(
          Number(product.product_id),
          'Ready for Pickup',
          `Processor generated Pickup QR for Batch ${shipment.batch_number}. Assigned Carrier: ${distributor?.name || 'Distributor'}.`
        );
        txHash = relayRes.txHash;
        await supabase.from('products').update({ blockchain_hash: txHash }).eq('id', product.id);
      } catch (bcErr: any) {
        console.warn('[generatePickupQR] Blockchain relayer warning:', bcErr.message);
      }
    }

    // 8. Construct structured QR payload
    const qrPayload = JSON.stringify({
      qr_type: 'PROCESSOR_PICKUP',
      pickup_token: pickupToken,
      shipment_id: shipment.id,
      tracking_id: shipment.shipment_tracking_id,
      batch_number: shipment.batch_number,
      product_name: product?.name || 'Packaged Produce',
      quantity: shipment.quantity,
      unit: shipment.unit || 'kg',
      processor_id: processorId,
      processor_name: procProfile.business_name,
      distributor_id: shipment.distributor_id,
      distributor_name: distributor?.name,
      destination_store: retProfile?.business_name || 'Retail Supermarket',
      generated_at: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Blockchain-backed Pickup QR generated successfully.',
      data: {
        pickup_token: pickupToken,
        pickup_qr_token: pickupToken,
        qr_payload: qrPayload,
        pickup_qr_data: qrPayload,
        dispatch_snapshot: dispatchSnapshot,
        blockchain_hash: txHash
      }
    });
  } catch (error: any) {
    console.error('generatePickupQR error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/processor/delivery-requests/:id/confirm-dispatch
 * Processor confirms physical cargo release to the arrived carrier.
 */
export const confirmProcessorDispatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const processorId = (req as any).user?.id;
    const { notes } = req.body;

    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .eq('sender_id', processorId)
      .single();

    if (shipErr || !shipment) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }

    await supabase.from('traceability_events').insert({
      product_id: shipment.product_id,
      batch_number: shipment.batch_number,
      event_type: 'PROCESSOR_DISPATCH_CONFIRMED',
      actor_id: processorId,
      location: 'Processor Facility Dispatch Bay',
      metadata: {
        shipment_id: shipment.id,
        confirmed_at: new Date().toISOString(),
        notes: notes || 'Processor confirmed physical handover and cargo release.'
      }
    });

    res.status(200).json({ success: true, message: 'Processor dispatch confirmed successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/processor/state
 * Cloud sync: fetch processor activity state (batches, receipts, verifications, inspections, decisions, logs, interests)
 */
export const getProcessorState = async (req: Request, res: Response): Promise<void> => {
  try {
    const processorId = (req as any).user?.id;
    if (!processorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: record, error } = await supabase
      .from('traceability_events')
      .select('*')
      .eq('actor_id', processorId)
      .eq('event_type', 'PROCESSOR_STATE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch state', error: error.message });
      return;
    }

    const state = record?.metadata || {};
    res.status(200).json({ success: true, data: state });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * PUT /api/processor/state
 * Cloud sync: persist processor activity state so it stays synced across all devices
 */
export const saveProcessorState = async (req: Request, res: Response): Promise<void> => {
  try {
    const processorId = (req as any).user?.id;
    if (!processorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const incomingState = req.body || {};

    const { data: existing } = await supabase
      .from('traceability_events')
      .select('id, metadata')
      .eq('actor_id', processorId)
      .eq('event_type', 'PROCESSOR_STATE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const mergedMetadata = {
        ...(existing.metadata || {}),
        ...incomingState,
        synced_at: new Date().toISOString()
      };
      await supabase
        .from('traceability_events')
        .update({
          metadata: mergedMetadata,
          created_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('traceability_events')
        .insert({
          batch_number: 'PROCESSOR_SYNC',
          event_type: 'PROCESSOR_STATE',
          actor_id: processorId,
          location: 'Cloud Sync State',
          metadata: {
            ...incomingState,
            synced_at: new Date().toISOString()
          }
        });
    }

    res.status(200).json({ success: true, message: 'Processor state synchronized' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/processor/notify-farmer
 * Notify farmer of processor intake decision and sync to farmer cloud state
 */
export const notifyFarmerIntake = async (req: Request, res: Response): Promise<void> => {
  try {
    const { farmer_id, product_id, batch_number, status, message, quantity, grade } = req.body;
    const processorId = (req as any).user?.id;

    let targetFarmerId = farmer_id;
    if (!targetFarmerId && product_id) {
      const { data: prod } = await supabase.from('products').select('farmer_id').eq('id', product_id).single();
      if (prod?.farmer_id) {
        targetFarmerId = prod.farmer_id;
      }
    }

    if (targetFarmerId) {
      // 1. Insert into notifications table
      await supabase.from('notifications').insert({
        user_id: targetFarmerId,
        type: status === 'accepted' ? 'PROCESSOR_ACCEPTED' : 'PROCESSOR_REJECTED',
        title: status === 'accepted' ? 'Produce Accepted by Processor' : 'Produce Rejected by Processor',
        message: message || `Your batch has been ${status} by the processor.`,
        metadata: { product_id, batch_number, status, quantity, grade, processor_id: processorId }
      });

      // 2. Also update farmer state in traceability_events
      const { data: existingFarmerState } = await supabase
        .from('traceability_events')
        .select('id, metadata')
        .eq('actor_id', targetFarmerId)
        .eq('event_type', 'FARMER_STATE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newNotif = {
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        type: status === 'accepted' ? 'processor_accepted' : 'processor_rejected',
        productId: String(product_id),
        batchNumber: batch_number || '',
        quantity: quantity || 0,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        timestamp: Date.now(),
        read: false,
        message: message
      };

      if (existingFarmerState) {
        const prevMeta = existingFarmerState.metadata || {};
        const prevDeals = prevMeta.deals || {};
        const prevNotifs = prevMeta.notifications || [];
        const updatedDeals = { ...prevDeals, [product_id]: status, [batch_number]: status };
        const updatedNotifs = [newNotif, ...prevNotifs];

        await supabase
          .from('traceability_events')
          .update({
            metadata: {
              ...prevMeta,
              deals: updatedDeals,
              notifications: updatedNotifs,
              synced_at: new Date().toISOString()
            }
          })
          .eq('id', existingFarmerState.id);
      } else {
        await supabase
          .from('traceability_events')
          .insert({
            batch_number: 'FARMER_SYNC',
            event_type: 'FARMER_STATE',
            actor_id: targetFarmerId,
            location: 'Cloud Sync State',
            metadata: {
              deals: { [product_id]: status, [batch_number]: status },
              notifications: [newNotif],
              synced_at: new Date().toISOString()
            }
          });
      }
    }

    res.status(200).json({ success: true, message: 'Farmer notified successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Error notifying farmer', error: err.message });
  }
};
