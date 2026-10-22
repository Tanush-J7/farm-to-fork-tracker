import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import {
  Plus,
  Search,
  AlertCircle,
  Package,
  Calendar,
  Eye,
  FileText,
  Sparkles,
  Tag,
  DollarSign,
  Leaf,
  Boxes,
  X,
  MapPin,
  ChevronDown
} from "lucide-react"
import { cn } from "../../utils"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export const addDaysToToday = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

const POPULAR_SUGGESTIONS = [
  { name: "Organic Tomatoes", category: "Vegetables", unit: "kg", emoji: "🍅" },
  { name: "Farm Fresh Potatoes", category: "Vegetables", unit: "kg", emoji: "🥔" },
  { name: "Red Onions", category: "Vegetables", unit: "kg", emoji: "🧅" },
  { name: "Crisp Apples", category: "Fruits", unit: "boxes", emoji: "🍎" },
  { name: "Sweet Mangoes", category: "Fruits", unit: "boxes", emoji: "🥭" },
  { name: "Basmati Rice", category: "Grains & Cereals", unit: "quintals", emoji: "🍚" },
  { name: "Golden Wheat", category: "Grains & Cereals", unit: "quintals", emoji: "🌾" },
  { name: "Fresh Dairy Milk", category: "Dairy & Poultry", unit: "liters", emoji: "🥛" },
  { name: "Fresh Carrots", category: "Vegetables", unit: "kg", emoji: "🥕" },
  { name: "Green Bell Peppers", category: "Vegetables", unit: "kg", emoji: "🫑" },
  { name: "Organic Spinach", category: "Vegetables", unit: "kg", emoji: "🥬" },
  { name: "Garlic Bulbs", category: "Vegetables", unit: "kg", emoji: "🧄" }
]

const POPULAR_COMMODITY_DATALIST = [
  "Tomatoes", "Roma Tomatoes", "Cherry Tomatoes", "Beefsteak Tomatoes",
  "Potatoes", "Baby Potatoes", "Sweet Potatoes",
  "Red Onions", "White Onions", "Shallots",
  "Crisp Apples", "Royal Gala Apples", "Shimla Apples", "Fuji Apples",
  "Sweet Mangoes", "Alphonso Mangoes", "Kesar Mangoes", "Banganapalli Mangoes",
  "Bananas", "Robusta Bananas", "Nendran Bananas",
  "Strawberries", "Watermelons", "Oranges", "Pomegranates", "Papayas",
  "Golden Wheat", "Whole Wheat Grains", "Sharbati Wheat",
  "Basmati Rice", "Traditional Basmati", "Sona Masoori Rice", "Brown Rice",
  "Yellow Corn / Maize", "Barley", "Oats",
  "Chickpeas (Kabuli Chana)", "Red Lentils (Masoor Dal)", "Toor Dal", "Green Moong Beans",
  "Fresh Cow Milk", "Buffalo Milk", "Farm Butter", "Organic Ghee", "Fresh Paneer",
  "Fresh Carrots", "Cucumbers", "Green Bell Peppers (Capsicum)", "Red Bell Peppers",
  "Broccoli", "Cauliflower", "Green Cabbage", "Green Peas",
  "Organic Spinach", "Coriander Leaves", "Mint Leaves", "Methi Leaves",
  "Ginger Roots", "Garlic Bulbs", "Green Chillies", "Turmeric Roots"
]

export function ProductRequests() {
  const { user, token } = useAuth()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    product_name: "",
    category: "Vegetables",
    quantity: 100,
    unit: "kg",
    target_price: "",
    quality_grade: "Grade A (Standard Supermarket Fresh)",
    organic_preferred: false,
    packaging_preference: "Returnable Plastic Crates (RPC)",
    delivery_location: "",
    required_date: addDaysToToday(7),
    priority: "NORMAL",
    notes: ""
  })
  const [submitting, setSubmitting] = useState(false)

  // Details Modal
  const [selectedRequest, setSelectedRequest] = useState<any>(null)

  // Pre-fill retailer address if available
  useEffect(() => {
    const savedAddress =
      user?.address ||
      localStorage.getItem("retailer_address") ||
      "Koramangala Terminal, Receiving Dock #1, Bengaluru"
    setFormData((prev) => ({
      ...prev,
      delivery_location: prev.delivery_location || savedAddress
    }))
  }, [user?.address])

  const fetchRequests = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await axios.get(`${API_URL}/retailer/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setRequests(res.data.data || [])
    } catch (err: any) {
      if (!silent) setError(err.response?.data?.message || "Failed to load requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchRequests(false)
    const interval = setInterval(() => fetchRequests(true), 15000)

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        fetchRequests(true)
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

  const handleOpenModal = () => {
    const savedAddress =
      user?.address ||
      localStorage.getItem("retailer_address") ||
      "Koramangala Terminal, Receiving Dock #1, Bengaluru"

    setFormData({
      product_name: "",
      category: "Vegetables",
      quantity: 100,
      unit: "kg",
      target_price: "",
      quality_grade: "Grade A (Standard Supermarket Fresh)",
      organic_preferred: false,
      packaging_preference: "Returnable Plastic Crates (RPC)",
      delivery_location: savedAddress,
      required_date: addDaysToToday(7),
      priority: "NORMAL",
      notes: ""
    })
    setError("")
    setShowModal(true)
  }

  const handleApplyPreset = (preset: typeof POPULAR_SUGGESTIONS[0]) => {
    setFormData((prev) => ({
      ...prev,
      product_name: preset.name,
      category: preset.category,
      unit: preset.unit,
      organic_preferred: preset.name.toLowerCase().includes("organic")
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.product_name.trim()) {
      setError("Please specify a product name.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await axios.post(`${API_URL}/retailer/requests`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setShowModal(false)
      fetchRequests()
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create request")
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-50 text-amber-800 border-amber-300"
      case "ACCEPTED":
        return "bg-blue-50 text-blue-800 border-blue-300"
      case "PROCESSING":
        return "bg-indigo-50 text-indigo-800 border-indigo-300"
      case "FULFILLED":
        return "bg-emerald-50 text-emerald-800 border-emerald-300"
      case "REJECTED":
      case "CANCELLED":
        return "bg-rose-50 text-rose-800 border-rose-300"
      default:
        return "bg-slate-50 text-slate-800 border-slate-200"
    }
  }

  // Parse structured specifications from notes
  const parseNotes = (notesText?: string) => {
    if (!notesText) return { specs: {} as Record<string, string>, cleanNotes: "" }
    const specs: Record<string, string> = {}
    let cleanNotes = notesText

    if (notesText.includes("[SPECIFICATIONS]")) {
      const parts = notesText.split("[NOTES]")
      const specBlock = parts[0].replace("[SPECIFICATIONS]", "").trim()
      cleanNotes = parts[1] ? parts[1].trim() : ""

      specBlock.split("\n").forEach((line) => {
        const idx = line.indexOf(":")
        if (idx !== -1) {
          const key = line.substring(0, idx).trim()
          const val = line.substring(idx + 1).trim()
          if (key && val) specs[key] = val
        }
      })
    }

    return { specs, cleanNotes }
  }

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        searchQuery === "" ||
        req.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.request_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.notes?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === "ALL" || req.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [requests, searchQuery, statusFilter])

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner - White & Emerald Theme */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40 p-6 rounded-3xl border border-emerald-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Boxes className="h-7 w-7 text-emerald-600" />
              Store Product Requests
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              B2B Procurement Desk
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Broadcast custom produce procurement orders directly to regional agro-processors and supplier networks.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Product Request</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-emerald-100 overflow-hidden shadow-xs">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-emerald-100 flex flex-col sm:flex-row gap-3 items-center justify-between bg-emerald-50/30">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, ID or notes..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 text-xs font-bold text-slate-700 bg-white border border-emerald-200 rounded-xl hover:bg-emerald-50/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Fulfillments</option>
                <option value="ACCEPTED">Accepted by Processor</option>
                <option value="PROCESSING">Under Processing</option>
                <option value="FULFILLED">Fulfilled & Received</option>
                <option value="REJECTED">Declined / Closed</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            <button
              onClick={() => {
                setSearchQuery("")
                setStatusFilter("ALL")
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-emerald-200 rounded-xl hover:bg-emerald-50 cursor-pointer shrink-0"
              title="Reset filters"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Requests Table */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 bg-emerald-50/20">
            <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2" />
            Loading procurement requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center bg-emerald-50/20">
            <Package className="h-12 w-12 text-emerald-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No requests found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {searchQuery || statusFilter !== "ALL"
                ? "No product requests match your active filters. Try adjusting the search query."
                : "You haven't submitted any product procurement requests yet. Click 'New Product Request' to order fresh inventory."}
            </p>
            {searchQuery === "" && statusFilter === "ALL" && (
              <button
                onClick={handleOpenModal}
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Create First Request
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] text-emerald-900 bg-emerald-50/70 uppercase font-extrabold border-b border-emerald-100 tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Request ID</th>
                  <th className="px-6 py-3.5">Product & Specs</th>
                  <th className="px-6 py-3.5">Quantity</th>
                  <th className="px-6 py-3.5">Required Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filteredRequests.map((req) => {
                  const { specs } = parseNotes(req.notes)
                  const isHighPriority = req.priority === "HIGH" || req.priority === "URGENT"

                  return (
                    <tr key={req.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        {req.request_id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm capitalize">
                          {req.product_name}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {specs["Category"] && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              <Tag className="h-2.5 w-2.5 text-slate-500" />
                              {specs["Category"]}
                            </span>
                          )}
                          {specs["Organic Certified"] === "Yes" && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Leaf className="h-2.5 w-2.5 text-emerald-600" />
                              Organic
                            </span>
                          )}
                          {specs["Quality Grade"] && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                              {specs["Quality Grade"].split("(")[0].trim()}
                            </span>
                          )}
                          {isHighPriority && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                              <AlertCircle className="h-2.5 w-2.5 text-rose-600" />
                              {req.priority}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-slate-800 text-sm">
                          {req.quantity}
                        </span>{" "}
                        <span className="font-semibold text-slate-600">{req.unit}</span>
                        {specs["Target Price"] && (
                          <div className="text-[11px] font-mono text-emerald-700 mt-0.5 font-semibold">
                            Target: {specs["Target Price"]}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                          {new Date(req.required_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusColor(
                            req.status
                          )}`}
                        >
                          {req.status?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                        >
                          <Eye className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-emerald-100 animate-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-emerald-100 flex justify-between items-center bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/40">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900 font-mono">
                    {selectedRequest.request_id}
                  </h2>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(
                      selectedRequest.status
                    )}`}
                  >
                    {selectedRequest.status?.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Submitted on {new Date(selectedRequest.created_at).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Product Title Card */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Procurement Commodity
                  </span>
                  <h3 className="text-xl font-black text-slate-900 capitalize mt-0.5">
                    {selectedRequest.product_name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Order Volume: <strong>{selectedRequest.quantity} {selectedRequest.unit}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Priority
                  </span>
                  <span
                    className={cn(
                      "text-xs font-extrabold inline-block mt-0.5 px-2 py-0.5 rounded-md",
                      selectedRequest.priority === "HIGH" || selectedRequest.priority === "URGENT"
                        ? "bg-rose-100 text-rose-700 border border-rose-200"
                        : "bg-white text-slate-800 border border-slate-200"
                    )}
                  >
                    {selectedRequest.priority}
                  </span>
                </div>
              </div>

              {/* Parsed Specifications Grid */}
              {(() => {
                const { specs, cleanNotes } = parseNotes(selectedRequest.notes)
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Required By Date</span>
                        <div className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                          {new Date(selectedRequest.required_date).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Category</span>
                        <div className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-slate-500" />
                          {specs["Category"] || "Fresh Agricultural Produce"}
                        </div>
                      </div>

                      {specs["Quality Grade"] && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Quality Grade Target</span>
                          <div className="font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                            {specs["Quality Grade"]}
                          </div>
                        </div>
                      )}

                      {specs["Target Price"] && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Target Price Ceiling</span>
                          <div className="font-mono font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
                            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                            {specs["Target Price"]}
                          </div>
                        </div>
                      )}

                      {specs["Packaging"] && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Packaging Preference</span>
                          <div className="font-semibold text-slate-800 mt-1">
                            {specs["Packaging"]}
                          </div>
                        </div>
                      )}

                      {specs["Organic Certified"] && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Organic Certified</span>
                          <div className="font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
                            <Leaf className="h-3.5 w-3.5 text-emerald-600" />
                            {specs["Organic Certified"]}
                          </div>
                        </div>
                      )}
                    </div>

                    {specs["Receiving Dock"] && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          Delivery Dock / Destination
                        </span>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>{specs["Receiving Dock"]}</span>
                        </div>
                      </div>
                    )}

                    {cleanNotes && (
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-emerald-600" />
                          Procurement Instructions & Notes
                        </h4>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {cleanNotes}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            <div className="p-4 border-t border-emerald-100 bg-slate-50/70 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal - Extended Fields & Typeable Product Name */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-emerald-100 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/40 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">New Product Request</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    B2B Demand
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Submit a new stock requirement to regional processors and distributors.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 text-rose-700 rounded-2xl text-xs border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <p className="font-semibold">{error}</p>
                </div>
              )}

              <form id="requestForm" onSubmit={handleSubmit} className="space-y-5">
                {/* 1. PRODUCT NAME INPUT (TYPEABLE + DATALIST + SUGGESTIONS) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Product Name</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">Type any produce or select preset</span>
                  </div>

                  <input
                    type="text"
                    list="popular-commodity-list"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="Type produce name (e.g. Organic Tomatoes, Shimla Apples, Basmati Rice)..."
                    className="w-full px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 shadow-2xs"
                    required
                    autoFocus
                  />

                  {/* Datalist for fast browser autocomplete */}
                  <datalist id="popular-commodity-list">
                    {POPULAR_COMMODITY_DATALIST.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>

                  {/* Quick-Preset Chips */}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                      Popular Produce Quick-Select:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_SUGGESTIONS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => handleApplyPreset(preset)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border flex items-center gap-1",
                            formData.product_name.toLowerCase() === preset.name.toLowerCase()
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                              : "bg-white hover:bg-emerald-50 text-slate-700 border-slate-200 hover:border-emerald-300"
                          )}
                        >
                          <span>{preset.emoji}</span>
                          <span>{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. CATEGORY & QUALITY GRADE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Produce Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs font-semibold text-slate-900 bg-white"
                      required
                    >
                      <option value="Vegetables">Vegetables</option>
                      <option value="Fruits">Fruits</option>
                      <option value="Grains & Cereals">Grains & Cereals</option>
                      <option value="Pulses & Legumes">Pulses & Legumes</option>
                      <option value="Dairy & Poultry">Dairy & Poultry</option>
                      <option value="Herbs & Spices">Herbs & Spices</option>
                      <option value="Dry Fruits & Nuts">Dry Fruits & Nuts</option>
                      <option value="Other Fresh Produce">Other Fresh Produce</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Target Quality Grade
                    </label>
                    <select
                      value={formData.quality_grade}
                      onChange={(e) => setFormData({ ...formData, quality_grade: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs font-semibold text-slate-900 bg-white"
                    >
                      <option value="Grade A (Standard Supermarket Fresh)">Grade A (Standard Supermarket Fresh)</option>
                      <option value="Grade A+ (Premium / Export Quality)">Grade A+ (Premium / Export Quality)</option>
                      <option value="Grade B (Commercial Retail Standard)">Grade B (Commercial Retail Standard)</option>
                      <option value="Certified Organic Only">Certified Organic Only</option>
                      <option value="Any Commercial Grade">Any Commercial Grade</option>
                    </select>
                  </div>
                </div>

                {/* 3. QUANTITY, UNIT & TARGET PRICE */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs font-bold text-slate-900 bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Unit <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs font-semibold text-slate-900 bg-white"
                      required
                    >
                      <option value="kg">Kilograms (kg)</option>
                      <option value="tons">Metric Tons (MT)</option>
                      <option value="quintals">Quintals (100 kg)</option>
                      <option value="crates">Crates (~20 kg)</option>
                      <option value="boxes">Carton Boxes</option>
                      <option value="liters">Liters (L)</option>
                      <option value="units">Individual Units / Count</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Target Price / Budget
                    </label>
                    <input
                      type="text"
                      value={formData.target_price}
                      onChange={(e) => setFormData({ ...formData, target_price: e.target.value })}
                      placeholder="e.g. $2.50 / kg or ₹45 / kg"
                      className="w-full px-3.5 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs font-mono font-semibold text-slate-900 bg-white placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* 4. REQUIRED DATE, PRIORITY & PACKAGING */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Required Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.required_date}
                      onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-3.5 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs font-semibold text-slate-900 bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Fulfillment Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs font-semibold text-slate-900 bg-white"
                    >
                      <option value="NORMAL">Normal (Standard Schedule)</option>
                      <option value="HIGH">High Priority (Urgent Stock)</option>
                      <option value="URGENT">Critical (Immediate Restock)</option>
                      <option value="LOW">Low (Flexible Arrival)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Packaging Spec
                    </label>
                    <select
                      value={formData.packaging_preference}
                      onChange={(e) => setFormData({ ...formData, packaging_preference: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs font-semibold text-slate-900 bg-white"
                    >
                      <option value="Returnable Plastic Crates (RPC)">Returnable Plastic Crates (RPC)</option>
                      <option value="Corrugated Carton Boxes">Corrugated Carton Boxes</option>
                      <option value="Ventilated Mesh Bags">Ventilated Mesh Bags</option>
                      <option value="Jute / Gunny Bags">Jute / Gunny Bags</option>
                      <option value="Palletized Bulk Bins">Palletized Bulk Bins</option>
                      <option value="Standard Wholesale Packaging">Standard Wholesale Packaging</option>
                    </select>
                  </div>
                </div>

                {/* 5. RECEIVING DOCK / STORE DESTINATION */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Receiving Dock & Delivery Destination</span>
                  </label>
                  <input
                    type="text"
                    value={formData.delivery_location}
                    onChange={(e) => setFormData({ ...formData, delivery_location: e.target.value })}
                    placeholder="Store address or receiving dock terminal..."
                    className="w-full px-3.5 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs font-semibold text-slate-900 bg-white"
                  />
                </div>

                {/* 6. ORGANIC CERTIFICATION PREFERENCE TOGGLE */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                      <Leaf className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Strictly Organic Certified Produce Preferred
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Require NPOP / USDA organic certification on supplier verification.
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.organic_preferred}
                      onChange={(e) => setFormData({ ...formData, organic_preferred: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                  </label>
                </div>

                {/* 7. ADDITIONAL NOTES / INSTRUCTIONS */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Special Instructions & Notes</span>
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Specific requirements, preferred processor, delivery window time (e.g. before 8:00 AM), tamper seal specs, etc."
                    className="w-full px-3.5 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 text-xs text-slate-900 bg-white resize-none shadow-2xs"
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer Buttons */}
            <div className="p-4 border-t border-emerald-100 bg-slate-50/70 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="requestForm"
                disabled={submitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer transition-all"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
