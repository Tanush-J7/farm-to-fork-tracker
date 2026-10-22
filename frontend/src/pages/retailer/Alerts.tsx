import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import {
  ShieldAlert,
  Clock,
  Truck,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  X,
  BellRing
} from "lucide-react"
import { cn } from "../../utils"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

interface StoreAlert {
  id: string
  type: "EXPIRED" | "NEAR_EXPIRY" | "DOCK_ARRIVAL" | "LOW_STOCK" | "DISPUTED"
  severity: "critical" | "warning" | "info" | "success"
  title: string
  description: string
  timestamp: string
  actionLabel: string
  actionLink: string
  batchNumber?: string
  quantity?: number
  unit?: string
}

export function Alerts() {
  const { token } = useAuth()
  const [alerts, setAlerts] = useState<StoreAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<"ALL" | "CRITICAL" | "EXPIRY" | "DOCK" | "STOCK">("ALL")
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("retailer_dismissed_alerts") || "[]")
      setDismissedAlerts(saved)
    } catch {}
  }, [])

  const dismissAlert = (id: string) => {
    const next = [...dismissedAlerts, id]
    setDismissedAlerts(next)
    try {
      localStorage.setItem("retailer_dismissed_alerts", JSON.stringify(next))
    } catch {}
  }

  const fetchAlertsData = async (silent = false) => {
    if (!token) return
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)

      const [invRes, shipRes] = await Promise.all([
        axios.get(`${API_URL}/retailer/inventory`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_URL}/retailer/shipments`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: [] } }))
      ])

      const inventory = invRes.data?.data || []
      const shipments = shipRes.data?.data || []

      const generated: StoreAlert[] = []
      const now = new Date()

      // 1. Check Inventory for Expired & Near-Expiry Items
      inventory.forEach((item: any) => {
        const pName = item.product?.name || item.product_name || "Fresh Produce"
        if (item.expiry_date) {
          const exp = new Date(item.expiry_date)
          const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

          if (diffDays <= 0) {
            generated.push({
              id: `exp-${item.id}`,
              type: "EXPIRED",
              severity: "critical",
              title: `Expired Produce Batch: ${pName}`,
              description: `Batch #${item.batch_number} expired on ${exp.toLocaleDateString()}. Food safety compliance requires immediate removal from store display or logging to wastage.`,
              timestamp: item.expiry_date,
              actionLabel: "Review Wastage / Disposal",
              actionLink: "/retailer/wastage",
              batchNumber: item.batch_number,
              quantity: item.quantity,
              unit: item.unit || "kg"
            })
          } else if (diffDays <= 3) {
            generated.push({
              id: `near-exp-${item.id}`,
              type: "NEAR_EXPIRY",
              severity: "warning",
              title: `Near Expiry Alert: ${pName} (${diffDays} Days Left)`,
              description: `Batch #${item.batch_number} has ${item.quantity} ${item.unit || "kg"} remaining. FEFO recommendation: apply a 30% to 50% discount at POS checkout to liquidate stock before expiry.`,
              timestamp: item.expiry_date,
              actionLabel: "Open Flash Sale Markdown",
              actionLink: "/retailer/expiry",
              batchNumber: item.batch_number,
              quantity: item.quantity,
              unit: item.unit || "kg"
            })
          }
        }

        // Low stock alerts
        if (Number(item.quantity || 0) < 10 && item.status !== "DEPLETED") {
          generated.push({
            id: `stock-${item.id}`,
            type: "LOW_STOCK",
            severity: "info",
            title: `Low Inventory Stock: ${pName}`,
            description: `Only ${item.quantity} ${item.unit || "kg"} remaining for batch #${item.batch_number}. Consider placing a re-order to avoid customer stock-outs.`,
            timestamp: new Date().toISOString(),
            actionLabel: "Re-Order Stock",
            actionLink: "/retailer/requests",
            batchNumber: item.batch_number,
            quantity: item.quantity,
            unit: item.unit || "kg"
          })
        }
      })

      // 2. Check Shipments for Dock Arrivals & Disputes
      shipments.forEach((s: any) => {
        const pName = s.product_name || s.product?.name || "Cargo Produce"
        if (s.status === "ARRIVED_AT_RETAILER" || s.status === "ARRIVED") {
          generated.push({
            id: `dock-${s.id}`,
            type: "DOCK_ARRIVAL",
            severity: "warning",
            title: `Cargo Arrived at Receiving Dock: ${pName}`,
            description: `Transporter ${s.distributor?.name || "Carrier"} (${s.vehicle_number || s.distributor?.vehicle_number || "KA-04-E-2941"}) is at the receiving bay with ${s.quantity} ${s.unit || "kg"}. Scan Delivery QR to verify cold-chain manifest and take custody.`,
            timestamp: s.updated_at || s.created_at,
            actionLabel: "Scan Delivery QR & Intake",
            actionLink: `/retailer/receive?shipment=${s.id}`,
            batchNumber: s.batch_number,
            quantity: s.quantity,
            unit: s.unit || "kg"
          })
        } else if (s.status === "DISPUTED") {
          generated.push({
            id: `dispute-${s.id}`,
            type: "DISPUTED",
            severity: "critical",
            title: `Delivery Discrepancy Active: ${pName}`,
            description: `A physical or temperature discrepancy was reported for shipment #${s.shipment_tracking_id}. Both the Processor and Transporter have been notified.`,
            timestamp: s.updated_at || s.created_at,
            actionLabel: "Inspect Discrepancy Manifest",
            actionLink: "/retailer/shipments",
            batchNumber: s.batch_number,
            quantity: s.quantity,
            unit: s.unit || "kg"
          })
        }
      })

      // Sort: critical first, then warning, then info
      const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 }
      generated.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

      setAlerts(generated)
    } catch (err) {
      console.error("Alerts fetch error:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchAlertsData(false)
      const interval = setInterval(() => fetchAlertsData(true), 8000)
      return () => clearInterval(interval)
    }
  }, [token])

  const activeAlerts = alerts.filter((a) => !dismissedAlerts.includes(a.id))

  const filteredAlerts = activeAlerts.filter((a) => {
    if (activeFilter === "CRITICAL") return a.severity === "critical"
    if (activeFilter === "EXPIRY") return a.type === "EXPIRED" || a.type === "NEAR_EXPIRY"
    if (activeFilter === "DOCK") return a.type === "DOCK_ARRIVAL" || a.type === "DISPUTED"
    if (activeFilter === "STOCK") return a.type === "LOW_STOCK"
    return true
  })

  const criticalCount = activeAlerts.filter((a) => a.severity === "critical").length
  const expiryCount = activeAlerts.filter((a) => a.type === "EXPIRED" || a.type === "NEAR_EXPIRY").length
  const dockCount = activeAlerts.filter((a) => a.type === "DOCK_ARRIVAL" || a.type === "DISPUTED").length
  const stockCount = activeAlerts.filter((a) => a.type === "LOW_STOCK").length

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <BellRing className="h-8 w-8 text-amber-500" />
              Store Alert & Compliance Center
            </h1>
            {activeAlerts.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                {activeAlerts.length} Active
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time notifications for cold-chain excursions, expiring produce batches, receiving dock arrivals, and inventory replenishment.
          </p>
        </div>

        <button
          onClick={() => fetchAlertsData(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 text-emerald-600", refreshing && "animate-spin")} />
          <span>{refreshing ? "Checking..." : "Refresh Alerts"}</span>
        </button>
      </div>

      {/* STATS FILTER CHIPS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <button
          onClick={() => setActiveFilter("ALL")}
          className={cn(
            "p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-sm",
            activeFilter === "ALL"
              ? "bg-slate-900 text-white border-slate-900 shadow-md"
              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
          )}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">All Alerts</span>
          <span className="text-xl sm:text-2xl font-black mt-1 block font-mono">{activeAlerts.length}</span>
        </button>

        <button
          onClick={() => setActiveFilter("CRITICAL")}
          className={cn(
            "p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-sm",
            activeFilter === "CRITICAL"
              ? "bg-rose-600 text-white border-rose-600 shadow-md"
              : "bg-white text-slate-700 border-slate-200 hover:border-rose-300"
          )}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">Critical</span>
          <span className={cn("text-xl sm:text-2xl font-black mt-1 block font-mono", activeFilter === "CRITICAL" ? "text-white" : "text-rose-600")}>
            {criticalCount}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter("DOCK")}
          className={cn(
            "p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-sm",
            activeFilter === "DOCK"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
              : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
          )}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">Dock Cargo</span>
          <span className={cn("text-xl sm:text-2xl font-black mt-1 block font-mono", activeFilter === "DOCK" ? "text-white" : "text-emerald-600")}>
            {dockCount}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter("EXPIRY")}
          className={cn(
            "p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-sm",
            activeFilter === "EXPIRY"
              ? "bg-amber-600 text-white border-amber-600 shadow-md"
              : "bg-white text-slate-700 border-slate-200 hover:border-amber-300"
          )}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">FEFO Expiry</span>
          <span className={cn("text-xl sm:text-2xl font-black mt-1 block font-mono", activeFilter === "EXPIRY" ? "text-white" : "text-amber-600")}>
            {expiryCount}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter("STOCK")}
          className={cn(
            "p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-sm col-span-2 sm:col-span-1",
            activeFilter === "STOCK"
              ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
              : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
          )}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">Low Stock</span>
          <span className={cn("text-xl sm:text-2xl font-black mt-1 block font-mono", activeFilter === "STOCK" ? "text-white" : "text-indigo-600")}>
            {stockCount}
          </span>
        </button>
      </div>

      {/* ALERTS LIST */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
            <span className="text-sm font-bold text-slate-700">Evaluating store compliance & inventory radar...</span>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">All Clear — No Active Store Alerts</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
              Your receiving dock is clear, all batches meet food safety shelf-life standards, and inventory levels are sufficient.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCrit = alert.severity === "critical"
            const isWarn = alert.severity === "warning"
            const isDock = alert.type === "DOCK_ARRIVAL"

            return (
              <div
                key={alert.id}
                className={cn(
                  "relative rounded-3xl border p-6 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5",
                  isCrit
                    ? "bg-rose-50/60 border-rose-300/80"
                    : isDock
                    ? "bg-emerald-50/60 border-emerald-300/80"
                    : isWarn
                    ? "bg-amber-50/60 border-amber-300/80"
                    : "bg-white border-slate-200"
                )}
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
                        isCrit
                          ? "bg-rose-600 text-white"
                          : isDock
                          ? "bg-emerald-600 text-white"
                          : isWarn
                          ? "bg-amber-600 text-white"
                          : "bg-slate-800 text-white"
                      )}
                    >
                      {isCrit ? <ShieldAlert className="h-3 w-3" /> : isDock ? <Truck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      <span>{alert.type.replace(/_/g, " ")}</span>
                    </span>

                    {alert.batchNumber && (
                      <span className="font-mono text-xs font-bold text-slate-700 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                        Batch #{alert.batchNumber}
                      </span>
                    )}

                    {alert.quantity && (
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        ({alert.quantity} {alert.unit || "kg"})
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{alert.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                  <Link
                    to={alert.actionLink}
                    className={cn(
                      "flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-all transform hover:-translate-y-0.5",
                      isCrit
                        ? "bg-rose-600 hover:bg-rose-500 text-white"
                        : isDock
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    )}
                  >
                    <span>{alert.actionLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-xl transition-colors cursor-pointer"
                    title="Dismiss alert"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
