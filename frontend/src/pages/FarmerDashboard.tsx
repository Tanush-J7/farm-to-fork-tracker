import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "../components/ui/Button"
import {
  Leaf, Plus, X, CheckCircle2, Clock, Truck, Factory,
  ShoppingBag, AlertCircle, RefreshCw, Wheat, Star, ImagePlus, CalendarDays, Wand2, Trash2, QrCode, Printer, Download,
  Bell, PackageCheck, Check
} from "lucide-react"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export interface FarmerNotification {
  id: string
  type: "processor_interest" | "processor_accepted" | "processor_rejected"
  productId: string
  batchNumber: string
  productName: string
  quantity: number
  processorName: string
  date: string
  time: string
  timestamp: number
  read: boolean
  message: string
}

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
  Harvested:          { color: "text-green-400",  bg: "bg-green-400/10 border-green-400/30",   icon: Leaf,        label: "Harvested"   },
  Processing:         { color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/30",     icon: Factory,     label: "Processing"  },
  "In Transit":       { color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30", icon: Truck,       label: "In Transit"  },
  Delivered:          { color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30", icon: ShoppingBag, label: "Delivered"   },
  Sold:               { color: "text-pink-400",   bg: "bg-pink-400/10 border-pink-400/30",     icon: CheckCircle2, label: "Sold"       },
  "Pending Approval": { color: "text-slate-400",  bg: "bg-slate-400/10 border-slate-400/30",   icon: Clock,       label: "Pending Approval" },
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

  // Notification state
  const [notifications, setNotifications] = useState<FarmerNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // Deal Status State: { [productId: string]: "requested" | "accepted" | "dispatched" | "declined" }
  const [deals, setDeals] = useState<Record<string, "requested" | "accepted" | "dispatched" | "declined">>({})
  const [decisions, setDecisions] = useState<Record<string, { decision: "Accepted" | "Rejected"; reason?: string; date: string; time: string }>>({})

  const headers = { Authorization: `Bearer ${token}` }

  // Load Farmer Notifications from storage
  const loadNotifications = useCallback(() => {
    try {
      const stored: FarmerNotification[] = JSON.parse(localStorage.getItem("farmer_notifications") || "[]")
      setNotifications(stored)
    } catch {
      setNotifications([])
    }
  }, [])

  // Load Deal Statuses
  const loadDeals = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("farmer_deals") || "{}")
      setDeals(stored)
    } catch {
      setDeals({})
    }
  }, [])

  // Load Processor Intake Decisions
  const loadDecisions = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("processor_decisions") || "{}")
      setDecisions(stored)
    } catch {
      setDecisions({})
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    loadDeals()
    loadDecisions()
    const handleUpdate = () => {
      loadNotifications()
      loadDeals()
      loadDecisions()
      fetchProducts()
    }
    window.addEventListener("farmer_notifications_updated", handleUpdate)
    window.addEventListener("farmer_deals_updated", handleUpdate)
    window.addEventListener("storage", handleUpdate)
    return () => {
      window.removeEventListener("farmer_notifications_updated", handleUpdate)
      window.removeEventListener("farmer_deals_updated", handleUpdate)
      window.removeEventListener("storage", handleUpdate)
    }
  }, [loadNotifications, loadDeals, loadDecisions])

  // Handlers for Farmer Deal Lifecycle
  const handleAcceptDeal = (productId: string, batchNumber: string) => {
    const updated = { ...deals, [productId]: "accepted", [batchNumber]: "accepted" }
    setDeals(updated as any)
    localStorage.setItem("farmer_deals", JSON.stringify(updated))
    window.dispatchEvent(new Event("farmer_deals_updated"))
    window.dispatchEvent(new Event("farmer_notifications_updated"))
  }

  const handleMarkReadyForDispatch = async (productId: string, batchNumber: string) => {
    const updated = { ...deals, [productId]: "dispatched", [batchNumber]: "dispatched" }
    setDeals(updated as any)
    localStorage.setItem("farmer_deals", JSON.stringify(updated))
    
    try {
      await axios.put(`${API}/products/${productId}/status`, { status: "In Transit" }, { headers })
      setProducts(prev => prev.map(p => (p._id === productId || p.batchNumber === batchNumber) ? { ...p, status: "In Transit" } : p))
    } catch (e) {
      console.warn("Could not sync in-transit status", e)
    }

    window.dispatchEvent(new Event("farmer_deals_updated"))
    window.dispatchEvent(new Event("farmer_notifications_updated"))
  }

  const handleDeclineDeal = async (productId: string, batchNumber: string) => {
    if (!window.confirm("Decline this processor request? The produce will be returned to open market for other processors.")) return

    const updated = { ...deals, [productId]: "declined", [batchNumber]: "declined" }
    setDeals(updated as any)
    localStorage.setItem("farmer_deals", JSON.stringify(updated))

    // Record declined status in processor_declined_products map
    try {
      const declinedMap = JSON.parse(localStorage.getItem("processor_declined_products") || "{}")
      declinedMap[productId] = true
      declinedMap[batchNumber] = true
      localStorage.setItem("processor_declined_products", JSON.stringify(declinedMap))
    } catch (e) {
      console.warn("Could not save declined product mapping", e)
    }

    try {
      await axios.put(`${API}/products/${productId}/status`, { status: "Harvested" }, { headers })
      setProducts(prev => prev.map(p => (p._id === productId || p.batchNumber === batchNumber) ? { ...p, status: "Harvested" } : p))
    } catch (e) {
      console.warn("Could not reset status to Harvested", e)
    }

    window.dispatchEvent(new Event("farmer_deals_updated"))
    window.dispatchEvent(new Event("farmer_notifications_updated"))
  }

  // Notification Helpers
  const markAsRead = (id: string) => {
    const updated = notifications.map(n => (n.id === id ? { ...n, read: true } : n))
    setNotifications(updated)
    localStorage.setItem("farmer_notifications", JSON.stringify(updated))
  }

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }))
    setNotifications(updated)
    localStorage.setItem("farmer_notifications", JSON.stringify(updated))
  }

  const clearAllNotifications = () => {
    setNotifications([])
    localStorage.setItem("farmer_notifications", JSON.stringify([]))
  }

  const unreadCount = notifications.filter(n => !n.read).length

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
      
      // Automatic Expiry Filter:
      // If a product has no processor interest (status is Harvested / Pending Approval)
      // and its expiry date is in the past, it automatically disappears from active listings.
      const isUnclaimedAndExpired = (p: Product) => {
        if (!p.expiryDate) return false
        if (p.status !== "Harvested" && p.status !== "Pending Approval") return false
        const expiryTime = new Date(`${p.expiryDate}T23:59:59`).getTime()
        return !isNaN(expiryTime) && expiryTime < Date.now()
      }

      const activeProducts = rawProducts.filter(p => 
        !deletedSet.has(String(p._id)) && 
        !deletedSet.has(String(p.batchNumber)) &&
        !isUnclaimedAndExpired(p)
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
    const { name, type, value } = e.target
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked
      setForm(f => ({ ...f, [name]: checked }))
    } else if (name === "quantity") {
      if (value === "" || Number(value) >= 0) {
        setForm(f => ({ ...f, [name]: value }))
      }
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.category || !form.quantity || !form.expiryDate) {
      setFormMsg({ type: "error", text: "Please fill in all fields." })
      return
    }

    setSubmitting(true)
    try {
      // Generate unique 6-digit numeric Product ID
      const product_id = Math.floor(100000 + Math.random() * 900000)

      await axios.post(
        `${API}/products`,
        { ...form, quantity: Number(form.quantity), imageData, blockchainHash: null, product_id },
        { headers }
      )

      setFormMsg({ type: "success", text: "✅ Product submitted! Awaiting admin approval." })
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Farmer Portal</h1>
          <p className="text-slate-400 mt-1">Manage your harvest, track processor interests, and monitor your produce through the supply chain.</p>
        </div>

        <div className="flex items-center gap-3 relative">
          {/* Notification Bell Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(prev => !prev)}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-foreground transition-all hover:border-green-500/40 focus:outline-none"
              title="Notifications"
              aria-label="Toggle notifications"
            >
              <Bell className="h-5 w-5 text-slate-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white shadow-lg animate-pulse ring-2 ring-slate-900">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-emerald-400" />
                    <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        Mark all read
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        onClick={clearAllNotifications}
                        className="text-[11px] text-slate-400 hover:text-red-400 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      <Wheat className="h-8 w-8 mx-auto mb-2 text-slate-500/40" />
                      No notifications yet.<br />You will be notified when a processor marks interest.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          n.read
                            ? "bg-white/[0.02] border-white/5 opacity-75"
                            : "bg-emerald-500/10 border-emerald-500/30 shadow-sm"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                            n.type === "processor_accepted" 
                              ? "bg-green-500/20 text-green-400" 
                              : n.type === "processor_rejected" 
                              ? "bg-red-500/20 text-red-400" 
                              : "bg-blue-500/20 text-blue-400"
                          }`}>
                            {n.type === "processor_accepted" ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : n.type === "processor_rejected" ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <Factory className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-semibold text-foreground truncate">
                                {n.type === "processor_interest"
                                  ? "🏢 Processor Expressed Interest"
                                  : n.type === "processor_accepted"
                                  ? "✅ Batch Verified & Accepted"
                                  : "❌ Produce Rejected at Intake"}
                              </p>
                              {!n.read && (
                                <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {n.date} at {n.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Button onClick={openRegistrationForm} className="gap-2">
            <Plus className="h-4 w-4" />
            Register New Harvest
          </Button>
        </div>
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
                      min={f.type === "number" ? "0" : undefined}
                      step={f.type === "number" ? "any" : undefined}
                      onKeyDown={f.type === "number" ? (e) => { if (e.key === "-" || e.key === "e") e.preventDefault() } : undefined}
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

                  {/* Interactive Processor Deal Handshake & Intake Outcome */}
                  {(() => {
                    const decisionRecord = decisions[p._id] || decisions[p.batchNumber] || (p.status === "Rejected by Processor" ? { decision: "Rejected" as const, reason: "Rejected by Processor" } : null)
                    const notif = notifications.find(n => (n.productId === p._id || n.batchNumber === p.batchNumber) && n.type === "processor_interest")
                    const processorName = notif?.processorName || "Processing Facility"

                    // Stage 4: Final Intake Outcomes
                    if (decisionRecord?.decision === "Accepted") {
                      return (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-start gap-2.5 shadow-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-emerald-100">✅ Verified & Accepted on Blockchain</p>
                            <p className="text-[11px] text-emerald-300/80 mt-0.5">{processorName} verified QR certificate and scale weight. Produce has entered the processing line.</p>
                          </div>
                        </div>
                      )
                    }

                    if (decisionRecord?.decision === "Rejected" || p.status === "Rejected by Processor") {
                      return (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-start gap-2.5 shadow-sm">
                          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-red-100">❌ Rejected at Gate Intake by {processorName}</p>
                            <p className="text-[11px] text-red-300/80 mt-0.5 leading-relaxed">
                              Reason: {decisionRecord?.reason || "Intake scale weight or quality verification failed."}. Intake verification failed.
                            </p>
                          </div>
                        </div>
                      )
                    }

                    const isInterested = p.status === "Processing" || p.status === "In Transit" || Boolean(notif)
                    const currentDealState = deals[p._id] || deals[p.batchNumber] || (isInterested ? "requested" : null)

                    if (!isInterested || currentDealState === "declined" || !currentDealState) return null

                    return (
                      <div className="space-y-2 pt-1">
                        {/* Stage 1: Requested -> Needs Farmer Acceptance */}
                        {currentDealState === "requested" && (
                          <div className="space-y-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 shadow-sm">
                            <div className="flex items-start gap-2">
                              <Factory className="h-4 w-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-amber-100">{processorName} expressed interest</p>
                                <p className="text-[11px] text-amber-300/80 mt-0.5">Wants to procure this harvest batch ({p.quantity} kg). Confirm to accept deal.</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                className="flex-1 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm h-8 font-medium"
                                onClick={() => handleAcceptDeal(p._id, p.batchNumber)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Accept Processor Request
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500 rounded-xl h-8 font-medium"
                                onClick={() => handleDeclineDeal(p._id, p.batchNumber)}
                              >
                                <X className="h-3.5 w-3.5" />
                                Decline
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Stage 2: Accepted -> Ready for Dispatch */}
                        {currentDealState === "accepted" && (
                          <div className="space-y-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200 shadow-sm">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-blue-100">Deal Accepted with {processorName}</p>
                                <p className="text-[11px] text-blue-300/80 mt-0.5">Pack and crate harvest, then click below to confirm dispatch readiness.</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="w-full text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-sm h-8 font-medium"
                              onClick={() => handleMarkReadyForDispatch(p._id, p.batchNumber)}
                            >
                              <PackageCheck className="h-4 w-4" />
                              📦 Ready for Dispatch
                            </Button>
                          </div>
                        )}

                        {/* Stage 3: Dispatched & In Transit */}
                        {currentDealState === "dispatched" && (
                          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-center gap-2.5 shadow-sm">
                            <Truck className="h-4 w-4 text-emerald-400 shrink-0 animate-bounce" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-emerald-100">🚚 Dispatched to {processorName}</p>
                              <p className="text-[11px] text-emerald-300/80 truncate">In transit to processing facility. Gate scale intake authorized.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}

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

                  {/* Card Actions: QR Code Certificate */}
                  <div className="pt-3 border-t border-white/10 flex items-center">
                    {p.status !== "Pending Approval" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs gap-1.5 rounded-xl border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500"
                        onClick={() => setSelectedQrProduct(p)}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        View QR Certificate
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
