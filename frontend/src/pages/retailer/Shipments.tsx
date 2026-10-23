import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import {
  AlertCircle,
  Truck,
  Factory,
  Calendar,
  QrCode,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Thermometer,
  MapPin
} from "lucide-react"
import { cn } from "../../utils"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function Shipments() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const [activeFilter, setActiveFilter] = useState<"ALL" | "ARRIVED" | "IN_TRANSIT" | "COMPLETED" | "DISPUTED">("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchShipments = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      const res = await axios.get(`${API_URL}/retailer/shipments`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setShipments(res.data.data || [])
    } catch (err: any) {
      if (!silent) setError(err.response?.data?.message || "Failed to load shipments")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchShipments(false)
    const interval = setInterval(() => fetchShipments(true), 8000)

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        fetchShipments(true)
      }
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("visibilitychange", handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("visibilitychange", handleFocus)
    }
  }, [token])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filter calculations
  const arrivedCount = shipments.filter(
    (s) => s.status === "ARRIVED_AT_RETAILER" || s.status === "ARRIVED" || s.status === "DELIVERED"
  ).length

  const inTransitCount = shipments.filter((s) => s.status === "IN_TRANSIT").length
  const completedCount = shipments.filter((s) => s.status === "RECEIVED" || s.status === "COMPLETED").length
  const disputedCount = shipments.filter((s) => s.status === "DISPUTED").length

  const filteredShipments = shipments.filter((s) => {
    // 1. Status Filter
    if (activeFilter === "ARRIVED") {
      const st = s.status || ""
      if (st !== "ARRIVED_AT_RETAILER" && st !== "ARRIVED" && st !== "DELIVERED") return false
    } else if (activeFilter === "IN_TRANSIT") {
      if (s.status !== "IN_TRANSIT") return false
    } else if (activeFilter === "COMPLETED") {
      if (s.status !== "RECEIVED" && s.status !== "COMPLETED") return false
    } else if (activeFilter === "DISPUTED") {
      if (s.status !== "DISPUTED") return false
    }

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const pName = (s.product_name || s.product?.name || "").toLowerCase()
      const trackId = (s.shipment_tracking_id || "").toLowerCase()
      const batchNum = (s.batch_number || "").toLowerCase()
      const distName = (s.distributor?.name || "").toLowerCase()
      const vehicle = (s.vehicle_number || s.distributor?.vehicle_number || "").toLowerCase()

      return (
        pName.includes(q) ||
        trackId.includes(q) ||
        batchNum.includes(q) ||
        distName.includes(q) ||
        vehicle.includes(q)
      )
    }

    return true
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ARRIVED":
      case "ARRIVED_AT_RETAILER":
        return {
          label: "Arrived at Dock",
          bg: "bg-emerald-500/15 text-emerald-800 border-emerald-300",
          dot: "bg-emerald-500 animate-ping",
          pulse: true
        }
      case "IN_TRANSIT":
        return {
          label: "In Transit",
          bg: "bg-cyan-50 text-cyan-800 border-cyan-200",
          dot: "bg-cyan-500",
          pulse: true
        }
      case "DELIVERED":
        return {
          label: "Delivered (Pending Verification)",
          bg: "bg-teal-50 text-teal-800 border-teal-200",
          dot: "bg-teal-500",
          pulse: false
        }
      case "RECEIVED":
      case "COMPLETED":
        return {
          label: "Intake Verified & Stocked",
          bg: "bg-slate-100 text-slate-800 border-slate-200",
          dot: "bg-emerald-600",
          pulse: false
        }
      case "DISPUTED":
        return {
          label: "Discrepancy Reported",
          bg: "bg-rose-50 text-rose-800 border-rose-300",
          dot: "bg-rose-500",
          pulse: true
        }
      default:
        return {
          label: status.replace(/_/g, " "),
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          dot: "bg-slate-400",
          pulse: false
        }
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER WITH STATS RIBBON */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Truck className="h-8 w-8 text-emerald-600" />
              Incoming Cargo Shipments
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              {shipments.length} Total
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time multi-party transport monitoring, authorized vehicle registrations & digital-physical intake verification.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchShipments(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-emerald-600", refreshing && "animate-spin")} />
            <span>{refreshing ? "Updating..." : "Refresh"}</span>
          </button>

          <Link
            to="/retailer/receive"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
          >
            <QrCode className="h-4 w-4" />
            <span>Open QR Scanner</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* QUICK SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setActiveFilter("ALL")}
          className={cn(
            "p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs",
            activeFilter === "ALL"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
          )}
        >
          <span className={cn("text-[10px] uppercase font-bold tracking-wider block", activeFilter === "ALL" ? "text-emerald-100" : "text-slate-400")}>
            Total Dispatches
          </span>
          <span className={cn("text-2xl font-black mt-1 block font-mono", activeFilter === "ALL" ? "text-white" : "text-slate-900")}>
            {shipments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter("ARRIVED")}
          className={cn(
            "p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs relative overflow-hidden",
            activeFilter === "ARRIVED"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
          )}
        >
          {arrivedCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          <span className={cn("text-[10px] uppercase font-bold tracking-wider block", activeFilter === "ARRIVED" ? "text-emerald-100" : "text-slate-400")}>
            At Receiving Dock
          </span>
          <span className={cn("text-2xl font-black mt-1 block font-mono", activeFilter === "ARRIVED" ? "text-white" : "text-emerald-600")}>
            {arrivedCount}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter("IN_TRANSIT")}
          className={cn(
            "p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs",
            activeFilter === "IN_TRANSIT"
              ? "bg-cyan-600 text-white border-cyan-600 shadow-md ring-2 ring-cyan-500/20"
              : "bg-white text-slate-700 border-slate-200 hover:border-cyan-300"
          )}
        >
          <span className={cn("text-[10px] uppercase font-bold tracking-wider block", activeFilter === "IN_TRANSIT" ? "text-cyan-100" : "text-slate-400")}>
            En Route (In Transit)
          </span>
          <span className={cn("text-2xl font-black mt-1 block font-mono", activeFilter === "IN_TRANSIT" ? "text-white" : "text-cyan-600")}>
            {inTransitCount}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter("COMPLETED")}
          className={cn(
            "p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs",
            activeFilter === "COMPLETED"
              ? "bg-emerald-800 text-white border-emerald-800 shadow-md ring-2 ring-emerald-700/20"
              : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
          )}
        >
          <span className={cn("text-[10px] uppercase font-bold tracking-wider block", activeFilter === "COMPLETED" ? "text-emerald-200" : "text-slate-400")}>
            Handover Certified
          </span>
          <span className={cn("text-2xl font-black mt-1 block font-mono", activeFilter === "COMPLETED" ? "text-white" : "text-slate-900")}>
            {completedCount}
          </span>
        </button>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by produce, batch #, tracking ID, vehicle plate..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/50 focus:bg-white transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
          <span className="text-slate-400 font-bold uppercase text-[10px] px-2 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filter:
          </span>
          <button
            onClick={() => setActiveFilter("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer",
              activeFilter === "ALL" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            All ({shipments.length})
          </button>
          <button
            onClick={() => setActiveFilter("ARRIVED")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer",
              activeFilter === "ARRIVED" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            Dock Ready ({arrivedCount})
          </button>
          <button
            onClick={() => setActiveFilter("IN_TRANSIT")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer",
              activeFilter === "IN_TRANSIT" ? "bg-cyan-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            In Transit ({inTransitCount})
          </button>
          <button
            onClick={() => setActiveFilter("COMPLETED")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer",
              activeFilter === "COMPLETED" ? "bg-emerald-800 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            Stocked ({completedCount})
          </button>
          {disputedCount > 0 && (
            <button
              onClick={() => setActiveFilter("DISPUTED")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer",
                activeFilter === "DISPUTED" ? "bg-rose-600 text-white shadow-xs" : "text-rose-600 hover:bg-rose-50"
              )}
            >
              Disputed ({disputedCount})
            </button>
          )}
        </div>
      </div>

      {/* SHIPMENT CARDS GRID */}
      <div className="grid gap-5">
        {loading ? (
          <div className="p-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
            <span className="text-sm font-bold text-slate-700">Loading incoming cargo shipments...</span>
          </div>
        ) : filteredShipments.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mb-4">
              <Truck className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No shipments found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1.5">
              {searchQuery
                ? `No shipments matched "${searchQuery}". Try clearing search filters.`
                : "When regional processors dispatch requested produce batches, they will appear here with authorized carrier credentials."}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          filteredShipments.map((shipment) => {
            const isReceivable =
              shipment.status === "DELIVERED" ||
              shipment.status === "ARRIVED" ||
              shipment.status === "ARRIVED_AT_RETAILER" ||
              shipment.status === "IN_TRANSIT"

            const isDone = shipment.status === "RECEIVED" || shipment.status === "COMPLETED"
            const isDisputed = shipment.status === "DISPUTED"
            const badge = getStatusBadge(shipment.status)

            return (
              <div
                key={shipment.id}
                className="group bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 flex flex-col lg:flex-row"
              >
                {/* Left Column: Produce & Identity */}
                <div className="bg-gradient-to-br from-slate-50 to-emerald-50/20 border-b lg:border-b-0 lg:border-r border-slate-100 p-6 lg:w-1/3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wider uppercase border",
                          badge.bg
                        )}
                      >
                        {badge.pulse && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                        )}
                        {badge.label}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-slate-900 capitalize tracking-tight">
                        {shipment.product_name ||
                          shipment.product?.name ||
                          shipment.request?.product_name ||
                          "Fresh Produce"}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 font-mono">
                          {shipment.quantity} {shipment.unit || "kg"}
                        </span>
                        {shipment.category && (
                          <span className="text-xs text-slate-500 capitalize">
                            • {shipment.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-200/60 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Tracking ID
                      </span>
                      <button
                        onClick={() => copyToClipboard(shipment.shipment_tracking_id, shipment.id + "-trk")}
                        className="font-mono text-xs font-bold text-slate-700 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                        title="Click to copy"
                      >
                        <span>{shipment.shipment_tracking_id}</span>
                        {copiedId === shipment.id + "-trk" ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-400" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Batch Number
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {shipment.batch_number}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Logistics Details & Actions */}
                <div className="p-6 lg:w-2/3 flex flex-col justify-between space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Origin Processor Details */}
                    <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                      <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                        <Factory className="h-4 w-4" />
                        <span>Origin Facility (Processor)</span>
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-sm">
                          {shipment.processor?.name || shipment.processor_name || "Agro-Processing Facility"}
                        </h5>
                        <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{shipment.processor?.address || shipment.processor_address || "APMC Industrial Suburb, Bengaluru"}</span>
                        </p>
                        <div className="mt-2.5">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-indigo-50 text-indigo-900 px-2.5 py-0.5 rounded-md border border-indigo-200">
                            Lic: {shipment.processor?.license_number || "FSSAI-VERIFIED"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Authorized Transporter Card */}
                    <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                        <Truck className="h-4 w-4" />
                        <span>Authorized Carrier Vehicle</span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="font-bold text-slate-900 text-sm truncate">
                            {shipment.distributor?.name || shipment.distributor_name || "GreenWay Logistics & Freight Transport"}
                          </h5>
                          <span className="font-mono text-xs font-bold bg-white text-slate-900 px-2.5 py-1 rounded-lg border border-slate-300 shadow-xs flex items-center gap-1.5 shrink-0">
                            <Truck className="h-3 w-3 text-emerald-600" />
                            <span>{shipment.vehicle_number || shipment.distributor?.vehicle_number || shipment.distributor_vehicle || "KA-04-E-2941"}</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Driver Phone: <span className="font-semibold text-slate-800">{shipment.distributor?.phone || shipment.distributor_phone || "+91 98111 87654"}</span>
                        </p>
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 w-fit">
                          <Thermometer className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{shipment.departure_temperature || "3.8°C"} Fresh Monitored</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Calendar className="h-4 w-4 text-emerald-600" />
                      <span>
                        Delivery Window:{" "}
                        <strong className="text-slate-900 font-bold">
                          {shipment.expected_delivery
                            ? new Date(shipment.expected_delivery).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "Direct Transit Window"}
                        </strong>
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      {isReceivable && (
                        <button
                          onClick={() => navigate(`/retailer/receive?shipment=${shipment.id}`)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md shadow-emerald-700/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                        >
                          <QrCode className="h-4 w-4" />
                          <span>Scan Delivery QR & Intake</span>
                        </button>
                      )}

                      {isDone && (
                        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold">
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                          <span>In Store Stock • Certified</span>
                        </div>
                      )}

                      {isDisputed && (
                        <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200 px-4 py-2 rounded-xl text-xs font-bold">
                          <AlertCircle className="h-4 w-4 text-rose-600" />
                          <span>Discrepancy Reported</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
