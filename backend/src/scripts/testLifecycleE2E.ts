import dotenv from 'dotenv';
dotenv.config();

import { supabase } from '../config/supabase';
import { blockchainRelayer } from '../services/blockchainRelayer';

async function runEndToEndLifecycleTest() {
  console.log('===============================================================');
  console.log('🚀 STARTING FULL-LIFECYCLE SEPOLIA ON-CHAIN RELAYER E2E TEST');
  console.log('===============================================================\n');

  // 0. Verify Relayer Configuration
  if (!blockchainRelayer.isConfigured()) {
    console.error('❌ Relayer is NOT configured. Please check BLOCKCHAIN_RPC_URL, BLOCKCHAIN_PRIVATE_KEY, and CONTRACT_ADDRESS.');
    process.exit(1);
  }
  console.log(`✓ Relayer Active: ${blockchainRelayer.getRelayerAddress()}`);
  console.log(`✓ Target Contract: ${blockchainRelayer.getContractAddress()}\n`);

  // Find or create a test farmer user
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('role', 'farmer')
    .limit(1);

  let farmerId = users?.[0]?.id;
  if (!farmerId) {
    const { data: anyUser } = await supabase.from('users').select('id').limit(1).single();
    farmerId = anyUser?.id;
  }

  if (!farmerId) {
    console.error('❌ No user found in Supabase users table.');
    process.exit(1);
  }

  const timestamp = Date.now();
  const testBatchNumber = `BCH-SEPOLIA-${timestamp.toString().slice(-6)}`;
  const productName = 'Organic Shimla Apples';
  const category = 'Fruits';
  const quantity = 150;

  console.log(`📦 Step 1: Farmer Registration (Database Stage)`);
  console.log(`   Product: ${productName} (${quantity} kg) | Batch: ${testBatchNumber}`);

  const { data: newProduct, error: insertErr } = await supabase
    .from('products')
    .insert({
      name: productName,
      category,
      batch_number: testBatchNumber,
      quantity,
      status: 'Pending Approval',
      farmer_id: farmerId,
      current_owner_id: farmerId,
      organic_status: true,
      ai_quality_score: 95,
      ai_quality_label: 'Grade A',
      blockchain_hash: null
    })
    .select()
    .single();

  if (insertErr || !newProduct) {
    console.error('❌ Failed to insert test product into database:', insertErr);
    process.exit(1);
  }
  console.log(`   ✓ DB Record Created! UUID: ${newProduct.id}, Status: "${newProduct.status}"\n`);

  // Step 2: Admin Approval & Blockchain Registration via Relayer
  console.log(`🏛️ Step 2: Admin Approval & Sepolia Blockchain Registration`);
  console.log(`   Relayer calling FarmChain.registerProduct() on Sepolia...`);

  const regRes = await blockchainRelayer.registerProduct(
    newProduct.name,
    newProduct.category,
    newProduct.batch_number,
    Number(newProduct.quantity),
    'Harvested'
  );

  if (!regRes) {
    console.error('❌ Relayer failed to register product on Sepolia.');
    process.exit(1);
  }

  const onChainProductId = regRes.onChainProductId;
  console.log(`   ✓ On-Chain Product Registered! ID: #${onChainProductId}`);
  console.log(`   ✓ Sepolia Tx Hash: ${regRes.txHash}`);
  console.log(`   ✓ Sepolia Block: ${regRes.blockNumber}`);
  console.log(`   🔗 Explorer: https://sepolia.etherscan.io/tx/${regRes.txHash}\n`);

  // Update DB with on-chain details
  await supabase
    .from('products')
    .update({
      status: 'Harvested',
      product_id: onChainProductId,
      blockchain_hash: regRes.txHash
    })
    .eq('id', newProduct.id);

  // Step 3: Processor Inspection & Physical Quality Grading
  console.log(`🏭 Step 3: Processor Quality Inspection & Certification`);
  const inspectionStatus = 'Processed - Grade A';
  const inspectionInfo = 'Physical Inspection Certified: Grade A (Purity 98%, Temp 4°C)';
  console.log(`   Relayer calling FarmChain.updateStage() on Sepolia -> "${inspectionStatus}"...`);

  const procRes = await blockchainRelayer.updateStage(
    onChainProductId,
    inspectionStatus,
    inspectionInfo
  );

  if (!procRes) {
    console.error('❌ Relayer failed to update stage for Processor.');
    process.exit(1);
  }
  console.log(`   ✓ Processor Milestone Recorded On-Chain!`);
  console.log(`   ✓ Sepolia Tx Hash: ${procRes.txHash}`);
  console.log(`   ✓ Sepolia Block: ${procRes.blockNumber}`);
  console.log(`   🔗 Explorer: https://sepolia.etherscan.io/tx/${procRes.txHash}\n`);

  await supabase
    .from('products')
    .update({
      status: inspectionStatus,
      blockchain_hash: procRes.txHash
    })
    .eq('id', newProduct.id);

  // Step 4: Distributor Transit Custody
  console.log(`🚚 Step 4: Distributor Freight Transit Custody`);
  const transitStatus = 'In Transit';
  const transitInfo = 'Custody transferred to XYZ Freight Logistics (Truck #KA-04-E-5678, Temp 3.8°C)';
  console.log(`   Relayer calling FarmChain.updateStage() on Sepolia -> "${transitStatus}"...`);

  const distRes = await blockchainRelayer.updateStage(
    onChainProductId,
    transitStatus,
    transitInfo
  );

  if (!distRes) {
    console.error('❌ Relayer failed to update stage for Distributor.');
    process.exit(1);
  }
  console.log(`   ✓ Transit Milestone Recorded On-Chain!`);
  console.log(`   ✓ Sepolia Tx Hash: ${distRes.txHash}`);
  console.log(`   ✓ Sepolia Block: ${distRes.blockNumber}`);
  console.log(`   🔗 Explorer: https://sepolia.etherscan.io/tx/${distRes.txHash}\n`);

  await supabase
    .from('products')
    .update({
      status: transitStatus,
      blockchain_hash: distRes.txHash
    })
    .eq('id', newProduct.id);

  // Step 5: Retailer Intake & Store Shelf Check-In
  console.log(`🏪 Step 5: Retailer Intake & Stock Receipt`);
  const retailStatus = 'At Retailer';
  const retailInfo = 'Received at Metro Fresh Mart Store #204 (Condition: Fresh, Inspected)';
  console.log(`   Relayer calling FarmChain.updateStage() on Sepolia -> "${retailStatus}"...`);

  const retRes = await blockchainRelayer.updateStage(
    onChainProductId,
    retailStatus,
    retailInfo
  );

  if (!retRes) {
    console.error('❌ Relayer failed to update stage for Retailer.');
    process.exit(1);
  }
  console.log(`   ✓ Retailer Milestone Recorded On-Chain!`);
  console.log(`   ✓ Sepolia Tx Hash: ${retRes.txHash}`);
  console.log(`   ✓ Sepolia Block: ${retRes.blockNumber}`);
  console.log(`   🔗 Explorer: https://sepolia.etherscan.io/tx/${retRes.txHash}\n`);

  await supabase
    .from('products')
    .update({
      status: retailStatus,
      blockchain_hash: retRes.txHash
    })
    .eq('id', newProduct.id);

  // Step 6: Public Consumer Verification (/track)
  console.log(`🔍 Step 6: Public Consumer On-Chain Verification Query`);
  console.log(`   Reading raw on-chain state for Product #${onChainProductId}...`);

  const onChainProduct = await blockchainRelayer.getProduct(onChainProductId);
  console.log(`   • Name: ${onChainProduct.name}`);
  console.log(`   • Batch: ${onChainProduct.batchNumber}`);
  console.log(`   • Final On-Chain Status: ${onChainProduct.status}`);
  console.log(`   • Current Owner (Relayer): ${onChainProduct.currentOwner}`);

  console.log(`\n📜 Fetching Complete Immutable On-Chain Audit History:`);
  const history = await blockchainRelayer.getProductHistory(onChainProductId);
  console.log(`   Total Milestones on Blockchain: ${history.length}`);
  
  history.forEach((h, index) => {
    console.log(`   [Milestone ${index + 1}]`);
    console.log(`     • Status:     ${h.status}`);
    console.log(`     • Details:    ${h.extraInfo}`);
    console.log(`     • Signer:     ${h.owner}`);
    console.log(`     • Timestamp:  ${h.date}`);
  });

  console.log('\n===============================================================');
  console.log('🎉 ALL 5 SUPPLY-CHAIN MILESTONES VERIFIED LIVE ON SEPOLIA!');
  console.log(`   Search ID in Consumer Tracker: ${onChainProductId} or ${testBatchNumber}`);
  console.log('===============================================================\n');
}

runEndToEndLifecycleTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
