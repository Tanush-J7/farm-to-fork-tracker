import { Request, Response } from 'express';
import axios from 'axios';
import { supabase } from '../config/supabase';
import { ethers } from 'ethers';
import { blockchainRelayer } from '../services/blockchainRelayer';
import { getActiveProfile } from '../services/profileService';

// Render Blueprints provide service host/port values separately from a full URL.
// Prefer an explicitly configured URL for local development and other hosts.
const AI_SERVICE_URL = process.env.AI_SERVICE_URL
    || (process.env.AI_SERVICE_HOSTPORT ? `http://${process.env.AI_SERVICE_HOSTPORT}` : 'http://localhost:8000');

export const registerProduct = async (req: Request, res: Response) => {
  try {
    const { name, category, batchNumber, quantity, organicStatus, expiryDate, imageData, product_id } = req.body;

    // Safely get farmer ID from auth token (set by protect middleware)
    const farmerId = (req as any).user?.id || 'anonymous';
    let productImageUrl: string | null = null;

    if (imageData) {
      const imageMatch = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(imageData);
      if (!imageMatch) {
        res.status(400).json({ success: false, message: 'Upload a JPEG, PNG, or WebP product photo.' });
        return;
      }

      const [, contentType, encodedImage] = imageMatch;
      const imageBuffer = Buffer.from(encodedImage, 'base64');
      if (imageBuffer.length > 5 * 1024 * 1024) {
        res.status(400).json({ success: false, message: 'Product photos must be 5 MB or smaller.' });
        return;
      }

      const extension = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1];
      const imagePath = `${farmerId}/${Date.now()}-${batchNumber}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(imagePath, imageBuffer, { contentType, upsert: false });

      if (uploadError) {
        res.status(500).json({ success: false, message: 'Could not upload product photo.', error: uploadError.message });
        return;
      }

      productImageUrl = supabase.storage.from('product-images').getPublicUrl(imagePath).data.publicUrl;
    }

    // Call AI Service for quality score
    let aiQualityScore = 0;
    let aiQualityLabel = 'Unknown';
    let aiShelfLife = null as any;

    try {
      const [qualRes, shelfRes] = await Promise.all([
        axios.post(`${AI_SERVICE_URL}/predict/quality`, { image_url: productImageUrl || 'dummy_url' }),
        axios.post(`${AI_SERVICE_URL}/predict/shelf-life`, {
          crop_type: name,
          temperature: 28,
          humidity: 65,
          quantity,
        }),
      ]);
      aiQualityScore = qualRes.data.score;
      aiQualityLabel = qualRes.data.quality;
      aiShelfLife = shelfRes.data;
    } catch (err) {
      console.error('AI Service unavailable, proceeding without AI score');
    }

    // Ensure product_id is a unique 6-digit number (100000 - 999999)
    let finalProductId = (product_id && Number(product_id) >= 100000 && Number(product_id) <= 999999)
      ? Number(product_id)
      : Math.floor(100000 + Math.random() * 900000);
      
    // Product needs admin approval before hitting the blockchain
    const initialStatus = 'Pending Approval';
    const finalBlockchainHash = null;

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        product_id: finalProductId,
        name,
        category,
        batch_number: batchNumber,
        quantity,
        organic_status: organicStatus,
        expiry_date: expiryDate || null,
        product_image_url: productImageUrl,
        farmer_id: farmerId,
        current_owner_id: farmerId,
        status: initialStatus,
        blockchain_hash: finalBlockchainHash,
        ai_quality_score: aiQualityScore,
        ai_quality_label: aiQualityLabel,
        ai_shelf_life: aiShelfLife,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ success: false, message: 'Server Error', error });
      return;
    }

    // Add BATCH_CREATED outbox event for Kafka (Phase 9)
    const { randomUUID } = require('crypto');
    await supabase.from('event_outbox').insert({
      event_id: randomUUID(),
      event_type: 'BATCH_CREATED',
      topic: 'traceability-events',
      payload: {
        batch_id: batchNumber,
        product_id: product.id,
        farmer_id: farmerId,
        quantity: quantity,
        status: initialStatus
      }
    });

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product registered successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*, farmer:farmer_id(id, name, email, role, availability_status, wallet_address)')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Server Error', error });
      return;
    }

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/products/my - products belonging to the logged-in farmer
export const getMyProducts = async (req: Request, res: Response) => {
  try {
    const farmerId = (req as any).user?.id;

    const { data: products, error } = await supabase
      .from('products')
      .select('id, product_id, blockchain_hash, name, category, batch_number, quantity, status, organic_status, ai_quality_score, ai_quality_label, ai_shelf_life, expiry_date, product_image_url, created_at, updated_at, farmer_id, current_owner_id')
      .or(`farmer_id.eq.${farmerId},current_owner_id.eq.${farmerId}`)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Server Error', error });
      return;
    }

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/products/blockchain/:id - public route for verification page
export const getProductByBlockchainId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const numId = Number(id);

    // 1. Try matching product_id exact
    let { data: products } = await supabase
      .from('products')
      .select('id, product_id, name, category, batch_number, quantity, status, organic_status, ai_quality_score, ai_quality_label, ai_shelf_life, product_image_url, expiry_date, blockchain_hash, created_at, farmer_id')
      .eq('product_id', id);

    let product = products && products.length > 0 ? products[0] : null;

    // 2. If not found and numeric ID >= 100000, try matching small integer id (e.g. 100008 -> 8)
    if (!product && !isNaN(numId) && numId >= 100000) {
      const originalSmallId = numId - 100000;
      const { data: offsetProds } = await supabase
        .from('products')
        .select('id, product_id, name, category, batch_number, quantity, status, organic_status, ai_quality_score, ai_quality_label, ai_shelf_life, product_image_url, expiry_date, blockchain_hash, created_at, farmer_id')
        .eq('product_id', originalSmallId);
      if (offsetProds && offsetProds.length > 0) {
        product = offsetProds[0];
      }
    }

    // 3. If still not found, try matching by batch_number or UUID primary key
    if (!product) {
      const { data: batchProds } = await supabase
        .from('products')
        .select('id, product_id, name, category, batch_number, quantity, status, organic_status, ai_quality_score, ai_quality_label, ai_shelf_life, product_image_url, expiry_date, blockchain_hash, created_at, farmer_id')
        .or(`batch_number.eq.${id},id.eq.${id}`);
      if (batchProds && batchProds.length > 0) {
        product = batchProds[0];
      }
    }

    // 4. Fallback: query all products and match mapped 6-digit ID helper
    if (!product) {
      const { data: allProds } = await supabase
        .from('products')
        .select('id, product_id, name, category, batch_number, quantity, status, organic_status, ai_quality_score, ai_quality_label, ai_shelf_life, product_image_url, expiry_date, blockchain_hash, created_at, farmer_id');
      if (allProds) {
        const found = allProds.find(p => {
          const pId = p.product_id;
          const mapped = (!pId || Number(pId) <= 0)
            ? "100000"
            : (Number(pId) >= 100000 && Number(pId) <= 999999)
            ? String(pId)
            : String(100000 + (Math.abs(Number(pId)) % 899999));
          return mapped === String(id) || String(pId) === String(id);
        });
        if (found) {
          product = found;
        }
      }
    }

    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    let onchainHistory: any[] = [];
    if (product.product_id && Number(product.product_id) > 0 && blockchainRelayer.isConfigured()) {
      try {
        onchainHistory = await blockchainRelayer.getProductHistory(Number(product.product_id));
      } catch (histErr) {
        console.warn(`[getProductByBlockchainId] On-chain history fetch skipped for Product #${product.product_id}:`, histErr);
      }
    }

    // Fetch all traceability events for this product from cloud database
    const { data: events } = await supabase
      .from('traceability_events')
      .select('*, actor:users!actor_id(id, name, role)')
      .or(`product_id.eq.${product.id},batch_number.eq.${product.batch_number}`)
      .order('created_at', { ascending: true });

    // Fetch verified farmer profile if farmer_id is present
    let farmerProfile = null;
    if (product.farmer_id) {
      try {
        farmerProfile = await getActiveProfile(product.farmer_id);
      } catch {}
    }

    res.status(200).json({
      success: true,
      data: {
        ...product,
        events: events || [],
        farmer_profile: farmerProfile,
        onchain_history: onchainHistory
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const updateProductStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, current_owner_id, blockchain_hash, extraInfo, quantity } = req.body;

    // 1. Fetch current product record
    const { data: existingProduct, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .or(`id.eq.${id},product_id.eq.${Number(id) || -1},batch_number.eq.${id}`)
      .limit(1)
      .maybeSingle();

    if (fetchErr || !existingProduct) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    let finalBlockchainHash = blockchain_hash || existingProduct.blockchain_hash;
    const onChainId = Number(existingProduct.product_id);

    // 2. If status is updated and relayer is configured, submit on-chain stage update
    if (status && status !== existingProduct.status && onChainId > 0 && blockchainRelayer.isConfigured()) {
      try {
        const infoText = extraInfo || `Stage updated to ${status}`;
        const relayRes = await blockchainRelayer.updateStage(onChainId, status, infoText);
        if (relayRes?.txHash) {
          finalBlockchainHash = relayRes.txHash;
        }
      } catch (bcErr) {
        console.error(`[updateProductStatus] Relayer updateStage failed for Product #${onChainId}:`, bcErr);
      }
    }

    // 3. Update Supabase record
    const { data: updatedProduct, error } = await supabase
      .from('products')
      .update({
        status: status || existingProduct.status,
        current_owner_id: current_owner_id || existingProduct.current_owner_id,
        blockchain_hash: finalBlockchainHash || undefined,
        ...(quantity !== undefined && !isNaN(Number(quantity)) ? { quantity: Math.max(0, Number(quantity)) } : {}),
      })
      .eq('id', existingProduct.id)
      .select('*, farmer:farmer_id(id, name, email, role, availability_status, wallet_address)')
      .single();

    if (error) {
      res.status(500).json({ success: false, message: 'Server Error', error });
      return;
    }

    // 4. Synchronize corresponding shipments table for Distributor <-> Retailer intake
    try {
      if (status === 'At Retailer' || status === 'Delivered') {
        const { data: existingShipment } = await supabase
          .from('shipments')
          .select('id')
          .or(`product_id.eq.${existingProduct.id},batch_number.eq.${existingProduct.batch_number}`)
          .limit(1)
          .maybeSingle();

        if (existingShipment) {
          await supabase
            .from('shipments')
            .update({ status: 'DELIVERED', updated_at: new Date().toISOString() })
            .eq('id', existingShipment.id);
        } else {
          // Auto-create delivered shipment so retailer can directly receive it in store
          const { data: retailerUser } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'retailer')
            .limit(1)
            .maybeSingle();

          if (retailerUser) {
            await supabase.from('shipments').insert({
              shipment_tracking_id: `TRK-${Date.now()}`,
              batch_number: existingProduct.batch_number,
              product_id: existingProduct.id,
              quantity: existingProduct.quantity,
              unit: 'kg',
              status: 'DELIVERED',
              sender_id: current_owner_id || existingProduct.current_owner_id,
              receiver_id: retailerUser.id
            });
          }
        }
      } else if (status === 'In Transit') {
        await supabase
          .from('shipments')
          .update({ status: 'IN_TRANSIT', updated_at: new Date().toISOString() })
          .or(`product_id.eq.${existingProduct.id},batch_number.eq.${existingProduct.batch_number}`);
      }
    } catch (shipmentSyncErr) {
      console.warn('[updateProductStatus] Non-fatal shipment sync warning:', shipmentSyncErr);
    }

    res.status(200).json({ success: true, data: updatedProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    // 1. Try deleting directly by primary key 'id'
    const { data: d1 } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select();

    if (d1 && d1.length > 0) {
      res.status(200).json({ success: true, message: 'Product deleted permanently from database' });
      return;
    }

    // 2. If id is numeric, try deleting by product_id or integer id
    const numId = Number(id);
    if (!isNaN(numId) && numId > 0) {
      const { data: d2 } = await supabase
        .from('products')
        .delete()
        .or(`product_id.eq.${numId},id.eq.${numId}`)
        .select();

      if (d2 && d2.length > 0) {
        res.status(200).json({ success: true, message: 'Product deleted permanently from database' });
        return;
      }
    }

    // 3. Fallback: try by batch_number
    await supabase.from('products').delete().eq('batch_number', id);

    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

/**
 * GET /api/products/farmer-state
 * Cloud sync: fetch farmer deals, notifications, deleted products, and locations across devices
 */
export const getFarmerState = async (req: Request, res: Response): Promise<void> => {
  try {
    const farmerId = (req as any).user?.id;
    if (!farmerId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { data: record, error } = await supabase
      .from('traceability_events')
      .select('*')
      .eq('actor_id', farmerId)
      .eq('event_type', 'FARMER_STATE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch farmer state', error: error.message });
      return;
    }

    const state = record?.metadata || {};
    res.status(200).json({ success: true, data: state });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * PUT /api/products/farmer-state
 * Cloud sync: persist farmer deals, notifications, deleted products, and locations across devices
 */
export const saveFarmerState = async (req: Request, res: Response): Promise<void> => {
  try {
    const farmerId = (req as any).user?.id;
    if (!farmerId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const incomingState = req.body || {};

    const { data: existing } = await supabase
      .from('traceability_events')
      .select('id, metadata')
      .eq('actor_id', farmerId)
      .eq('event_type', 'FARMER_STATE')
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
          batch_number: 'FARMER_SYNC',
          event_type: 'FARMER_STATE',
          actor_id: farmerId,
          location: 'Cloud Sync State',
          metadata: {
            ...incomingState,
            synced_at: new Date().toISOString()
          }
        });
    }

    res.status(200).json({ success: true, message: 'Farmer state synchronized' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
