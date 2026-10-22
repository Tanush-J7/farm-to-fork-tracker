import { useState, useEffect } from "react"
import axios from "axios"
import {
  Store, Package, Search, AlertCircle, CheckCircle2,
  Send, Loader2, Sparkles, RefreshCw, X, Truck
} from "lucide-react"
import { Card, CardContent, CardTitle, CardDescription } from "../ui/Card"
import { Button } from "../ui/Button"

interface RetailerDemandDeskProps {
  api: string
  token: string | null
  products: any[]
  onRefreshProducts: () => void
}

export function RetailerDemandDesk({ api, token, products, onRefreshProducts }: RetailerDemandDeskProps) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("ALL")

  // Modal: Fulfill from Stock
  const [fulfillModalOpen, setFulfillModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [selectedBatchId, setSelectedBatchId] = useState("")
  const [selectedDistributorId, setSelectedDistributorId] = useState("")
  const [distributors, setDistributors] = useState<any[]>([])
  const [fulfillNotes, setFulfillNotes] = useState("")
  const [fulfilling, setFulfilling] = useState(false)
  const [fulfillResult, setFulfillResult] = useState<any>(null)
  const [fulfillError, setFulfillError] = useState("")

  // Modal: Source from Farmers
  const [sourceModalOpen, setSourceModalOpen] = useState(false)
  const [sourcePrice, setSourcePrice] = useState("")
  const [sourceTargetQty, setSourceTargetQty] = useState("")
  const [sourceNotes, setSourceNotes] = useState("")
  const [sourcing, setSourcing] = useState(false)
  const [sourceResult, setSourceResult] = useState<any>(null)
  const [sourceError, setSourceError] = useState("")

  const headers = { Authorization: `Bearer ${token}` }

  const fetchDistributors = async () => {
    try {
      const res = await axios.get(`${api}/processor/distributors`, { headers })
      if (res.data?.success && res.data.distributors) {
        setDistributors(res.data.distributors)
      }
    } catch (err) {
      console.warn("Could not fetch distributors from API", err)
      setDistributors([])
    }
  }

  const fetchRequests = async () => {
    try {
      setLoading(true)
      setError("")
      const res = await axios.get(`${api}/processor/requests`, { headers })
      setRequests(res.data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load retailer requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchRequests()
      fetchDistributors()
    }
  }, [token])

  // Find in-stock batches matching requested product
  const getMatchingStock = (cropName: string) => {
    if (!cropName) return []
    const lower = cropName.toLowerCase()
    return products.filter((p) => {
      const pName = (p.name || "").toLowerCase()
      const pCat = (p.category || "").toLowerCase()
      const isMatch = pName.includes(lower) || lower.includes(pName) || pCat.includes(lower)
      const isAvailable = p.status === "Processed" || p.status === "Harvested" || p.status === "Processed - Grade A"
      return isMatch && isAvailable
    })
  }

  // Open Fulfill Modal
  const handleOpenFulfill = (req: any) => {
    setSelectedRequest(req)
    setFulfillResult(null)
    setFulfillError("")
    setFulfillNotes("")
    const matches = getMatchingStock(req.product_name)
    setSelectedBatchId(matches.length > 0 ? matches[0].id : "")
    if (distributors.length > 0) {
      setSelectedDistributorId(distributors[0].id)
    }
    setFulfillModalOpen(true)
  }

  // Submit Fulfill from Stock
  const handleConfirmFulfill = async () => {
    if (!selectedRequest || !selectedBatchId) return
    setFulfilling(true)
    setFulfillError("")
    try {
      const res = await axios.put(
        `${api}/processor/requests/${selectedRequest.id}/fulfill`,
        {
          product_id: selectedBatchId,
          distributor_id: selectedDistributorId || undefined,
          notes: fulfillNotes
        },
        { headers }
      )
      setFulfillResult(res.data)
      fetchRequests()
      onRefreshProducts()
    } catch (err: any) {
      setFulfillError(err.response?.data?.message || "Failed to fulfill request")
    } finally {
      setFulfilling(false)
    }
  }

  // Open Source from Farmers Modal
  const handleOpenSource = (req: any) => {
    setSelectedRequest(req)
    setSourceResult(null)
    setSourceError("")
    setSourcePrice("")
    setSourceTargetQty(String(req.quantity || ""))
    setSourceNotes(`Procurement for Retailer Order ${req.request_id || ""}`)
    setSourceModalOpen(true)
  }

  // Submit Source from Farmers
  const handleConfirmSource = async () => {
    if (!selectedRequest) return
    setSourcing(true)
    setSourceError("")
    try {
      const res = await axios.put(
        `${api}/processor/requests/${selectedRequest.id}/source-farmers`,
        {
          offered_price: Number(sourcePrice) || undefined,
          target_quantity: Number(sourceTargetQty) || selectedRequest.quantity,
          procurement_notes: sourceNotes
        },
        { headers }
      )
      setSourceResult(res.data)
      fetchRequests()
    } catch (err: any) {
      setSourceError(err.response?.data?.message || "Failed to broadcast order to farmers")
    } finally {
      setSourcing(false)
    }
  }

  // Filtered requests
  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      (r.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.request_id || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.retailer?.name || "").toLowerCase().includes(search.toLowerCase())
    if (filter === "ALL") return matchesSearch
    return matchesSearch && r.status === filter
  })

  const pendingCount = requests.filter((r) => r.status === "PENDING").length
  const sourcingCount = requests.filter((r) => r.status === "SOURCING_FROM_FARMERS").length
  const processingCount = requests.filter((r) => r.status === "PROCESSING" || r.status === "FULFILLED").length

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl border border-emerald-200 bg-white shadow-xs p-5">
          <p className="text-xs font-bold text-slate-500 uppercase">Total Demands</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-3xl font-black text-slate-900">{requests.length}</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
              <Store className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl border border-amber-200 bg-amber-50/60 shadow-xs p-5">
          <p className="text-xs font-bold text-amber-800 uppercase">Pending Review</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-3xl font-black text-amber-900">{pendingCount}</span>
            <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-600">
              <AlertCircle className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl border border-emerald-200 bg-emerald-50/60 shadow-xs p-5">
          <p className="text-xs font-bold text-emerald-800 uppercase">Sourcing from Farmers</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-3xl font-black text-emerald-950">{sourcingCount}</span>
            <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl border border-emerald-300 bg-emerald-100/50 shadow-xs p-5">
          <p className="text-xs font-bold text-emerald-900 uppercase">Dispatched / Processing</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-3xl font-black text-emerald-950">{processingCount}</span>
            <div className="p-2.5 rounded-2xl bg-emerald-200/60 text-emerald-800">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl border border-emerald-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search crop, request ID, retailer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 w-full rounded-2xl border border-emerald-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {["ALL", "PENDING", "SOURCING_FROM_FARMERS", "PROCESSING", "FULFILLED"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className={`rounded-2xl text-xs font-bold shrink-0 transition-all ${
                filter === f
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                  : "border-emerald-200 text-slate-700 hover:bg-emerald-50"
              }`}
            >
              {f === "ALL" && "All Demands"}
              {f === "PENDING" && `Pending (${pendingCount})`}
              {f === "SOURCING_FROM_FARMERS" && `Sourcing (${sourcingCount})`}
              {f === "PROCESSING" && "In Fulfillment"}
              {f === "FULFILLED" && "Completed"}
            </Button>
          ))}
          <Button variant="ghost" size="icon" onClick={fetchRequests} title="Refresh Demands" className="text-emerald-800 hover:bg-emerald-50 rounded-xl">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-2" />
          <p className="text-sm font-medium text-slate-600">Loading retailer demands...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 text-red-700 rounded-3xl border border-red-200 text-center font-medium">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchRequests} className="mt-3 border-red-300 text-red-700 hover:bg-red-100 font-bold">
            Retry
          </Button>
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card className="rounded-3xl border border-emerald-200 bg-white shadow-xs p-12 text-center">
          <Store className="h-12 w-12 mx-auto text-emerald-300 mb-3" />
          <h3 className="text-lg font-black text-slate-800">No Retailer Demands Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            When retailers submit product requests via their portal, they will appear here for stock fulfillment or farmer procurement.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((req) => {
            const matches = getMatchingStock(req.product_name)
            const totalMatchingQty = matches.reduce((sum, m) => sum + Number(m.quantity || 0), 0)
            const hasEnoughStock = totalMatchingQty >= Number(req.quantity || 0)

            return (
              <Card key={req.id} className="rounded-3xl border border-emerald-200 bg-white shadow-xs overflow-hidden hover:border-emerald-300 transition-all">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Product & Retailer Info */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">
                          {req.request_id || "REQ-ORDER"}
                        </span>
                        <h4 className="text-lg font-black text-slate-900">{req.product_name}</h4>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          {req.quantity} {req.unit || "kg"}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            req.priority === "URGENT"
                              ? "bg-red-50 text-red-800 border border-red-200"
                              : req.priority === "HIGH"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {req.priority || "NORMAL"} Priority
                        </span>
                      </div>

                      <p className="text-xs text-slate-600">
                        Requested by <strong className="text-slate-900 font-bold">{req.retailer?.name || "Retail Supermarket"}</strong> • Required by:{" "}
                        <strong className="text-slate-900 font-bold">{req.required_date || "As soon as possible"}</strong>
                      </p>

                      {req.notes && (
                        <p className="text-xs bg-emerald-50/40 p-2.5 rounded-xl text-slate-700 italic border border-emerald-100">
                          "{req.notes}"
                        </p>
                      )}

                      {/* Smart Inventory Match Indicator */}
                      <div className="pt-2">
                        {matches.length > 0 ? (
                          <div className="flex items-center gap-2 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl w-fit font-medium">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span>
                              <strong>Warehouse Stock Available:</strong> {matches.length} matching batch(es) with{" "}
                              <strong className="text-emerald-950 font-bold">{totalMatchingQty} kg</strong> available.
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl w-fit font-medium">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                            <span>
                              <strong>No matching stock in warehouse.</strong> Sourcing fresh harvest from Farmers is recommended.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Status & Actions */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-2.5 shrink-0 justify-between">
                      <div className="w-full text-right">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                            req.status === "PENDING"
                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                              : req.status === "SOURCING_FROM_FARMERS"
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              : req.status === "PROCESSING"
                              ? "bg-blue-100 text-blue-900 border border-blue-200"
                              : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          }`}
                        >
                          {req.status === "SOURCING_FROM_FARMERS" ? "Sourcing from Farmers" : req.status}
                        </span>
                      </div>

                      <div className="flex gap-2 w-full justify-end">
                        {req.status === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              variant={hasEnoughStock ? "default" : "outline"}
                              className={`text-xs h-9 font-bold rounded-xl ${
                                hasEnoughStock
                                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                                  : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                              }`}
                              onClick={() => handleOpenFulfill(req)}
                            >
                              <Package className="mr-1.5 h-3.5 w-3.5" />
                              Fulfill from Stock
                            </Button>
                            <Button
                              size="sm"
                              variant={!hasEnoughStock ? "default" : "outline"}
                              className={`text-xs h-9 font-bold rounded-xl ${
                                !hasEnoughStock
                                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                                  : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                              }`}
                              onClick={() => handleOpenSource(req)}
                            >
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                              Request from Farmers
                            </Button>
                          </>
                        )}

                        {req.status === "SOURCING_FROM_FARMERS" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-9 text-emerald-800 border-emerald-300 hover:bg-emerald-50 font-bold rounded-xl"
                              onClick={() => handleOpenFulfill(req)}
                            >
                              Fulfill Now (If Harvest Arrived)
                            </Button>
                          </div>
                        )}

                        {(req.status === "PROCESSING" || req.status === "FULFILLED") && (
                          <span className="text-xs text-emerald-800 font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Dispatched to Retailer
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL 1: Fulfill from Stock */}
      {fulfillModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-lg w-full rounded-3xl border border-emerald-200 shadow-2xl p-6 bg-white text-slate-900 space-y-4">
            <div className="flex justify-between items-start border-b border-emerald-100 pb-3">
              <div>
                <CardTitle className="text-xl font-black text-emerald-950">Fulfill Retailer Demand from Stock</CardTitle>
                <CardDescription className="text-slate-600 text-xs">Allocate an in-stock batch to fulfill this purchase request.</CardDescription>
              </div>
              <button onClick={() => setFulfillModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {fulfillResult ? (
              <div className="p-4 bg-emerald-50 text-emerald-950 rounded-2xl border border-emerald-200 space-y-2">
                <p className="font-bold flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  {fulfillResult.message}
                </p>
                <p className="text-xs text-slate-700">
                  Tracking ID: <strong className="text-slate-900">{fulfillResult.data?.tracking_id}</strong>
                </p>
                {fulfillResult.data?.blockchain_hash && (
                  <p className="text-xs">
                    Sepolia Tx:{" "}
                    <a
                      href={`https://sepolia.etherscan.io/tx/${fulfillResult.data.blockchain_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-mono text-emerald-700 font-bold hover:text-emerald-900"
                    >
                      {fulfillResult.data.blockchain_hash.slice(0, 16)}...
                    </a>
                  </p>
                )}
                <Button className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl" onClick={() => setFulfillModalOpen(false)}>
                  Close
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-1 text-slate-800">
                  <p>
                    <strong>Product:</strong> {selectedRequest.product_name}
                  </p>
                  <p>
                    <strong>Required:</strong> {selectedRequest.quantity} {selectedRequest.unit || "kg"}
                  </p>
                  <p>
                    <strong>Destination:</strong> {selectedRequest.retailer?.name || "Retailer Store"}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Select In-Stock Batch</label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-emerald-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="">-- Choose matching warehouse batch --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Batch: {p.batch_number}) • {p.quantity} kg • Status: {p.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-emerald-600" />
                    Assign Delivery Distributor (Freight Logistics)
                  </label>
                  <select
                    value={selectedDistributorId}
                    onChange={(e) => setSelectedDistributorId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-emerald-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="">-- Choose logistics carrier --</option>
                    {distributors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.email}) • {d.vehicle_number} • [{d.current_status}{d.status_reason ? `: ${d.status_reason}` : ""}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Dispatch / Packaging Notes</label>
                  <textarea
                    rows={2}
                    value={fulfillNotes}
                    onChange={(e) => setFulfillNotes(e.target.value)}
                    placeholder="e.g. Packed in standard 25kg crates, inspected and ready for distributor pickup"
                    className="w-full p-3 rounded-xl border border-emerald-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {fulfillError && (
                  <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200 font-medium">
                    {fulfillError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 rounded-xl border-emerald-200 text-slate-700 hover:bg-emerald-50 font-bold" onClick={() => setFulfillModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs"
                    disabled={!selectedBatchId || fulfilling}
                    onClick={handleConfirmFulfill}
                  >
                    {fulfilling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                    Confirm & Dispatch
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODAL 2: Source from Farmers */}
      {sourceModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-lg w-full rounded-3xl border border-emerald-200 shadow-2xl p-6 bg-white text-slate-900 space-y-4">
            <div className="flex justify-between items-start border-b border-emerald-100 pb-3">
              <div>
                <CardTitle className="text-xl font-black text-emerald-950">Broadcast Procurement to Farmers</CardTitle>
                <CardDescription className="text-slate-600 text-xs">
                  Send an open purchase order to registered farmers to harvest and supply this crop.
                </CardDescription>
              </div>
              <button onClick={() => setSourceModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {sourceResult ? (
              <div className="p-4 bg-emerald-50 text-emerald-950 rounded-2xl border border-emerald-200 space-y-2">
                <p className="font-bold flex items-center gap-2 text-emerald-800">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                  {sourceResult.message}
                </p>
                <p className="text-xs text-slate-700">
                  Farmers can now view this order in their dashboard and accept it with 1-click harvest registration.
                </p>
                <Button className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl" onClick={() => setSourceModalOpen(false)}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-1 text-slate-800">
                  <p>
                    <strong>Demanded Crop:</strong> {selectedRequest.product_name}
                  </p>
                  <p>
                    <strong>Retailer Target:</strong> {selectedRequest.quantity} {selectedRequest.unit || "kg"}
                  </p>
                  <p>
                    <strong>Delivery Deadline:</strong> {selectedRequest.required_date || "Urgent"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-slate-500">Target Quantity (kg)</label>
                    <input
                      type="number"
                      value={sourceTargetQty}
                      onChange={(e) => setSourceTargetQty(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-emerald-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-slate-500">Offered Price (₹ / kg)</label>
                    <input
                      type="number"
                      placeholder="e.g. 45"
                      value={sourcePrice}
                      onChange={(e) => setSourcePrice(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-emerald-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Procurement Instructions / Remarks</label>
                  <textarea
                    rows={2}
                    value={sourceNotes}
                    onChange={(e) => setSourceNotes(e.target.value)}
                    placeholder="e.g. Need organic Grade A fresh harvest delivered to facility"
                    className="w-full p-3 rounded-xl border border-emerald-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {sourceError && (
                  <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200 font-medium">
                    {sourceError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 rounded-xl border-emerald-200 text-slate-700 hover:bg-emerald-50 font-bold" onClick={() => setSourceModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs"
                    disabled={sourcing}
                    onClick={handleConfirmSource}
                  >
                    {sourcing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Broadcast to Farmers
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
