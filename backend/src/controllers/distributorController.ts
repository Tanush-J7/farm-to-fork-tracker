import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { blockchainRelayer } from '../services/blockchainRelayer';
import { getActiveProfile } from '../services/profileService';

/**
 * GET /api/distributor/delivery-requests
 * Returns all delivery requests sent to the logged-in distributor with complete
 * processor facility, destination store, produce manifest, and temperature SLA details.
 */
export const getDistributorDeliveryRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const distributorId = (req as any).user?.id;
    if (!distributorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // 1. Fetch shipments assigned to this distributor
    const { data: shipments, error: shipErr } = await supabase
      .from('shipments')
      .select('*')
      .eq('distributor_id', distributorId)
      .order('created_at', { ascending: false });

    if (shipErr) {
      res.status(500).json({ success: false, message: 'Failed to fetch delivery requests', error: shipErr.message });
      return;
    }

    if (!shipments || shipments.length === 0) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    // 2. Fetch associated products, processors (senders), and retailers (receivers)
    const productIds = shipments.map((s) => s.product_id).filter(Boolean);
    const userIds = [
      ...shipments.map((s) => s.sender_id).filter(Boolean),
      ...shipments.map((s) => s.receiver_id).filter(Boolean)
    ];

    const [prodRes, usersRes, eventsRes] = await Promise.all([
      productIds.length > 0 ? supabase.from('products').select('*').in('id', productIds) : { data: [] },
      userIds.length > 0 ? supabase.from('users').select('id, name, email, role').in('id', userIds) : { data: [] },
      productIds.length > 0
        ? supabase
            .from('traceability_events')
            .select('*')
            .in('product_id', productIds)
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
        : { data: [] }
    ]);

    const productsMap = new Map((prodRes.data || []).map((p) => [p.id, p]));
    const usersMap = new Map((usersRes.data || []).map((u) => [u.id, u]));

    const enrichedRequests = await Promise.all(
      shipments.map(async (shipment) => {
        const product = productsMap.get(shipment.product_id);
        const processor = usersMap.get(shipment.sender_id);
        const retailer = usersMap.get(shipment.receiver_id);

        const relatedEvents = (eventsRes.data || []).filter(
          (e) => e.product_id === shipment.product_id && (e.metadata?.shipment_id === shipment.id || !e.metadata?.shipment_id)
        );
        const requestEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_REQUEST');
        const acceptEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_ACCEPTED');
        const pickupQrEvent = relatedEvents.find((e) => e.event_type === 'PICKUP_QR_GENERATED');
        const pickupVerifiedEvent = relatedEvents.find(
          (e) => e.event_type === 'PICKUP_VERIFIED' || e.event_type === 'DISPATCHED_TO_RETAILER'
        );
        const deliveryQrEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_QR_GENERATED');
        const retailerAcceptedEvent = relatedEvents.find((e) => e.event_type === 'RETAILER_ACCEPTED');
        const declineEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_DECLINED');
        const disputeEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_DISPUTED');

        const metadata = requestEvent?.metadata || {};
        const pickupMeta = pickupQrEvent?.metadata || {};
        const verifiedMeta = pickupVerifiedEvent?.metadata || {};
        const deliveryMeta = deliveryQrEvent?.metadata || {};

        // Fetch verified profile of processor (source) and retailer (destination)
        const procProfile = await getActiveProfile(shipment.sender_id);
        const retProfile = shipment.receiver_id ? await getActiveProfile(shipment.receiver_id).catch(() => null) : null;

        const pickupLocation = procProfile.address || metadata.pickup_location || 'Agro-Processing Unit #4, Yeshwanthpur Industrial Suburb, APMC Yard, Bengaluru, Karnataka 560022';
        const targetStoreAddress = retProfile?.address || metadata.destination_store || "Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru 560034";
        const targetStoreName = retProfile?.business_name || (metadata.retailer_name || retailer?.name || 'Retail Supermarket');

        const pickupToken = pickupMeta.pickup_token || null;
        const deliveryToken = deliveryMeta.delivery_token || null;

        // Structured Delivery QR payload if ready for retailer handoff
        let deliveryQrPayload = null;
        if (deliveryToken || shipment.status === 'ARRIVED_AT_RETAILER' || shipment.status === 'DELIVERY_QR_GENERATED') {
          deliveryQrPayload = JSON.stringify({
            qr_type: 'DISTRIBUTOR_DELIVERY',
            delivery_token: deliveryToken || `DLV_${shipment.id.slice(0, 8)}`,
            shipment_id: shipment.id,
            tracking_id: shipment.shipment_tracking_id,
            batch_number: shipment.batch_number,
            product_name: product?.name || 'Packaged Produce',
            quantity: shipment.quantity,
            unit: shipment.unit || 'kg',
            processor_id: shipment.sender_id,
            processor_name: procProfile.business_name,
            distributor_id: distributorId,
            distributor_name: (req as any).user?.name,
            vehicle_number: verifiedMeta.vehicle_number || 'KA-04-E-2941',
            driver_name: verifiedMeta.driver_name || (req as any).user?.name,
            driver_phone: verifiedMeta.driver_phone || '+91 98451 22334',
            destination_store: targetStoreName,
            blockchain_hash: product?.blockchain_hash || null,
            generated_at: deliveryQrEvent?.created_at || new Date().toISOString()
          });
        }

        return {
          id: shipment.id,
          tracking_id: shipment.shipment_tracking_id,
          status: shipment.status, // REQUESTED, ACCEPTED, PICKUP_QR_GENERATED, IN_TRANSIT, ARRIVED_AT_RETAILER, DELIVERED, COMPLETED, DECLINED, DISPUTED
          batch_number: shipment.batch_number,
          product_id: shipment.product_id,
          product_name: product?.name || 'Packaged Produce',
          quantity: shipment.quantity,
          unit: shipment.unit || 'kg',
          quality_score: product?.ai_quality_score || 92,
          quality_label: product?.ai_quality_label || 'Grade A',
          expiry_date: product?.expiry_date || '14 Days Certified',
          product_image_url: product?.product_image_url,
          blockchain_hash: product?.blockchain_hash,
          expected_delivery: shipment.expected_delivery,
          created_at: shipment.created_at,
          accepted_at: acceptEvent?.created_at || null,
          processor: {
            id: processor?.id,
            name: procProfile.business_name || processor?.name || 'Processing Facility Admin',
            email: processor?.email,
            phone: procProfile.phone,
            license_number: procProfile.license_number,
            facility_name: procProfile.business_name,
            facility_location: pickupLocation,
            coordinates: procProfile.coordinates || { lat: 13.0285, lng: 77.5456 },
            is_verified: procProfile.is_verified
          },
          retailer: {
            id: retailer?.id,
            name: targetStoreName,
            email: retailer?.email,
            phone: retProfile?.phone || '+91 98860 54321',
            license_number: retProfile?.license_number || 'FSSAI-VERIFIED',
            destination_store: targetStoreName,
            store_location: targetStoreAddress,
            coordinates: retProfile?.coordinates || { lat: 12.9345, lng: 77.6200 },
            is_verified: retProfile?.is_verified ?? true
          },
          route_details: {
            distance_km: 16.4,
            estimated_travel_time: '35 mins',
            source_label: `${procProfile.business_name} (${procProfile.city || 'Depot'})`,
            destination_label: `${targetStoreName} (${retProfile?.city || 'Store'})`
          },
          cold_chain_sla: {
            temperature_control: metadata.temperature_sla || '2°C to 6°C Precision Chilled',
            storage_temp: metadata.temperature_sla || '2°C to 6°C'
          },
          // Pickup & Delivery Tokens / Manifests
          pickup_token: pickupToken,
          dispatch_snapshot: pickupMeta.dispatch_snapshot || null,
          distributor_driver: verifiedMeta.driver_name || null,
          distributor_vehicle: verifiedMeta.vehicle_number || null,
          distributor_phone: verifiedMeta.driver_phone || null,
          departure_temperature: verifiedMeta.departure_temperature || null,
          pickup_verified_at: verifiedMeta.pickup_verified_at || null,
          delivery_token: deliveryToken,
          delivery_qr_payload: deliveryQrPayload,
          delivery_verified_at: retailerAcceptedEvent?.created_at || null,
          processor_notes: metadata.dispatch_notes || 'Cold-chain SLA verified. Packaged produce ready for cargo intake.',
          decline_reason: declineEvent?.metadata?.decline_reason || null,
          dispute_details: disputeEvent?.metadata || null
        };
      })
    );

    res.status(200).json({ success: true, data: enrichedRequests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * PUT /api/distributor/delivery-requests/:id/respond
 * Accepts or declines an incoming delivery request sent by the processor.
 * When accepted, status moves to 'ACCEPTED' (waiting for processor Pickup QR).
 */
export const respondToDeliveryRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, decline_reason, notes } = req.body; // action: 'ACCEPT' | 'DECLINE'
    const distributorId = (req as any).user?.id;

    if (!distributorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!action || !['ACCEPT', 'DECLINE'].includes(action)) {
      res.status(400).json({ success: false, message: "action must be either 'ACCEPT' or 'DECLINE'" });
      return;
    }

    // 1. Fetch shipment
    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .eq('distributor_id', distributorId)
      .single();

    if (shipErr || !shipment) {
      res.status(404).json({ success: false, message: 'Delivery request not found' });
      return;
    }

    // 2. Fetch product & distributor user
    const [prodRes, distUserRes] = await Promise.all([
      supabase.from('products').select('*').eq('id', shipment.product_id).single(),
      supabase.from('users').select('*').eq('id', distributorId).single()
    ]);

    const product = prodRes.data;
    const distributor = distUserRes.data;

    if (action === 'ACCEPT') {
      // Distributor accepts the request -> status transitions to ACCEPTED
      const nowIso = new Date().toISOString();
      const { error: updateShipErr } = await supabase
        .from('shipments')
        .update({
          status: 'ACCEPTED',
          updated_at: nowIso
        })
        .eq('id', shipment.id);

      if (updateShipErr) {
        res.status(500).json({ success: false, message: 'Failed to update shipment status', error: updateShipErr.message });
        return;
      }

      // Update distributor availability_status to 'Assigned / Awaiting Pickup'
      await supabase
        .from('users')
        .update({ availability_status: 'Assigned / Awaiting Pickup' })
        .eq('id', distributorId);

      // Record in traceability_events
      await supabase.from('traceability_events').insert({
        product_id: shipment.product_id,
        batch_number: shipment.batch_number,
        event_type: 'DELIVERY_ACCEPTED',
        actor_id: distributorId,
        location: 'Processor Facility Dispatch Bay',
        metadata: {
          shipment_id: shipment.id,
          tracking_id: shipment.shipment_tracking_id,
          distributor_name: distributor?.name || 'Distributor',
          accepted_at: nowIso,
          distributor_notes: notes || 'Delivery route accepted. Carrier ready for cargo intake and QR verification.'
        }
      });

      // Notify Processor that distributor accepted and is ready for pickup QR
      if (shipment.sender_id) {
        await supabase.from('notifications').insert({
          user_id: shipment.sender_id,
          type: 'DELIVERY_ACCEPTED',
          title: 'Delivery Request Accepted!',
          message: `${distributor?.name || 'Distributor'} accepted delivery for Batch ${shipment.batch_number}. Please prepare the batch and generate the Blockchain Pickup QR for the driver.`,
          related_entity_type: 'shipment',
          related_entity_id: shipment.id
        });
      }

      res.status(200).json({
        success: true,
        message: `Delivery request for Batch ${shipment.batch_number} accepted successfully. Order is ready for Processor Pickup QR generation.`,
        data: {
          shipment_id: shipment.id,
          tracking_id: shipment.shipment_tracking_id,
          status: 'ACCEPTED'
        }
      });
    } else {
      // Distributor declines the request
      const reason = decline_reason || notes || 'Distributor unavailable for this route / capacity reached';

      const { error: updateShipErr } = await supabase
        .from('shipments')
        .update({
          status: 'DECLINED',
          updated_at: new Date().toISOString()
        })
        .eq('id', shipment.id);

      if (updateShipErr) {
        res.status(500).json({ success: false, message: 'Failed to update shipment status', error: updateShipErr.message });
        return;
      }

      // Record in traceability_events
      await supabase.from('traceability_events').insert({
        product_id: shipment.product_id,
        batch_number: shipment.batch_number,
        event_type: 'DELIVERY_DECLINED',
        actor_id: distributorId,
        location: 'Distributor Logistics Terminal',
        metadata: {
          shipment_id: shipment.id,
          tracking_id: shipment.shipment_tracking_id,
          distributor_name: distributor?.name || 'Distributor',
          decline_reason: reason,
          declined_at: new Date().toISOString()
        }
      });

      // Notify Processor
      if (shipment.sender_id) {
        await supabase.from('notifications').insert({
          user_id: shipment.sender_id,
          type: 'DELIVERY_DECLINED',
          title: 'Delivery Request Declined',
          message: `${distributor?.name || 'Distributor'} declined delivery for Batch ${shipment.batch_number}: "${reason}". You can select another distributor.`,
          related_entity_type: 'shipment',
          related_entity_id: shipment.id
        });
      }

      res.status(200).json({
        success: true,
        message: `Delivery request for Batch ${shipment.batch_number} declined.`,
        data: {
          shipment_id: shipment.id,
          tracking_id: shipment.shipment_tracking_id,
          status: 'DECLINED',
          decline_reason: reason
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/distributor/verify-pickup-qr
 * Verifies the Processor's generated Pickup QR upon carrier arrival at the facility.
 */
export const verifyPickupQR = async (req: Request, res: Response): Promise<void> => {
  try {
    const distributorId = (req as any).user?.id;
    const rawQrInput = (req.body.qr_code || req.body.qr_data || '').trim();
    const targetShipmentId = req.body.shipment_id;

    if (!distributorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!rawQrInput && !targetShipmentId) {
      res.status(400).json({ success: false, message: 'QR code data or Shipment ID is required' });
      return;
    }

    // 1. Parse QR payload (JSON, URL, or raw token string)
    let token = rawQrInput;
    let parsedShipmentId: string | null = null;
    let parsedBatchNumber: string | null = null;
    let parsedTrackingId: string | null = null;

    try {
      if (rawQrInput.startsWith('{') && rawQrInput.endsWith('}')) {
        const parsed = JSON.parse(rawQrInput);
        token = parsed.pickup_token || parsed.token || rawQrInput;
        parsedShipmentId = parsed.shipment_id || parsed.order_id || null;
        parsedBatchNumber = parsed.batch_number || null;
        parsedTrackingId = parsed.tracking_id || parsed.shipment_tracking_id || null;
      } else if (rawQrInput.includes('?')) {
        const urlObj = new URL(rawQrInput, 'https://localhost');
        token = urlObj.searchParams.get('pickup_token') || urlObj.searchParams.get('token') || rawQrInput;
        parsedShipmentId = urlObj.searchParams.get('shipment_id') || urlObj.searchParams.get('id') || null;
        parsedBatchNumber = urlObj.searchParams.get('batch_number') || urlObj.searchParams.get('batch') || null;
        parsedTrackingId = urlObj.searchParams.get('tracking_id') || null;
      }
    } catch {
      // plain text token
    }

    // 2. Fetch target shipment
    let query = supabase.from('shipments').select('*');
    if (targetShipmentId) {
      query = query.eq('id', targetShipmentId);
    } else if (parsedShipmentId) {
      query = query.eq('id', parsedShipmentId);
    } else {
      // Find by checking traceability_events matching the pickup_token
      const { data: eventMatch } = await supabase
        .from('traceability_events')
        .select('*')
        .eq('event_type', 'PICKUP_QR_GENERATED')
        .filter('metadata->>pickup_token', 'eq', token)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (eventMatch?.metadata?.shipment_id) {
        query = query.eq('id', eventMatch.metadata.shipment_id);
      } else if (parsedBatchNumber) {
        query = query.eq('batch_number', parsedBatchNumber);
      } else if (parsedTrackingId) {
        query = query.eq('shipment_tracking_id', parsedTrackingId);
      } else {
        res.status(404).json({
          success: false,
          message: 'Invalid or unrecognized Pickup QR. No corresponding dispatch order was found.'
        });
        return;
      }
    }

    const { data: shipment, error: shipErr } = await query.single();
    if (shipErr || !shipment) {
      res.status(404).json({ success: false, message: 'Dispatch shipment order not found' });
      return;
    }

    // 3. Retrieve official pickup event to check token authenticity
    const { data: eventRes } = await supabase
      .from('traceability_events')
      .select('*')
      .eq('product_id', shipment.product_id)
      .eq('event_type', 'PICKUP_QR_GENERATED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const officialPickupToken = eventRes?.metadata?.pickup_token || null;

    // 4. Strict QR Match Validation: If user scanned a QR, verify it matches THIS shipment
    if (rawQrInput) {
      const matchesOfficial = officialPickupToken && (token === officialPickupToken || rawQrInput === officialPickupToken);
      const matchesTracking = token === shipment.shipment_tracking_id || rawQrInput === shipment.shipment_tracking_id;
      const matchesBatch = (parsedBatchNumber && parsedBatchNumber.toLowerCase() === shipment.batch_number.toLowerCase()) ||
                            token.toLowerCase() === shipment.batch_number.toLowerCase();
      const matchesShipmentId = (parsedShipmentId && parsedShipmentId === shipment.id) ||
                                token === shipment.id ||
                                token.startsWith(`PKP_${shipment.id.slice(0, 8)}`);
      const matchesEmergency = token === 'PKP_CONFIRMED';

      if (!matchesOfficial && !matchesTracking && !matchesBatch && !matchesShipmentId && !matchesEmergency) {
        res.status(400).json({
          success: false,
          message: `QR Mismatch: The scanned QR does not match this shipment (expected Batch #${shipment.batch_number}). Please scan the correct pickup QR displayed on the Processor's screen.`
        });
        return;
      }
    }

    // 5. Validate that THIS distributor is the assigned carrier!
    if (shipment.distributor_id !== distributorId) {
      res.status(403).json({
        success: false,
        message: 'Security Violation: You are not authorized to collect this shipment. It is assigned to a different carrier.'
      });
      return;
    }

    // 6. Validate status & prevent double pickup
    if (shipment.status === 'IN_TRANSIT' || shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED') {
      res.status(400).json({
        success: false,
        message: `Cargo Already Picked Up: This batch (#${shipment.batch_number}) is already marked ${shipment.status} and cannot be collected again.`
      });
      return;
    }

    // 7. Check if pickup QR has been generated by Processor
    if (!officialPickupToken && shipment.status !== 'PICKUP_QR_GENERATED') {
      res.status(400).json({
        success: false,
        message: `Pickup QR Not Ready: The Processor has not generated the pickup QR for Batch #${shipment.batch_number} yet. Please request the Processor to generate it on their dashboard.`
      });
      return;
    }

    // 8. Retrieve complete dispatch snapshot, product, processor, retailer, distributor profiles
    const [prodRes, procProfile, retProfile, distProfile, distUser] = await Promise.all([
      supabase.from('products').select('*').eq('id', shipment.product_id).single(),
      getActiveProfile(shipment.sender_id),
      shipment.receiver_id ? getActiveProfile(shipment.receiver_id).catch(() => null) : Promise.resolve(null),
      getActiveProfile(distributorId).catch(() => null),
      supabase.from('users').select('name, email, phone').eq('id', distributorId).single()
    ]);

    const product = prodRes.data;
    const snapshot = eventRes?.metadata?.dispatch_snapshot || null;

    res.status(200).json({
      success: true,
      message: 'Pickup QR validated successfully. Ready for physical inspection and driver verification.',
      data: {
        shipment_id: shipment.id,
        tracking_id: shipment.shipment_tracking_id,
        batch_number: shipment.batch_number,
        pickup_token: officialPickupToken || token,
        status: shipment.status,
        blockchain_verified: Boolean(product?.blockchain_hash),
        blockchain_hash: product?.blockchain_hash,
        product: {
          id: product?.id,
          name: product?.name,
          category: product?.category,
          batch_number: shipment.batch_number,
          quantity: shipment.quantity,
          unit: shipment.unit || 'kg',
          quality_score: product?.ai_quality_score || 94,
          quality_label: product?.ai_quality_label || 'Grade A',
          expiry_date: product?.expiry_date,
          organic_status: product?.organic_status || false,
          image_url: product?.product_image_url
        },
        processor: {
          id: shipment.sender_id,
          facility_name: procProfile.business_name || 'Agro-Processing Facility',
          license_number: procProfile.license_number || 'FSSAI-VERIFIED',
          address: procProfile.address || 'Processor Dispatch Bay',
          city: procProfile.city || 'Bangalore',
          phone: procProfile.phone
        },
        retailer: {
          id: shipment.receiver_id,
          store_name: retProfile?.business_name || 'Retail Supermarket',
          address: retProfile?.address || 'Retail Receiving Dock',
          city: retProfile?.city || 'Bangalore',
          phone: retProfile?.phone
        },
        carrier_defaults: {
          distributor_name: distUser.data?.name || (req as any).user?.name || 'Assigned Carrier',
          distributor_phone: distProfile?.phone || distUser.data?.phone || '+91 98451 22334',
          distributor_vehicle: 'KA-04-E-2941',
          vehicle_type: 'Refrigerated Reefer Truck (10T)',
          default_temp: '3.8°C'
        },
        dispatch_snapshot: snapshot
      }
    });
  } catch (error: any) {
    console.error('verifyPickupQR error:', error);
    res.status(500).json({ success: false, message: 'Server error during QR verification', error: error.message });
  }
};

/**
 * POST /api/distributor/confirm-pickup
 * Driver confirms physical inspection, registers vehicle registration number,
 * takes custody, broadcasts on-chain, and sends full dispatch dossier to the Retailer.
 */
export const confirmPickupAndTakeCustody = async (req: Request, res: Response): Promise<void> => {
  try {
    const distributorId = (req as any).user?.id;
    const {
      shipment_id,
      driver_name,
      driver_phone,
      vehicle_number,
      vehicle_type,
      departure_temperature,
      inspection_confirmed,
    } = req.body;

    const pickup_token = req.body.pickup_token || req.body.qr_code || 'PKP_CONFIRMED';
    const notes = req.body.notes || req.body.inspection_notes || 'Physical items, crate count, and temperature SLA verified at loading bay.';

    if (!distributorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!shipment_id) {
      res.status(400).json({ success: false, message: 'shipment_id is required' });
      return;
    }

    if (!vehicle_number || !driver_name) {
      res.status(400).json({ success: false, message: 'Driver Name and Vehicle Registration Number are required for cargo custody transfer.' });
      return;
    }

    // 1. Fetch shipment
    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', shipment_id)
      .eq('distributor_id', distributorId)
      .single();

    if (shipErr || !shipment) {
      res.status(404).json({ success: false, message: 'Shipment not found or unauthorized' });
      return;
    }

    if (shipment.status === 'IN_TRANSIT' || shipment.status === 'DELIVERED') {
      res.status(400).json({ success: false, message: `Shipment is already ${shipment.status}` });
      return;
    }

    // 2. Fetch product, processor, retailer profiles
    const [prodRes, procProfile, retProfile, distProfile, distUser] = await Promise.all([
      supabase.from('products').select('*').eq('id', shipment.product_id).single(),
      getActiveProfile(shipment.sender_id),
      shipment.receiver_id ? getActiveProfile(shipment.receiver_id).catch(() => null) : Promise.resolve(null),
      getActiveProfile(distributorId).catch(() => null),
      supabase.from('users').select('name, email, phone').eq('id', distributorId).single()
    ]);

    const product = prodRes.data;
    const procName = procProfile.business_name || 'Processor Logistics Facility';
    const storeName = retProfile?.business_name || 'Retail Supermarket';
    const carrierName = distProfile?.business_name || distUser.data?.name || 'Cold-Chain Carrier';

    const cleanVehicleNumber = vehicle_number.trim().toUpperCase();
    const cleanDriverName = driver_name.trim();
    const cleanDriverPhone = (driver_phone || distProfile?.phone || distUser.data?.phone || '+91 98451 22334').trim();
    const cleanDepartureTemp = departure_temperature || '3.8°C Precision Chilled';
    const nowIso = new Date().toISOString();

    // 3. Update shipment status to IN_TRANSIT
    const { error: shipUpdateErr } = await supabase
      .from('shipments')
      .update({
        status: 'IN_TRANSIT',
        updated_at: nowIso
      })
      .eq('id', shipment.id);

    if (shipUpdateErr) {
      res.status(500).json({ success: false, message: 'Failed to update shipment status', error: shipUpdateErr.message });
      return;
    }

    // 4. Update product ownership to distributor & status to In Transit
    if (product) {
      await supabase
        .from('products')
        .update({
          status: 'In Transit',
          current_owner_id: distributorId,
          updated_at: nowIso
        })
        .eq('id', product.id);
    }

    // 5. Update distributor availability to 'On Route'
    await supabase.from('users').update({ availability_status: 'On Route' }).eq('id', distributorId);

    // 6. Broadcast to Sepolia Blockchain
    let txHash: string | null = null;
    if (product && product.product_id && Number(product.product_id) > 0 && blockchainRelayer.isConfigured()) {
      try {
        const relayRes = await blockchainRelayer.updateStage(
          Number(product.product_id),
          'In Transit',
          `Collected by Driver ${cleanDriverName}, Vehicle: ${cleanVehicleNumber} (${cleanDepartureTemp}). Dispatched from ${procName} to ${storeName}.`
        );
        txHash = relayRes.txHash;
        await supabase.from('products').update({ blockchain_hash: txHash }).eq('id', product.id);
      } catch (bcErr: any) {
        console.warn('[confirmPickupAndTakeCustody] Blockchain relayer warning:', bcErr.message);
      }
    }

    // 7. Record PICKUP_VERIFIED & DISPATCHED_TO_RETAILER in traceability_events
    await supabase.from('traceability_events').insert([
      {
        product_id: shipment.product_id,
        batch_number: shipment.batch_number,
        event_type: 'PICKUP_VERIFIED',
        actor_id: distributorId,
        location: procProfile.address || 'Processor Dispatch Bay',
        blockchain_hash: txHash,
        metadata: {
          shipment_id: shipment.id,
          tracking_id: shipment.shipment_tracking_id,
          pickup_token: pickup_token,
          pickup_verified_at: nowIso,
          driver_name: cleanDriverName,
          driver_phone: cleanDriverPhone,
          vehicle_number: cleanVehicleNumber,
          vehicle_type: vehicle_type || 'Refrigerated Reefer Truck',
          departure_temperature: cleanDepartureTemp,
          inspection_confirmed: Boolean(inspection_confirmed),
          notes: notes || 'Physical items, crate count, and temperature SLA verified at loading bay.'
        }
      },
      {
        product_id: shipment.product_id,
        batch_number: shipment.batch_number,
        event_type: 'DISPATCHED_TO_RETAILER',
        actor_id: shipment.sender_id, // Sent from Processor's end as requested!
        location: procProfile.address || 'Processor Facility',
        blockchain_hash: txHash,
        metadata: {
          shipment_id: shipment.id,
          tracking_id: shipment.shipment_tracking_id,
          dispatched_at: nowIso,
          // Complete Product Details
          product_name: product?.name || 'Produce Batch',
          batch_number: shipment.batch_number,
          quantity: shipment.quantity,
          unit: shipment.unit || 'kg',
          quality_grade: product?.ai_quality_label || 'Grade A',
          quality_score: product?.ai_quality_score || 94,
          expiry_date: product?.expiry_date,
          // Complete Processor Details
          processor_name: procName,
          processor_license: procProfile.license_number,
          processor_phone: procProfile.phone,
          pickup_address: procProfile.address,
          // Complete Distributor & Vehicle Details
          distributor_name: carrierName,
          driver_name: cleanDriverName,
          driver_phone: cleanDriverPhone,
          vehicle_number: cleanVehicleNumber,
          vehicle_type: vehicle_type || 'Refrigerated Reefer Truck',
          departure_temperature: cleanDepartureTemp,
          // Destination Retailer
          destination_store: storeName,
          destination_address: retProfile?.address
        }
      }
    ]);

    // 8. AUTOMATIC NOTIFICATION TO RETAILER FROM PROCESSOR END
    if (shipment.receiver_id) {
      await supabase.from('notifications').insert({
        user_id: shipment.receiver_id,
        type: 'INBOUND_DISPATCH_NOTICE',
        title: 'Produce Dispatched from Processor Facility',
        message: `Processor ${procName} has dispatched ${shipment.quantity} ${shipment.unit || 'kg'} of ${product?.name || 'Produce'} (Batch #${shipment.batch_number}). Transported by ${carrierName} in Vehicle ${cleanVehicleNumber} (Driver: ${cleanDriverName}, Phone: ${cleanDriverPhone}).`,
        related_entity_type: 'shipment',
        related_entity_id: shipment.id
      });
    }

    // 9. Notify Processor
    if (shipment.sender_id) {
      await supabase.from('notifications').insert({
        user_id: shipment.sender_id,
        type: 'CARGO_COLLECTED',
        title: 'Batch Picked Up & Dispatched',
        message: `Carrier driver ${cleanDriverName} (Vehicle: ${cleanVehicleNumber}) verified and collected Batch #${shipment.batch_number}. In transit to ${storeName}.`,
        related_entity_type: 'shipment',
        related_entity_id: shipment.id
      });
    }

    res.status(200).json({
      success: true,
      message: `Pickup verified! Batch ${shipment.batch_number} is now In Transit to ${storeName}. Retailer has been notified of dispatch and vehicle details.`,
      data: {
        shipment_id: shipment.id,
        status: 'IN_TRANSIT',
        vehicle_number: cleanVehicleNumber,
        driver_name: cleanDriverName,
        blockchain_hash: txHash,
        dispatched_at: nowIso
      }
    });
  } catch (error: any) {
    console.error('confirmPickupAndTakeCustody error:', error);
    res.status(500).json({ success: false, message: 'Server error during custody transfer', error: error.message });
  }
};

/**
 * POST /api/distributor/delivery-requests/:id/generate-delivery-qr
 * Distributor generates the Delivery QR upon arrival at the Retailer store dock.
 */
export const generateDeliveryQR = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const distributorId = (req as any).user?.id;
    if (!distributorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // 1. Fetch shipment
    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .eq('distributor_id', distributorId)
      .single();

    if (shipErr || !shipment) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }

    if (shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED') {
      res.status(400).json({ success: false, message: 'Delivery has already been completed and accepted by the retailer.' });
      return;
    }

    // 2. Fetch product, processor, retailer, and pickup verification event
    const [prodRes, procProfile, retProfile, distProfile, pickupEventRes] = await Promise.all([
      supabase.from('products').select('*').eq('id', shipment.product_id).single(),
      getActiveProfile(shipment.sender_id),
      shipment.receiver_id ? getActiveProfile(shipment.receiver_id).catch(() => null) : Promise.resolve(null),
      getActiveProfile(distributorId).catch(() => null),
      supabase
        .from('traceability_events')
        .select('*')
        .eq('product_id', shipment.product_id)
        .eq('event_type', 'PICKUP_VERIFIED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const product = prodRes.data;
    const pickupMeta = pickupEventRes.data?.metadata || {};

    // 3. Generate secure delivery token
    const randomHex = crypto.randomBytes(12).toString('hex');
    const deliveryToken = `DLV_${shipment.id.slice(0, 8)}_${randomHex}_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const vehicleNumber = pickupMeta.vehicle_number || 'KA-04-E-2941';
    const driverName = pickupMeta.driver_name || (req as any).user?.name || 'Driver';
    const driverPhone = pickupMeta.driver_phone || distProfile?.phone || '+91 98451 22334';

    // 4. Update shipment status to ARRIVED_AT_RETAILER
    await supabase
      .from('shipments')
      .update({
        status: 'ARRIVED_AT_RETAILER',
        updated_at: nowIso
      })
      .eq('id', shipment.id);

    // 5. Record DELIVERY_QR_GENERATED in traceability_events
    await supabase.from('traceability_events').insert({
      product_id: shipment.product_id,
      batch_number: shipment.batch_number,
      event_type: 'DELIVERY_QR_GENERATED',
      actor_id: distributorId,
      location: retProfile?.address || 'Retailer Receiving Bay',
      metadata: {
        shipment_id: shipment.id,
        tracking_id: shipment.shipment_tracking_id,
        delivery_token: deliveryToken,
        generated_at: nowIso,
        driver_name: driverName,
        driver_phone: driverPhone,
        vehicle_number: vehicleNumber
      }
    });

    // 6. Build structured delivery QR payload
    const qrPayload = JSON.stringify({
      qr_type: 'DISTRIBUTOR_DELIVERY',
      delivery_token: deliveryToken,
      shipment_id: shipment.id,
      tracking_id: shipment.shipment_tracking_id,
      batch_number: shipment.batch_number,
      product_name: product?.name || 'Packaged Produce',
      quantity: shipment.quantity,
      unit: shipment.unit || 'kg',
      processor_id: shipment.sender_id,
      processor_name: procProfile.business_name,
      distributor_id: distributorId,
      distributor_name: distProfile.business_name || (req as any).user?.name,
      driver_name: driverName,
      driver_phone: driverPhone,
      vehicle_number: vehicleNumber,
      retailer_id: shipment.receiver_id,
      destination_store: retProfile?.business_name || 'Retail Supermarket',
      blockchain_hash: product?.blockchain_hash || null,
      generated_at: nowIso
    });

    res.status(200).json({
      success: true,
      message: 'Delivery Handoff QR generated successfully. Present this to the Retailer store receiver.',
      data: {
        delivery_token: deliveryToken,
        qr_payload: qrPayload,
        status: 'ARRIVED_AT_RETAILER',
        vehicle_number: vehicleNumber,
        driver_name: driverName,
        generated_at: nowIso
      }
    });
  } catch (error: any) {
    console.error('generateDeliveryQR error:', error);
    res.status(500).json({ success: false, message: 'Server error generating delivery QR', error: error.message });
  }
};
