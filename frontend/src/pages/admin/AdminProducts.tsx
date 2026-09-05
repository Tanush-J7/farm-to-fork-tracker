import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { ShieldAlert, Package, Leaf, Search, Download, Trash2, Eye } from "lucide-react"
import { Button } from "../../components/ui/Button"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

interface AdminProduct {
  id: string
  product_id: number
  name: string
  category: string
  batch_number: string
  quantity: number
  status: string
  ai_quality_label: string
  ai_quality_score: number
  blockchain_hash: string
  created_at: string
  farmer: { name: string, email: string }
}

export function AdminProducts() {
  const { token } = useAuth()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [qualityFilter, setQualityFilter] = useState("all")
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null)

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        setProducts(res.data.data)
      }
    } catch (error) {
      console.error("Failed to fetch products", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this product?")) return;
    try {
      await axios.delete(`${API}/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchProducts()
    } catch (error) {
      alert("Failed to delete product")
    }
  }

  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Category", "Batch", "Quantity", "Status", "Quality", "Farmer", "Blockchain Hash"]
    const csvContent = [
      headers.join(","),
      ...products.map(p => [
        p.product_id,
        `"${p.name}"`,
        `"${p.category}"`,
        `"${p.batch_number}"`,
        p.quantity,
        p.status,
        p.ai_quality_label,
        `"${p.farmer?.name || 'Unknown'}"`,
        p.blockchain_hash || "None"
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `farmchain_products_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          String(p.product_id).includes(searchTerm) ||
                          (p.farmer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesQuality = qualityFilter === "all" || p.ai_quality_label === qualityFilter
    return matchesSearch && matchesQuality
  })

  if (loading) return <div className="p-8">Loading products...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Supply Chain</h1>
          <p className="text-muted-foreground">Monitor all product batches moving through the network.</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
          <CardTitle>All Batches ({filteredProducts.length})</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search name, ID, or farmer..."
                className="w-full pl-8 pr-4 py-2 text-sm border rounded-md bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
            >
              <option value="all">All Quality</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Average">Average</option>
              <option value="Poor">Poor</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-slate-50 dark:bg-slate-900 border-b">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">ID / Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Farmer</th>
                  <th className="px-4 py-3">AI Quality</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <div>
                          <div>{p.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">#{p.product_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 uppercase">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">{p.farmer?.name || 'Unknown'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {p.ai_quality_label === 'Poor' ? (
                        <span className="flex items-center gap-1 text-red-500 font-medium">
                          <ShieldAlert className="h-4 w-4" />
                          Poor ({(p.ai_quality_score * 100).toFixed(0)}%)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <Leaf className="h-4 w-4" />
                          {p.ai_quality_label} ({(p.ai_quality_score * 100).toFixed(0)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                       <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedProduct(p)}>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteProduct(p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No products found matching your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedProduct(null)}>
          <div className="bg-background rounded-xl p-6 max-w-md w-full shadow-lg border" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Package className="text-primary"/> Batch Details</h3>
            <div className="space-y-3 text-sm">
              <div><span className="font-semibold text-muted-foreground">Product ID:</span> #{selectedProduct.product_id}</div>
              <div><span className="font-semibold text-muted-foreground">Name:</span> {selectedProduct.name}</div>
              <div><span className="font-semibold text-muted-foreground">Category:</span> {selectedProduct.category}</div>
              <div><span className="font-semibold text-muted-foreground">Batch Number:</span> {selectedProduct.batch_number}</div>
              <div><span className="font-semibold text-muted-foreground">Quantity:</span> {selectedProduct.quantity} kg</div>
              <div><span className="font-semibold text-muted-foreground">Status:</span> {selectedProduct.status}</div>
              <div><span className="font-semibold text-muted-foreground">Quality Score:</span> {selectedProduct.ai_quality_label} ({(selectedProduct.ai_quality_score * 100).toFixed(0)}%)</div>
              <div><span className="font-semibold text-muted-foreground">Farmer:</span> {selectedProduct.farmer?.name}</div>
              <div><span className="font-semibold text-muted-foreground">Registered:</span> {selectedProduct.created_at ? new Date(selectedProduct.created_at).toLocaleString() : 'N/A'}</div>
              <div>
                <span className="font-semibold text-muted-foreground">Blockchain Hash:</span> 
                <div className="font-mono text-xs mt-1 p-2 bg-muted rounded break-all">
                  {selectedProduct.blockchain_hash || "Not yet registered on-chain"}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setSelectedProduct(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
