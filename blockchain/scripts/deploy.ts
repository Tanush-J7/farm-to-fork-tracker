import { ethers } from "hardhat";

async function main() {
  console.log("Deploying FarmChain contract...");

  const FarmChain = await ethers.getContractFactory("FarmChain");
  const farmChain = await FarmChain.deploy();

  await farmChain.waitForDeployment();

  const address = await farmChain.getAddress();
  console.log(`FarmChain deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
