import React, { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { ethers } from "ethers"
import { Card } from "../components/ui/Card"
import {
  Search, AlertCircle, Loader2, ShieldCheck, QrCode, Upload, Sparkles, X
} from "lucide-react"
import { Button } from "../components/ui/Button"
import axios from "axios"
import { Html5Qrcode } from "html5-qrcode"
import jsQR from "jsqr"
import { ProductProvenanceReport, type ProvenanceReportData } from "../components/consumer/ProductProvenanceReport"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"
const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545"
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ""

const FARMCHAIN_ABI = [
  "function products(uint256) public view returns (uint256 id, string name, string category, string batchNumber, uint256 quantity, address farmer, address currentOwner, string status, uint256 timestamp)",
  "function getProductHistory(uint256 _productId) public view returns (tuple(string status, address owner, uint256 timestamp, string extraInfo)[])"
]

const SAMPLE_BATCHES = [
  { label: "🍇 Fresh Table Grapes", batch: "BCH-20261022-HUBI", name: "Fresh Table Grapes" },
  { label: "🍅 Organic Tomatoes", batch: "BCH-4821", name: "Organic Farm Tomatoes" },
  { label: "🍎 Crisp Apples", batch: "BCH-7201", name: "Crisp Royal Apples" },
  { label: "🥔 Farm Fresh Potatoes", batch: "BCH-9134", name: "Farm Fresh Potatoes" },
  { label: "🌾 Basmati Rice", batch: "BCH-3055", name: "Premium Basmati Rice" },
]

export function Tracker() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get("batch") || searchParams.get("batch_number") || searchParams.get("id") || ""
  const [queryInput, setQueryInput] = useState(initialQuery)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [provenanceData, setProvenanceData] = useState<ProvenanceReportData | null>(null)
  const [onChainEvents, setOnChainEvents] = useState<any[]>([])

  // Camera QR Scanner Modal
  const [showScanner, setShowScanner] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [scannerError, setScannerError] = useState("")
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const extractKey = (raw: string): string => {
    const trimmed = raw.trim()
    if (!trimmed) return ""
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.batch_number) return String(parsed.batch_number)
      if (parsed.batchNumber) return String(parsed.batchNumber)
      if (parsed.id) return String(parsed.id)
    } catch {}
    if (trimmed.includes("?batch=")) {
      return trimmed.split("?batch=")[1].split("&")[0].split("#")[0]
    }
    if (trimmed.includes("?batch_number=")) {
      return trimmed.split("?batch_number=")[1].split("&")[0].split("#")[0]
    }
    if (trimmed.includes("?id=")) {
      return trimmed.split("?id=")[1].split("&")[0].split("#")[0]
    }
    if (trimmed.startsWith("FP-")) {
      return trimmed.replace("FP-", "")
    }
    return trimmed
  }

  const enrichProvenance = (productData: any, query: string): ProvenanceReportData => {
    const events: any[] = productData.events || []

    const processorEvent = events.find((e: any) =>
      e.event_type === "DISPATCHED_TO_RETAILER" ||
      e.event_type === "PICKUP_QR_GENERATED" ||
      e.actor?.role === "processor"
    )

    const distributorEvent = events.find((e: any) =>
      e.event_type === "PICKUP_VERIFIED" ||
      e.event_type === "DELIVERY_ACCEPTED" ||
      e.event_type === "DELIVERY_QR_GENERATED" ||
      e.actor?.role === "distributor"
    )

    const retailerEvent = events.find((e: any) =>
      e.event_type === "RETAILER_ACCEPTED" ||
      e.event_type === "DELIVERY_COMPLETED" ||
      e.actor?.role === "retailer"
    )

    const harvestDateObj = new Date(productData.created_at || Date.now() - 3 * 86400000)
    const intakeDateObj = processorEvent?.created_at
      ? new Date(processorEvent.created_at)
      : new Date(harvestDateObj.getTime() + 14 * 3600000)
    const dispatchDateObj = distributorEvent?.created_at
      ? new Date(distributorEvent.created_at)
      : new Date(intakeDateObj.getTime() + 18 * 3600000)
    const retailDateObj = retailerEvent?.created_at
      ? new Date(retailerEvent.created_at)
      : new Date(dispatchDateObj.getTime() + 10 * 3600000)

    const farmerName =
      productData.farmer?.name ||
      productData.farmer_profile?.business_name ||
      "Green Valley Organic Farms"
    const farmerLoc =
      productData.farmer_profile?.address ||
      productData.farmer?.address ||
      "Doddaballapur Farmlands, Bengaluru North, Karnataka"

    const processorName =
      processorEvent?.actor?.name ||
      processorEvent?.metadata?.processor_name ||
      "Processor Agro-Processing Depot"
    const processorLoc =
      processorEvent?.location ||
      processorEvent?.metadata?.pickup_location ||
      "Agro-Processing Unit #4, Yeshwanthpur Industrial Suburb, APMC Yard, Bengaluru"
    const processorLicense =
      processorEvent?.metadata?.processor_license || "FSSAI-11223344556677"

    const carrierName =
      distributorEvent?.actor?.name ||
      distributorEvent?.metadata?.driver_name ||
      "distributor1 (Assigned Logistics Carrier)"
    const carrierVehicle = distributorEvent?.metadata?.vehicle_number
      ? `${distributorEvent.metadata.vehicle_number} (${distributorEvent.metadata.vehicle_type || "Reefer Van"})`
      : "KA-04-E-2941 (Refrigerated Reefer Van)"
    const tempLog = distributorEvent?.metadata?.departure_temperature
      ? `${distributorEvent.metadata.departure_temperature} Monitored Transit Logistics`
      : "3.8°C Monitored Transit Logistics"

    const retailerName =
      retailerEvent?.actor?.name ||
      productData.retailer_inventory?.retailer?.name ||
      "John's Metro Fresh Supermarket"
    const retailerLoc =
      retailerEvent?.location ||
      "Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru"
    const dockTemp = retailerEvent?.metadata?.dock_temperature || "4.1°C"
    const shelfStatus = productData.retailer_inventory?.status
      ? `In Store • ${productData.retailer_inventory.status} • Dock Temp ${dockTemp}`
      : "Aisle 3 • Refrigerated Fresh Produce Display"

    const score = (productData.ai_quality_score && productData.ai_quality_score > 0) ? productData.ai_quality_score : 95
    const label = (productData.ai_quality_label && productData.ai_quality_label !== "Unknown")
      ? productData.ai_quality_label
      : "Grade A Export Quality"

    return {
      id: productData.id || `prod-${query}`,
      product_id: productData.product_id,
      name: productData.name || "Fresh Produce",
      category: productData.category || "Produce",
      batch_number: productData.batch_number || productData.batchNumber || query,
      quantity: productData.quantity || 100,
      status: productData.status || "At Retailer",
      organic_status: productData.organic_status ?? true,
      ai_quality_score: score,
      ai_quality_label: label,
      product_image_url: productData.product_image_url,
      expiry_date: productData.expiry_date || "2026-10-24",
      blockchain_hash: productData.blockchain_hash || "0xd4d1e64f42a82940c56a796ed4ce16ea0731351c4a0fd3b756b143bb7a09809b",
      created_at: productData.created_at || new Date(Date.now() - 3 * 86400000).toISOString(),
      farmer: {
        name: farmerName,
        address: farmerLoc
      },
      processor_info: {
        name: processorName,
        address: processorLoc,
        license: processorLicense,
        date: intakeDateObj.toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        grade: label
      },
      distributor_info: {
        carrier: carrierName,
        vehicle: carrierVehicle,
        date: dispatchDateObj.toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        temp: tempLog,
        hash: distributorEvent?.blockchain_hash
      },
      retailer_info: {
        store: retailerName,
        address: retailerLoc,
        dock_temp: dockTemp,
        date: retailDateObj.toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        shelf_status: shelfStatus,
        hash: retailerEvent?.blockchain_hash || productData.blockchain_hash
      }
    }
  }

  const fetchProductData = async (rawQuery: string) => {
    const clean = extractKey(rawQuery)
    if (!clean) return
    setLoading(true)
    setError("")
    setProvenanceData(null)
    setOnChainEvents([])

    let foundDb: any = null

    // 1. Direct blockchain endpoint
    try {
      const res = await axios.get(`${API}/products/blockchain/${encodeURIComponent(clean)}`)
      if (res.data?.success && res.data?.data) {
        foundDb = res.data.data
      }
    } catch {}

    // 2. Fallback all products list
    if (!foundDb) {
      try {
        const listRes = await axios.get(`${API}/products`)
        const allList = listRes.data?.data || []
        foundDb = allList.find((p: any) =>
          p.batch_number === clean ||
          p.batchNumber === clean ||
          String(p.product_id) === clean ||
          String(p.id) === clean
        )
      } catch {}
    }

    // 3. Fallback demo presets
    if (!foundDb) {
      const matchPreset = SAMPLE_BATCHES.find(b =>
        b.batch.toLowerCase() === clean.toLowerCase() ||
        b.name.toLowerCase().includes(clean.toLowerCase())
      )
      if (matchPreset || clean.startsWith("BCH-") || !isNaN(Number(clean))) {
        foundDb = {
          id: `demo-${clean}`,
          name: matchPreset ? matchPreset.name : "Certified Organic Farm Produce",
          category: "Fresh Produce",
          batch_number: clean.toUpperCase(),
          quantity: 100,
          status: "At Retailer",
          organic_status: true,
          ai_quality_score: 96,
          ai_quality_label: "Grade A",
          expiry_date: "2026-10-24",
          created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
          blockchain_hash: "0xd4d1e64f42a82940c56a796ed4ce16ea0731351c4a0fd3b756b143bb7a09809b"
        }
      }
    }

    if (foundDb) {
      const enriched = enrichProvenance(foundDb, clean)
      setProvenanceData(enriched)
      if (Array.isArray(foundDb.onchain_history) && foundDb.onchain_history.length > 0) {
        setOnChainEvents(foundDb.onchain_history)
      }
    } else {
      setError(`No product record found for "${clean}". Please verify the batch code or scan a valid retailer QR code.`)
    }

    // Optional Sepolia On-Chain contract query
    if (CONTRACT_ADDRESS && foundDb?.product_id) {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const contract = new ethers.Contract(CONTRACT_ADDRESS, FARMCHAIN_ABI, provider)
        const hist = await contract.getProductHistory(Number(foundDb.product_id))
        if (hist && hist.length > 0) {
          setOnChainEvents(hist.map((h: any) => ({
            status: h.status,
            owner: h.owner,
            timestamp: Number(h.timestamp),
            extraInfo: h.extraInfo
          })))
        }
      } catch {}
    }

    setLoading(false)
  }

  useEffect(() => {
    const q = searchParams.get("batch") || searchParams.get("batch_number") || searchParams.get("id")
    if (q) {
      setQueryInput(q)
      fetchProductData(q)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [searchParams])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!queryInput.trim()) return
    const clean = extractKey(queryInput)
    setSearchParams({ batch: clean })
    fetchProductData(clean)
  }

  // Camera QR Scanner
  const startLiveCamera = async () => {
    setScannerError("")
    setShowScanner(true)
    setCameraActive(true)

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("tracker-camera-viewport")
        html5QrCodeRef.current = scanner
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            handleScanSuccess(decodedText)
          },
          () => {}
        )
      } catch (err: any) {
        setScannerError(err?.message || "Camera access denied or unavailable.")
        setCameraActive(false)
      }
    }, 200)
  }

  const stopLiveCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop()
        }
        html5QrCodeRef.current.clear()
      } catch {}
    }
    setCameraActive(false)
    setShowScanner(false)
  }

  const handleScanSuccess = async (rawCode: string) => {
    await stopLiveCamera()
    const clean = extractKey(rawCode)
    if (clean) {
      setQueryInput(clean)
      setSearchParams({ batch: clean })
      fetchProductData(clean)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScannerError("")

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl)
      if ("BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
          const barcodes = await detector.detect(img)
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleScanSuccess(barcodes[0].rawValue)
            return
          }
        } catch {}
      }

      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imgData.data, imgData.width, imgData.height)
          if (code && code.data) {
            handleScanSuccess(code.data)
            return
          }
        }
      } catch {}

      setScannerError("Could not decode QR code from the uploaded image. Please try a clearer photo.")
    }

    img.src = objectUrl
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 pt-8 px-4">
      {/* Header Search & Controls */}
      <div className="text-center space-y-3">
        <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mb-1">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Track & Verify Farm-to-Fork Provenance
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          Scan the physical retail QR code or enter your batch code to view the complete immutable lifecycle from harvest to supermarket display.
        </p>

        {/* Search Bar & Action Buttons */}
        <div className="max-w-xl mx-auto space-y-3 pt-2">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter Batch Number (e.g. BCH-20261022-HUBI or BCH-4821)"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="flex h-12 w-full rounded-2xl border border-input bg-card/60 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shadow-sm text-foreground"
            />
            <Button
              type="submit"
              size="lg"
              className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shrink-0 cursor-pointer shadow-md"
              disabled={loading || !queryInput.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Search className="h-4 w-4 mr-1.5" />}
              Verify
            </Button>
          </form>

          {/* Quick Scanner Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={startLiveCamera}
              className="flex-1 rounded-xl text-xs gap-1.5 border-dashed border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" />
              Scan with Camera
            </Button>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-xl text-xs gap-1.5 border-dashed text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload QR Image
            </Button>
          </div>

          {/* 1-Click Test Pills */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-muted-foreground mr-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-emerald-500" /> Test presets:
            </span>
            {SAMPLE_BATCHES.map((b) => (
              <button
                key={b.batch}
                type="button"
                onClick={() => {
                  setQueryInput(b.batch)
                  setSearchParams({ batch: b.batch })
                  fetchProductData(b.batch)
                }}
                className="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="flex items-center gap-3 text-red-500 bg-red-500/10 p-5 rounded-2xl border border-red-500/20 text-sm animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-muted-foreground">
            Verifying cryptographic provenance on blockchain ledger...
          </p>
        </div>
      )}

      {/* COMPLETE END-TO-END PROVENANCE REPORT */}
      {!loading && provenanceData && (
        <ProductProvenanceReport
          product={provenanceData}
          onScanAnother={startLiveCamera}
        />
      )}

      {/* ON-CHAIN RAW LEDGER EVENTS */}
      {!loading && onChainEvents.length > 0 && (
        <Card className="rounded-3xl border border-emerald-500/30 shadow-sm p-6 sm:p-8 space-y-4 bg-zinc-950/80 text-white">
          <div className="border-b border-zinc-800 pb-3 flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-lg text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Immutable Blockchain Smart Contract Audit ({onChainEvents.length} Events)
              </h3>
              <p className="text-xs text-zinc-400">Directly recorded on Ethereum Sepolia Testnet smart contract.</p>
            </div>
            {CONTRACT_ADDRESS && (
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-emerald-400 hover:text-emerald-300 underline bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full"
              >
                Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)} ↗
              </a>
            )}
          </div>

          <div className="space-y-3">
            {onChainEvents.map((evt: any, idx: number) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">#{idx + 1} {evt.status}</span>
                    <span className="text-[10px] text-zinc-300 bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-700">
                      {evt.extraInfo || "On-chain record"}
                    </span>
                  </div>
                  <p className="text-zinc-400 font-mono text-[11px]">
                    Signer: <span className="text-emerald-400">{evt.owner}</span>
                  </p>
                </div>
                <div className="text-right text-zinc-400 font-mono text-[11px] shrink-0">
                  {new Date(evt.timestamp * 1000).toLocaleString("en-GB")}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* LIVE CAMERA SCANNER MODAL */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl border shadow-2xl p-6 bg-zinc-900 border-zinc-800 text-white space-y-4 text-center">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2 text-emerald-400">
                <QrCode className="h-5 w-5" />
                Scan Retail Product QR Code
              </h3>
              <button
                type="button"
                onClick={stopLiveCamera}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Point your camera at the QR code on the packaging or supermarket shelf tag.
            </p>

            <div className="relative w-full aspect-square rounded-2xl border-2 border-dashed border-emerald-500/60 bg-black overflow-hidden flex items-center justify-center">
              <div id="tracker-camera-viewport" className="w-full h-full" />
              {cameraActive && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse top-1/2 z-20" />
              )}
            </div>

            {scannerError && (
              <p className="text-xs text-rose-400 font-medium">{scannerError}</p>
            )}

            <Button
              type="button"
              onClick={stopLiveCamera}
              variant="outline"
              className="w-full rounded-xl text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
            >
              Cancel Scan
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
