import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { ethers } from "ethers"
import { Card, CardContent } from "../components/ui/Card"
import { CheckCircle2, Factory, Truck, Store, Search, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "../components/ui/Button"
import axios from "axios"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"
const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545"
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ""

const FARMCHAIN_ABI = [
  "function products(uint256) public view returns (uint256 id, string name, string category, string batchNumber, uint256 quantity, address farmer, address currentOwner, string status, uint256 timestamp)",
  "function getProductHistory(uint256 _productId) public view returns (tuple(string status, address owner, uint256 timestamp, string extraInfo)[])"
]

const STAGE_CONFIG: Record<string, any> = {
  "Registration": { icon: CheckCircle2, color: "text-green-500" },
  "Harvested": { icon: CheckCircle2, color: "text-green-500" },
  "Processed": { icon: Factory, color: "text-blue-500" },
  "In Transit": { icon: Truck, color: "text-amber-500" },
  "Retail": { icon: Store, color: "text-purple-500" },
  "Ownership Transferred": { icon: Store, color: "text-pink-500" }
}

const format6DigitId = (id: number | string) => {
  const num = Number(id)
  if (num >= 100000 && num <= 999999) return String(num)
  if (num > 0) return String(100000 + num)
  return "100000"
}

export function Tracker() {
  const [searchParams] = useSearchParams()
  const [productIdInput, setProductIdInput] = useState(searchParams.get("id") || "")
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  const [dbProduct, setDbProduct] = useState<any>(null)
  const [chainProduct, setChainProduct] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  const fetchProductData = async (id: string) => {
    if (!id) return;
    setLoading(true)
    setError("")
    setDbProduct(null)
    setChainProduct(null)
    setHistory([])

    let foundDb: any = null
    let foundChain: any = null
    const numId = Number(id)

    // Stage 1: Try direct backend route /api/products/blockchain/:id
    try {
      const dbRes = await axios.get(`${API}/products/blockchain/${id}`)
      if (dbRes.data?.data) {
        foundDb = dbRes.data.data
      }
    } catch {
      // 404 or network issue
    }

    // Stage 2: If numId >= 100000, try querying subtracted small ID (e.g. 100008 -> 8)
    if (!foundDb && !isNaN(numId) && numId >= 100000) {
      try {
        const smallId = numId - 100000
        const smallRes = await axios.get(`${API}/products/blockchain/${smallId}`)
        if (smallRes.data?.data) {
          foundDb = smallRes.data.data
        }
      } catch {
        // fallback
      }
    }

    // Stage 3: Query all products list /api/products and match 6-digit mapped ID
    if (!foundDb) {
      try {
        const listRes = await axios.get(`${API}/products`)
        const allList = listRes.data?.data || []
        if (allList.length > 0) {
          foundDb = allList.find((p: any) => {
            const pId = p.product_id || p.id
            const mapped = format6DigitId(pId)
            return (
              String(pId) === String(id) ||
              mapped === String(id) ||
              (numId >= 100000 && Number(pId) === numId - 100000) ||
              p.batch_number === id ||
              String(p.id) === String(id)
            )
          })
        }
      } catch {
        // list fallback failed
      }
    }

    if (foundDb) {
      setDbProduct(foundDb)
    }

    // Stage 4: Fetch on-chain data using public provider if contract configured
    if (CONTRACT_ADDRESS) {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const contract = new ethers.Contract(CONTRACT_ADDRESS, FARMCHAIN_ABI, provider)

        const searchIdOnChain = (foundDb?.product_id) ? foundDb.product_id : id
        const productData = await contract.products(searchIdOnChain)
        if (productData && productData.id !== 0n) {
          foundChain = {
            name: productData.name,
            batchNumber: productData.batchNumber,
            status: productData.status
          }
          setChainProduct(foundChain)

          const historyData = await contract.getProductHistory(searchIdOnChain)
          const formattedHistory = historyData.map((h: any) => ({
            stage: h.status,
            actor: h.owner,
            date: new Date(Number(h.timestamp) * 1000).toLocaleString(),
            location: "Blockchain",
            extraInfo: h.extraInfo,
            color: STAGE_CONFIG[h.extraInfo]?.color || STAGE_CONFIG[h.status]?.color || "text-green-500",
            icon: STAGE_CONFIG[h.extraInfo]?.icon || STAGE_CONFIG[h.status]?.icon || CheckCircle2
          }))
          setHistory(formattedHistory.reverse())
        }
      } catch (err) {
        console.warn("Blockchain read skipped:", err)
      }
    }

    // Stage 5: Default ledger timeline if DB product found
    if (foundDb) {
      const defaultHistory = [
        {
          stage: foundDb.status || "Harvested",
          actor: foundDb.farmer_id ? `Farmer (${String(foundDb.farmer_id).slice(0, 8)}...)` : "Certified Farmer",
          date: foundDb.created_at ? new Date(foundDb.created_at).toLocaleString() : new Date().toLocaleString(),
          location: "Verified Ledger",
          extraInfo: "Harvest Registered",
          color: "text-green-500",
          icon: CheckCircle2
        }
      ]
      setHistory(prev => prev.length > 0 ? prev : defaultHistory)
    }

    if (!foundDb && !foundChain) {
      setError(`No product found for ID ${id}. Please verify the Product ID.`)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (searchParams.get("id")) {
      fetchProductData(searchParams.get("id") as string)
    }
  }, [searchParams])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (productIdInput) {
      window.history.pushState({}, '', `?id=${productIdInput}`)
      fetchProductData(productIdInput)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="text-center space-y-2 mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Verify Your Product</h1>
        <p className="text-muted-foreground">Enter a product ID or scan a QR code to view its immutable journey.</p>
        
        <form onSubmit={handleSearch} className="flex max-w-md mx-auto items-center space-x-2 mt-6">
          <input 
            type="number" 
            placeholder="Enter 6-digit Product ID (e.g. 583920)" 
            value={productIdInput}
            onChange={(e) => setProductIdInput(e.target.value)}
            className="flex h-12 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring glass"
          />
          <Button type="submit" size="lg" className="h-12 bg-primary hover:bg-primary/90" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Search className="h-5 w-5 mr-2" />}
            Track
          </Button>
        </form>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {(chainProduct || dbProduct) && (
        <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-r from-primary/10 to-transparent p-6 border-b">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{chainProduct?.name || dbProduct?.name}</h2>
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-bold text-xs px-2.5 py-1 rounded-full">
                    Product ID: {dbProduct?.product_id || productIdInput}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 font-mono">Batch: {chainProduct?.batchNumber || dbProduct?.batch_number}</p>
              </div>
              <div className="flex gap-2">
                {dbProduct?.organic_status && (
                  <span className="inline-flex items-center rounded-full bg-green-500/15 border border-green-500/30 px-3 py-1 text-xs font-semibold text-green-400">
                    Certified Organic
                  </span>
                )}
                {dbProduct?.ai_quality_label && (
                  <span className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-400">
                    AI Quality: {dbProduct.ai_quality_label}
                  </span>
                )}
              </div>
            </div>
            {dbProduct?.product_image_url && (
              <div className="mt-4 w-full h-48 md:h-64 rounded-lg overflow-hidden border border-white/10 shadow-lg">
                <img src={dbProduct.product_image_url} alt={chainProduct?.name || dbProduct?.name} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          <CardContent className="p-8">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="bg-primary/20 text-primary p-1.5 rounded-lg"><Search className="h-4 w-4"/></span>
              Blockchain History
            </h3>
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              
              {history.map((item, i) => (
                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm glass-card hover:border-primary/50 transition-colors">
                    <div className="flex flex-col space-y-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg">{item.extraInfo === "Registration" ? "Registered" : item.stage}</h3>
                        <span className="text-[10px] uppercase font-bold text-primary/80 tracking-wider">{item.extraInfo}</span>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground truncate" title={item.actor}>Owner: {item.actor}</p>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-2">
                        <span>{item.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
