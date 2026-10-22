import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import * as profileService from '../services/profileService';

/**
 * GET /api/profile/my
 * Fetches the logged-in user's active profile and pending/rejected change requests
 */
export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = await profileService.getProfileStatus(userId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('getMyProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/profile/request-update
 * Submits facility/store profile changes for administrative verification & approval
 */
export const requestProfileUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      business_name,
      phone,
      license_number,
      address,
      city,
      state,
      pincode,
      facility_type,
      operating_hours,
      contact_person_name,
      contact_email,
      coordinates,
      storage_capacity
    } = req.body;

    if (!business_name || !address || !license_number || !phone) {
      res.status(400).json({
        success: false,
        message: 'Business name, physical address, license number, and phone number are required for verification.'
      });
      return;
    }

    let userName = user.name || contact_person_name;
    let userEmail = user.email || contact_email;
    let userRole = user.role;

    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('name, email, role')
        .eq('id', user.id)
        .maybeSingle();
      if (dbUser) {
        userName = userName || dbUser.name;
        userEmail = userEmail || dbUser.email;
        userRole = dbUser.role || userRole;
      }
    } catch (dbErr) {
      console.warn('Could not fetch user details for profile update:', dbErr);
    }

    const effectiveUser = {
      id: user.id,
      name: userName || contact_person_name || 'Commercial Facility Admin',
      email: userEmail || contact_email || '',
      role: userRole || user.role || 'distributor'
    };

    const request = await profileService.requestProfileUpdate(user.id, effectiveUser, {
      business_name,
      phone,
      license_number,
      address,
      city: city || 'Bengaluru',
      state: state || 'Karnataka',
      pincode: pincode || '560001',
      facility_type: facility_type || (effectiveUser.role === 'retailer' ? 'Retail Supermarket' : effectiveUser.role === 'distributor' ? 'GPS Fleet Depot & Logistics Hub' : 'Agro-Processing Facility'),
      operating_hours: operating_hours || '06:00 AM - 10:00 PM',
      contact_person_name: contact_person_name || effectiveUser.name,
      contact_email: contact_email || effectiveUser.email,
      coordinates: coordinates || { lat: 13.0285, lng: 77.5456 },
      storage_capacity
    });

    res.status(201).json({
      success: true,
      message: 'Profile update request submitted successfully. Awaiting administrator verification and approval.',
      data: request
    });
  } catch (error: any) {
    console.error('requestProfileUpdate error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/profile/user/:id
 * Fetches the active verified profile of any user (e.g. processor looking up retailer, distributor looking up processor/retailer)
 */
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, message: 'User ID is required' });
      return;
    }

    const profile = await profileService.getActiveProfile(id as string);
    res.status(200).json({ success: true, data: profile });
  } catch (error: any) {
    console.error('getUserProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/admin/profile-requests
 * Admin endpoint: Fetch all profile update requests
 */
export const getAdminProfileRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const requests = await profileService.getAllProfileRequests(status);
    res.status(200).json({ success: true, data: requests });
  } catch (error: any) {
    console.error('getAdminProfileRequests error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * PUT /api/admin/profile-requests/:id/review
 * Admin endpoint: Approve or reject profile change request
 */
export const reviewProfileRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, admin_notes } = req.body;
    const adminUser = (req as any).user;

    if (!id) {
      res.status(400).json({ success: false, message: 'Request ID is required' });
      return;
    }

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      res.status(400).json({ success: false, message: "action must be either 'APPROVE' or 'REJECT'" });
      return;
    }

    const result = await profileService.reviewProfileRequest(id as string, adminUser, action, admin_notes);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('reviewProfileRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/profile/geocode/search?q=...
 * Search places, cities, and landmarks with high reliability
 */
export const searchGeocode = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    if (!query || !query.trim()) {
      res.status(400).json({ success: false, message: 'Search query q is required' });
      return;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=8&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FarmChainTracker/1.0 (contact@farmchain.io)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('searchGeocode error:', error);
    res.status(500).json({ success: false, message: 'Geocoding service error', error: error.message });
  }
};

/**
 * GET /api/profile/geocode/reverse?lat=...&lng=...
 * Reverse geocode coordinates to structured address
 */
export const reverseGeocode = async (req: Request, res: Response): Promise<void> => {
  try {
    const lat = req.query.lat as string;
    const lng = req.query.lng as string;
    if (!lat || !lng) {
      res.status(400).json({ success: false, message: 'lat and lng parameters are required' });
      return;
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FarmChainTracker/1.0 (contact@farmchain.io)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      res.status(200).json({ success: false, message: 'Unable to reverse geocode' });
      return;
    }

    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('reverseGeocode error:', error);
    res.status(500).json({ success: false, message: 'Reverse geocoding error', error: error.message });
  }
};
