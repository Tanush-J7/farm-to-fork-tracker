import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Search, Filter, AlertCircle, Package, Clock, ShieldAlert, RefreshCw, ArrowRight, CheckCircle2, QrCode, Download, Printer, Copy, Check, ExternalLink, X } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { Link } from "react-router-dom"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function Inventory() {
  const { token } = useAuth()
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [selectedItemForQR, setSelectedItemForQR] = useState<any | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const handleDownloadQR = (batchNum: string) => {
    const canvas = document.getElementById("consumer-qr-canvas") as HTMLCanvasElement
    if (!canvas) return
    const pngUrl = canvas.toDataURL("image/png")
    const downloadLink = document.createElement("a")
    downloadLink.href = pngUrl
    downloadLink.download = `FarmChain-ConsumerQR-${batchNum}.png`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }

  const handlePrintLabel = () => {
    window.print()
  }

  const handleCopyLink = (batchNum: string) => {
    const url = `${window.location.origin}/?batch=${batchNum}#consumer-scanner`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const fetchInventory = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }
      setError("")
      const res = await axios.get(`${API_URL}/retailer/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setInventory(res.data.data || [])
    } catch (err: any) {
      if (!silent) setError(err.response?.data?.message || "Failed to load inventory")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchInventory(false)
    const interval = setInterval(() => fetchInventory(true), 15000)

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        fetchInventory(true)
      }
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("visibilitychange", handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("visibilitychange", handleFocus)
    }
  }, [token])

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { text: 'Fresh / No Expiry', color: 'text-slate-600 bg-slate-100 border-slate-200' }
    
    const today = new Date()
    const exp = new Date(expiryDate)
    const diffTime = exp.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { text: 'Expired', color: 'text-rose-700 bg-rose-100 border-rose-200', icon: ShieldAlert }
    if (diffDays <= 7) return { text: `Expires in ${diffDays} days`, color: 'text-amber-700 bg-amber-100 border-amber-200', icon: AlertCircle }
    return { text: `Good (${diffDays} days)`, color: 'text-emerald-700 bg-emerald-100 border-emerald-200', icon: Clock }
  }

  // Derived unique categories for filter
  const categories = Array.from(new Set(inventory.map(item => item.product?.category || item.category).filter(Boolean)))

  const filteredInventory = inventory.filter(item => {
    const pName = (item.product?.name || item.product_name || item.name || '').toLowerCase()
    const bNum = (item.batch_number || '').toLowerCase()
    const sTerm = searchTerm.toLowerCase()
    const matchesSearch = !searchTerm || pName.includes(sTerm) || bNum.includes(sTerm)
    const itemCat = item.product?.category || item.category || ''
    const matchesCategory = categoryFilter ? itemCat === categoryFilter : true
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Current Store Inventory</h1>
          <p className="text-sm text-slate-500">Live store stock levels, blockchain provenance, and FEFO expiry tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchInventory(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-emerald-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh Stock'}</span>
          </button>
          <Link
            to="/retailer/shipments"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm shadow-emerald-600/20"
          >
            <span>Scan Incoming Delivery</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by product or batch..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white"
            />
          </div>
          <div className="w-full sm:w-auto flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && inventory.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-3" />
            <p className="font-medium">Loading store inventory...</p>
          </div>
        ) : error && inventory.length === 0 ? (
          <div className="p-12 text-center text-rose-500">
            <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        ) : inventory.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="h-16 w-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No inventory in stock yet</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6">
              When distributors deliver your cargo, scan their Delivery QR on the Incoming Cargo page to verify and accept products into inventory.
            </p>
            <Link
              to="/retailer/shipments"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm"
            >
              Go to Incoming Cargo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : filteredInventory.length === 0 ? (
           <div className="p-12 text-center text-slate-500">No items match your filters.</div>
        ) : (
          <>
            {/* Desktop Table View (Hidden on mobile; identical on desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Product</th>
                    <th className="px-6 py-4 font-semibold">Batch Number</th>
                    <th className="px-6 py-4 font-semibold text-right">Available Stock</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                    <th className="px-6 py-4 font-semibold text-center">Expiry Status</th>
                    <th className="px-6 py-4 font-semibold text-center">Consumer QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInventory.map(item => {
                    const expiry = getExpiryStatus(item.expiry_date)
                    const Icon = expiry.icon
                    const productName = item.product?.name || item.product_name || item.name || (item.batch_number ? `Batch #${item.batch_number}` : "Fresh Produce")
                    const categoryName = item.product?.category || item.category || 'Produce'

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 overflow-hidden shrink-0 flex items-center justify-center">
                              {item.product?.product_image_url ? (
                                <img src={item.product.product_image_url} alt={productName} className="h-full w-full object-cover" />
                              ) : (
                                <Package className="h-5 w-5 text-emerald-600" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 capitalize text-base">{productName}</div>
                              <div className="text-xs font-medium text-slate-400 capitalize">{categoryName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            {item.batch_number}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-extrabold text-lg text-emerald-700">
                            {item.quantity} <span className="text-xs font-semibold text-slate-500 uppercase">{item.unit || 'kg'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            {item.status || 'AVAILABLE'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${expiry.color}`}>
                            {Icon && <Icon className="h-3.5 w-3.5" />}
                            {expiry.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedItemForQR(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                            title="Generate shelf display QR code for consumers"
                          >
                            <QrCode className="h-4 w-4 text-emerald-600" />
                            <span>Consumer QR</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (Visible on mobile screens < md) */}
            <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredInventory.map(item => {
                const expiry = getExpiryStatus(item.expiry_date)
                const Icon = expiry.icon
                const productName = item.product?.name || item.product_name || item.name || (item.batch_number ? `Batch #${item.batch_number}` : "Fresh Produce")
                const categoryName = item.product?.category || item.category || 'Produce'

                return (
                  <div key={item.id} className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {item.product?.product_image_url ? (
                            <img src={item.product.product_image_url} alt={productName} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-emerald-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm capitalize truncate">{productName}</div>
                          <div className="text-[11px] text-slate-500 capitalize">{categoryName}</div>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                        {item.batch_number}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">In Stock</span>
                        <div className="font-black text-base text-emerald-700">
                          {item.quantity} <span className="text-xs font-semibold text-slate-500 uppercase">{item.unit || 'kg'}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${expiry.color}`}>
                          {Icon && <Icon className="h-3 w-3" />}
                          {expiry.text}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedItemForQR(item)}
                      className="w-full mt-2.5 py-2 px-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <QrCode className="h-4 w-4 text-emerald-600" />
                      <span>Generate Consumer Shelf QR</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>


      {/* Consumer QR & Shelf Label Modal */}
      {selectedItemForQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Consumer QR & Shelf Tag</h3>
                  <p className="text-xs text-slate-500">
                    Point of sale traceability for batch #{selectedItemForQR.batch_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForQR(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Printable Shelf Tag Preview */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Shelf Tag Card */}
              <div
                id="printable-shelf-tag"
                className="rounded-2xl border-2 border-dashed border-emerald-300 bg-gradient-to-b from-emerald-50/30 to-white p-5 text-center space-y-4 shadow-sm"
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold uppercase tracking-wide">
                  <span>🌿</span> FarmChain 100% Verified
                </div>

                <div>
                  <h4 className="text-2xl font-black text-slate-900 capitalize">
                    {selectedItemForQR.product?.name || selectedItemForQR.product_name || selectedItemForQR.name || "Fresh Produce"}
                  </h4>
                  <div className="text-xs text-slate-500 font-medium">
                    Batch: <span className="font-mono font-bold text-slate-800">{selectedItemForQR.batch_number}</span>
                  </div>
                </div>

                {/* QR Canvas */}
                <div className="inline-block p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <QRCodeCanvas
                    id="consumer-qr-canvas"
                    value={`${window.location.origin}/?batch=${selectedItemForQR.batch_number}#consumer-scanner`}
                    size={190}
                    level="H"
                    includeMargin={true}
                  />
                  <p className="text-[10px] font-mono text-slate-400 mt-1 font-semibold uppercase">
                    Scan for full traceability
                  </p>
                </div>

                {/* Info Row on Shelf Label */}
                <div className="grid grid-cols-2 gap-2 text-left bg-white p-3 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Store Stock</span>
                    <span className="font-bold text-slate-800">
                      {selectedItemForQR.quantity} {selectedItemForQR.unit || "kg"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Freshness</span>
                    <span className="font-bold text-emerald-700">
                      {getExpiryStatus(selectedItemForQR.expiry_date).text}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  Consumers scan this code with their smartphone camera in-store to view the verified harvest date, farmer profile, transit logistics logs, and expiry.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleDownloadQR(selectedItemForQR.batch_number)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4 text-emerald-600" />
                  <span>Download QR</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintLabel}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-blue-600" />
                  <span>Print Tag</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyLink(selectedItemForQR.batch_number)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-purple-600" />}
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>

                <a
                  href={`/?batch=${selectedItemForQR.batch_number}#consumer-scanner`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold gap-1.5 transition-colors cursor-pointer text-center"
                >
                  <ExternalLink className="h-4 w-4 text-emerald-600" />
                  <span>Test View</span>
                </a>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedItemForQR(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
