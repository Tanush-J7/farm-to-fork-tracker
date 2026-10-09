import { ethers } from 'ethers';

const CONTRACT_ABI = [
  "function registerProduct(string memory _productId, string memory _name, string memory _category, string memory _batchNumber, uint256 _quantity, string memory _initialStatus) public",
  "function updateStage(string memory _productId, string memory _status, string memory _extraInfo) public",
  "function transferOwnership(string memory _productId, address _newOwner, string memory _status) public",
  "function recordReceipt(string memory _productId) public",
  "function products(string memory) public view returns (string id, string name, string category, string batchNumber, uint256 quantity, address farmer, address currentOwner, string status, uint256 timestamp, bool exists)",
  "event ProductRegistered(string indexed productId, string name, address indexed farmer)",
  "event StageUpdated(string indexed productId, string status, address indexed owner)",
  "event OwnershipTransferred(string indexed productId, address indexed oldOwner, address indexed newOwner)"
];

export enum BlockchainStatus {
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  SUBMISSION_PENDING = 'SUBMISSION_PENDING',
  ON_CHAIN_CONFIRMED = 'ON_CHAIN_CONFIRMED',
  ON_CHAIN_VERIFICATION_FAILED = 'ON_CHAIN_VERIFICATION_FAILED',
  DATABASE_ONLY = 'DATABASE_ONLY'
}

class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  public isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (rpcUrl && privateKey && contractAddress) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.contract = new ethers.Contract(contractAddress, CONTRACT_ABI, this.wallet);
        this.isConfigured = true;
      } catch (err) {
        console.error("BlockchainService: Initialization failed", err);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
    }
  }

  async getHealth() {
    if (!this.isConfigured || !this.provider || !this.wallet) {
      return { 
        status: 'warning', 
        message: 'Blockchain env variables not configured on backend',
        walletBalance: '0.0',
        network: 'Unknown'
      };
    }
    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      const network = await this.provider.getNetwork();
      return {
        status: 'healthy',
        message: 'Connected to blockchain',
        walletAddress: this.wallet.address,
        walletBalance: ethers.formatEther(balance),
        network: network.name || network.chainId.toString(),
        contractAddress: process.env.CONTRACT_ADDRESS
      };
    } catch (err) {
      return {
        status: 'error',
        message: 'Blockchain Connection Error'
      };
    }
  }

  async registerProduct(productId: string, name: string, category: string, batchNumber: string, quantity: number, initialStatus: string) {
    if (!this.isConfigured || !this.contract) {
      return { status: BlockchainStatus.NOT_CONFIGURED, txHash: null };
    }
    try {
      const tx = await this.contract.registerProduct(productId, name, category, batchNumber, quantity, initialStatus);
      const receipt = await tx.wait();
      return { status: BlockchainStatus.ON_CHAIN_CONFIRMED, txHash: receipt.hash };
    } catch (err) {
      console.error("BlockchainService: registerProduct failed", err);
      return { status: BlockchainStatus.ON_CHAIN_VERIFICATION_FAILED, txHash: null };
    }
  }

  async updateStage(productId: string, status: string, extraInfo: string) {
    if (!this.isConfigured || !this.contract) {
      return { status: BlockchainStatus.NOT_CONFIGURED, txHash: null };
    }
    try {
      const tx = await this.contract.updateStage(productId, status, extraInfo);
      const receipt = await tx.wait();
      return { status: BlockchainStatus.ON_CHAIN_CONFIRMED, txHash: receipt.hash };
    } catch (err) {
      console.error("BlockchainService: updateStage failed", err);
      return { status: BlockchainStatus.ON_CHAIN_VERIFICATION_FAILED, txHash: null };
    }
  }

  async transferOwnership(productId: string, newOwnerAddress: string, status: string) {
    if (!this.isConfigured || !this.contract) {
      return { status: BlockchainStatus.NOT_CONFIGURED, txHash: null };
    }
    try {
      const tx = await this.contract.transferOwnership(productId, newOwnerAddress, status);
      const receipt = await tx.wait();
      return { status: BlockchainStatus.ON_CHAIN_CONFIRMED, txHash: receipt.hash };
    } catch (err) {
      console.error("BlockchainService: transferOwnership failed", err);
      return { status: BlockchainStatus.ON_CHAIN_VERIFICATION_FAILED, txHash: null };
    }
  }

  async recordReceipt(productId: string) {
    if (!this.isConfigured || !this.contract) {
      return { status: BlockchainStatus.NOT_CONFIGURED, txHash: null };
    }
    try {
      const tx = await this.contract.recordReceipt(productId);
      const receipt = await tx.wait();
      return { status: BlockchainStatus.ON_CHAIN_CONFIRMED, txHash: receipt.hash };
    } catch (err) {
      console.error("BlockchainService: recordReceipt failed", err);
      return { status: BlockchainStatus.ON_CHAIN_VERIFICATION_FAILED, txHash: null };
    }
  }
}

export const blockchainService = new BlockchainService();
