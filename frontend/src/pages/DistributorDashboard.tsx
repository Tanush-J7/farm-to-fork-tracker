import { useState, useEffect } from "react"
import {
  Package, Truck, CheckCircle, Zap, AlertTriangle, Plus, Search,
  QrCode, Thermometer, MapPin, Clock, ShieldAlert,
  Edit3, Phone, User, X, Filter, Flame, Snowflake
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useAuth } from "../context/AuthContext"

export interface Shipment {
  id: string
  batchId: string
  product: string
  category: "Fruits" | "Vegetables" | "Dairy" | "Meat" | "Grains"
  quantity: string
  processor: string
  retailer: string
  vehicleNo: string
  vehicleType: string
  driverName: string
  driverPhone: string
  driverLicense: string
  status: "Packed" | "In Transit" | "Delivered"
  location: string
  dispatchDate: string
  deliveryDate?: string
  expectedDelivery: string
  lastTemp: number
  lastHumidity: number
  tempSafeMin: number
  tempSafeMax: number
  coldChainViolation: boolean
  violationMessage?: string
  expiryDate: string
  shelfLifeDays: number
  aiQualityScore: number
  damageFlag: boolean
  notes: string
  history: { time: string; location: string; status: string; temp?: number; notes?: string }[]
}

export interface TelemetryLog {
  id: string
  shipmentId: string
  batchId: string
  product: string
  timestamp: string
  temperature: number
  humidity: number
  location: string
  safeMin: number
  safeMax: number
  status: "Normal" | "Warning" | "Critical Violation"
  loggedBy: string
}

const DEFAULT_SHIPMENTS: Shipment[] = [
  {
    id: "SHP-2026-001",
    batchId: "BTC-AVO-991",
    product: "Organic Avocados",
    category: "Fruits",
    quantity: "450 kg",
    processor: "Valley Organic Foods",
    retailer: "FreshMart Supermarket",
    vehicleNo: "TN-01-AX-3421",
    vehicleType: "Reefer Truck (2°C - 8°C)",
    driverName: "Raj Kumar",
    driverPhone: "+91 98765 43210",
    driverLicense: "DL-TN01-2019-8812",
    status: "In Transit",
    location: "Pune Cold Storage Hub, MH",
    dispatchDate: "2026-09-05 08:30",
    expectedDelivery: "2026-09-07 14:00",
    lastTemp: 5.2,
    lastHumidity: 75,
    tempSafeMin: 4,
    tempSafeMax: 8,
    coldChainViolation: false,
    expiryDate: "2026-09-18",
    shelfLifeDays: 12,
    aiQualityScore: 94,
    damageFlag: false,
    notes: "Temperature stable. Vehicle refrigerated unit active.",
    history: [
      { time: "2026-09-05 08:30", location: "Valley Organic Processing Plant", status: "Packed", temp: 4.8, notes: "Loaded into Reefer Truck" },
      { time: "2026-09-05 16:45", location: "Pune Cold Storage Hub, MH", status: "In Transit", temp: 5.2, notes: "Midway checkpoint cleared" }
    ]
  },
  {
    id: "SHP-2026-002",
    batchId: "BTC-MILK-402",
    product: "Premium Whole Milk",
    category: "Dairy",
    quantity: "600 L",
    processor: "GreenDairy Processing",
    retailer: "Metro Hypermarket",
    vehicleNo: "KA-04-BC-8812",
    vehicleType: "Refrigerated Milk Tanker (2°C - 4°C)",
    driverName: "Suresh Babu",
    driverPhone: "+91 98123 45678",
    driverLicense: "DL-KA04-2020-5511",
    status: "In Transit",
    location: "Highway NH-48 Checkpoint",
    dispatchDate: "2026-09-06 05:00",
    expectedDelivery: "2026-09-06 18:00",
    lastTemp: 9.8,
    lastHumidity: 82,
    tempSafeMin: 2,
    tempSafeMax: 4,
    coldChainViolation: true,
    violationMessage: "Temperature spiked to 9.8°C (Safe limit: 2°C - 4°C)",
    expiryDate: "2026-09-09",
    shelfLifeDays: 3,
    aiQualityScore: 82,
    damageFlag: false,
    notes: "Alert: Refrigeration compressor power fluctuation detected on NH-48.",
    history: [
      { time: "2026-09-06 05:00", location: "GreenDairy Facility", status: "Packed", temp: 3.1, notes: "Dispatched under chill protocol" },
      { time: "2026-09-06 07:30", location: "Highway NH-48 Checkpoint", status: "In Transit", temp: 9.8, notes: "🚨 Temperature spike recorded!" }
    ]
  },
  {
    id: "SHP-2026-003",
    batchId: "BTC-TOM-108",
    product: "Fresh Vine Tomatoes",
    category: "Vegetables",
    quantity: "320 kg",
    processor: "AgroPack Terminal",
    retailer: "City Organic Store",
    vehicleNo: "MH-12-GH-5530",
    vehicleType: "Insulated Van (8°C - 12°C)",
    driverName: "Anil Sharma",
    driverPhone: "+91 97654 32109",
    driverLicense: "DL-MH12-2018-9943",
    status: "Packed",
    location: "Nashik Dispatch Yard",
    dispatchDate: "2026-09-06 09:00",
    expectedDelivery: "2026-09-07 12:00",
    lastTemp: 10.1,
    lastHumidity: 68,
    tempSafeMin: 8,
    tempSafeMax: 12,
    coldChainViolation: false,
    expiryDate: "2026-09-22",
    shelfLifeDays: 16,
    aiQualityScore: 91,
    damageFlag: false,
    notes: "Packed and ready for driver pickup.",
    history: [
      { time: "2026-09-06 09:00", location: "Nashik Dispatch Yard", status: "Packed", temp: 10.1, notes: "Awaiting departure" }
    ]
  },
  {
    id: "SHP-2026-004",
    batchId: "BTC-MNG-505",
    product: "Alphonso Mangoes",
    category: "Fruits",
    quantity: "500 kg",
    processor: "Konkan Processing Co.",
    retailer: "Global Harvest Market",
    vehicleNo: "MH-04-DE-9912",
    vehicleType: "Reefer Truck (4°C - 8°C)",
    driverName: "Ramesh Patel",
    driverPhone: "+91 99222 11000",
    driverLicense: "DL-MH04-2017-3312",
    status: "Delivered",
    location: "Mumbai Terminal Store",
    dispatchDate: "2026-09-04 10:00",
    deliveryDate: "2026-09-05 16:30",
    expectedDelivery: "2026-09-05 18:00",
    lastTemp: 5.5,
    lastHumidity: 70,
    tempSafeMin: 4,
    tempSafeMax: 8,
    coldChainViolation: false,
    expiryDate: "2026-09-14",
    shelfLifeDays: 8,
    aiQualityScore: 96,
    damageFlag: false,
    notes: "Delivered successfully. Store manager signed digital receipt.",
    history: [
      { time: "2026-09-04 10:00", location: "Konkan Processing Co.", status: "Packed", temp: 5.0, notes: "Dispatched" },
      { time: "2026-09-05 16:30", location: "Mumbai Terminal Store", status: "Delivered", temp: 5.5, notes: "Handed over to retailer" }
    ]
  }
]

const DEFAULT_TELEMETRY: TelemetryLog[] = [
  { id: "LOG-101", shipmentId: "SHP-2026-001", batchId: "BTC-AVO-991", product: "Organic Avocados", timestamp: "2026-09-06 08:00", temperature: 5.2, humidity: 75, location: "Pune Hub", safeMin: 4, safeMax: 8, status: "Normal", loggedBy: "Raj Kumar (Driver)" },
  { id: "LOG-102", shipmentId: "SHP-2026-002", batchId: "BTC-MILK-402", product: "Premium Whole Milk", timestamp: "2026-09-06 07:30", temperature: 9.8, humidity: 82, location: "NH-48 Checkpoint", safeMin: 2, safeMax: 4, status: "Critical Violation", loggedBy: "IoT Sensor #44" },
  { id: "LOG-103", shipmentId: "SHP-2026-003", batchId: "BTC-TOM-108", product: "Fresh Vine Tomatoes", timestamp: "2026-09-06 09:15", temperature: 10.1, humidity: 68, location: "Nashik Yard", safeMin: 8, safeMax: 12, status: "Normal", loggedBy: "Anil Sharma (Driver)" },
  { id: "LOG-104", shipmentId: "SHP-2026-004", batchId: "BTC-MNG-505", product: "Alphonso Mangoes", timestamp: "2026-09-05 16:30", temperature: 5.5, humidity: 70, location: "Mumbai Terminal", safeMin: 4, safeMax: 8, status: "Normal", loggedBy: "Store Inspector" },
]

const PERFORMANCE_DATA = [
  { day: "Mon", deliveries: 8, onTime: 7, coldChainBreaches: 0 },
  { day: "Tue", deliveries: 12, onTime: 11, coldChainBreaches: 0 },
  { day: "Wed", deliveries: 9, onTime: 9, coldChainBreaches: 1 },
  { day: "Thu", deliveries: 15, onTime: 13, coldChainBreaches: 0 },
  { day: "Fri", deliveries: 18, onTime: 16, coldChainBreaches: 0 },
  { day: "Sat", deliveries: 11, onTime: 10, coldChainBreaches: 1 },
]

export function DistributorDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<"shipments" | "coldchain" | "traceability" | "risk">("shipments")

  // Persistent storage state
  const [shipments, setShipments] = useState<Shipment[]>(() => {
    try {
      const saved = localStorage.getItem("farmchain_distributor_shipments")
      return saved ? JSON.parse(saved) : DEFAULT_SHIPMENTS
    } catch {
      return DEFAULT_SHIPMENTS
    }
  })

  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLog[]>(() => {
    try {
      const saved = localStorage.getItem("farmchain_distributor_telemetry")
      return saved ? JSON.parse(saved) : DEFAULT_TELEMETRY
    } catch {
      return DEFAULT_TELEMETRY
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem("farmchain_distributor_shipments", JSON.stringify(shipments))
    } catch (e) {
      console.warn("Error saving shipments", e)
    }
  }, [shipments])

  useEffect(() => {
    try {
      localStorage.setItem("farmchain_distributor_telemetry", JSON.stringify(telemetryLogs))
    } catch (e) {
      console.warn("Error saving telemetry logs", e)
    }
  }, [telemetryLogs])

  // Filters & Selected States
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(shipments[0] || null)

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showTelemetryModal, setShowTelemetryModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)

  // Form states for Create Shipment
  const [newShipment, setNewShipment] = useState({
    batchId: `BTC-${Math.floor(100 + Math.random() * 900)}`,
    product: "Fresh Produce Batch",
    category: "Vegetables" as const,
    quantity: "350 kg",
    processor: "Green Valley Processing",
    retailer: "City Supermarket",
    vehicleNo: "MH-14-CZ-7720",
    vehicleType: "Reefer Truck (4°C - 8°C)",
    driverName: "Vikram Singh",
    driverPhone: "+91 98989 12345",
    driverLicense: "DL-MH14-2021-9988",
    expectedDelivery: "2026-09-08 17:00",
    tempSafeMin: 4,
    tempSafeMax: 8,
    expiryDate: "2026-09-25",
    shelfLifeDays: 19,
    aiQualityScore: 92,
  })

  // Update Status Form state
  const [updateStatus, setUpdateStatus] = useState<"Packed" | "In Transit" | "Delivered">("In Transit")
  const [updateLocation, setUpdateLocation] = useState("")
  const [updateNotes, setUpdateNotes] = useState("")

  // Telemetry Form state
  const [telemetryTemp, setTelemetryTemp] = useState<number>(5.5)
  const [telemetryHumidity, setTelemetryHumidity] = useState<number>(72)
  const [telemetryLocation, setTelemetryLocation] = useState("")

  // Calculate Metrics
  const activeShipmentsCount = shipments.filter(s => s.status !== "Delivered").length
  const deliveredTodayCount = shipments.filter(s => s.status === "Delivered").length
  const coldChainViolationsCount = shipments.filter(s => s.coldChainViolation).length
  const nearExpiryCount = shipments.filter(s => s.shelfLifeDays <= 3 && s.status !== "Delivered").length
  const lowQualityCount = shipments.filter(s => s.aiQualityScore < 70).length

  // Filtered shipments
  const filteredShipments = shipments.filter(s => {
    const matchesStatus = statusFilter === "All" || s.status === statusFilter
    const matchesSearch =
      s.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.vehicleNo.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Handle Create Shipment Submit
  const handleCreateShipment = (e: React.FormEvent) => {
    e.preventDefault()
    const now = new Date().toISOString().replace("T", " ").substring(0, 16)
    const newId = `SHP-2026-${String(shipments.length + 1).padStart(3, "0")}`

    const created: Shipment = {
      id: newId,
      batchId: newShipment.batchId,
      product: newShipment.product,
      category: newShipment.category,
      quantity: newShipment.quantity,
      processor: newShipment.processor,
      retailer: newShipment.retailer,
      vehicleNo: newShipment.vehicleNo,
      vehicleType: newShipment.vehicleType,
      driverName: newShipment.driverName,
      driverPhone: newShipment.driverPhone,
      driverLicense: newShipment.driverLicense,
      status: "Packed",
      location: `${newShipment.processor} Facility`,
      dispatchDate: now,
      expectedDelivery: newShipment.expectedDelivery,
      lastTemp: (newShipment.tempSafeMin + newShipment.tempSafeMax) / 2,
      lastHumidity: 70,
      tempSafeMin: newShipment.tempSafeMin,
      tempSafeMax: newShipment.tempSafeMax,
      coldChainViolation: false,
      expiryDate: newShipment.expiryDate,
      shelfLifeDays: newShipment.shelfLifeDays,
      aiQualityScore: newShipment.aiQualityScore,
      damageFlag: false,
      notes: "Shipment initialized and assigned to logistics fleet.",
      history: [
        { time: now, location: `${newShipment.processor} Facility`, status: "Packed", notes: "Shipment created & loaded" }
      ]
    }

    setShipments(prev => [created, ...prev])
    setSelectedShipment(created)
    setShowCreateModal(false)
  }

  // Handle Update Status Submit
  const handleUpdateStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShipment) return

    const now = new Date().toISOString().replace("T", " ").substring(0, 16)
    const updatedHistory = [
      ...selectedShipment.history,
      {
        time: now,
        location: updateLocation || selectedShipment.location,
        status: updateStatus,
        temp: selectedShipment.lastTemp,
        notes: updateNotes || `Status updated to ${updateStatus}`
      }
    ]

    const updatedShipments = shipments.map(s => {
      if (s.id === selectedShipment.id) {
        return {
          ...s,
          status: updateStatus,
          location: updateLocation || s.location,
          deliveryDate: updateStatus === "Delivered" ? now : s.deliveryDate,
          history: updatedHistory
        }
      }
      return s
    })

    setShipments(updatedShipments)
    setSelectedShipment({
      ...selectedShipment,
      status: updateStatus,
      location: updateLocation || selectedShipment.location,
      deliveryDate: updateStatus === "Delivered" ? now : selectedShipment.deliveryDate,
      history: updatedHistory
    })
    setShowUpdateModal(false)
    setUpdateNotes("")
  }

  // Handle Log Telemetry Submit
  const handleLogTelemetrySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShipment) return

    const now = new Date().toISOString().replace("T", " ").substring(0, 16)
    const isViolation = telemetryTemp < selectedShipment.tempSafeMin || telemetryTemp > selectedShipment.tempSafeMax
    const violationMsg = isViolation
      ? `Temperature ${telemetryTemp}°C out of safe range (${selectedShipment.tempSafeMin}°C - ${selectedShipment.tempSafeMax}°C)`
      : undefined

    const newLog: TelemetryLog = {
      id: `LOG-${Math.floor(100 + Math.random() * 900)}`,
      shipmentId: selectedShipment.id,
      batchId: selectedShipment.batchId,
      product: selectedShipment.product,
      timestamp: now,
      temperature: telemetryTemp,
      humidity: telemetryHumidity,
      location: telemetryLocation || selectedShipment.location,
      safeMin: selectedShipment.tempSafeMin,
      safeMax: selectedShipment.tempSafeMax,
      status: isViolation ? "Critical Violation" : "Normal",
      loggedBy: `${user?.name || "Distributor Agent"} (${user?.role || "distributor"})`
    }

    setTelemetryLogs(prev => [newLog, ...prev])

    const updatedShipments = shipments.map(s => {
      if (s.id === selectedShipment.id) {
        return {
          ...s,
          lastTemp: telemetryTemp,
          lastHumidity: telemetryHumidity,
          coldChainViolation: isViolation || s.coldChainViolation,
          violationMessage: violationMsg || s.violationMessage,
          location: telemetryLocation || s.location,
          history: [
            ...s.history,
            {
              time: now,
              location: telemetryLocation || s.location,
              status: s.status,
              temp: telemetryTemp,
              notes: isViolation ? `🚨 Cold-Chain Violation: ${telemetryTemp}°C` : `Telemetry logged: ${telemetryTemp}°C, ${telemetryHumidity}% humidity`
            }
          ]
        }
      }
      return s
    })

    setShipments(updatedShipments)
    setSelectedShipment({
      ...selectedShipment,
      lastTemp: telemetryTemp,
      lastHumidity: telemetryHumidity,
      coldChainViolation: isViolation || selectedShipment.coldChainViolation,
      violationMessage: violationMsg || selectedShipment.violationMessage,
      location: telemetryLocation || selectedShipment.location,
      history: [
        ...selectedShipment.history,
        {
          time: now,
          location: telemetryLocation || selectedShipment.location,
          status: selectedShipment.status,
          temp: telemetryTemp,
          notes: isViolation ? `🚨 Cold-Chain Violation: ${telemetryTemp}°C` : `Telemetry logged: ${telemetryTemp}°C, ${telemetryHumidity}% humidity`
        }
      ]
    })
    setShowTelemetryModal(false)
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Distributor Details */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/20 via-slate-900/10 to-emerald-900/20 p-6 rounded-3xl border border-blue-500/20 shadow-sm">
        <div className="flex items-center gap-4">
          {user?.photo ? (
            <img
              src={user.photo}
              alt={user.name || "Distributor Logo"}
              className="h-16 w-16 rounded-2xl object-cover border-2 border-blue-500 shadow-md shrink-0"
            />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-600 font-bold text-2xl shrink-0">
              <Truck className="h-8 w-8 text-blue-600" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{user?.name || "Distributor Portal"}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/20 text-blue-600 border border-blue-500/30 capitalize">
                Fleet Logistics Hub
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">End-to-End Cold-Chain Logistics, Batch QR Traceability & AI Risk Monitoring.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(user?.phone || user?.address) && (
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/70 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
              {user.phone && (
                <div className="flex items-center gap-1.5 font-medium">
                  <Phone className="h-3.5 w-3.5 text-blue-600 shrink-0" />
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
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Shipment</span>
          </button>
        </div>
      </div>

      {/* 2. Quick Stat Counters */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { title: "Active Shipments", value: activeShipmentsCount, icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
          { title: "Delivered Today", value: deliveredTodayCount, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { title: "Cold-Chain Breaches", value: coldChainViolationsCount, icon: ShieldAlert, color: coldChainViolationsCount > 0 ? "text-rose-500 animate-pulse" : "text-slate-400", bg: coldChainViolationsCount > 0 ? "bg-rose-500/10" : "bg-slate-100 dark:bg-slate-800" },
          { title: "Near-Expiry Batches", value: nearExpiryCount, icon: Clock, color: nearExpiryCount > 0 ? "text-amber-500" : "text-slate-400", bg: "bg-amber-500/10" },
          { title: "Low Quality Flag (<70%)", value: lowQualityCount, icon: AlertTriangle, color: "text-purple-500", bg: "bg-purple-500/10" },
          { title: "AI Route Efficiency", value: "94%", icon: Zap, color: "text-emerald-500", bg: "bg-emerald-500/10" },
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
          { id: "shipments", label: "📦 Shipment & Delivery Tracking", count: shipments.length },
          { id: "coldchain", label: "🌡️ Cold-Chain & Storage Telemetry", badge: coldChainViolationsCount > 0 ? `${coldChainViolationsCount} Alerts` : undefined },
          { id: "traceability", label: "🔍 Batch Traceability & QR Code" },
          { id: "risk", label: "⚠️ Quality & Expiry Risk Center", badge: (nearExpiryCount + coldChainViolationsCount + lowQualityCount) > 0 ? `${nearExpiryCount + coldChainViolationsCount + lowQualityCount} Risk Flags` : undefined },
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
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === t.id ? "bg-blue-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`}>
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

      {/* ==================== TAB 1: SHIPMENTS & DELIVERY TRACKING ==================== */}
      {activeTab === "shipments" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search shipment, product, vehicle, driver..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                <Filter className="h-3.5 w-3.5" /> Status:
              </span>
              {["All", "Packed", "In Transit", "Delivered"].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    statusFilter === st
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left 2 Cols: Shipment Table */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-blue-600" />
                    <span>Shipment Manifest & Delivery Status</span>
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">Showing {filteredShipments.length} shipments</span>
                </CardTitle>
                <CardDescription>Tracks shipment lifecycle: Packed ➔ In Transit ➔ Delivered.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b">
                      <tr>
                        <th className="py-3 px-3">Shipment / Batch</th>
                        <th className="py-3 px-3">Product</th>
                        <th className="py-3 px-3">Vehicle & Driver</th>
                        <th className="py-3 px-3">Route (From ➔ To)</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredShipments.map(s => {
                        const isSelected = selectedShipment?.id === s.id
                        return (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedShipment(s)}
                            className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-50/70 dark:bg-blue-950/30" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/50"}`}
                          >
                            <td className="py-3 px-3">
                              <div className="font-mono font-bold text-blue-600 dark:text-blue-400">{s.id}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{s.batchId}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{s.product}</div>
                              <div className="text-[10px] text-muted-foreground">{s.category} · {s.quantity}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-medium text-slate-800 dark:text-slate-200">{s.vehicleNo}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3 text-slate-400" />
                                <span>{s.driverName}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]" title={`${s.processor} ➔ ${s.retailer}`}>
                                {s.processor} ➔ {s.retailer}
                              </div>
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 truncate max-w-[160px]">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{s.location}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                s.status === "Delivered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                                s.status === "In Transit" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" :
                                "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              }`}>
                                {s.status === "In Transit" && <Truck className="h-3 w-3 animate-bounce" />}
                                {s.status === "Delivered" && <CheckCircle className="h-3 w-3" />}
                                {s.status === "Packed" && <Package className="h-3 w-3" />}
                                <span>{s.status}</span>
                              </span>
                              {s.coldChainViolation && (
                                <div className="text-[10px] text-rose-600 font-extrabold flex items-center gap-1 mt-0.5">
                                  <Flame className="h-3 w-3" /> Cold-Chain Alert
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedShipment(s); setShowUpdateModal(true) }}
                                  className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 cursor-pointer"
                                  title="Update Status & Checkpoint Location"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedShipment(s); setShowTelemetryModal(true) }}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 cursor-pointer"
                                  title="Log Temperature Telemetry"
                                >
                                  <Thermometer className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedShipment(s); setShowQRModal(true) }}
                                  className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300 cursor-pointer"
                                  title="View QR Code & Provenance"
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

            {/* Right Col: Selected Shipment Detail */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Shipment Details</span>
                  {selectedShipment && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      {selectedShipment.id}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {selectedShipment ? (
                  <>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-2 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{selectedShipment.product}</span>
                        <span className="text-xs text-muted-foreground">{selectedShipment.quantity}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                        <div><strong className="text-slate-700 dark:text-slate-300">Batch ID:</strong> {selectedShipment.batchId}</div>
                        <div><strong className="text-slate-700 dark:text-slate-300">Category:</strong> {selectedShipment.category}</div>
                        <div><strong className="text-slate-700 dark:text-slate-300">AI Quality:</strong> {selectedShipment.aiQualityScore}% Score</div>
                        <div><strong className="text-slate-700 dark:text-slate-300">Shelf Life:</strong> {selectedShipment.shelfLifeDays} days left</div>
                      </div>
                    </div>

                    {/* Cold Chain Banner */}
                    <div className={`p-3 rounded-2xl border text-xs ${
                      selectedShipment.coldChainViolation
                        ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
                    }`}>
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          <Thermometer className="h-4 w-4 shrink-0" />
                          <span>Cold-Chain Status</span>
                        </span>
                        <span>{selectedShipment.lastTemp}°C</span>
                      </div>
                      <p className="mt-1 text-[11px]">
                        {selectedShipment.coldChainViolation
                          ? (selectedShipment.violationMessage || "🚨 Temperature spike detected outside safe range!")
                          : `Optimal temp maintained (${selectedShipment.tempSafeMin}°C - ${selectedShipment.tempSafeMax}°C safe range).`}
                      </p>
                    </div>

                    {/* Vehicle & Driver */}
                    <div className="space-y-2 p-3 rounded-2xl border bg-white dark:bg-slate-900">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle & Logistics Info</span>
                      <div className="flex items-center gap-2 pt-1">
                        <Truck className="h-4 w-4 text-blue-600 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{selectedShipment.vehicleNo}</p>
                          <p className="text-[10px] text-muted-foreground">{selectedShipment.vehicleType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <User className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{selectedShipment.driverName}</p>
                          <p className="text-[10px] text-muted-foreground">{selectedShipment.driverPhone} · License: {selectedShipment.driverLicense}</p>
                        </div>
                      </div>
                    </div>

                    {/* Timeline History */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Shipment History</span>
                      <div className="space-y-2 pl-2 border-l-2 border-blue-500/30">
                        {selectedShipment.history.map((h, idx) => (
                          <div key={idx} className="relative pl-3 space-y-0.5">
                            <div className="absolute -left-[11px] top-1 h-2 w-2 rounded-full bg-blue-600"></div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-900 dark:text-white">{h.status}</span>
                              <span className="text-[10px] text-muted-foreground">{h.time}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400">{h.location}</p>
                            {h.notes && <p className="text-[10px] italic text-muted-foreground">{h.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => setShowUpdateModal(true)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Update Location & Status
                      </button>
                      <button
                        onClick={() => setShowTelemetryModal(true)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Log Temperature
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Select a shipment to view details.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: COLD-CHAIN & TELEMETRY MONITORING ==================== */}
      {activeTab === "coldchain" && (
        <div className="space-y-6">
          {/* Cold chain breach banner if any */}
          {coldChainViolationsCount > 0 && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 flex items-start gap-3 shadow-sm animate-pulse">
              <Flame className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm">Cold-Chain Violation Alert ({coldChainViolationsCount} Batches Affected)</h4>
                <p className="text-xs">
                  Temperature sensor spikes detected outside safe ranges. Review telemetry logs immediately to prevent spoilage and quality degradation.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { category: "Dairy & Fresh Milk", range: "2°C - 4°C", icon: Snowflake, color: "text-blue-500", desc: "Strict refrigeration required to halt bacterial growth." },
              { category: "Fruits & Vegetables", range: "4°C - 8°C", icon: Thermometer, color: "text-emerald-500", desc: "Controlled humidity (70-85%) prevents moisture loss." },
              { category: "Meat & Poultry", range: "-2°C - 2°C", icon: ShieldAlert, color: "text-rose-500", desc: "Continuous deep chill monitoring required." },
            ].map(r => (
              <Card key={r.category} className="shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <span className="font-bold text-sm">{r.category}</span>
                  <r.icon className={`h-5 w-5 ${r.color}`} />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{r.range}</div>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Chart */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Logistics Delivery & Temperature Trend</span>
                  <span className="text-xs font-normal text-muted-foreground">Past 6 Days Performance</span>
                </CardTitle>
                <CardDescription>On-time deliveries vs cold-chain violation count.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={PERFORMANCE_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                    <Area type="monotone" dataKey="deliveries" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} name="Total Deliveries" />
                    <Area type="monotone" dataKey="onTime" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2} name="On-Time" />
                    <Area type="monotone" dataKey="coldChainBreaches" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.2} strokeWidth={2} name="Temp Violations" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Log Telemetry Form Quick Action */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Thermometer className="h-5 w-5 text-emerald-600" />
                  <span>Log Sensor Reading</span>
                </CardTitle>
                <CardDescription>Record temperature & humidity data for a batch.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {selectedShipment ? (
                  <form onSubmit={handleLogTelemetrySubmit} className="space-y-3">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Selected Batch</label>
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold mt-1">
                        {selectedShipment.product} ({selectedShipment.id})
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Temp (°C)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={telemetryTemp}
                          onChange={e => setTelemetryTemp(parseFloat(e.target.value))}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Humidity (%)</label>
                        <input
                          type="number"
                          value={telemetryHumidity}
                          onChange={e => setTelemetryHumidity(parseInt(e.target.value))}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Location Checkpoint</label>
                      <input
                        type="text"
                        placeholder="e.g. Pune Cold Storage Hub"
                        value={telemetryLocation}
                        onChange={e => setTelemetryLocation(e.target.value)}
                        className="w-full mt-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm"
                    >
                      Submit Telemetry Reading
                    </button>
                  </form>
                ) : (
                  <p className="text-muted-foreground text-center">Select a shipment to log telemetry.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Telemetry Logs Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Telemetry Audit Logs</CardTitle>
              <CardDescription>Real-time sensor logs recorded by drivers, inspectors, and IoT telemetry nodes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="py-3 px-3">Log ID</th>
                      <th className="py-3 px-3">Shipment / Product</th>
                      <th className="py-3 px-3">Timestamp</th>
                      <th className="py-3 px-3">Location</th>
                      <th className="py-3 px-3">Temperature</th>
                      <th className="py-3 px-3">Humidity</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {telemetryLogs.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="py-3 px-3 font-mono text-slate-500">{l.id}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{l.product}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{l.shipmentId}</div>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{l.timestamp}</td>
                        <td className="py-3 px-3 font-medium">{l.location}</td>
                        <td className="py-3 px-3">
                          <span className={`font-bold ${l.temperature < l.safeMin || l.temperature > l.safeMax ? "text-rose-600" : "text-emerald-600"}`}>
                            {l.temperature}°C
                          </span>
                          <span className="text-[10px] text-muted-foreground block">Safe: {l.safeMin}–{l.safeMax}°C</span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">{l.humidity}%</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.status === "Critical Violation"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{l.loggedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== TAB 3: BATCH TRACEABILITY & QR CODE ==================== */}
      {activeTab === "traceability" && (
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-purple-600" />
                <span>Batch Provenance & QR Code Inspector</span>
              </CardTitle>
              <CardDescription>
                Scan or select any batch QR code to inspect complete provenance across Farm ➔ Processing ➔ Distributor ➔ Retailer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Select Batch */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Batch QR Code:</span>
                <select
                  value={selectedShipment?.id || ""}
                  onChange={(e) => {
                    const found = shipments.find(s => s.id === e.target.value)
                    if (found) setSelectedShipment(found)
                  }}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground font-bold focus:ring-2 focus:ring-purple-500/50"
                >
                  {shipments.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.batchId} — {s.product} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              {selectedShipment && (
                <div className="grid gap-6 md:grid-cols-3">
                  {/* QR Card */}
                  <div className="p-6 rounded-3xl bg-slate-900 text-white flex flex-col items-center text-center space-y-4 shadow-xl border border-purple-500/30">
                    <div className="p-4 bg-white rounded-2xl shadow-inner">
                      {/* Simulating QR Code SVG */}
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
                      <span className="font-mono text-sm font-extrabold tracking-widest text-purple-400">{selectedShipment.batchId}</span>
                      <p className="text-xs text-slate-300 font-bold mt-1">{selectedShipment.product}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{selectedShipment.quantity} · {selectedShipment.category}</p>
                    </div>

                    <div className="w-full pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1 text-left">
                      <div><strong className="text-slate-200">Vehicle:</strong> {selectedShipment.vehicleNo}</div>
                      <div><strong className="text-slate-200">Driver:</strong> {selectedShipment.driverName}</div>
                      <div><strong className="text-slate-200">Status:</strong> {selectedShipment.status}</div>
                    </div>
                  </div>

                  {/* Provenance Step Timeline (2 Cols) */}
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span>Full Supply Chain Provenance Journey</span>
                    </h3>

                    <div className="relative pl-6 space-y-6 border-l-2 border-purple-500/30">
                      {/* Stage 1: Farm */}
                      <div className="relative space-y-1">
                        <div className="absolute -left-[31px] top-0 h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                          🌾
                        </div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Stage 1: Farm Harvest (Origin)</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Verified</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Green Valley Organic Farms, District 4</p>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          Harvested: 2026-09-03 · Initial Quality Inspection: <strong className="text-emerald-600">{selectedShipment.aiQualityScore}% (Grade A+)</strong>
                        </div>
                      </div>

                      {/* Stage 2: Processing */}
                      <div className="relative space-y-1">
                        <div className="absolute -left-[31px] top-0 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                          🏭
                        </div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Stage 2: Processing & Packaging</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">Completed</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{selectedShipment.processor}</p>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          Quality Tested & Sealed · Batch No: {selectedShipment.batchId}
                        </div>
                      </div>

                      {/* Stage 3: Distributor Logistics */}
                      <div className="relative space-y-1">
                        <div className="absolute -left-[31px] top-0 h-6 w-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                          🚛
                        </div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Stage 3: Distributor Logistics & Cold-Chain</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            selectedShipment.status === "Delivered" ? "bg-emerald-100 text-emerald-800" : "bg-purple-100 text-purple-800 animate-pulse"
                          }`}>
                            {selectedShipment.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Fleet Vehicle: {selectedShipment.vehicleNo} ({selectedShipment.driverName})</p>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                          <div>Current Checkpoint: <strong className="text-purple-600">{selectedShipment.location}</strong></div>
                          <div>Telemetry: {selectedShipment.lastTemp}°C · Humidity {selectedShipment.lastHumidity}%</div>
                          {selectedShipment.coldChainViolation && (
                            <div className="text-rose-600 font-bold flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Cold-Chain Spike Recorded!
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stage 4: Retailer */}
                      <div className="relative space-y-1">
                        <div className={`absolute -left-[31px] top-0 h-6 w-6 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-md ${
                          selectedShipment.status === "Delivered" ? "bg-emerald-500" : "bg-slate-400"
                        }`}>
                          🏪
                        </div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Stage 4: Retailer Destination</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            selectedShipment.status === "Delivered" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {selectedShipment.status === "Delivered" ? "Received" : "Pending Arrival"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{selectedShipment.retailer}</p>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          Expected Arrival: {selectedShipment.expectedDelivery}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== TAB 4: QUALITY, EXPIRY & AI RISK CENTER ==================== */}
      {activeTab === "risk" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-rose-500/30 bg-rose-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                  <Flame className="h-4 w-4" /> Cold-Chain Exposed
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-rose-600">{coldChainViolationsCount}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Temperature spikes outside safe zone</p>
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Near Expiry (&le; 3 Days)
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-amber-600">{nearExpiryCount}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Priority dispatch recommended</p>
              </CardContent>
            </Card>

            <Card className="border-purple-500/30 bg-purple-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-purple-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Low AI Quality (&lt;70%)
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-purple-600">{lowQualityCount}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Requires visual quality re-check</p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30 bg-blue-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                  <ShieldAlert className="h-4 w-4" /> Transit Damage Flags
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-blue-600">0</div>
                <p className="text-[11px] text-muted-foreground mt-1">Packaging integrity intact</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <span>AI Automated Quality, Expiry & Risk Matrix</span>
              </CardTitle>
              <CardDescription>
                AI predicts remaining shelf life and automatically flags high-risk batches to prevent supply chain food waste.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="py-3 px-3">Batch / Product</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">AI Quality Score</th>
                      <th className="py-3 px-3">Expiry Date</th>
                      <th className="py-3 px-3">Remaining Shelf Life</th>
                      <th className="py-3 px-3">Risk Flags</th>
                      <th className="py-3 px-3 text-right">AI Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {shipments.map(s => {
                      const isNearExpiry = s.shelfLifeDays <= 3
                      const isTempBreached = s.coldChainViolation
                      const isLowQuality = s.aiQualityScore < 70

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{s.product}</div>
                            <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400">{s.batchId} ({s.id})</div>
                          </td>
                          <td className="py-3 px-3 font-medium">{s.category}</td>
                          <td className="py-3 px-3">
                            <span className={`font-bold ${s.aiQualityScore >= 90 ? "text-emerald-600" : s.aiQualityScore >= 75 ? "text-blue-600" : "text-amber-600"}`}>
                              {s.aiQualityScore}% Score
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">{s.expiryDate}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isNearExpiry ? "bg-rose-500" : s.shelfLifeDays <= 7 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${Math.min(100, (s.shelfLifeDays / 20) * 100)}%` }}
                                ></div>
                              </div>
                              <span className={`font-bold ${isNearExpiry ? "text-rose-600" : "text-slate-700 dark:text-slate-300"}`}>
                                {s.shelfLifeDays} days
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap items-center gap-1">
                              {isTempBreached && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-0.5">
                                  <Flame className="h-3 w-3" /> Temp Violation
                                </span>
                              )}
                              {isNearExpiry && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" /> Near Expiry
                                </span>
                              )}
                              {isLowQuality && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                  Low Quality
                                </span>
                              )}
                              {!isTempBreached && !isNearExpiry && !isLowQuality && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  Optimal
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {isTempBreached ? "🚨 Inspect & Chill" : isNearExpiry ? "⚡ Priority Express Dispatch" : "✅ Normal Route"}
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

      {/* ==================== CREATE SHIPMENT MODAL ==================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                <span>Create New Logistics Shipment</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Product Name</label>
                  <input
                    type="text"
                    required
                    value={newShipment.product}
                    onChange={e => setNewShipment({ ...newShipment, product: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    value={newShipment.category}
                    onChange={e => setNewShipment({ ...newShipment, category: e.target.value as any })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Fruits">Fruits</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Meat">Meat</option>
                    <option value="Grains">Grains</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Quantity</label>
                  <input
                    type="text"
                    required
                    value={newShipment.quantity}
                    onChange={e => setNewShipment({ ...newShipment, quantity: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Batch ID</label>
                  <input
                    type="text"
                    required
                    value={newShipment.batchId}
                    onChange={e => setNewShipment({ ...newShipment, batchId: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-mono"
                  />
                </div>
              </div>

              {/* Route: Processor -> Retailer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Processor (Origin)</label>
                  <input
                    type="text"
                    required
                    value={newShipment.processor}
                    onChange={e => setNewShipment({ ...newShipment, processor: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Retailer (Destination)</label>
                  <input
                    type="text"
                    required
                    value={newShipment.retailer}
                    onChange={e => setNewShipment({ ...newShipment, retailer: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
              </div>

              {/* Vehicle & Driver */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Vehicle Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TN-01-AX-3421"
                    value={newShipment.vehicleNo}
                    onChange={e => setNewShipment({ ...newShipment, vehicleNo: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Vehicle Type</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Reefer Truck (2°C - 8°C)"
                    value={newShipment.vehicleType}
                    onChange={e => setNewShipment({ ...newShipment, vehicleType: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Driver Name</label>
                  <input
                    type="text"
                    required
                    value={newShipment.driverName}
                    onChange={e => setNewShipment({ ...newShipment, driverName: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Driver Phone</label>
                  <input
                    type="text"
                    required
                    value={newShipment.driverPhone}
                    onChange={e => setNewShipment({ ...newShipment, driverPhone: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">License ID</label>
                  <input
                    type="text"
                    required
                    value={newShipment.driverLicense}
                    onChange={e => setNewShipment({ ...newShipment, driverLicense: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
              </div>

              {/* Safe Temp Range & Dates */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Min Temp (°C)</label>
                  <input
                    type="number"
                    value={newShipment.tempSafeMin}
                    onChange={e => setNewShipment({ ...newShipment, tempSafeMin: parseFloat(e.target.value) })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Max Temp (°C)</label>
                  <input
                    type="number"
                    value={newShipment.tempSafeMax}
                    onChange={e => setNewShipment({ ...newShipment, tempSafeMax: parseFloat(e.target.value) })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Expected Delivery</label>
                  <input
                    type="text"
                    placeholder="2026-09-08 17:00"
                    value={newShipment.expectedDelivery}
                    onChange={e => setNewShipment({ ...newShipment, expectedDelivery: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                >
                  Create & Launch Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== UPDATE STATUS MODAL ==================== */}
      {showUpdateModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-blue-600" />
                <span>Update Status & Location</span>
              </h3>
              <button onClick={() => setShowUpdateModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatusSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">{selectedShipment.product} ({selectedShipment.id})</p>
                <p className="text-muted-foreground text-[11px]">Current Location: {selectedShipment.location}</p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Shipment Status</label>
                <select
                  value={updateStatus}
                  onChange={e => setUpdateStatus(e.target.value as any)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-bold"
                >
                  <option value="Packed">Packed (Awaiting Dispatch)</option>
                  <option value="In Transit">In Transit (Logistics active)</option>
                  <option value="Delivered">Delivered (Handed over to Retailer)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">New Location Checkpoint</label>
                <input
                  type="text"
                  placeholder="e.g. Pune Highway Toll Hub"
                  value={updateLocation}
                  onChange={e => setUpdateLocation(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Driver Checkpoint Notes</label>
                <textarea
                  rows={2}
                  placeholder="Enter logistics or handler observations..."
                  value={updateNotes}
                  onChange={e => setUpdateNotes(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                >
                  Save Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== LOG TELEMETRY MODAL ==================== */}
      {showTelemetryModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-emerald-600" />
                <span>Log Temperature & Humidity Reading</span>
              </h3>
              <button onClick={() => setShowTelemetryModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleLogTelemetrySubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1">
                <p className="font-bold text-emerald-900 dark:text-emerald-200">{selectedShipment.product} ({selectedShipment.id})</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Target Safe Temperature Range: <strong className="font-bold">{selectedShipment.tempSafeMin}°C - {selectedShipment.tempSafeMax}°C</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={telemetryTemp}
                    onChange={e => setTelemetryTemp(parseFloat(e.target.value))}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Humidity (%)</label>
                  <input
                    type="number"
                    required
                    value={telemetryHumidity}
                    onChange={e => setTelemetryHumidity(parseInt(e.target.value))}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Location Checkpoint</label>
                <input
                  type="text"
                  placeholder="e.g. Highway NH-48 Checkpoint"
                  value={telemetryLocation}
                  onChange={e => setTelemetryLocation(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowTelemetryModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Submit Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== QR CODE MODAL ==================== */}
      {showQRModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <QrCode className="h-5 w-5 text-purple-600" />
                <span>Batch QR Code</span>
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
              <p className="font-mono font-extrabold text-sm text-purple-600 dark:text-purple-400">{selectedShipment.batchId}</p>
              <h4 className="font-bold text-slate-900 dark:text-white mt-1">{selectedShipment.product}</h4>
              <p className="text-xs text-muted-foreground">{selectedShipment.quantity} · {selectedShipment.category}</p>
            </div>

            <div className="pt-2 text-xs text-left bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl space-y-1">
              <div><strong className="text-slate-700 dark:text-slate-300">Processor:</strong> {selectedShipment.processor}</div>
              <div><strong className="text-slate-700 dark:text-slate-300">Retailer:</strong> {selectedShipment.retailer}</div>
              <div><strong className="text-slate-700 dark:text-slate-300">Status:</strong> {selectedShipment.status}</div>
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
