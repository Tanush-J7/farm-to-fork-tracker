import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { ShieldAlert, Package, Leaf } from "lucide-react"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

interface AdminProduct {
  id: string
  product_id: number
  name: string
  category: string
  status: string
  ai_quality_label: string
  ai_quality_score: number
  farmer: { name: string, email: string }
}

export function AdminProducts() {
  const { token } = useAuth()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) return <div className="p-8">Loading products...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Global Supply Chain</h1>
        <p className="text-muted-foreground">Monitor all product batches moving through the network.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Batches ({products.length})</CardTitle>
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
                  <th className="px-4 py-3 rounded-tr-lg">AI Quality</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
