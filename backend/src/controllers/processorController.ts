import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// GET /api/processor/requests
export const getProcessorRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const processor_id = (req as any).user?.id;

    if (!processor_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Return pending/open requests OR requests assigned to this processor
    const { data: requests, error } = await supabase
      .from('product_requests')
      .select('id, request_id, retailer_id, product_name, quantity, unit, required_date, priority, notes, status, processor_id, created_at, updated_at')
      .or(`processor_id.is.null,processor_id.eq.${processor_id}`)
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

// POST /api/processor/requests/:id/claim
export const claimProcessorRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const processor_id = (req as any).user?.id;
    const { id } = req.params;

    if (!processor_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!id) {
      res.status(400).json({ success: false, message: 'Request ID is required' });
      return;
    }

    // Verify request exists and is claimable
    const { data: request, error: fetchErr } = await supabase
      .from('product_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !request) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    if (request.processor_id) {
      if (request.processor_id === processor_id) {
        res.status(200).json({ success: true, message: 'Already claimed by you', data: request });
        return;
      }
      res.status(409).json({ success: false, message: 'Request already claimed by another processor' });
      return;
    }

    // Atomic update strategy: only update if processor_id is still null
    const { data: updatedRequest, error: updateErr } = await supabase
      .from('product_requests')
      .update({ processor_id, status: 'ACCEPTED' })
      .eq('id', id)
      .is('processor_id', null)
      .select()
      .single();

    if (updateErr || !updatedRequest) {
      res.status(409).json({ success: false, message: 'Failed to claim request. It may have been claimed concurrently.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Request claimed successfully', data: updatedRequest });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

// GET /api/processor/batches
export const getProcessorBatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const processor_id = (req as any).user?.id;

    if (!processor_id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Return batches actually owned by the processor
    const { data: batches, error } = await supabase
      .from('products')
      .select('id, product_id, batch_number, quantity, category, name, status, current_owner_id, expiry_date, created_at, ai_quality_score, ai_quality_label')
      .eq('current_owner_id', processor_id)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Database error', error });
      return;
    }

    res.status(200).json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};
