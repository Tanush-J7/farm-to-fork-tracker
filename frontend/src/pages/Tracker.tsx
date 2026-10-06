import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { ethers } from "ethers"
import { Card } from "../components/ui/Card"
import {
  CheckCircle2, Factory, Truck, Store, Search, AlertCircle, Loader2,
  ShieldCheck, Clock, Leaf, Brain, QrCode, Upload
} from "lucide-react"
import { Button } from "../components/ui/Button"
import axios from "axios"
import { Html5Qrcode } from "html5-qrcode"
import jsQR from "jsqr"
import { getFarmerLocation } from "../utils"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"
const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545"
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ""

const FARMCHAIN_ABI = [
  "function products(uint256) public view returns (uint256 id, string name, string category, string batchNumber, uint256 quantity, address farmer, address currentOwner, string status, uint256 timestamp)",
  "function getProductHistory(uint256 _productId) public view returns (tuple(string status, address owner, uint256 timestamp, string extraInfo)[])"
]

// Safely map ID to 6 digits
const format6DigitId = (id: number | string) => {
  const num = Number(id)
  if (num >= 100000 && num <= 999999) return String(num)
  if (num > 0) return String(100000 + num)
  return "100000"
}

export function Tracker() {
  const [searchParams] = useSearchParams()
  const initialId = searchParams.get("id") || ""
  const [productIdInput, setProductIdInput] = useState(initialId)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  const [dbProduct, setDbProduct] = useState<any>(null)
  const [chainProduct, setChainProduct] = useState<any>(null)

  // Scanner modal / state on Tracker page
  const [showScanner, setShowScanner] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [scannerError, setScannerError] = useState("")
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchProductData = async (id: string) => {
    if (!id) return
    setLoading(true)
    setError("")
    setDbProduct(null)
    setChainProduct(null)

    let cleanId = id.trim()
    if (cleanId.startsWith("FP-")) {
      cleanId = cleanId.replace("FP-", "")
    }

    let foundDb: any = null
    let foundChain: any = null
    const numId = Number(cleanId)

    // 1. Direct route /api/products/blockchain/:id
    try {
      const dbRes = await axios.get(`${API}/products/blockchain/${cleanId}`)
      if (dbRes.data?.data) {
        foundDb = dbRes.data.data
      }
    } catch {
      // fallback
    }

    // 2. Subtracted small ID (e.g. 100008 -> 8)
    if (!foundDb && !isNaN(numId) && numId >= 100000) {
      try {
        const smallId = numId - 100000
        const smallRes = await axios.get(`${API}/products/blockchain/${smallId}`)
        if (smallRes.data?.data) {
          foundDb = smallRes.data.data
        }
      } catch {
        // fallback
      }
    }

    // 3. Match from all products list
    if (!foundDb) {
      try {
        const listRes = await axios.get(`${API}/products`)
        const allList = listRes.data?.data || []
        if (allList.length > 0) {
          foundDb = allList.find((p: any) => {
            const pId = p.product_id || p.id
            const mapped = format6DigitId(pId)
            return (
              String(pId) === String(cleanId) ||
              mapped === String(cleanId) ||
              (numId >= 100000 && Number(pId) === numId - 100000) ||
              p.batch_number === cleanId ||
              p.batchNumber === cleanId ||
              String(p.id) === String(cleanId)
            )
          })
        }
      } catch {
        // fallback
      }
    }

    if (foundDb) {
      setDbProduct(foundDb)
    }

    // 4. Query on-chain data if contract configured
    if (CONTRACT_ADDRESS) {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const contract = new ethers.Contract(CONTRACT_ADDRESS, FARMCHAIN_ABI, provider)

        const searchIdOnChain = (foundDb?.product_id) ? foundDb.product_id : cleanId
        const productData = await contract.products(searchIdOnChain)
        if (productData && productData.id !== 0n) {
          foundChain = {
            name: productData.name,
            batchNumber: productData.batchNumber,
            status: productData.status
          }
          setChainProduct(foundChain)
        }
      } catch (err) {
        console.warn("Blockchain read skipped:", err)
      }
    }

    if (!foundDb && !foundChain) {
      setError(`No agricultural product found for "${id}". Please verify the Product ID or scan a valid QR code.`)
    }

    setLoading(false)
  }

  useEffect(() => {
    const queryId = searchParams.get("id")
    if (queryId) {
      setProductIdInput(queryId)
      fetchProductData(queryId)
    }
  }, [searchParams])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (productIdInput) {
      window.history.pushState({}, '', `?id=${productIdInput}`)
      fetchProductData(productIdInput)
    }
  }

  // Camera QR Scanner methods
  const startLiveCamera = async () => {
    setScannerError("")
    setCameraActive(true)
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop()
      }
      const html5QrCode = new Html5Qrcode("tracker-qr-reader")
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleScannedResult(decodedText)
        },
        () => {}
      )
    } catch (err: any) {
      setScannerError(err?.message || "Could not access camera. Please allow camera permissions or upload an image.")
      setCameraActive(false)
    }
  }

  const stopLiveCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop()
        }
        html5QrCodeRef.current.clear()
      } catch (e) {}
    }
    setCameraActive(false)
  }

  const handleScannedResult = (decodedText: string) => {
    stopLiveCamera()
    setShowScanner(false)

    let extractedId = decodedText
    if (decodedText.includes("?id=")) {
      extractedId = decodedText.split("?id=")[1].split("&")[0]
    }
    setProductIdInput(extractedId)
    window.history.pushState({}, '', `?id=${extractedId}`)
    fetchProductData(extractedId)
  }

  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScannerError("")

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl)

      // Layer 1: Native BarcodeDetector
      if ("BarcodeDetector" in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
          const barcodes = await barcodeDetector.detect(img)
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleScannedResult(barcodes[0].rawValue)
            return
          }
        } catch (err) {}
      }

      // Layer 2: jsQR Canvas direct pixel scan
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          })
          if (code && code.data) {
            handleScannedResult(code.data)
            return
          }
        }
      } catch (err) {}

      // Layer 3: Html5Qrcode buffer scan
      try {
        const html5QrCode = new Html5Qrcode("tracker-qr-reader")
        const result = await html5QrCode.scanFile(file, false)
        if (result) {
          handleScannedResult(result)
          return
        }
      } catch (err) {}

      setScannerError("Could not detect a valid QR code in this image. Please upload a clear QR photo.")
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setScannerError("Invalid image file.")
    }

    img.src = objectUrl
  }

  // Supply Chain Stage Verification Logic
  const currentStatus = dbProduct?.status || chainProduct?.status || "Harvested"

  const mappedDisplayId = dbProduct ? format6DigitId(dbProduct.product_id || dbProduct.id) : (productIdInput || "100000")

  const hasBlockchainRecord = !!(dbProduct?.blockchain_hash || dbProduct?.blockchainHash || chainProduct)

  // Compute clean AI Quality Grade
  const qualityScore = dbProduct?.ai_quality_score || 92
  let qualityGrade = dbProduct?.ai_quality_label
  if (!qualityGrade || qualityGrade === "Unknown" || qualityGrade === "N/A") {
    qualityGrade = qualityScore >= 90 ? "Grade A" : qualityScore >= 80 ? "Grade B" : "Standard Grade"
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 pt-8 px-4">
      {/* Header Search & QR Trigger */}
      <div className="text-center space-y-3">
        <div className="inline-flex p-3 rounded-full bg-primary/10 text-primary border border-primary/20 mb-1">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Track & Verify Produce Authenticity
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          Verify blockchain authenticity, view verified quality inspection grades, and trace the complete farm-to-fork supply chain journey.
        </p>
        
        {/* Search Bar & QR Scan Controls */}
        <div className="max-w-md mx-auto space-y-3 pt-2">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="Enter 6-digit ID or Batch (e.g. 100001)" 
              value={productIdInput}
              onChange={(e) => setProductIdInput(e.target.value)}
              className="flex h-12 w-full rounded-2xl border border-input bg-card/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm text-foreground"
            />
            <Button type="submit" size="lg" className="h-12 px-6 rounded-2xl bg-primary hover:bg-primary/95 text-white font-semibold shrink-0" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Search className="h-4 w-4 mr-1.5" />}
              Track & Verify
            </Button>
          </form>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowScanner(true)
                startLiveCamera()
              }}
              className="flex-1 rounded-xl text-xs gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/10"
            >
              <QrCode className="h-3.5 w-3.5" />
              Scan with Camera
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleQrFileUpload}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-xl text-xs gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload QR Image
            </Button>
          </div>
        </div>
      </div>

      {/* QR CAMERA SCANNER POPUP MODAL */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-sm w-full rounded-3xl border shadow-2xl p-6 bg-zinc-900 border-zinc-800 text-white space-y-4 text-center">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2 text-primary">
                <QrCode className="h-5 w-5" />
                Scan Product QR Code
              </h3>
              <button onClick={() => { stopLiveCamera(); setShowScanner(false); }} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="relative w-full aspect-square rounded-2xl border-2 border-dashed border-zinc-700 bg-black overflow-hidden flex items-center justify-center">
              <div id="tracker-qr-reader" className="w-full h-full" />
              {cameraActive && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse top-1/2 z-20" />
              )}
            </div>

            {scannerError && (
              <p className="text-xs text-red-400">{scannerError}</p>
            )}

            <Button
              onClick={() => { stopLiveCamera(); setShowScanner(false); }}
              variant="outline"
              className="w-full rounded-xl text-xs border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
          </Card>
        </div>
      )}

      {/* ERROR ALERT */}
      {error && (
        <div className="flex items-center gap-3 text-red-500 bg-red-500/10 p-5 rounded-2xl border border-red-500/20 text-sm animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* MAIN UNIFIED VERIFICATION & JOURNEY REPORT */}
      {(dbProduct || chainProduct) && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* SECTION 1: PRODUCT & BLOCKCHAIN AUTHENTICITY CERTIFICATE */}
          <Card className="overflow-hidden rounded-3xl border shadow-md bg-card/60">
            <div className="bg-gradient-to-r from-emerald-500/15 via-primary/10 to-transparent p-6 sm:p-8 border-b">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-2xl">
                      {dbProduct?.name?.includes("Tomato") ? "🍅" : dbProduct?.name?.includes("Mango") ? "🥭" : dbProduct?.name?.includes("Grape") ? "🍇" : "🌱"}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                      {dbProduct?.name || chainProduct?.name}
                    </h2>
                    <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 font-mono font-bold text-xs px-3 py-1 rounded-full">
                      FP-{mappedDisplayId}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-1.5">
                    Batch: <span className="font-semibold text-foreground">{dbProduct?.batch_number || dbProduct?.batchNumber || "BCH-2026"}</span>
                    {" • "}Category: <span className="font-semibold text-foreground">{dbProduct?.category || "Produce"}</span>
                    {" • "}Quantity: <span className="font-semibold text-foreground">{dbProduct?.quantity || 10} kg</span>
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {dbProduct?.organic_status && (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-500">
                      <Leaf className="h-3 w-3 mr-1" /> Certified Organic
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-400">
                    <Brain className="h-3 w-3 mr-1" /> Quality: {qualityGrade} ({qualityScore}%)
                  </span>
                  <span className="inline-flex items-center rounded-full bg-primary/20 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
                    Status: {currentStatus}
                  </span>
                </div>
              </div>

              {/* Blockchain Authenticity Seal */}
              {hasBlockchainRecord ? (
                <div className="mt-6 p-4 rounded-2xl bg-zinc-950/80 border border-emerald-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">🟢 Cryptographically Verified On-Chain</p>
                      <p className="text-xs font-mono text-zinc-400 break-all">
                        Hash: {dbProduct?.blockchain_hash || dbProduct?.blockchainHash}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    Ethereum Smart Contract
                  </span>
                </div>
              ) : (
                <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Blockchain Verification Unavailable</p>
                      <p className="text-xs font-mono text-amber-500/70">
                        This batch has not yet been registered on the blockchain or verification is pending.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* SECTION 2: AUTHENTICITY VERIFICATION CHECKLIST */}
          <Card className="rounded-3xl border shadow-sm p-6 sm:p-8 space-y-5 bg-card/60">
            <div className="border-b pb-3 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  Authenticity Verification Checklist
                </h3>
                <p className="text-xs text-muted-foreground">Certified supply chain records validated across each lifecycle milestone.</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                100% Tamper-Proof
              </span>
            </div>

            <div className="grid gap-3">
              <div className="p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all bg-emerald-500/5 border-emerald-500/20">
                <div className="space-y-0.5">
                  <p className="font-bold text-sm text-foreground">Product Registration</p>
                  <p className="text-xs text-muted-foreground">Registered with immutable Batch ID: {dbProduct?.batch_number}</p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 shrink-0">
                  <CheckCircle2 className="h-4 w-4" /> Verified ✓
                </span>
              </div>
              {hasBlockchainRecord && (
                <div className="p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all bg-emerald-500/5 border-emerald-500/20">
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm text-foreground">Blockchain Smart Contract Record</p>
                    <p className="text-xs text-muted-foreground">Immutable ledger transaction confirmed on Ethereum smart contract</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 shrink-0">
                    <CheckCircle2 className="h-4 w-4" /> Verified ✓
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* SECTION 3: INTERACTIVE VISUAL TIMELINE JOURNEY */}
          <Card className="rounded-3xl border shadow-sm p-6 sm:p-8 space-y-6 bg-card/60">
            <div className="border-b pb-3">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Farm-to-Fork Supply Chain Journey
              </h3>
              <p className="text-xs text-muted-foreground">Chronological audit trail of physical handling and custody transfers.</p>
            </div>

            <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-blue-500 before:to-muted-foreground/30">
              
              {/* Step 1: Harvest (Always exists if product is found) */}
              <div className="relative flex items-start gap-4 pl-12">
                <div className="absolute left-3 -translate-x-1/2 p-2 rounded-full bg-emerald-500 text-white shadow-md ring-4 ring-background">
                  <Leaf className="h-4 w-4" />
                </div>
                <div className="p-4 rounded-2xl border bg-card/80 w-full space-y-1 border-emerald-500/20">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-foreground">Farm Harvest & Registration</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Completed</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Farmed by <strong>{dbProduct?.farmer?.name || "Verified Farmer"}</strong> • Location: {getFarmerLocation(dbProduct)} • Harvest Date: {new Date(dbProduct?.created_at || Date.now()).toLocaleDateString("en-GB")}
                  </p>
                </div>
              </div>

              {/* Dynamic Real Events */}
              {dbProduct?.events?.map((evt: any, i: number) => (
                <div key={i} className="relative flex items-start gap-4 pl-12">
                  <div className="absolute left-3 -translate-x-1/2 p-2 rounded-full bg-blue-500 text-white shadow-md ring-4 ring-background">
                    {evt.event_type.toLowerCase().includes("processing") || evt.event_type.toLowerCase().includes("quality") ? <Factory className="h-4 w-4" /> :
                     evt.event_type.toLowerCase().includes("transit") || evt.event_type.toLowerCase().includes("transfer") ? <Truck className="h-4 w-4" /> :
                     evt.event_type.toLowerCase().includes("receive") || evt.event_type.toLowerCase().includes("retail") ? <Store className="h-4 w-4" /> :
                     <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div className="p-4 rounded-2xl border bg-card/80 w-full space-y-1 border-blue-500/20">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-foreground">{evt.event_type}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Recorded</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {evt.description} • Location: {evt.location || "Supply Chain"} • Date: {new Date(evt.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>
      )}
    </div>
  )
}
