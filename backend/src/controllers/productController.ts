import { Request, Response } from 'express';
import axios from 'axios';
import { supabase } from '../config/supabase';

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
    const finalProductId = (product_id && Number(product_id) >= 100000 && Number(product_id) <= 999999)
      ? Number(product_id)
      : Math.floor(100000 + Math.random() * 900000);

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
        status: 'Harvested',
        blockchain_hash: req.body.blockchainHash || null,
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
      .select('*, farmer:farmer_id(name, email)')
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
      .select('id, product_id, blockchain_hash, name, category, batch_number, quantity, status, organic_status, ai_quality_score, ai_quality_label, ai_shelf_life, expiry_date, product_image_url, created_at, updated_at')
      .eq('farmer_id', farmerId)
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

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const updateProductStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, current_owner_id, blockchain_hash } = req.body;

    const { data: product, error } = await supabase
      .from('products')
      .update({
        status,
        current_owner_id: current_owner_id || undefined,
        blockchain_hash: blockchain_hash || undefined,
      })
      .eq('id', id)
      .select('*, farmer:farmer_id(name, email)')
      .single();

    if (error) {
      res.status(500).json({ success: false, message: 'Server Error', error });
      return;
    }

    res.status(200).json({ success: true, data: product });
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
