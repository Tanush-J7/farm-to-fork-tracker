import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Package, Hash, User, ArrowLeft, CheckCircle } from "lucide-react"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function AdminProductDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchDetails = async () => {
    try {
      const res = await axios.get(`${API}/admin/products/${id}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        setProduct(res.data.data)
      }
    } catch (err) {
      console.error("Failed to fetch product details", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetails()
  }, [id, token])

  const approveProduct = async () => {
    try {
      await axios.put(`${API}/admin/products/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` }})
      fetchDetails()
    } catch (e) {
      alert("Failed to approve product")
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div></div>
  if (!product) return <div className="p-8 text-center text-red-500">Product not found.</div>

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              {product.name}
              <span className={`text-sm font-semibold px-2.5 py-1 rounded-full border ${product.status === "Pending Approval" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-primary/10 text-primary border-primary/20"}`}>
                {product.status}
              </span>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Batch: {product.batch_number} • ID: {product.product_id}</p>
          </div>
        </div>
        {product.status === "Pending Approval" && (
          <Button onClick={approveProduct} className="gap-2 bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-4 w-4" /> Approve Registration
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Product Specifications</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-6">
              {product.product_image_url && (
                <div className="w-full sm:w-1/3 shrink-0">
                  <img src={product.product_image_url} alt={product.name} className="w-full aspect-square object-cover rounded-xl border shadow-sm bg-slate-50 dark:bg-slate-900" />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 flex-1">
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium text-foreground">{product.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Quantity</p>
                  <p className="font-medium text-foreground">{product.quantity} kg</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Organic Status</p>
                  <p className="font-medium text-foreground capitalize">{product.organic_status || 'Conventional'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expiry Date</p>
                  <p className="font-medium text-foreground">
                    {product.expiry_date ? new Date(product.expiry_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">AI Quality Score</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${product.ai_quality_label === 'Poor' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {product.ai_quality_label || 'Unknown'} 
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({product.ai_quality_score ? (product.ai_quality_score * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">AI Predicted Shelf Life</p>
                  <p className="font-medium text-foreground">
                    {product.ai_shelf_life ? `${product.ai_shelf_life} days` : 'Pending'}
                  </p>
                </div>
                <div className="col-span-1 sm:col-span-2 pt-2 border-t mt-2">
                  <p className="text-sm text-muted-foreground">Registered At</p>
                  <p className="font-medium text-foreground text-sm">{new Date(product.created_at).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Hash className="h-5 w-5 text-primary" /> Blockchain Traceability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Transaction Hash</p>
                  {product.blockchain_hash ? (
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border font-mono break-all text-xs text-primary">
                      {product.blockchain_hash}
                    </div>
                  ) : (
                    <p className="text-amber-600 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-200 dark:border-amber-900/30">
                      Not yet registered on-chain. Approving this product will trigger the smart contract registration.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Ownership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Original Farmer</p>
                <p className="font-medium">{product.farmer?.name || 'Unknown'}</p>
                {product.farmer?.email && <p className="text-xs text-muted-foreground">{product.farmer.email}</p>}
                {!product.farmer?.name && <p className="text-xs text-muted-foreground mt-1">ID: {product.farmer_id}</p>}
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">Current Owner</p>
                <p className="font-medium">{product.owner?.name || 'Unknown'}</p>
                {product.owner?.email && <p className="text-xs text-muted-foreground">{product.owner.email}</p>}
                {!product.owner?.name && <p className="text-xs text-muted-foreground mt-1">ID: {product.current_owner_id}</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
