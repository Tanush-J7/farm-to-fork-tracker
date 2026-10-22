import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { Search, Download, Trash2, Eye, RefreshCw } from "lucide-react"
import { Button } from "../../components/ui/Button"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

interface AdminProduct {
  id: string
  product_id: string
  name: string
  category: string
  batch_number: string
  quantity: string
  status: string
  ai_quality_label: string
  ai_quality_score: number
  created_at: string
  blockchain_hash: string
  farmer?: { name: string }
}

export function AdminProducts() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await axios.get(`${API}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.success) {
        setProducts(res.data.data || [])
      }
    } catch (err) {
      console.error("Failed to fetch products", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [token])

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone.`)) return
    setDeletingId(id)
    try {
      await axios.delete(`${API}/admin/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      await fetchProducts()
    } catch (err: any) {
      try {
        await axios.delete(`${API}/products/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        await fetchProducts()
      } catch (err2: any) {
        alert(err?.response?.data?.message || err2?.response?.data?.message || "Failed to delete product")
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleClearAllProducts = async () => {
    if (!window.confirm("Are you sure you want to delete ALL old products and test records? This will clear the registry completely.")) return
    setClearing(true)
    try {
      const res = await axios.post(`${API}/admin/products/clear-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      alert(res.data?.message || "All old products cleared successfully!")
      await fetchProducts()
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to clear products")
    } finally {
      setClearing(false)
    }
  }

  const handleApproveProduct = async (id: string) => {
    setApprovingId(id)
    try {
      const res = await axios.put(`${API}/admin/products/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.success) {
        // Successfully approved
      }
      await fetchProducts()
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.message || "Failed to approve product. Please try again.")
      await fetchProducts()
    } finally {
      setApprovingId(null)
    }
  }

  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Category", "Batch Number", "Quantity", "Status", "AI Quality", "Created At"]
    const csvContent = [
      headers.join(","),
      ...products.map(p => [
        p.id,
        `"${p.name}"`,
        `"${p.category}"`,
        `"${p.batch_number}"`,
        `"${p.quantity}"`,
        `"${p.status}"`,
        `"${p.ai_quality_label || 'Unknown'}"`,
        new Date(p.created_at).toISOString()
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `farmchain_products_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Supply Chain</h1>
          <p className="text-slate-500 mt-1">Manage all produce batches traversing the blockchain network.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {products.length > 0 && (
            <Button
              variant="outline"
              disabled={clearing}
              onClick={handleClearAllProducts}
              className="gap-2 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>{clearing ? "Clearing..." : "Purge Old Products"}</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={fetchProducts}
            disabled={loading}
            className="gap-2 text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer"
            title="Refresh product list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="gap-2 border-emerald-200 text-emerald-800 hover:bg-emerald-50 cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      <Card className="border-emerald-100 shadow-xs rounded-3xl overflow-hidden bg-white">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-100 bg-emerald-50/30">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">Product Registry</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Total active harvest batches: <strong>{products.length}</strong>
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
            <input 
              type="text" 
              placeholder="Search by name, category, batch..." 
              className="w-full bg-white border border-emerald-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-emerald-50/10">
              <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2" />
              Loading products...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-emerald-50/60 uppercase font-extrabold text-[10px] text-emerald-900 tracking-wider">
                  <tr className="border-b border-emerald-100">
                    <th className="py-3.5 px-4 text-left">Product</th>
                    <th className="py-3.5 px-4 text-left">Category</th>
                    <th className="py-3.5 px-4 text-left">Batch Number</th>
                    <th className="py-3.5 px-4 text-left">Status</th>
                    <th className="py-3.5 px-4 text-left">AI Quality</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400">
                        No products found in registry. When farmers register new harvests, they will appear here.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => (
                      <tr key={p.id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="p-4 font-bold text-slate-900 capitalize text-sm">{p.name}</td>
                        <td className="p-4 text-slate-600 font-medium">{p.category}</td>
                        <td className="p-4 font-mono font-bold text-emerald-800">{p.batch_number}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border
                            ${p.status === "Pending Approval" ? "bg-amber-100 text-amber-800 border-amber-300" : 
                              p.status === "Harvested" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : 
                              "bg-blue-100 text-blue-800 border-blue-300"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`font-bold inline-flex items-center gap-1 ${p.ai_quality_label === 'Poor' ? 'text-rose-600' : p.ai_quality_label === 'Excellent' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {p.ai_quality_label || 'Unknown'} 
                            {p.ai_quality_score > 0 && <span className="text-[10px] text-slate-500 font-normal">({(p.ai_quality_score * 100).toFixed(0)}%)</span>}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.status === "Pending Approval" && (
                              <Button
                                size="sm"
                                disabled={approvingId === p.id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs mr-1 cursor-pointer"
                                onClick={() => handleApproveProduct(p.id)}
                              >
                                {approvingId === p.id ? "Approving..." : "Approve"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate('/admin/products/' + p.id)}
                              className="text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl cursor-pointer"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={deletingId === p.id}
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                              title="Delete product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
