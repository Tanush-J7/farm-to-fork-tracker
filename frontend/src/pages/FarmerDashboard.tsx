import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "../components/ui/Button"
import {
  Leaf, Plus, X, CheckCircle2, Clock, Truck, Factory,
  ShoppingBag, AlertCircle, RefreshCw, Wheat, Star, ImagePlus, CalendarDays, Wand2, Trash2, QrCode, Printer, Download
} from "lucide-react"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"
import axios from "axios"
import { useBlockchain } from "../hooks/useBlockchain"
import { useAuth } from "../context/AuthContext"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

const generateBatchNumber = () => {
  const date = new Date()
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `BCH-${datePart}-${randomPart}`
}

const createProductForm = () => ({
  name: "",
  category: "",
  quantity: "",
  batchNumber: generateBatchNumber(),
  expiryDate: "",
  organicStatus: true,
})

// Status config
const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  Harvested:   { color: "text-green-400",  bg: "bg-green-400/10 border-green-400/30",   icon: Leaf,        label: "Harvested"   },
  Processing:  { color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/30",     icon: Factory,     label: "Processing"  },
  "In Transit":{ color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30", icon: Truck,       label: "In Transit"  },
  Delivered:   { color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30", icon: ShoppingBag, label: "Delivered"   },
  Sold:        { color: "text-pink-400",   bg: "bg-pink-400/10 border-pink-400/30",     icon: CheckCircle2, label: "Sold"       },
}

const QUALITY_COLOR: Record<string, string> = {
  Excellent: "text-green-400",
  Good:      "text-lime-400",
  Average:   "text-yellow-400",
  Poor:      "text-red-400",
  Unknown:   "text-slate-400",
}

interface Product {
  _id: string
  name: string
  category: string
  batchNumber: string
  quantity: number
  status: string
  aiQualityLabel: string
  aiQualityScore: number
  organicStatus: boolean
  expiryDate?: string
  productImageUrl?: string
  createdAt: string
}

const normaliseProduct = (product: any): Product => ({
  _id: product._id || product.id,
  name: product.name,
  category: product.category,
  batchNumber: product.batchNumber || product.batch_number || "",
  quantity: Number(product.quantity || 0),
  status: product.status,
  aiQualityLabel: product.aiQualityLabel || product.ai_quality_label || "Unknown",
  aiQualityScore: Number(product.aiQualityScore ?? product.ai_quality_score ?? 0),
  organicStatus: Boolean(product.organicStatus ?? product.organic_status),
  expiryDate: product.expiryDate || product.expiry_date || undefined,
  productImageUrl: product.productImageUrl || product.product_image_url || undefined,
  createdAt: product.createdAt || product.created_at,
})

export function FarmerDashboard() {
  const { token } = useAuth()
  const { registerProductOnChain, isConnected } = useBlockchain()

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(createProductForm)
  const [imageData, setImageData] = useState("")
  const [imagePreview, setImagePreview] = useState("")
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Products state
  const [products, setProducts] = useState<Product[]>([])
  const [selectedQrProduct, setSelectedQrProduct] = useState<Product | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productError, setProductError] = useState("")

  const headers = { Authorization: `Bearer ${token}` }

  // Fetch farmer's own products
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    setProductError("")
    try {
      const res = await axios.get(`${API}/products/my`, { headers })
      const rawProducts: Product[] = (res.data.data || []).map(normaliseProduct)
      
      // Filter out permanently deleted products
      let deletedIds: string[] = []
      try {
        deletedIds = JSON.parse(localStorage.getItem("farmer_deleted_products") || "[]")
      } catch {
        deletedIds = []
      }
      const deletedSet = new Set(deletedIds.map(String))
      
      const activeProducts = rawProducts.filter(p => 
        !deletedSet.has(String(p._id)) && 
        !deletedSet.has(String(p.batchNumber))
      )
      setProducts(activeProducts)
    } catch {
      setProductError("Could not load products. Make sure the backend is running.")
    } finally {
      setLoadingProducts(false)
    }
  }, [token])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value
    setForm(f => ({ ...f, [e.target.name]: val }))
  }

  const openRegistrationForm = () => {
    setForm(createProductForm())
    setImageData("")
    setImagePreview("")
    setFormMsg(null)
    setShowForm(true)
  }

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFormMsg({ type: "error", text: "Upload a JPEG, PNG, or WebP product photo." })
      event.target.value = ""
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormMsg({ type: "error", text: "Product photos must be 5 MB or smaller." })
      event.target.value = ""
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : ""
      setImageData(dataUrl)
      setImagePreview(dataUrl)
      setFormMsg(null)
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = () => {
    setImageData("")
    setImagePreview("")
    if (photoInputRef.current) photoInputRef.current.value = ""
    setFormMsg(null)
  }

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to remove / log farm loss for "${product.name}"?`)) return
    
    // 1. Persist deletion immediately so it never reappears on page refresh
    try {
      const existing: string[] = JSON.parse(localStorage.getItem("farmer_deleted_products") || "[]")
      const updated = Array.from(new Set([...existing, String(product._id), String(product.batchNumber)]))
      localStorage.setItem("farmer_deleted_products", JSON.stringify(updated))
    } catch (e) {
      console.warn("Could not save deleted item to localStorage", e)
    }

    // 2. Remove immediately from current React state
    setProducts(prev => prev.filter(p => p._id !== product._id && p.batchNumber !== product.batchNumber))

    // 3. Send DELETE to backend database
    try {
      await axios.delete(`${API}/products/${product._id}`, { headers })
    } catch (err) {
      console.warn("Backend delete sync notice:", err)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.category || !form.quantity || !form.expiryDate) {
      setFormMsg({ type: "error", text: "Please fill in all fields." })
      return
    }

    setSubmitting(true)
    try {
      // Attempt on-chain registration if wallet is connected
      let blockchainHash: string | null = null
      let product_id = 0

      // Generate unique 6-digit numeric Product ID
      const unique6DigitId = Math.floor(100000 + Math.random() * 900000)

      if (isConnected) {
        try {
          const chainResult = await registerProductOnChain(
            form.name, form.category, form.batchNumber, Number(form.quantity), "Harvested"
          )
          if (chainResult) {
            blockchainHash = chainResult.hash
            product_id = chainResult.productId || unique6DigitId
          }
        } catch {
          // blockchain optional – continue without it
        }
      }

      if (!product_id || product_id <= 0) {
        product_id = unique6DigitId
      }

      await axios.post(
        `${API}/products`,
        { ...form, quantity: Number(form.quantity), imageData, blockchainHash, product_id },
        { headers }
      )

      setFormMsg({ type: "success", text: "✅ Product registered! AI analysis complete." })
      setForm(createProductForm())
      setImageData("")
      setImagePreview("")
      setShowForm(false)
      fetchProducts()
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 413) {
        setFormMsg({ type: "error", text: "The active backend has a smaller upload limit. Deploy the latest backend update, or remove the photo and try again." })
      } else {
        const message = axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Registration failed. Check backend is running."
        setFormMsg({ type: "error", text: message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Stats derived from products
  const stats = {
    total: products.length,
    harvested: products.filter(p => p.status === "Harvested").length,
    inTransit: products.filter(p => p.status === "In Transit").length,
    avgQuality: products.length
      ? (products.reduce((s, p) => s + (p.aiQualityScore || 0), 0) / products.length * 100).toFixed(0)
      : 0,
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Farmer Portal</h1>
          <p className="text-slate-400 mt-1">Manage your harvest and track products through the supply chain.</p>
        </div>
        <Button onClick={openRegistrationForm} className="gap-2">
          <Plus className="h-4 w-4" />
          Register New Harvest
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Batches", value: stats.total, icon: Wheat, color: "text-green-400" },
          { label: "Harvested", value: stats.harvested, icon: Leaf, color: "text-lime-400" },
          { label: "In Transit", value: stats.inTransit, icon: Truck, color: "text-yellow-400" },
          { label: "Avg Quality", value: `${stats.avgQuality}%`, icon: Star, color: "text-purple-400" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-white/5 ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Register Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6">
          <div className="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain scroll-smooth rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-emerald-100 pb-4 sm:mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Register New Harvest</h2>
                <p className="text-sm text-slate-400 mt-0.5">AI analysis will run automatically on submission.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-primary transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Product Name", name: "name", placeholder: "e.g. Organic Tomatoes" },
                  { label: "Category", name: "category", placeholder: "e.g. Vegetables" },
                  { label: "Quantity (kg)", name: "quantity", placeholder: "500", type: "number" },
                  { label: "Expiry Date", name: "expiryDate", placeholder: "", type: "date" },
                  { label: "Batch Number", name: "batchNumber", placeholder: "", readOnly: true },
                ].map(f => (
                  <div key={f.name} className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">{f.label}</label>
                    <input
                      type={f.type || "text"}
                      name={f.name}
                      value={(form as any)[f.name]}
                      onChange={handleFormChange}
                      placeholder={f.placeholder}
                      readOnly={f.readOnly}
                      className="flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <label htmlFor="productPhoto" className="text-sm font-medium text-foreground">Product Photo</label>
                    <p className="text-xs text-slate-400 mt-0.5">JPEG, PNG, or WebP up to 5 MB.</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-primary border border-emerald-100">
                    <Wand2 className="h-3 w-3" /> AI ready
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <label htmlFor="productPhoto" className="flex min-h-20 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-white px-4 py-4 text-sm font-medium text-primary hover:bg-emerald-50 transition-colors">
                    <ImagePlus className="h-5 w-5" />
                    {imagePreview ? "Choose another photo" : "Upload product photo"}
                  </label>
                  <input ref={photoInputRef} id="productPhoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="sr-only" />
                  {imagePreview && (
                    <div className="relative h-20 w-full sm:w-28 shrink-0">
                      <img src={imagePreview} alt="Product preview" className="h-20 w-full rounded-xl border border-emerald-100 object-cover" />
                      <button type="button" onClick={removePhoto} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-100 bg-white text-red-500 shadow-sm hover:bg-red-50" aria-label="Remove uploaded photo">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs text-primary">
                <CalendarDays className="h-4 w-4" />
                Expiry date is required for shelf-life tracking.
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <input
                  type="checkbox"
                  id="organicStatus"
                  name="organicStatus"
                  checked={form.organicStatus}
                  onChange={handleFormChange}
                  className="h-4 w-4 accent-green-500"
                />
                <label htmlFor="organicStatus" className="text-sm text-slate-300">
                  Certified Organic Product
                </label>
              </div>

              {formMsg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border ${
                  formMsg.type === "success"
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                  {formMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  {formMsg.text}
                </div>
              )}

              <p className="text-xs text-green-400 flex items-center gap-1">
                <Wand2 className="h-3.5 w-3.5" />
                Wallet-less registration: The system will automatically secure this product on the blockchain for you!
              </p>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Processing..." : "Run AI & Register"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* My Products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">My Products</h2>
          <button
            onClick={fetchProducts}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {loadingProducts ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
          </div>
        ) : productError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center rounded-2xl border border-red-500/20 bg-red-500/5">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-red-400 text-sm">{productError}</p>
            <Button variant="outline" onClick={fetchProducts} className="mt-1 text-sm">Retry</Button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border border-white/10 bg-white/5">
            <div className="p-4 rounded-2xl bg-green-500/10">
              <Leaf className="h-8 w-8 text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">No products yet</p>
              <p className="text-slate-400 text-sm mt-1">Register your first harvest to get started.</p>
            </div>
            <Button onClick={openRegistrationForm} className="gap-2">
              <Plus className="h-4 w-4" /> Register Now
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map(p => {
              const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG["Harvested"]
              const StatusIcon = sc.icon
              const qColor = QUALITY_COLOR[p.aiQualityLabel] || QUALITY_COLOR["Unknown"]
              const date = new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

              return (
                <div key={p._id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-4 hover:border-green-500/30 transition-all duration-200 group">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{p.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{p.category} · {p.batchNumber}</p>
                    </div>
                    {p.organicStatus && (
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-medium">
                        Organic
                      </span>
                    )}
                  </div>

                  {p.productImageUrl && <img src={p.productImageUrl} alt={p.name} className="h-28 w-full rounded-xl border border-emerald-100 object-cover" />}

                  {/* Status */}
                  <div className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${sc.bg} ${sc.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {sc.label}
                  </div>

                  {/* AI Quality */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <div>
                      <p className="text-xs text-slate-500">AI Quality</p>
                      <p className={`text-sm font-semibold ${qColor}`}>
                        {p.aiQualityLabel}
                        {p.aiQualityScore > 0 && (
                          <span className="text-xs font-normal text-slate-400 ml-1">
                            ({(p.aiQualityScore * 100).toFixed(0)}%)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Quantity</p>
                      <p className="text-sm font-semibold text-foreground">{p.quantity} kg</p>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    Registered on {date}
                  </div>
                  {p.expiryDate && (
                    <div className="flex items-center gap-1.5 text-xs text-primary">
                      <CalendarDays className="h-3 w-3" />
                      Expires {new Date(`${p.expiryDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  )}

                  {/* Card Actions: QR Code & Farm Loss (Locked once processor expresses interest) */}
                  <div className="pt-3 border-t border-white/10 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs gap-1.5 rounded-xl border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500"
                      onClick={() => setSelectedQrProduct(p)}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      View QR
                    </Button>
                    {p.status === "Harvested" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:text-red-300"
                        onClick={() => handleDeleteProduct(p)}
                        title="Delete / Record Farm Loss"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Farm Loss
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* QR Code Certificate Modal */}
      {selectedQrProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-5 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                Product QR Certificate
              </h3>
              <button
                onClick={() => setSelectedQrProduct(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Offscreen Canvas used for high-res crisp PNG export */}
            <div style={{ position: "fixed", left: "-9999px", top: "-9999px", pointerEvents: "none" }}>
              <QRCodeCanvas
                id="farmer-qr-canvas"
                value={`${window.location.origin}/tracker?id=${selectedQrProduct._id}`}
                size={400}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
                includeMargin={true}
                marginSize={4}
              />
            </div>

            <div className="p-4 bg-white rounded-2xl flex flex-col items-center justify-center shadow-inner mx-auto w-fit">
              <QRCodeSVG
                value={`${window.location.origin}/tracker?id=${selectedQrProduct._id}`}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-bold text-base text-foreground">{selectedQrProduct.name}</p>
              <p className="text-slate-400 font-mono">Batch: {selectedQrProduct.batchNumber}</p>
              <p className="text-slate-400">Qty: {selectedQrProduct.quantity} kg • {selectedQrProduct.category}</p>
              <p className="text-emerald-400 font-semibold pt-1">
                Scan with camera or upload image to trace on blockchain
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="w-full rounded-xl text-xs gap-1.5 bg-primary hover:bg-primary/95 text-white font-semibold"
                onClick={() => {
                  const canvas = document.getElementById("farmer-qr-canvas") as HTMLCanvasElement
                  if (!canvas) return
                  const pngUrl = canvas.toDataURL("image/png")
                  const downloadLink = document.createElement("a")
                  downloadLink.href = pngUrl
                  downloadLink.download = `${selectedQrProduct.name.replace(/\s+/g, '_')}_${selectedQrProduct.batchNumber}_QR.png`
                  document.body.appendChild(downloadLink)
                  downloadLink.click()
                  document.body.removeChild(downloadLink)
                }}
              >
                <Download className="h-3.5 w-3.5" /> Download QR Image (PNG)
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl text-xs gap-1.5"
                  onClick={() => window.print()}
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 rounded-xl text-xs text-slate-400 hover:text-white"
                  onClick={() => setSelectedQrProduct(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
