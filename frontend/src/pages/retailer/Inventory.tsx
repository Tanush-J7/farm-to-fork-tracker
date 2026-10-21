import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Search, Filter, AlertCircle, Package, Clock, ShieldAlert, RefreshCw, ArrowRight, CheckCircle2 } from "lucide-react"
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

  const fetchInventory = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true)
      else setLoading(true)
      setError("")
      const res = await axios.get(`${API_URL}/retailer/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setInventory(res.data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load inventory")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (token) fetchInventory()
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

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-3" />
            <p className="font-medium">Loading store inventory...</p>
          </div>
        ) : error ? (
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
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
