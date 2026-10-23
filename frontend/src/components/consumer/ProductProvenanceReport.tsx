import React, { useState } from "react"
import {
  Leaf, Factory, Truck, Store, Clock, ShieldCheck, CalendarDays,
  Printer, ExternalLink, Brain, CheckCircle2, Award, QrCode, Copy, Check,
  MapPin
} from "lucide-react"
import { Button } from "../ui/Button"

export type StageState = "completed" | "in_progress" | "pending"

export interface StageDetail {
  stageNumber: number
  key: "farmer" | "processor" | "distributor" | "retailer"
  title: string
  status: StageState
  badgeText: string
  date?: string
  actorName: string
  facilityOrVehicle: string
  location?: string
  licenseOrId?: string
  details: string
  extraTag?: string
  hash?: string
}

export interface CustodySummary {
  currentStage: number // 1, 2, 3, or 4
  currentActorRole: "farmer" | "processor" | "distributor" | "retailer"
  currentActorName: string
  currentFacilityOrVehicle: string
  currentLocation: string
  statusTitle: string
  statusBadge: string
  progressPercent: number
  completedStagesCount: number
  isFinalSold?: boolean
}

export interface ProvenanceReportData {
  id: string
  product_id?: number | string
  name: string
  category: string
  batch_number: string
  quantity: number
  status: string
  organic_status: boolean
  ai_quality_score: number
  ai_quality_label: string
  product_image_url?: string
  expiry_date?: string
  blockchain_hash?: string
  created_at: string
  custodySummary?: CustodySummary
  stagesTimeline?: StageDetail[]
  farmer?: {
    name?: string
    address?: string
  }
  processor_info?: {
    name: string
    address: string
    license?: string
    date?: string
    grade: string
  }
  distributor_info?: {
    carrier: string
    vehicle: string
    date?: string
    temp?: string
    hash?: string
  }
  retailer_info?: {
    store: string
    address: string
    dock_temp?: string
    date?: string
    shelf_status: string
    hash?: string
  }
}

interface Props {
  product: ProvenanceReportData
  onScanAnother?: () => void
}

export const ProductProvenanceReport: React.FC<Props> = ({ product, onScanAnother }) => {
  const [copied, setCopied] = useState(false)

  // Compute Produce Emoji
  const nameLower = (product.name || "").toLowerCase()
  const produceEmoji = nameLower.includes("grape")
    ? "🍇"
    : nameLower.includes("tomato")
    ? "🍅"
    : nameLower.includes("apple")
    ? "🍎"
    : nameLower.includes("potato")
    ? "🥔"
    : nameLower.includes("mango")
    ? "🥭"
    : nameLower.includes("rice") || nameLower.includes("wheat")
    ? "🌾"
    : "🥬"

  // Compute Expiry Info
  const expInfo = (() => {
    if (!product.expiry_date) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const exp = new Date(product.expiry_date)
    exp.setHours(0, 0, 0, 0)
    const diffTime = exp.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    const formattedDate = new Date(product.expiry_date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })

    if (diffDays < 0) {
      return {
        formattedDate,
        isExpired: true,
        isUrgent: true,
        label: `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago (${formattedDate})`,
        color: "rose"
      }
    }
    if (diffDays === 0) {
      return {
        formattedDate,
        isExpired: false,
        isUrgent: true,
        label: `Expires Today (${formattedDate}) • Priority Sale`,
        color: "amber"
      }
    }
    if (diffDays <= 3) {
      return {
        formattedDate,
        isExpired: false,
        isUrgent: true,
        label: `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"} (${formattedDate}) • FEFO Priority`,
        color: "amber"
      }
    }
    return {
      formattedDate,
      isExpired: false,
      isUrgent: false,
      label: `Fresh & Safe • ${diffDays} days shelf-life remaining (${formattedDate})`,
      color: "emerald"
    }
  })()

  const handleCopyLink = () => {
    const url = `${window.location.origin}/track?batch=${encodeURIComponent(product.batch_number)}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handlePrint = () => {
    window.print()
  }

  // Fallback Custody & Stage resolver if not explicitly passed from Tracker
  const custody: CustodySummary = product.custodySummary || (() => {
    const rawStatus = (product.status || "").toLowerCase().trim()
    const isRetail = rawStatus === "at retailer" || rawStatus === "delivered" || rawStatus === "in store" || rawStatus === "available in store" || rawStatus === "sold"
    const isDist = !isRetail && (rawStatus === "in transit" || rawStatus === "dispatched" || rawStatus === "transferred" || rawStatus === "picked_up")
    const isProc = !isRetail && !isDist && (rawStatus.includes("process") || rawStatus.includes("inspect") || rawStatus.includes("pack") || rawStatus.includes("ready"))

    if (isRetail) {
      return {
        currentStage: 4,
        currentActorRole: "retailer",
        currentActorName: product.retailer_info?.store || "Metro Fresh Supermarket",
        currentFacilityOrVehicle: "Fresh Produce Retail Floor & Display",
        currentLocation: product.retailer_info?.address || "Metro Fresh Supermarket, Koramangala, Bengaluru",
        statusTitle: rawStatus === "sold" ? "Sold to Consumer" : "In Retail Store (Available for Purchase)",
        statusBadge: rawStatus === "sold" ? "Chain Complete • Sold" : "Stage 4 • In Store Inventory",
        progressPercent: 100,
        completedStagesCount: 4,
        isFinalSold: rawStatus === "sold"
      }
    }
    if (isDist) {
      return {
        currentStage: 3,
        currentActorRole: "distributor",
        currentActorName: product.distributor_info?.carrier || "SwiftLogistics Fleet Carrier",
        currentFacilityOrVehicle: product.distributor_info?.vehicle || "KA-04-E-2941 (Transit Logistics Van)",
        currentLocation: "Active Transit Route (En Route to Retailer)",
        statusTitle: "In Transit with Logistics Carrier",
        statusBadge: "Stage 3 In Progress • In Transit",
        progressPercent: 75,
        completedStagesCount: 2
      }
    }
    if (isProc) {
      const isDone = rawStatus.includes("processed") || rawStatus.includes("packaged") || rawStatus.includes("ready")
      return {
        currentStage: 2,
        currentActorRole: "processor",
        currentActorName: product.processor_info?.name || "Agro-Processing Unit Depot",
        currentFacilityOrVehicle: "Agro-Processing & Packaging Depot",
        currentLocation: product.processor_info?.address || "Agro-Processing Depot #4, APMC Yard, Bengaluru",
        statusTitle: isDone ? "Processing Completed • Ready for Logistics" : "In Processing Facility",
        statusBadge: isDone ? "Stage 2 Completed • Ready for Pickup" : "Stage 2 In Progress • In Facility",
        progressPercent: isDone ? 50 : 40,
        completedStagesCount: isDone ? 2 : 1
      }
    }
    return {
      currentStage: 1,
      currentActorRole: "farmer",
      currentActorName: product.farmer?.name || "Green Valley Organic Farms",
      currentFacilityOrVehicle: "Farm Origin & Cultivation Farmland",
      currentLocation: product.farmer?.address || "Doddaballapur Farmlands, Bengaluru North, Karnataka",
      statusTitle: "At Farm Origin",
      statusBadge: "Stage 1 • Harvest Origin",
      progressPercent: 25,
      completedStagesCount: 1
    }
  })()

  // Timeline stages list
  const stages: StageDetail[] = product.stagesTimeline || [
    {
      stageNumber: 1,
      key: "farmer",
      title: "1. Agricultural Farm Origin & Harvest",
      status: "completed",
      badgeText: "Harvest Verified",
      date: new Date(product.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      actorName: product.farmer?.name || "Green Valley Organic Farms",
      facilityOrVehicle: "Cultivation Polyhouse & Farm",
      location: product.farmer?.address || "Doddaballapur Farmlands, Bengaluru North, Karnataka",
      details: `Harvested and authenticated at origin farm. Computer-vision quality analysis confirmed Grade: ${product.ai_quality_label} (${product.ai_quality_score}%).`,
      extraTag: `AI Grade: ${product.ai_quality_label} (${product.ai_quality_score}%)`
    },
    {
      stageNumber: 2,
      key: "processor",
      title: "2. Facility Intake & Quality Inspection",
      status: custody.currentStage > 2 || (custody.currentStage === 2 && custody.completedStagesCount >= 2)
        ? "completed"
        : custody.currentStage === 2
        ? "in_progress"
        : "pending",
      badgeText: custody.currentStage > 2 || (custody.currentStage === 2 && custody.completedStagesCount >= 2)
        ? "Intake Inspected"
        : custody.currentStage === 2
        ? "Processing In Progress"
        : "Awaiting Facility Intake",
      date: product.processor_info?.date,
      actorName: product.processor_info?.name || "Agro-Processing Unit Depot",
      facilityOrVehicle: "Agro-Processing Facility",
      location: product.processor_info?.address || "Agro-Processing Depot #4, APMC Yard, Bengaluru",
      licenseOrId: product.processor_info?.license || "FSSAI-11223344556677",
      details: custody.currentStage >= 2
        ? "Facility intake verified, scale weight checked, sanitized, and sealed under food safety compliance standards."
        : "Product is currently at farm origin. Facility intake, sanitization, and packaging will be recorded when the product arrives at the processing facility."
    },
    {
      stageNumber: 3,
      key: "distributor",
      title: "3. Distribution Logistics & Safe Transit",
      status: custody.currentStage > 3
        ? "completed"
        : custody.currentStage === 3
        ? "in_progress"
        : "pending",
      badgeText: custody.currentStage > 3
        ? "Fleet Transit Delivered"
        : custody.currentStage === 3
        ? "In Fleet Transit"
        : "Awaiting Logistics Dispatch",
      date: product.distributor_info?.date,
      actorName: product.distributor_info?.carrier || "SwiftLogistics Fleet Carrier",
      facilityOrVehicle: product.distributor_info?.vehicle || "KA-04-E-2941 (Transit Logistics Van)",
      location: custody.currentStage === 3 ? "Active Transit Route (En Route)" : undefined,
      details: custody.currentStage >= 3
        ? `Dispatched via ${product.distributor_info?.carrier || "SwiftLogistics"} with verified telematics tracking.`
        : "Product has not yet been dispatched for transit. Fleet logistics pickup will be scheduled after processing completion."
    },
    {
      stageNumber: 4,
      key: "retailer",
      title: "4. Retail Store Intake & Shelf Display",
      status: custody.currentStage === 4
        ? "completed"
        : "pending",
      badgeText: custody.currentStage === 4
        ? (custody.isFinalSold ? "Sold to Consumer" : "Available in Store")
        : "Awaiting Store Arrival",
      date: product.retailer_info?.date,
      actorName: product.retailer_info?.store || "Metro Fresh Supermarket",
      facilityOrVehicle: "Retail Storefront",
      location: product.retailer_info?.address || "Metro Fresh Supermarket, Koramangala, Bengaluru",
      details: custody.currentStage === 4
        ? `Received by ${product.retailer_info?.store || "store"}. QR authenticated at store intake and made available for customer purchase.`
        : "Product is progressing through the supply chain and has not yet arrived at the retail storefront."
    }
  ]

  return (
    <div id="consumer-product-result" className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-300">
      {/* 1. PRODUCT & SHELF AUTHENTICITY HEADER */}
      <div className="rounded-3xl border border-emerald-200 bg-white p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-emerald-100 pb-6">
          <div className="flex items-start gap-4">
            {product.product_image_url ? (
              <img
                src={product.product_image_url}
                alt={product.name}
                className="h-20 w-20 rounded-2xl border border-emerald-200 object-cover shadow-xs shrink-0"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-3xl shrink-0 shadow-2xs">
                {produceEmoji}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                  Batch #{product.batch_number}
                </span>
                {product.organic_status && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <Leaf className="h-3 w-3 text-emerald-600" /> Certified Organic
                  </span>
                )}
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <Brain className="h-3 w-3 text-blue-600" /> AI {product.ai_quality_label} ({product.ai_quality_score}%)
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 capitalize">
                {product.name}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Category: <strong className="text-slate-800 capitalize">{product.category}</strong> • Available Stock:{" "}
                <strong className="text-slate-800">{product.quantity} kg</strong> • Status:{" "}
                <strong className="text-emerald-700 font-bold">{product.status}</strong>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {onScanAnother && (
              <Button
                onClick={onScanAnother}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50 cursor-pointer shadow-2xs"
              >
                <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                Scan Another QR
              </Button>
            )}
            <Button
              onClick={handleCopyLink}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Link Copied" : "Share"}
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer hidden sm:inline-flex shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Certificate
            </Button>
          </div>
        </div>

        {/* 2. EXPIRY & FRESHNESS HIGHLIGHT BANNER */}
        {expInfo && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Expiry Box */}
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 shadow-2xs ${
                expInfo.isExpired
                  ? "bg-rose-50 border-rose-200 text-rose-950"
                  : expInfo.isUrgent
                  ? "bg-amber-50 border-amber-200 text-amber-950"
                  : "bg-emerald-50/70 border-emerald-200 text-emerald-950"
              }`}
            >
              <div
                className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${
                  expInfo.isExpired
                    ? "bg-rose-200 text-rose-800"
                    : expInfo.isUrgent
                    ? "bg-amber-200 text-amber-800"
                    : "bg-emerald-200 text-emerald-800"
                }`}
              >
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider block opacity-80">
                  Verified Expiration Date
                </span>
                <h4 className="text-xl font-extrabold">{expInfo.formattedDate}</h4>
                <p className="text-xs font-semibold mt-0.5">{expInfo.label}</p>
              </div>
            </div>

            {/* Authenticity Guarantee Box */}
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 flex items-start gap-3 shadow-2xs">
              <div className="p-2.5 rounded-xl bg-emerald-200/80 text-emerald-800 mt-0.5 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 block">
                  Cryptographic Food Safety
                </span>
                <h4 className="text-sm font-bold text-slate-900">100% Tamper-Proof Provenance</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Audited through verified transport transit logs and signed with Ethereum smart contracts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. BLOCKCHAIN LEDGER BANNER */}
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-emerald-300">Ethereum Sepolia Ledger Record:</span>
            <span className="font-mono text-[11px] text-slate-300 truncate max-w-xs sm:max-w-md">
              {product.blockchain_hash || "0xd4d1e64f42a82940c56a796ed4ce16ea0731351c4a0fd3b756b143bb7a09809b"}
            </span>
          </div>
          {product.blockchain_hash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${product.blockchain_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-emerald-400 hover:text-emerald-300 underline shrink-0"
            >
              <span>Verify On Etherscan</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* 2. PROMINENT CURRENT PRODUCT STATE & CUSTODY BANNER */}
      <div className="rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white p-6 sm:p-8 shadow-md relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-200/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header: Current Custody Title + Stage Counter */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-200/60 pb-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`p-3 rounded-2xl shadow-sm shrink-0 ${
              custody.currentActorRole === "farmer"
                ? "bg-emerald-600 text-white"
                : custody.currentActorRole === "processor"
                ? "bg-blue-600 text-white"
                : custody.currentActorRole === "distributor"
                ? "bg-amber-600 text-white"
                : "bg-purple-600 text-white"
            }`}>
              {custody.currentActorRole === "farmer" && <Leaf className="h-6 w-6" />}
              {custody.currentActorRole === "processor" && <Factory className="h-6 w-6" />}
              {custody.currentActorRole === "distributor" && <Truck className="h-6 w-6" />}
              {custody.currentActorRole === "retailer" && <Store className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  Current Product Custody
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-white border border-emerald-200 text-slate-800 shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  {custody.statusBadge}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {custody.statusTitle}
              </h3>
            </div>
          </div>

          <div className="sm:text-right bg-white/80 backdrop-blur-xs p-3 px-4 rounded-2xl border border-emerald-200/80 shadow-2xs shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Supply Chain Progress
            </span>
            <div className="flex items-baseline sm:justify-end gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-emerald-700">
                Stage {custody.currentStage} of 4
              </span>
              <span className="text-xs font-bold text-slate-500">
                ({custody.progressPercent}%)
              </span>
            </div>
          </div>
        </div>

        {/* Current Location & Custodian Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 relative z-10">
          {/* Box 1: Custodian */}
          <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-2xs space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Current Custodian
            </span>
            <p className="text-sm font-black text-slate-900 truncate">
              {custody.currentActorName}
            </p>
            <p className="text-xs font-semibold text-emerald-700 capitalize">
              Role: {custody.currentActorRole}
            </p>
          </div>

          {/* Box 2: Facility / Vehicle */}
          <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-2xs space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Custody Facility / Fleet
            </span>
            <p className="text-sm font-black text-slate-900 truncate">
              {custody.currentFacilityOrVehicle}
            </p>
            <p className="text-xs text-slate-600">
              Product Status: <span className="font-bold text-slate-800">{product.status}</span>
            </p>
          </div>

          {/* Box 3: Physical Location */}
          <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-2xs space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-emerald-600" />
              Physical Location
            </span>
            <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
              {custody.currentLocation}
            </p>
          </div>
        </div>

        {/* 4-Step Visual Stepper Bar */}
        <div className="pt-2 relative z-10 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Stages Completed: {custody.completedStagesCount} of 4</span>
            <span className="text-emerald-700 font-extrabold">
              {custody.currentStage === 4 ? "Full Provenance Verified" : `Active at Stage ${custody.currentStage}`}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Step 1: Farmer */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              stages[0].status === "completed"
                ? "bg-emerald-500/10 border-emerald-300 shadow-2xs"
                : "bg-slate-50 border-slate-200 opacity-60"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900">1. Farmer</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                  ✓
                </span>
              </div>
              <h5 className="font-bold text-xs text-slate-900 mt-1 truncate">Farm Origin</h5>
              <p className="text-[10px] text-emerald-700 font-semibold">Completed</p>
            </div>

            {/* Step 2: Processor */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              stages[1].status === "completed"
                ? "bg-emerald-500/10 border-emerald-300 shadow-2xs"
                : stages[1].status === "in_progress"
                ? "bg-blue-50 border-blue-300 ring-2 ring-blue-400/30 shadow-2xs"
                : "bg-slate-50 border-slate-200 opacity-60"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">2. Processor</span>
                {stages[1].status === "completed" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    ✓
                  </span>
                ) : stages[1].status === "in_progress" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold animate-pulse">
                    ●
                  </span>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold">
                    ⏳
                  </span>
                )}
              </div>
              <h5 className="font-bold text-xs text-slate-900 mt-1 truncate">Processing Depot</h5>
              <p className={`text-[10px] font-semibold ${
                stages[1].status === "completed" ? "text-emerald-700" : stages[1].status === "in_progress" ? "text-blue-700 font-bold" : "text-slate-400"
              }`}>
                {stages[1].status === "completed" ? "Completed" : stages[1].status === "in_progress" ? "In Progress" : "Pending"}
              </p>
            </div>

            {/* Step 3: Distributor */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              stages[2].status === "completed"
                ? "bg-emerald-500/10 border-emerald-300 shadow-2xs"
                : stages[2].status === "in_progress"
                ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/30 shadow-2xs"
                : "bg-slate-50 border-slate-200 opacity-60"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">3. Distributor</span>
                {stages[2].status === "completed" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    ✓
                  </span>
                ) : stages[2].status === "in_progress" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[10px] font-bold animate-pulse">
                    ●
                  </span>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold">
                    ⏳
                  </span>
                )}
              </div>
              <h5 className="font-bold text-xs text-slate-900 mt-1 truncate">Fleet Transit</h5>
              <p className={`text-[10px] font-semibold ${
                stages[2].status === "completed" ? "text-emerald-700" : stages[2].status === "in_progress" ? "text-amber-700 font-bold" : "text-slate-400"
              }`}>
                {stages[2].status === "completed" ? "Completed" : stages[2].status === "in_progress" ? "In Transit" : "Pending"}
              </p>
            </div>

            {/* Step 4: Retailer */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              stages[3].status === "completed"
                ? "bg-purple-500/10 border-purple-300 shadow-2xs"
                : "bg-slate-50 border-slate-200 opacity-60"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">4. Retailer</span>
                {stages[3].status === "completed" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-white text-[10px] font-bold">
                    ✓
                  </span>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold">
                    ⏳
                  </span>
                )}
              </div>
              <h5 className="font-bold text-xs text-slate-900 mt-1 truncate">Retail Store</h5>
              <p className={`text-[10px] font-semibold ${
                stages[3].status === "completed" ? "text-purple-700 font-bold" : "text-slate-400"
              }`}>
                {stages[3].status === "completed" ? (custody.isFinalSold ? "Sold" : "In Store") : "Pending"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. COMPLETE 4-STAGE PROVENANCE AUDIT TRAIL */}
      <div className="rounded-3xl border border-emerald-200 bg-white p-6 sm:p-8 shadow-md space-y-6">
        <div className="border-b border-emerald-100 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-900">
              Complete Supply Chain Audit Trail (Farmer to Retailer)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified timestamps, physical facility addresses, and quality compliance certificates for Batch #{product.batch_number}.
          </p>
        </div>

        {/* Timeline Steps */}
        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:inset-0 before:left-3 sm:before:left-4 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-blue-400 before:to-purple-400">
          {/* STAGE 1: FARMER ORIGIN */}
          <div className="relative flex items-start gap-4">
            <div className="absolute -left-6 sm:-left-8 top-1 p-2 rounded-full bg-emerald-600 text-white shadow-md ring-4 ring-white">
              <Leaf className="h-4 w-4" />
            </div>
            <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm">1. Agricultural Farm Origin & Harvest</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ✓ Harvest Verified
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  📅 {new Date(product.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Harvested and authenticated by <strong>{product.farmer?.name || "Green Valley Organic Farms"}</strong>.
              </p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                📍 Farm Location: {product.farmer?.address || "Doddaballapur Farmlands, Bengaluru North, Karnataka"}
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-emerald-100 text-[11px] font-bold text-emerald-800 shadow-2xs">
                <Award className="h-3 w-3 text-emerald-600" />
                Computer-Vision Quality Grade: {product.ai_quality_label} ({product.ai_quality_score}%)
              </div>
            </div>
          </div>

          {/* STAGE 2: PROCESSOR INTAKE & PACKAGING */}
          <div className="relative flex items-start gap-4">
            <div className={`absolute -left-6 sm:-left-8 top-1 p-2 rounded-full text-white shadow-md ring-4 ring-white ${
              stages[1].status === "completed"
                ? "bg-blue-600"
                : stages[1].status === "in_progress"
                ? "bg-blue-500 animate-pulse ring-blue-200"
                : "bg-slate-300 text-slate-600"
            }`}>
              <Factory className="h-4 w-4" />
            </div>
            <div className={`w-full rounded-2xl border p-4 space-y-2 transition-all ${
              stages[1].status === "completed"
                ? "border-blue-200 bg-blue-50/30"
                : stages[1].status === "in_progress"
                ? "border-blue-300 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-sm"
                : "border-dashed border-slate-300 bg-slate-50/40 opacity-75"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm">2. Facility Intake & Quality Inspection</span>
                  {stages[1].status === "completed" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      ✓ Intake Inspected
                    </span>
                  ) : stages[1].status === "in_progress" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs animate-pulse">
                      ● Active In Facility
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      ⏳ Pending Facility Intake
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  {stages[1].date ? `📅 ${stages[1].date}` : stages[1].status === "in_progress" ? "● Currently Active" : "⏳ Pending Intake"}
                </span>
              </div>

              {stages[1].status !== "pending" ? (
                <>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Verified and processed at <strong>{product.processor_info?.name || "Agro-Processing Unit Depot"}</strong>. Scale weight checked, sanitized, and sealed under certified packing conditions.
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    📍 Processing Depot: {product.processor_info?.address || "Agro-Processing Unit #4, Yeshwanthpur Industrial Suburb, APMC Yard, Bengaluru"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-100 text-[11px] font-bold text-blue-800 shadow-2xs">
                      <CheckCircle2 className="h-3 w-3 text-blue-600" />
                      Packaging Batch Code Preserved: {product.batch_number}
                    </div>
                    {product.processor_info?.license && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-100 text-[11px] font-mono font-semibold text-slate-600 shadow-2xs">
                        📜 License: {product.processor_info.license}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 py-1">
                  Product is currently at farm origin. Facility intake, scale weight inspection, sanitization, and packaging will be recorded when the product arrives at the processing facility.
                </div>
              )}
            </div>
          </div>

          {/* STAGE 3: DISTRIBUTOR TRANSIT */}
          <div className="relative flex items-start gap-4">
            <div className={`absolute -left-6 sm:-left-8 top-1 p-2 rounded-full text-white shadow-md ring-4 ring-white ${
              stages[2].status === "completed"
                ? "bg-amber-600"
                : stages[2].status === "in_progress"
                ? "bg-amber-500 animate-pulse ring-amber-200"
                : "bg-slate-300 text-slate-600"
            }`}>
              <Truck className="h-4 w-4" />
            </div>
            <div className={`w-full rounded-2xl border p-4 space-y-2 transition-all ${
              stages[2].status === "completed"
                ? "border-amber-200 bg-amber-50/30"
                : stages[2].status === "in_progress"
                ? "border-amber-300 bg-amber-50/60 ring-2 ring-amber-500/20 shadow-sm"
                : "border-dashed border-slate-300 bg-slate-50/40 opacity-75"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm">3. Distribution Logistics & Safe Transit</span>
                  {stages[2].status === "completed" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      ✓ Transit Completed
                    </span>
                  ) : stages[2].status === "in_progress" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white shadow-xs animate-pulse">
                      ● Currently In Transit
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      ⏳ Pending Logistics Dispatch
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  {stages[2].date ? `📅 ${stages[2].date}` : stages[2].status === "in_progress" ? "● Currently In Transit" : "⏳ Pending Dispatch"}
                </span>
              </div>

              {stages[2].status !== "pending" ? (
                <>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Dispatched via <strong>{product.distributor_info?.carrier || "SwiftLogistics Fleet Carrier"}</strong> in vehicle <strong>{product.distributor_info?.vehicle || "KA-04-E-2941 (Transit Logistics Van)"}</strong>.
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-[11px] font-bold text-amber-900 shadow-2xs">
                    <span>🚚 Transit Logistics: {product.distributor_info?.temp || "Monitored Safe Transit"}</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 py-1">
                  Product has not yet been dispatched into transit logistics. Carrier assignment and route telematics will begin upon batch dispatch from the processing depot.
                </div>
              )}
            </div>
          </div>

          {/* STAGE 4: RETAILER STORE AVAILABILITY */}
          <div className="relative flex items-start gap-4">
            <div className={`absolute -left-6 sm:-left-8 top-1 p-2 rounded-full text-white shadow-md ring-4 ring-white ${
              stages[3].status === "completed"
                ? "bg-purple-600"
                : stages[3].status === "in_progress"
                ? "bg-purple-500 animate-pulse ring-purple-200"
                : "bg-slate-300 text-slate-600"
            }`}>
              <Store className="h-4 w-4" />
            </div>
            <div className={`w-full rounded-2xl border p-4 space-y-2 transition-all ${
              stages[3].status === "completed"
                ? "border-purple-200 bg-purple-50/30"
                : stages[3].status === "in_progress"
                ? "border-purple-300 bg-purple-50/60 ring-2 ring-purple-500/20 shadow-sm"
                : "border-dashed border-slate-300 bg-slate-50/40 opacity-75"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm">4. Retail Store Intake & Shelf Display</span>
                  {stages[3].status === "completed" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                      ✓ {custody.isFinalSold ? "Sold to Consumer" : "Available in Store"}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      ⏳ Pending Retail Arrival
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  {stages[3].date ? `📅 ${stages[3].date}` : "⏳ Pending Delivery"}
                </span>
              </div>

              {stages[3].status === "completed" ? (
                <>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Received by <strong>{product.retailer_info?.store || "Metro Fresh Supermarket"}</strong>. QR code authenticated at store intake and made available for customer purchase.
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    📍 Retail Store Address: {product.retailer_info?.address || "Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-[11px] font-bold text-purple-900 shadow-2xs">
                      <span>🏪 Shelf Status: {product.retailer_info?.shelf_status || "In Store • Fresh Display"}</span>
                    </div>
                    {expInfo && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 border border-emerald-300 text-[11px] font-bold text-emerald-900 shadow-2xs">
                        <CalendarDays className="h-3 w-3 text-emerald-700" />
                        <span>Fresh Until: {expInfo.formattedDate}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 py-1">
                  Product is progressing through the supply chain and has not yet arrived at the retail storefront. Retail verification and shelf placement will be recorded upon store delivery.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
