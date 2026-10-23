import { supabase } from '../config/supabase';

export const DEAL_PRIORITY: Record<string, number> = {
  requested: 1,
  accepted: 2,
  dispatched: 3,
  declined: 4,
};

export const mergeDealObjects = (
  baseDeals: Record<string, string> = {},
  incomingDeals: Record<string, string> = {}
): Record<string, string> => {
  const merged: Record<string, string> = { ...baseDeals };
  for (const [key, val] of Object.entries(incomingDeals)) {
    if (!val) continue;
    const currentPriority = DEAL_PRIORITY[merged[key]] || 0;
    const incomingPriority = DEAL_PRIORITY[val] || 0;
    if (incomingPriority >= currentPriority) {
      merged[key] = val;
    }
  }
  return merged;
};

/**
 * Fetch authoritative global deal statuses across all farmers and processors
 */
export const getGlobalDeals = async (): Promise<Record<string, string>> => {
  try {
    const { data: record, error } = await supabase
      .from('traceability_events')
      .select('id, metadata')
      .eq('event_type', 'GLOBAL_DEAL_STATE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && record?.metadata?.deals && Object.keys(record.metadata.deals).length > 0) {
      return record.metadata.deals;
    }

    // Fallback: Bootstrap from all existing FARMER_STATE and PROCESSOR_STATE events
    const { data: events } = await supabase
      .from('traceability_events')
      .select('event_type, metadata, created_at')
      .in('event_type', ['FARMER_STATE', 'PROCESSOR_STATE'])
      .order('created_at', { ascending: true });

    let bootstrapDeals: Record<string, string> = {};
    (events || []).forEach(e => {
      const deals = e.metadata?.deals || {};
      bootstrapDeals = mergeDealObjects(bootstrapDeals, deals);
    });

    if (Object.keys(bootstrapDeals).length > 0) {
      await supabase.from('traceability_events').insert({
        batch_number: 'GLOBAL_DEALS',
        event_type: 'GLOBAL_DEAL_STATE',
        actor_id: 'SYSTEM_DEALS',
        location: 'Cloud Shared Deal State',
        metadata: {
          deals: bootstrapDeals,
          synced_at: new Date().toISOString()
        }
      });
    }

    return bootstrapDeals;
  } catch (err) {
    console.warn('[getGlobalDeals] Warning:', err);
    return {};
  }
};

/**
 * Update global deal status and synchronize product database records
 */
export const updateGlobalDeals = async (
  dealsPatch: Record<string, string>,
  actorId?: string
): Promise<Record<string, string>> => {
  try {
    if (!dealsPatch || Object.keys(dealsPatch).length === 0) {
      return await getGlobalDeals();
    }

    const currentGlobal = await getGlobalDeals();
    const merged = mergeDealObjects(currentGlobal, dealsPatch);

    const { data: existing } = await supabase
      .from('traceability_events')
      .select('id, metadata')
      .eq('event_type', 'GLOBAL_DEAL_STATE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('traceability_events')
        .update({
          metadata: {
            deals: merged,
            synced_at: new Date().toISOString(),
            last_actor_id: actorId || existing.metadata?.last_actor_id
          },
          created_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('traceability_events').insert({
        batch_number: 'GLOBAL_DEALS',
        event_type: 'GLOBAL_DEAL_STATE',
        actor_id: actorId || 'SYSTEM_DEALS',
        location: 'Cloud Shared Deal State',
        metadata: {
          deals: merged,
          synced_at: new Date().toISOString()
        }
      });
    }

    // Update corresponding products status in Supabase based on the deal state
    for (const [key, dealState] of Object.entries(dealsPatch)) {
      if (!key) continue;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);

      let targetProductStatus: string | null = null;
      if (dealState === 'dispatched') {
        targetProductStatus = 'In Transit';
      } else if (dealState === 'accepted') {
        targetProductStatus = 'Accepted';
      } else if (dealState === 'declined') {
        targetProductStatus = 'Harvested';
      } else if (dealState === 'requested') {
        targetProductStatus = 'Interested';
      }

      if (targetProductStatus) {
        let updateQuery = supabase.from('products').update({
          status: targetProductStatus,
          updated_at: new Date().toISOString()
        });

        if (isUUID) {
          await updateQuery.or(`id.eq.${key},batch_number.eq.${key}`);
        } else {
          await updateQuery.eq('batch_number', key);
        }
      }
    }

    return merged;
  } catch (err) {
    console.error('[updateGlobalDeals] Error:', err);
    return dealsPatch;
  }
};
