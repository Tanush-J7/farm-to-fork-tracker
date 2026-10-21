import React, { useState, useEffect, useRef } from "react"
import axios from "axios"
import {
  Package,
  Truck,
  Zap,
  TrendingUp,
  QrCode,
  SplitSquareHorizontal,
  Clock,
  ShieldCheck,
  Camera,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  Store,
  Thermometer,
  RefreshCw,
  Navigation,
  ChevronRight,
  Sparkles,
  Compass,
  Snowflake
} from "lucide-react"
import { Card } from "../components/ui/Card"
import { Button } from "../components/ui/Button"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useAuth } from "../context/AuthContext"
import { Html5Qrcode } from "html5-qrcode"
import jsQR from "jsqr"
import { RouteMapModal } from "../components/distributor/RouteMapModal"
import { getGoogleMapsDestinationUrl } from "../utils"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

const routePerformanceData = [
  { day: "Mon", deliveries: 8, onTime: 7 },
  { day: "Tue", deliveries: 12, onTime: 11 },
  { day: "Wed", deliveries: 9, onTime: 9 },
  { day: "Thu", deliveries: 15, onTime: 13 },
  { day: "Fri", deliveries: 18, onTime: 16 },
  { day: "Sat", deliveries: 11, onTime: 10 },
  { day: "Sun", deliveries: 6, onTime: 6 },
]

export function DistributorDashboard() {
  const { user, token, updateUser } = useAuth()
  const [activeTab, setActiveTab] = useState<"overview" | "requests" | "fleet" | "inventory" | "blockchain">("overview")
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Camera QR Scanner state
  const [showScanner, setShowScanner] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [scannerError, setScannerError] = useState("")
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handoff / Take Custody state
  const [handoffId, setHandoffId] = useState("")
  const [scannedBatchPreview, setScannedBatchPreview] = useState<any>(null)
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [handoffSuccess, setHandoffSuccess] = useState("")
  const [handoffTxHash, setHandoffTxHash] = useState("")
  const [handoffError, setHandoffError] = useState("")

  // Retailer Delivery Modal state
  const [deliveryModalItem, setDeliveryModalItem] = useState<any>(null)
  const [destinationStore, setDestinationStore] = useState("Metro Fresh Mart (Koramangala Store #104)")
  const [deliveryRemarks, setDeliveryRemarks] = useState("Cold-chain temperature maintained at 3.8°C; intake acknowledged by store manager")
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [deliverySuccessTx, setDeliverySuccessTx] = useState("")
  const [deliveryError, setDeliveryError] = useState("")

  const [allProducts, setAllProducts] = useState<any[]>([])

  // Delivery Requests state (from Processors)
  const [deliveryRequests, setDeliveryRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestsFilter, setRequestsFilter] = useState<"ALL" | "REQUESTED" | "IN_TRANSIT" | "DECLINED">("ALL")
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null)
  const [declineModalRequest, setDeclineModalRequest] = useState<any | null>(null)
  const [selectedMapRequest, setSelectedMapRequest] = useState<any | null>(null)
  const [declineReasonInput, setDeclineReasonInput] = useState("Vehicle capacity currently booked on another route")

  // Driver Availability Status state
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusSuccess, setStatusSuccess] = useState(false)

  const updateStatus = async (status: string) => {
    setStatusLoading(true)
    setStatusSuccess(false)
    try {
      await axios.put(
        `${API_URL}/auth/status`,
        { availability_status: status },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch {
      localStorage.setItem(`driver_status_${user?.id}`, status)
    } finally {
      if (user) {
        updateUser({ availability_status: status })
      }
      setStatusSuccess(true)
      setStatusLoading(false)
      setTimeout(() => setStatusSuccess(false), 3000)
    }
  }

  const fetchDeliveryRequests = async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingRequests(true)
      const res = await axios.get(`${API_URL}/distributor/delivery-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.success) {
        setDeliveryRequests(res.data.data || [])
      }
    } catch (err) {
      console.warn("Could not load delivery requests", err)
    } finally {
      if (!isSilent) setLoadingRequests(false)
    }
  }

  const handleRespondToRequest = async (requestId: string, action: "ACCEPT" | "DECLINE", reason?: string) => {
    setRespondingRequestId(requestId)
    try {
      const res = await axios.put(
        `${API_URL}/distributor/delivery-requests/${requestId}/respond`,
        { action, decline_reason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data?.success) {
        await fetchDeliveryRequests(true)
        await fetchInventory()
        if (action === "ACCEPT") {
          setActiveTab("fleet")
        }
      }
    } catch (err: any) {
      console.error("Failed to respond to delivery request", err)
    } finally {
      setRespondingRequestId(null)
      setDeclineModalRequest(null)
    }
  }

  const fetchInventory = async () => {
    try {
      const [myRes, allRes] = await Promise.all([
        axios.get(`${API_URL}/products/my`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      setInventory(myRes.data.data || [])
      setAllProducts(allRes.data.data || [])
    } catch (err) {
      console.error("Error fetching distributor inventory:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchInventory()
      fetchDeliveryRequests()

      const interval = setInterval(() => {
        fetchDeliveryRequests(true)
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [token])

  useEffect(() => {
    if (token && (activeTab === "requests" || activeTab === "overview")) {
      fetchDeliveryRequests(true)
    }
  }, [activeTab, token])

  // Camera QR Scanner logic
  const startLiveCamera = async () => {
    setScannerError("")
    setCameraActive(true)
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop()
      }
      const html5QrCode = new Html5Qrcode("distributor-qr-reader")
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleScannedResult(decodedText)
        },
        () => {}
      )
    } catch (err: any) {
      setScannerError(err?.message || "Could not access camera. Please allow camera permissions or upload an image.")
      setCameraActive(false)
    }
  }

  const stopLiveCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop()
        }
        html5QrCodeRef.current.clear()
      } catch (e) {}
    }
    setCameraActive(false)
  }

  const handleScannedResult = async (decodedText: string) => {
    stopLiveCamera()
    setShowScanner(false)

    let extractedId = decodedText.trim()
    if (extractedId.includes("?id=")) {
      extractedId = extractedId.split("?id=")[1].split("&")[0]
    }
    if (extractedId.startsWith("FP-")) {
      extractedId = extractedId.replace("FP-", "")
    }

    setHandoffId(extractedId)
    await previewBatchDetails(extractedId)
  }

  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScannerError("")

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(img, 0, 0, img.width, img.height)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code) {
          handleScannedResult(code.data)
        } else {
          setScannerError("Could not read a valid QR code from this image. Please try a clearer photo.")
        }
      }
    }
    img.src = objectUrl
  }

  const previewBatchDetails = async (id: string) => {
    if (!id) return
    setHandoffLoading(true)
    setHandoffError("")
    try {
      const res = await axios.get(`${API_URL}/products/blockchain/${id}`)
      if (res.data?.data) {
        setScannedBatchPreview(res.data.data)
      } else {
        setHandoffError(`No batch found for "${id}".`)
      }
    } catch (err: any) {
      setHandoffError(err.response?.data?.message || "Failed to locate batch with this ID.")
    } finally {
      setHandoffLoading(false)
    }
  }

  const handleTakeCustody = async (batchToTake?: any) => {
    const target = batchToTake || scannedBatchPreview
    const targetId = target ? target.id : handoffId

    if (!targetId) return
    setHandoffLoading(true)
    setHandoffError("")
    setHandoffSuccess("")
    setHandoffTxHash("")

    try {
      let resolvedProduct = target
      if (!resolvedProduct) {
        const res = await axios.get(`${API_URL}/products/blockchain/${targetId}`)
        resolvedProduct = res.data.data
      }

      const updateRes = await axios.put(
        `${API_URL}/products/${resolvedProduct.id}/status`,
        {
          status: "In Transit",
          current_owner_id: user?.id,
          extraInfo: `Distributor (${user?.name || user?.email || "Carrier"}) took custody. Cold-chain reefer truck dispatched.`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const newTxHash = updateRes.data?.data?.blockchain_hash
      setHandoffTxHash(newTxHash || "")
      setHandoffSuccess(`Successfully took custody of ${resolvedProduct.name} (Batch: ${resolvedProduct.batch_number}). Recorded on Sepolia!`)
      setHandoffId("")
      setScannedBatchPreview(null)
      await fetchInventory()
    } catch (err: any) {
      setHandoffError(err.response?.data?.message || "Failed to verify ID or take custody.")
    } finally {
      setHandoffLoading(false)
    }
  }

  // Delivery to Retailer logic
  const handleCompleteDelivery = async () => {
    if (!deliveryModalItem) return
    setDeliveryLoading(true)
    setDeliveryError("")
    setDeliverySuccessTx("")

    try {
      const updateRes = await axios.put(
        `${API_URL}/products/${deliveryModalItem.id}/status`,
        {
          status: "At Retailer",
          extraInfo: `Delivered to ${destinationStore}: ${deliveryRemarks}`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const txHash = updateRes.data?.data?.blockchain_hash
      setDeliverySuccessTx(txHash || "0x_confirmed")
      await fetchInventory()
      setTimeout(() => {
        setDeliveryModalItem(null)
        setDeliverySuccessTx("")
      }, 3000)
    } catch (err: any) {
      setDeliveryError(err.response?.data?.message || "Failed to record delivery on blockchain.")
    } finally {
      setDeliveryLoading(false)
    }
  }

  // Stats calculations
  const activeShipmentsCount = inventory.filter((p) => p.status === "In Transit").length
  const deliveredCount = inventory.filter((p) => p.status === "At Retailer" || p.status === "Delivered").length
  const pendingRequestsCount = deliveryRequests.filter((r) => r.status === "REQUESTED").length

  const quickDeclinePresets = [
    "Vehicle capacity currently booked on another route",
    "Destination store is outside today's delivery corridor",
    "Scheduled vehicle maintenance / reefer inspection",
    "Requested pickup time window cannot be met",
    "Cold-chain temperature SLA cannot be guaranteed for this commodity"
  ]

  // ==========================================
  // TAB 1: OVERVIEW & COMMAND HUD
  // ==========================================
  const OverviewTab = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* PENDING REQUESTS URGENT HERO BANNER */}
      {pendingRequestsCount > 0 && (
        <div className="relative overflow-hidden p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
                <Clock className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Action Required
                  </span>
                  <span className="text-xs text-amber-400/80 font-medium">Real-time Processor Dispatch</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {pendingRequestsCount} Incoming Delivery Request{pendingRequestsCount > 1 ? "s" : ""} Waiting for Review
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Processors have booked your cold-chain fleet with source pickup and retailer drop-off waypoints.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setActiveTab("requests")}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl px-5 text-xs shadow-md shrink-0 self-start sm:self-center cursor-pointer transition-all"
            >
              Review Manifests
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 6 AESTHETIC KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        {[
          {
            title: "In Transit",
            val: activeShipmentsCount,
            sub: "Active Reefer Loads",
            icon: Truck,
            color: "text-blue-500",
            bg: "from-blue-500/10 to-blue-500/5",
            border: "border-blue-500/20"
          },
          {
            title: "Store Delivered",
            val: deliveredCount,
            sub: "Retail Handoffs",
            icon: CheckCircle2,
            color: "text-emerald-500",
            bg: "from-emerald-500/10 to-emerald-500/5",
            border: "border-emerald-500/20"
          },
          {
            title: "Pending Requests",
            val: pendingRequestsCount,
            sub: "Processor Manifests",
            icon: Clock,
            color: "text-amber-500",
            bg: "from-amber-500/10 to-amber-500/5",
            border: "border-amber-500/20"
          },
          {
            title: "Fleet Temp SLA",
            val: "3.8°C",
            sub: "Continuous Chilled",
            icon: Snowflake,
            color: "text-cyan-500",
            bg: "from-cyan-500/10 to-cyan-500/5",
            border: "border-cyan-500/20"
          },
          {
            title: "Route Efficiency",
            val: "96.4%",
            sub: "AI Smart Multi-Drop",
            icon: Zap,
            color: "text-indigo-500",
            bg: "from-indigo-500/10 to-indigo-500/5",
            border: "border-indigo-500/20"
          },
          {
            title: "Total Cargo",
            val: inventory.length,
            sub: "Batches on Chain",
            icon: Package,
            color: "text-purple-500",
            bg: "from-purple-500/10 to-purple-500/5",
            border: "border-purple-500/20"
          }
        ].map((card, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-3xl bg-gradient-to-b ${card.bg} border ${card.border} shadow-sm hover:shadow-md transition-all space-y-2`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-xl bg-white dark:bg-slate-900/60 ${card.color} shadow-xs`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{card.val}</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* MID-GRID: REEFER TELEMETRY HUD + ROUTE PERFORMANCE CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* REEFER TELEMETRY & SATELLITE HUD */}
        <div className="p-6 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xl space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Cold-Chain Reefer #KA-04-1234</h4>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Telemetry Online • GPS Linked
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Fleet Unit 01
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Snowflake className="h-3 w-3 text-cyan-400" />
                Cabin Temperature
              </span>
              <div className="text-xl font-black text-cyan-400">3.8°C</div>
              <p className="text-[10px] text-emerald-400 font-semibold">Target: 2.0°C - 5.5°C ✓</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Thermometer className="h-3 w-3 text-blue-400" />
                Relative Humidity
              </span>
              <div className="text-xl font-black text-blue-400">84%</div>
              <p className="text-[10px] text-slate-400 font-medium">Optimal Fresh Range</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Active Delivery Waypoint:</span>
              <span className="text-emerald-400 font-semibold">Koramangala Supermarket</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Cold Storage Buffer:</span>
              <span className="text-white font-mono">18 / 20 Crates Loaded</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full w-[90%]" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sepolia Contract Sync Active
            </span>
            <span className="font-mono text-[10px] text-slate-500">Block #7,184,209</span>
          </div>
        </div>

        {/* ON-TIME DELIVERY TREND CHART */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Delivery Throughput & On-Time Arrival
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Weekly scheduled consignments compared to on-time dock arrivals.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Total Shipments
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> On-Time Dock
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={routePerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="distBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="distGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.1)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "1rem",
                    color: "#fff",
                    fontSize: "12px"
                  }}
                />
                <Area type="monotone" dataKey="deliveries" stroke="#3b82f6" strokeWidth={2.5} fill="url(#distBlue)" name="Total Deliveries" />
                <Area type="monotone" dataKey="onTime" stroke="#10b981" strokeWidth={2.5} fill="url(#distGreen)" name="On-Time Dock" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* QUICK LAUNCH TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab("requests")}
          className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 group-hover:scale-105 transition-transform">
              <Clock className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-amber-500">{pendingRequestsCount} Pending</span>
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors">
            Processor Delivery Requests
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review detailed origin pickup and retailer destination manifests with GPS maps.
          </p>
        </button>

        <button
          onClick={() => setActiveTab("fleet")}
          className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500 group-hover:scale-105 transition-transform">
              <Truck className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-blue-500">{activeShipmentsCount} In Transit</span>
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors">
            Fleet Transit & Store Handoff
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor active reefer truck runs and complete retail delivery acknowledgments.
          </p>
        </button>

        <button
          onClick={() => setActiveTab("blockchain")}
          className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 group-hover:scale-105 transition-transform">
              <QrCode className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-emerald-500">Live Camera</span>
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors">
            Scan & Claim Custody
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Scan QR on harvest or processor crates to broadcast cryptographic transfer on Sepolia.
          </p>
        </button>
      </div>
    </div>
  )

  // ==========================================
  // TAB 2: DELIVERY REQUESTS FROM PROCESSORS
  // ==========================================
  const RequestsTab = () => {
    const pendingCount = deliveryRequests.filter((r) => r.status === "REQUESTED").length
    const filtered = deliveryRequests.filter((r) => {
      if (requestsFilter === "ALL") return true
      if (requestsFilter === "REQUESTED") return r.status === "REQUESTED"
      if (requestsFilter === "IN_TRANSIT") return r.status === "IN_TRANSIT" || r.status === "ACCEPTED"
      if (requestsFilter === "DECLINED") return r.status === "DECLINED"
      return true
    })

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* SUBHEADER & CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Clock className="h-5 w-5 text-emerald-600" />
              Incoming Delivery Requests from Processors
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Processors submit formal cargo dispatch manifests for your cold-chain fleet. Accept to take custody or decline.
            </p>
          </div>

          {/* Filter Pills & Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchDeliveryRequests(false)}
              disabled={loadingRequests}
              className="rounded-full text-xs h-8 px-3.5 gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`h-3 w-3 ${loadingRequests ? "animate-spin text-emerald-600" : ""}`} />
              Refresh
            </Button>
            {[
              { id: "ALL", label: `All (${deliveryRequests.length})` },
              { id: "REQUESTED", label: `Pending (${pendingCount})` },
              {
                id: "IN_TRANSIT",
                label: `Accepted (${deliveryRequests.filter((r) => r.status === "IN_TRANSIT" || r.status === "ACCEPTED").length})`
              },
              {
                id: "DECLINED",
                label: `Declined (${deliveryRequests.filter((r) => r.status === "DECLINED").length})`
              }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRequestsFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  requestsFilter === f.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* LOADING STATE */}
        {loadingRequests ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-2" />
            <p className="text-sm font-medium">Fetching real-time dispatch manifests...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <Clock className="h-7 w-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">No Delivery Requests Found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {requestsFilter === "REQUESTED"
                ? "You have no pending delivery requests at the moment. All caught up!"
                : "When a processor finishes inspecting produce and requests your cold-chain fleet for transport, the detailed manifest will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {filtered.map((req) => {
              const isPending = req.status === "REQUESTED"
              const isAccepted = req.status === "IN_TRANSIT" || req.status === "ACCEPTED"
              const isDeclined = req.status === "DECLINED"
              const isActioning = respondingRequestId === req.id

              const sourceLocation =
                req.processor?.facility_location ||
                req.processor?.facility_name ||
                "Agro-Processing Unit #4, Yeshwanthpur APMC Yard, Bengaluru 560022"

              const destLocation =
                req.retailer?.store_location ||
                req.retailer?.destination_store ||
                "Metro Fresh Supermarket, 80 Feet Road, Koramangala, Bengaluru 560034"

              return (
                <div
                  key={req.id}
                  className={`rounded-3xl border transition-all overflow-hidden p-6 space-y-5 bg-white dark:bg-slate-900 shadow-sm ${
                    isPending
                      ? "border-amber-500/40 shadow-amber-500/5 hover:border-amber-500"
                      : isAccepted
                      ? "border-emerald-500/30 hover:border-emerald-500/50"
                      : "border-slate-200 dark:border-slate-800 opacity-80"
                  }`}
                >
                  {/* TOP HEADER: BATCH, TIMESTAMP, STATUS */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          Batch: {req.batch_number}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          Tracking: #{req.tracking_id || req.id?.slice(0, 8)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          • {new Date(req.created_at).toLocaleDateString()} at {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <h4 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 pt-0.5">
                        {req.product_name?.includes("Tomato")
                          ? "🍅"
                          : req.product_name?.includes("Mango")
                          ? "🥭"
                          : req.product_name?.includes("Apple")
                          ? "🍎"
                          : "📦"}
                        {req.product_name}
                      </h4>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        isPending
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse"
                          : isAccepted
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {isPending && <Clock className="h-3.5 w-3.5" />}
                      {isAccepted && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {isDeclined && <X className="h-3.5 w-3.5" />}
                      {isPending ? "Pending Your Review" : isAccepted ? "Accepted & In Transit" : "Declined"}
                    </span>
                  </div>

                  {/* VISUAL JOURNEY FLOW: SOURCE -> CHILLED REEFER -> DESTINATION */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 text-emerald-600" />
                      Live Route Journey & Verified Profile Waypoints
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* SOURCE PICKUP CARD */}
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            1. Pickup Origin (Processor)
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Depot Dock</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {req.processor?.facility_name || "Agro-Processing Facility"}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {sourceLocation}
                        </p>
                        <div className="pt-1">
                          <a
                            href={getGoogleMapsDestinationUrl(sourceLocation)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                          >
                            <Navigation className="h-3 w-3" /> GPS Navigate to Pickup ↗
                          </a>
                        </div>
                      </div>

                      {/* DESTINATION DELIVERY CARD */}
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-500/30 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            2. Delivery Destination (Retailer)
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Store Dock</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {req.retailer?.destination_store || "Retail Supermarket"}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {destLocation}
                        </p>
                        <div className="pt-1">
                          <a
                            href={getGoogleMapsDestinationUrl(destLocation)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                          >
                            <Navigation className="h-3 w-3" /> GPS Navigate to Store ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4-SPECIFICATION MANIFEST TILES */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">📦 Cargo Net Weight</span>
                      <p className="font-black text-sm text-slate-900 dark:text-white">
                        {req.quantity} {req.unit || "kg"}
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Packaged Crates</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">🏅 AI Quality Grade</span>
                      <p className="font-black text-sm text-slate-900 dark:text-white">
                        {req.quality_label || "Grade A"} ({req.quality_score || 94}%)
                      </p>
                      <p className="text-[10px] text-slate-500">Certified Shelf Life: {req.expiry_date || "14 Days"}</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">❄️ Cold-Chain SLA</span>
                      <p className="font-black text-sm text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                        <Snowflake className="h-3 w-3" />
                        {req.cold_chain_sla?.temperature_control || "2°C to 6°C"}
                      </p>
                      <p className="text-[10px] text-slate-500">Reefer Truck Guaranteed</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">⛓️ Ledger Transfer</span>
                      <p className="font-black text-sm text-purple-600 dark:text-purple-400">Sepolia ERC-721</p>
                      <p className="text-[10px] text-slate-500">Auto Handoff Ready</p>
                    </div>
                  </div>

                  {/* PROCESSOR NOTES */}
                  {req.processor_notes && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2 italic">
                      <span className="font-bold not-italic text-slate-900 dark:text-white shrink-0">Processor Dispatch Notes:</span>
                      <span>"{req.processor_notes}"</span>
                    </div>
                  )}

                  {/* DECLINED REASON IF APPLICABLE */}
                  {isDeclined && req.decline_reason && (
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-400">
                      <strong>Reason for Declining:</strong> "{req.decline_reason}"
                    </div>
                  )}

                  {/* ACTION BAR */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedMapRequest(req)}
                      className="w-full sm:w-auto rounded-xl text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 font-bold cursor-pointer"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      View Interactive Route Map
                    </Button>

                    {isPending && (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActioning}
                          onClick={() => setDeclineModalRequest(req)}
                          className="w-full sm:w-auto rounded-xl text-xs border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Decline Manifest
                        </Button>
                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => handleRespondToRequest(req.id, "ACCEPT")}
                          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-sm cursor-pointer"
                        >
                          {isActioning ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Recording Acceptance...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Accept Delivery & Start Trip
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {isAccepted && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          Custody active in your fleet!
                        </span>
                        <Button
                          size="sm"
                          onClick={() => setActiveTab("fleet")}
                          className="rounded-xl text-xs gap-1 bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          Deliver to Store Dock
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* QUICK DECLINE REASON MODAL WITH PRESET CHIPS */}
        {declineModalRequest && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                    <X className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Decline Delivery Request</h3>
                    <p className="text-xs text-slate-400 font-mono">Batch: {declineModalRequest.batch_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeclineModalRequest(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <label className="font-semibold text-slate-300">Quick Reason Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {quickDeclinePresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDeclineReasonInput(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-xl border transition-all text-left cursor-pointer ${
                        declineReasonInput === preset
                          ? "bg-rose-500/20 border-rose-500 text-rose-300"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-slate-300">Explanation for Processor</label>
                <textarea
                  rows={3}
                  value={declineReasonInput}
                  onChange={(e) => setDeclineReasonInput(e.target.value)}
                  placeholder="Provide brief context for declining..."
                  className="flex w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeclineModalRequest(null)}
                  className="flex-1 rounded-xl border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleRespondToRequest(declineModalRequest.id, "DECLINE", declineReasonInput)}
                  className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                >
                  Confirm Decline
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    )
  }

  // ==========================================
  // TAB 3: FLEET & IN-TRANSIT TRACKING
  // ==========================================
  const FleetTab = () => {
    const inTransitBatches = inventory.filter((i) => i.status === "In Transit")
    const readyAtProcessors = allProducts.filter(
      (p) => p.status === "Processed" || p.status === "Processed - Grade A"
    )

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ACTIVE IN-TRANSIT TABLE */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Active In-Transit Cargo
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Produce currently loaded in your cold-chain fleet. Hand off to retailer upon arrival.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/20">
                {inTransitBatches.length} Live Loads
              </span>
            </div>

            {inTransitBatches.length === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
                <Truck className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-semibold">No cargo currently in transit.</p>
                <p className="text-xs max-w-sm mx-auto">
                  Accept an incoming processor dispatch manifest or scan a batch QR code in the "Smart Handoff" dock.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {inTransitBatches.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-base">{item.name}</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-semibold border border-blue-500/20">
                          {item.batch_number}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Cargo Load: <strong>{item.quantity} kg</strong> • On-Chain ID: #{item.product_id || "N/A"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const matchingReq = deliveryRequests.find((r) => r.batch_number === item.batch_number)
                          setSelectedMapRequest(
                            matchingReq || {
                              batch_number: item.batch_number,
                              product_name: item.name,
                              quantity: item.quantity,
                              unit: "kg",
                              processor: {
                                facility_name: "Agro-Processing Facility",
                                facility_location: "Agro-Processing Unit #4, Yeshwanthpur APMC Yard, Bengaluru 560022"
                              },
                              retailer: {
                                destination_store: "Metro Fresh Mart Koramangala",
                                store_location: "Metro Fresh Supermarket, 80 Feet Road, 4th Block, Koramangala, Bengaluru 560034"
                              },
                              cold_chain_sla: { temperature_control: "2°C to 6°C Precision Chilled" }
                            }
                          )
                        }}
                        className="rounded-xl text-xs gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 cursor-pointer font-bold"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Route Map
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setDeliveryModalItem(item)}
                        className="rounded-xl text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-xs"
                      >
                        <Store className="h-3.5 w-3.5" />
                        Deliver to Store
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TELEMETRY SIDE CARD */}
          <div className="p-6 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-cyan-400" />
              Reefer Sensor Diagnostics
            </h4>
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Reefer Cabin Temp</span>
                <span className="font-bold text-cyan-400 font-mono text-sm">3.8°C</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Evaporator Coils</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">Active (Zone 1)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">GPS Tracker Status</span>
                <span className="font-bold text-emerald-400 text-xs">Locked (12 Satellites)</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              <span>All transport logs satisfy FSSAI & ISO-22000 cold-chain traceability standards.</span>
            </div>
          </div>
        </div>

        {/* READY AT PROCESSING PLANTS */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Produce Waiting at Processing Facilities
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Graded and inspected lots ready for cold-chain distribution.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20">
              {readyAtProcessors.length} Available
            </span>
          </div>

          {readyAtProcessors.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No batches waiting at processing facilities. Graded crops will appear here automatically.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-left">
                    <th className="py-2.5 px-3">Batch</th>
                    <th className="py-2.5 px-3">Produce</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Quality Score</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {readyAtProcessors.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold">{p.batch_number}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">{p.name}</td>
                      <td className="py-3 px-3">{p.quantity} kg</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600">
                          {p.ai_quality_label || "Grade A"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          disabled={handoffLoading}
                          onClick={() => handleTakeCustody(p)}
                          className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold cursor-pointer"
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          Take Custody
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // TAB 4: CARGO INVENTORY & MANIFEST
  // ==========================================
  const InventoryTab = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">Distributor Custody Manifest</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Historical record of all cargo batches transferred through your cold-chain fleet.
              </p>
            </div>
            <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              {inventory.length} Records
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading cargo database...</div>
          ) : inventory.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No cargo recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-left">
                    <th className="py-2.5 px-3">Batch & Token</th>
                    <th className="py-2.5 px-3">Crop Name</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3 text-right">Custody Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">{item.batch_number}</div>
                        <div className="text-[10px] text-slate-400 font-mono">On-Chain #{item.product_id || "N/A"}</div>
                      </td>
                      <td className="py-3 px-3 font-medium">{item.name}</td>
                      <td className="py-3 px-3 font-semibold">{item.quantity} kg</td>
                      <td className="py-3 px-3 text-slate-500">
                        {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            item.status === "At Retailer" || item.status === "Delivered"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* BATCH CONSOLIDATION & SUB-LOT SPLITTING */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <SplitSquareHorizontal className="h-4 w-4 text-purple-600" />
            Consignment Allocation
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Split high-volume processor pallets into smaller retail crate distributions.
          </p>
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Select Parent Batch</label>
              <select className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.batch_number} ({item.name}) - {item.quantity} kg
                  </option>
                ))}
                {inventory.length === 0 && <option>No inventory loaded</option>}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Sub-Consignments</label>
              <input
                type="number"
                defaultValue={2}
                min={2}
                max={10}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <Button className="w-full rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white cursor-pointer mt-2">
              <SplitSquareHorizontal className="mr-1.5 h-4 w-4" />
              Generate Split QR Labels
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  // ==========================================
  // TAB 5: SMART QR HANDOFF & BLOCKCHAIN CUSTODY
  // ==========================================
  const BlockchainTab = () => (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-xs">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">Cryptographic Custody Handoff</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            Scan a batch QR code from a Farmer or Processor to transfer cryptographic custody to your fleet on Ethereum Sepolia.
          </p>
        </div>

        {/* SCANNER CONTROLS */}
        <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
          <QrCode className="h-10 w-10 text-emerald-600 animate-pulse" />
          <p className="text-xs text-slate-500">Scan via camera viewfinder or upload an image file</p>
          <div className="flex gap-3 w-full max-w-xs">
            <Button
              type="button"
              onClick={() => {
                setShowScanner(true)
                startLiveCamera()
              }}
              className="flex-1 rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-sm"
            >
              <Camera className="h-4 w-4" />
              Open Camera
            </Button>
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleQrFileUpload} />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-xl text-xs gap-1.5 cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              Upload Image
            </Button>
          </div>
        </div>

        {/* SCANNED BATCH PREVIEW CARD */}
        {scannedBatchPreview && (
          <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-500/40 text-left space-y-3 animate-in fade-in">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Batch Verified
                </span>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{scannedBatchPreview.name}</h4>
                <p className="text-xs text-slate-500 font-mono">
                  Batch: {scannedBatchPreview.batch_number} • On-Chain ID: #{scannedBatchPreview.product_id}
                </p>
              </div>
              <button
                onClick={() => setScannedBatchPreview(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Weight:</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{scannedBatchPreview.quantity} kg</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Status:</span>
                <span className="font-bold text-blue-600 text-sm">{scannedBatchPreview.status}</span>
              </div>
            </div>

            <Button
              onClick={() => handleTakeCustody(scannedBatchPreview)}
              disabled={handoffLoading}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 cursor-pointer shadow-sm"
            >
              {handoffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Sign Custody & Broadcast to Sepolia
            </Button>
          </div>
        )}

        {/* SUCCESS / ERROR ALERTS */}
        {handoffSuccess && (
          <div className="p-4 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-2xl text-xs space-y-1.5 text-left">
            <p className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {handoffSuccess}
            </p>
            {handoffTxHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${handoffTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline font-mono text-[11px] text-emerald-600 hover:text-emerald-500"
              >
                View Sepolia Block Explorer ↗
              </a>
            )}
          </div>
        )}

        {handoffError && (
          <div className="p-4 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 rounded-2xl text-xs text-left">
            {handoffError}
          </div>
        )}

        {/* MANUAL INPUT */}
        <div className="pt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={handoffId}
              onChange={(e) => setHandoffId(e.target.value)}
              placeholder="Or enter batch number manually (e.g. BCH-APPLE-950801)"
              className="flex h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Button
              onClick={() => previewBatchDetails(handoffId)}
              disabled={!handoffId || handoffLoading}
              className="h-11 px-5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 cursor-pointer"
            >
              {handoffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  // ==========================================
  // ROOT COMPONENT RENDER
  // ==========================================
  return (
    <div className="space-y-7">
      {/* BESPOKE DISTRIBUTOR COMMAND BAR */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xl p-6 sm:p-7">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs">
                <Truck className="h-3.5 w-3.5" /> Cold-Chain Carrier Command
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Operator: <strong className="text-white">{user?.name || "Logistics Fleet"}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Fleet Operations & Distribution
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Precision temperature-controlled logistics, turn-by-turn routing, and Sepolia blockchain custody handoffs.
            </p>
          </div>

          {/* DRIVER AVAILABILITY SEGMENTED TOGGLE */}
          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Fleet Trip Availability:
            </div>
            <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-inner">
              {[
                { id: "Available for Trip", label: "Available", dot: "bg-emerald-400", activeClass: "bg-emerald-600 text-white shadow-xs" },
                { id: "On Route", label: "On Route", dot: "bg-amber-400", activeClass: "bg-amber-600 text-white shadow-xs" },
                { id: "Unavailable", label: "Off Duty", dot: "bg-rose-400", activeClass: "bg-rose-600 text-white shadow-xs" }
              ].map((opt) => {
                const isSelected = (user?.availability_status || "Available for Trip") === opt.id
                return (
                  <button
                    key={opt.id}
                    disabled={statusLoading}
                    onClick={() => updateStatus(opt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? opt.activeClass
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${opt.dot} ${isSelected ? "animate-pulse" : ""}`} />
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {statusSuccess && (
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Status synced with dispatchers
              </span>
            )}
          </div>
        </div>
      </div>

      {/* FLOATING NAVIGATION PILL DOCK */}
      <div className="flex items-center overflow-x-auto pb-1 scrollbar-none gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs ${
            activeTab === "overview"
              ? "bg-emerald-600 text-white shadow-emerald-500/20 shadow-md"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Command Overview
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs ${
            activeTab === "requests"
              ? "bg-emerald-600 text-white shadow-emerald-500/20 shadow-md"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Clock className="h-4 w-4" />
          Delivery Requests
          {pendingRequestsCount > 0 && (
            <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("fleet")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs ${
            activeTab === "fleet"
              ? "bg-emerald-600 text-white shadow-emerald-500/20 shadow-md"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Truck className="h-4 w-4" />
          Active Fleet & Routes
          {activeShipmentsCount > 0 && (
            <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] font-black bg-blue-500 text-white">
              {activeShipmentsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("inventory")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs ${
            activeTab === "inventory"
              ? "bg-emerald-600 text-white shadow-emerald-500/20 shadow-md"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Package className="h-4 w-4" />
          Cargo Manifest
        </button>

        <button
          onClick={() => setActiveTab("blockchain")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs ${
            activeTab === "blockchain"
              ? "bg-emerald-600 text-white shadow-emerald-500/20 shadow-md"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <QrCode className="h-4 w-4" />
          Smart Handoff (QR)
        </button>
      </div>

      {/* ACTIVE TAB CONTENT VIEW */}
      <div>
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "requests" && <RequestsTab />}
        {activeTab === "fleet" && <FleetTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "blockchain" && <BlockchainTab />}
      </div>

      {/* LIVE CAMERA QR SCANNER MODAL */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="max-w-sm w-full rounded-3xl border border-slate-800 shadow-2xl p-6 bg-slate-950 text-white space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-emerald-400">
                <Camera className="h-5 w-5" />
                Scan Batch QR Code
              </h3>
              <button
                onClick={() => {
                  stopLiveCamera()
                  setShowScanner(false)
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative w-full aspect-square rounded-2xl border-2 border-dashed border-slate-700 bg-black overflow-hidden flex items-center justify-center">
              <div id="distributor-qr-reader" className="w-full h-full" />
              {cameraActive && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse top-1/2 z-20" />
              )}
            </div>

            {scannerError && <p className="text-xs text-rose-400">{scannerError}</p>}

            <Button
              onClick={() => {
                stopLiveCamera()
                setShowScanner(false)
              }}
              variant="outline"
              className="w-full rounded-xl text-xs border-slate-700 text-slate-300 cursor-pointer"
            >
              Cancel
            </Button>
          </Card>
        </div>
      )}

      {/* RETAILER STORE DELIVERY COMPLETION MODAL */}
      {deliveryModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 bg-white dark:bg-slate-950 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Complete Retail Delivery</h3>
                  <p className="text-xs text-slate-500 font-mono">Batch: {deliveryModalItem.batch_number}</p>
                </div>
              </div>
              <button
                onClick={() => setDeliveryModalItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl space-y-1.5 text-xs border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Product:</span>
                <span className="font-bold text-slate-900 dark:text-white">{deliveryModalItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity to Hand Off:</span>
                <span className="font-bold text-slate-900 dark:text-white">{deliveryModalItem.quantity} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">On-Chain Product ID:</span>
                <span className="font-mono text-emerald-600 font-bold">#{deliveryModalItem.product_id || "N/A"}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Destination Retailer Store</label>
                <select
                  value={destinationStore}
                  onChange={(e) => setDestinationStore(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-white"
                >
                  <option value="Metro Fresh Mart (Koramangala Store #104)">Metro Fresh Mart (Koramangala Store #104)</option>
                  <option value="Nature's Basket (Indiranagar Store #12)">Nature's Basket (Indiranagar Store #12)</option>
                  <option value="Reliance Fresh (Whitefield Hub)">Reliance Fresh (Whitefield Hub)</option>
                  <option value="FreshToHome Local Outlet #3">FreshToHome Local Outlet #3</option>
                  <option value="Authorized Retail Supermarket">Authorized Retail Supermarket</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Delivery Receipt Notes</label>
                <textarea
                  rows={2}
                  value={deliveryRemarks}
                  onChange={(e) => setDeliveryRemarks(e.target.value)}
                  placeholder="e.g. Temperature checked at 3.8°C; intake acknowledged"
                  className="flex w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {deliverySuccessTx && (
              <div className="p-3.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Store Delivery Recorded on Sepolia!
                </p>
                <p className="text-[11px] text-slate-500">Status transitioned to "At Retailer" on-chain.</p>
              </div>
            )}

            {deliveryError && (
              <div className="p-3 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs">
                {deliveryError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setDeliveryModalItem(null)}
                className="flex-1 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCompleteDelivery}
                disabled={deliveryLoading || Boolean(deliverySuccessTx)}
                className="flex-1 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 cursor-pointer shadow-sm"
              >
                {deliveryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm & Sign on Blockchain
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* FULL ROUTE & NAVIGATION MAP MODAL */}
      <RouteMapModal
        isOpen={Boolean(selectedMapRequest)}
        onClose={() => setSelectedMapRequest(null)}
        request={selectedMapRequest}
      />
    </div>
  )
}
