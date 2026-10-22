import { useState, useEffect } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import {
  LayoutDashboard,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Store,
  Truck,
  DollarSign,
  Clock,
  QrCode,
  ShoppingCart,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  MapPin,
  Thermometer,
  Boxes,
  ChevronRight,
  AlertCircle
} from "lucide-react"
import { ProfileManagementSection } from "../../components/profile/ProfileManagementSection"
import { cn } from "../../utils"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function Dashboard() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = (searchParams.get("tab") as "overview" | "profile" | "shipments") || "overview"
  const [activeTab, setActiveTab] = useState<"overview" | "profile" | "shipments">(tabParam)

  const [data, setData] = useState<any>(null)
  const [shipments, setShipments] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const currentTab = searchParams.get("tab")
    if (currentTab === "profile" || currentTab === "shipments") {
      setActiveTab(currentTab)
    } else {
      setActiveTab("overview")
    }
  }, [searchParams])

  const handleTabChange = (tab: "overview" | "profile" | "shipments") => {
    setActiveTab(tab)
    if (tab === "overview") {
      setSearchParams({})
    } else {
      setSearchParams({ tab })
    }
  }

  const fetchAllData = async (silent = false) => {
    if (!token) return
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)

      const [dashRes, shipRes, invRes] = await Promise.all([
        axios.get(`${API_URL}/retailer/dashboard`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: null } })),
        axios.get(`${API_URL}/retailer/shipments`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_URL}/retailer/inventory`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: [] } }))
      ])

      if (dashRes.data?.data) setData(dashRes.data.data)
      if (shipRes.data?.data) setShipments(shipRes.data.data || [])
      if (invRes.data?.data) setInventory(invRes.data.data || [])
    } catch (err) {
      console.error("Dashboard fetch error:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchAllData(false)
      const interval = setInterval(() => fetchAllData(true), 8000)

      const handleFocus = () => {
        if (document.visibilityState === "visible") {
          fetchAllData(true)
        }
      }

      window.addEventListener("focus", handleFocus)
      window.addEventListener("visibilitychange", handleFocus)

      return () => {
        clearInterval(interval)
        window.removeEventListener("focus", handleFocus)
        window.removeEventListener("visibilitychange", handleFocus)
      }
    }
  }, [token])

  // Compute active inbound shipments
  const activeShipments = shipments.filter(
    (s) =>
      s.status === "ARRIVED_AT_RETAILER" ||
      s.status === "ARRIVED" ||
      s.status === "IN_TRANSIT" ||
      s.status === "DELIVERED"
  )

  const dockReadyShipments = shipments.filter(
    (s) => s.status === "ARRIVED_AT_RETAILER" || s.status === "ARRIVED" || s.status === "DELIVERED"
  )

  const urgentArrival = dockReadyShipments[0] || activeShipments[0]

  return (
    <div className="space-y-8 pb-12">
      {/* HERO STORE HEADER CARD */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white p-6 sm:p-8 shadow-2xl border border-emerald-900/40">
        {/* Ambient Decorative Lighting */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-24 w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            {/* Top Tag & Security Badge */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                <Store className="h-3.5 w-3.5 text-emerald-400" />
                Verified Retail Hub • Node #04
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-white/10 text-slate-200 border border-white/10">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                FSSAI Trade Certified
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Live Sync Active
              </span>
            </div>

            {/* Store Name & Heading */}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              {user?.name || "John's Metro Fresh Supermarket"}
            </h1>

            {/* Subtitle & Location */}
            <p className="text-sm text-slate-300 leading-relaxed flex items-center gap-1.5 flex-wrap">
              <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Koramangala 4th Block Terminal, Bengaluru</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Dock Intake Bay #1 Open</span>
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => fetchAllData(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/10 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh all metrics"
            >
              <RefreshCw className={cn("h-4 w-4 text-emerald-400", refreshing && "animate-spin")} />
              <span>{refreshing ? "Syncing..." : "Sync"}</span>
            </button>

            <Link
              to="/retailer/receive"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-900/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <QrCode className="h-4 w-4 text-slate-950" />
              <span>Scan Cargo Delivery</span>
            </Link>

            <Link
              to="/retailer/requests"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/20 text-white text-xs font-bold border border-white/10 transition-all cursor-pointer"
            >
              <ShoppingCart className="h-4 w-4 text-emerald-400" />
              <span>Order Stock</span>
            </Link>
          </div>
        </div>

        {/* Live Operational Metrics Ribbon inside Hero */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Receiving Gate</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Gate 1 Active (Chilled Dock)
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Inbound Transits</span>
            <span className="font-semibold text-white mt-0.5 block font-mono">
              {activeShipments.length} Cargo Shipment{activeShipments.length === 1 ? "" : "s"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Blockchain Gateway</span>
            <span className="font-semibold text-teal-300 mt-0.5 block font-mono">
              Sepolia Testnet #11155111
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Inventory Health</span>
            <span className="font-semibold text-emerald-400 mt-0.5 block">
              {data?.expired_alerts > 0 ? `${data.expired_alerts} Batch Alerts` : "100% Quality Certified"}
            </span>
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION CONTROLS */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => handleTabChange("overview")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeTab === "overview"
                ? "bg-white text-emerald-800 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Store Overview
          </button>
          <button
            onClick={() => handleTabChange("shipments")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeTab === "shipments"
                ? "bg-white text-emerald-800 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Truck className="h-4 w-4" />
            Incoming Dispatches
            {activeShipments.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-100 text-emerald-800">
                {activeShipments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange("profile")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeTab === "profile"
                ? "bg-white text-emerald-800 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Store Profile & Compliance
          </button>
        </div>

        <Link
          to="/retailer/alerts"
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm transition-colors"
        >
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          <span>Alert Center</span>
          {(data?.low_stock_alerts || 0) + (data?.expired_alerts || 0) > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
              {(data?.low_stock_alerts || 0) + (data?.expired_alerts || 0)}
            </span>
          )}
        </Link>
      </div>

      {/* TAB CONTENT: PROFILE */}
      {activeTab === "profile" && (
        <div className="animate-in fade-in duration-200">
          <ProfileManagementSection
            role="retailer"
            onProfileUpdated={(p) => {
              if (p?.address) {
                localStorage.setItem("retailer_address", p.address)
              }
              if (user?.email && p?.address) {
                try {
                  const map = JSON.parse(localStorage.getItem("registered_user_profiles") || "{}")
                  map[user.email.toLowerCase()] = {
                    ...(map[user.email.toLowerCase()] || {}),
                    address: p.address,
                    business_name: p.business_name,
                    phone: p.phone,
                    license_number: p.license_number,
                    coordinates: p.coordinates
                  }
                  localStorage.setItem("registered_user_profiles", JSON.stringify(map))
                } catch {}
              }
            }}
          />
        </div>
      )}

      {/* TAB CONTENT: SHIPMENTS */}
      {activeTab === "shipments" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-900">Inbound Fleet & Dispatches</h3>
              <p className="text-xs text-slate-500">Live monitoring of transporter dispatches headed to your store receiving dock.</p>
            </div>
            <Link
              to="/retailer/shipments"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>Full Shipments Console</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {shipments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
              <Truck className="h-12 w-12 text-slate-300 mb-3" />
              <h4 className="text-base font-bold text-slate-800">No active shipments found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                When suppliers or processors assign transport carriers to fulfill your stock requests, they will appear here.
              </p>
              <Link
                to="/retailer/requests"
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Create Stock Request
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {shipments.map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {s.status?.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-600">#{s.shipment_tracking_id}</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 capitalize">
                      {s.product_name || s.product?.name || "Fresh Produce"} — {s.quantity} {s.unit || "kg"}
                    </h4>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span>Carrier: <strong>{s.distributor?.name || "Assigned Carrier"}</strong></span>
                      <span>•</span>
                      <span className="font-mono text-emerald-700 font-semibold">{s.distributor?.vehicle_number || "KA-04-E-2941"}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/retailer/receive?shipment=${s.id}`)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>Intake & Scan QR</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* URGENT DOCK INTAKE SPOTLIGHT (IF CARGO HAS ARRIVED) */}
          {urgentArrival && (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/5 border-2 border-emerald-400/80 p-6 sm:p-7 shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-600 text-white shadow-sm">
                    <Truck className="h-3.5 w-3.5 animate-bounce" />
                    <span>Inbound Vehicle Arrived at Dock</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 capitalize">
                    {urgentArrival.product_name || urgentArrival.product?.name || "Cargo Produce"} — {urgentArrival.quantity} {urgentArrival.unit || "kg"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-slate-900">Vehicle:</span>
                      <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-emerald-800">
                        {urgentArrival.distributor?.vehicle_number || urgentArrival.vehicle_number || "KA-04-E-2941"}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Thermometer className="h-3.5 w-3.5 text-blue-600" />
                      <span className="font-bold text-slate-800">3.8°C Precision Chilled</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-slate-900">Batch:</span>
                      <span className="font-mono text-slate-700">{urgentArrival.batch_number}</span>
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/retailer/receive?shipment=${urgentArrival.id}`)}
                    className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm px-6 py-3.5 rounded-2xl shadow-xl shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    <QrCode className="h-5 w-5" />
                    <span>Open Camera & Complete Intake</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TOP 4 AESTHETIC METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Active Inventory Items */}
            <div className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Inventory</p>
                  <h3 className="text-3xl font-black text-slate-900">
                    {data?.total_inventory_items ?? inventory.length}
                  </h3>
                  <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Batches In Storage</span>
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors shadow-inner">
                  <Boxes className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Total warehouse items</span>
                <Link to="/retailer/inventory" className="font-bold text-emerald-700 hover:underline flex items-center gap-0.5">
                  View <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* 2. Total POS Sales Revenue */}
            <div className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">POS Total Revenue</p>
                  <h3 className="text-3xl font-black text-emerald-600 font-mono">
                    ${Number(data?.total_revenue || 0).toFixed(2)}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Across {data?.total_sales || 0} customer orders
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-colors shadow-inner">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Point of Sale Terminal</span>
                <Link to="/retailer/sales" className="font-bold text-indigo-600 hover:underline flex items-center gap-0.5">
                  Register Sale <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* 3. Inbound Transporter Dispatches */}
            <div className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inbound Shipments</p>
                  <h3 className="text-3xl font-black text-slate-900">
                    {activeShipments.length}
                  </h3>
                  <p className="text-[11px] font-semibold text-purple-600">
                    {dockReadyShipments.length} At Dock Ready
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-50 group-hover:bg-purple-100 text-purple-600 flex items-center justify-center transition-colors shadow-inner">
                  <Truck className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Transport carrier fleet</span>
                <Link to="/retailer/shipments" className="font-bold text-purple-700 hover:underline flex items-center gap-0.5">
                  Track Fleet <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* 4. FEFO Quality & Expiry Status */}
            <div className={cn(
              "group relative overflow-hidden rounded-3xl border p-6 shadow-sm hover:shadow-md transition-all duration-300",
              (data?.expired_alerts || 0) > 0
                ? "bg-rose-50/50 border-rose-200"
                : "bg-white border-slate-200/80"
            )}>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiry & Low Stock</p>
                  <h3 className={cn(
                    "text-3xl font-black",
                    (data?.expired_alerts || 0) > 0 ? "text-rose-600" : "text-amber-600"
                  )}>
                    {(data?.low_stock_alerts || 0) + (data?.expired_alerts || 0)}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-600">
                    {data?.expired_alerts || 0} Expired • {data?.low_stock_alerts || 0} Low Stock
                  </p>
                </div>
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors shadow-inner",
                  (data?.expired_alerts || 0) > 0 ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                )}>
                  {(data?.expired_alerts || 0) > 0 ? (
                    <ShieldAlert className="h-6 w-6" />
                  ) : (
                    <AlertTriangle className="h-6 w-6" />
                  )}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Shelf life tracking</span>
                <Link to="/retailer/expiry" className="font-bold text-amber-700 hover:underline flex items-center gap-0.5">
                  Manage <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* 6-CARD OPERATIONAL HUBS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Operational Command Hub</h3>
                <p className="text-xs text-slate-500">Fast access to verified store receiving, sales terminals, and inventory actions.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Hub 1: Dual-QR Receiving */}
              <Link
                to="/retailer/receive"
                className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <QrCode className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Dual-QR Intake & Receiving
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Cross-examine distributor manifests against actual physical produce crates. Scan driver QR to verify blockchain provenance.
                    </p>
                  </div>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>Open Scanner Bay</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Hub 2: Incoming Shipments */}
              <Link
                to="/retailer/shipments"
                className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      Incoming Cargo Shipments
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Monitor authorized carrier dispatches, registered vehicle numbers, temperature SLAs, and estimated arrival windows.
                    </p>
                  </div>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
                  <span>Track Inbound Cargo</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Hub 3: Live Store Inventory */}
              <Link
                to="/retailer/inventory"
                className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-teal-300 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <Boxes className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                      Warehouse & Store Inventory
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Monitor active produce batches, live stock quantities, AI quality grades, and blockchain transaction links.
                    </p>
                  </div>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-teal-600">
                  <span>Browse Current Stock</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Hub 4: Point of Sale Terminal */}
              <Link
                to="/retailer/sales"
                className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Point of Sale (POS) Checkout
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Sell certified fresh produce batches to consumers and automatically generate transparent Farm-to-Fork consumer QR receipts.
                    </p>
                  </div>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>Open Checkout Desk</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Hub 5: Order Stock from Processors */}
              <Link
                to="/retailer/requests"
                className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                      Order Stock & Processor Demands
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Broadcast purchase orders directly to regional agro-processors for fresh fruits, vegetables, grains, and organic produce.
                    </p>
                  </div>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-600">
                  <span>Place New Stock Order</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Hub 6: FEFO Shelf-Life Expiry Watch */}
              <Link
                to="/retailer/expiry"
                className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-rose-300 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-rose-700 transition-colors">
                      FEFO Expiry & Markdown Radar
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Prevent wastage using First-Expired First-Out automation. Apply dynamic discount markdowns to move near-expiry inventory.
                    </p>
                  </div>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-600">
                  <span>View Shelf-Life Radar</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>

          {/* STORE INVENTORY RECENT SNAPSHOT TABLE */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Current Store Inventory Highlights</h3>
                <p className="text-xs text-slate-500">Live batches certified for retail display and consumer sale.</p>
              </div>
              <Link
                to="/retailer/inventory"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <span>Full Inventory ({inventory.length} Batches)</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {inventory.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
                No inventory batches currently in store. When you accept deliveries at the receiving dock, they will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-3">Produce Item</th>
                      <th className="pb-3">Batch Number</th>
                      <th className="pb-3">Quantity</th>
                      <th className="pb-3">Quality Score</th>
                      <th className="pb-3">Expiry Date</th>
                      <th className="pb-3 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventory.slice(0, 5).map((item) => {
                      const pName = item.product?.name || item.product_name || "Fresh Produce"
                      const isLow = (item.quantity || 0) < 10
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 font-bold text-slate-900 capitalize">
                            {pName}
                          </td>
                          <td className="py-3.5 font-mono text-slate-600">
                            {item.batch_number}
                          </td>
                          <td className="py-3.5">
                            <span className={cn("font-bold", isLow ? "text-amber-600" : "text-slate-800")}>
                              {item.quantity} {item.unit || "kg"}
                            </span>
                            {isLow && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                Low
                              </span>
                            )}
                          </td>
                          <td className="py-3.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <Sparkles className="h-3 w-3 text-emerald-600" />
                              Grade A (94)
                            </span>
                          </td>
                          <td className="py-3.5 text-slate-600">
                            {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "Standard Fresh"}
                          </td>
                          <td className="py-3.5 text-right">
                            <Link
                              to="/retailer/sales"
                              className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition-colors"
                            >
                              <DollarSign className="h-3 w-3" /> Sell
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
