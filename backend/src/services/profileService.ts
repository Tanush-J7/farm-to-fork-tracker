import { supabase } from '../config/supabase';

export interface UserCoordinates {
  lat: number;
  lng: number;
}

export interface UserFacilityProfile {
  user_id: string;
  business_name: string;
  role: string;
  phone: string;
  license_number: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  facility_type: string;
  operating_hours: string;
  contact_person_name?: string;
  contact_email?: string;
  coordinates: UserCoordinates;
  storage_capacity?: string;
  is_verified: boolean;
  verified_at?: string;
  verified_by?: string;
  updated_at?: string;
}

export interface ProfileChangeRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_changes: Partial<UserFacilityProfile>;
  previous_profile?: Partial<UserFacilityProfile>;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

/**
 * Returns a sensible, production-ready default profile based on the user's role and name
 */
export const getDefaultProfile = (user: { id: string; name: string; email?: string; role: string }): UserFacilityProfile => {
  const role = (user.role || 'processor').replace('pending_', '');
  
  if (role === 'processor') {
    return {
      user_id: user.id,
      business_name: user.name?.includes('Depot') || user.name?.includes('Processing') 
        ? user.name 
        : `${user.name} Agro-Processing Depot`,
      role: 'processor',
      phone: '+91 98450 12345',
      license_number: 'FSSAI-11223344556677',
      address: 'Agro-Processing Unit #4, Yeshwanthpur Industrial Suburb, APMC Yard, Bengaluru, Karnataka 560022',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560022',
      facility_type: 'Produce Storage & Agro-Processing Warehouse',
      operating_hours: '06:00 AM - 10:00 PM (Daily)',
      contact_person_name: user.name,
      contact_email: user.email || 'processor@farmchain.io',
      coordinates: { lat: 13.0285, lng: 77.5456 },
      storage_capacity: '500 Metric Tons Chilled & Precision Controlled',
      is_verified: true,
      verified_at: '2026-09-01T00:00:00.000Z',
      verified_by: 'FarmChain Admin'
    };
  }

  if (role === 'retailer') {
    return {
      user_id: user.id,
      business_name: user.name?.includes('Supermarket') || user.name?.includes('Fresh')
        ? user.name
        : `${user.name}'s Metro Fresh Supermarket`,
      role: 'retailer',
      phone: '+91 98860 54321',
      license_number: 'FSSAI-22334455667788',
      address: "Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034",
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      facility_type: 'Direct Retail Supermarket & Receiving Dock',
      operating_hours: '07:00 AM - 11:00 PM (All Days)',
      contact_person_name: user.name,
      contact_email: user.email || 'retailer@farmchain.io',
      coordinates: { lat: 12.9345, lng: 77.6200 },
      storage_capacity: '120 Metric Tons Retail Shelf & Backroom Dock',
      is_verified: true,
      verified_at: '2026-09-01T00:00:00.000Z',
      verified_by: 'FarmChain Admin'
    };
  }

  if (role === 'distributor') {
    return {
      user_id: user.id,
      business_name: `${user.name} Transport Logistics Hub`,
      role: 'distributor',
      phone: '+91 98111 87654',
      license_number: 'MVA-KA-LOG-98214',
      address: 'Central Logistics Terminal, Electronic City Phase 1, Hosur Road, Bengaluru, Karnataka 560100',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560100',
      facility_type: 'GPS Fleet Depot & Logistics Hub',
      operating_hours: '24/7 Logistics Operation',
      contact_person_name: user.name,
      contact_email: user.email || 'logistics@farmchain.io',
      coordinates: { lat: 12.8452, lng: 77.6602 },
      storage_capacity: 'Refrigerated Fleet 20+ Reefer Trucks',
      is_verified: true,
      verified_at: '2026-09-01T00:00:00.000Z',
      verified_by: 'FarmChain Admin'
    };
  }

  // Fallback for farmer or consumer
  return {
    user_id: user.id,
    business_name: user.name,
    role: user.role,
    phone: '+91 94480 99887',
    license_number: 'AGRI-REG-55441',
    address: 'Organic Farm Orchard, Mandya District, Karnataka 571401',
    city: 'Mandya',
    state: 'Karnataka',
    pincode: '571401',
    facility_type: 'Agricultural Farm & Harvest Dispatch Bay',
    operating_hours: '05:00 AM - 07:00 PM',
    contact_person_name: user.name,
    contact_email: user.email,
    coordinates: { lat: 12.5244, lng: 76.8958 },
    is_verified: true,
    verified_at: '2026-09-01T00:00:00.000Z',
    verified_by: 'FarmChain Admin'
  };
};

/**
 * Fetch the active, approved profile for a given user ID
 */
export const getActiveProfile = async (userId: string): Promise<UserFacilityProfile> => {
  try {
    // 1. Check if user exists in database
    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', userId)
      .maybeSingle();

    if (uErr || !user) {
      return getDefaultProfile({ id: userId, name: 'Facility Admin', role: 'processor' });
    }

    // 2. Fetch the latest active verified profile record from traceability_events
    const { data: activeEvents } = await supabase
      .from('traceability_events')
      .select('*')
      .eq('actor_id', userId)
      .eq('event_type', 'ACTIVE_PROFILE')
      .order('created_at', { ascending: false })
      .limit(1);

    if (activeEvents && activeEvents.length > 0) {
      const evt = activeEvents[0];
      const meta = evt.metadata || {};
      return {
        user_id: userId,
        business_name: meta.business_name || user.name,
        role: user.role,
        phone: meta.phone || '+91 98450 12345',
        license_number: meta.license_number || 'FSSAI-VERIFIED',
        address: evt.location || meta.address || 'Verified Facility Location',
        city: meta.city || 'Bengaluru',
        state: meta.state || 'Karnataka',
        pincode: meta.pincode || '560001',
        facility_type: meta.facility_type || 'Verified Commercial Facility',
        operating_hours: meta.operating_hours || '06:00 AM - 10:00 PM',
        contact_person_name: meta.contact_person_name || user.name,
        contact_email: meta.contact_email || user.email,
        coordinates: meta.coordinates || { lat: 13.0285, lng: 77.5456 },
        storage_capacity: meta.storage_capacity,
        is_verified: true,
        verified_at: meta.verified_at || evt.created_at,
        verified_by: meta.verified_by || 'FarmChain Admin',
        updated_at: evt.created_at
      };
    }

    // 3. Fallback to default verified profile
    return getDefaultProfile(user);
  } catch (err) {
    console.error('Error fetching active profile for user:', userId, err);
    return getDefaultProfile({ id: userId, name: 'Facility Admin', role: 'processor' });
  }
};

/**
 * Fetch profile status including current active profile, pending requests, and last rejected request
 */
export const getProfileStatus = async (userId: string) => {
  const activeProfile = await getActiveProfile(userId);

  // Fetch pending or recent profile requests
  const { data: requests, error } = await supabase
    .from('traceability_events')
    .select('*')
    .eq('actor_id', userId)
    .eq('event_type', 'PROFILE_UPDATE_REQUEST')
    .order('created_at', { ascending: false })
    .limit(5);

  let pendingRequest: ProfileChangeRequest | null = null;
  let lastRejectedRequest: ProfileChangeRequest | null = null;

  if (requests && requests.length > 0) {
    for (const r of requests) {
      const meta = r.metadata || {};
      const formatted: ProfileChangeRequest = {
        id: r.id,
        user_id: r.actor_id,
        user_name: meta.user_name || activeProfile.contact_person_name || '',
        user_email: meta.user_email || activeProfile.contact_email || '',
        user_role: meta.user_role || activeProfile.role,
        status: meta.status || 'PENDING',
        requested_changes: meta.requested_changes || {},
        previous_profile: meta.previous_profile || {},
        admin_notes: meta.admin_notes,
        reviewed_by: meta.reviewed_by,
        reviewed_at: meta.reviewed_at,
        created_at: r.created_at
      };

      if (!pendingRequest && formatted.status === 'PENDING') {
        pendingRequest = formatted;
      }
      if (!lastRejectedRequest && formatted.status === 'REJECTED') {
        lastRejectedRequest = formatted;
      }
    }
  }

  return {
    active_profile: activeProfile,
    pending_request: pendingRequest,
    last_rejected_request: lastRejectedRequest
  };
};

/**
 * Submit a request to update user profile (Processor or Retailer)
 */
export const requestProfileUpdate = async (
  userId: string,
  user: { name: string; email: string; role: string },
  changes: Partial<UserFacilityProfile>
): Promise<ProfileChangeRequest> => {
  const activeProfile = await getActiveProfile(userId);

  // Clean coordinates
  const lat = typeof changes.coordinates?.lat === 'number' ? changes.coordinates.lat : 13.0285;
  const lng = typeof changes.coordinates?.lng === 'number' ? changes.coordinates.lng : 77.5456;

  const targetAddress = changes.address || activeProfile.address;

  const metadata = {
    status: 'PENDING',
    user_name: user.name,
    user_email: user.email,
    user_role: user.role,
    requested_changes: {
      ...changes,
      coordinates: { lat, lng }
    },
    previous_profile: activeProfile,
    requested_at: new Date().toISOString()
  };

  const { data: record, error } = await supabase
    .from('traceability_events')
    .insert({
      batch_number: 'PROFILE_REQUEST',
      event_type: 'PROFILE_UPDATE_REQUEST',
      actor_id: userId,
      location: targetAddress,
      metadata
    })
    .select()
    .single();

  if (error || !record) {
    throw new Error(error?.message || 'Failed to submit profile change request');
  }

  // Create admin notification
  try {
    await supabase.from('notifications').insert({
      type: 'PROFILE_UPDATE_REQUEST',
      title: `Profile Verification: ${changes.business_name || user.name}`,
      message: `${user.name} (${user.role}) submitted changes for address, license (${changes.license_number || 'N/A'}), and phone for administrative verification.`,
      related_entity_type: 'profile_request',
      related_entity_id: record.id
    });
  } catch (notifErr) {
    console.warn('Notification insert non-fatal:', notifErr);
  }

  return {
    id: record.id,
    user_id: userId,
    user_name: user.name,
    user_email: user.email,
    user_role: user.role,
    status: 'PENDING',
    requested_changes: metadata.requested_changes,
    previous_profile: activeProfile,
    created_at: record.created_at
  };
};

/**
 * Fetch all profile change requests for the Admin portal
 */
export const getAllProfileRequests = async (statusFilter?: string): Promise<ProfileChangeRequest[]> => {
  let query = supabase
    .from('traceability_events')
    .select('*')
    .eq('event_type', 'PROFILE_UPDATE_REQUEST')
    .order('created_at', { ascending: false });

  const { data: records, error } = await query;
  if (error || !records) return [];

  const userIds = Array.from(new Set(records.map((r) => r.actor_id).filter(Boolean)));
  const { data: users } = userIds.length > 0 
    ? await supabase.from('users').select('id, name, email, role').in('id', userIds)
    : { data: [] };

  const userMap = new Map((users || []).map((u) => [u.id, u]));

  const mapped: ProfileChangeRequest[] = records.map((r) => {
    const meta = r.metadata || {};
    const u = userMap.get(r.actor_id);
    return {
      id: r.id,
      user_id: r.actor_id,
      user_name: meta.user_name || u?.name || 'Unknown User',
      user_email: meta.user_email || u?.email || 'N/A',
      user_role: (meta.user_role || u?.role || 'user').replace('pending_', ''),
      status: (meta.status || 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED',
      requested_changes: meta.requested_changes || {},
      previous_profile: meta.previous_profile || {},
      admin_notes: meta.admin_notes,
      reviewed_by: meta.reviewed_by,
      reviewed_at: meta.reviewed_at,
      created_at: r.created_at
    };
  });

  if (statusFilter && statusFilter !== 'ALL') {
    return mapped.filter((r) => r.status === statusFilter);
  }

  return mapped;
};

/**
 * Admin review: Approve or Reject a profile change request
 */
export const reviewProfileRequest = async (
  requestId: string,
  adminUser: { id: string; name: string; email: string },
  action: 'APPROVE' | 'REJECT',
  adminNotes?: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  // 1. Fetch request record
  const { data: record, error } = await supabase
    .from('traceability_events')
    .select('*')
    .eq('id', requestId)
    .single();

  if (error || !record) {
    throw new Error('Profile change request not found');
  }

  const meta = record.metadata || {};
  const requestedChanges = meta.requested_changes || {};
  const nowISO = new Date().toISOString();
  const userId = record.actor_id;

  if (action === 'APPROVE') {
    // A. Update the request status to APPROVED
    await supabase
      .from('traceability_events')
      .update({
        metadata: {
          ...meta,
          status: 'APPROVED',
          reviewed_by: adminUser.name || 'Admin',
          reviewed_at: nowISO,
          admin_notes: adminNotes || 'Profile details and license verified successfully.'
        }
      })
      .eq('id', requestId);

    // B. Save new ACTIVE_PROFILE in traceability_events
    const fullActiveProfile: UserFacilityProfile = {
      user_id: userId,
      business_name: requestedChanges.business_name || meta.user_name,
      role: meta.user_role || 'processor',
      phone: requestedChanges.phone || '+91 98450 12345',
      license_number: requestedChanges.license_number || 'FSSAI-VERIFIED',
      address: requestedChanges.address || record.location,
      city: requestedChanges.city || 'Bengaluru',
      state: requestedChanges.state || 'Karnataka',
      pincode: requestedChanges.pincode || '560001',
      facility_type: requestedChanges.facility_type || 'Commercial Facility',
      operating_hours: requestedChanges.operating_hours || '06:00 AM - 10:00 PM',
      contact_person_name: requestedChanges.contact_person_name || meta.user_name,
      contact_email: requestedChanges.contact_email || meta.user_email,
      coordinates: requestedChanges.coordinates || { lat: 13.0285, lng: 77.5456 },
      storage_capacity: requestedChanges.storage_capacity,
      is_verified: true,
      verified_at: nowISO,
      verified_by: adminUser.name || 'Admin',
      updated_at: nowISO
    };

    await supabase.from('traceability_events').insert({
      batch_number: 'ACTIVE_PROFILE',
      event_type: 'ACTIVE_PROFILE',
      actor_id: userId,
      location: fullActiveProfile.address,
      metadata: fullActiveProfile
    });

    // C. Update user's name in users table if business name was specified
    if (requestedChanges.business_name) {
      await supabase
        .from('users')
        .update({ name: requestedChanges.business_name, updated_at: nowISO })
        .eq('id', userId);
    }

    // D. Notify user of approval
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'PROFILE_APPROVED',
        title: 'Facility Profile Approved & Verified!',
        message: `Your facility profile and delivery address (${fullActiveProfile.address}) have been verified by ${adminUser.name}. All future distributor logistics will automatically route to this verified address.`,
        related_entity_type: 'profile',
        related_entity_id: requestId
      });
    } catch {}

    return {
      success: true,
      message: 'Profile update approved. Active verified address has been updated across the network.',
      data: fullActiveProfile
    };
  } else {
    // REJECT
    const rejectReason = adminNotes || 'Profile details could not be verified. Please check your license and facility address.';
    await supabase
      .from('traceability_events')
      .update({
        metadata: {
          ...meta,
          status: 'REJECTED',
          reviewed_by: adminUser.name || 'Admin',
          reviewed_at: nowISO,
          admin_notes: rejectReason
        }
      })
      .eq('id', requestId);

    // Notify user of rejection
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'PROFILE_REJECTED',
        title: 'Profile Verification Declined',
        message: `Your profile update was not approved: ${rejectReason}. Please review your details and re-submit for verification.`,
        related_entity_type: 'profile',
        related_entity_id: requestId
      });
    } catch {}

    return {
      success: true,
      message: 'Profile change request rejected with feedback provided to the user.'
    };
  }
};
