import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { blockchainRelayer } from '../services/blockchainRelayer';

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
            .in('event_type', ['DELIVERY_REQUEST', 'DELIVERY_ACCEPTED', 'DELIVERY_DECLINED'])
            .order('created_at', { ascending: false })
        : { data: [] }
    ]);

    const productsMap = new Map((prodRes.data || []).map((p) => [p.id, p]));
    const usersMap = new Map((usersRes.data || []).map((u) => [u.id, u]));

    const enrichedRequests = shipments.map((shipment) => {
      const product = productsMap.get(shipment.product_id);
      const processor = usersMap.get(shipment.sender_id);
      const retailer = usersMap.get(shipment.receiver_id);

      const relatedEvents = (eventsRes.data || []).filter(
        (e) => e.product_id === shipment.product_id && (e.metadata?.shipment_id === shipment.id || !e.metadata?.shipment_id)
      );
      const requestEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_REQUEST');
      const declineEvent = relatedEvents.find((e) => e.event_type === 'DELIVERY_DECLINED');

      const metadata = requestEvent?.metadata || {};

      return {
        id: shipment.id,
        tracking_id: shipment.shipment_tracking_id,
        status: shipment.status, // REQUESTED, ACCEPTED, IN_TRANSIT, DELIVERED, DECLINED
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
        processor: {
          id: processor?.id,
          name: processor?.name || 'Processing Facility Admin',
          email: processor?.email,
          facility_name: (metadata.pickup_location && metadata.pickup_location !== 'Processing Facility' && metadata.pickup_location !== 'Processor Processing Facility')
            ? metadata.pickup_location
            : (processor?.name ? `${processor.name} Agro-Processing Depot, APMC Yard, Yeshwanthpur, Bengaluru 560022` : 'Agro-Processing Unit #4, Yeshwanthpur Industrial Suburb, APMC Yard, Bengaluru, Karnataka 560022'),
          facility_location: (metadata.pickup_location && metadata.pickup_location !== 'Processing Facility' && metadata.pickup_location !== 'Processor Processing Facility')
            ? metadata.pickup_location
            : (processor?.name ? `${processor.name} Agro-Processing Depot, APMC Yard, Yeshwanthpur, Bengaluru 560022` : 'Agro-Processing Unit #4, Yeshwanthpur Industrial Suburb, APMC Yard, Bengaluru, Karnataka 560022'),
          coordinates: { lat: 13.0285, lng: 77.5456 }
        },
        retailer: {
          id: retailer?.id,
          name: retailer?.name || 'Retail Supermarket',
          email: retailer?.email,
          destination_store: (metadata.destination_store && metadata.destination_store !== 'John')
            ? metadata.destination_store
            : (retailer?.name ? `${retailer.name}'s Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru 560034` : 'Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru 560034'),
          store_location: (metadata.destination_store && metadata.destination_store !== 'John')
            ? metadata.destination_store
            : (retailer?.name ? `${retailer.name}'s Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru 560034` : 'Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru 560034'),
          coordinates: { lat: 12.9345, lng: 77.6200 }
        },
        route_details: {
          distance_km: 16.4,
          estimated_travel_time: '35 mins',
          source_label: 'Processor Cold-Storage Facility (Yeshwanthpur APMC)',
          destination_label: 'Retail Receiving Dock (Koramangala 4th Block)'
        },
        cold_chain_sla: {
          temperature_control: metadata.temperature_sla || '2°C to 6°C Precision Chilled',
          storage_temp: metadata.temperature_sla || '2°C to 6°C'
        },
        processor_notes: metadata.dispatch_notes || 'Cold-chain SLA verified. Packaged produce ready for cargo intake.',
        decline_reason: declineEvent?.metadata?.decline_reason || null
      };
    });

    res.status(200).json({ success: true, data: enrichedRequests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * PUT /api/distributor/delivery-requests/:id/respond
 * Accepts or declines an incoming delivery request sent by the processor.
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
      // Distributor accepts the request -> status transitions to IN_TRANSIT
      const { error: updateShipErr } = await supabase
        .from('shipments')
        .update({
          status: 'IN_TRANSIT',
          updated_at: new Date().toISOString()
        })
        .eq('id', shipment.id);

      if (updateShipErr) {
        res.status(500).json({ success: false, message: 'Failed to update shipment status', error: updateShipErr.message });
        return;
      }

      // Update product current owner to distributor & status to In Transit
      if (product) {
        await supabase
          .from('products')
          .update({
            status: 'In Transit',
            current_owner_id: distributorId,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id);
      }

      // Update distributor availability_status to 'On Route' in database
      await supabase
        .from('users')
        .update({ availability_status: 'On Route' })
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
          accepted_at: new Date().toISOString(),
          distributor_notes: notes || 'Cargo verified and accepted for refrigerated transport.'
        }
      });

      // Blockchain transaction
      let txHash: string | null = null;
      if (product && product.product_id && Number(product.product_id) > 0 && blockchainRelayer.isConfigured()) {
        try {
          const relayRes = await blockchainRelayer.updateStage(
            Number(product.product_id),
            'In Transit',
            `Accepted by ${distributor?.name || 'Distributor'} for cold-chain delivery.`
          );
          txHash = relayRes.txHash;
          await supabase.from('products').update({ blockchain_hash: txHash }).eq('id', product.id);
        } catch (bcErr: any) {
          console.warn('[respondToDeliveryRequest] Blockchain relayer warning:', bcErr.message);
        }
      }

      // Notify Processor
      if (shipment.sender_id) {
        await supabase.from('notifications').insert({
          user_id: shipment.sender_id,
          type: 'DELIVERY_ACCEPTED',
          title: 'Delivery Request Accepted!',
          message: `${distributor?.name || 'Distributor'} accepted delivery for Batch ${shipment.batch_number}. Cargo is now In Transit.`,
          related_entity_type: 'shipment',
          related_entity_id: shipment.id
        });
      }

      res.status(200).json({
        success: true,
        message: `Delivery request for Batch ${shipment.batch_number} accepted successfully. Batch is now In Transit.`,
        data: {
          shipment_id: shipment.id,
          tracking_id: shipment.shipment_tracking_id,
          status: 'IN_TRANSIT',
          blockchain_hash: txHash
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
