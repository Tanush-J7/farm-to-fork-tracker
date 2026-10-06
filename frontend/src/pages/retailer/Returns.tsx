import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { AlertCircle, RotateCcw, CheckCircle2, PackagePlus, Trash2 } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function Returns() {
  const { token } = useAuth()
  const [inventory, setInventory] = useState<any[]>([])
  const [returnsList, setReturnsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Form state
  const [selectedItem, setSelectedItem] = useState("")
  const [quantity, setQuantity] = useState<number | "">("")
  const [condition, setCondition] = useState("Good")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  const fetchData = async () => {
    try {
      setLoading(true)
      const [invRes, retRes] = await Promise.all([
        axios.get(`${API_URL}/retailer/inventory`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/retailer/returns`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      
      // Allow returns to any item we've ever sold (in this simple version, we just let them pick from all their known inventory records)
      setInventory(invRes.data.data || [])
      setReturnsList(retRes.data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchData()
  }, [token])

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    setSuccessMsg("")
    try {
      const res = await axios.post(`${API_URL}/retailer/returns`, {
        inventory_id: selectedItem,
        quantity: Number(quantity),
        condition,
        reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const { resolution } = res.data.data
      setSuccessMsg(`Return processed successfully! Status: ${resolution}`)
      
      setSelectedItem("")
      setQuantity("")
      setCondition("Good")
      setReason("")
      fetchData()
      
      setTimeout(() => setSuccessMsg(""), 5000)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to process return")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedItemData = inventory.find(i => i.id === selectedItem)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Returns</h1>
          <p className="text-sm text-slate-500">Process returned items. Good condition items are restocked; damaged items go to wastage.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Returns Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-indigo-50/50">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-indigo-600" /> Process Return
              </h2>
            </div>
            
            <form onSubmit={handleReturn} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-sm border border-rose-200 flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm border border-emerald-200 flex gap-2 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{successMsg}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Select Original Product</label>
                <select 
                  required
                  value={selectedItem}
                  onChange={e => setSelectedItem(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 text-sm bg-white"
                >
                  <option value="">-- Choose product --</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.product?.name} (Batch: {item.batch_number})
                    </option>
                  ))}
                </select>
              </div>

              {selectedItemData && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Batch:</span>
                    <span className="font-mono text-slate-700 font-medium">{selectedItemData.batch_number}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Current Inventory:</span>
                    <span className="font-bold text-slate-700">{selectedItemData.quantity} {selectedItemData.unit}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Quantity Returned</label>
                  <input 
                    type="number" 
                    required
                    min="0.1"
                    step="0.1"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Condition</label>
                  <select 
                    value={condition}
                    onChange={e => setCondition(e.target.value)}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 text-sm font-medium ${condition === 'Damaged' ? 'text-rose-600' : 'text-emerald-600'} bg-white`}
                  >
                    <option value="Good">Good (Restock)</option>
                    <option value="Damaged">Damaged (Wastage)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Customer Reason (Optional)</label>
                <input 
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 text-sm"
                  placeholder="e.g., Wrong item, defective..."
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={!selectedItem || submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                  {submitting ? "Processing..." : "Process Return"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Returns Log */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-900">Returns History</h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-1 rounded-full">{returnsList.length} records</span>
            </div>
            
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-500">Loading history...</div>
              ) : returnsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                  <RotateCcw className="h-10 w-10 text-slate-300 mb-2" />
                  <p>No returns processed yet.</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] text-slate-500 bg-slate-50 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Date</th>
                      <th className="px-6 py-3 font-semibold">Product</th>
                      <th className="px-6 py-3 font-semibold">Qty</th>
                      <th className="px-6 py-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returnsList.map(ret => (
                      <tr key={ret.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 text-slate-500 text-xs">
                          {new Date(ret.return_date).toLocaleString()}
                        </td>
                        <td className="px-6 py-3">
                          <div className="font-medium text-slate-900">{ret.inventory?.product?.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{ret.inventory?.batch_number}</div>
                        </td>
                        <td className="px-6 py-3">
                          <span className="font-bold text-indigo-600">+{ret.quantity}</span> <span className="text-xs text-slate-500">{ret.inventory?.unit}</span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          {ret.condition === 'Good' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded uppercase">
                              <PackagePlus className="h-3 w-3" /> Restocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-1 rounded uppercase">
                              <Trash2 className="h-3 w-3" /> Wasted
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
