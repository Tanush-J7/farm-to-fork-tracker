import dotenv from 'dotenv';
dotenv.config();

import { blockchainRelayer } from '../services/blockchainRelayer';

async function testFullSepoliaLifecycle() {
  console.log('========================================================================');
  console.log('🌾 FARMCHAIN AI: FULL LIFECYCLE SEPOLIA ON-CHAIN TEST');
  console.log('========================================================================\n');

  if (!blockchainRelayer.isConfigured()) {
    console.error('❌ Relayer is not configured.');
    process.exit(1);
  }

  const relayerAddress = blockchainRelayer.getRelayerAddress();
  const contractAddress = blockchainRelayer.getContractAddress();
  console.log(`✓ Relayer Wallet Address: ${relayerAddress}`);
  console.log(`✓ Sepolia Contract:      ${contractAddress}\n`);

  const batchCode = `BCH-APPLE-${Date.now().toString().slice(-6)}`;
  const productName = 'Shimla Organic Golden Apples';
  const category = 'Fruits';
  const quantity = 350;

  // -------------------------------------------------------------------------
  // STAGE 1: Farmer Harvest & Registration
  // -------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('🚜 MILESTONE 1: Farmer Harvest & Batch Registration');
  console.log(`   Product: ${productName} (${quantity} kg) | Batch: ${batchCode}`);
  console.log('   Broadcasting transaction to Sepolia...');

  const regRes = await blockchainRelayer.registerProduct(
    productName,
    category,
    batchCode,
    quantity,
    'Harvested'
  );

  if (!regRes) {
    throw new Error('Milestone 1 failed');
  }

  const productId = regRes.onChainProductId;
  console.log(`   ✓ Confirmed on Sepolia Block #${regRes.blockNumber}!`);
  console.log(`   ✓ On-Chain Product ID: #${productId}`);
  console.log(`   ✓ Sepolia Tx Hash:     ${regRes.txHash}`);
  console.log(`   🔗 Etherscan Link:     https://sepolia.etherscan.io/tx/${regRes.txHash}\n`);

  // -------------------------------------------------------------------------
  // STAGE 2: Processor Quality Grading & Certification
  // -------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('🏭 MILESTONE 2: Processing & Physical Quality Inspection');
  const procStatus = 'Processed - Grade A';
  const procInfo = 'Bangalore Agro-Processing Hub: Grade A Certified (Freshness 96%, Temp 4.2°C)';
  console.log(`   Updating status to "${procStatus}" on Sepolia...`);

  const procRes = await blockchainRelayer.updateStage(productId, procStatus, procInfo);
  if (!procRes) throw new Error('Milestone 2 failed');

  console.log(`   ✓ Confirmed on Sepolia Block #${procRes.blockNumber}!`);
  console.log(`   ✓ Sepolia Tx Hash: ${procRes.txHash}`);
  console.log(`   🔗 Etherscan Link: https://sepolia.etherscan.io/tx/${procRes.txHash}\n`);

  // -------------------------------------------------------------------------
  // STAGE 3: Cold-Chain Logistics & Distribution
  // -------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('🚚 MILESTONE 3: Cold-Chain Transit & Custody Transfer');
  const transitStatus = 'In Transit';
  const transitInfo = 'XYZ Cold Logistics: Reefer Truck #KA-04-E-5678, GPS Active, Temp 3.8°C';
  console.log(`   Updating status to "${transitStatus}" on Sepolia...`);

  const distRes = await blockchainRelayer.updateStage(productId, transitStatus, transitInfo);
  if (!distRes) throw new Error('Milestone 3 failed');

  console.log(`   ✓ Confirmed on Sepolia Block #${distRes.blockNumber}!`);
  console.log(`   ✓ Sepolia Tx Hash: ${distRes.txHash}`);
  console.log(`   🔗 Etherscan Link: https://sepolia.etherscan.io/tx/${distRes.txHash}\n`);

  // -------------------------------------------------------------------------
  // STAGE 4: Retailer Intake & Store Shelf Check-In
  // -------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('🏪 MILESTONE 4: Retail Store Receipt & Stocking');
  const retailStatus = 'At Retailer';
  const retailInfo = 'Metro Fresh Mart (Koramangala Store #104): Checked into cold rack A-12';
  console.log(`   Updating status to "${retailStatus}" on Sepolia...`);

  const retRes = await blockchainRelayer.updateStage(productId, retailStatus, retailInfo);
  if (!retRes) throw new Error('Milestone 4 failed');

  console.log(`   ✓ Confirmed on Sepolia Block #${retRes.blockNumber}!`);
  console.log(`   ✓ Sepolia Tx Hash: ${retRes.txHash}`);
  console.log(`   🔗 Etherscan Link: https://sepolia.etherscan.io/tx/${retRes.txHash}\n`);

  // -------------------------------------------------------------------------
  // STAGE 5: Public Consumer Verification & Audit Log
  // -------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('🔎 MILESTONE 5: Consumer On-Chain Verification (/track)');
  console.log(`   Querying public ledger for Product #${productId}...`);

  const onChainData = await blockchainRelayer.getProduct(productId);
  const fullHistory = await blockchainRelayer.getProductHistory(productId);

  console.log(`   • Product Name:    ${onChainData.name}`);
  console.log(`   • Batch Number:    ${onChainData.batchNumber}`);
  console.log(`   • Final Status:    ${onChainData.status}`);
  console.log(`   • Total Milestones on Chain: ${fullHistory.length}\n`);

  console.log('📜 Complete On-Chain Verification Checklist:');
  fullHistory.forEach((h: any, idx: number) => {
    console.log(`   [Block Event #${idx + 1}]`);
    console.log(`     • Stage:       ${h.status}`);
    console.log(`     • Metadata:    ${h.extraInfo}`);
    console.log(`     • Block Time:  ${h.date}`);
    console.log(`     • Signer:      ${h.owner}`);
  });

  console.log('\n========================================================================');
  console.log('🎉 100% OF SUPPLY-CHAIN MILESTONES ARE VERIFIED ON ETHEREUM SEPOLIA!');
  console.log(`   You can track this live in the UI with ID: ${productId} or ${batchCode}`);
  console.log('========================================================================\n');
}

testFullSepoliaLifecycle().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
