import { useState, useEffect, useCallback } from "react"
import { Button } from "../components/ui/Button"
import {
  Leaf, Truck, Factory, ShoppingBag, CheckCircle2,
  AlertCircle, RefreshCw, Star, Filter, Search, QrCode, X
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  Harvested: { color: "text-green-400", bg: "bg-green-400/10 border-green-400/30", icon: Leaf },
  Processing: { color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30", icon: Factory },
  "In Transit": { color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30", icon: Truck },
  Delivered: { color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30", icon: ShoppingBag },
  Sold: { color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/30", icon: CheckCircle2 },
}

const QUALITY_COLOR: Record<string, string> = {
  Excellent: "text-green-400", Good: "text-lime-400",
  Average: "text-yellow-400", Poor: "text-red-400", Unknown: "text-slate-400",
}

interface Product {
  id: string; name: string; category: string; batch_number: string
  quantity: number; status: string; ai_quality_label: string
  ai_quality_score: number; organic_status: boolean; created_at: string;
  product_id: number;
}

const format6DigitId = (id: number | string) => {
  const num = Number(id)
  if (!num || num <= 0) return "100000"
  if (num >= 100000 && num <= 999999) return String(num)
  return String(100000 + (Math.abs(num) % 899999))
}

export function MyProductsPage() {
  const { token } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")
  const [selectedProductQR, setSelectedProductQR] = useState<Product | null>(null)

  const headers = { Authorization: `Bearer ${token}` }

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res = await axios.get(`${API}/products/my`, { headers })
      setProducts(res.data.data || [])
    } catch {
      setError("Could not load products. Make sure the backend is running.")
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const statuses = ["All", ...Object.keys(STATUS_CONFIG)]
  const filtered = products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
      (p.batch_number || "").toLowerCase().includes(search.toLowerCase()) ||
      format6DigitId(p.product_id).includes(search)
    const matchFilter = filter === "All" || p.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Products</h1>
          <p className="text-slate-400 mt-1">All batches you have registered, with live AI analysis and status.</p>
        </div>
        <button onClick={fetchProducts} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text" placeholder="Search by name, batch, or 6-digit ID..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <div className="flex gap-1 flex-wrap">
            {statuses.map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${filter === s
                  ? "bg-green-500 border-green-500 text-white font-medium"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-primary"
                  }`}
              >{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table-style list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-red-500/20 bg-red-500/5">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
          <Button variant="outline" onClick={fetchProducts}>Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
          <Leaf className="h-8 w-8 text-slate-400" />
          <p className="text-slate-800 font-medium">No products found</p>
          <p className="text-slate-500 text-sm">{search || filter !== "All" ? "Try a different search or filter." : "Register your first harvest from the main dashboard."}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider items-center">
            <div className="col-span-2">Product ID</div>
            <div className="col-span-3">Product</div>
            <div className="col-span-2">Batch</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">AI Quality</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-1 text-center">Verify</div>
          </div>
          {/* Rows separated by a small line */}
          <div className="divide-y divide-slate-200">
            {filtered.map((p, idx) => {
              const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG["Harvested"]
              const Icon = sc.icon
              const qColor = QUALITY_COLOR[p.ai_quality_label] || QUALITY_COLOR["Unknown"]
              const displayId = format6DigitId(p.product_id)
              return (
                <div key={p.id || idx} className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-emerald-50/40 transition-colors group">
                  {/* Column 1: Product ID */}
                  <div className="col-span-2 min-w-0">
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block">
                      ID: {displayId}
                    </span>
                  </div>

                  {/* Column 2: Product Name (between Product ID and Batch) */}
                  <div className="col-span-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">{p.name}</p>
                      {p.organic_status && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium">Org</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{p.category}</p>
                  </div>

                  {/* Column 3: Batch */}
                  <div className="col-span-2">
                    <p className="text-xs font-mono text-slate-700 font-medium">{p.batch_number}</p>
                  </div>

                  {/* Column 4: Status */}
                  <div className="col-span-1">
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border font-medium ${sc.bg} ${sc.color}`}>
                      <Icon className="h-3 w-3" />
                      {p.status}
                    </span>
                  </div>

                  {/* Column 5: AI Quality */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5">
                      <Star className={`h-3.5 w-3.5 ${qColor}`} />
                      <span className={`text-sm font-semibold ${qColor}`}>{p.ai_quality_label || "Unknown"}</span>
                      {p.ai_quality_score > 0 && (
                        <span className="text-xs text-slate-500">({(p.ai_quality_score * 100).toFixed(0)}%)</span>
                      )}
                    </div>
                  </div>

                  {/* Column 6: Qty */}
                  <div className="col-span-1 text-right">
                    <p className="text-sm font-semibold text-slate-800">{p.quantity}</p>
                    <p className="text-xs text-slate-500">kg</p>
                  </div>

                  {/* Column 7: Product verify (ONLY QR code button) */}
                  <div className="col-span-1 text-center flex justify-center">
                    <button
                      onClick={() => setSelectedProductQR(p)}
                      className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-200 shrink-0 cursor-pointer"
                      title="Verify Product QR Code"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary footer */}
      {filtered.length > 0 && (
        <p className="text-center text-xs text-slate-500">
          Showing {filtered.length} of {products.length} products
        </p>
      )}

      {/* QR Code Modal */}
      {selectedProductQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-white/10">
              <h3 className="font-semibold">Product Verification QR Code</h3>
              <button
                onClick={() => setSelectedProductQR(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center justify-center space-y-4">
              <div className="bg-white p-4 rounded-xl shadow-lg">
                <QRCodeSVG
                  value={`${window.location.origin}/track?id=${format6DigitId(selectedProductQR.product_id)}`}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div className="text-center mt-4">
                <p className="font-semibold text-lg text-white">{selectedProductQR.name}</p>
                <p className="text-sm font-mono text-emerald-400 font-bold mt-1">Product ID: {format6DigitId(selectedProductQR.product_id)}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Batch: {selectedProductQR.batch_number}</p>
                <p className="text-xs text-slate-500 mt-4">Scan or enter 6-digit ID to verify product journey</p>
              </div>
            </div>
            <div className="p-4 border-t border-white/10 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedProductQR(null)}
              >
                Close
              </Button>
              <Button
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                onClick={() => window.open(`/track?id=${format6DigitId(selectedProductQR.product_id)}`, "_blank")}
              >
                Open Verifier
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
