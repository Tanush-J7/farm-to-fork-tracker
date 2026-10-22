import React, { useState } from "react"
import axios from "axios"
import {
  Sparkles, Building2, CalendarDays, Check, X,
  PackageCheck, Clock, AlertCircle, CheckCircle2,
  Search, RefreshCw, Info
} from "lucide-react"
import { Button } from "../ui/Button"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

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

interface SourcingOrder {
  id: string
  request_id?: string
  product_name: string
  quantity: number
  unit?: string
  required_date?: string
  priority?: string
  notes?: string
  status: string
  created_at: string
  processor_id?: string
  processor?: {
    id: string
    name: string
    email: string
  }
}

interface FarmerSupplyRequestsDeskProps {
  sourcingOrders: SourcingOrder[]
  products: Product[]
  deals: Record<string, "requested" | "accepted" | "dispatched" | "declined">
  notifications: any[]
  token: string | null
  onRefresh: () => void
  onAcceptDeal: (productId: string, batchNumber: string) => void
  onMarkReadyForDispatch: (productId: string, batchNumber: string) => void
  onDeclineDeal: (productId: string, batchNumber: string) => void
  onOpenRegisterFormWithPreFill?: (prefill: { name: string; quantity: string; category?: string }) => void
}

export const FarmerSupplyRequestsDesk: React.FC<FarmerSupplyRequestsDeskProps> = ({
  sourcingOrders,
  products,
  deals,
  notifications,
  token,
  onRefresh,
  onAcceptDeal,
  onMarkReadyForDispatch,
  onDeclineDeal,
  onOpenRegisterFormWithPreFill,
}) => {
  const [filterType, setFilterType] = useState<"ALL" | "DEMANDS" | "DIRECT_DEALS" | "COMPLETED">("ALL")
  const [searchTerm, setSearchTerm] = useState("")

  // Fulfill Modal State
  const [selectedOrderForFulfill, setSelectedOrderForFulfill] = useState<SourcingOrder | null>(null)
  const [fulfillMode, setFulfillMode] = useState<"existing" | "new">("existing")
  const [selectedBatchId, setSelectedBatchId] = useState<string>("")
  const [fulfillQty, setFulfillQty] = useState<string>("")
  const [fulfillNotes, setFulfillNotes] = useState<string>("")
  const [fulfilling, setFulfilling] = useState(false)
  const [fulfillSuccess, setFulfillSuccess] = useState<string | null>(null)
  const [fulfillError, setFulfillError] = useState<string | null>(null)

  // Decline Modal State
  const [selectedOrderForDecline, setSelectedOrderForDecline] = useState<SourcingOrder | null>(null)
  const [declineReason, setDeclineReason] = useState("Harvest not available in requested timeframe")
  const [declining, setDeclining] = useState(false)

  // Declines stored locally
  const [localDeclined, setLocalDeclined] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("farmer_declined_demands") || "[]")
    } catch {
      return []
    }
  })

  const headers = { Authorization: `Bearer ${token}` }

  // Extract Price & Notes helpers
  const extractOfferedPrice = (notes?: string) => {
    if (!notes) return "Market Rate"
    const match = notes.match(/Offered:\s*([^|]+)/i)
    return match ? match[1].trim() : "Competitive Market Rate"
  }

  const extractCleanNotes = (notes?: string) => {
    if (!notes) return ""
    const parts = notes.split("|")
    if (parts.length >= 3) {
      return parts.slice(2).join(" | ").trim()
    }
    return notes
  }

  // Filter out locally declined sourcing orders
  const activeSourcingOrders = sourcingOrders.filter(
    (order) => !localDeclined.includes(order.id) && order.status === "SOURCING_FROM_FARMERS"
  )

  // Direct purchase requests from processors (where deal is requested)
  const directRequestedProducts = products.filter((p) => {
    const d = deals[p._id] || deals[p.batchNumber]
    return d === "requested" || (p.status === "Processing" && d !== "declined" && d !== "dispatched" && d !== "accepted")
  })

  // Completed / in transit orders
  const completedOrInTransitProducts = products.filter((p) => {
    const d = deals[p._id] || deals[p.batchNumber]
    return d === "accepted" || d === "dispatched"
  })

  // Open Fulfill Modal
  const handleOpenFulfillModal = (order: SourcingOrder) => {
    setSelectedOrderForFulfill(order)
    setFulfillSuccess(null)
    setFulfillError(null)
    setFulfillNotes("")
    setFulfillQty(String(order.quantity || 100))

    // Preselect best matching harvested batch if available
    const matchingBatch = products.find(
      (p) =>
        p.status === "Harvested" &&
        p.name.toLowerCase().includes(order.product_name.toLowerCase())
    ) || products.find((p) => p.status === "Harvested")

    if (matchingBatch) {
      setSelectedBatchId(matchingBatch._id)
      setFulfillMode("existing")
    } else {
      setSelectedBatchId("")
      setFulfillMode("new")
    }
  }

  // Submit Fulfillment
  const handleConfirmFulfill = async () => {
    if (!selectedOrderForFulfill) return
    setFulfilling(true)
    setFulfillError(null)

    try {
      const chosenProduct = products.find((p) => p._id === selectedBatchId)

      const payload = {
        product_id: fulfillMode === "existing" ? chosenProduct?._id : undefined,
        batch_number: fulfillMode === "existing" ? chosenProduct?.batchNumber : undefined,
        quantity: Number(fulfillQty) || selectedOrderForFulfill.quantity,
        notes: fulfillNotes || undefined
      }

      const res = await axios.put(
        `${API}/processor/farmer-sourcing/${selectedOrderForFulfill.id}/fulfill`,
        payload,
        { headers }
      )

      setFulfillSuccess(res.data?.message || "Supply request fulfilled and committed successfully!")
      
      // Update local storage and event
      window.dispatchEvent(new Event("farmer_supply_requests_updated"))
      window.dispatchEvent(new Event("farmer_deals_updated"))

      setTimeout(() => {
        setSelectedOrderForFulfill(null)
        setFulfillSuccess(null)
        onRefresh()
      }, 1200)
    } catch (err: any) {
      setFulfillError(err.response?.data?.message || "Failed to accept and fulfill supply request.")
    } finally {
      setFulfilling(false)
    }
  }

  // Submit Decline
  const handleConfirmDecline = async () => {
    if (!selectedOrderForDecline) return
    setDeclining(true)

    try {
      await axios.put(
        `${API}/processor/farmer-sourcing/${selectedOrderForDecline.id}/decline`,
        { reason: declineReason },
        { headers }
      )

      // Record decline locally
      const updated = [...localDeclined, selectedOrderForDecline.id]
      setLocalDeclined(updated)
      try {
        localStorage.setItem("farmer_declined_demands", JSON.stringify(updated))
      } catch {}

      window.dispatchEvent(new Event("farmer_supply_requests_updated"))
      setSelectedOrderForDecline(null)
      onRefresh()
    } catch (err) {
      console.warn("Decline error:", err)
      const updated = [...localDeclined, selectedOrderForDecline.id]
      setLocalDeclined(updated)
      try {
        localStorage.setItem("farmer_declined_demands", JSON.stringify(updated))
      } catch {}
      setSelectedOrderForDecline(null)
    } finally {
      setDeclining(false)
    }
  }

  // Filter items based on active tab and search
  const matchesSearch = (text: string) => text.toLowerCase().includes(searchTerm.toLowerCase())

  const displayedDemands = activeSourcingOrders.filter((o) =>
    matchesSearch(o.product_name) ||
    matchesSearch(o.processor?.name || "") ||
    matchesSearch(o.notes || "")
  )

  const displayedDirectDeals = directRequestedProducts.filter((p) =>
    matchesSearch(p.name) || matchesSearch(p.batchNumber)
  )

  const displayedCompleted = completedOrInTransitProducts.filter((p) =>
    matchesSearch(p.name) || matchesSearch(p.batchNumber)
  )

  const totalActiveDemands = activeSourcingOrders.length
  const totalDirectOffers = directRequestedProducts.length
  const totalVolumeDemanded = activeSourcingOrders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0)

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-100/30 p-6 sm:p-8 shadow-sm">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              <span>Procurement Desk</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Processor Supply Requests & Procurement Demands
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Review live purchase requests and harvest sourcing contracts broadcasted by processing facilities. Accept to commit your crops directly, allocate batches, or fulfill contracts.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={onRefresh}
              variant="outline"
              size="sm"
              className="gap-2 border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800 shadow-xs cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Feeds
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-6 mt-6 border-t border-emerald-100/80">
          <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-2xs">
            <p className="text-xs text-slate-500 font-medium">Broadcasted Demands</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900">{totalActiveDemands}</span>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">Active contracts</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-2xs">
            <p className="text-xs text-slate-500 font-medium">Direct Batch Offers</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-amber-600">{totalDirectOffers}</span>
              <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md">Interest pending</span>
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-white border border-emerald-100 shadow-2xs">
            <p className="text-xs text-slate-500 font-medium">Demanded Raw Volume</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-800">{totalVolumeDemanded.toLocaleString()} kg</span>
              <span className="text-xs text-slate-500 font-medium">Awaiting commitment</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-2xl bg-white border border-emerald-100 shadow-xs max-w-full">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              filterType === "ALL"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/60"
            }`}
          >
            All Requests ({totalActiveDemands + totalDirectOffers})
          </button>
          <button
            onClick={() => setFilterType("DEMANDS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              filterType === "DEMANDS"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/60"
            }`}
          >
            Processor Demands ({totalActiveDemands})
          </button>
          <button
            onClick={() => setFilterType("DIRECT_DEALS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              filterType === "DIRECT_DEALS"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/60"
            }`}
          >
            Direct Batch Offers ({totalDirectOffers})
          </button>
          <button
            onClick={() => setFilterType("COMPLETED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              filterType === "COMPLETED"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/60"
            }`}
          >
            Dispatched / History ({displayedCompleted.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
          <input
            type="text"
            placeholder="Search crop, processor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white border border-emerald-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs"
          />
        </div>
      </div>

      {/* SECTION 1: Direct Batch Purchase Offers (When Processor Expresses Interest in Specific Harvests) */}
      {(filterType === "ALL" || filterType === "DIRECT_DEALS") && displayedDirectDeals.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              ★
            </span>
            <h3 className="text-lg font-bold text-slate-900">Direct Harvest Purchase Offers ({displayedDirectDeals.length})</h3>
            <span className="text-xs text-amber-700 font-medium">Processor wants your registered batch</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {displayedDirectDeals.map((prod) => {
              const notif = notifications.find(
                (n) => (n.productId === prod._id || n.batchNumber === prod.batchNumber) && n.type === "processor_interest"
              )
              const procName = notif?.processorName || "Commercial Processing Depot"

              return (
                <div
                  key={prod._id}
                  className="rounded-3xl border border-amber-200 bg-amber-50/30 p-5 space-y-4 shadow-sm hover:border-amber-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                          {prod.batchNumber}
                        </span>
                        {prod.organicStatus && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold">
                            Organic
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-slate-900">{prod.name}</h4>
                      <p className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-amber-600" />
                        Interested Facility: <strong className="text-slate-900 font-semibold">{procName}</strong>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-500 block">Offered Qty</span>
                      <span className="text-base font-bold text-amber-700">{prod.quantity} kg</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-amber-100 text-xs text-slate-700 space-y-1 shadow-2xs">
                    <p className="text-[11px] text-amber-900">
                      🏢 <strong>{procName}</strong> has placed an acquisition request on this harvest batch. Accept the request to lock in price and begin packaging.
                    </p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3 text-slate-400" /> Requested on {notif?.date || "Recent"} at {notif?.time || "today"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-amber-100">
                    <Button
                      size="sm"
                      className="flex-1 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-9 rounded-xl shadow-xs cursor-pointer"
                      onClick={() => onAcceptDeal(prod._id, prod.batchNumber)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Accept Processor Deal
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1 border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 h-9 rounded-xl font-medium cursor-pointer"
                      onClick={() => onDeclineDeal(prod._id, prod.batchNumber)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: Broadcasted Processor Sourcing Orders */}
      {(filterType === "ALL" || filterType === "DEMANDS") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                🌾
              </span>
              <h3 className="text-lg font-bold text-slate-900">Broadcasted Sourcing Demands ({displayedDemands.length})</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">Open for fulfillment from any farmer</span>
          </div>

          {displayedDemands.length === 0 ? (
            <div className="rounded-3xl border border-emerald-100 bg-white p-12 text-center space-y-4 shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">No Pending Sourcing Demands</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  There are currently no open procurement broadcasts. When processing plants need raw crops to fulfill retailer contracts, demands will appear here automatically.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="gap-2 border-emerald-200 text-xs text-emerald-800 hover:bg-emerald-50 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh Demands
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {displayedDemands.map((order) => {
                const offeredPrice = extractOfferedPrice(order.notes)
                const cleanNotes = extractCleanNotes(order.notes)
                const processorName = order.processor?.name || "Verified Agro Processor"

                return (
                  <div
                    key={order.id}
                    className="rounded-3xl border border-emerald-100 bg-white p-6 space-y-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-800 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200">
                            {order.request_id || "DEMAND-" + order.id.slice(0, 6).toUpperCase()}
                          </span>
                          {order.priority && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              {order.priority} PRIORITY
                            </span>
                          )}
                        </div>
                        <h4 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                          {order.product_name}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                          <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          Facility: <strong className="text-slate-800">{processorName}</strong>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs text-slate-500 font-medium block">Target Quantity</span>
                        <span className="text-xl font-extrabold text-emerald-700">
                          {order.quantity} {order.unit || "kg"}
                        </span>
                      </div>
                    </div>

                    {/* Pricing & Requirement Box */}
                    <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Offered Rate</span>
                        <span className="text-sm font-bold text-emerald-800">{offeredPrice}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Required By Date</span>
                        <span className="text-sm font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                          {order.required_date || "Urgent Delivery"}
                        </span>
                      </div>
                    </div>

                    {/* Specification Notes */}
                    {cleanNotes && (
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <Info className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <p className="line-clamp-2">{cleanNotes}</p>
                        </div>
                      </div>
                    )}

                    {/* Interactive Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <Button
                        size="sm"
                        className="flex-1 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl shadow-xs cursor-pointer"
                        onClick={() => handleOpenFulfillModal(order)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Accept & Fulfill Demand
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 h-10 rounded-xl font-medium px-3.5 cursor-pointer"
                        onClick={() => {
                          setSelectedOrderForDecline(order)
                          setDeclineReason("Harvest not available in requested timeframe")
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                        Decline
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Fulfilled / In Transit Deals History */}
      {(filterType === "ALL" || filterType === "COMPLETED") && displayedCompleted.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-emerald-100">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
              🚚
            </span>
            <h3 className="text-lg font-bold text-slate-900">Active Committed & Dispatched Shipments ({displayedCompleted.length})</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayedCompleted.map((p) => {
              const d = deals[p._id] || deals[p.batchNumber]
              const isDispatched = d === "dispatched" || p.status === "In Transit"

              return (
                <div
                  key={p._id}
                  className="rounded-2xl border border-emerald-100 bg-white p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-slate-600">{p.batchNumber}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDispatched
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      {isDispatched ? "🚚 In Transit" : "✅ Deal Accepted"}
                    </span>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold text-slate-900">{p.name}</h5>
                    <p className="text-xs text-slate-500">{p.quantity} kg • {p.category}</p>
                  </div>

                  {!isDispatched && (
                    <Button
                      size="sm"
                      className="w-full text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl h-8 cursor-pointer"
                      onClick={() => onMarkReadyForDispatch(p._id, p.batchNumber)}
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                      Mark Ready for Dispatch
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MODAL: Accept & Fulfill Sourcing Demand */}
      {selectedOrderForFulfill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Fulfill Procurement Demand
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Commit Harvest for {selectedOrderForFulfill.product_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrderForFulfill(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Demand Summary Card */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Requesting Facility:</span>
                <strong className="text-slate-900">{selectedOrderForFulfill.processor?.name || "Processing Depot"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Target Demand:</span>
                <strong className="text-emerald-800">{selectedOrderForFulfill.quantity} {selectedOrderForFulfill.unit || "kg"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Offered Price:</span>
                <strong className="text-emerald-700">{extractOfferedPrice(selectedOrderForFulfill.notes)}</strong>
              </div>
              {selectedOrderForFulfill.required_date && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Required Delivery:</span>
                  <strong className="text-slate-800">{selectedOrderForFulfill.required_date}</strong>
                </div>
              )}
            </div>

            {/* Choose Fulfillment Mode */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 block">Choose Fulfillment Source</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFulfillMode("existing")}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    fulfillMode === "existing"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                  }`}
                >
                  <p className="text-xs font-bold">📦 Existing Batch</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Allocate from your registered harvests</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFulfillMode("new")
                    setSelectedBatchId("")
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    fulfillMode === "new"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                  }`}
                >
                  <p className="text-xs font-bold">🌱 Register New Harvest</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Register & commit a fresh crop batch</p>
                </button>
              </div>
            </div>

            {/* Mode A: Select Existing Batch */}
            {fulfillMode === "existing" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">Select Harvest Batch</label>
                {products.filter((p) => p.status === "Harvested").length === 0 ? (
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
                    No active harvested batches found. You can switch to "Register New Harvest" to add this produce.
                  </div>
                ) : (
                  <select
                    value={selectedBatchId}
                    onChange={(e) => {
                      setSelectedBatchId(e.target.value)
                      const found = products.find((p) => p._id === e.target.value)
                      if (found) {
                        setFulfillQty(String(Math.min(found.quantity, selectedOrderForFulfill.quantity)))
                      }
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="" disabled className="text-slate-400">
                      Choose an in-stock harvested batch...
                    </option>
                    {products
                      .filter((p) => p.status === "Harvested")
                      .map((p) => (
                        <option key={p._id} value={p._id} className="text-slate-900">
                          {p.name} ({p.batchNumber}) - {p.quantity} kg in stock ({p.aiQualityLabel} quality)
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}

            {/* Mode B: Register New Harvest */}
            {fulfillMode === "new" && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-3">
                <p className="text-xs text-slate-700">
                  Pre-fill the new harvest registration form for <strong>{selectedOrderForFulfill.product_name}</strong> ({fulfillQty || selectedOrderForFulfill.quantity} kg).
                </p>
                {onOpenRegisterFormWithPreFill && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                    onClick={() => {
                      onOpenRegisterFormWithPreFill({
                        name: selectedOrderForFulfill.product_name,
                        quantity: fulfillQty || String(selectedOrderForFulfill.quantity),
                        category: "Vegetables"
                      })
                      setSelectedOrderForFulfill(null)
                    }}
                  >
                    🌱 Open Harvest Registration Form
                  </Button>
                )}
              </div>
            )}

            {/* Quantity Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Quantity to Commit (kg)</label>
              <input
                type="number"
                min="1"
                value={fulfillQty}
                onChange={(e) => setFulfillQty(e.target.value)}
                placeholder="e.g. 500"
                className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            {/* Note to Processor */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Dispatch / Harvest Notes (Optional)</label>
              <input
                type="text"
                value={fulfillNotes}
                onChange={(e) => setFulfillNotes(e.target.value)}
                placeholder="e.g. Harvested this morning, packed in crates, ready for pickup"
                className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            {/* Alerts */}
            {fulfillSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{fulfillSuccess}</span>
              </div>
            )}

            {fulfillError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{fulfillError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                className="flex-1 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                onClick={() => setSelectedOrderForFulfill(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs cursor-pointer"
                disabled={fulfilling || (!selectedBatchId && fulfillMode === "existing")}
                onClick={handleConfirmFulfill}
              >
                {fulfilling ? (
                  "Confirming..."
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Confirm & Commit Harvest
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Decline Sourcing Demand */}
      {selectedOrderForDecline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                  <X className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Decline Supply Request</h4>
                  <p className="text-xs text-slate-500">{selectedOrderForDecline.product_name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForDecline(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to pass on this procurement demand from{" "}
              <strong className="text-slate-900">{selectedOrderForDecline.processor?.name || "Processing Facility"}</strong>? It will be removed from your active feed.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Reason (Optional)</label>
              <select
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400"
              >
                <option value="Harvest not available in requested timeframe">
                  Harvest not available in requested timeframe
                </option>
                <option value="Insufficient yield / quantity">
                  Insufficient yield / quantity
                </option>
                <option value="Offered price below operational costs">
                  Offered price below operational costs
                </option>
                <option value="Committed to other buyers">
                  Committed to other buyers
                </option>
                <option value="Other reason">
                  Other reason
                </option>
              </select>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                className="flex-1 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                onClick={() => setSelectedOrderForDecline(null)}
              >
                Back
              </Button>
              <Button
                className="flex-1 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs cursor-pointer"
                disabled={declining}
                onClick={handleConfirmDecline}
              >
                {declining ? "Declining..." : "Confirm Decline"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
