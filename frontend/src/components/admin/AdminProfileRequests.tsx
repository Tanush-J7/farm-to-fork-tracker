import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import {
  ShieldCheck,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  Store,
  Warehouse,
  Truck,
  MessageSquare
} from "lucide-react"
import { Card, CardContent, CardHeader } from "../ui/Card"
import { Button } from "../ui/Button"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export interface ProfileRequestItem {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_role: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  requested_changes: {
    business_name?: string
    phone?: string
    license_number?: string
    address?: string
    city?: string
    state?: string
    pincode?: string
    facility_type?: string
    operating_hours?: string
    contact_person_name?: string
    contact_email?: string
    coordinates?: { lat: number; lng: number }
    storage_capacity?: string
  }
  previous_profile?: {
    business_name?: string
    phone?: string
    license_number?: string
    address?: string
    facility_type?: string
    operating_hours?: string
    coordinates?: { lat: number; lng: number }
  }
  admin_notes?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
}

export function AdminProfileRequests() {
  const { token } = useAuth()

  const [requests, setRequests] = useState<ProfileRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING")
  const [searchTerm, setSearchTerm] = useState("")

  // Review state
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const res = await axios.get(`${API}/admin/profile-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        setRequests(res.data.data || [])
      }
    } catch (err: any) {
      console.error("Failed to fetch profile requests:", err)
      setToastMsg({ type: "error", text: "Failed to load profile review requests from server." })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchRequests()
  }, [token])

  const handleReviewAction = async (requestId: string, action: "APPROVE" | "REJECT", notes?: string) => {
    setActionLoading(true)
    try {
      const res = await axios.put(
        `${API}/admin/profile-requests/${requestId}/review`,
        { action, admin_notes: notes },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data.success) {
        setToastMsg({
          type: "success",
          text: action === "APPROVE" 
            ? "Facility profile approved! New delivery address is now active for logistics." 
            : "Profile request rejected. Notification sent to the user."
        })
        setRejectingId(null)
        setRejectNotes("")
        fetchRequests()
      }
    } catch (err: any) {
      console.error("Failed to review profile request:", err)
      setToastMsg({ type: "error", text: err.response?.data?.message || "Failed to process review action." })
    } finally {
      setActionLoading(false)
    }
  }

  const pendingCount = requests.filter((r) => r.status === "PENDING").length

  const filteredRequests = requests.filter((r) => {
    const matchesFilter = filterStatus === "ALL" || r.status === filterStatus
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      r.user_name.toLowerCase().includes(term) ||
      r.user_email.toLowerCase().includes(term) ||
      (r.requested_changes.business_name || "").toLowerCase().includes(term) ||
      (r.requested_changes.license_number || "").toLowerCase().includes(term) ||
      (r.requested_changes.address || "").toLowerCase().includes(term)

    return matchesFilter && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Facility & Store Profile Verification Queue
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Review and verify address, FSSAI / trade license numbers, and physical location changes requested by Processors and Retailers.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={fetchRequests}
          disabled={loading}
          className="rounded-xl gap-2 text-xs shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Requests
        </Button>
      </div>

      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
            toastMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 text-red-800 dark:text-red-200"
          }`}
        >
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="opacity-70 hover:opacity-100 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Filter Buttons */}
        <div className="flex overflow-x-auto pb-1 gap-1.5 w-full sm:w-auto">
          <Button
            size="sm"
            variant={filterStatus === "PENDING" ? "default" : "outline"}
            onClick={() => setFilterStatus("PENDING")}
            className="rounded-xl text-xs gap-1.5 h-8 font-semibold"
          >
            Pending Review
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white ml-1">
                {pendingCount}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            variant={filterStatus === "ALL" ? "default" : "outline"}
            onClick={() => setFilterStatus("ALL")}
            className="rounded-xl text-xs h-8 font-semibold"
          >
            All ({requests.length})
          </Button>

          <Button
            size="sm"
            variant={filterStatus === "APPROVED" ? "default" : "outline"}
            onClick={() => setFilterStatus("APPROVED")}
            className="rounded-xl text-xs h-8 font-semibold text-emerald-700 dark:text-emerald-300"
          >
            Approved ({requests.filter((r) => r.status === "APPROVED").length})
          </Button>

          <Button
            size="sm"
            variant={filterStatus === "REJECTED" ? "default" : "outline"}
            onClick={() => setFilterStatus("REJECTED")}
            className="rounded-xl text-xs h-8 font-semibold text-red-700 dark:text-red-300"
          >
            Rejected ({requests.filter((r) => r.status === "REJECTED").length})
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search facility, license, address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* REQUESTS LIST */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Loading pending verification requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto w-fit mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h4 className="font-bold text-sm text-foreground">No Profile Requests Found</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {filterStatus === "PENDING"
              ? "All processor and retailer facility profile requests have been verified and processed."
              : "No profile update records match the current filter or search criteria."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const isPending = req.status === "PENDING"
            const isApproved = req.status === "APPROVED"
            const isRejected = req.status === "REJECTED"
            const isProc = req.user_role === "processor"
            const isDist = req.user_role === "distributor"

            const requested = req.requested_changes
            const prev = req.previous_profile || {}

            const isRejecting = rejectingId === req.id

            return (
              <Card
                key={req.id}
                className={`transition-all border rounded-2xl shadow-sm overflow-hidden ${
                  isPending
                    ? "border-amber-400/60 bg-gradient-to-r from-amber-500/[0.04] to-transparent"
                    : isApproved
                    ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/[0.03] to-transparent"
                    : "border-red-500/30 bg-gradient-to-r from-red-500/[0.03] to-transparent"
                }`}
              >
                <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isProc
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : isDist
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {isProc ? (
                          <Warehouse className="h-5 w-5" />
                        ) : isDist ? (
                          <Truck className="h-5 w-5" />
                        ) : (
                          <Store className="h-5 w-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground">
                            {requested.business_name || req.user_name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isProc
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                : isDist
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            }`}
                          >
                            {req.user_role}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Requester: <span className="font-medium text-foreground">{req.user_name}</span> ({req.user_email})
                          {" • "}Submitted {new Date(req.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300/50">
                          <Clock className="h-3.5 w-3.5 animate-pulse" /> Pending Approval
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300/50">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approved & Active
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300/50">
                          <XCircle className="h-3.5 w-3.5" /> Rejected
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* SIDE-BY-SIDE DIFF COMPARISON */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* CURRENT / PREVIOUS VALUE */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-border/60 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Previous Active Profile
                      </span>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Business Name:</span>
                        <span className="font-semibold text-foreground">{prev.business_name || "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Food Safety License:</span>
                        <span className="font-mono text-muted-foreground">{prev.license_number || "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Active Physical Address:</span>
                        <span className="text-muted-foreground leading-relaxed block">{prev.address || "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Phone:</span>
                        <span className="text-muted-foreground">{prev.phone || "—"}</span>
                      </div>
                    </div>

                    {/* PROPOSED VALUE AWAITING APPROVAL */}
                    <div className="p-3.5 rounded-xl bg-emerald-500/[0.06] dark:bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                          Requested Updates (Subject to Approval)
                        </span>
                        {requested.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(requested.address)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <MapPin className="h-3 w-3" /> Map View <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Proposed Business Name:</span>
                        <span className="font-bold text-foreground text-xs">{requested.business_name || "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">FSSAI / Trade License:</span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-xs inline-block">
                          {requested.license_number || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Requested Physical Address:</span>
                        <span className="font-medium text-foreground leading-relaxed block">{requested.address || "—"}</span>
                        {requested.coordinates && (
                          <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                            GPS: {requested.coordinates.lat?.toFixed(4)}, {requested.coordinates.lng?.toFixed(4)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Phone:</span>
                          <span className="font-mono text-foreground">{requested.phone || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Operating Hours:</span>
                          <span className="text-foreground">{requested.operating_hours || "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ADMIN REVIEW SUMMARY (IF ALREADY REVIEWED) */}
                  {!isPending && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-border/60 text-xs flex items-start gap-2.5">
                      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-foreground">
                          {isApproved ? "Approved by Admin" : "Declined by Admin"}:{" "}
                        </span>
                        <span className="text-muted-foreground">
                          {req.admin_notes || (isApproved ? "Verified credentials and address." : "Verification declined.")}
                        </span>
                        {req.reviewed_at && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            Reviewed on {new Date(req.reviewed_at).toLocaleString()} by {req.reviewed_by || "Admin"}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* INLINE REJECT INPUT */}
                  {isPending && isRejecting && (
                    <div className="p-4 rounded-xl border border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2 text-xs font-bold text-red-800 dark:text-red-300">
                        <AlertTriangle className="h-4 w-4" />
                        Provide Reason for Declining Profile Update
                      </div>
                      <input
                        type="text"
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        placeholder="e.g. License number could not be validated on FSSAI portal / Address proof required."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-red-200 bg-background focus:outline-none focus:ring-1 focus:ring-red-400"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejectingId(null)
                            setRejectNotes("")
                          }}
                          disabled={actionLoading}
                          className="h-7 text-xs rounded-lg"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReviewAction(req.id, "REJECT", rejectNotes)}
                          disabled={actionLoading || !rejectNotes.trim()}
                          className="h-7 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold"
                        >
                          Confirm Rejection
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ADMIN ACTION BUTTONS (FOR PENDING REQUESTS) */}
                  {isPending && !isRejecting && (
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectingId(req.id)}
                        disabled={actionLoading}
                        className="w-full sm:w-auto h-8 text-xs rounded-xl border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-500/10 font-semibold gap-1.5"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Decline Request
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleReviewAction(req.id, "APPROVE")}
                        disabled={actionLoading}
                        className="w-full sm:w-auto h-8 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-sm"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Approve Profile & Activate Location
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
