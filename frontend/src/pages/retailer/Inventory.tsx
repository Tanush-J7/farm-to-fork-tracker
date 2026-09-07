import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Search, Filter, AlertCircle, Package, Clock, ShieldAlert } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function Inventory() {
  const { token } = useAuth()
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true)
        const res = await axios.get(`${API_URL}/retailer/inventory`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setInventory(res.data.data || [])
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load inventory")
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchInventory()
  }, [token])

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { text: 'No Expiry', color: 'text-slate-500 bg-slate-100 border-slate-200' }
    
    const today = new Date()
    const exp = new Date(expiryDate)
    const diffTime = exp.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { text: 'Expired', color: 'text-rose-700 bg-rose-100 border-rose-200', icon: ShieldAlert }
    if (diffDays <= 7) return { text: `Expires in ${diffDays} days`, color: 'text-amber-700 bg-amber-100 border-amber-200', icon: AlertCircle }
    return { text: `Good (${diffDays} days)`, color: 'text-emerald-700 bg-emerald-100 border-emerald-200', icon: Clock }
  }

  // Derived unique categories for filter
  const categories = Array.from(new Set(inventory.map(item => item.product?.category).filter(Boolean)))

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || item.batch_number.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter ? item.product?.category === categoryFilter : true
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Current Inventory</h1>
          <p className="text-sm text-slate-500">Manage your stock levels and monitor expiration dates.</p>
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
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
          <div className="p-12 text-center text-slate-500">Loading inventory...</div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500">{error}</div>
        ) : inventory.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Package className="h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-lg font-medium text-slate-900">No inventory yet</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">Receive products via QR scan to populate your inventory.</p>
          </div>
        ) : filteredInventory.length === 0 ? (
           <div className="p-12 text-center text-slate-500">No items match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Product</th>
                  <th className="px-6 py-4 font-semibold">Batch Number</th>
                  <th className="px-6 py-4 font-semibold text-right">Stock Level</th>
                  <th className="px-6 py-4 font-semibold text-center">Expiry Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInventory.map(item => {
                  const expiry = getExpiryStatus(item.expiry_date)
                  const Icon = expiry.icon
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {item.product?.product_image_url ? (
                              <img src={item.product.product_image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{item.product?.name || "Unknown Product"}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{item.product?.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {item.batch_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-bold text-lg text-emerald-700">{item.quantity} <span className="text-sm font-medium text-slate-500">{item.unit}</span></div>
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
        )}
      </div>
    </div>
  )
}
