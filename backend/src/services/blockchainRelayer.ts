import dotenv from 'dotenv';
dotenv.config();
import { ethers } from 'ethers';

export const FARMCHAIN_ABI = [
  'function registerProduct(string memory _name, string memory _category, string memory _batchNumber, uint256 _quantity, string memory _initialStatus) public',
  'function updateStage(uint256 _productId, string memory _status, string memory _extraInfo) public',
  'function transferOwnership(uint256 _productId, address _newOwner, string memory _status) public',
  'function getProductHistory(uint256 _productId) public view returns (tuple(string status, address owner, uint256 timestamp, string extraInfo)[])',
  'function productCount() public view returns (uint256)',
  'function products(uint256) public view returns (uint256 id, string name, string category, string batchNumber, uint256 quantity, address farmer, address currentOwner, string status, uint256 timestamp)',
  'event ProductRegistered(uint256 indexed productId, string name, address indexed farmer)',
  'event StageUpdated(uint256 indexed productId, string status, address indexed owner)',
  'event OwnershipTransferred(uint256 indexed productId, address indexed oldOwner, address indexed newOwner)'
];

class BlockchainRelayer {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private contractAddress: string = '';
  private txQueue: Promise<any> = Promise.resolve();

  constructor() {
    this.init();
  }

  private init() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const contractAddr = process.env.CONTRACT_ADDRESS;

    if (rpcUrl && privateKey && contractAddr) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.contractAddress = contractAddr;
        this.contract = new ethers.Contract(contractAddr, FARMCHAIN_ABI, this.wallet);
        console.log(`[BlockchainRelayer] Initialized. Relayer address: ${this.wallet.address}, Contract: ${contractAddr}`);
      } catch (err) {
        console.error('[BlockchainRelayer] Initialization error:', err);
      }
    } else {
      console.warn('[BlockchainRelayer] Missing environment variables (BLOCKCHAIN_RPC_URL, BLOCKCHAIN_PRIVATE_KEY, CONTRACT_ADDRESS). Relayer running in inactive mode.');
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.provider && this.wallet && this.contract);
  }

  public getRelayerAddress(): string | null {
    return this.wallet ? this.wallet.address : null;
  }

  public getContractAddress(): string {
    return this.contractAddress;
  }

  /**
   * Sequential queue to avoid concurrent nonce collisions on testnet
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.txQueue = this.txQueue
        .then(() => task().then(resolve, reject))
        .catch(() => task().then(resolve, reject));
    });
  }

  /**
   * Registers a harvest batch on-chain using the gasless relayer.
   */
  public async registerProduct(
    name: string,
    category: string,
    batchNumber: string,
    quantity: number,
    initialStatus: string = 'Harvested'
  ): Promise<{ txHash: string; onChainProductId: number; blockNumber: number } | null> {
    if (!this.isConfigured() || !this.contract) {
      console.warn('[BlockchainRelayer] Cannot register on-chain: relayer not configured.');
      return null;
    }

    return this.enqueue(async () => {
      try {
        console.log(`[BlockchainRelayer] Submitting registerProduct on-chain for batch ${batchNumber}...`);
        const tx = await this.contract!.registerProduct(
          name,
          category,
          batchNumber,
          Math.max(1, Math.round(quantity)),
          initialStatus
        );
        console.log(`[BlockchainRelayer] Tx broadcasted: ${tx.hash}. Waiting for confirmation...`);
        const receipt = await tx.wait(1);

        let onChainProductId = 0;
        if (receipt && receipt.logs) {
          for (const log of receipt.logs) {
            try {
              const parsed = this.contract!.interface.parseLog(log);
              if (parsed && parsed.name === 'ProductRegistered') {
                onChainProductId = Number(parsed.args.productId);
                break;
              }
            } catch (e) {
              // Ignore non-matching logs
            }
          }
        }

        console.log(`[BlockchainRelayer] Confirmed! On-chain Product ID: ${onChainProductId}, Tx: ${receipt.hash}`);
        return {
          txHash: receipt.hash,
          onChainProductId,
          blockNumber: receipt.blockNumber
        };
      } catch (error) {
        console.error('[BlockchainRelayer] registerProduct failed:', error);
        throw error;
      }
    });
  }

  /**
   * Updates stage history for an existing on-chain product.
   */
  public async updateStage(
    productId: number,
    status: string,
    extraInfo: string = ''
  ): Promise<{ txHash: string; blockNumber: number } | null> {
    if (!this.isConfigured() || !this.contract) {
      console.warn('[BlockchainRelayer] Cannot update stage on-chain: relayer not configured.');
      return null;
    }

    if (!productId || productId <= 0) {
      console.warn(`[BlockchainRelayer] Cannot update stage on-chain: invalid on-chain product ID (${productId})`);
      return null;
    }

    return this.enqueue(async () => {
      try {
        console.log(`[BlockchainRelayer] Submitting updateStage on-chain for Product #${productId} -> "${status}"...`);
        const tx = await this.contract!.updateStage(
          productId,
          status,
          extraInfo || `Stage updated to ${status}`
        );
        console.log(`[BlockchainRelayer] Tx broadcasted: ${tx.hash}. Waiting for confirmation...`);
        const receipt = await tx.wait(1);
        console.log(`[BlockchainRelayer] Confirmed updateStage! Tx: ${receipt.hash}`);
        return {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber
        };
      } catch (error) {
        console.error(`[BlockchainRelayer] updateStage failed for Product #${productId}:`, error);
        throw error;
      }
    });
  }

  /**
   * Transfers on-chain ownership to a new wallet address.
   */
  public async transferOwnership(
    productId: number,
    newOwnerAddress: string,
    status: string = 'Ownership Transferred'
  ): Promise<{ txHash: string; blockNumber: number } | null> {
    if (!this.isConfigured() || !this.contract) {
      console.warn('[BlockchainRelayer] Cannot transfer ownership on-chain: relayer not configured.');
      return null;
    }

    if (!productId || productId <= 0 || !ethers.isAddress(newOwnerAddress)) {
      console.warn(`[BlockchainRelayer] Invalid parameters for transferOwnership: productId=${productId}, address=${newOwnerAddress}`);
      return null;
    }

    return this.enqueue(async () => {
      try {
        console.log(`[BlockchainRelayer] Transferring ownership for Product #${productId} to ${newOwnerAddress}...`);
        const tx = await this.contract!.transferOwnership(productId, newOwnerAddress, status);
        const receipt = await tx.wait(1);
        console.log(`[BlockchainRelayer] Confirmed transferOwnership! Tx: ${receipt.hash}`);
        return {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber
        };
      } catch (error) {
        console.error(`[BlockchainRelayer] transferOwnership failed for Product #${productId}:`, error);
        throw error;
      }
    });
  }

  /**
   * Retrieves complete on-chain event history for verification.
   */
  public async getProductHistory(productId: number): Promise<any[]> {
    if (!this.isConfigured() || !this.contract) return [];
    try {
      const history = await this.contract.getProductHistory(productId);
      return history.map((h: any) => ({
        status: h.status,
        owner: h.owner,
        timestamp: Number(h.timestamp),
        date: new Date(Number(h.timestamp) * 1000).toISOString(),
        extraInfo: h.extraInfo
      }));
    } catch (err) {
      console.error(`[BlockchainRelayer] Error fetching history for Product #${productId}:`, err);
      return [];
    }
  }

  /**
   * Reads raw on-chain product record.
   */
  public async getProduct(productId: number): Promise<any | null> {
    if (!this.isConfigured() || !this.contract) return null;
    try {
      const p = await this.contract.products(productId);
      if (!p || p.id === 0n) return null;
      return {
        id: Number(p.id),
        name: p.name,
        category: p.category,
        batchNumber: p.batchNumber,
        quantity: Number(p.quantity),
        farmer: p.farmer,
        currentOwner: p.currentOwner,
        status: p.status,
        timestamp: Number(p.timestamp)
      };
    } catch (err) {
      console.error(`[BlockchainRelayer] Error fetching Product #${productId}:`, err);
      return null;
    }
  }
}

export const blockchainRelayer = new BlockchainRelayer();
