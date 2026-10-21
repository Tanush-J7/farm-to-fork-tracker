import React, { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import axios from "axios"
import {
  Package,
  Truck,
  Zap,
  TrendingUp,
  QrCode,
  SplitSquareHorizontal,
  Clock,
  ShieldCheck,
  Camera,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  Store,
  RefreshCw,
  Navigation,
  ChevronRight,
  Compass,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  Scale,
  Download,
  Copy,
  Check,
  Sparkles
} from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { Card } from "../components/ui/Card"
import { Button } from "../components/ui/Button"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useAuth } from "../context/AuthContext"
import { Html5Qrcode } from "html5-qrcode"
import jsQR from "jsqr"
import { RouteMapModal } from "../components/distributor/RouteMapModal"
import { getGoogleMapsDestinationUrl } from "../utils"
import { ProfileManagementSection } from "../components/profile/ProfileManagementSection"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

const routePerformanceData = [
  { day: "Mon", deliveries: 8, onTime: 8 },
  { day: "Tue", deliveries: 12, onTime: 11 },
  { day: "Wed", deliveries: 9, onTime: 9 },
  { day: "Thu", deliveries: 15, onTime: 14 },
  { day: "Fri", deliveries: 18, onTime: 17 },
  { day: "Sat", deliveries: 11, onTime: 11 },
  { day: "Sun", deliveries: 6, onTime: 6 },
]

export type DistributorTab = "overview" | "requests" | "fleet" | "inventory" | "blockchain" | "profile"

export function DistributorDashboard() {
  const { user, token, updateUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = (searchParams.get("tab") as any) || "overview"
  const [activeTab, setActiveTab] = useState<DistributorTab>(
    ["overview", "requests", "fleet", "inventory", "blockchain", "profile"].includes(tabParam) ? tabParam : "overview"
  )

  useEffect(() => {
    const t = searchParams.get("tab")
    if (t && ["overview", "requests", "fleet", "inventory", "blockchain", "profile"].includes(t)) {
      setActiveTab(t as any)
    } else if (!t) {
      setActiveTab("overview")
    }
  }, [searchParams])

  const handleTabSwitch = (t: DistributorTab) => {
    setActiveTab(t)
    if (t === "overview") {
      setSearchParams({})
    } else {
      setSearchParams({ tab: t })
    }
  }
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Camera QR Scanner state
  const [showScanner, setShowScanner] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [scannerError, setScannerError] = useState("")
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handoff / Take Custody state
  const [handoffId, setHandoffId] = useState("")
  const [scannedBatchPreview, setScannedBatchPreview] = useState<any>(null)
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [handoffSuccess, setHandoffSuccess] = useState("")
  const [handoffTxHash, setHandoffTxHash] = useState("")
  const [handoffError, setHandoffError] = useState("")

  // Retailer Delivery Modal state
  const [deliveryModalItem, setDeliveryModalItem] = useState<any>(null)
  const [destinationStore, setDestinationStore] = useState("Metro Fresh Mart (Koramangala Store #104)")
  const [deliveryRemarks, setDeliveryRemarks] = useState("Direct express delivery completed; intake acknowledged by store manager")
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [deliverySuccessTx, setDeliverySuccessTx] = useState("")
  const [deliveryError, setDeliveryError] = useState("")

  const [allProducts, setAllProducts] = useState<any[]>([])

  // Delivery Requests state (from Processors)
  const [deliveryRequests, setDeliveryRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestsFilter, setRequestsFilter] = useState<"ALL" | "REQUESTED" | "IN_TRANSIT" | "COMPLETED" | "DECLINED">("ALL")
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null)
  const [declineModalRequest, setDeclineModalRequest] = useState<any | null>(null)
  const [selectedMapRequest, setSelectedMapRequest] = useState<any | null>(null)
  const [declineReasonInput, setDeclineReasonInput] = useState("Vehicle capacity currently booked on another route")

  // Driver Availability Status state
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusSuccess, setStatusSuccess] = useState(false)

  // Pickup Verification Modal state (Processor Facility Handover)
  const pickupQrScannerRef = useRef<Html5Qrcode | null>(null)
  const pickupFileInputRef = useRef<HTMLInputElement>(null)
  const [isPickupCameraActive, setIsPickupCameraActive] = useState(false)
  const [pickupCameraError, setPickupCameraError] = useState("")
  const [pickupVerifyModal, setPickupVerifyModal] = useState<{
    isOpen: boolean
    req: any
    step: "scan" | "inspect" | "success"
    verifiedData?: any
    loading?: boolean
    error?: string
    txHash?: string
    manualTokenInput?: string
  } | null>(null)

  const [inspectionDriverName, setInspectionDriverName] = useState("")
  const [inspectionDriverPhone, setInspectionDriverPhone] = useState("")
  const [inspectionVehicleNumber, setInspectionVehicleNumber] = useState("")
  const [inspectionVehicleType, setInspectionVehicleType] = useState("Refrigerated Reefer Van")
  const [inspectionDepartureTemp, setInspectionDepartureTemp] = useState("3.8°C")
  const [inspectionVerifiedWeight, setInspectionVerifiedWeight] = useState<number | string>("")
  const [inspectionWeightUnit, setInspectionWeightUnit] = useState("kg")
  const [inspectionRemarks, setInspectionRemarks] = useState("Physical crates inspected, lot number & quantity verified, pre-cooling intact.")
  const [inspectionNotes, setInspectionNotes] = useState("Physical crates inspected, lot number & quantity verified, pre-cooling intact.")
  const [inspectionCheckboxes, setInspectionCheckboxes] = useState({
    cratesIntact: true,
    quantityMatched: true,
    tempCompliant: true
  })

  // Delivery Handoff QR Modal state (Retailer Store Dock)
  const [deliveryQrModal, setDeliveryQrModal] = useState<{
    isOpen: boolean
    req: any
    qrToken?: string
    qrData?: any
    loading?: boolean
    error?: string
    txHash?: string
  } | null>(null)

  const updateStatus = async (status: string) => {
    setStatusLoading(true)
    setStatusSuccess(false)
    try {
      await axios.put(
        `${API_URL}/auth/status`,
        { availability_status: status },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch {
      localStorage.setItem(`driver_status_${user?.id}`, status)
    } finally {
      if (user) {
        updateUser({ availability_status: status })
      }
      setStatusSuccess(true)
      setStatusLoading(false)
      setTimeout(() => setStatusSuccess(false), 3000)
    }
  }

  const fetchDeliveryRequests = async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingRequests(true)
      const res = await axios.get(`${API_URL}/distributor/delivery-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.success) {
        setDeliveryRequests(res.data.data || [])
      }
    } catch (err) {
      console.warn("Could not load delivery requests", err)
    } finally {
      if (!isSilent) setLoadingRequests(false)
    }
  }

  const handleRespondToRequest = async (requestId: string, action: "ACCEPT" | "DECLINE", reason?: string) => {
    setRespondingRequestId(requestId)
    try {
      const res = await axios.put(
        `${API_URL}/distributor/delivery-requests/${requestId}/respond`,
        { action, decline_reason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data?.success) {
        await fetchDeliveryRequests(true)
        await fetchInventory()
        window.dispatchEvent(new Event("distributor_updated"))
        if (action === "ACCEPT") {
          handleTabSwitch("fleet")
        }
      }
    } catch (err: any) {
      console.error("Failed to respond to delivery request", err)
    } finally {
      setRespondingRequestId(null)
      setDeclineModalRequest(null)
    }
  }

  // Pickup Verification Handlers (Processor Facility Handover)
  const startPickupCamera = async () => {
    setPickupCameraError("")
    setIsPickupCameraActive(true)
    try {
      if (pickupQrScannerRef.current && pickupQrScannerRef.current.isScanning) {
        await pickupQrScannerRef.current.stop()
      }
      const html5Qr = new Html5Qrcode("pickup-modal-qr-reader")
      pickupQrScannerRef.current = html5Qr

      await html5Qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          stopPickupCamera()
          handleVerifyScannedToken(decodedText)
        },
        () => {}
      )
    } catch (err: any) {
      console.error("Pickup camera error", err)
      setPickupCameraError(err?.message || "Could not access camera. Please allow camera permissions or upload an image.")
      setIsPickupCameraActive(false)
    }
  }

  const stopPickupCamera = async () => {
    if (pickupQrScannerRef.current) {
      try {
        if (pickupQrScannerRef.current.isScanning) {
          await pickupQrScannerRef.current.stop()
        }
        pickupQrScannerRef.current.clear()
      } catch (e) {}
    }
    setIsPickupCameraActive(false)
  }

  const handlePickupQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPickupCameraError("")
    setPickupVerifyModal((prev) => (prev ? { ...prev, error: "" } : null))

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = async () => {
      // Layer 1: Native BarcodeDetector if available
      if ("BarcodeDetector" in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
          const barcodes = await barcodeDetector.detect(img)
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            URL.revokeObjectURL(objectUrl)
            handleVerifyScannedToken(barcodes[0].rawValue)
            return
          }
        } catch (err) {
          console.warn("BarcodeDetector fallback", err)
        }
      }

      // Layer 2: jsQR Direct Canvas Pixel Scan
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code =
            jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" }) ||
            jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" })
          if (code && code.data) {
            URL.revokeObjectURL(objectUrl)
            handleVerifyScannedToken(code.data)
            return
          }
        }
      } catch (err) {
        console.warn("jsQR fallback", err)
      }

      // Layer 3: Html5Qrcode.scanFile
      try {
        const html5Qr = new Html5Qrcode("pickup-modal-qr-reader")
        const result = await html5Qr.scanFile(file, false)
        if (result) {
          URL.revokeObjectURL(objectUrl)
          handleVerifyScannedToken(result)
          return
        }
      } catch (err) {
        console.warn("Html5Qrcode file scan fallback", err)
      }

      URL.revokeObjectURL(objectUrl)
      setPickupCameraError("Could not detect a valid QR code in this image. Please upload a clear photo or use live camera.")
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setPickupCameraError("Invalid image file format. Please upload a PNG or JPEG photo.")
    }

    img.src = objectUrl
  }

  const handleStartPickupVerification = (req: any) => {
    stopPickupCamera()
    setPickupCameraError("")
    const initialQty = req.quantity || 200
    setInspectionVerifiedWeight(initialQty)
    setInspectionWeightUnit(req.unit || "kg")
    setInspectionRemarks("Physical crates inspected, lot number & quantity verified, pre-cooling intact.")
    setInspectionDriverName(user?.name || "Carrier Driver")
    setInspectionDriverPhone((user as any)?.phone || "+91 98765 43210")
    setInspectionVehicleNumber((user as any)?.vehicle_number || "KA-04-E-2941")
    setInspectionVehicleType((user as any)?.vehicle_type || "Refrigerated Reefer Van")
    setInspectionDepartureTemp("3.8°C")
    setInspectionCheckboxes({ cratesIntact: true, quantityMatched: true, tempCompliant: true })
    setPickupVerifyModal({
      isOpen: true,
      req,
      step: "scan",
      manualTokenInput: req.pickup_token || req.pickup_qr_token || ""
    })
  }

  const handleClosePickupModal = () => {
    stopPickupCamera()
    setPickupVerifyModal(null)
  }

  const handleVerifyScannedToken = async (tokenToVerify: string) => {
    if (!pickupVerifyModal?.req) return
    stopPickupCamera()
    setPickupVerifyModal((prev) => ({ ...prev!, loading: true, error: "" }))
    try {
      const res = await axios.post(
        `${API_URL}/distributor/verify-pickup-qr`,
        { qr_code: tokenToVerify, shipment_id: pickupVerifyModal.req.id },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data?.success) {
        const vData = res.data.data
        if (vData?.product?.quantity) {
          setInspectionVerifiedWeight(vData.product.quantity)
        }
        if (vData?.product?.unit) {
          setInspectionWeightUnit(vData.product.unit)
        }
        if (vData?.carrier_defaults?.distributor_vehicle) {
          setInspectionVehicleNumber(vData.carrier_defaults.distributor_vehicle)
        }
        if (vData?.carrier_defaults?.default_temp) {
          setInspectionDepartureTemp(vData.carrier_defaults.default_temp)
        }
        if (vData?.carrier_defaults?.distributor_name) {
          setInspectionDriverName(vData.carrier_defaults.distributor_name)
        }
        if (vData?.carrier_defaults?.distributor_phone) {
          setInspectionDriverPhone(vData.carrier_defaults.distributor_phone)
        }
        setPickupVerifyModal((prev) => ({
          ...prev!,
          loading: false,
          step: "inspect",
          verifiedData: vData
        }))
      } else {
        setPickupVerifyModal((prev) => ({
          ...prev!,
          loading: false,
          error: res.data?.message || "Invalid QR Code token for this shipment."
        }))
      }
    } catch (err: any) {
      setPickupVerifyModal((prev) => ({
        ...prev!,
        loading: false,
        error: err.response?.data?.message || "Failed to verify pickup QR on server."
      }))
    }
  }

  const handleConfirmPickupTakeCustody = async () => {
    if (!pickupVerifyModal?.req) return
    setPickupVerifyModal((prev) => ({ ...prev!, loading: true, error: "" }))

    const manifestQty = Number(pickupVerifyModal.verifiedData?.product?.quantity || pickupVerifyModal.req.quantity || 200)
    const verifiedQty = Number(inspectionVerifiedWeight) || manifestQty

    try {
      const res = await axios.post(
        `${API_URL}/distributor/confirm-pickup`,
        {
          shipment_id: pickupVerifyModal.req.id,
          qr_code:
            pickupVerifyModal.verifiedData?.pickup_token ||
            pickupVerifyModal.req.pickup_token ||
            pickupVerifyModal.req.pickup_qr_token ||
            "PKP_CONFIRMED",
          verified_quantity: verifiedQty,
          unit: inspectionWeightUnit,
          remarks: inspectionRemarks || inspectionNotes,
          inspection_notes: inspectionRemarks || inspectionNotes,
          driver_name: inspectionDriverName,
          driver_phone: inspectionDriverPhone,
          vehicle_number: inspectionVehicleNumber,
          vehicle_type: inspectionVehicleType,
          departure_temperature: inspectionDepartureTemp,
          inspection_confirmed: true
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data?.success) {
        const txHash = res.data.data?.blockchain_hash
        setPickupVerifyModal((prev) => ({
          ...prev!,
          loading: false,
          step: "success",
          txHash: txHash
        }))
        await fetchDeliveryRequests(true)
        await fetchInventory()
        window.dispatchEvent(new Event("distributor_updated"))
      } else {
        setPickupVerifyModal((prev) => ({
          ...prev!,
          loading: false,
          error: res.data?.message || "Could not confirm pickup."
        }))
      }
    } catch (err: any) {
      setPickupVerifyModal((prev) => ({
        ...prev!,
        loading: false,
        error: err.response?.data?.message || "Failed to confirm pickup."
      }))
    }
  }

  // Delivery Handoff QR Generation (Retailer Dock)
  const handleGenerateDeliveryQR = async (req: any) => {
    setDeliveryQrModal({ isOpen: true, loading: true, req })
    try {
      const res = await axios.post(
        `${API_URL}/distributor/delivery-requests/${req.id}/generate-delivery-qr`,
        {
          driver_name: inspectionDriverName || user?.name || "Carrier Driver",
          driver_phone: inspectionDriverPhone || (user as any)?.phone || "+91 98765 43210",
          vehicle_number: inspectionVehicleNumber || (user as any)?.vehicle_number || "KA-04-E-2941"
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data?.success) {
        const dlvData = res.data.data
        setDeliveryQrModal({
          isOpen: true,
          loading: false,
          req,
          qrToken: dlvData.delivery_qr_token,
          qrData: dlvData.delivery_qr_data,
          txHash: dlvData.blockchain_hash
        })
        await fetchDeliveryRequests(true)
      } else {
        setDeliveryQrModal((prev) => ({
          ...prev!,
          loading: false,
          error: res.data?.message || "Failed to generate delivery QR."
        }))
      }
    } catch (err: any) {
      setDeliveryQrModal((prev) => ({
        ...prev!,
        loading: false,
        error: err.response?.data?.message || "Failed to generate delivery QR."
      }))
    }
  }

  const [copiedDeliveryToken, setCopiedDeliveryToken] = useState(false)

  const handleDownloadDeliveryQR = () => {
    const canvas = document.getElementById("distributor-delivery-qr-canvas") as HTMLCanvasElement
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png")
      const downloadLink = document.createElement("a")
      downloadLink.href = pngUrl
      const batchClean = (deliveryQrModal?.req?.batch_number || "BATCH").replace(/[^\w-]/g, "_")
      const prodClean = (deliveryQrModal?.req?.product_name || "Delivery").replace(/[^\w-]/g, "_")
      downloadLink.download = `Delivery_QR_${prodClean}_${batchClean}.png`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      return
    }

    const svg = document.getElementById("distributor-delivery-qr-svg")
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg)
      const c = document.createElement("canvas")
      c.width = 440
      c.height = 440
      const ctx = c.getContext("2d")
      if (ctx) {
        const img = new Image()
        img.onload = () => {
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, c.width, c.height)
          ctx.drawImage(img, 0, 0, c.width, c.height)
          const pngUrl = c.toDataURL("image/png")
          const a = document.createElement("a")
          a.href = pngUrl
          a.download = `Delivery_QR_${(deliveryQrModal?.req?.batch_number || "BATCH").replace(/[^\w-]/g, "_")}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`
      }
    }
  }

  const fetchInventory = async () => {
    try {
      const [myRes, allRes] = await Promise.all([
        axios.get(`${API_URL}/products/my`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      setInventory(myRes.data.data || [])
      setAllProducts(allRes.data.data || [])
    } catch (err) {
      console.error("Error fetching distributor inventory:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchInventory()
      fetchDeliveryRequests()

      const interval = setInterval(() => {
        fetchDeliveryRequests(true)
        fetchInventory()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [token])

  useEffect(() => {
    if (token && (activeTab === "requests" || activeTab === "overview")) {
      fetchDeliveryRequests(true)
    }
  }, [activeTab, token])

  // Cleanup pickup scanner camera on unmount
  useEffect(() => {
    return () => {
      if (pickupQrScannerRef.current) {
        try {
          if (pickupQrScannerRef.current.isScanning) {
            pickupQrScannerRef.current.stop()
          }
          pickupQrScannerRef.current.clear()
        } catch (e) {}
      }
    }
  }, [])

  // Camera QR Scanner logic
  const startLiveCamera = async () => {
    setScannerError("")
    setCameraActive(true)
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop()
      }
      const html5QrCode = new Html5Qrcode("distributor-qr-reader")
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

  const handleScannedResult = async (decodedText: string) => {
    stopLiveCamera()
    setShowScanner(false)

    let extractedId = decodedText.trim()
    if (extractedId.includes("?id=")) {
      extractedId = extractedId.split("?id=")[1].split("&")[0]
    }
    if (extractedId.startsWith("FP-")) {
      extractedId = extractedId.replace("FP-", "")
    }

    setHandoffId(extractedId)
    await previewBatchDetails(extractedId)
  }

  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScannerError("")

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(img, 0, 0, img.width, img.height)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code) {
          handleScannedResult(code.data)
        } else {
          setScannerError("Could not read a valid QR code from this image. Please try a clearer photo.")
        }
      }
    }
    img.src = objectUrl
  }

  const previewBatchDetails = async (id: string) => {
    if (!id) return
    setHandoffLoading(true)
    setHandoffError("")
    try {
      const res = await axios.get(`${API_URL}/products/blockchain/${id}`)
      if (res.data?.data) {
        setScannedBatchPreview(res.data.data)
      } else {
        setHandoffError(`No batch found for "${id}".`)
      }
    } catch (err: any) {
      setHandoffError(err.response?.data?.message || "Failed to locate batch with this ID.")
    } finally {
      setHandoffLoading(false)
    }
  }

  const handleTakeCustody = async (batchToTake?: any) => {
    const target = batchToTake || scannedBatchPreview
    const targetId = target ? target.id : handoffId

    if (!targetId) return
    setHandoffLoading(true)
    setHandoffError("")
    setHandoffSuccess("")
    setHandoffTxHash("")

    try {
      let resolvedProduct = target
      if (!resolvedProduct) {
        const res = await axios.get(`${API_URL}/products/blockchain/${targetId}`)
        resolvedProduct = res.data.data
      }

      const updateRes = await axios.put(
        `${API_URL}/products/${resolvedProduct.id}/status`,
        {
          status: "In Transit",
          current_owner_id: user?.id,
          extraInfo: `Distributor (${user?.name || user?.email || "Carrier"}) took custody. Delivery cargo vehicle dispatched.`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const newTxHash = updateRes.data?.data?.blockchain_hash
      setHandoffTxHash(newTxHash || "")
      setHandoffSuccess(`Successfully took custody of ${resolvedProduct.name} (Batch: ${resolvedProduct.batch_number}). Recorded on Sepolia!`)
      setHandoffId("")
      setScannedBatchPreview(null)
      await fetchInventory()
      window.dispatchEvent(new Event("distributor_updated"))
    } catch (err: any) {
      setHandoffError(err.response?.data?.message || "Failed to verify ID or take custody.")
    } finally {
      setHandoffLoading(false)
    }
  }

  // Delivery to Retailer logic
  const handleCompleteDelivery = async () => {
    if (!deliveryModalItem) return
    setDeliveryLoading(true)
    setDeliveryError("")
    setDeliverySuccessTx("")

    try {
      const updateRes = await axios.put(
        `${API_URL}/products/${deliveryModalItem.id}/status`,
        {
          status: "At Retailer",
          extraInfo: `Delivered to ${destinationStore}: ${deliveryRemarks}`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const txHash = updateRes.data?.data?.blockchain_hash
      setDeliverySuccessTx(txHash || "0x_confirmed")
      await fetchInventory()
      window.dispatchEvent(new Event("distributor_updated"))
      setTimeout(() => {
        setDeliveryModalItem(null)
        setDeliverySuccessTx("")
      }, 3000)
    } catch (err: any) {
      setDeliveryError(err.response?.data?.message || "Failed to record delivery on blockchain.")
    } finally {
      setDeliveryLoading(false)
    }
  }

  // Stats calculations
  const activeLoadsList = deliveryRequests.filter(
    (r) => r.status === "IN_TRANSIT" || r.status === "ARRIVED_AT_RETAILER"
  )
  const completedLoadsList = deliveryRequests.filter(
    (r) => r.status === "COMPLETED" || r.status === "DELIVERED"
  )
  const activeShipmentsCount = activeLoadsList.length || inventory.filter((p) => p.status === "In Transit").length
  const deliveredCount = completedLoadsList.length || inventory.filter((p) => p.status === "At Retailer" || p.status === "Delivered").length
  const pendingRequestsCount = deliveryRequests.filter((r) => r.status === "REQUESTED").length

  const quickDeclinePresets = [
    "Vehicle capacity currently booked on another route",
    "Destination store is outside today's delivery corridor",
    "Scheduled vehicle inspection / routine maintenance",
    "Requested pickup time window cannot be met",
    "Delivery schedule conflict on this route"
  ]

  // ==========================================
  // TAB 1: OVERVIEW & COMMAND HUD (WHITE & GREEN)
  // ==========================================
  const OverviewTab = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* PENDING REQUESTS URGENT HERO BANNER (Clean White & Green) */}
      {pendingRequestsCount > 0 && (
        <div className="relative overflow-hidden p-5 rounded-3xl bg-emerald-50/90 border border-emerald-300 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0 shadow-inner">
                <Clock className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                    Action Required
                  </span>
                  <span className="text-xs text-emerald-800 font-semibold">Real-time Processor Dispatch</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-emerald-950 mt-1">
                  {pendingRequestsCount} Incoming Delivery Request{pendingRequestsCount > 1 ? "s" : ""} Awaiting Review
                </h3>
                <p className="text-xs text-emerald-800/90 mt-0.5">
                  Processors have booked your delivery fleet with source pickup and retailer drop-off locations.
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleTabSwitch("requests")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl px-5 text-xs shadow-sm shrink-0 self-start sm:self-center cursor-pointer transition-all"
            >
              Review Manifests
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 6 CRISP WHITE & GREEN KPI METRIC TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        {[
          {
            title: "In Transit",
            val: activeShipmentsCount,
            sub: "Active Cargo Shipments",
            icon: Truck,
            color: "text-emerald-700",
            bg: "bg-emerald-50/70 border-emerald-200"
          },
          {
            title: "Store Delivered",
            val: deliveredCount,
            sub: "Retail Store Handoffs",
            icon: CheckCircle2,
            color: "text-emerald-700",
            bg: "bg-emerald-50/70 border-emerald-200"
          },
          {
            title: "Pending Requests",
            val: pendingRequestsCount,
            sub: "Processor Manifests",
            icon: Clock,
            color: "text-amber-700",
            bg: "bg-amber-50/70 border-amber-200"
          },
          {
            title: "Route Reliability",
            val: "99.2%",
            sub: "On-Time Dispatch Rate",
            icon: ShieldCheck,
            color: "text-emerald-700",
            bg: "bg-emerald-50/70 border-emerald-200"
          },
          {
            title: "Fleet Efficiency",
            val: "96.4%",
            sub: "Smart Route Planning",
            icon: Zap,
            color: "text-emerald-700",
            bg: "bg-emerald-50/70 border-emerald-200"
          },
          {
            title: "Total Cargo",
            val: inventory.length,
            sub: "Batches on Chain",
            icon: Package,
            color: "text-emerald-700",
            bg: "bg-emerald-50/70 border-emerald-200"
          }
        ].map((card, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-3xl bg-white border ${card.bg} shadow-xs hover:shadow-md transition-all space-y-2`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-xl bg-emerald-100 ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">{card.val}</div>
              <p className="text-[11px] text-emerald-800 font-semibold truncate mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* MID-GRID: FLEET VEHICLE HUD + ROUTE PERFORMANCE CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FLEET VEHICLE DIAGNOSTICS CARD (White & Green) */}
        <div className="p-6 rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-5 text-slate-900">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">Delivery Fleet Vehicle #KA-04-1234</h4>
                <p className="text-[11px] text-emerald-700 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Vehicle Online • GPS Active
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Fleet Unit 01
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-150 space-y-1">
              <span className="text-[10px] text-emerald-900 uppercase font-bold flex items-center gap-1">
                <Truck className="h-3 w-3 text-emerald-600" />
                Transit Status
              </span>
              <div className="text-lg font-black text-emerald-900">En Route</div>
              <p className="text-[10px] text-emerald-700 font-semibold">Scheduled On Time ✓</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-150 space-y-1">
              <span className="text-[10px] text-emerald-900 uppercase font-bold flex items-center gap-1">
                <Navigation className="h-3 w-3 text-emerald-600" />
                GPS Tracking
              </span>
              <div className="text-lg font-black text-emerald-900">Active</div>
              <p className="text-[10px] text-emerald-700 font-semibold">12 Satellites Locked</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-2 text-xs">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-600">Active Delivery Waypoint:</span>
              <span className="text-emerald-800 font-bold">Koramangala Supermarket</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-600">Cargo Bay Load:</span>
              <span className="text-emerald-950 font-bold font-mono">18 / 20 Crates Loaded (90%)</span>
            </div>
            <div className="w-full bg-emerald-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full w-[90%]" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-emerald-100">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sepolia Contract Sync Active
            </span>
            <span className="font-mono text-[10px] text-slate-500">Block #7,184,209</span>
          </div>
        </div>

        {/* ON-TIME DELIVERY TREND CHART (Clean White & Green) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
            <div>
              <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Delivery Throughput & On-Time Arrival
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Weekly scheduled consignments compared to on-time dock arrivals.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Total Shipments
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> On-Time Dock
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={routePerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="greenThroughput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="mintOnTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderColor: "#a7f3d0",
                    borderRadius: "1rem",
                    color: "#064e3b",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                  }}
                />
                <Area type="monotone" dataKey="deliveries" stroke="#059669" strokeWidth={2.5} fill="url(#greenThroughput)" name="Total Deliveries" />
                <Area type="monotone" dataKey="onTime" stroke="#10b981" strokeWidth={2.5} fill="url(#mintOnTime)" name="On-Time Dock" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* RECENTLY COMPLETED DELIVERIES HUD */}
      {completedLoadsList.length > 0 && (
        <div className="p-6 rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
            <div>
              <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Recently Completed & Delivered Cargo
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Deliveries successfully received and certified by retail store managers.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRequestsFilter("COMPLETED")
                handleTabSwitch("requests")
              }}
              className="rounded-xl text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold cursor-pointer"
            >
              View All ({completedLoadsList.length})
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {completedLoadsList.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">
                      {item.product_name?.includes("Tomato")
                        ? "🍅"
                        : item.product_name?.includes("Mango")
                        ? "🥭"
                        : item.product_name?.includes("Apple")
                        ? "🍎"
                        : "📦"}{" "}
                      {item.product_name}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                      {item.batch_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong>{item.quantity} {item.unit || "kg"}</strong> delivered to <span className="font-semibold text-slate-900">{item.retailer?.destination_store || item.retailer?.name || "Retail Store"}</span>
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Retailer Accepted • Job Completed
                  </span>
                </div>
                {item.blockchain_hash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${item.blockchain_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-emerald-700 hover:underline font-mono shrink-0"
                  >
                    Sepolia TX ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICK LAUNCH TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => handleTabSwitch("profile")}
          className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Verified Base
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
            Distributor Profile & Depot
          </h4>
          <p className="text-xs text-slate-600 mt-1">
            Manage your fleet hub location, transport license, and dispatch coordinates.
          </p>
        </button>

        <button
          onClick={() => handleTabSwitch("requests")}
          className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 group-hover:scale-105 transition-transform">
              <Clock className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {pendingRequestsCount} Pending
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
            Processor Delivery Requests
          </h4>
          <p className="text-xs text-slate-600 mt-1">
            Review origin pickup and retailer destination manifests with GPS navigation maps.
          </p>
        </button>

        <button
          onClick={() => handleTabSwitch("fleet")}
          className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform">
              <Truck className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {activeShipmentsCount} In Transit
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
            Fleet Transit & Store Handoff
          </h4>
          <p className="text-xs text-slate-600 mt-1">
            Monitor active delivery runs and complete retail delivery acknowledgments.
          </p>
        </button>

        <button
          onClick={() => handleTabSwitch("blockchain")}
          className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform">
              <QrCode className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Live Camera
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
            Scan & Claim Custody
          </h4>
          <p className="text-xs text-slate-600 mt-1">
            Scan QR on harvest or processor crates to broadcast cryptographic transfer on Sepolia.
          </p>
        </button>
      </div>
    </div>
  )

  // ==========================================
  // TAB 2: DELIVERY REQUESTS FROM PROCESSORS
  // ==========================================
  const RequestsTab = () => {
    const pendingCount = deliveryRequests.filter((r) => r.status === "REQUESTED").length
    const activeRequestsCount = deliveryRequests.filter(
      (r) => r.status === "IN_TRANSIT" || r.status === "ACCEPTED" || r.status === "PICKUP_QR_GENERATED" || r.status === "ARRIVED_AT_RETAILER"
    ).length
    const completedCount = deliveryRequests.filter((r) => r.status === "COMPLETED" || r.status === "DELIVERED").length
    const declinedCount = deliveryRequests.filter((r) => r.status === "DECLINED").length

    const filtered = deliveryRequests.filter((r) => {
      if (requestsFilter === "ALL") return true
      if (requestsFilter === "REQUESTED") return r.status === "REQUESTED"
      if (requestsFilter === "IN_TRANSIT") return r.status === "IN_TRANSIT" || r.status === "ACCEPTED" || r.status === "PICKUP_QR_GENERATED" || r.status === "ARRIVED_AT_RETAILER"
      if (requestsFilter === "COMPLETED") return r.status === "COMPLETED" || r.status === "DELIVERED"
      if (requestsFilter === "DECLINED") return r.status === "DECLINED"
      return true
    })

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* SUBHEADER & CONTROLS (White & Green) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-200 pb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-emerald-950">
              <Clock className="h-5 w-5 text-emerald-600" />
              Incoming Delivery Requests from Processors
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Processors submit formal cargo dispatch manifests for your fleet. Accept to take custody or decline.
            </p>
          </div>

          {/* Filter Pills & Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchDeliveryRequests(false)}
              disabled={loadingRequests}
              className="rounded-full text-xs h-8 px-3.5 gap-1.5 cursor-pointer shadow-xs border-emerald-200 text-slate-700 hover:bg-emerald-50"
            >
              <RefreshCw className={`h-3 w-3 ${loadingRequests ? "animate-spin text-emerald-600" : ""}`} />
              Refresh
            </Button>
            {[
              { id: "ALL", label: `All (${deliveryRequests.length})` },
              { id: "REQUESTED", label: `Pending (${pendingCount})` },
              {
                id: "IN_TRANSIT",
                label: `In Transit (${activeRequestsCount})`
              },
              {
                id: "COMPLETED",
                label: `Delivered & Completed (${completedCount})`
              },
              {
                id: "DECLINED",
                label: `Declined (${declinedCount})`
              }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRequestsFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  requestsFilter === f.id
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* LOADING STATE */}
        {loadingRequests ? (
          <div className="py-20 text-center text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-2" />
            <p className="text-sm font-medium">Fetching real-time dispatch manifests...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto border border-emerald-200">
              <Clock className="h-7 w-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900">No Delivery Requests Found</h4>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {requestsFilter === "REQUESTED"
                ? "You have no pending delivery requests at the moment. All caught up!"
                : "When a processor finishes inspecting produce and requests your delivery fleet, the detailed manifest will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {filtered.map((req) => {
              const isPending = req.status === "REQUESTED"
              const isAwaitingPickup = req.status === "ACCEPTED" || req.status === "PICKUP_QR_GENERATED"
              const isInTransit = req.status === "IN_TRANSIT"
              const isArrivedAtStore = req.status === "ARRIVED_AT_RETAILER"
              const isCompleted = req.status === "COMPLETED"
              const isDeclined = req.status === "DECLINED"
              const isDisputed = req.status === "DISPUTED"
              const isActioning = respondingRequestId === req.id

              const sourceLocation =
                req.processor?.facility_location ||
                req.processor?.facility_name ||
                "Agro-Processing Unit #4, Yeshwanthpur APMC Yard, Bengaluru 560022"

              const destLocation =
                req.retailer?.store_location ||
                req.retailer?.destination_store ||
                "Metro Fresh Supermarket, 80 Feet Road, Koramangala, Bengaluru 560034"

              return (
                <div
                  key={req.id}
                  className={`rounded-3xl border transition-all overflow-hidden p-6 space-y-5 bg-white shadow-sm ${
                    isPending
                      ? "border-emerald-300 ring-2 ring-emerald-500/10 hover:border-emerald-500"
                      : isAwaitingPickup
                      ? "border-indigo-300 ring-2 ring-indigo-500/10 hover:border-indigo-500"
                      : isInTransit
                      ? "border-cyan-300 ring-2 ring-cyan-500/10 hover:border-cyan-500"
                      : isArrivedAtStore
                      ? "border-purple-300 ring-2 ring-purple-500/10 hover:border-purple-500"
                      : isCompleted
                      ? "border-emerald-200 hover:border-emerald-400"
                      : "border-slate-200 opacity-80"
                  }`}
                >
                  {/* TOP HEADER: BATCH, TIMESTAMP, STATUS */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-emerald-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Batch: {req.batch_number}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          Tracking: #{req.tracking_id || req.id?.slice(0, 8)}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          • {new Date(req.created_at).toLocaleDateString()} at {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <h4 className="text-xl font-black text-slate-900 flex items-center gap-2 pt-0.5">
                        {req.product_name?.includes("Tomato")
                          ? "🍅"
                          : req.product_name?.includes("Mango")
                          ? "🥭"
                          : req.product_name?.includes("Apple")
                          ? "🍎"
                          : "📦"}
                        {req.product_name}
                      </h4>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        isPending
                          ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                          : req.status === "ACCEPTED"
                          ? "bg-blue-100 text-blue-800 border border-blue-300"
                          : req.status === "PICKUP_QR_GENERATED"
                          ? "bg-indigo-100 text-indigo-800 border border-indigo-300 animate-pulse"
                          : isInTransit
                          ? "bg-cyan-100 text-cyan-800 border border-cyan-300"
                          : isArrivedAtStore
                          ? "bg-purple-100 text-purple-800 border border-purple-300 animate-pulse"
                          : isCompleted
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : isDisputed
                          ? "bg-rose-100 text-rose-800 border border-rose-300"
                          : "bg-slate-100 text-slate-700 border border-slate-300"
                      }`}
                    >
                      {isPending && <Clock className="h-3.5 w-3.5" />}
                      {req.status === "ACCEPTED" && <Clock className="h-3.5 w-3.5 text-blue-600" />}
                      {req.status === "PICKUP_QR_GENERATED" && <QrCode className="h-3.5 w-3.5 text-indigo-600" />}
                      {isInTransit && <Truck className="h-3.5 w-3.5 text-cyan-600" />}
                      {isArrivedAtStore && <Store className="h-3.5 w-3.5 text-purple-600" />}
                      {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      {isDeclined && <X className="h-3.5 w-3.5" />}
                      {isPending
                        ? "Pending Review"
                        : req.status === "ACCEPTED"
                        ? "Accepted — Awaiting Pickup QR"
                        : req.status === "PICKUP_QR_GENERATED"
                        ? "Pickup QR Ready at Processor"
                        : isInTransit
                        ? "In Transit to Retailer"
                        : isArrivedAtStore
                        ? "At Retailer Dock — Delivery QR Ready"
                        : isCompleted
                        ? "Delivery Completed & Signed Off"
                        : isDisputed
                        ? "Dispute Reported by Store"
                        : "Declined"}
                    </span>
                  </div>

                  {/* VISUAL JOURNEY FLOW: SOURCE -> TRANSIT -> DESTINATION (White & Green) */}
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                    <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 text-emerald-700" />
                      Live Route Journey & Verified Profile Locations
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* SOURCE PICKUP CARD */}
                      <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                            1. Pickup Origin (Processor Facility)
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">Origin Depot</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900">
                          {req.processor?.facility_name || "Agro-Processing Facility"}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {sourceLocation}
                        </p>
                        <div className="pt-1">
                          <a
                            href={getGoogleMapsDestinationUrl(sourceLocation)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                          >
                            <Navigation className="h-3 w-3" /> GPS Navigate to Pickup ↗
                          </a>
                        </div>
                      </div>

                      {/* DESTINATION DELIVERY CARD */}
                      <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                            <Store className="h-3 w-3 text-emerald-600" />
                            2. Delivery Destination (Retailer Store)
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">Final Store Dock</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900">
                          {req.retailer?.destination_store || "Retail Supermarket"}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {destLocation}
                        </p>
                        <div className="pt-1">
                          <a
                            href={getGoogleMapsDestinationUrl(destLocation)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                          >
                            <Navigation className="h-3 w-3" /> GPS Navigate to Store ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4-SPECIFICATION MANIFEST TILES */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-white border border-emerald-200 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">📦 Cargo Net Weight</span>
                      <p className="font-black text-sm text-slate-900">
                        {req.quantity} {req.unit || "kg"}
                      </p>
                      <p className="text-[10px] text-emerald-700 font-semibold">Standard Packaged Crate</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white border border-emerald-200 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">🏅 AI Quality Grade</span>
                      <p className="font-black text-sm text-slate-900">
                        {req.quality_label || "Grade A"} ({req.quality_score || 94}%)
                      </p>
                      <p className="text-[10px] text-slate-600">Shelf Life: {req.expiry_date || "14 Days"}</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white border border-emerald-200 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">🚚 Delivery Priority</span>
                      <p className="font-black text-sm text-emerald-700 flex items-center gap-1">
                        <Zap className="h-3 w-3 text-emerald-600" />
                        Express Transport
                      </p>
                      <p className="text-[10px] text-slate-600">Direct Doorstep Route</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white border border-emerald-200 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">⛓️ On-Chain Proof</span>
                      <p className="font-black text-sm text-emerald-800">Sepolia Verified</p>
                      <p className="text-[10px] text-slate-600">Instant Handoff Ready</p>
                    </div>
                  </div>

                  {/* PROCESSOR NOTES */}
                  {req.processor_notes && (
                    <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs text-slate-700 flex items-start gap-2 italic">
                      <span className="font-bold not-italic text-emerald-950 shrink-0">Processor Dispatch Notes:</span>
                      <span>"{req.processor_notes}"</span>
                    </div>
                  )}

                  {/* DECLINED REASON IF APPLICABLE */}
                  {isDeclined && req.decline_reason && (
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                      <strong>Reason for Declining:</strong> "{req.decline_reason}"
                    </div>
                  )}

                  {/* ACTION BAR */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-emerald-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedMapRequest(req)}
                      className="w-full sm:w-auto rounded-xl text-xs gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold cursor-pointer"
                    >
                      <Navigation className="h-3.5 w-3.5 text-emerald-600" />
                      View Interactive Route Map
                    </Button>

                    {isPending && (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActioning}
                          onClick={() => setDeclineModalRequest(req)}
                          className="w-full sm:w-auto rounded-xl text-xs border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Decline Request
                        </Button>
                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => handleRespondToRequest(req.id, "ACCEPT")}
                          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-sm cursor-pointer"
                        >
                          {isActioning ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Recording Acceptance...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Accept Delivery & Start Trip
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {isAwaitingPickup && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleStartPickupVerification(req)}
                          className="rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-sm"
                        >
                          <QrCode className="h-4 w-4" />
                          Scan Pickup QR & Inspect Cargo
                        </Button>
                      </div>
                    )}

                    {isInTransit && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-800 font-bold flex items-center gap-1.5">
                          <Truck className="h-4 w-4 text-cyan-600" />
                          In Transit with Reefer Telematics
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateDeliveryQR(req)}
                          className="rounded-xl text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer shadow-sm"
                        >
                          <Store className="h-4 w-4" />
                          Arrived at Store — Generate Delivery QR
                        </Button>
                      </div>
                    )}

                    {isArrivedAtStore && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-800 font-bold flex items-center gap-1.5">
                          <Store className="h-4 w-4 text-purple-600 animate-pulse" />
                          Docked at Store — Awaiting Retailer Scan
                        </span>
                        <Button
                          size="sm"
                          onClick={() => {
                            setDeliveryQrModal({
                              isOpen: true,
                              loading: false,
                              req,
                              qrToken: req.delivery_qr_token || `DLV_${req.id}`,
                              qrData: req.delivery_qr_data || {}
                            })
                          }}
                          className="rounded-xl text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer shadow-sm"
                        >
                          <QrCode className="h-4 w-4" />
                          View Delivery Handoff QR
                        </Button>
                      </div>
                    )}

                    {isCompleted && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-800 font-bold flex items-center gap-1.5 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Delivery Completed — Handover Certified
                        </span>
                        {req.blockchain_hash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${req.blockchain_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-mono"
                          >
                            Sepolia: {req.blockchain_hash.slice(0, 8)}... <ExternalLink className="h-3 w-3 inline" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* QUICK DECLINE REASON MODAL WITH PRESET CHIPS (Clean White & Green) */}
        {declineModalRequest && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-md w-full rounded-3xl border border-emerald-200 bg-white text-slate-900 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-start border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                    <X className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Decline Delivery Request</h3>
                    <p className="text-xs text-slate-500 font-mono">Batch: {declineModalRequest.batch_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeclineModalRequest(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <label className="font-semibold text-slate-700">Quick Reason Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {quickDeclinePresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDeclineReasonInput(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-xl border transition-all text-left cursor-pointer ${
                        declineReasonInput === preset
                          ? "bg-emerald-100 border-emerald-400 text-emerald-900 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-slate-700">Explanation for Processor</label>
                <textarea
                  rows={3}
                  value={declineReasonInput}
                  onChange={(e) => setDeclineReasonInput(e.target.value)}
                  placeholder="Provide context for declining..."
                  className="flex w-full rounded-xl border border-emerald-200 bg-white p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeclineModalRequest(null)}
                  className="flex-1 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleRespondToRequest(declineModalRequest.id, "DECLINE", declineReasonInput)}
                  className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                >
                  Confirm Decline
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    )
  }

  // ==========================================
  // TAB 3: FLEET & IN-TRANSIT TRACKING
  // ==========================================
  const FleetTab = () => {
    const activeRequests = deliveryRequests.filter(
      (r) => r.status === "IN_TRANSIT" || r.status === "ARRIVED_AT_RETAILER"
    )
    const completedRequests = deliveryRequests.filter(
      (r) => r.status === "COMPLETED" || r.status === "DELIVERED"
    )

    // Merge active requests with any local in-transit inventory item
    const inTransitBatches = [
      ...activeRequests.map((r) => ({
        id: r.id,
        name: r.product_name,
        batch_number: r.batch_number,
        quantity: r.quantity,
        unit: r.unit || "kg",
        product_id: r.product_id,
        status: r.status === "ARRIVED_AT_RETAILER" ? "Arrived at Store" : "In Transit",
        isArrivedAtStore: r.status === "ARRIVED_AT_RETAILER",
        request: r
      })),
      ...inventory
        .filter((i) => i.status === "In Transit" && !activeRequests.some((r) => r.batch_number === i.batch_number))
        .map((i) => ({
          ...i,
          isArrivedAtStore: false,
          request: deliveryRequests.find((r) => r.batch_number === i.batch_number)
        }))
    ]

    const readyAtProcessors = allProducts.filter(
      (p) => p.status === "Processed" || p.status === "Processed - Grade A"
    )

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* FLEET CONTROLS & REFRESH */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 pb-3">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-emerald-950">
              <Truck className="h-5 w-5 text-emerald-600" />
              Fleet Transit & Custody Operations
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Live cargo transport runs, store delivery handoffs, and confirmed completed trips.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                fetchDeliveryRequests(false)
                fetchInventory()
              }}
              disabled={loadingRequests}
              className="rounded-full text-xs h-8 px-3.5 gap-1.5 cursor-pointer shadow-xs border-emerald-200 text-slate-700 hover:bg-emerald-50 font-semibold"
            >
              <RefreshCw className={`h-3 w-3 ${loadingRequests ? "animate-spin text-emerald-600" : ""}`} />
              Refresh Fleet Status
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ACTIVE IN-TRANSIT TABLE (White & Green) */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div>
                <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-emerald-600" />
                  Active In-Transit Cargo
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Produce currently loaded in your fleet. Hand off to retailer upon arrival.
                </p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                inTransitBatches.length > 0
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {inTransitBatches.length} Live Loads
              </span>
            </div>

            {inTransitBatches.length === 0 ? (
              <div className="py-10 text-center text-slate-500 space-y-2.5">
                {completedRequests.length > 0 ? (
                  <>
                    <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200 shadow-inner">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <p className="text-base font-bold text-slate-900">All Assigned Cargo Delivered & Accepted!</p>
                    <p className="text-xs max-w-sm mx-auto text-slate-600">
                      All your deliveries have arrived at retail stores and have been accepted. Your vehicle is available for new trips.
                    </p>
                  </>
                ) : (
                  <>
                    <Truck className="h-10 w-10 mx-auto text-emerald-300" />
                    <p className="text-sm font-semibold">No cargo currently in transit.</p>
                    <p className="text-xs max-w-sm mx-auto text-slate-600">
                      Accept an incoming processor dispatch manifest or scan a batch QR code in the "Smart Handoff" dock.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {inTransitBatches.map((item) => {
                  const matchingReq = item.request || deliveryRequests.find((r) => r.batch_number === item.batch_number || r.product_id === item.product_id)
                  const isDockedAtStore = item.isArrivedAtStore || matchingReq?.status === "ARRIVED_AT_RETAILER"

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isDockedAtStore
                          ? "border-purple-300 bg-purple-50/40"
                          : "border-emerald-200 bg-emerald-50/40"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-base">{item.name}</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300">
                            {item.batch_number}
                          </span>
                          {isDockedAtStore && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 animate-pulse">
                              <Store className="h-3 w-3" /> Docked at Retailer — QR Ready
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">
                          Cargo Load: <strong>{item.quantity} {item.unit || "kg"}</strong> • Destination: <span className="font-semibold text-slate-800">{matchingReq?.retailer?.destination_store || "Retail Store"}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMapRequest(
                              matchingReq || {
                                batch_number: item.batch_number,
                                product_name: item.name,
                                quantity: item.quantity,
                                unit: item.unit || "kg",
                                processor: {
                                  facility_name: "Agro-Processing Facility",
                                  facility_location: "Agro-Processing Unit #4, Yeshwanthpur APMC Yard, Bengaluru 560022"
                                },
                                retailer: {
                                  destination_store: "Metro Fresh Mart Koramangala",
                                  store_location: "Metro Fresh Supermarket, 80 Feet Road, 4th Block, Koramangala, Bengaluru 560034"
                                }
                              }
                            )
                          }}
                          className="rounded-xl text-xs gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-100 cursor-pointer font-bold"
                        >
                          <Navigation className="h-3.5 w-3.5 text-emerald-600" />
                          Route Map
                        </Button>

                        {isDockedAtStore ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (matchingReq) {
                                setDeliveryQrModal({
                                  isOpen: true,
                                  loading: false,
                                  req: matchingReq,
                                  qrToken: matchingReq.delivery_qr_token || `DLV_${matchingReq.id}`,
                                  qrData: matchingReq.delivery_qr_data || {}
                                })
                              } else {
                                setDeliveryModalItem(item)
                              }
                            }}
                            className="rounded-xl text-xs gap-1 bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer shadow-xs"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            Show Delivery QR
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (matchingReq) {
                                handleGenerateDeliveryQR(matchingReq)
                              } else {
                                setDeliveryModalItem(item)
                              }
                            }}
                            className="rounded-xl text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-xs"
                          >
                            <Store className="h-3.5 w-3.5" />
                            Deliver to Store
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* FLEET DIAGNOSTICS CARD (White & Green) */}
          <div className="p-6 rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-600" />
              Delivery Fleet Telemetry
            </h4>
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-150 flex justify-between items-center">
                <span className="text-slate-600">Transit Status</span>
                <span className="font-bold text-emerald-800 font-mono text-sm">
                  {inTransitBatches.length > 0
                    ? `Active On Route (${inTransitBatches.length} Load${inTransitBatches.length > 1 ? "s" : ""})`
                    : completedRequests.length > 0
                    ? "All Trips Completed • Available"
                    : "Available for Trip"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-150 flex justify-between items-center">
                <span className="text-slate-600">Engine Telematics</span>
                <span className="font-bold text-emerald-700 font-mono text-sm">
                  {inTransitBatches.length > 0 ? "Operational (Zone 1)" : "Docked / Standby"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-150 flex justify-between items-center">
                <span className="text-slate-600">GPS Tracker Status</span>
                <span className="font-bold text-emerald-700 text-xs">Active (12 Satellites)</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-100/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>All transport logs satisfy FSSAI & digital blockchain traceability standards.</span>
            </div>
          </div>
        </div>

        {/* DELIVERED & COMPLETED ORDERS (Certified by Retailer) */}
        {completedRequests.length > 0 && (
          <div className="p-6 rounded-3xl bg-white border border-emerald-300 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
              <div>
                <h4 className="font-bold text-base text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Delivered & Completed Cargo (Signed Off by Retailer)
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Consignments accepted and digitally verified by destination stores. Distributor role is completed!
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300 self-start sm:self-center">
                {completedRequests.length} Order{completedRequests.length > 1 ? "s" : ""} Completed
              </span>
            </div>

            <div className="grid gap-3">
              {completedRequests.map((item) => {
                const destStoreName = item.retailer?.destination_store || item.retailer?.name || "Retail Supermarket"
                const destStoreAddr = item.retailer?.store_location || item.retailer?.address || ""
                const verifiedTime = item.delivery_verified_at || item.created_at

                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-black text-slate-900 text-base flex items-center gap-1.5">
                          {item.product_name?.includes("Tomato")
                            ? "🍅"
                            : item.product_name?.includes("Mango")
                            ? "🥭"
                            : item.product_name?.includes("Apple")
                            ? "🍎"
                            : "📦"}{" "}
                          {item.product_name}
                        </span>
                        <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                          Batch: {item.batch_number}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                          <CheckCircle2 className="h-3 w-3" /> Retailer Accepted & Verified
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <p>
                          Delivered Cargo: <strong className="text-slate-900">{item.quantity} {item.unit || "kg"}</strong> • Tracking: <span className="font-mono">#{item.tracking_id || item.id?.slice(0, 8)}</span>
                        </p>
                        <p className="flex items-center gap-1 text-emerald-900 font-medium">
                          <Store className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          Handed off to: <strong>{destStoreName}</strong>
                          {destStoreAddr && <span className="text-slate-500 truncate max-w-md">({destStoreAddr})</span>}
                        </p>
                        {verifiedTime && (
                          <p className="text-[11px] text-slate-500">
                            Completed on: {new Date(verifiedTime).toLocaleDateString()} at {new Date(verifiedTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end gap-2 shrink-0">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Distributor Role Completed
                      </span>
                      {item.blockchain_hash ? (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${item.blockchain_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline font-mono flex items-center gap-1"
                        >
                          Sepolia Hash: {item.blockchain_hash.slice(0, 10)}... <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">
                          Cryptographic Receipt Verified
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* READY AT PROCESSING PLANTS */}
        <div className="p-6 rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
            <div>
              <h4 className="font-bold text-base text-slate-900">
                Produce Waiting at Processing Facilities
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Graded and inspected lots ready for distribution.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
              {readyAtProcessors.length} Available
            </span>
          </div>

          {readyAtProcessors.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No batches waiting at processing facilities. Graded crops will appear here automatically.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-emerald-100 text-slate-600 text-left bg-emerald-50/50">
                    <th className="py-2.5 px-3">Batch</th>
                    <th className="py-2.5 px-3">Produce</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Quality Score</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {readyAtProcessors.map((p) => (
                    <tr key={p.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{p.batch_number}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-3 px-3">{p.quantity} kg</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {p.ai_quality_label || "Grade A"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          disabled={handoffLoading}
                          onClick={() => handleTakeCustody(p)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer"
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          Take Custody
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // TAB 4: CARGO INVENTORY & MANIFEST
  // ==========================================
  const InventoryTab = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
            <div>
              <h4 className="font-bold text-base text-slate-900">Distributor Custody Manifest</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Historical record of all cargo batches transferred through your fleet.
              </p>
            </div>
            <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
              {inventory.length} Records
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading cargo database...</div>
          ) : inventory.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No cargo recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-emerald-100 text-slate-600 text-left bg-emerald-50/50">
                    <th className="py-2.5 px-3">Batch & Token</th>
                    <th className="py-2.5 px-3">Crop Name</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3 text-right">Custody Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-slate-900">{item.batch_number}</div>
                        <div className="text-[10px] text-slate-500 font-mono">On-Chain #{item.product_id || "N/A"}</div>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">{item.name}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{item.quantity} kg</td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            item.status === "At Retailer" || item.status === "Delivered"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-blue-100 text-blue-800 border border-blue-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* BATCH CONSOLIDATION & SUB-LOT SPLITTING */}
        <div className="p-6 rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-4">
          <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <SplitSquareHorizontal className="h-4 w-4 text-emerald-700" />
            Consignment Allocation
          </h4>
          <p className="text-xs text-slate-600">
            Split high-volume processor pallets into smaller retail crate distributions.
          </p>
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Select Parent Batch</label>
              <select className="w-full p-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900">
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.batch_number} ({item.name}) - {item.quantity} kg
                  </option>
                ))}
                {inventory.length === 0 && <option>No inventory loaded</option>}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Sub-Consignments</label>
              <input
                type="number"
                defaultValue={2}
                min={2}
                max={10}
                className="w-full p-2.5 rounded-xl border border-emerald-200 bg-white text-slate-900"
              />
            </div>
            <Button className="w-full rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer mt-2 shadow-xs">
              <SplitSquareHorizontal className="mr-1.5 h-4 w-4" />
              Generate Split QR Labels
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  // ==========================================
  // TAB 5: SMART QR HANDOFF & BLOCKCHAIN CUSTODY
  // ==========================================
  const BlockchainTab = () => (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="p-8 rounded-3xl bg-white border border-emerald-200 shadow-sm text-center space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-900">Cryptographic Custody Handoff</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
            Scan a batch QR code from a Farmer or Processor to transfer cryptographic custody to your fleet on Ethereum Sepolia.
          </p>
        </div>

        {/* SCANNER CONTROLS */}
        <div className="p-6 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 flex flex-col items-center justify-center space-y-4">
          <QrCode className="h-10 w-10 text-emerald-600 animate-pulse" />
          <p className="text-xs text-slate-600">Scan via camera viewfinder or upload an image file</p>
          <div className="flex gap-3 w-full max-w-xs">
            <Button
              type="button"
              onClick={() => {
                setShowScanner(true)
                startLiveCamera()
              }}
              className="flex-1 rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-sm"
            >
              <Camera className="h-4 w-4" />
              Open Camera
            </Button>
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleQrFileUpload} />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-xl text-xs gap-1.5 border-emerald-200 text-slate-700 hover:bg-emerald-50 cursor-pointer"
            >
              <Upload className="h-4 w-4 text-emerald-600" />
              Upload Image
            </Button>
          </div>
        </div>

        {/* SCANNED BATCH PREVIEW CARD */}
        {scannedBatchPreview && (
          <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-300 text-left space-y-3 animate-in fade-in">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  Batch Verified
                </span>
                <h4 className="text-lg font-bold text-slate-900 mt-1.5">{scannedBatchPreview.name}</h4>
                <p className="text-xs text-slate-600 font-mono">
                  Batch: {scannedBatchPreview.batch_number} • On-Chain ID: #{scannedBatchPreview.product_id}
                </p>
              </div>
              <button
                onClick={() => setScannedBatchPreview(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-emerald-200">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Weight:</span>
                <span className="font-bold text-slate-900 text-sm">{scannedBatchPreview.quantity} kg</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-emerald-200">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Status:</span>
                <span className="font-bold text-emerald-700 text-sm">{scannedBatchPreview.status}</span>
              </div>
            </div>

            <Button
              onClick={() => handleTakeCustody(scannedBatchPreview)}
              disabled={handoffLoading}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 cursor-pointer shadow-sm"
            >
              {handoffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Sign Custody & Broadcast to Sepolia
            </Button>
          </div>
        )}

        {/* SUCCESS / ERROR ALERTS */}
        {handoffSuccess && (
          <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-2xl text-xs space-y-1.5 text-left">
            <p className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {handoffSuccess}
            </p>
            {handoffTxHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${handoffTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline font-mono text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold"
              >
                View Sepolia Block Explorer ↗
              </a>
            )}
          </div>
        )}

        {handoffError && (
          <div className="p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl text-xs text-left">
            {handoffError}
          </div>
        )}

        {/* MANUAL INPUT */}
        <div className="pt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={handoffId}
              onChange={(e) => setHandoffId(e.target.value)}
              placeholder="Or enter batch number manually (e.g. BCH-APPLE-950801)"
              className="flex h-11 w-full rounded-xl border border-emerald-200 bg-white px-4 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Button
              onClick={() => previewBatchDetails(handoffId)}
              disabled={!handoffId || handoffLoading}
              className="h-11 px-5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
            >
              {handoffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  // ==========================================
  // ROOT COMPONENT RENDER (WHITE & GREEN THEME)
  // ==========================================
  return (
    <div className="space-y-7">
      {/* LUMINOUS WHITE & GREEN COMMAND BAR */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50/70 border border-emerald-200 shadow-sm p-4 sm:p-7">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                <Truck className="h-3.5 w-3.5 text-emerald-600" /> Distributor Logistics Command
              </span>
              <span className="text-xs text-slate-600 font-mono">
                Operator: <strong className="text-emerald-950 font-bold">{user?.name || "Logistics Fleet"}</strong>
              </span>
              <button
                onClick={() => handleTabSwitch("profile")}
                className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 transition-all shadow-xs cursor-pointer"
                title="View & Edit Verified Depot Profile"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Fleet Profile
              </button>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900">
              Fleet Operations & Distribution
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
              Real-time crop transit logistics, GPS turn-by-turn routing, and Sepolia blockchain custody handoffs.
            </p>
          </div>

          {/* DRIVER AVAILABILITY SEGMENTED TOGGLE (White & Green) */}
          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Fleet Trip Availability:
            </div>
            <div className="flex items-center p-1 bg-white border border-emerald-200 rounded-2xl shadow-xs flex-wrap">
              {[
                { id: "Available for Trip", label: "Available", dot: "bg-emerald-500", activeClass: "bg-emerald-600 text-white shadow-xs" },
                { id: "On Route", label: "On Route", dot: "bg-amber-500", activeClass: "bg-amber-500 text-white shadow-xs" },
                { id: "Unavailable", label: "Off Duty", dot: "bg-slate-400", activeClass: "bg-slate-200 text-slate-800 shadow-xs" }
              ].map((opt) => {
                const isSelected = (user?.availability_status || "Available for Trip") === opt.id
                return (
                  <button
                    key={opt.id}
                    disabled={statusLoading}
                    onClick={() => updateStatus(opt.id)}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? opt.activeClass
                        : "text-slate-600 hover:text-emerald-800"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${opt.dot} ${isSelected ? "animate-pulse" : ""}`} />
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {statusSuccess && (
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Status synced with dispatchers
              </span>
            )}
          </div>
        </div>
      </div>

      {/* QUICK MOBILE TAB PILL BAR (Hidden on desktop md:) */}
      <div className="md:hidden flex overflow-x-auto gap-2 -mt-2 pb-1 no-scrollbar">
        {[
          { id: "overview", label: "Overview", icon: Sparkles },
          { id: "requests", label: `Requests (${deliveryRequests.filter(r => r.status === "REQUESTED").length})`, icon: Clock },
          { id: "fleet", label: `Fleet (${deliveryRequests.filter(r => r.status === "IN_TRANSIT" || r.status === "ARRIVED_AT_RETAILER").length})`, icon: Truck },
          { id: "inventory", label: "Cargo", icon: Package },
          { id: "blockchain", label: "Smart Handoff", icon: QrCode },
          { id: "profile", label: "Profile", icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isActive
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ACTIVE TAB CONTENT VIEW */}
      <div>
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "profile" && <ProfileManagementSection role="distributor" />}
        {activeTab === "requests" && <RequestsTab />}
        {activeTab === "fleet" && <FleetTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "blockchain" && <BlockchainTab />}
      </div>

      {/* LIVE CAMERA QR SCANNER MODAL (White & Green) */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-sm w-full rounded-3xl border border-emerald-200 shadow-2xl p-6 bg-white text-slate-900 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-emerald-800">
                <Camera className="h-5 w-5 text-emerald-600" />
                Scan Batch QR Code
              </h3>
              <button
                onClick={() => {
                  stopLiveCamera()
                  setShowScanner(false)
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative w-full aspect-square rounded-2xl border-2 border-dashed border-emerald-200 bg-slate-50 overflow-hidden flex items-center justify-center">
              <div id="distributor-qr-reader" className="w-full h-full" />
              {cameraActive && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-pulse top-1/2 z-20" />
              )}
            </div>

            {scannerError && <p className="text-xs text-rose-600">{scannerError}</p>}

            <Button
              onClick={() => {
                stopLiveCamera()
                setShowScanner(false)
              }}
              variant="outline"
              className="w-full rounded-xl text-xs border-slate-300 text-slate-700 cursor-pointer hover:bg-slate-100"
            >
              Cancel
            </Button>
          </Card>
        </div>
      )}

      {/* RETAILER STORE DELIVERY COMPLETION MODAL (White & Green) */}
      {deliveryModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full rounded-3xl border border-emerald-200 shadow-2xl p-6 bg-white text-slate-900 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Complete Retail Delivery</h3>
                  <p className="text-xs text-slate-500 font-mono">Batch: {deliveryModalItem.batch_number}</p>
                </div>
              </div>
              <button
                onClick={() => setDeliveryModalItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-2xl space-y-1.5 text-xs border border-emerald-200">
              <div className="flex justify-between">
                <span className="text-slate-600">Product:</span>
                <span className="font-bold text-slate-900">{deliveryModalItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Quantity to Hand Off:</span>
                <span className="font-bold text-slate-900">{deliveryModalItem.quantity} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">On-Chain Product ID:</span>
                <span className="font-mono text-emerald-700 font-bold">#{deliveryModalItem.product_id || "N/A"}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Destination Retailer Store</label>
                <select
                  value={destinationStore}
                  onChange={(e) => setDestinationStore(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Metro Fresh Mart (Koramangala Store #104)">Metro Fresh Mart (Koramangala Store #104)</option>
                  <option value="Nature's Basket (Indiranagar Store #12)">Nature's Basket (Indiranagar Store #12)</option>
                  <option value="Reliance Fresh (Whitefield Hub)">Reliance Fresh (Whitefield Hub)</option>
                  <option value="FreshToHome Local Outlet #3">FreshToHome Local Outlet #3</option>
                  <option value="Authorized Retail Supermarket">Authorized Retail Supermarket</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Delivery Receipt Notes</label>
                <textarea
                  rows={2}
                  value={deliveryRemarks}
                  onChange={(e) => setDeliveryRemarks(e.target.value)}
                  placeholder="e.g. Produce verified intact; intake acknowledged by store receiver"
                  className="flex w-full rounded-xl border border-emerald-200 bg-white p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {deliverySuccessTx && (
              <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600" /> Store Delivery Recorded on Sepolia!
                </p>
                <p className="text-[11px] text-slate-600">Status transitioned to "At Retailer" on-chain.</p>
              </div>
            )}

            {deliveryError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs">
                {deliveryError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setDeliveryModalItem(null)}
                className="flex-1 rounded-xl text-xs cursor-pointer border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCompleteDelivery}
                disabled={deliveryLoading || Boolean(deliverySuccessTx)}
                className="flex-1 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 cursor-pointer shadow-sm"
              >
                {deliveryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm & Sign on Blockchain
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* PICKUP QR SCAN & PHYSICAL INSPECTION MODAL (Processor Handover) */}
      {pickupVerifyModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-xl w-full rounded-3xl border border-emerald-200 shadow-2xl p-6 bg-white text-slate-900 space-y-5 my-8 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {pickupVerifyModal.step === "scan"
                      ? "Scan Processor Pickup QR"
                      : pickupVerifyModal.step === "inspect"
                      ? "Verify Dispatch Details & Inspect Cargo"
                      : "Cargo Custody Confirmed!"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Batch #{pickupVerifyModal.req?.batch_number} • {pickupVerifyModal.req?.product_name}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClosePickupModal}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* STEP 1: SCAN QR CODE */}
            {pickupVerifyModal.step === "scan" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Scan the official blockchain pickup QR code displayed on the Processor's terminal to verify this batch before loading and taking physical custody.
                </p>

                {/* Primary Optical Scanner Controls */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={isPickupCameraActive ? stopPickupCamera : startPickupCamera}
                    className={`rounded-xl text-xs font-bold gap-2 py-2.5 transition-all shadow-sm ${
                      isPickupCameraActive
                        ? "bg-rose-600 hover:bg-rose-500 text-white"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    }`}
                  >
                    <Camera className="h-4 w-4" />
                    {isPickupCameraActive ? "Stop Camera" : "Open Live Camera Scanner"}
                  </Button>

                  <input
                    type="file"
                    ref={pickupFileInputRef}
                    onChange={handlePickupQrFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => pickupFileInputRef.current?.click()}
                    className="rounded-xl text-xs font-bold gap-2 py-2.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 bg-emerald-50/50"
                  >
                    <Upload className="h-4 w-4" />
                    Upload QR Image
                  </Button>
                </div>

                {/* Optical Viewfinder Box */}
                {isPickupCameraActive ? (
                  <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500 bg-black aspect-video max-h-60 flex flex-col items-center justify-center shadow-lg">
                    <div id="pickup-modal-qr-reader" className="w-full h-full" />
                    {/* Targeting reticle overlay */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-44 h-44 border-2 border-emerald-400/70 rounded-2xl relative shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl -mt-1 -ml-1"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr -mt-1 -mr-1"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl -mb-1 -ml-1"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br -mb-1 -mr-1"></div>
                        <div className="w-full h-0.5 bg-emerald-400/90 shadow-[0_0_8px_#10b981] absolute top-1/2 -translate-y-1/2 animate-pulse"></div>
                      </div>
                    </div>
                    <div className="absolute bottom-2.5 left-0 right-0 text-center pointer-events-none">
                      <span className="text-[11px] font-semibold bg-black/75 text-emerald-300 px-3 py-1 rounded-full backdrop-blur-sm">
                        Align Processor's Pickup QR inside the box
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div className="text-xs font-semibold text-emerald-950">
                      Live Optical Camera & File Scanner Ready
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Scan the QR code shown on the Processor's screen. The system validates token authenticity and verifies that the QR belongs to Batch #{pickupVerifyModal.req?.batch_number}.
                    </p>
                  </div>
                )}

                {/* Camera / Decoding Error */}
                {pickupCameraError && (
                  <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>{pickupCameraError}</span>
                  </div>
                )}

                {/* Verification / Mismatch Error */}
                {pickupVerifyModal.error && (
                  <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-bold">QR Verification Rejected</div>
                      <div>{pickupVerifyModal.error}</div>
                    </div>
                  </div>
                )}

                {/* Manual Input or Quick Fill (Secondary Fallback) */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Or Enter Dispatch Token Manually
                    </label>
                    {(pickupVerifyModal.req?.pickup_token || pickupVerifyModal.req?.pickup_qr_token) && (
                      <button
                        type="button"
                        onClick={() =>
                          setPickupVerifyModal((prev) => ({
                            ...prev!,
                            manualTokenInput:
                              pickupVerifyModal.req.pickup_token ||
                              pickupVerifyModal.req.pickup_qr_token
                          }))
                        }
                        className="text-[11px] font-mono underline font-bold text-emerald-700 hover:text-emerald-900"
                      >
                        Auto-fill Expected Token
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pickupVerifyModal.manualTokenInput || ""}
                      onChange={(e) =>
                        setPickupVerifyModal((prev) => ({
                          ...prev!,
                          manualTokenInput: e.target.value
                        }))
                      }
                      placeholder="PKP_... or scan with camera above"
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <Button
                      type="button"
                      onClick={() =>
                        handleVerifyScannedToken(
                          pickupVerifyModal.manualTokenInput ||
                            pickupVerifyModal.req?.pickup_token ||
                            pickupVerifyModal.req?.pickup_qr_token ||
                            pickupVerifyModal.req?.batch_number ||
                            `PKP_${pickupVerifyModal.req?.id}`
                        )
                      }
                      disabled={pickupVerifyModal.loading}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold px-4"
                    >
                      {pickupVerifyModal.loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Verify Token"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Origin Facility Summary */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-700 block">Origin Loading Facility:</span>
                    <span>{pickupVerifyModal.req?.processor?.facility_name || "Agro-Processing Facility"}</span>
                    <div className="text-[11px] text-slate-500">{pickupVerifyModal.req?.processor?.facility_location}</div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-500">
                    <div>Batch #{pickupVerifyModal.req?.batch_number}</div>
                    <div className="text-emerald-700 font-bold">{pickupVerifyModal.req?.quantity} {pickupVerifyModal.req?.unit || "kg"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: VERIFY DETAILS & PHYSICAL CARGO INSPECTION */}
            {pickupVerifyModal.step === "inspect" && (() => {
              const manifestWeight = Number(pickupVerifyModal.verifiedData?.product?.quantity || pickupVerifyModal.req?.quantity || 200)
              const verifiedWeightNum = Number(inspectionVerifiedWeight) || manifestWeight
              const weightVariance = Math.round((verifiedWeightNum - manifestWeight) * 100) / 100
              const hasWeightDiscrepancy = Math.abs(weightVariance) > 0.001
              const rawQuality = pickupVerifyModal.verifiedData?.product?.quality_label || pickupVerifyModal.req?.product?.quality_label
              const score = pickupVerifyModal.verifiedData?.product?.quality_score || 94
              const displayQuality = (rawQuality && rawQuality.toUpperCase() !== "UNKNOWN")
                ? rawQuality
                : (score >= 85 ? "Grade A" : "Grade B")

              const presetRemarks = [
                "✓ Crates & tamper seals intact",
                "⚠️ Scale weight variance noted at dock",
                "❄️ Pre-cooling SLA compliant (chilled)",
                "📦 Certified crate count matched",
                "📝 Dock tare weight accounted for"
              ]

              const appendRemark = (chip: string) => {
                const current = (inspectionRemarks || "").trim()
                if (!current) {
                  setInspectionRemarks(chip)
                  setInspectionNotes(chip)
                } else if (!current.includes(chip)) {
                  const updated = `${current} | ${chip}`
                  setInspectionRemarks(updated)
                  setInspectionNotes(updated)
                }
              }

              return (
                <div className="space-y-4">
                  {/* Authenticated Confirmation Banner */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs space-y-1">
                    <div className="font-bold text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Pickup QR Authenticated • Match Confirmed</span>
                      <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Sepolia On-Chain Validated
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Dispatch authorization verified for Batch #{pickupVerifyModal.verifiedData?.batch_number || pickupVerifyModal.req?.batch_number}. Please inspect the physical items and verify information below.
                    </p>
                  </div>

                  {/* Product & Quality Manifest */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                      <span>Produce & Quality Manifest</span>
                      <span className="font-mono text-emerald-700 font-bold">
                        Batch #{pickupVerifyModal.verifiedData?.batch_number || pickupVerifyModal.req?.batch_number}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Commodity</div>
                        <div className="font-bold text-slate-900 truncate">
                          {pickupVerifyModal.verifiedData?.product?.name || pickupVerifyModal.req?.product_name}
                        </div>
                        <div className="text-[10px] text-slate-500">{pickupVerifyModal.verifiedData?.product?.category || "Perishables"}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Manifest Weight</div>
                        <div className="font-bold text-slate-900 font-mono text-emerald-700">
                          {manifestWeight} {inspectionWeightUnit}
                        </div>
                        <div className="text-[10px] text-slate-500">Facility Documented</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">AI Quality</div>
                        <div className="font-bold text-emerald-700">
                          {displayQuality}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {score}% AI Score
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Cold Chain SLA</div>
                        <div className="font-bold text-slate-900">2°C – 6°C</div>
                        <div className="text-[10px] text-slate-500">Precision Chilled</div>
                      </div>
                    </div>
                  </div>

                  {/* DOCK SCALE WEIGHT VERIFICATION & CARGO ADJUSTMENT */}
                  <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                          <Scale className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>Dock Scale Weight Verification</span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Distributor Custody Check
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Cross-check actual platform scale weight against the manifest. Update if any tare variance or discrepancy exists.
                          </p>
                        </div>
                      </div>
                      {hasWeightDiscrepancy && (
                        <button
                          type="button"
                          onClick={() => setInspectionVerifiedWeight(manifestWeight)}
                          className="text-[10px] text-slate-500 hover:text-emerald-700 underline font-medium cursor-pointer"
                        >
                          Reset to Manifest
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Manifest Reference Card */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Origin Manifest Weight</div>
                        <div className="text-base font-bold font-mono text-slate-800">
                          {manifestWeight} <span className="text-xs font-normal text-slate-500">{inspectionWeightUnit}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Recorded by Processor facility</div>
                      </div>

                      {/* Weighed Quantity Input */}
                      <div className="p-2.5 rounded-xl bg-emerald-50/40 border border-emerald-300 text-xs space-y-1">
                        <label className="text-[10px] uppercase font-bold text-emerald-900 block">
                          Actual Weighed Quantity (Scale Reading) *
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={inspectionVerifiedWeight}
                            onChange={(e) => setInspectionVerifiedWeight(e.target.value)}
                            placeholder={String(manifestWeight)}
                            className="flex-1 px-3 py-1.5 text-sm font-bold font-mono bg-white border border-emerald-400 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <select
                            value={inspectionWeightUnit}
                            onChange={(e) => setInspectionWeightUnit(e.target.value)}
                            className="px-2 py-1.5 text-xs font-semibold bg-white border border-emerald-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="kg">kg</option>
                            <option value="crates">crates</option>
                            <option value="boxes">boxes</option>
                            <option value="tons">tons</option>
                            <option value="units">units</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Live Discrepancy Status Indicator */}
                    {hasWeightDiscrepancy ? (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="font-bold flex items-center gap-1.5">
                            <span>Weight Variance Detected:</span>
                            <span className="font-mono px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-950 font-black">
                              {weightVariance > 0 ? `+${weightVariance}` : weightVariance} {inspectionWeightUnit}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            Verified loading weight ({verifiedWeightNum} {inspectionWeightUnit}) will update the transit manifest, be immutably recorded on blockchain, and notified to Retailer prior to departure.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[11px] font-medium">
                          Scale weight perfectly matches the manifest ({manifestWeight} {inspectionWeightUnit}, 0 variance).
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Facility & Route Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Origin Facility (Pickup)</div>
                      <div className="font-bold text-slate-900">
                        {pickupVerifyModal.verifiedData?.processor?.facility_name || pickupVerifyModal.req?.processor?.facility_name || "Agro-Processing Facility"}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {pickupVerifyModal.verifiedData?.processor?.address || pickupVerifyModal.req?.processor?.facility_location}
                      </div>
                      {pickupVerifyModal.verifiedData?.processor?.license_number && (
                        <div className="text-[10px] font-mono text-emerald-700 font-semibold">
                          License: {pickupVerifyModal.verifiedData.processor.license_number}
                        </div>
                      )}
                    </div>
                    <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Destination Retailer (Delivery)</div>
                      <div className="font-bold text-slate-900">
                        {pickupVerifyModal.verifiedData?.retailer?.store_name || pickupVerifyModal.req?.retailer?.destination_store || "Retail Supermarket"}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {pickupVerifyModal.verifiedData?.retailer?.address || pickupVerifyModal.req?.retailer?.destination_address || "Retail Receiving Dock"}
                      </div>
                      <div className="text-[10px] text-slate-500">Delivery Route SLA: Express Dispatch</div>
                    </div>
                  </div>

                  {/* 1. PHYSICAL CARGO CHECKLIST */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      1. Physical Verification Checklist
                    </label>
                    <div className="space-y-2 text-xs">
                      <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={inspectionCheckboxes.cratesIntact}
                          onChange={(e) =>
                            setInspectionCheckboxes((prev) => ({ ...prev, cratesIntact: e.target.checked }))
                          }
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-medium text-slate-800">Physical crates, packaging, and produce seals intact</span>
                      </label>
                      <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={inspectionCheckboxes.quantityMatched}
                          onChange={(e) =>
                            setInspectionCheckboxes((prev) => ({ ...prev, quantityMatched: e.target.checked }))
                          }
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-medium text-slate-800">
                          Net crate count & scale weight verified (Actual: {verifiedWeightNum} {inspectionWeightUnit}
                          {hasWeightDiscrepancy && (
                            <span className={weightVariance < 0 ? "text-amber-700 font-bold ml-1" : "text-emerald-700 font-bold ml-1"}>
                              [{weightVariance > 0 ? `+${weightVariance}` : weightVariance} {inspectionWeightUnit} variance]
                            </span>
                          )})
                        </span>
                      </label>
                      <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={inspectionCheckboxes.tempCompliant}
                          onChange={(e) =>
                            setInspectionCheckboxes((prev) => ({ ...prev, tempCompliant: e.target.checked }))
                          }
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-medium text-slate-800">Pre-cooling temperature meets SLA (Chilled)</span>
                      </label>
                    </div>
                  </div>

                  {/* 2. DRIVER & VEHICLE REGISTRATION INPUTS */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      2. Assigned Driver & Vehicle Registration
                    </label>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Driver Name</span>
                        <input
                          type="text"
                          value={inspectionDriverName}
                          onChange={(e) => setInspectionDriverName(e.target.value)}
                          placeholder="Driver Name"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Driver Phone</span>
                        <input
                          type="text"
                          value={inspectionDriverPhone}
                          onChange={(e) => setInspectionDriverPhone(e.target.value)}
                          placeholder="Phone Number"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Vehicle Registration # *</span>
                        <input
                          type="text"
                          value={inspectionVehicleNumber}
                          onChange={(e) => setInspectionVehicleNumber(e.target.value)}
                          placeholder="e.g. KA-04-E-2941"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase font-bold focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Departure Temp (°C)</span>
                        <input
                          type="text"
                          value={inspectionDepartureTemp}
                          onChange={(e) => setInspectionDepartureTemp(e.target.value)}
                          placeholder="e.g. 3.8°C"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. INSPECTION REMARKS & OBSERVATIONS SECTION */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        3. Remarks & Discrepancy Observations
                      </label>
                      <span className="text-[11px] text-slate-400">Recorded on manifest & sent to Retailer</span>
                    </div>

                    {/* Quick Preset Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {presetRemarks.map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => appendRemark(chip)}
                          className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={3}
                      value={inspectionRemarks}
                      onChange={(e) => {
                        setInspectionRemarks(e.target.value)
                        setInspectionNotes(e.target.value)
                      }}
                      placeholder="Add inspection observations, seal numbers, scale tare notes, or reasons for weight mismatch..."
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs bg-white resize-none text-slate-800 leading-relaxed"
                    />
                  </div>

                  <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-900 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-600 mt-0.5" />
                    <span>
                      Upon custody handover confirmation, verified quantity ({verifiedWeightNum} {inspectionWeightUnit}), remarks, and driver/vehicle details are cryptographically dispatched to Retailer prior to departure.
                    </span>
                  </div>

                  {pickupVerifyModal.error && (
                    <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs">
                      {pickupVerifyModal.error}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setPickupVerifyModal((prev) => ({ ...prev!, step: "scan" }))
                      }
                      className="flex-1 rounded-xl text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                      Back to Scan
                    </Button>
                    <Button
                      disabled={
                        pickupVerifyModal.loading ||
                        !inspectionCheckboxes.cratesIntact ||
                        !inspectionCheckboxes.quantityMatched ||
                        !inspectionVehicleNumber.trim()
                      }
                      onClick={handleConfirmPickupTakeCustody}
                      className="flex-1 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 cursor-pointer shadow-sm"
                    >
                      {pickupVerifyModal.loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Truck className="h-4 w-4" />
                      )}
                      Approve Pickup & Take Custody
                    </Button>
                  </div>
                </div>
              )
            })()}

            {/* STEP 3: SUCCESS */}
            {pickupVerifyModal.step === "success" && (
              <div className="space-y-4 text-center py-4">
                <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-slate-900">Cargo Custody Authorized!</h4>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto">
                    You have taken custody of Batch #{pickupVerifyModal.req?.batch_number}. Complete produce manifest and your vehicle ({inspectionVehicleNumber}) have been dispatched to Retailer {pickupVerifyModal.req?.retailer?.destination_store || "Store"}.
                  </p>
                </div>

                {pickupVerifyModal.txHash && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Sepolia Blockchain Hash</span>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${pickupVerifyModal.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 underline hover:text-emerald-900 inline-flex items-center gap-1"
                    >
                      <span className="truncate max-w-[280px]">{pickupVerifyModal.txHash}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                )}

                <Button
                  onClick={() => {
                    handleClosePickupModal()
                    handleTabSwitch("fleet")
                  }}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  View Active Trip & GPS Navigation
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* DELIVERY HANDOFF QR MODAL (Retailer Store Dock) */}
      {deliveryQrModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-md w-full rounded-3xl border border-purple-200 shadow-2xl p-6 bg-white text-slate-900 space-y-5 my-8 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Retailer Dock Delivery Handoff</h3>
                  <p className="text-xs text-slate-500">
                    Batch #{deliveryQrModal.req?.batch_number} • {deliveryQrModal.req?.product_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeliveryQrModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {deliveryQrModal.loading ? (
              <div className="p-12 text-center space-y-3">
                <Loader2 className="h-8 w-8 text-purple-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-600">Generating delivery handoff QR...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center p-6 bg-purple-50/50 rounded-2xl border-2 border-purple-300">
                  <QRCodeCanvas
                    id="distributor-delivery-qr-canvas"
                    value={deliveryQrModal.qrToken || `DLV_${deliveryQrModal.req?.id}`}
                    size={220}
                    level="H"
                    includeMargin={true}
                    className="rounded-xl shadow-xs bg-white p-1"
                  />
                  <div className="mt-3 text-center w-full max-w-xs">
                    <div className="flex items-center justify-center gap-1.5 font-mono text-xs font-bold text-purple-900 bg-white px-3 py-1.5 rounded-lg border border-purple-300 shadow-xs">
                      <span className="truncate select-all">
                        {deliveryQrModal.qrToken || `DLV_${deliveryQrModal.req?.id}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const val = deliveryQrModal.qrToken || `DLV_${deliveryQrModal.req?.id}`
                          navigator.clipboard.writeText(val)
                          setCopiedDeliveryToken(true)
                          setTimeout(() => setCopiedDeliveryToken(false), 2000)
                        }}
                        title="Copy delivery token"
                        className="text-purple-600 hover:text-purple-800 p-0.5 rounded cursor-pointer shrink-0"
                      >
                        {copiedDeliveryToken ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Delivery QR for Retailer Scan</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination Store:</span>
                    <span className="font-bold text-slate-900">
                      {deliveryQrModal.req?.retailer?.destination_store || "Retail Store"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Arrived Vehicle:</span>
                    <span className="font-mono font-bold text-purple-700">
                      {deliveryQrModal.req?.vehicle_number || inspectionVehicleNumber || "KA-04-E-2941"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Cargo:</span>
                    <span className="font-bold text-slate-900">
                      {deliveryQrModal.req?.quantity} {deliveryQrModal.req?.unit || "kg"}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-purple-600 mt-0.5" />
                  <span>
                    <strong>Next Step:</strong> Have the store receiving dock officer scan this Delivery QR from their Retailer Dashboard. They will cross-verify cargo against the Processor's earlier dispatch notice and confirm acceptance.
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleDownloadDeliveryQR}
                    className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="h-4 w-4" /> Download QR (PNG)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDeliveryQrModal(null)}
                    className="flex-1 rounded-xl border-purple-200 text-purple-900 hover:bg-purple-50 font-bold text-xs cursor-pointer"
                  >
                    Done (Keep Active)
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* FULL ROUTE & NAVIGATION MAP MODAL */}
      <RouteMapModal
        isOpen={Boolean(selectedMapRequest)}
        onClose={() => setSelectedMapRequest(null)}
        request={selectedMapRequest}
      />
    </div>
  )
}
