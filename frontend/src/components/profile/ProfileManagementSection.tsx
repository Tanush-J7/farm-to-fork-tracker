import React, { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import {
  ShieldCheck,
  Building2,
  MapPin,
  Phone,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock3,
  ExternalLink,
  Save,
  RotateCcw,
  Info,
  Warehouse,
  Store,
  Truck,
  UserCheck,
  Leaf,
  CalendarDays
} from "lucide-react"
import { Button } from "../ui/Button"
import { LocationPickerMap } from "./LocationPickerMap"

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
  driver_name?: string
  driver_license_number?: string
  driver_phone?: string
  driver_license_class?: string
  driver_license_expiry?: string
  driver_license_authority?: string
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

  // Driver Details (Distributor)
  const [driverName, setDriverName] = useState("")
  const [driverLicenseNumber, setDriverLicenseNumber] = useState("")
  const [driverPhone, setDriverPhone] = useState("")
  const [driverLicenseClass, setDriverLicenseClass] = useState("Commercial Heavy Goods Vehicle (HGV / LMV-TR)")
  const [driverLicenseExpiry, setDriverLicenseExpiry] = useState("2032-11-20")
  const [driverLicenseAuthority, setDriverLicenseAuthority] = useState("KA-04 RTO Yeshwanthpur, Bengaluru")

  const [submitting, setSubmitting] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [showPendingDiff, setShowPendingDiff] = useState(false)

  const isProcessor = role === "processor"
  const isRetailer = role === "retailer"
  const isDistributor = role === "distributor"
  const isFarmer = role === "farmer"

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
          setFacilityType(
            active_profile.facility_type ||
              (isDistributor
                ? "Refrigerated Fleet Depot & Transit Logistics Hub"
                : isRetailer
                ? "Direct Retail Supermarket"
                : isFarmer
                ? "Certified Organic Farm & Harvest Logistics Base"
                : "Warehouse Storage Depot")
          )
          setOperatingHours(
            active_profile.operating_hours ||
              (isDistributor
                ? "24/7 Logistics Operation"
                : isFarmer
                ? "06:00 AM - 06:00 PM (Harvest Hours)"
                : "06:00 AM - 10:00 PM")
          )
          setContactPerson(active_profile.contact_person_name || user?.name || "")
          setContactEmail(active_profile.contact_email || user?.email || "")
          setStorageCapacity(
            active_profile.storage_capacity ||
              (isDistributor
                ? "20 Commercial Trucks & 400 MT Storage Bay"
                : isRetailer
                ? "120 Metric Tons Retail Shelf"
                : isFarmer
                ? "50 Metric Tons Farm Storage Shed & Silo"
                : "500 Metric Tons Chilled")
          )
          if (active_profile.coordinates) {
            setLat(active_profile.coordinates.lat || 13.0285)
            setLng(active_profile.coordinates.lng || 77.5456)
          }

          if (isDistributor) {
            setDriverName(active_profile.driver_name || "Ramesh Kumar (Assigned Fleet Driver)")
            setDriverLicenseNumber(active_profile.driver_license_number || "DL-0420220194821")
            setDriverPhone(active_profile.driver_phone || "+91 98765 43210")
            setDriverLicenseClass(active_profile.driver_license_class || "Commercial Heavy Goods Vehicle (HGV / LMV-TR)")
            setDriverLicenseExpiry(active_profile.driver_license_expiry || "2032-11-20")
            setDriverLicenseAuthority(active_profile.driver_license_authority || "KA-04 RTO Yeshwanthpur, Bengaluru")
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

  const handleLocationChangeFromMap = (loc: {
    lat: number
    lng: number
    address: string
    city?: string
    state?: string
    pincode?: string
    accuracy?: number
  }) => {
    setLat(loc.lat)
    setLng(loc.lng)
    setAddress(loc.address)
    if (loc.city) setCity(loc.city)
    if (loc.state) setState(loc.state)
    if (loc.pincode) setPincode(loc.pincode)

    setFeedbackMsg({
      type: "success",
      text: `Precise location pinned at (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}). Address updated.`
    })
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
      if (isDistributor) {
        setDriverName(activeProfile.driver_name || "Ramesh Kumar (Assigned Fleet Driver)")
        setDriverLicenseNumber(activeProfile.driver_license_number || "DL-0420220194821")
        setDriverPhone(activeProfile.driver_phone || "+91 98765 43210")
        setDriverLicenseClass(activeProfile.driver_license_class || "Commercial Heavy Goods Vehicle (HGV / LMV-TR)")
        setDriverLicenseExpiry(activeProfile.driver_license_expiry || "2032-11-20")
        setDriverLicenseAuthority(activeProfile.driver_license_authority || "KA-04 RTO Yeshwanthpur, Bengaluru")
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

    if (isDistributor && !driverLicenseNumber.trim()) {
      setFeedbackMsg({
        type: "error",
        text: "Driver's Driving License (DL) Number is required for transport fleet compliance."
      })
      return
    }

    setSubmitting(true)
    setFeedbackMsg(null)

    try {
      const payload: any = {
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

      if (isDistributor) {
        payload.driver_name = driverName.trim()
        payload.driver_license_number = driverLicenseNumber.trim()
        payload.driver_phone = driverPhone.trim()
        payload.driver_license_class = driverLicenseClass.trim()
        payload.driver_license_expiry = driverLicenseExpiry.trim()
        payload.driver_license_authority = driverLicenseAuthority.trim()
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
      <div className="p-12 text-center space-y-4 bg-white rounded-3xl border border-emerald-100 shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto" />
        <p className="text-sm text-emerald-950 font-medium">Loading verified profile and compliance records...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title & Introduction */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isDistributor ? (
              <Truck className="h-6 w-6 text-emerald-600" />
            ) : isProcessor ? (
              <Warehouse className="h-6 w-6 text-emerald-600" />
            ) : isFarmer ? (
              <Leaf className="h-6 w-6 text-emerald-600" />
            ) : (
              <Store className="h-6 w-6 text-emerald-600" />
            )}
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {isDistributor
                ? "Distributor Fleet Depot & Logistics Profile"
                : isProcessor
                ? "Processor Facility Profile & Logistics Hub"
                : isFarmer
                ? "Farm Profile & Agricultural Compliance"
                : "Retailer Store Profile & Receiving Dock"}
            </h2>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {isDistributor
              ? "Manage your transport logistics license, fleet dispatch base, and contact details. This verified location defines your operating depot and dispatch center."
              : isFarmer
              ? "Manage your registered farm entity, agricultural/organic certification or Kisan ID, physical location, and contact details. This verified location is used for crop pickup and logistics routes."
              : isRetailer
              ? "Manage your retail store, trade license, and physical location for distributor drop-offs."
              : "Manage your legal entity, FSSAI / trade license, and physical location. This verified location is strictly used for distributor delivery routes."}
          </p>
        </div>

        {activeProfile?.is_verified && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold shrink-0 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Admin Verified Facility</span>
          </div>
        )}
      </div>

      {/* FEEDBACK ALERT */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm animate-in fade-in shadow-sm ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : feedbackMsg.type === "error"
              ? "bg-red-50 border-red-200 text-red-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
          ) : feedbackMsg.type === "error" ? (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          ) : (
            <Info className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
          )}
          <div className="flex-1 font-semibold">{feedbackMsg.text}</div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* STATUS BANNER 1: PENDING ADMIN APPROVAL */}
      {pendingRequest && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-sm text-amber-950">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-200/80 text-amber-800 mt-0.5">
                <Clock3 className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-amber-950 text-base">
                    Profile Updates Pending Admin Verification
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                    PENDING REVIEW
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-1 max-w-2xl leading-relaxed">
                  You submitted profile changes on{" "}
                  <span className="font-bold">{new Date(pendingRequest.created_at).toLocaleDateString()}</span>. An
                  administrator will verify your food safety license and physical facility address. During this review
                  period, your existing verified address remains active for logistics.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPendingDiff(!showPendingDiff)}
              className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 shrink-0 text-xs font-bold"
            >
              {showPendingDiff ? "Hide Submitted Changes" : "Review Submitted Changes"}
            </Button>
          </div>

          {/* EXPANDABLE PENDING DIFF */}
          {showPendingDiff && (
            <div className="mt-4 pt-4 border-t border-amber-200 text-xs space-y-2">
              <p className="font-bold text-amber-950">Requested Changes Awaiting Approval:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-amber-200">
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Proposed Facility Name:</span>
                  <span className="font-bold text-slate-900">
                    {pendingRequest.requested_changes.business_name || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Proposed License Number:</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {pendingRequest.requested_changes.license_number || "—"}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-slate-500 block text-[11px] font-medium">Proposed Address:</span>
                  <span className="font-semibold text-slate-900">
                    {pendingRequest.requested_changes.address || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Proposed Phone:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {pendingRequest.requested_changes.phone || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Proposed Operating Hours:</span>
                  <span className="font-semibold text-slate-900">
                    {pendingRequest.requested_changes.operating_hours || "—"}
                  </span>
                </div>
                {isDistributor && pendingRequest.requested_changes.driver_license_number && (
                  <div className="md:col-span-2 pt-2 border-t border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500 block text-[11px] font-medium">Proposed Driver:</span>
                      <span className="font-bold text-slate-900">{pendingRequest.requested_changes.driver_name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px] font-medium">Proposed Driver DL No:</span>
                      <span className="font-bold text-emerald-800 font-mono">{pendingRequest.requested_changes.driver_license_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px] font-medium">Proposed DL Class:</span>
                      <span className="font-medium text-slate-800 truncate block">{pendingRequest.requested_changes.driver_license_class || "—"}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATUS BANNER 2: REJECTED FEEDBACK */}
      {lastRejectedRequest && !pendingRequest && (
        <div className="rounded-2xl border border-red-300 bg-red-50/80 p-5 shadow-sm text-red-950 flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-red-200 text-red-800 mt-0.5">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-red-950 text-base">Previous Profile Update Declined</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-200 text-red-900 border border-red-300">
                REJECTED
              </span>
            </div>
            <p className="text-xs text-red-900 leading-relaxed">
              <span className="font-bold">Admin Notes: </span>
              {lastRejectedRequest.admin_notes || "Profile details could not be verified. Please verify your license and address details."}
            </p>
            <p className="text-[11px] text-red-800 pt-1">
              Please correct the information in the form below and re-submit for verification.
            </p>
          </div>
        </div>
      )}

      {/* ACTIVE VERIFIED PROFILE SUMMARY (CRISP, HIGH-CONTRAST WHITE / EMERALD) */}
      {activeProfile && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-emerald-100 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Active Verified Logistics Information
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                This location is locked and verified. Distributor fleets navigate directly to this address.
              </p>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeProfile.address)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold shrink-0 transition-colors"
            >
              <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Open in Google Maps <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <span className="text-slate-500 uppercase text-[10px] font-bold block mb-1">
                {isDistributor ? "Distributor Entity / Fleet Hub" : isProcessor ? "Facility Name" : "Store / Supermarket Name"}
              </span>
              <span className="font-bold text-slate-900 text-sm block">{activeProfile.business_name}</span>
              <div className="text-slate-600 text-[11px] mt-1.5 flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-emerald-600" /> {activeProfile.phone}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <span className="text-slate-500 uppercase text-[10px] font-bold block mb-1">
                {isDistributor ? "Transport / Carrier License" : "Food Safety / Trade License"}
              </span>
              <span className="font-mono font-bold text-emerald-800 text-sm block">
                {activeProfile.license_number}
              </span>
              <div className="text-slate-600 text-[11px] mt-1.5 flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> Verified by {activeProfile.verified_by || "Admin"}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <span className="text-slate-500 uppercase text-[10px] font-bold block mb-1">
                Operating / Dock Hours
              </span>
              <span className="font-bold text-slate-900 text-sm block">
                {activeProfile.operating_hours}
              </span>
              <div className="text-slate-600 text-[11px] mt-1.5 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-emerald-600" /> {activeProfile.facility_type}
              </div>
            </div>
          </div>

          {/* DRIVER DRIVING LICENSE DETAILS SUMMARY CARD (DISTRIBUTOR ONLY) */}
          {isDistributor && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-white border-2 border-emerald-500/30 text-xs space-y-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                      Assigned Fleet Driver & Driving License (DL) Records
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {activeProfile.driver_name || "Ramesh Kumar (Assigned Fleet Driver)"}
                    </span>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-[11px] self-start sm:self-auto shadow-2xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Verified Motor Vehicle Driving License</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Driving License No.</span>
                  <span className="font-mono font-bold text-emerald-800 text-xs block mt-0.5">
                    {activeProfile.driver_license_number || "DL-0420220194821"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">DL Vehicle Class</span>
                  <span className="font-semibold text-slate-800 text-xs block mt-0.5 truncate" title={activeProfile.driver_license_class || "Commercial Heavy Goods Vehicle (HGV/LMV-TR)"}>
                    {activeProfile.driver_license_class || "Commercial Heavy Goods Vehicle (HGV/LMV-TR)"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">DL Expiry Date</span>
                  <span className="font-bold text-slate-800 text-xs block mt-0.5 flex items-center gap-1">
                    <CalendarDays className="h-3 w-3 text-emerald-600" />
                    {activeProfile.driver_license_expiry || "2032-11-20"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Driver Mobile Line</span>
                  <span className="font-mono font-semibold text-slate-800 text-xs block mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3 text-emerald-600" />
                    {activeProfile.driver_phone || "+91 98765 43210"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-start gap-2.5 text-xs">
            <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-emerald-950 uppercase text-[10px] font-bold block">
                Active Delivery / Pickup Address (Source of Truth for Logistics)
              </span>
              <p className="font-semibold text-slate-900 text-xs leading-relaxed">
                {activeProfile.address}
              </p>
              {activeProfile.coordinates && (
                <span className="block text-[11px] font-mono text-emerald-800 font-semibold pt-0.5">
                  GPS Coordinates: {activeProfile.coordinates.lat.toFixed(6)}, {activeProfile.coordinates.lng.toFixed(6)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE FORM */}
      <div className="bg-white rounded-3xl border border-emerald-200 shadow-md p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-emerald-100 gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              {isDistributor
                ? "Edit Distributor Fleet & Depot Details"
                : isFarmer
                ? "Edit Farm & Harvest Logistics Details"
                : isProcessor
                ? "Edit Facility Details"
                : "Edit Store Details"}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Submit updates to your business name, license, address, and dock operating hours.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shrink-0 self-start sm:self-auto">
            Admin Verification Required
          </span>
        </div>

        <form onSubmit={handleSubmitForApproval} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Business Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                {isDistributor
                  ? "Distributor Entity / Fleet Base Name *"
                  : isFarmer
                  ? "Farm Name / Registered Agricultural Entity *"
                  : isProcessor
                  ? "Legal Facility / Business Name *"
                  : "Legal Store / Business Name *"}
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={
                  isDistributor
                    ? "e.g. Karnataka Freight Logistics & Dispatch Depot"
                    : isFarmer
                    ? "e.g. Green Valley Organic Farms"
                    : isProcessor
                    ? "e.g. Agro-Processing Unit #4"
                    : "e.g. Metro Fresh Supermarket"
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-semibold"
                required
              />
              <span className="text-[11px] text-slate-500 block">
                This business name appears on delivery waybills and traceability certificates.
              </span>
            </div>

            {/* License Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-emerald-600" />
                {isDistributor
                  ? "Transport Fleet / Carrier License (MVA/FSSAI) *"
                  : isFarmer
                  ? "Agricultural Reg / Organic Cert / Kisan ID / FSSAI *"
                  : "Food Safety / FSSAI / Trade License Number *"}
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder={
                  isDistributor
                    ? "e.g. MVA-KA-LOG-98214"
                    : isFarmer
                    ? "e.g. ORG-IND-2026-98124 or KISAN-KA-8491"
                    : "e.g. FSSAI-11223344556677"
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono font-bold"
                required
              />
              <span className="text-[11px] text-slate-500 block">
                Subject to administrative validation against the Food Safety & Transport register.
              </span>
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                Official Business Contact Phone *
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98450 12345"
                className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono font-semibold"
                required
              />
              <span className="text-[11px] text-slate-500 block">
                {isDistributor
                  ? "Used by dispatchers, processors, and retailers for route and delivery coordination."
                  : isFarmer
                  ? "Used by procurement managers and logistics carriers for farm pickup and coordination."
                  : "Used by distributor drivers for gate access and handover coordination."}
              </span>
            </div>

            {/* Facility Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Warehouse className="h-3.5 w-3.5 text-emerald-600" />
                {isDistributor ? "Fleet & Logistics Classification" : isFarmer ? "Farm & Produce Classification" : "Facility / Store Classification"}
              </label>
              <select
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-medium"
              >
                {isDistributor ? (
                  <>
                    <option value="Refrigerated Fleet Depot & Transit Logistics Hub">Refrigerated Fleet Depot & Transit Logistics Hub</option>
                    <option value="Interstate Multi-Temperature Reefer Fleet">Interstate Multi-Temperature Reefer Fleet</option>
                    <option value="Last-Mile Retail Fast-Fulfillment Center">Last-Mile Retail Fast-Fulfillment Center</option>
                    <option value="Agricultural Freight Logistics Depot">Agricultural Freight Logistics Depot</option>
                  </>
                ) : isProcessor ? (
                  <>
                    <option value="Produce Storage & Agro-Processing Warehouse">Produce Storage & Agro-Processing Warehouse</option>
                    <option value="Grain Milling & Secondary Processing Unit">Grain Milling & Secondary Processing Unit</option>
                    <option value="Precision Produce Packing House">Precision Produce Packing House</option>
                    <option value="Perishables Sorting & Value Addition Depot">Perishables Sorting & Value Addition Depot</option>
                  </>
                ) : isFarmer ? (
                  <>
                    <option value="Certified Organic Farm & Harvest Logistics Base">Certified Organic Farm & Harvest Logistics Base</option>
                    <option value="Horticulture & Vegetable Polyhouse Cultivation">Horticulture & Vegetable Polyhouse Cultivation</option>
                    <option value="Grain & Pulses Farmland with Chilled Silo">Grain & Pulses Farmland with Chilled Silo</option>
                    <option value="Hydroponic & Controlled Agriculture Farm">Hydroponic & Controlled Agriculture Farm</option>
                    <option value="Dairy & Livestock Farm Facility">Dairy & Livestock Farm Facility</option>
                  </>
                ) : (
                  <>
                    <option value="Direct Retail Supermarket & Receiving Dock">Direct Retail Supermarket & Receiving Dock</option>
                    <option value="Hypermarket Commercial Receiving Bay">Hypermarket Commercial Receiving Bay</option>
                    <option value="Organic Specialty Grocer & Retail Shelf">Organic Specialty Grocer & Retail Shelf</option>
                    <option value="Neighborhood Fresh Produce Mart">Neighborhood Fresh Produce Mart</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* DEDICATED DRIVER DRIVING LICENSE SECTION (DISTRIBUTOR ONLY) */}
          {isDistributor && (
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/40 border-2 border-emerald-500/30 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-xs">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                      <span>Assigned Driver & Commercial Driving License (DL) Records</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Motor Vehicles Act Compliance
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Enter the commercial driving license details of the certified driver operating this transit fleet.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Driver Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Driver Full Name *
                  </label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-semibold"
                    required={isDistributor}
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Certified commercial driver operating the fleet vehicle.
                  </span>
                </div>

                {/* Driver Driving License Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-emerald-600" />
                    Driver's Driving License (DL) Number *
                  </label>
                  <input
                    type="text"
                    value={driverLicenseNumber}
                    onChange={(e) => setDriverLicenseNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. DL-0420220194821 or KA-04-2019-0084920"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono font-bold"
                    required={isDistributor}
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Official RTO Driving License number from the smart card.
                  </span>
                </div>

                {/* Driver Contact Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    Driver Contact Mobile *
                  </label>
                  <input
                    type="text"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono font-semibold"
                    required={isDistributor}
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Direct phone line for real-time pickup & gate coordination.
                  </span>
                </div>

                {/* License Class */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-emerald-600" />
                    Driving License Vehicle Class *
                  </label>
                  <select
                    value={driverLicenseClass}
                    onChange={(e) => setDriverLicenseClass(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-medium"
                  >
                    <option value="Commercial Heavy Goods Vehicle (HGV / LMV-TR)">Commercial Heavy Goods Vehicle (HGV / LMV-TR)</option>
                    <option value="Medium Goods Vehicle (MGV / Multi-Axle Reefer)">Medium Goods Vehicle (MGV / Multi-Axle Reefer)</option>
                    <option value="Light Motor Vehicle - Commercial Transport (LMV-TR)">Light Motor Vehicle - Commercial Transport (LMV-TR)</option>
                    <option value="Hazardous / Chilled Agricultural Freight Carrier Class">Hazardous / Chilled Agricultural Freight Carrier Class</option>
                  </select>
                  <span className="text-[11px] text-slate-500 block">
                    RTO transport category endorsement on the driver's license.
                  </span>
                </div>

                {/* DL Expiry Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                    Driving License Expiry Date *
                  </label>
                  <input
                    type="date"
                    value={driverLicenseExpiry}
                    onChange={(e) => setDriverLicenseExpiry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-medium"
                    required={isDistributor}
                  />
                  <span className="text-[11px] text-slate-500 block">
                    License must remain active and valid during logistics transit.
                  </span>
                </div>

                {/* Issuing RTO / Transport Authority */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Issuing RTO Authority
                  </label>
                  <input
                    type="text"
                    value={driverLicenseAuthority}
                    onChange={(e) => setDriverLicenseAuthority(e.target.value)}
                    placeholder="e.g. KA-04 RTO Yeshwanthpur, Bengaluru"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-medium"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Regional Transport Office (RTO) jurisdiction.
                  </span>
                </div>
              </div>

              {/* RTO VERIFIED DRIVER BADGE PREVIEW */}
              <div className="pt-2">
                <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                      DL
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {driverName || "Driver Name Pending"}
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md">
                          {driverLicenseNumber || "DL NUMBER REQUIRED"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {driverLicenseClass} &bull; Valid Thru: {driverLicenseExpiry || "N/A"} &bull; {driverLicenseAuthority || "RTO Registered"}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 self-start sm:self-auto">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Motor Vehicles Act Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INTERACTIVE HIGH-ACCURACY MAP & PIN PICKER */}
          <div className="space-y-3 pt-4 border-t border-emerald-100">
            <div>
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Exact Facility Doorstep / Gate Geolocation (Interactive Map) *
              </label>
              <p className="text-xs text-slate-600 mt-0.5">
                Click <strong>"Detect My Exact GPS"</strong> or drag the green marker on the map to pinpoint your exact facility gate or store entrance.
              </p>
            </div>

            {/* Interactive Leaflet Map with Search and Drag-to-Pinpoint */}
            <LocationPickerMap
              lat={lat}
              lng={lng}
              onLocationChange={handleLocationChangeFromMap}
            />
          </div>

          {/* Full Physical Address Textarea */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              Full Street Address (Auto-filled from map or manually editable) *
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="Building name / unit number, street, industrial area, road, and city"
              className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 leading-relaxed font-medium"
              required
            />
            <span className="text-[11px] text-slate-500 block">
              {isDistributor
                ? "Your primary logistics headquarters, fleet maintenance depot, and dispatch hub address."
                : "Distributor vehicles will be navigated directly to this street address for cargo pickup and delivery."}
            </span>
          </div>

          {/* City, State, Pin Code & GPS numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">City / District</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">PIN Code</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">GPS Coordinates</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  placeholder="Lat"
                  title="Latitude"
                  className="w-1/2 px-2.5 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 text-xs font-mono font-semibold"
                />
                <input
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                  placeholder="Lng"
                  title="Longitude"
                  className="w-1/2 px-2.5 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 text-xs font-mono font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Operating Hours & Contact Person */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-emerald-100">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                {isFarmer ? "Farm Gate & Harvest Operating Hours" : "Operating & Dock Receiving Hours"}
              </label>
              <input
                type="text"
                value={operatingHours}
                onChange={(e) => setOperatingHours(e.target.value)}
                placeholder={isFarmer ? "e.g. 06:00 AM - 06:00 PM (Daily)" : "e.g. 06:00 AM - 10:00 PM (Daily)"}
                className="w-full px-3.5 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                {isFarmer ? "Lead Farmer / Estate Contact" : "Operations Contact Person"}
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder={isFarmer ? "e.g. Farm Owner / Manager" : "e.g. Facility Manager Name"}
                className="w-full px-3.5 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                {isDistributor
                  ? "Fleet Capacity & Active Vehicles"
                  : isFarmer
                  ? "Farm Storage / Harvest Yield Capacity"
                  : isRetailer
                  ? "Store Shelf & Receiving Capacity"
                  : "Storage / Dock Capacity"}
              </label>
              <input
                type="text"
                value={storageCapacity}
                onChange={(e) => setStorageCapacity(e.target.value)}
                placeholder={
                  isDistributor
                    ? "e.g. 20 Reefer Trucks (10T each), 400 MT Storage Bay"
                    : isFarmer
                    ? "e.g. 50 Metric Tons Farm Storage Shed & Silo"
                    : isRetailer
                    ? "e.g. 120 Metric Tons Retail Shelf"
                    : "e.g. 500 Metric Tons Chilled"
                }
                className="w-full px-3.5 py-2 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm font-medium"
              />
            </div>
          </div>

          {/* COMPLIANCE NOTICE (CRISP, READABLE GREEN BOX) */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-950 leading-relaxed shadow-sm">
            <Info className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-emerald-950 block mb-0.5 text-xs">Admin Verification Policy:</span>
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
              className="w-full sm:w-auto rounded-xl gap-2 text-xs font-bold border-emerald-200 text-slate-700 hover:bg-emerald-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Discard / Reset to Active
            </Button>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-6 shadow-md"
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
      </div>
    </div>
  )
}
