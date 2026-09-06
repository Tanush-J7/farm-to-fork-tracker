import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const getAvailableBatches = async (req: Request, res: Response) => {
  try {
    const { data: batches, error } = await supabase
      .from('products')
      .select('id, product_id, name, category, batch_number, quantity, status, ai_quality_score, expiry_date, current_owner_id, farmer:farmer_id(name)')
      .in('status', ['Processed', 'Ready for Logistics', 'Harvested']) // Including Harvested for testing if processor isn't used
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Server Error', error });
      return;
    }

    res.status(200).json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const createShipment = async (req: Request, res: Response) => {
  try {
    const { 
      product_id, 
      shipment_id,
      processor_name, 
      retailer_name, 
      vehicle_no, 
      vehicle_type, 
      driver_name, 
      driver_phone, 
      driver_license, 
      expected_delivery,
      temp_safe_min,
      temp_safe_max,
      notes
    } = req.body;

    const distributorId = (req as any).user?.id;

    if (!product_id) {
       res.status(400).json({ success: false, message: 'product_id is required' });
       return;
    }

    const { data: shipment, error } = await supabase
      .from('shipments')
      .insert({
        shipment_id,
        product_id,
        distributor_id: distributorId,
        processor_name,
        retailer_name,
        vehicle_no,
        vehicle_type,
        driver_name,
        driver_phone,
        driver_license,
        expected_delivery: expected_delivery || null,
        temp_safe_min,
        temp_safe_max,
        notes,
        status: 'Packed',
        location: processor_name || 'Origin Facility'
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ success: false, message: 'Server Error', error });
      return;
    }

    // Automatically update the product's status and owner
    await supabase
      .from('products')
      .update({ status: 'In Logistics', current_owner_id: distributorId })
      .eq('id', product_id);

    res.status(201).json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getShipments = async (req: Request, res: Response) => {
  try {
    const distributorId = (req as any).user?.id;

    const { data: shipments, error } = await supabase
      .from('shipments')
      .select('*, product:product_id(*), telemetry_logs(*)')
      .eq('distributor_id', distributorId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Server Error', error });
      return;
    }

    res.status(200).json({ success: true, data: shipments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const updateShipmentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, location, notes } = req.body;

    const updates: any = { status, location };
    if (notes) updates.notes = notes;
    if (status === 'Delivered') {
      updates.delivery_date = new Date().toISOString();
    }

    const { data: shipment, error } = await supabase
      .from('shipments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ success: false, message: 'Server Error', error });
      return;
    }

    // Also update product status
    if (status === 'In Transit' || status === 'Delivered') {
       await supabase.from('products').update({ status }).eq('id', shipment.product_id);
    }

    res.status(200).json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const logTelemetry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // shipment ID
    const { log_id, temperature, humidity, location, logged_by } = req.body;

    // Get shipment to check safe temp bounds
    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('temp_safe_min, temp_safe_max, cold_chain_violation')
      .eq('id', id)
      .single();

    if (fetchError || !shipment) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }

    const temp = parseFloat(temperature);
    const isViolation = temp < shipment.temp_safe_min || temp > shipment.temp_safe_max;
    const logStatus = isViolation ? 'Critical Violation' : 'Normal';

    const { data: log, error: logError } = await supabase
      .from('telemetry_logs')
      .insert({
        log_id,
        shipment_id: id,
        temperature: temp,
        humidity,
        location,
        status: logStatus,
        logged_by
      })
      .select()
      .single();

    if (logError) {
      res.status(500).json({ success: false, message: 'Server Error', error: logError });
      return;
    }

    // Update shipment if violation occurred
    if (isViolation) {
      const violation_message = `Temperature ${temp}°C out of safe range (${shipment.temp_safe_min}°C - ${shipment.temp_safe_max}°C)`;
      await supabase
        .from('shipments')
        .update({
          cold_chain_violation: true,
          violation_message,
          location
        })
        .eq('id', id);
    } else {
       await supabase.from('shipments').update({ location }).eq('id', id);
    }

    res.status(201).json({ success: true, data: log, isViolation });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};
