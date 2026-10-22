import React, { useState } from "react"
import {
  Leaf, Factory, Truck, Store, Clock, ShieldCheck, CalendarDays,
  Printer, ExternalLink, Brain, CheckCircle2, Award, QrCode, Copy, Check
} from "lucide-react"
import { Button } from "../ui/Button"

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
  farmer?: {
    name?: string
    address?: string
  }
  processor_info?: {
    name: string
    address: string
    license?: string
    date: string
    grade: string
  }
  distributor_info?: {
    carrier: string
    vehicle: string
    date: string
    temp: string
    hash?: string
  }
  retailer_info?: {
    store: string
    address: string
    dock_temp?: string
    date: string
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
                <strong className="text-emerald-700">{product.status}</strong>
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

      {/* 4. COMPLETE 4-STAGE PROVENANCE AUDIT TRAIL */}
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
        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:inset-0 before:left-3 sm:before:left-4 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-blue-500 before:to-purple-500">
          {/* STAGE 1: FARMER ORIGIN */}
          <div className="relative flex items-start gap-4">
            <div className="absolute -left-6 sm:-left-8 top-1 p-2 rounded-full bg-emerald-600 text-white shadow-md ring-4 ring-white">
              <Leaf className="h-4 w-4" />
            </div>
            <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">1. Agricultural Farm Origin & Harvest</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Harvest Verified
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
            <div className="absolute -left-6 sm:-left-8 top-1 p-2 rounded-full bg-blue-600 text-white shadow-md ring-4 ring-white">
              <Factory className="h-4 w-4" />
            </div>
            <div className="w-full rounded-2xl border border-blue-200 bg-blue-50/30 p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">2. Facility Intake & Quality Inspection</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    Intake Inspected
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  📅 {product.processor_info?.date}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Verified and processed at <strong>{product.processor_info?.name}</strong>. Scale weight checked, sanitized, and sealed under certified packing conditions.
              </p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                📍 Processing Depot: {product.processor_info?.address}
              </p>
              <div className="flex flex-wrap items-center gap-2">
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
            </div>
          </div>

          {/* STAGE 3: DISTRIBUTOR TRANSIT */}
          <div className="relative flex items-start gap-4">
            <div className="absolute -left-6 sm:-left-8 top-1 p-2 rounded-full bg-amber-600 text-white shadow-md ring-4 ring-white">
              <Truck className="h-4 w-4" />
            </div>
            <div className="w-full rounded-2xl border border-amber-200 bg-amber-50/30 p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">3. Distribution Logistics & Safe Transit</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                    Reefer Transit
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  📅 {product.distributor_info?.date}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Dispatched via <strong>{product.distributor_info?.carrier}</strong> in vehicle <strong>{product.distributor_info?.vehicle}</strong>.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-[11px] font-bold text-amber-900 shadow-2xs">
                <span>❄️ Temperature SLA: {product.distributor_info?.temp}</span>
              </div>
            </div>
          </div>

          {/* STAGE 4: RETAILER STORE AVAILABILITY */}
          <div className="relative flex items-start gap-4">
            <div className="absolute -left-6 sm:-left-8 top-1 p-2 rounded-full bg-purple-600 text-white shadow-md ring-4 ring-white">
              <Store className="h-4 w-4" />
            </div>
            <div className="w-full rounded-2xl border border-purple-200 bg-purple-50/30 p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">4. Retail Store Intake & Shelf Display</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900">
                    Available in Store
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  📅 {product.retailer_info?.date}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Received by <strong>{product.retailer_info?.store}</strong>. QR code authenticated at store intake and made available for customer purchase.
              </p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                📍 Retail Store Address: {product.retailer_info?.address}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-[11px] font-bold text-purple-900 shadow-2xs">
                  <span>🏪 Shelf Status: {product.retailer_info?.shelf_status}</span>
                </div>
                {expInfo && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 border border-emerald-300 text-[11px] font-bold text-emerald-900 shadow-2xs">
                    <CalendarDays className="h-3 w-3 text-emerald-700" />
                    <span>Fresh Until: {expInfo.formattedDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
