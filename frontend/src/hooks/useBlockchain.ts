import { useState, useEffect } from "react"
import { ethers } from "ethers"

// This ABI will be replaced with the real one after deployment
const FARMCHAIN_ABI = [
  "function registerProduct(string memory _name, string memory _category, string memory _batchNumber, uint256 _quantity, string memory _initialStatus) public",
  "function updateStage(uint256 _productId, string memory _status, string memory _extraInfo) public",
  "function transferOwnership(uint256 _productId, address _newOwner, string memory _status) public",
  "function getProductHistory(uint256 _productId) public view returns (tuple(string status, address owner, uint256 timestamp, string extraInfo)[])",
  "function productCount() public view returns (uint256)",
  "function products(uint256) public view returns (uint256 id, string name, string category, string batchNumber, uint256 quantity, address farmer, address currentOwner, string status, uint256 timestamp)",
  "event ProductRegistered(uint256 indexed productId, string name, address indexed farmer)",
  "event StageUpdated(uint256 indexed productId, string status, address indexed owner)",
]

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ""

export function useBlockchain() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connectWallet = async () => {
    try {
      const eth = (window as any).ethereum
      if (!eth) {
        const msg = "MetaMask is not installed. Please install it to use blockchain features."
        setError(msg)
        alert(msg)
        return
      }
      
      const web3Provider = new ethers.BrowserProvider(eth)
      await web3Provider.send("eth_requestAccounts", [])
      const web3Signer = await web3Provider.getSigner()
      const address = await web3Signer.getAddress()

      setProvider(web3Provider)
      setSigner(web3Signer)
      setAccount(address)
      setIsConnected(true)

      if (CONTRACT_ADDRESS) {
        const farmChainContract = new ethers.Contract(CONTRACT_ADDRESS, FARMCHAIN_ABI, web3Signer)
        setContract(farmChainContract)
      } else {
        alert("Contract address is missing in environment variables.")
      }
    } catch (err: any) {
      setError("Failed to connect wallet.")
      console.error(err)
      alert("Error connecting wallet: " + (err.message || err))
    }
  }

  const registerProductOnChain = async (
    name: string, category: string, batchNumber: string, quantity: number, status: string
  ) => {
    if (!contract) {
      setError("Contract not connected. Please connect your wallet and ensure contract address is set.")
      return null
    }
    try {
      const tx = await contract.registerProduct(name, category, batchNumber, quantity, status)
      const receipt = await tx.wait()
      
      let productId = 0;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === 'ProductRegistered') {
            productId = Number(parsed.args.productId);
            break;
          }
        } catch (e) {}
      }
      return { hash: receipt.hash, productId }
    } catch (err) {
      console.error("Blockchain TX failed:", err)
      return null
    }
  }

  const getProductHistory = async (productId: number) => {
    if (!contract) return []
    try {
      return await contract.getProductHistory(productId)
    } catch (err) {
      console.error(err)
      return []
    }
  }

  // Auto-connect if already authorized
  useEffect(() => {
    const eth = (window as any).ethereum
    if (eth) {
      eth.request({ method: "eth_accounts" }).then((accounts: string[]) => {
        if (accounts.length > 0) connectWallet()
      }).catch((e: any) => console.error(e))
    }
  }, [])

  return { provider, signer, contract, account, isConnected, error, connectWallet, registerProductOnChain, getProductHistory }
}
