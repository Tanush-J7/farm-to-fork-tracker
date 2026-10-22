import { supabase } from '../config/supabase';
import * as profileService from '../services/profileService';

async function runTest() {
  console.log('--- 1. Fetching sample processor & retailer users ---');
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name, email, role')
    .in('role', ['processor', 'retailer'])
    .limit(4);

  if (uErr || !users || users.length === 0) {
    console.error('Could not find processor or retailer in DB', uErr);
    process.exit(1);
  }

  const processor = users.find((u) => u.role === 'processor') || users[0];
  const retailer = users.find((u) => u.role === 'retailer') || users[1] || users[0];
  console.log(`Testing with Processor: ${processor.name} (${processor.id})`);
  console.log(`Testing with Retailer: ${retailer.name} (${retailer.id})`);

  console.log('\n--- 2. Fetching active profiles ---');
  const procProfile = await profileService.getActiveProfile(processor.id);
  console.log('Processor Active Profile:', {
    business_name: procProfile.business_name,
    license_number: procProfile.license_number,
    address: procProfile.address,
    is_verified: procProfile.is_verified
  });

  const retProfile = await profileService.getActiveProfile(retailer.id);
  console.log('Retailer Active Profile:', {
    business_name: retProfile.business_name,
    license_number: retProfile.license_number,
    address: retProfile.address,
    is_verified: retProfile.is_verified
  });

  console.log('\n--- 3. Testing Processor submitting profile update request ---');
  const testNewAddress = 'Agro-Processing Mega Terminal, Plot 42-B, Electronic City Phase 2, Hosur Road, Bengaluru 560100';
  const testNewLicense = 'FSSAI-99887766554433';
  const testNewName = `${processor.name} Advanced Processing Hub`;

  const request = await profileService.requestProfileUpdate(processor.id, processor, {
    business_name: testNewName,
    license_number: testNewLicense,
    address: testNewAddress,
    phone: '+91 99000 11223',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560100',
    facility_type: 'Produce Storage & Agro-Processing Warehouse',
    operating_hours: '05:30 AM - 11:00 PM',
    coordinates: { lat: 12.8399, lng: 77.6770 }
  });

  console.log('Submitted Request ID:', request.id, 'Status:', request.status);

  console.log('\n--- 4. Checking Profile Status for Processor (should have pending request) ---');
  const statusAfterSubmit = await profileService.getProfileStatus(processor.id);
  console.log('Has pending request?:', Boolean(statusAfterSubmit.pending_request));
  console.log('Pending request requested_changes:', statusAfterSubmit.pending_request?.requested_changes);

  console.log('\n--- 5. Admin fetching all profile requests ---');
  const allReqs = await profileService.getAllProfileRequests('PENDING');
  console.log(`Found ${allReqs.length} pending requests. Target request present?:`, allReqs.some((r) => r.id === request.id));

  console.log('\n--- 6. Admin approving profile request ---');
  const adminUser = { id: '00e361c2-4a29-41d6-8246-51806d26971a', name: 'Master Admin', email: 'admin@farmchain.io' };
  const reviewResult = await profileService.reviewProfileRequest(
    request.id,
    adminUser,
    'APPROVE',
    'FSSAI license verified against portal. Physical facility address validated on GIS.'
  );
  console.log('Review result:', reviewResult.message);

  console.log('\n--- 7. Checking Profile Status after Admin Approval (should be active and verified) ---');
  const updatedProcProfile = await profileService.getActiveProfile(processor.id);
  console.log('Updated Processor Active Profile:', {
    business_name: updatedProcProfile.business_name,
    license_number: updatedProcProfile.license_number,
    address: updatedProcProfile.address,
    is_verified: updatedProcProfile.is_verified,
    verified_by: updatedProcProfile.verified_by
  });

  if (updatedProcProfile.address === testNewAddress && updatedProcProfile.license_number === testNewLicense) {
    console.log('\n SUCCESS: Active verified address immediately updated to the approved location!');
  } else {
    console.error('\n FAILURE: Active address did not match expected approved address!');
  }

  // Cleanup test record
  await supabase.from('traceability_events').delete().eq('id', request.id);
  console.log('\n Cleaned up test request event.');
}

runTest()
  .then(() => {
    console.log('Profile workflow test complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
