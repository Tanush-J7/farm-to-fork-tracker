import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useLocation, useNavigate } from "react-router-dom"
import { Button } from "../components/ui/Button"
import {
  Leaf, Plus, X, CheckCircle2, Clock, Truck, Factory,
  ShoppingBag, AlertCircle, RefreshCw, Wheat, Star, ImagePlus, CalendarDays, Wand2, Trash2, QrCode, Printer, Download,
  Bell, PackageCheck, Check, ShoppingCart, ArrowRight, ShieldCheck, Camera, Sparkles
} from "lucide-react"
import { ProfileManagementSection } from "../components/profile/ProfileManagementSection"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"
import { FarmerSupplyRequestsDesk } from "../components/farmer/FarmerSupplyRequestsDesk"
import { cn } from "../utils"

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

export const CROP_PRESETS = [
  { name: "Organic Tomatoes", category: "Vegetables", shelfDays: 14, icon: "🍅" },
  { name: "Farm Fresh Potatoes", category: "Vegetables", shelfDays: 60, icon: "🥔" },
  { name: "Red Onions", category: "Vegetables", shelfDays: 60, icon: "🧅" },
  { name: "Crisp Apples", category: "Fruits", shelfDays: 21, icon: "🍎" },
  { name: "Golden Wheat", category: "Grains & Cereals", shelfDays: 180, icon: "🌾" },
  { name: "Basmati Rice", category: "Grains & Cereals", shelfDays: 180, icon: "🍚" },
  { name: "Fresh Carrots", category: "Vegetables", shelfDays: 14, icon: "🥕" },
  { name: "Sweet Mangoes", category: "Fruits", shelfDays: 10, icon: "🥭" },
  { name: "Fresh Dairy Milk", category: "Dairy & Poultry", shelfDays: 4, icon: "🥛" },
]

export const addDaysToToday = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

const generateBatchNumber = () => {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `BCH-${num}`
}

const createProductForm = () => ({
  name: "",
  category: "Vegetables",
  quantity: "",
  batchNumber: generateBatchNumber(),
  expiryDate: addDaysToToday(14),
  organicStatus: true,
})

// Status config
const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  Harvested:          { color: "text-emerald-700",  bg: "bg-emerald-50 border-emerald-200",    icon: Leaf,        label: "Harvested"   },
  Accepted:           { color: "text-emerald-800",  bg: "bg-emerald-100/70 border-emerald-300", icon: CheckCircle2, label: "Accepted"   },
  Processing:         { color: "text-blue-700",     bg: "bg-blue-50 border-blue-200",          icon: Factory,     label: "Processing"  },
  "In Transit":       { color: "text-amber-700",    bg: "bg-amber-50 border-amber-200",        icon: Truck,       label: "In Transit"  },
  Delivered:          { color: "text-purple-700",   bg: "bg-purple-50 border-purple-200",      icon: ShoppingBag, label: "Delivered"   },
  Sold:               { color: "text-pink-700",     bg: "bg-pink-50 border-pink-200",          icon: CheckCircle2, label: "Sold"       },
  "Pending Approval": { color: "text-slate-700",    bg: "bg-slate-100 border-slate-200",        icon: Clock,       label: "Pending Approval" },
}

const QUALITY_COLOR: Record<string, string> = {
  Excellent: "text-emerald-600 font-bold",
  Good:      "text-emerald-700 font-semibold",
  Average:   "text-amber-600 font-semibold",
  Poor:      "text-rose-600 font-semibold",
  Unknown:   "text-slate-500",
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
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const currentTab = location.pathname.includes("supply-requests") || searchParams.get("tab") === "supply-requests"
    ? "supply-requests"
    : searchParams.get("tab") === "profile"
    ? "profile"
    : "farm"

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(createProductForm)
  const [imageData, setImageData] = useState("")
  const [imagePreview, setImagePreview] = useState("")
  const photoInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleApplyCropPreset = (preset: typeof CROP_PRESETS[0]) => {
    setForm(prev => ({
      ...prev,
      name: preset.name,
      category: preset.category,
      expiryDate: addDaysToToday(preset.shelfDays),
    }))
  }

  const handleQuickExpiry = (days: number) => {
    setForm(prev => ({
      ...prev,
      expiryDate: addDaysToToday(days),
    }))
  }

  const handleRegenerateBatch = () => {
    setForm(prev => ({
      ...prev,
      batchNumber: generateBatchNumber(),
    }))
  }
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

  // Active procurement orders broadcasted by processors
  const [sourcingOrders, setSourcingOrders] = useState<any[]>([])

  // Deal Status State: { [productId: string]: "requested" | "accepted" | "dispatched" | "declined" }
  const [deals, setDeals] = useState<Record<string, "requested" | "accepted" | "dispatched" | "declined">>({})
  const [decisions, setDecisions] = useState<Record<string, { decision: "Accepted" | "Rejected"; reason?: string; date: string; time: string }>>({})

  const headers = { Authorization: `Bearer ${token}` }

  const fetchSourcingOrders = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/processor/farmer-sourcing`, { headers })
      setSourcingOrders(res.data.data || [])
    } catch {
      setSourcingOrders([])
    }
  }, [token])

  // Cloud Sync for Farmer State across all devices (Mobile & Laptop)
  const syncFarmerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistFarmerState = useCallback((patch: {
    deals?: Record<string, "requested" | "accepted" | "dispatched" | "declined">
    notifications?: FarmerNotification[]
    decisions?: Record<string, any>
    deletedProducts?: string[]
    productLocations?: Record<string, string>
  }) => {
    if (patch.deals !== undefined) {
      setDeals(patch.deals)
      try { localStorage.setItem("farmer_deals", JSON.stringify(patch.deals)) } catch {}
    }
    if (patch.notifications !== undefined) {
      setNotifications(patch.notifications)
      try { localStorage.setItem("farmer_notifications", JSON.stringify(patch.notifications)) } catch {}
    }
    if (patch.decisions !== undefined) {
      setDecisions(patch.decisions)
      try { localStorage.setItem("processor_decisions", JSON.stringify(patch.decisions)) } catch {}
    }
    if (patch.deletedProducts !== undefined) {
      try { localStorage.setItem("farmer_deleted_products", JSON.stringify(patch.deletedProducts)) } catch {}
    }
    if (patch.productLocations !== undefined) {
      try { localStorage.setItem("product_farmer_locations", JSON.stringify(patch.productLocations)) } catch {}
    }

    if (syncFarmerTimeoutRef.current) {
      clearTimeout(syncFarmerTimeoutRef.current)
    }
    syncFarmerTimeoutRef.current = setTimeout(async () => {
      if (!token) return
      try {
        const d = patch.deals ?? JSON.parse(localStorage.getItem("farmer_deals") || "{}")
        const n = patch.notifications ?? JSON.parse(localStorage.getItem("farmer_notifications") || "[]")
        const dec = patch.decisions ?? JSON.parse(localStorage.getItem("processor_decisions") || "{}")
        const del = patch.deletedProducts ?? JSON.parse(localStorage.getItem("farmer_deleted_products") || "[]")
        const loc = patch.productLocations ?? JSON.parse(localStorage.getItem("product_farmer_locations") || "{}")

        await axios.put(`${API}/products/farmer-state`, {
          deals: d,
          notifications: n,
          decisions: dec,
          deletedProducts: del,
          productLocations: loc
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch (err) {
        console.warn("Could not sync farmer state to cloud", err)
      }
    }, 400)
  }, [token])

  const fetchFarmerCloudState = useCallback(async () => {
    if (!token) return
    try {
      const res = await axios.get(`${API}/products/farmer-state`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.success && res.data.data) {
        const cloud = res.data.data
        let localDeals = JSON.parse(localStorage.getItem("farmer_deals") || "{}")
        let localNotifs = JSON.parse(localStorage.getItem("farmer_notifications") || "[]")
        let localDecisions = JSON.parse(localStorage.getItem("processor_decisions") || "{}")
        let localDeleted = JSON.parse(localStorage.getItem("farmer_deleted_products") || "[]")
        let localLocations = JSON.parse(localStorage.getItem("product_farmer_locations") || "{}")

        const mergedDeals = { ...localDeals, ...(cloud.deals || {}) }
        
        const existingNotifIds = new Set(localNotifs.map((n: any) => n.id))
        const newCloudNotifs = (cloud.notifications || []).filter((n: any) => !existingNotifIds.has(n.id))
        const mergedNotifs = [...localNotifs, ...newCloudNotifs]
        
        const mergedDecisions = { ...localDecisions, ...(cloud.decisions || {}) }
        const mergedDeleted = Array.from(new Set([...localDeleted, ...(cloud.deletedProducts || [])]))
        const mergedLocations = { ...localLocations, ...(cloud.productLocations || {}) }

        setDeals(mergedDeals)
        setNotifications(mergedNotifs)
        setDecisions(mergedDecisions)

        try {
          localStorage.setItem("farmer_deals", JSON.stringify(mergedDeals))
          localStorage.setItem("farmer_notifications", JSON.stringify(mergedNotifs))
          localStorage.setItem("processor_decisions", JSON.stringify(mergedDecisions))
          localStorage.setItem("farmer_deleted_products", JSON.stringify(mergedDeleted))
          localStorage.setItem("product_farmer_locations", JSON.stringify(mergedLocations))
        } catch {}

        if (Object.keys(localDeals).length > 0 || localNotifs.length > 0) {
          axios.put(`${API}/products/farmer-state`, {
            deals: mergedDeals,
            notifications: mergedNotifs,
            decisions: mergedDecisions,
            deletedProducts: mergedDeleted,
            productLocations: mergedLocations
          }, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => {})
        }
      }
    } catch (e) {
      console.warn("Could not fetch farmer cloud state", e)
    }
  }, [token])

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
    fetchSourcingOrders()
    fetchFarmerCloudState()

    const handleUpdate = () => {
      loadNotifications()
      loadDeals()
      loadDecisions()
      fetchProducts()
      fetchSourcingOrders()
      fetchFarmerCloudState()
    }
    window.addEventListener("farmer_notifications_updated", handleUpdate)
    window.addEventListener("farmer_deals_updated", handleUpdate)
    window.addEventListener("storage", handleUpdate)

    const interval = setInterval(() => {
      fetchFarmerCloudState()
      fetchSourcingOrders()
    }, 15000)

    return () => {
      clearInterval(interval)
      window.removeEventListener("farmer_notifications_updated", handleUpdate)
      window.removeEventListener("farmer_deals_updated", handleUpdate)
      window.removeEventListener("storage", handleUpdate)
    }
  }, [loadNotifications, loadDeals, loadDecisions, fetchSourcingOrders, fetchFarmerCloudState])

  // Handlers for Farmer Deal Lifecycle
  const handleAcceptDeal = async (productId: string, batchNumber: string) => {
    const updated = { ...deals, [productId]: "accepted", [batchNumber]: "accepted" }
    persistFarmerState({ deals: updated as any })
    
    try {
      await axios.put(`${API}/products/${productId}/status`, { status: "Accepted" }, { headers })
      setProducts(prev => prev.map(p => (p._id === productId || p.batchNumber === batchNumber) ? { ...p, status: "Accepted" } : p))
    } catch (e) {
      console.warn("Could not sync accepted status", e)
    }

    window.dispatchEvent(new Event("farmer_deals_updated"))
    window.dispatchEvent(new Event("farmer_notifications_updated"))
  }

  const handleMarkReadyForDispatch = async (productId: string, batchNumber: string) => {
    const updated = { ...deals, [productId]: "dispatched", [batchNumber]: "dispatched" }
    persistFarmerState({ deals: updated as any })
    
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
    persistFarmerState({ deals: updated as any })

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
    persistFarmerState({ notifications: updated })
  }

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }))
    persistFarmerState({ notifications: updated })
  }

  const clearAllNotifications = () => {
    persistFarmerState({ notifications: [] })
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

      const res = await axios.post(
        `${API}/products`,
        { ...form, quantity: Number(form.quantity), imageData, blockchainHash: null, product_id },
        { headers }
      )

      // Attach farmer profile location mapping
      try {
        const storedUser = JSON.parse(localStorage.getItem("farmchain_user") || "{}")
        const currentFarmerLoc = storedUser.address || localStorage.getItem("farmer_address") || ""
        if (currentFarmerLoc) {
          const locMap = JSON.parse(localStorage.getItem("product_farmer_locations") || "{}")
          locMap[String(product_id)] = currentFarmerLoc
          locMap[String(form.batchNumber)] = currentFarmerLoc
          if (res.data?.data?.id) locMap[String(res.data.data.id)] = currentFarmerLoc
          localStorage.setItem("product_farmer_locations", JSON.stringify(locMap))
        }
      } catch (err) {
        console.warn("Could not save product location map", err)
      }

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

  const pendingDirectDealsCount = products.filter(p => {
    const d = deals[p._id] || deals[p.batchNumber]
    return d === "requested"
  }).length

  const pendingDemandsCount = sourcingOrders.filter(o => o.status === "SOURCING_FROM_FARMERS").length
  const totalPendingSupplyCount = pendingDemandsCount + pendingDirectDealsCount

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
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Farmer Portal</h1>
          <p className="text-slate-600 mt-1">Manage your harvest, track processor interests, and monitor your produce through the supply chain.</p>
        </div>

        <div className="flex items-center gap-3 relative">
          {/* Notification Bell Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(prev => !prev)}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white hover:bg-emerald-50 text-slate-700 transition-all hover:border-emerald-400 focus:outline-none shadow-xs cursor-pointer"
              title="Notifications"
              aria-label="Toggle notifications"
            >
              <Bell className="h-5 w-5 text-emerald-800" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white shadow-md animate-pulse ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-[calc(100vw-2.5rem)] max-w-sm sm:w-96 rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-slate-800">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
                      <Bell className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] text-slate-500 hover:text-emerald-700 font-medium transition-colors cursor-pointer"
                      >
                        Mark all read
                      </button>
                      <span className="text-slate-300">·</span>
                      <button
                        onClick={clearAllNotifications}
                        className="text-[11px] text-slate-500 hover:text-rose-600 font-medium transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      <Wheat className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                      No notifications yet.<br />You will be notified when a processor marks interest.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          n.read
                            ? "bg-slate-50/60 border-slate-100 opacity-75 hover:bg-emerald-50/40"
                            : "bg-emerald-50/90 border-emerald-200 shadow-2xs hover:bg-emerald-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                            n.type === "processor_accepted" 
                              ? "bg-emerald-100 text-emerald-800" 
                              : n.type === "processor_rejected" 
                              ? "bg-rose-100 text-rose-800" 
                              : "bg-blue-100 text-blue-800"
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
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {n.type === "processor_interest"
                                  ? "🏢 Processor Expressed Interest"
                                  : n.type === "processor_accepted"
                                  ? "✅ Batch Verified & Accepted"
                                  : "❌ Produce Rejected at Intake"}
                              </p>
                              {!n.read && (
                                <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1 font-medium">
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

          <Button onClick={openRegistrationForm} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-sm hover:shadow-emerald-600/20 font-semibold px-4 py-2.5 cursor-pointer">
            <Plus className="h-4 w-4" />
            Register New Harvest
          </Button>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-emerald-100 pb-3 overflow-x-auto">
        <button
          onClick={() => {
            setSearchParams({})
            if (location.pathname.includes("supply-requests")) navigate("/farmer")
          }}
          className={cn(
            "flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap",
            currentTab === "farm"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-700/20"
              : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200"
          )}
        >
          <Leaf className="h-4 w-4" />
          <span>My Farm & Batches</span>
          <span className={cn(
            "px-2 py-0.5 text-xs rounded-full font-bold",
            currentTab === "farm" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
          )}>
            {products.length}
          </span>
        </button>

        <button
          onClick={() => {
            setSearchParams({ tab: "supply-requests" })
          }}
          className={cn(
            "flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer relative whitespace-nowrap",
            currentTab === "supply-requests"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-700/20"
              : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200"
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Processor Supply Requests</span>
          {totalPendingSupplyCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white font-bold animate-pulse">
              {totalPendingSupplyCount} New
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setSearchParams({ tab: "profile" })
          }}
          className={cn(
            "flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap",
            currentTab === "profile"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-700/20"
              : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200"
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Farm Profile & Compliance</span>
        </button>
      </div>

      {currentTab === "profile" ? (
        <ProfileManagementSection role="farmer" />
      ) : currentTab === "supply-requests" ? (
        <FarmerSupplyRequestsDesk
          sourcingOrders={sourcingOrders}
          products={products}
          deals={deals}
          notifications={notifications}
          token={token}
          onRefresh={() => {
            fetchSourcingOrders()
            fetchProducts()
            fetchFarmerCloudState()
          }}
          onAcceptDeal={handleAcceptDeal}
          onMarkReadyForDispatch={handleMarkReadyForDispatch}
          onDeclineDeal={handleDeclineDeal}
          onOpenRegisterFormWithPreFill={(prefill) => {
            setForm({
              name: prefill.name,
              category: prefill.category || "Vegetables",
              quantity: prefill.quantity,
              batchNumber: generateBatchNumber(),
              expiryDate: "",
              organicStatus: true
            })
            setShowForm(true)
          }}
        />
      ) : (
        <div className="space-y-8">
          {/* Active Supply Requests Highlight Callout */}
          {totalPendingSupplyCount > 0 && (
            <div className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/60 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="p-3.5 rounded-2xl bg-emerald-100 text-emerald-700 shadow-2xs">
                  <ShoppingCart className="h-6 w-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    🌾 Processor Supply Requests Waiting ({totalPendingSupplyCount} Demands)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Processing facilities have broadcasted crop procurement contracts. Review and commit your harvest.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setSearchParams({ tab: "supply-requests" })}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 rounded-2xl shadow-sm px-4 py-2.5 cursor-pointer"
              >
                <span>View & Fulfill in Supply Desk</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Batches", value: stats.total, icon: Wheat, color: "text-emerald-700", bg: "bg-emerald-50" },
              { label: "Harvested", value: stats.harvested, icon: Leaf, color: "text-emerald-700", bg: "bg-emerald-50" },
              { label: "In Transit", value: stats.inTransit, icon: Truck, color: "text-amber-700", bg: "bg-amber-50" },
              { label: "Avg Quality", value: `${stats.avgQuality}%`, icon: Star, color: "text-purple-700", bg: "bg-purple-50" },
            ].map(s => (
              <div key={s.label} className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex items-center gap-4">
                <div className={`p-3.5 rounded-2xl ${s.bg} ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{s.value}</p>
                  <p className="text-xs font-semibold text-slate-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* My Products */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">My Registered Produce</h2>
                <p className="text-xs text-slate-500 mt-0.5">Harvest batches authenticated with on-chain cryptographic signatures.</p>
              </div>
              <button
                onClick={fetchProducts}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white border border-emerald-200 px-3.5 py-2 rounded-2xl shadow-2xs hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            ) : productError ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center rounded-3xl border border-rose-200 bg-rose-50/50 p-6">
                <AlertCircle className="h-8 w-8 text-rose-600" />
                <p className="text-rose-700 text-sm font-semibold">{productError}</p>
                <Button variant="outline" onClick={fetchProducts} className="mt-1 text-xs border-rose-300 text-rose-800 hover:bg-rose-100 rounded-xl">Retry</Button>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-3xl border border-emerald-100 bg-white shadow-xs">
                <div className="p-4 rounded-3xl bg-emerald-50 text-emerald-600">
                  <Leaf className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <p className="text-slate-900 font-bold text-base">No produce batches registered yet</p>
                  <p className="text-slate-500 text-xs mt-1">Register your first harvest to get started.</p>
                </div>
                <Button onClick={openRegistrationForm} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-sm font-semibold">
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
                    <div key={p._id} className="rounded-3xl border border-emerald-100 bg-white p-5 space-y-4 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 group">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-emerald-700 transition-colors">{p.name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{p.category} · {p.batchNumber}</p>
                        </div>
                        {p.organicStatus && (
                          <span className="shrink-0 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                            Organic
                          </span>
                        )}
                      </div>

                      {p.productImageUrl && <img src={p.productImageUrl} alt={p.name} className="h-28 w-full rounded-2xl border border-emerald-100 object-cover" />}

                      {/* Status */}
                      <div className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-bold ${sc.bg} ${sc.color}`}>
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
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-start gap-2.5 shadow-2xs">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-emerald-950">✅ Verified & Accepted on Blockchain</p>
                                <p className="text-[11px] text-emerald-800 mt-0.5">{processorName} verified QR certificate and scale weight. Produce has entered the processing line.</p>
                              </div>
                            </div>
                          )
                        }

                        if (decisionRecord?.decision === "Rejected" || p.status === "Rejected by Processor") {
                          return (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 flex items-start gap-2.5 shadow-2xs">
                              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-rose-950">❌ Rejected at Gate Intake by {processorName}</p>
                                <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
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
                              <div className="space-y-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 shadow-2xs">
                                <div className="flex items-start gap-2">
                                  <Factory className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-amber-950">{processorName} expressed interest</p>
                                    <p className="text-[11px] text-amber-800 mt-0.5">Wants to procure this harvest batch ({p.quantity} kg). Confirm to accept deal.</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    className="flex-1 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs h-8.5 font-bold cursor-pointer"
                                    onClick={() => handleAcceptDeal(p._id, p.batchNumber)}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Accept Offer
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs gap-1 border-rose-200 bg-white text-rose-700 hover:bg-rose-50 rounded-xl h-8.5 font-semibold cursor-pointer"
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
                              <div className="space-y-2.5 rounded-2xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-950 shadow-2xs">
                                <div className="flex items-start gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-blue-950">Deal Accepted with {processorName}</p>
                                    <p className="text-[11px] text-blue-800 mt-0.5">Pack and crate harvest, then click below to confirm dispatch readiness.</p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs h-8.5 font-bold cursor-pointer"
                                  onClick={() => handleMarkReadyForDispatch(p._id, p.batchNumber)}
                                >
                                  <PackageCheck className="h-4 w-4" />
                                  📦 Ready for Dispatch
                                </Button>
                              </div>
                            )}

                            {/* Stage 3: Dispatched & In Transit */}
                            {currentDealState === "dispatched" && (
                              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950 flex items-center gap-2.5 shadow-2xs">
                                <Truck className="h-4 w-4 text-emerald-600 shrink-0 animate-bounce" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-emerald-950">🚚 Dispatched to {processorName}</p>
                                  <p className="text-[11px] text-emerald-800 truncate">In transit to processing facility. Gate scale intake authorized.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* AI Quality */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div>
                          <p className="text-xs text-slate-500">AI Quality</p>
                          <p className={`text-sm font-semibold ${qColor}`}>
                            {p.aiQualityLabel}
                            {p.aiQualityScore > 0 && (
                              <span className="text-xs font-normal text-slate-500 ml-1">
                                ({(p.aiQualityScore * 100).toFixed(0)}%)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Quantity</p>
                          <p className="text-sm font-black text-slate-900">{p.quantity} kg</p>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        Registered on {date}
                      </div>
                      {p.expiryDate && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Expires {new Date(`${p.expiryDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}

                      {/* Card Actions: QR Code Certificate */}
                      <div className="pt-2 border-t border-slate-100 flex items-center">
                        {p.status !== "Pending Approval" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs gap-1.5 rounded-2xl border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 font-bold h-9 cursor-pointer"
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
        </div>
      )}

      {/* Register Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain scroll-smooth rounded-3xl border border-emerald-100 bg-white p-6 sm:p-8 shadow-2xl text-slate-900">
            <div className="mb-5 flex items-center justify-between border-b border-emerald-100 pb-4 sm:mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Register New Harvest</h2>
                <p className="text-xs text-slate-500 mt-1">AI analysis will run automatically on submission to verify quality grade.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {/* Quick Crop Selector Pills */}
              <div className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    Quick Crop Presets (1-Click Auto-Fill)
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">Smart Shelf-Life</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {CROP_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleApplyCropPreset(p)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer",
                        form.name === p.name
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : "bg-white text-slate-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50"
                      )}
                    >
                      <span>{p.icon}</span>
                      <span>{p.name.replace("Organic ", "").replace("Farm Fresh ", "").replace("Fresh ", "")}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Product Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Organic Tomatoes"
                    required
                    className="flex h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                  />
                </div>

                {/* Category Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Category *</label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    className="flex h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold cursor-pointer"
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Fruits">Fruits</option>
                    <option value="Grains & Cereals">Grains & Cereals</option>
                    <option value="Pulses & Legumes">Pulses & Legumes</option>
                    <option value="Dairy & Poultry">Dairy & Poultry</option>
                    <option value="Spices & Herbs">Spices & Herbs</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Quantity */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Quantity (kg) *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    name="quantity"
                    value={form.quantity}
                    onChange={handleFormChange}
                    placeholder="500"
                    required
                    className="flex h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold"
                  />
                </div>

                {/* Batch Number (Small & Constant) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Batch Code (Small & Constant) *</label>
                    <button
                      type="button"
                      onClick={handleRegenerateBatch}
                      title="Roll a fresh small batch code"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 cursor-pointer"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                      <span>New</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    name="batchNumber"
                    value={form.batchNumber}
                    onChange={handleFormChange}
                    placeholder="e.g. BCH-4821"
                    required
                    className="flex h-10 w-full rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs font-mono font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    Maintained constant across Processor, Distributor & Retailer.
                  </span>
                </div>

                {/* Expiry Date with Smart Quick Pills */}
                <div className="space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Expiry Date (Shelf Life) *</label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 mr-1 hidden sm:inline">Quick shelf-life:</span>
                      {[
                        { label: "+7d", days: 7 },
                        { label: "+14d", days: 14 },
                        { label: "+30d", days: 30 },
                        { label: "+60d", days: 60 },
                        { label: "+180d", days: 180 },
                      ].map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => handleQuickExpiry(q.days)}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold cursor-pointer"
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="date"
                    name="expiryDate"
                    value={form.expiryDate}
                    onChange={handleFormChange}
                    required
                    className="flex h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                  />
                </div>
              </div>

              {/* Product Photo: Upload & Camera */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div>
                    <label className="text-xs font-bold text-slate-800">Product Photo</label>
                    <p className="text-xs text-slate-500 mt-0.5">Upload file or take live camera photo for computer-vision quality scoring.</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-emerald-700 border border-emerald-200 font-bold shadow-2xs">
                    <Wand2 className="h-3 w-3" /> AI ready
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <label htmlFor="productPhoto" className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-white px-3 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors shadow-2xs">
                      <ImagePlus className="h-4 w-4 shrink-0" />
                      <span>{imagePreview ? "Change Photo" : "Upload Photo"}</span>
                    </label>
                    <input ref={photoInputRef} id="productPhoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="sr-only" />

                    <label htmlFor="cameraPhoto" className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-2xs">
                      <Camera className="h-4 w-4 shrink-0" />
                      <span>Take Live Photo</span>
                    </label>
                    <input ref={cameraInputRef} id="cameraPhoto" type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="sr-only" />
                  </div>

                  {imagePreview && (
                    <div className="relative h-16 w-full sm:w-24 shrink-0">
                      <img src={imagePreview} alt="Product preview" className="h-16 w-full rounded-xl border border-emerald-200 object-cover" />
                      <button type="button" onClick={removePhoto} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 bg-white text-rose-500 shadow-sm hover:bg-rose-50 cursor-pointer" aria-label="Remove uploaded photo">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2 text-xs text-emerald-800 font-medium">
                <CalendarDays className="h-4 w-4 shrink-0 text-emerald-600" />
                Expiry date is required for smart shelf-life and freshness monitoring.
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200">
                <input
                  type="checkbox"
                  id="organicStatus"
                  name="organicStatus"
                  checked={form.organicStatus}
                  onChange={handleFormChange}
                  className="h-4 w-4 accent-emerald-600 cursor-pointer"
                />
                <label htmlFor="organicStatus" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Certified Organic Produce (Pesticide-Free)
                </label>
              </div>

              {formMsg && (
                <div className={`flex items-center gap-2 p-3.5 rounded-2xl text-sm border ${
                  formMsg.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  {formMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />}
                  {formMsg.text}
                </div>
              )}

              <p className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                <Wand2 className="h-3.5 w-3.5 text-emerald-600" />
                Wallet-less registration: The system will automatically secure this product on the blockchain for you!
              </p>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1 rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm cursor-pointer" disabled={submitting}>
                  {submitting ? "Processing..." : "Run AI & Register"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Certificate Modal */}
      {selectedQrProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-emerald-100 rounded-3xl p-6 sm:p-7 max-w-sm w-full space-y-5 text-center shadow-2xl text-slate-900">
            <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-600" />
                Product QR Certificate
              </h3>
              <button
                onClick={() => setSelectedQrProduct(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
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

            <div className="p-4 bg-emerald-50/50 rounded-3xl border border-emerald-100 flex flex-col items-center justify-center shadow-inner mx-auto w-fit">
              <QRCodeSVG
                value={`${window.location.origin}/tracker?id=${selectedQrProduct._id}`}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-black text-base text-slate-900">{selectedQrProduct.name}</p>
              <p className="text-slate-500 font-mono">Batch: {selectedQrProduct.batchNumber}</p>
              <p className="text-slate-600 font-medium">Qty: {selectedQrProduct.quantity} kg • {selectedQrProduct.category}</p>
              <p className="text-emerald-700 font-semibold pt-1">
                Scan with camera or upload image to trace on blockchain
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="w-full rounded-2xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm cursor-pointer"
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
                  className="flex-1 rounded-2xl border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold cursor-pointer"
                  onClick={() => window.print()}
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 rounded-2xl text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
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
