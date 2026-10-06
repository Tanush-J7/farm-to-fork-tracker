import { describe } from "mocha";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("FarmChain", function () {
  async function deployFarmChain() {
    const [owner, farmer, processor] = await ethers.getSigners();
    const FarmChain = await ethers.getContractFactory("FarmChain");
    const farmChain = await FarmChain.deploy();
    return { farmChain, owner, farmer, processor };
  }

  it("Should register a new product", async function () {
    const { farmChain, farmer } = await deployFarmChain();
    await farmChain.connect(farmer).registerProduct(
      "Organic Tomatoes",
      "Vegetables",
      "BCH-001",
      500,
      "Harvested"
    );
    expect(await farmChain.productCount()).to.equal(1);
  });

  it("Should store product details correctly", async function () {
    const { farmChain, farmer } = await deployFarmChain();
    await farmChain.connect(farmer).registerProduct("Mangoes", "Fruits", "BCH-002", 200, "Harvested");
    const product = await farmChain.products(1);
    expect(product.name).to.equal("Mangoes");
    expect(product.category).to.equal("Fruits");
    expect(product.farmer).to.equal(farmer.address);
  });

  it("Should update product stage", async function () {
    const { farmChain, farmer } = await deployFarmChain();
    await farmChain.connect(farmer).registerProduct("Wheat", "Grains", "BCH-003", 1000, "Harvested");
    await farmChain.connect(farmer).updateStage(1, "Processed", "Processing completed");
    const product = await farmChain.products(1);
    expect(product.status).to.equal("Processed");
  });

  it("Should transfer ownership", async function () {
    const { farmChain, farmer, processor } = await deployFarmChain();
    await farmChain.connect(farmer).registerProduct("Rice", "Grains", "BCH-004", 750, "Harvested");
    await farmChain.connect(farmer).transferOwnership(1, processor.address, "Transferred to Processor");
    const product = await farmChain.products(1);
    expect(product.currentOwner).to.equal(processor.address);
  });

  it("Should return product history", async function () {
    const { farmChain, farmer } = await deployFarmChain();
    await farmChain.connect(farmer).registerProduct("Apples", "Fruits", "BCH-005", 300, "Harvested");
    await farmChain.connect(farmer).updateStage(1, "In Transit", "Picked up by distributor");
    const history = await farmChain.getProductHistory(1);
    expect(history.length).to.equal(2);
    expect(history[0].status).to.equal("Harvested");
    expect(history[1].status).to.equal("In Transit");
  });
});
