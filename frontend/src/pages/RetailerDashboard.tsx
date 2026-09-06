import { useState, useEffect } from "react"
import {
  ShoppingBag, AlertTriangle, TrendingUp, Plus, Search,
  QrCode, DollarSign, Package, Clock, Flame, ShieldAlert,
  Store, Phone, MapPin, X, Filter,
  Trash2, PieChart, BarChart3, Check, Ban, Sparkles
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import { useAuth } from "../context/AuthContext"

export interface RetailItem {
  id: string
  batchId: string
  product: string
  category: "Fruits" | "Vegetables" | "Dairy" | "Meat" | "Grains"
  availableStock: number
  totalReceived: number
  unit: "kg" | "L" | "units"
  arrivalDate: string
  expiryDate: string
  shelfLifeDays: number
  pricePerUnit: number
  costPerUnit: number
  aiQualityScore: number
  originFarm: string
  processor: string
  distributor: string
  vehicleNo: string
  tempStatus: string
  tempViolation: boolean
  damageFlag: boolean
  status: "In Stock" | "Low Stock" | "Out of Stock"
}

export interface SaleRecord {
  id: string
  batchId: string
  product: string
  quantitySold: number
  unit: string
  unitPrice: number
  totalAmount: number
  timestamp: string
  paymentMethod: "Cash" | "UPI" | "Card" | "Crypto"
  customerNote?: string
}

export interface CustomerOrder {
  id: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  batchId: string
  product: string
  quantity: number
  unit: string
  totalAmount: number
  status: "Placed" | "Confirmed" | "Preparing" | "Ready" | "Delivered" | "Rejected"
  timestamp: string
  paymentStatus: "Paid" | "Pending"
}

export interface WasteLog {
  id: string
  batchId: string
  product: string
  category: string
  quantityWasted: number
  unit: string
  unitCost: number
  financialLoss: number
  reason: "Expired Shelf-Life" | "Cold-Chain Temp Breach" | "Packaging Damage" | "Overstock Spoilage"
  loggedDate: string
  loggedBy: string
}

const DEFAULT_RETAIL_ITEMS: RetailItem[] = [
  {
    id: "RET-101",
    batchId: "BTC-AVO-991",
    product: "Organic Avocados",
    category: "Fruits",
    availableStock: 140,
    totalReceived: 200,
    unit: "kg",
    arrivalDate: "2026-09-05",
    expiryDate: "2026-09-18",
    shelfLifeDays: 12,
    pricePerUnit: 8.5,
    costPerUnit: 5.5,
    aiQualityScore: 94,
    originFarm: "Green Valley Organic Farms",
    processor: "Valley Organic Foods",
    distributor: "Express Logistics Fleet",
    vehicleNo: "TN-01-AX-3421",
    tempStatus: "Optimal (5.2°C)",
    tempViolation: false,
    damageFlag: false,
    status: "In Stock"
  },
  {
    id: "RET-102",
    batchId: "BTC-MILK-402",
    product: "Premium Whole Milk",
    category: "Dairy",
    availableStock: 15,
    totalReceived: 100,
    unit: "L",
    arrivalDate: "2026-09-06",
    expiryDate: "2026-09-09",
    shelfLifeDays: 3,
    pricePerUnit: 3.2,
    costPerUnit: 2.1,
    aiQualityScore: 82,
    originFarm: "Sunshine Dairy Co.",
    processor: "GreenDairy Processing",
    distributor: "Express Logistics Fleet",
    vehicleNo: "KA-04-BC-8812",
    tempStatus: "Exposed (9.8°C)",
    tempViolation: true,
    damageFlag: false,
    status: "Low Stock"
  },
  {
    id: "RET-103",
    batchId: "BTC-TOM-108",
    product: "Fresh Vine Tomatoes",
    category: "Vegetables",
    availableStock: 38,
    totalReceived: 150,
    unit: "kg",
    arrivalDate: "2026-09-06",
    expiryDate: "2026-09-22",
    shelfLifeDays: 16,
    pricePerUnit: 4.0,
    costPerUnit: 2.5,
    aiQualityScore: 91,
    originFarm: "AgroFields Nashik",
    processor: "AgroPack Terminal",
    distributor: "Express Logistics Fleet",
    vehicleNo: "MH-12-GH-5530",
    tempStatus: "Optimal (10.1°C)",
    tempViolation: false,
    damageFlag: false,
    status: "In Stock"
  },
  {
    id: "RET-104",
    batchId: "BTC-MNG-505",
    product: "Alphonso Mangoes",
    category: "Fruits",
    availableStock: 0,
    totalReceived: 250,
    unit: "kg",
    arrivalDate: "2026-09-04",
    expiryDate: "2026-09-14",
    shelfLifeDays: 8,
    pricePerUnit: 12.0,
    costPerUnit: 8.0,
    aiQualityScore: 96,
    originFarm: "Konkan Orchards",
    processor: "Konkan Processing Co.",
    distributor: "Express Logistics Fleet",
    vehicleNo: "MH-04-DE-9912",
    tempStatus: "Optimal (5.5°C)",
    tempViolation: false,
    damageFlag: false,
    status: "Out of Stock"
  }
]

const DEFAULT_SALES: SaleRecord[] = [
  { id: "SALE-901", batchId: "BTC-AVO-991", product: "Organic Avocados", quantitySold: 15, unit: "kg", unitPrice: 8.5, totalAmount: 127.50, timestamp: "2026-09-06 08:15", paymentMethod: "UPI", customerNote: "Regular customer purchase" },
  { id: "SALE-902", batchId: "BTC-MILK-402", product: "Premium Whole Milk", quantitySold: 20, unit: "L", unitPrice: 3.2, totalAmount: 64.00, timestamp: "2026-09-06 07:45", paymentMethod: "Card" },
  { id: "SALE-903", batchId: "BTC-MNG-505", product: "Alphonso Mangoes", quantitySold: 25, unit: "kg", unitPrice: 12.0, totalAmount: 300.00, timestamp: "2026-09-05 17:30", paymentMethod: "Cash" },
]

const DEFAULT_CUSTOMER_ORDERS: CustomerOrder[] = [
  { id: "ORD-8801", customerName: "Ananya Roy", customerPhone: "+91 98765 11223", deliveryAddress: "Flat 402, Oakwood Towers, City", batchId: "BTC-AVO-991", product: "Organic Avocados", quantity: 10, unit: "kg", totalAmount: 85.00, status: "Placed", timestamp: "2026-09-06 08:30", paymentStatus: "Paid" },
  { id: "ORD-8802", customerName: "Rohan Verma", customerPhone: "+91 98111 22334", deliveryAddress: "Plot 12, Green Park Avenue", batchId: "BTC-MILK-402", product: "Premium Whole Milk", quantity: 15, unit: "L", totalAmount: 48.00, status: "Confirmed", timestamp: "2026-09-06 07:15", paymentStatus: "Paid" },
  { id: "ORD-8803", customerName: "Priya Sharma", customerPhone: "+91 97777 88990", deliveryAddress: "Villa 9, Sunrise Estates", batchId: "BTC-TOM-108", product: "Fresh Vine Tomatoes", quantity: 8, unit: "kg", totalAmount: 32.00, status: "Preparing", timestamp: "2026-09-06 06:45", paymentStatus: "Paid" },
  { id: "ORD-8804", customerName: "Kabir Mehta", customerPhone: "+91 99000 55443", deliveryAddress: "B-104, Blue Ridge Towers", batchId: "BTC-MNG-505", product: "Alphonso Mangoes", quantity: 12, unit: "kg", totalAmount: 144.00, status: "Delivered", timestamp: "2026-09-05 18:20", paymentStatus: "Paid" },
]

const DEFAULT_WASTE_LOGS: WasteLog[] = [
  { id: "WST-301", batchId: "BTC-MILK-402", product: "Premium Whole Milk", category: "Dairy", quantityWasted: 10, unit: "L", unitCost: 2.10, financialLoss: 21.00, reason: "Cold-Chain Temp Breach", loggedDate: "2026-09-06 08:00", loggedBy: "Store Manager" },
  { id: "WST-302", batchId: "BTC-AVO-991", product: "Organic Avocados", category: "Fruits", quantityWasted: 4, unit: "kg", unitCost: 5.50, financialLoss: 22.00, reason: "Packaging Damage", loggedDate: "2026-09-04 14:20", loggedBy: "Intake Inspector" },
]

const DAILY_SALES_DATA = [
  { time: "08:00", revenue: 185 },
  { time: "10:00", revenue: 320 },
  { time: "12:00", revenue: 450 },
  { time: "14:00", revenue: 290 },
  { time: "16:00", revenue: 580 },
  { time: "18:00", revenue: 720 },
  { time: "20:00", revenue: 410 },
]

const WEEKLY_DEMAND = [
  { day: "Mon", actual: 42, forecast: 45 },
  { day: "Tue", actual: 38, forecast: 40 },
  { day: "Wed", actual: 55, forecast: 52 },
  { day: "Thu", actual: 61, forecast: 58 },
  { day: "Fri", actual: 72, forecast: 70 },
  { day: "Sat", actual: 88, forecast: 85 },
  { day: "Sun", actual: 65, forecast: 68 },
]

export function RetailerDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<"inventory" | "orders" | "qr" | "alerts" | "sales" | "waste">("inventory")

  // Persistent State
  const [inventory, setInventory] = useState<RetailItem[]>(() => {
    try {
      const saved = localStorage.getItem("farmchain_retailer_inventory")
      return saved ? JSON.parse(saved) : DEFAULT_RETAIL_ITEMS
    } catch {
      return DEFAULT_RETAIL_ITEMS
    }
  })

  const [sales, setSales] = useState<SaleRecord[]>(() => {
    try {
      const saved = localStorage.getItem("farmchain_retailer_sales")
      return saved ? JSON.parse(saved) : DEFAULT_SALES
    } catch {
      return DEFAULT_SALES
    }
  })

  const [orders, setOrders] = useState<CustomerOrder[]>(() => {
    try {
      const saved = localStorage.getItem("farmchain_retailer_orders")
      return saved ? JSON.parse(saved) : DEFAULT_CUSTOMER_ORDERS
    } catch {
      return DEFAULT_CUSTOMER_ORDERS
    }
  })

  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>(() => {
    try {
      const saved = localStorage.getItem("farmchain_retailer_waste")
      return saved ? JSON.parse(saved) : DEFAULT_WASTE_LOGS
    } catch {
      return DEFAULT_WASTE_LOGS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem("farmchain_retailer_inventory", JSON.stringify(inventory))
    } catch (e) { console.warn("Error saving inventory", e) }
  }, [inventory])

  useEffect(() => {
    try {
      localStorage.setItem("farmchain_retailer_sales", JSON.stringify(sales))
    } catch (e) { console.warn("Error saving sales", e) }
  }, [sales])

  useEffect(() => {
    try {
      localStorage.setItem("farmchain_retailer_orders", JSON.stringify(orders))
    } catch (e) { console.warn("Error saving orders", e) }
  }, [orders])

  useEffect(() => {
    try {
      localStorage.setItem("farmchain_retailer_waste", JSON.stringify(wasteLogs))
    } catch (e) { console.warn("Error saving waste logs", e) }
  }, [wasteLogs])

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("All")
  const [stockStatusFilter, setStockStatusFilter] = useState("All")
  const [orderStatusFilter, setOrderStatusFilter] = useState("All")
  const [salesTimeframe, setSalesTimeframe] = useState<"daily" | "weekly">("daily")
  const [selectedItem, setSelectedItem] = useState<RetailItem | null>(inventory[0] || null)

  // Modals State
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [showAddBatchModal, setShowAddBatchModal] = useState(false)
  const [showWasteModal, setShowWasteModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)

  // Record Sale Form
  const [saleQty, setSaleQty] = useState<number>(5)
  const [salePayment, setSalePayment] = useState<"Cash" | "UPI" | "Card" | "Crypto">("UPI")
  const [saleNote, setSaleNote] = useState("")

  // Log Waste Form
  const [wasteQty, setWasteQty] = useState<number>(2)
  const [wasteReason, setWasteReason] = useState<"Expired Shelf-Life" | "Cold-Chain Temp Breach" | "Packaging Damage" | "Overstock Spoilage">("Expired Shelf-Life")

  // Add Batch Form
  const [newBatch, setNewBatch] = useState({
    batchId: `BTC-NEW-${Math.floor(100 + Math.random() * 900)}`,
    product: "Organic Apples",
    category: "Fruits" as const,
    availableStock: 100,
    unit: "kg" as const,
    pricePerUnit: 6.5,
    costPerUnit: 4.2,
    expiryDate: "2026-09-28",
    shelfLifeDays: 22,
    aiQualityScore: 95,
    originFarm: "Himachal Highland Orchards",
    processor: "Highland Fresh Packers",
    distributor: "Express Logistics Fleet",
    vehicleNo: "HP-01-AB-1234"
  })

  // Calculate Metrics
  const totalStockKg = inventory.reduce((sum, item) => sum + item.availableStock, 0)
  const nearExpiryCount = inventory.filter(i => i.shelfLifeDays <= 3 && i.availableStock > 0).length
  const tempViolationCount = inventory.filter(i => i.tempViolation && i.availableStock > 0).length
  const totalSalesRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0)
  const pendingOrdersCount = orders.filter(o => o.status === "Placed" || o.status === "Confirmed").length

  const totalFinancialLoss = wasteLogs.reduce((sum, w) => sum + w.financialLoss, 0)
  const totalWastedQty = wasteLogs.reduce((sum, w) => sum + w.quantityWasted, 0)
  const wasteRatePercent = totalStockKg + totalWastedQty > 0 ? ((totalWastedQty / (totalStockKg + totalWastedQty)) * 100).toFixed(1) : "0.0"

  // Filtered inventory
  const filteredInventory = inventory.filter(item => {
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter
    const matchesStatus = stockStatusFilter === "All" || item.status === stockStatusFilter
    const matchesSearch =
      item.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesStatus && matchesSearch
  })

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    const matchesStatus = orderStatusFilter === "All" || o.status === orderStatusFilter
    const matchesSearch =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.batchId.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Order Status Progression
  const handleUpdateOrderStatus = (orderId: string, nextStatus: CustomerOrder["status"]) => {
    const updated = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: nextStatus }
      }
      return o
    })
    setOrders(updated)
  }

  // Handle Record Sale
  const handleRecordSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return

    if (saleQty <= 0 || saleQty > selectedItem.availableStock) {
      alert(`Invalid sale quantity. Available stock is ${selectedItem.availableStock} ${selectedItem.unit}.`)
      return
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 16)
    const total = saleQty * selectedItem.pricePerUnit

    const newSale: SaleRecord = {
      id: `SALE-${Math.floor(100 + Math.random() * 900)}`,
      batchId: selectedItem.batchId,
      product: selectedItem.product,
      quantitySold: saleQty,
      unit: selectedItem.unit,
      unitPrice: selectedItem.pricePerUnit,
      totalAmount: total,
      timestamp: now,
      paymentMethod: salePayment,
      customerNote: saleNote
    }

    setSales(prev => [newSale, ...prev])

    // Auto-deduct stock
    const updatedInventory = inventory.map(item => {
      if (item.id === selectedItem.id) {
        const remaining = item.availableStock - saleQty
        const newStatus: "In Stock" | "Low Stock" | "Out of Stock" =
          remaining === 0 ? "Out of Stock" : remaining <= 20 ? "Low Stock" : "In Stock"
        return { ...item, availableStock: remaining, status: newStatus }
      }
      return item
    })

    setInventory(updatedInventory)
    const remainingSelected = selectedItem.availableStock - saleQty
    setSelectedItem({
      ...selectedItem,
      availableStock: remainingSelected,
      status: remainingSelected === 0 ? "Out of Stock" : remainingSelected <= 20 ? "Low Stock" : "In Stock"
    })

    setShowSaleModal(false)
    setSaleNote("")
  }

  // Handle Log Food Waste
  const handleLogWasteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return

    if (wasteQty <= 0 || wasteQty > selectedItem.availableStock) {
      alert(`Invalid waste quantity. Available stock is ${selectedItem.availableStock} ${selectedItem.unit}.`)
      return
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 16)
    const financialLoss = wasteQty * selectedItem.costPerUnit

    const newWaste: WasteLog = {
      id: `WST-${Math.floor(100 + Math.random() * 900)}`,
      batchId: selectedItem.batchId,
      product: selectedItem.product,
      category: selectedItem.category,
      quantityWasted: wasteQty,
      unit: selectedItem.unit,
      unitCost: selectedItem.costPerUnit,
      financialLoss: financialLoss,
      reason: wasteReason,
      loggedDate: now,
      loggedBy: `${user?.name || "Store Inspector"}`
    }

    setWasteLogs(prev => [newWaste, ...prev])

    // Auto-deduct stock due to waste
    const updatedInventory = inventory.map(item => {
      if (item.id === selectedItem.id) {
        const remaining = item.availableStock - wasteQty
        const newStatus: "In Stock" | "Low Stock" | "Out of Stock" =
          remaining === 0 ? "Out of Stock" : remaining <= 20 ? "Low Stock" : "In Stock"
        return { ...item, availableStock: remaining, status: newStatus }
      }
      return item
    })

    setInventory(updatedInventory)
    const remainingSelected = selectedItem.availableStock - wasteQty
    setSelectedItem({
      ...selectedItem,
      availableStock: remainingSelected,
      status: remainingSelected === 0 ? "Out of Stock" : remainingSelected <= 20 ? "Low Stock" : "In Stock"
    })

    setShowWasteModal(false)
  }

  // Handle Add New Batch
  const handleAddBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const now = new Date().toISOString().substring(0, 10)
    const newId = `RET-${Math.floor(100 + Math.random() * 900)}`

    const newItem: RetailItem = {
      id: newId,
      batchId: newBatch.batchId,
      product: newBatch.product,
      category: newBatch.category,
      availableStock: newBatch.availableStock,
      totalReceived: newBatch.availableStock,
      unit: newBatch.unit,
      arrivalDate: now,
      expiryDate: newBatch.expiryDate,
      shelfLifeDays: newBatch.shelfLifeDays,
      pricePerUnit: newBatch.pricePerUnit,
      costPerUnit: newBatch.costPerUnit,
      aiQualityScore: newBatch.aiQualityScore,
      originFarm: newBatch.originFarm,
      processor: newBatch.processor,
      distributor: newBatch.distributor,
      vehicleNo: newBatch.vehicleNo,
      tempStatus: "Optimal (5.0°C)",
      tempViolation: false,
      damageFlag: false,
      status: newBatch.availableStock <= 20 ? "Low Stock" : "In Stock"
    }

    setInventory(prev => [newItem, ...prev])
    setSelectedItem(newItem)
    setShowAddBatchModal(false)
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Store Details */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-purple-900/20 via-slate-900/10 to-emerald-900/20 p-6 rounded-3xl border border-purple-500/20 shadow-sm">
        <div className="flex items-center gap-4">
          {user?.photo ? (
            <img
              src={user.photo}
              alt={user.name || "Store Logo"}
              className="h-16 w-16 rounded-2xl object-cover border-2 border-purple-500 shadow-md shrink-0"
            />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-600 font-bold text-2xl shrink-0">
              <Store className="h-8 w-8 text-purple-600" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{user?.name || "Retailer Portal"}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-500/20 text-purple-600 border border-purple-500/30 capitalize">
                Verified Storefront
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Batch Inventory, Customer Orders, QR Provenance, AI Demand Forecasting & Waste Loss Reduction.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(user?.phone || user?.address) && (
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/70 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
              {user.phone && (
                <div className="flex items-center gap-1.5 font-medium">
                  <Phone className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )}
              {user.address && (
                <div className="flex items-center gap-1.5 font-medium max-w-xs truncate">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate" title={user.address}>{user.address}</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowSaleModal(true)}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <DollarSign className="h-4 w-4" />
            <span>Record Batch Sale</span>
          </button>
        </div>
      </div>

      {/* 2. Stat Summary Counters */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { title: "Total Available Stock", value: `${totalStockKg} kg`, icon: ShoppingBag, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { title: "Pending Customer Orders", value: `${pendingOrdersCount}`, icon: ShoppingBag, color: pendingOrdersCount > 0 ? "text-purple-600 font-bold animate-pulse" : "text-slate-400", bg: "bg-purple-500/10" },
          { title: "Near Expiry (&le; 3 Days)", value: `${nearExpiryCount} items`, icon: Clock, color: nearExpiryCount > 0 ? "text-rose-500 animate-pulse" : "text-slate-400", bg: "bg-rose-500/10" },
          { title: "Food Waste Loss", value: `$${totalFinancialLoss.toFixed(2)}`, icon: Trash2, color: totalFinancialLoss > 0 ? "text-rose-600" : "text-slate-400", bg: "bg-rose-500/10" },
          { title: "Store Waste Rate", value: `${wasteRatePercent}%`, icon: PieChart, color: "text-amber-500", bg: "bg-amber-500/10" },
          { title: "Total Sales Revenue", value: `$${totalSalesRevenue.toFixed(2)}`, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
        ].map((s) => (
          <Card key={s.title} className="col-span-1 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{s.title}</span>
              <div className={`p-2 rounded-xl ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: "inventory", label: "📦 Inventory & Stock", count: inventory.length },
          { id: "orders", label: "🛍️ Customer Orders", badge: pendingOrdersCount > 0 ? `${pendingOrdersCount} Pending` : undefined },
          { id: "qr", label: "🔍 Product QR & Provenance" },
          { id: "alerts", label: "⏳ Expiry & AI Quality", badge: (nearExpiryCount + tempViolationCount) > 0 ? `${nearExpiryCount + tempViolationCount} Risk Flags` : undefined },
          { id: "sales", label: "📊 Sales & AI Demand Prediction" },
          { id: "waste", label: "🗑️ Food Waste & Loss Tracking", badge: totalFinancialLoss > 0 ? `$${totalFinancialLoss.toFixed(0)} Loss` : undefined },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === t.id ? "bg-purple-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`}>
                {t.count}
              </span>
            )}
            {t.badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-extrabold animate-pulse">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ==================== TAB 1: INVENTORY & STOCK MANAGEMENT ==================== */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search batch ID, product name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                <Filter className="h-3.5 w-3.5" /> Category:
              </span>
              {["All", "Fruits", "Vegetables", "Dairy", "Meat"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    categoryFilter === cat
                      ? "bg-purple-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}

              <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold ml-2">
                Status:
              </span>
              {["All", "In Stock", "Low Stock", "Out of Stock"].map(st => (
                <button
                  key={st}
                  onClick={() => setStockStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    stockStatusFilter === st
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}

              <button
                onClick={() => setShowAddBatchModal(true)}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-xl text-xs shadow-sm cursor-pointer ml-2"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Incoming Batch</span>
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left 2 Cols: Inventory Table */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    <span>Store Inventory Directory</span>
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">Showing {filteredInventory.length} batches</span>
                </CardTitle>
                <CardDescription>View received batches, track stock levels & automatically deduct stock on sale.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b">
                      <tr>
                        <th className="py-3 px-3">Batch ID / Product</th>
                        <th className="py-3 px-3">Available Stock</th>
                        <th className="py-3 px-3">Arrival Date</th>
                        <th className="py-3 px-3">Expiry & Shelf-Life</th>
                        <th className="py-3 px-3">Price / Unit</th>
                        <th className="py-3 px-3">Stock Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredInventory.map(item => {
                        const isSelected = selectedItem?.id === item.id
                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={`cursor-pointer transition-colors ${isSelected ? "bg-purple-50/70 dark:bg-purple-950/30" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/50"}`}
                          >
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{item.product}</div>
                              <div className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">{item.batchId}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                                {item.availableStock} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground">Received: {item.totalReceived} {item.unit}</div>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground">{item.arrivalDate}</td>
                            <td className="py-3 px-3">
                              <div className="font-medium text-slate-800 dark:text-slate-200">{item.expiryDate}</div>
                              <span className={`text-[10px] font-bold ${item.shelfLifeDays <= 3 ? "text-rose-600" : "text-emerald-600"}`}>
                                {item.shelfLifeDays} days remaining
                              </span>
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                              ${item.pricePerUnit.toFixed(2)} /{item.unit}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                item.status === "In Stock" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                                item.status === "Low Stock" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                                "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setShowSaleModal(true) }}
                                  disabled={item.availableStock === 0}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 disabled:opacity-40 cursor-pointer"
                                  title="Record Batch Sale"
                                >
                                  <DollarSign className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setShowQRModal(true) }}
                                  className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300 cursor-pointer"
                                  title="View QR Code & Customer Provenance"
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Right Col: Selected Item Card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Batch Stock Summary</span>
                  {selectedItem && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                      {selectedItem.batchId}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {selectedItem ? (
                  <>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-2 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{selectedItem.product}</span>
                        <span className="text-xs font-bold text-purple-600">${selectedItem.pricePerUnit.toFixed(2)} /{selectedItem.unit}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                        <div><strong className="text-slate-700 dark:text-slate-300">Category:</strong> {selectedItem.category}</div>
                        <div><strong className="text-slate-700 dark:text-slate-300">Stock Available:</strong> {selectedItem.availableStock} {selectedItem.unit}</div>
                        <div><strong className="text-slate-700 dark:text-slate-300">Arrival Date:</strong> {selectedItem.arrivalDate}</div>
                        <div><strong className="text-slate-700 dark:text-slate-300">Expiry Date:</strong> {selectedItem.expiryDate}</div>
                      </div>
                    </div>

                    {/* AI Quality & Cold Chain Banner */}
                    <div className="p-3 rounded-2xl border bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-purple-900 dark:text-purple-200">
                        <span>AI Quality Score: {selectedItem.aiQualityScore}% (Grade A+)</span>
                        <span>{selectedItem.tempStatus}</span>
                      </div>
                      <p className="text-[11px] text-purple-700 dark:text-purple-300">
                        Origin: {selectedItem.originFarm} ➔ {selectedItem.processor}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => setShowSaleModal(true)}
                        disabled={selectedItem.availableStock === 0}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Record Sale
                      </button>
                      <button
                        onClick={() => setShowWasteModal(true)}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Log Food Waste
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Select an item from inventory to inspect details.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: CUSTOMER ORDER MANAGEMENT ==================== */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search order ID, customer name, batch..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                <Filter className="h-3.5 w-3.5" /> Order Status:
              </span>
              {["All", "Placed", "Confirmed", "Preparing", "Ready", "Delivered"].map(st => (
                <button
                  key={st}
                  onClick={() => setOrderStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    orderStatusFilter === st
                      ? "bg-purple-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-purple-600" />
                  <span>Customer Order Lifecycle Queue</span>
                </span>
                <span className="text-xs font-normal text-muted-foreground">Showing {filteredOrders.length} customer orders</span>
              </CardTitle>
              <CardDescription>
                Progress order lifecycle: Placed ➔ Confirmed ➔ Preparing ➔ Ready ➔ Delivered (with explicit batch linkage).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="py-3 px-3">Order ID / Date</th>
                      <th className="py-3 px-3">Customer Details</th>
                      <th className="py-3 px-3">Item & Linked Batch</th>
                      <th className="py-3 px-3">Quantity & Price</th>
                      <th className="py-3 px-3">Lifecycle Progress</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-purple-600 dark:text-purple-400">{o.id}</div>
                          <div className="text-[10px] text-muted-foreground">{o.timestamp}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{o.customerName}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{o.customerPhone}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{o.product}</div>
                          <div className="text-[10px] text-purple-600 font-mono">Linked Batch: {o.batchId}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{o.quantity} {o.unit}</div>
                          <div className="text-[10px] text-emerald-600 font-bold">${o.totalAmount.toFixed(2)} ({o.paymentStatus})</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            o.status === "Delivered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                            o.status === "Ready" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                            o.status === "Preparing" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                            o.status === "Confirmed" ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" :
                            o.status === "Rejected" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                            "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {o.status === "Placed" && (
                              <>
                                <button
                                  onClick={() => handleUpdateOrderStatus(o.id, "Confirmed")}
                                  className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 cursor-pointer flex items-center gap-0.5"
                                >
                                  <Check className="h-3 w-3" /> Accept
                                </button>
                                <button
                                  onClick={() => handleUpdateOrderStatus(o.id, "Rejected")}
                                  className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700 cursor-pointer flex items-center gap-0.5"
                                >
                                  <Ban className="h-3 w-3" /> Reject
                                </button>
                              </>
                            )}
                            {o.status === "Confirmed" && (
                              <button
                                onClick={() => handleUpdateOrderStatus(o.id, "Preparing")}
                                className="px-2 py-1 rounded-lg bg-amber-600 text-white font-bold text-[10px] hover:bg-amber-700 cursor-pointer"
                              >
                                Start Preparing
                              </button>
                            )}
                            {o.status === "Preparing" && (
                              <button
                                onClick={() => handleUpdateOrderStatus(o.id, "Ready")}
                                className="px-2 py-1 rounded-lg bg-blue-600 text-white font-bold text-[10px] hover:bg-blue-700 cursor-pointer"
                              >
                                Mark Ready
                              </button>
                            )}
                            {o.status === "Ready" && (
                              <button
                                onClick={() => handleUpdateOrderStatus(o.id, "Delivered")}
                                className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 cursor-pointer"
                              >
                                Complete Delivery
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== TAB 3: PRODUCT QR & PROVENANCE TRACEABILITY ==================== */}
      {activeTab === "qr" && (
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-purple-600" />
                <span>Customer Provenance Inspector & QR Code Scanner</span>
              </CardTitle>
              <CardDescription>
                Build 100% customer trust by allowing customers to scan batch QR codes and verify the full Farm ➔ Processor ➔ Distributor ➔ Retailer supply chain history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Select Batch */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Batch to Inspect QR:</span>
                <select
                  value={selectedItem?.id || ""}
                  onChange={(e) => {
                    const found = inventory.find(i => i.id === e.target.value)
                    if (found) setSelectedItem(found)
                  }}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground font-bold focus:ring-2 focus:ring-purple-500/50"
                >
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.batchId} — {i.product} ({i.availableStock} {i.unit} in stock)
                    </option>
                  ))}
                </select>
              </div>

              {selectedItem && (
                <div className="grid gap-6 md:grid-cols-3">
                  {/* QR Box */}
                  <div className="p-6 rounded-3xl bg-slate-900 text-white flex flex-col items-center text-center space-y-4 shadow-xl border border-purple-500/30">
                    <div className="p-4 bg-white rounded-2xl shadow-inner">
                      <svg className="w-36 h-36 text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                        <rect x="0" y="0" width="30" height="30" />
                        <rect x="5" y="5" width="20" height="20" fill="white" />
                        <rect x="10" y="10" width="10" height="10" fill="currentColor" />
                        <rect x="70" y="0" width="30" height="30" />
                        <rect x="75" y="5" width="20" height="20" fill="white" />
                        <rect x="80" y="10" width="10" height="10" fill="currentColor" />
                        <rect x="0" y="70" width="30" height="30" />
                        <rect x="5" y="75" width="20" height="20" fill="white" />
                        <rect x="10" y="80" width="10" height="10" fill="currentColor" />
                        <rect x="40" y="10" width="15" height="15" />
                        <rect x="40" y="40" width="20" height="20" />
                        <rect x="70" y="40" width="15" height="15" />
                        <rect x="10" y="40" width="15" height="15" />
                        <rect x="70" y="70" width="20" height="20" />
                        <rect x="40" y="70" width="15" height="15" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-mono text-sm font-extrabold tracking-widest text-purple-400">{selectedItem.batchId}</span>
                      <p className="text-xs text-slate-300 font-bold mt-1">{selectedItem.product}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">${selectedItem.pricePerUnit.toFixed(2)} /{selectedItem.unit}</p>
                    </div>

                    <div className="w-full pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1 text-left">
                      <div><strong className="text-slate-200">Origin:</strong> {selectedItem.originFarm}</div>
                      <div><strong className="text-slate-200">AI Quality:</strong> {selectedItem.aiQualityScore}% Grade A+</div>
                      <div><strong className="text-slate-200">Expiry:</strong> {selectedItem.expiryDate}</div>
                    </div>
                  </div>

                  {/* 4-Stage Provenance Timeline */}
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span>4-Stage Farm-to-Fork Customer Provenance Timeline</span>
                    </h3>

                    <div className="relative pl-6 space-y-6 border-l-2 border-purple-500/30">
                      {/* Stage 1: Farm */}
                      <div className="relative space-y-1">
                        <div className="absolute -left-[31px] top-0 h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                          🌾
                        </div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">1. Origin Farm Harvest</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">100% Organic Verified</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{selectedItem.originFarm}</p>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          Initial Inspection Score: <strong className="text-emerald-600">{selectedItem.aiQualityScore}% Score</strong>
                        </div>
                      </div>

                      {/* Stage 2: Processing */}
                      <div className="relative space-y-1">
                        <div className="absolute -left-[31px] top-0 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                          🏭
                        </div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">2. Processing & Packaging</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">Passed Quality Test</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{selectedItem.processor}</p>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          Batch Sealed & Labelled · Batch ID: {selectedItem.batchId}
                        </div>
                      </div>

                      {/* Stage 3: Distributor */}
                      <div className="relative space-y-1">
                        <div className="absolute -left-[31px] top-0 h-6 w-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                          🚛
                        </div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">3. Cold-Chain Distribution</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${selectedItem.tempViolation ? "bg-rose-100 text-rose-800" : "bg-purple-100 text-purple-800"}`}>
                            {selectedItem.tempStatus}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{selectedItem.distributor} (Vehicle: {selectedItem.vehicleNo})</p>
                      </div>

                      {/* Stage 4: Retailer */}
                      <div className="relative space-y-1">
                        <div className="absolute -left-[31px] top-0 h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                          🏪
                        </div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">4. Store Shelf Receiving</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Ready for Sale</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Received on {selectedItem.arrivalDate} · Expiry: {selectedItem.expiryDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== TAB 4: EXPIRY & QUALITY ALERTS ==================== */}
      {activeTab === "alerts" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-rose-500/30 bg-rose-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Near Expiry (&le; 3 Days)
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-rose-600">{nearExpiryCount}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Recommend discount or immediate sale</p>
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                  <Flame className="h-4 w-4" /> Temp Violation Exposed
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-amber-600">{tempViolationCount}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Exceeded safe transit temperature</p>
              </CardContent>
            </Card>

            <Card className="border-purple-500/30 bg-purple-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-purple-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Low AI Quality (&lt;70%)
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-purple-600">0</div>
                <p className="text-[11px] text-muted-foreground mt-1">Quality inspection verified</p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30 bg-blue-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                  <ShieldAlert className="h-4 w-4" /> Damaged Produce Flag
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-blue-600">0</div>
                <p className="text-[11px] text-muted-foreground mt-1">No physical damage detected</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <span>AI Spoilage & Quality Risk Matrix</span>
              </CardTitle>
              <CardDescription>
                AI predicts remaining shelf life and highlights batches needing immediate retailer action before customer checkout.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="py-3 px-3">Batch / Product</th>
                      <th className="py-3 px-3">Stock Available</th>
                      <th className="py-3 px-3">AI Quality Score</th>
                      <th className="py-3 px-3">Expiry Date</th>
                      <th className="py-3 px-3">Remaining Shelf Life</th>
                      <th className="py-3 px-3">Risk Flags</th>
                      <th className="py-3 px-3 text-right">Retailer Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {inventory.map(item => {
                      const isNearExpiry = item.shelfLifeDays <= 3 && item.availableStock > 0
                      const isTempBreached = item.tempViolation && item.availableStock > 0

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{item.product}</div>
                            <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400">{item.batchId}</div>
                          </td>
                          <td className="py-3 px-3 font-bold">{item.availableStock} {item.unit}</td>
                          <td className="py-3 px-3 font-bold text-emerald-600">{item.aiQualityScore}% Score</td>
                          <td className="py-3 px-3 text-muted-foreground">{item.expiryDate}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isNearExpiry ? "bg-rose-500" : item.shelfLifeDays <= 7 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${Math.min(100, (item.shelfLifeDays / 20) * 100)}%` }}
                                ></div>
                              </div>
                              <span className={`font-bold ${isNearExpiry ? "text-rose-600" : "text-slate-700 dark:text-slate-300"}`}>
                                {item.shelfLifeDays} days
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap items-center gap-1">
                              {isNearExpiry && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" /> Near Expiry
                                </span>
                              )}
                              {isTempBreached && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-0.5">
                                  <Flame className="h-3 w-3" /> Temp Violation
                                </span>
                              )}
                              {!isNearExpiry && !isTempBreached && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  Optimal Condition
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {isNearExpiry ? "⚡ Apply 30% Clearance Discount" : isTempBreached ? "⚠️ Inspect Quality Before Sale" : "✅ Normal Shelf Sale"}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== TAB 5: SALES ANALYTICS & AI DEMAND PREDICTION ==================== */}
      {activeTab === "sales" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <BarChart3 className="h-4 w-4 text-purple-600" /> Revenue Timeframe View:
            </span>
            <div className="flex items-center gap-2">
              {(["daily", "weekly"] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setSalesTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer capitalize transition-colors ${
                    salesTimeframe === tf
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {tf} View
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Revenue Trend Chart */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{salesTimeframe === "daily" ? "Today's Hourly Revenue Trend" : "Weekly Sales vs Demand Forecast"}</span>
                  <span className="text-xs font-normal text-muted-foreground">${totalSalesRevenue.toFixed(2)} Total Revenue</span>
                </CardTitle>
                <CardDescription>
                  {salesTimeframe === "daily"
                    ? "Hourly point-of-sale checkout revenue."
                    : "Predicted vs actual sales demand by day."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  {salesTimeframe === "daily" ? (
                    <AreaChart data={DAILY_SALES_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                      <Area type="monotone" dataKey="revenue" stroke="#9333ea" fill="#9333ea" fillOpacity={0.2} strokeWidth={2} name="Revenue ($)" />
                    </AreaChart>
                  ) : (
                    <BarChart data={WEEKLY_DEMAND}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                      <Bar dataKey="forecast" fill="#9333ea" fillOpacity={0.4} radius={[4,4,0,0]} name="AI Forecast" />
                      <Bar dataKey="actual" fill="#10b981" radius={[4,4,0,0]} name="Actual Sales" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Velocity Leaderboard (Best vs Slow) */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                  <span>Product Sales Velocity</span>
                </CardTitle>
                <CardDescription>Best-sellers vs slow-moving inventory.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                    🔥 Best-Selling Produce
                  </span>
                  <div className="mt-1 space-y-2">
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Alphonso Mangoes</p>
                        <p className="text-[10px] text-muted-foreground">High turnover rate</p>
                      </div>
                      <span className="font-extrabold text-emerald-600">+24% growth</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Organic Avocados</p>
                        <p className="text-[10px] text-muted-foreground">Consistent sales</p>
                      </div>
                      <span className="font-extrabold text-emerald-600">+18% growth</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                    🐢 Slow-Moving Stock Alert
                  </span>
                  <div className="mt-1 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Premium Whole Milk</p>
                      <p className="text-[10px] text-muted-foreground">Slow turnover (3 days shelf-life)</p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Clearance Rec.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Next-Week Demand Forecasting Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <span>AI Next-Week Stock Demand Forecast</span>
              </CardTitle>
              <CardDescription>
                AI predicts upcoming stock requirements per category to prevent overstocking and reduce store food wastage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="py-3 px-3">Product Name</th>
                      <th className="py-3 px-3">Current Stock</th>
                      <th className="py-3 px-3">AI Predicted Demand (7 Days)</th>
                      <th className="py-3 px-3">Recommended Order Qty</th>
                      <th className="py-3 px-3 text-right">Inventory AI Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[
                      { product: "Organic Avocados", current: "140 kg", forecast: "160 kg", order: "30 kg", status: "Sufficient", color: "text-emerald-600" },
                      { product: "Fresh Vine Tomatoes", current: "38 kg", forecast: "120 kg", order: "85 kg", status: "Reorder Required", color: "text-amber-600 font-bold" },
                      { product: "Premium Whole Milk", current: "15 L", forecast: "60 L", order: "45 L", status: "Clearance First", color: "text-rose-600 font-bold" },
                      { product: "Alphonso Mangoes", current: "0 kg", forecast: "200 kg", order: "200 kg", status: "Out of Stock (Reorder)", color: "text-rose-600 font-bold" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{row.product}</td>
                        <td className="py-3 px-3 font-medium">{row.current}</td>
                        <td className="py-3 px-3 font-bold text-purple-600">{row.forecast}</td>
                        <td className="py-3 px-3 font-bold text-emerald-600">{row.order}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`text-[11px] ${row.color}`}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== TAB 6: FOOD WASTE & LOSS TRACKING ==================== */}
      {activeTab === "waste" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-rose-500/30 bg-rose-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                  <DollarSign className="h-4 w-4" /> Total Financial Loss
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-rose-600">${totalFinancialLoss.toFixed(2)}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Direct monetary loss from waste</p>
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                  <Trash2 className="h-4 w-4" /> Total Wasted Quantity
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-amber-600">{totalWastedQty} units/kg</div>
                <p className="text-[11px] text-muted-foreground mt-1">Logged spoiled or damaged stock</p>
              </CardContent>
            </Card>

            <Card className="border-purple-500/30 bg-purple-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-purple-600 flex items-center gap-1">
                  <PieChart className="h-4 w-4" /> Store Waste Rate
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-purple-600">{wasteRatePercent}%</div>
                <p className="text-[11px] text-muted-foreground mt-1">% of total inventory lost</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <Sparkles className="h-4 w-4" /> AI Spoilage Prevention
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-emerald-600">85%</div>
                <p className="text-[11px] text-muted-foreground mt-1">Wastage prevented via AI alerts</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-rose-600" />
                  <span>Food Waste & Spoilage Audit Log</span>
                </span>
                <button
                  onClick={() => setShowWasteModal(true)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  + Log Food Waste
                </button>
              </CardTitle>
              <CardDescription>
                Track expired, damaged, or temperature-exposed produce and calculate financial loss to optimize supply chain sustainability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="py-3 px-3">Waste Log ID</th>
                      <th className="py-3 px-3">Batch & Product</th>
                      <th className="py-3 px-3">Quantity Wasted</th>
                      <th className="py-3 px-3">Unit Cost</th>
                      <th className="py-3 px-3">Financial Loss ($)</th>
                      <th className="py-3 px-3">Waste Reason</th>
                      <th className="py-3 px-3">Date Logged</th>
                      <th className="py-3 px-3">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {wasteLogs.map(w => (
                      <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="py-3 px-3 font-mono text-slate-500">{w.id}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{w.product}</div>
                          <div className="text-[10px] font-mono text-purple-600">{w.batchId}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-rose-600">{w.quantityWasted} {w.unit}</td>
                        <td className="py-3 px-3 text-muted-foreground">${w.unitCost.toFixed(2)}</td>
                        <td className="py-3 px-3 font-extrabold text-rose-600">${w.financialLoss.toFixed(2)}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            {w.reason}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{w.loggedDate}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{w.loggedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== RECORD SALE MODAL ==================== */}
      {showSaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <span>Record Batch Sale</span>
              </h3>
              <button onClick={() => setShowSaleModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleRecordSaleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Select Batch to Sell From</label>
                <select
                  value={selectedItem?.id || ""}
                  onChange={(e) => {
                    const found = inventory.find(i => i.id === e.target.value)
                    if (found) setSelectedItem(found)
                  }}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-bold"
                >
                  {inventory.filter(i => i.availableStock > 0).map(i => (
                    <option key={i.id} value={i.id}>
                      {i.product} ({i.batchId}) — Available: {i.availableStock} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              {selectedItem && (
                <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-1">
                  <p className="font-bold text-purple-900 dark:text-purple-200">{selectedItem.product} ({selectedItem.batchId})</p>
                  <p className="text-[11px] text-purple-700 dark:text-purple-300">
                    Unit Selling Price: <strong className="font-bold">${selectedItem.pricePerUnit.toFixed(2)} /{selectedItem.unit}</strong> · Available: {selectedItem.availableStock} {selectedItem.unit}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Quantity Sold ({selectedItem?.unit || "kg"})</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItem?.availableStock || 999}
                    required
                    value={saleQty}
                    onChange={e => setSaleQty(parseInt(e.target.value) || 0)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Method</label>
                  <select
                    value={salePayment}
                    onChange={e => setSalePayment(e.target.value as any)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-bold"
                  >
                    <option value="UPI">UPI / Digital</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Credit / Debit Card</option>
                    <option value="Crypto">Crypto Wallet</option>
                  </select>
                </div>
              </div>

              {selectedItem && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200">
                  <span>Calculated Total Revenue:</span>
                  <span className="text-base">${(saleQty * selectedItem.pricePerUnit).toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowSaleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Complete Sale & Auto-Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== LOG FOOD WASTE MODAL ==================== */}
      {showWasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-600" />
                <span>Log Food Waste / Spoilage</span>
              </h3>
              <button onClick={() => setShowWasteModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleLogWasteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Select Batch to Log Waste</label>
                <select
                  value={selectedItem?.id || inventory[0]?.id || ""}
                  onChange={(e) => {
                    const found = inventory.find(i => i.id === e.target.value)
                    if (found) setSelectedItem(found)
                  }}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-bold"
                >
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.product} ({i.batchId}) — Stock: {i.availableStock} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              {selectedItem && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-1">
                  <p className="font-bold text-rose-900 dark:text-rose-200">{selectedItem.product} ({selectedItem.batchId})</p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    Unit Cost: <strong className="font-bold">${selectedItem.costPerUnit.toFixed(2)} /{selectedItem.unit}</strong> · Available Stock: {selectedItem.availableStock} {selectedItem.unit}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Quantity Wasted ({selectedItem?.unit || "kg"})</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItem?.availableStock || 999}
                    required
                    value={wasteQty}
                    onChange={e => setWasteQty(parseInt(e.target.value) || 0)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Reason for Waste</label>
                  <select
                    value={wasteReason}
                    onChange={e => setWasteReason(e.target.value as any)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-bold"
                  >
                    <option value="Expired Shelf-Life">Expired Shelf-Life</option>
                    <option value="Cold-Chain Temp Breach">Cold-Chain Temp Breach</option>
                    <option value="Packaging Damage">Packaging Damage</option>
                    <option value="Overstock Spoilage">Overstock Spoilage</option>
                  </select>
                </div>
              </div>

              {selectedItem && (
                <div className="p-3 rounded-2xl bg-rose-100 text-rose-900 dark:bg-rose-950/50 flex items-center justify-between font-bold">
                  <span>Estimated Financial Loss:</span>
                  <span className="text-base text-rose-600">${(wasteQty * selectedItem.costPerUnit).toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowWasteModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  Log Waste & Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ADD BATCH MODAL ==================== */}
      {showAddBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-600" />
                <span>Add Incoming Batch to Store Inventory</span>
              </h3>
              <button onClick={() => setShowAddBatchModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddBatchSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Product Name</label>
                  <input
                    type="text"
                    required
                    value={newBatch.product}
                    onChange={e => setNewBatch({ ...newBatch, product: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    value={newBatch.category}
                    onChange={e => setNewBatch({ ...newBatch, category: e.target.value as any })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  >
                    <option value="Fruits">Fruits</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Meat">Meat</option>
                    <option value="Grains">Grains</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Batch ID</label>
                  <input
                    type="text"
                    required
                    value={newBatch.batchId}
                    onChange={e => setNewBatch({ ...newBatch, batchId: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Stock Qty</label>
                  <input
                    type="number"
                    required
                    value={newBatch.availableStock}
                    onChange={e => setNewBatch({ ...newBatch, availableStock: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newBatch.pricePerUnit}
                    onChange={e => setNewBatch({ ...newBatch, pricePerUnit: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Origin Farm</label>
                  <input
                    type="text"
                    required
                    value={newBatch.originFarm}
                    onChange={e => setNewBatch({ ...newBatch, originFarm: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Processor</label>
                  <input
                    type="text"
                    required
                    value={newBatch.processor}
                    onChange={e => setNewBatch({ ...newBatch, processor: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddBatchModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Add to Store Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== QR CODE MODAL ==================== */}
      {showQRModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <QrCode className="h-5 w-5 text-purple-600" />
                <span>Customer QR Verification</span>
              </h3>
              <button onClick={() => setShowQRModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl shadow-inner inline-block">
              <svg className="w-40 h-40 text-slate-900 mx-auto" viewBox="0 0 100 100" fill="currentColor">
                <rect x="0" y="0" width="30" height="30" />
                <rect x="5" y="5" width="20" height="20" fill="white" />
                <rect x="10" y="10" width="10" height="10" fill="currentColor" />
                <rect x="70" y="0" width="30" height="30" />
                <rect x="75" y="5" width="20" height="20" fill="white" />
                <rect x="80" y="10" width="10" height="10" fill="currentColor" />
                <rect x="0" y="70" width="30" height="30" />
                <rect x="5" y="75" width="20" height="20" fill="white" />
                <rect x="10" y="80" width="10" height="10" fill="currentColor" />
                <rect x="40" y="10" width="15" height="15" />
                <rect x="40" y="40" width="20" height="20" />
                <rect x="70" y="40" width="15" height="15" />
                <rect x="10" y="40" width="15" height="15" />
                <rect x="70" y="70" width="20" height="20" />
                <rect x="40" y="70" width="15" height="15" />
              </svg>
            </div>

            <div>
              <p className="font-mono font-extrabold text-sm text-purple-600 dark:text-purple-400">{selectedItem.batchId}</p>
              <h4 className="font-bold text-slate-900 dark:text-white mt-1">{selectedItem.product}</h4>
              <p className="text-xs text-muted-foreground">${selectedItem.pricePerUnit.toFixed(2)} /{selectedItem.unit}</p>
            </div>

            <div className="pt-2 text-xs text-left bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl space-y-1">
              <div><strong className="text-slate-700 dark:text-slate-300">Farm:</strong> {selectedItem.originFarm}</div>
              <div><strong className="text-slate-700 dark:text-slate-300">Processor:</strong> {selectedItem.processor}</div>
              <div><strong className="text-slate-700 dark:text-slate-300">AI Quality:</strong> {selectedItem.aiQualityScore}% Grade A+</div>
            </div>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-2.5 rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
