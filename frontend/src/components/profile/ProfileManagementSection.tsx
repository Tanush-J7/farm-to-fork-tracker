import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import {
  ShieldCheck,
  Building2,
  MapPin,
  Phone,
  FileText,
  Clock,
  Locate,
  CheckCircle2,
  AlertCircle,
  Clock3,
  ExternalLink,
  Save,
  RotateCcw,
  Info,
  Warehouse,
  Store,
  UserCheck
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card"
import { Button } from "../ui/Button"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export interface UserCoordinates {
  lat: number
  lng: number
}

export interface UserFacilityProfile {
  user_id: string
  business_name: string
  role: string
  phone: string
  license_number: string
  address: string
  city: string
  state: string
  pincode: string
  facility_type: string
  operating_hours: string
  contact_person_name?: string
  contact_email?: string
  coordinates: UserCoordinates
  storage_capacity?: string
  is_verified: boolean
  verified_at?: string
  verified_by?: string
  updated_at?: string
}

export interface ProfileChangeRequest {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_role: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  requested_changes: Partial<UserFacilityProfile>
  previous_profile?: Partial<UserFacilityProfile>
  admin_notes?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
}

interface ProfileManagementSectionProps {
  role: "processor" | "retailer" | "farmer" | "distributor"
  onProfileUpdated?: (profile: UserFacilityProfile) => void
}

export function ProfileManagementSection({ role, onProfileUpdated }: ProfileManagementSectionProps) {
  const { token, user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [activeProfile, setActiveProfile] = useState<UserFacilityProfile | null>(null)
  const [pendingRequest, setPendingRequest] = useState<ProfileChangeRequest | null>(null)
  const [lastRejectedRequest, setLastRejectedRequest] = useState<ProfileChangeRequest | null>(null)

  // Form Fields
  const [businessName, setBusinessName] = useState("")
  const [phone, setPhone] = useState("")
  const [licenseNumber, setLicenseNumber] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("Bengaluru")
  const [state, setState] = useState("Karnataka")
  const [pincode, setPincode] = useState("560022")
  const [facilityType, setFacilityType] = useState("")
  const [operatingHours, setOperatingHours] = useState("06:00 AM - 10:00 PM")
  const [contactPerson, setContactPerson] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [lat, setLat] = useState<number>(13.0285)
  const [lng, setLng] = useState<number>(77.5456)
  const [storageCapacity, setStorageCapacity] = useState("")

  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [showPendingDiff, setShowPendingDiff] = useState(false)

  const isProcessor = role === "processor"
  const isRetailer = role === "retailer"

  const fetchProfileData = async () => {
    try {
      setLoading(true)
      const res = await axios.get(`${API}/profile/my`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data.success && res.data.data) {
        const { active_profile, pending_request, last_rejected_request } = res.data.data
        setActiveProfile(active_profile)
        setPendingRequest(pending_request)
        setLastRejectedRequest(last_rejected_request)

        if (active_profile) {
          setBusinessName(active_profile.business_name || user?.name || "")
          setPhone(active_profile.phone || "")
          setLicenseNumber(active_profile.license_number || "")
          setAddress(active_profile.address || "")
          setCity(active_profile.city || "Bengaluru")
          setState(active_profile.state || "Karnataka")
          setPincode(active_profile.pincode || "560022")
          setFacilityType(active_profile.facility_type || (isRetailer ? "Direct Retail Supermarket" : "Chilled Cold-Storage Depot"))
          setOperatingHours(active_profile.operating_hours || "06:00 AM - 10:00 PM")
          setContactPerson(active_profile.contact_person_name || user?.name || "")
          setContactEmail(active_profile.contact_email || user?.email || "")
          setStorageCapacity(active_profile.storage_capacity || (isRetailer ? "120 Metric Tons Retail Shelf" : "500 Metric Tons Chilled"))
          if (active_profile.coordinates) {
            setLat(active_profile.coordinates.lat || 13.0285)
            setLng(active_profile.coordinates.lng || 77.5456)
          }

          if (onProfileUpdated) {
            onProfileUpdated(active_profile)
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch profile status:", err)
      setFeedbackMsg({
        type: "error",
        text: err.response?.data?.message || "Failed to load profile details. Check server connection."
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchProfileData()
    }
  }, [token])

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.")
      return
    }

    setLocating(true)
    setFeedbackMsg(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const curLat = pos.coords.latitude
        const curLng = pos.coords.longitude
        setLat(curLat)
        setLng(curLng)

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${curLat}&lon=${curLng}`
          )
          const data = await res.json()
          if (data && data.display_name) {
            setAddress(data.display_name)
            if (data.address?.city || data.address?.town || data.address?.state_district) {
              setCity(data.address.city || data.address.town || data.address.state_district)
            }
            if (data.address?.state) setState(data.address.state)
            if (data.address?.postcode) setPincode(data.address.postcode)
            setFeedbackMsg({
              type: "success",
              text: `GPS location detected! Reverse-geocoded to ${data.display_name.slice(0, 50)}...`
            })
          } else {
            setAddress(`Lat: ${curLat.toFixed(5)}, Lng: ${curLng.toFixed(5)}`)
          }
        } catch {
          setAddress(`Lat: ${curLat.toFixed(5)}, Lng: ${curLng.toFixed(5)}`)
          setFeedbackMsg({
            type: "info",
            text: `GPS coordinates captured: (${curLat.toFixed(4)}, ${curLng.toFixed(4)}). Please enter street address details.`
          })
        } finally {
          setLocating(false)
        }
      },
      (err) => {
        console.error("GPS error:", err)
        setFeedbackMsg({ type: "error", text: "Unable to detect GPS location. Please check browser permissions." })
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleReset = () => {
    if (activeProfile) {
      setBusinessName(activeProfile.business_name || "")
      setPhone(activeProfile.phone || "")
      setLicenseNumber(activeProfile.license_number || "")
      setAddress(activeProfile.address || "")
      setCity(activeProfile.city || "Bengaluru")
      setState(activeProfile.state || "Karnataka")
      setPincode(activeProfile.pincode || "560022")
      setFacilityType(activeProfile.facility_type || "")
      setOperatingHours(activeProfile.operating_hours || "")
      setContactPerson(activeProfile.contact_person_name || "")
      setContactEmail(activeProfile.contact_email || "")
      setStorageCapacity(activeProfile.storage_capacity || "")
      if (activeProfile.coordinates) {
        setLat(activeProfile.coordinates.lat)
        setLng(activeProfile.coordinates.lng)
      }
      setFeedbackMsg({ type: "info", text: "Form reset to current active verified profile values." })
    }
  }

  const handleSubmitForApproval = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!businessName.trim() || !address.trim() || !licenseNumber.trim() || !phone.trim()) {
      setFeedbackMsg({
        type: "error",
        text: "Business Name, Physical Address, License Number, and Contact Phone are required."
      })
      return
    }

    setSubmitting(true)
    setFeedbackMsg(null)

    try {
      const payload = {
        business_name: businessName.trim(),
        phone: phone.trim(),
        license_number: licenseNumber.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        facility_type: facilityType.trim(),
        operating_hours: operatingHours.trim(),
        contact_person_name: contactPerson.trim(),
        contact_email: contactEmail.trim(),
        coordinates: { lat, lng },
        storage_capacity: storageCapacity.trim()
      }

      const res = await axios.post(`${API}/profile/request-update`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data.success) {
        setFeedbackMsg({
          type: "success",
          text: "Profile changes submitted successfully! An administrator will verify your credentials and approve the updates."
        })
        fetchProfileData()
      }
    } catch (err: any) {
      console.error("Failed to submit profile change request:", err)
      setFeedbackMsg({
        type: "error",
        text: err.response?.data?.message || "Failed to submit profile update request. Please try again."
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground font-medium">Loading verified profile and compliance records...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title & Introduction */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isProcessor ? (
              <Warehouse className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Store className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            )}
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isProcessor ? "Processor Facility Profile & Logistics Hub" : "Retailer Store Profile & Receiving Dock"}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your legal entity, FSSAI / trade license, and physical location. This verified location is strictly used for distributor delivery routes.
          </p>
        </div>

        {activeProfile?.is_verified && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold shrink-0">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Admin Verified Facility</span>
          </div>
        )}
      </div>

      {/* FEEDBACK ALERT */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm animate-in fade-in ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : feedbackMsg.type === "error"
              ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
              : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          ) : feedbackMsg.type === "error" ? (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <Info className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{feedbackMsg.text}</div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* STATUS BANNER 1: PENDING ADMIN APPROVAL */}
      {pendingRequest && (
        <Card className="border-amber-400/50 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 mt-0.5">
                  <Clock3 className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-amber-800 dark:text-amber-300">
                      Profile Updates Pending Admin Verification
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      PENDING REVIEW
                    </span>
                  </div>
                  <p className="text-xs text-amber-700/90 dark:text-amber-400/90 mt-1 max-w-2xl leading-relaxed">
                    You submitted profile changes on{" "}
                    <span className="font-semibold">{new Date(pendingRequest.created_at).toLocaleDateString()}</span>. An
                    administrator will verify your food safety license and physical facility address. During this review
                    period, your existing verified address remains active for logistics.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPendingDiff(!showPendingDiff)}
                className="border-amber-400/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 shrink-0 text-xs font-semibold"
              >
                {showPendingDiff ? "Hide Submitted Changes" : "Review Submitted Changes"}
              </Button>
            </div>

            {/* EXPANDABLE PENDING DIFF */}
            {showPendingDiff && (
              <div className="mt-4 pt-4 border-t border-amber-300/30 text-xs space-y-2">
                <p className="font-bold text-amber-900 dark:text-amber-200">Requested Changes Awaiting Approval:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/60 dark:bg-black/40 p-3.5 rounded-xl border border-amber-200/50">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Proposed Facility Name:</span>
                    <span className="font-semibold text-foreground">
                      {pendingRequest.requested_changes.business_name || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Proposed License Number:</span>
                    <span className="font-semibold text-foreground">
                      {pendingRequest.requested_changes.license_number || "—"}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Proposed Address:</span>
                    <span className="font-semibold text-foreground">
                      {pendingRequest.requested_changes.address || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Proposed Phone:</span>
                    <span className="font-semibold text-foreground">
                      {pendingRequest.requested_changes.phone || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Proposed Operating Hours:</span>
                    <span className="font-semibold text-foreground">
                      {pendingRequest.requested_changes.operating_hours || "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STATUS BANNER 2: REJECTED FEEDBACK */}
      {lastRejectedRequest && !pendingRequest && (
        <Card className="border-red-400/50 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent shadow-sm">
          <CardContent className="p-5 flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 mt-0.5">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-red-800 dark:text-red-300">Previous Profile Update Declined</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-700 dark:text-red-300">
                  REJECTED
                </span>
              </div>
              <p className="text-xs text-red-700/90 dark:text-red-400/90 leading-relaxed">
                <span className="font-semibold">Admin Notes: </span>
                {lastRejectedRequest.admin_notes || "Profile details could not be verified. Please verify your license and address details."}
              </p>
              <p className="text-[11px] text-muted-foreground pt-1">
                Please correct the information in the form below and re-submit for verification.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ACTIVE VERIFIED PROFILE SUMMARY */}
      {activeProfile && (
        <Card className="border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Active Verified Logistics Information
                </CardTitle>
                <CardDescription className="text-xs">
                  This location is locked and verified. Distributor fleets navigate directly to this address.
                </CardDescription>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeProfile.address)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 text-xs font-semibold"
              >
                <MapPin className="h-3.5 w-3.5" /> Open in Google Maps <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-muted-foreground uppercase text-[10px] font-bold block mb-1">
                  {isProcessor ? "Facility Name" : "Store / Supermarket Name"}
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{activeProfile.business_name}</span>
                <div className="text-muted-foreground text-[11px] mt-1 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {activeProfile.phone}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-muted-foreground uppercase text-[10px] font-bold block mb-1">
                  Food Safety / Trade License
                </span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                  {activeProfile.license_number}
                </span>
                <div className="text-muted-foreground text-[11px] mt-1 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" /> Verified by {activeProfile.verified_by || "Admin"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-muted-foreground uppercase text-[10px] font-bold block mb-1">
                  Operating / Dock Hours
                </span>
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  {activeProfile.operating_hours}
                </span>
                <div className="text-muted-foreground text-[11px] mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {activeProfile.facility_type}
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-emerald-100 dark:border-emerald-900/40 flex items-start gap-2 text-xs">
              <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-bold block">
                  Active Delivery / Pickup Address
                </span>
                <span className="font-medium text-slate-900 dark:text-white leading-relaxed">
                  {activeProfile.address}
                </span>
                {activeProfile.coordinates && (
                  <span className="block text-[11px] font-mono text-muted-foreground mt-0.5">
                    GPS Coordinates: {activeProfile.coordinates.lat.toFixed(4)}, {activeProfile.coordinates.lng.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* EDIT PROFILE FORM */}
      <Card className="border-border/60 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Edit Facility & Store Details
              </CardTitle>
              <CardDescription>
                Submit updates to your business name, license, address, and dock operating hours.
              </CardDescription>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Admin Verification Required
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitForApproval} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Business Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Legal Facility / Business Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={isProcessor ? "e.g. Agro-Processing Unit #4" : "e.g. Metro Fresh Supermarket"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                  required
                />
                <span className="text-[11px] text-muted-foreground block">
                  This business name appears on delivery waybills and traceability certificates.
                </span>
              </div>

              {/* License Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Food Safety / FSSAI / Trade License Number *
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="e.g. FSSAI-11223344556677"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  required
                />
                <span className="text-[11px] text-muted-foreground block">
                  Subject to administrative validation against the Food Safety register.
                </span>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  Official Business Contact Phone *
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98450 12345"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  required
                />
                <span className="text-[11px] text-muted-foreground block">
                  Used by distributor drivers for gate access and handover coordination.
                </span>
              </div>

              {/* Facility Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Warehouse className="h-3.5 w-3.5 text-primary" />
                  Facility / Store Classification
                </label>
                <select
                  value={facilityType}
                  onChange={(e) => setFacilityType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {isProcessor ? (
                    <>
                      <option value="Chilled Cold-Storage & Agro-Processing Warehouse">Chilled Cold-Storage & Agro-Processing Warehouse</option>
                      <option value="Grain Milling & Secondary Processing Unit">Grain Milling & Secondary Processing Unit</option>
                      <option value="Precision Cold-Chain Packing House">Precision Cold-Chain Packing House</option>
                      <option value="Perishables Sorting & Value Addition Depot">Perishables Sorting & Value Addition Depot</option>
                    </>
                  ) : (
                    <>
                      <option value="Direct Retail Supermarket & Cold Dock">Direct Retail Supermarket & Cold Dock</option>
                      <option value="Hypermarket Commercial Receiving Bay">Hypermarket Commercial Receiving Bay</option>
                      <option value="Organic Specialty Grocer & Retail Shelf">Organic Specialty Grocer & Retail Shelf</option>
                      <option value="Neighborhood Fresh Produce Mart">Neighborhood Fresh Produce Mart</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Full Physical Address */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  Physical Facility / Store Address *
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDetectGps}
                  disabled={locating}
                  className="h-8 text-xs gap-1.5 rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                >
                  <Locate className={`h-3.5 w-3.5 ${locating ? "animate-spin" : ""}`} />
                  {locating ? "Detecting GPS..." : "Auto-Detect Current GPS Location"}
                </Button>
              </div>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Complete street address, industrial estate / building name, road, area, and city"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed"
                required
              />
              <span className="text-[11px] text-muted-foreground block">
                IMPORTANT: Distributor vehicles will be navigated directly to this street address for cargo pickup and unloading.
              </span>
            </div>

            {/* City, State, Pin Code & GPS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">City / District</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">PIN Code</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">GPS Coordinates</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                    placeholder="Lat"
                    title="Latitude"
                    className="w-1/2 px-2.5 py-2 rounded-xl border border-input bg-background text-xs font-mono"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                    placeholder="Lng"
                    title="Longitude"
                    className="w-1/2 px-2.5 py-2 rounded-xl border border-input bg-background text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Operating Hours & Contact Person */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Operating & Dock Receiving Hours
                </label>
                <input
                  type="text"
                  value={operatingHours}
                  onChange={(e) => setOperatingHours(e.target.value)}
                  placeholder="e.g. 06:00 AM - 10:00 PM (Daily)"
                  className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  Operations Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Facility Manager Name"
                  className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Storage / Dock Capacity
                </label>
                <input
                  type="text"
                  value={storageCapacity}
                  onChange={(e) => setStorageCapacity(e.target.value)}
                  placeholder="e.g. 500 Metric Tons Chilled"
                  className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-sm"
                />
              </div>
            </div>

            {/* COMPLIANCE NOTICE */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-border/80 flex items-start gap-3 text-xs text-muted-foreground leading-relaxed">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground block mb-0.5">Admin Verification Policy:</span>
                Changes made here do not take effect instantly. Once submitted, FarmChain administrators verify your
                FSSAI / trade license validity and address geolocation before activating the changes. Once approved, the
                new verified location will automatically update in distributor route manifests.
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={submitting}
                className="w-full sm:w-auto rounded-xl gap-2 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Discard / Reset to Active
              </Button>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto rounded-xl gap-2 font-bold bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-6 shadow-md"
              >
                {submitting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Submitting for Verification...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Submit Profile for Admin Verification & Approval
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
