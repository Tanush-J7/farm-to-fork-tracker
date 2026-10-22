import { useState, useEffect, useRef, useCallback } from "react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"
import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import {
  Factory, AlertCircle, Search, ShieldCheck, Camera, Brain, Clock, User, MapPin,
  Star, Package, Truck, Loader2, QrCode, Upload, Printer, Video, VideoOff, Download, X,
  Trash2, Scale, Lock, CheckCircle, Store, Thermometer, Phone, ExternalLink, CheckCircle2, Send,
  Boxes
} from "lucide-react"
import { Html5Qrcode } from "html5-qrcode"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"
import jsQR from "jsqr"
import { getFarmerLocation, getProcessorLocation, getRetailerLocation } from "../utils"
import { RetailerDemandDesk } from "../components/processor/RetailerDemandDesk"
import { ProcessorInventory } from "../components/processor/ProcessorInventory"
import { ProfileManagementSection } from "../components/profile/ProfileManagementSection"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

interface Product {
  id: string
  product_id: number
  name: string
  category: string
  batch_number: string
  quantity: number
  status: string
  organic_status: boolean
  ai_quality_score?: number
  ai_quality_label?: string
  ai_shelf_life?: any
  expiry_date?: string
  product_image_url?: string
  created_at: string
  blockchain_hash?: string
  farm_location?: string
  farmer?: {
    name: string
    email: string
    address?: string
    location?: string
  }
}

interface ReceiptDetails {
  productId: string
  receivedQty: number
  arrivalDate: string
  arrivalTime: string
  receivedBy: string
}

interface VerificationDetails {
  productId: string
  status: "Verified" | "Mismatch"
  remarks: string
  date: string
  time: string
}

interface InspectionDetails {
  productId: string
  appearance: string
  freshness: string
  damage: string
  cleanliness: string
  grade: "A" | "B" | "C"
  remarks: string
  inspectorName: string
  facilityLocation?: string
  date: string
  time: string
}

interface ProcessingBatch {
  batchId: string
  productId: string
  originalProduct: Product
  processorName?: string
  facilityLocation?: string
  stage: "Accepted" | "Processing Started" | "Processing In Progress" | "Quality Check" | "Processing Completed" | "Transferred"
  stageLogs: {
    stage: string
    date: string
    time: string
    remarks: string
  }[]
  createdDate: string
  createdTime: string
  processedQuantity?: number
  estimatedShelfLifeDays?: number
  expiryDate?: string
  completionDate?: string
  completionTime?: string
  distributor?: string
  distributorId?: string
  distributorName?: string
  distributorVehicle?: string
  destinationHub?: string
  destinationStore?: string
  blockchainTx?: string
  trackingId?: string
  deliveryRequestStatus?: "REQUESTED" | "ACCEPTED" | "PICKUP_QR_GENERATED" | "IN_TRANSIT" | "ARRIVED_AT_RETAILER" | "COMPLETED" | "DECLINED" | "DISPUTED"
  declineReason?: string
  driverName?: string
  driverPhone?: string
  pickupQrToken?: string
  pickupQrData?: any
  packagingFormat?: string
  storageTemp?: string
  logisticsMode?: string
  transferDate?: string
  transferTime?: string
}

interface AvailableDistributor {
  id: string
  name: string
  email: string
  wallet_address?: string
  fleet_name: string
  vehicle_type: string
  vehicle_number: string
  temperature_control: string
  payload_capacity: string
  current_status: "AVAILABLE" | "ON_ROUTE" | "UNAVAILABLE"
  status_reason?: string
  availability_status?: string
  base_hub: string
  rating: number
  active_deliveries?: number
  completed_trips: number
  phone: string
}

interface AvailableRetailer {
  id: string
  name: string
  email: string
  role: string
}

interface AuditLog {
  id: string
  date: string
  time: string
  user: string
  action: string
  status: string
  productId?: string
  batchId?: string
}

import { useSearchParams } from "react-router-dom"

export function ProcessorDashboard() {
  const { token, user } = useAuth()
  const processorName = user?.name || "Processor Admin"
  const processorAddress = user?.address || localStorage.getItem("processor_address") || "Processing Facility"

  // Tabs state
  const [searchParams] = useSearchParams()
  const tabParam = (searchParams.get("tab") as "browse" | "pipeline" | "inventory" | "demands" | "history" | "profile") || "browse"
  const [activeTab, setActiveTab] = useState<"browse" | "pipeline" | "inventory" | "demands" | "history" | "profile">(tabParam)

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const [pipelineStep, setPipelineStep] = useState<"interested" | "received" | "inspecting" | "processing" | "completed">("interested")
  const [historySubTab, setHistorySubTab] = useState<"audit" | "transferred">("audit")

  // API Products State
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Search/Filter/Sort state
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [sortBy, setSortBy] = useState("newest")

  // Local storage states
  const [interests, setInterests] = useState<string[]>([])
  const [deals, setDeals] = useState<Record<string, "requested" | "accepted" | "dispatched" | "declined">>({})
  const [declinedProducts, setDeclinedProducts] = useState<Record<string, boolean>>({})
  const [receipts, setReceipts] = useState<Record<string, ReceiptDetails>>({})
  const [verifications, setVerifications] = useState<Record<string, VerificationDetails>>({})
  const [inspections, setInspections] = useState<Record<string, InspectionDetails>>({})
  const [decisions, setDecisions] = useState<Record<string, { decision: "Accepted" | "Rejected"; reason?: string; date: string; time: string }>>({})
  const [batches, setBatches] = useState<Record<string, ProcessingBatch>>({})
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // Modal / Form states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  // Receive Modal
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false)
  const [receivedQtyInput, setReceivedQtyInput] = useState("")
  const [arrivalDateInput, setArrivalDateInput] = useState(new Date().toISOString().split("T")[0])
  const [arrivalTimeInput, setArrivalTimeInput] = useState(new Date().toTimeString().split(" ")[0].slice(0, 5))
  const [transitLossReasonInput, setTransitLossReasonInput] = useState("Transit Spoilage / Physical Damage on Route")

  // Inspect Modal / Form
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [qrScanning, setQrScanning] = useState(false)
  const [qrScanned, setQrScanned] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [scannedRawText, setScannedRawText] = useState("")
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Batch QR View Modal
  const [qrViewBatch, setQrViewBatch] = useState<ProcessingBatch | null>(null)
  
  // Verification Checks
  const [infoVerified, setInfoVerified] = useState<"Verified" | "Mismatch" | "">("")
  const [remarksInput, setRemarksInput] = useState("")
  const [isInspectionConfirmed, setIsInspectionConfirmed] = useState(false)

  // Physical Inspection
  const [appearanceInput, setAppearanceInput] = useState("Good")
  const [freshnessInput, setFreshnessInput] = useState("Excellent")
  const [damageInput, setDamageInput] = useState("Low")
  const [cleanlinessInput, setCleanlinessInput] = useState("Good")
  const [qualityGradeInput, setQualityGradeInput] = useState<"A" | "B" | "C">("A")

  const computePhysicalQualityScore = (appearance: string, freshness: string, cleanliness: string, damage: string) => {
    let score = 0
    if (appearance === "Excellent") score += 25
    else if (appearance === "Good") score += 20
    else if (appearance === "Average") score += 15
    else score += 8

    if (freshness === "Excellent") score += 25
    else if (freshness === "Good") score += 20
    else if (freshness === "Average") score += 15
    else score += 8

    if (cleanliness === "Excellent") score += 25
    else if (cleanliness === "Good") score += 20
    else if (cleanliness === "Average") score += 15
    else score += 8

    if (damage === "Low") score += 25
    else if (damage === "Medium") score += 15
    else score += 5

    return Math.min(100, Math.max(10, score))
  }

  const handlePhysicalParamChange = (type: "appearance" | "freshness" | "cleanliness" | "damage", value: string) => {
    const nextApp = type === "appearance" ? value : appearanceInput
    const nextFresh = type === "freshness" ? value : freshnessInput
    const nextClean = type === "cleanliness" ? value : cleanlinessInput
    const nextDam = type === "damage" ? value : damageInput

    if (type === "appearance") setAppearanceInput(value)
    if (type === "freshness") setFreshnessInput(value)
    if (type === "cleanliness") setCleanlinessInput(value)
    if (type === "damage") setDamageInput(value)

    const score = computePhysicalQualityScore(nextApp, nextFresh, nextClean, nextDam)
    if (score >= 85) setQualityGradeInput("A")
    else if (score >= 60) setQualityGradeInput("B")
    else setQualityGradeInput("C")
  }

  // Decision Reject Reason
  const [rejectionReasonInput, setRejectionReasonInput] = useState("")
  const [showRejectionForm, setShowRejectionForm] = useState(false)




  // Processing Completion Modal state
  const [processingModalBatch, setProcessingModalBatch] = useState<ProcessingBatch | null>(null)
  const [processedQtyInput, setProcessedQtyInput] = useState("")
  const [estimatedShelfLifeInput, setEstimatedShelfLifeInput] = useState("")

  // Distributor Logistics Fleet & Dispatch Modal
  const [dispatchModalBatch, setDispatchModalBatch] = useState<ProcessingBatch | null>(null)
  const [availableDistributors, setAvailableDistributors] = useState<AvailableDistributor[]>([])
  const [availableRetailers, setAvailableRetailers] = useState<AvailableRetailer[]>([])
  const [loadingDistributors, setLoadingDistributors] = useState(false)
  const [selectedDistributorId, setSelectedDistributorId] = useState("")
  const [selectedRetailerId, setSelectedRetailerId] = useState("")
  const [selectedDestinationStore, setSelectedDestinationStore] = useState("")
  const [destinationStoreAddress, setDestinationStoreAddress] = useState("")
  const [processorPickupLocation, setProcessorPickupLocation] = useState("")
  const [dispatchNotesInput, setDispatchNotesInput] = useState("")
  const [dispatchLoading, setDispatchLoading] = useState(false)
  const [dispatchSuccessResult, setDispatchSuccessResult] = useState<{
    tracking_id: string
    blockchain_hash: string | null
    message: string
  } | null>(null)

  // Pickup QR Modal state
  const [pickupModalData, setPickupModalData] = useState<{
    isOpen: boolean
    loading: boolean
    qrToken?: string
    qrData?: any
    batch?: ProcessingBatch
    txHash?: string
    error?: string
  } | null>(null)

  const formatToDdMmYyyy = (dateStr: string) => {
    if (!dateStr) return ""
    if (dateStr.includes("-") && dateStr.split("-")[0].length === 4) {
      const [y, m, d] = dateStr.split("-")
      return `${d}-${m}-${y}`
    }
    return dateStr
  }

  const computeShelfLifeDays = (dateStr: string) => {
    if (!dateStr) return 14
    const target = new Date(dateStr)
    const now = new Date()
    const diffTime = target.getTime() - new Date(now.toISOString().split("T")[0]).getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays)
  }

  const openProcessingModal = (b: ProcessingBatch) => {
    setProcessingModalBatch(b)
    const qty = receipts[b.originalProduct.id]?.receivedQty || b.originalProduct.quantity || 100
    setProcessedQtyInput(String(qty))
    const defaultExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    setEstimatedShelfLifeInput(defaultExpiry.toISOString().split("T")[0])
  }

  // Fetch Products
  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await axios.get(`${API}/products`, { headers })
      const raw: Product[] = res.data?.data || []

      // Filter out permanently deleted products
      let deletedIds: string[] = []
      try {
        deletedIds = JSON.parse(localStorage.getItem("farmer_deleted_products") || "[]")
      } catch {
        deletedIds = []
      }
      const deletedSet = new Set(deletedIds.map(String))

      // Automatic Expiry Filter:
      // If a product has no processor interest and its expiry date has passed,
      // it should automatically disappear from the available browse catalog.
      const isUnclaimedAndExpired = (p: Product) => {
        const exp = p.expiry_date || (p as any).expiryDate
        if (!exp) return false
        if (p.status !== "Harvested" && p.status !== "Pending Approval") return false
        const expiryTime = new Date(`${exp}T23:59:59`).getTime()
        return !isNaN(expiryTime) && expiryTime < Date.now()
      }

      const active = raw.filter(p =>
        !deletedSet.has(String(p.id)) &&
        !deletedSet.has(String(p.batch_number)) &&
        !isUnclaimedAndExpired(p)
      )
      setProducts(active)
      // Auto-reconstruct active batches across devices (e.g. laptop) from database products
      setBatches(prev => {
        let changed = false
        const next = { ...prev }
        active.forEach(p => {
          if (p.status === "Processing" || p.status === "In Transit" || p.status === "At Retailer") {
            const hasBatch = Object.values(next).some(b => b.productId === p.id || b.batchId === p.batch_number)
            if (!hasBatch) {
              changed = true
              const synthId = p.batch_number?.startsWith("PB-") ? p.batch_number : `PB-${p.batch_number || p.id.slice(0, 6)}`
              next[synthId] = {
                batchId: synthId,
                productId: p.id,
                originalProduct: p,
                processorName: processorName,
                facilityLocation: processorAddress,
                stage: p.status === "Processing" ? "Processing In Progress" : "Processing Completed",
                stageLogs: [{
                  stage: p.status === "Processing" ? "Processing In Progress" : "Processing Completed",
                  date: new Date(p.created_at || Date.now()).toLocaleDateString("en-GB"),
                  time: "10:00 AM",
                  remarks: `Active batch loaded from database (${p.status})`
                }],
                processedQuantity: p.quantity,
                createdDate: new Date(p.created_at || Date.now()).toLocaleDateString("en-GB"),
                createdTime: "10:00 AM"
              }
            }
          }
        })
        if (changed) {
          try { localStorage.setItem("processor_batches", JSON.stringify(next)) } catch {}
          return next
        }
        return prev
      })
    } catch (err) {
      console.error("Failed to load products", err)
    } finally {
      setLoadingProducts(false)
    }
  }

  // Cloud-synced processor state across mobile & desktop devices
  const syncProcessorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistProcessorState = useCallback((patch: {
    batches?: Record<string, ProcessingBatch>
    receipts?: Record<string, ReceiptDetails>
    verifications?: Record<string, VerificationDetails>
    inspections?: Record<string, InspectionDetails>
    decisions?: Record<string, { decision: "Accepted" | "Rejected"; reason?: string; date: string; time: string }>
    auditLogs?: AuditLog[]
    interests?: string[]
    deals?: Record<string, "requested" | "accepted" | "dispatched" | "declined">
    declinedProducts?: Record<string, boolean>
  }) => {
    if (patch.batches !== undefined) {
      setBatches(patch.batches)
      try { localStorage.setItem("processor_batches", JSON.stringify(patch.batches)) } catch {}
    }
    if (patch.receipts !== undefined) {
      setReceipts(patch.receipts)
      try { localStorage.setItem("processor_receipts", JSON.stringify(patch.receipts)) } catch {}
    }
    if (patch.verifications !== undefined) {
      setVerifications(patch.verifications)
      try { localStorage.setItem("processor_verifications", JSON.stringify(patch.verifications)) } catch {}
    }
    if (patch.inspections !== undefined) {
      setInspections(patch.inspections)
      try { localStorage.setItem("processor_inspections", JSON.stringify(patch.inspections)) } catch {}
    }
    if (patch.decisions !== undefined) {
      setDecisions(patch.decisions)
      try { localStorage.setItem("processor_decisions", JSON.stringify(patch.decisions)) } catch {}
    }
    if (patch.auditLogs !== undefined) {
      setAuditLogs(patch.auditLogs)
      try { localStorage.setItem("processor_logs", JSON.stringify(patch.auditLogs)) } catch {}
    }
    if (patch.interests !== undefined) {
      setInterests(patch.interests)
      try { localStorage.setItem("processor_interests", JSON.stringify(patch.interests)) } catch {}
    }
    if (patch.deals !== undefined) {
      setDeals(patch.deals)
      try { localStorage.setItem("farmer_deals", JSON.stringify(patch.deals)) } catch {}
    }
    if (patch.declinedProducts !== undefined) {
      setDeclinedProducts(patch.declinedProducts)
      try { localStorage.setItem("processor_declined_products", JSON.stringify(patch.declinedProducts)) } catch {}
    }

    if (syncProcessorTimeoutRef.current) {
      clearTimeout(syncProcessorTimeoutRef.current)
    }
    syncProcessorTimeoutRef.current = setTimeout(async () => {
      if (!token) return
      try {
        const b = patch.batches ?? JSON.parse(localStorage.getItem("processor_batches") || "{}")
        const r = patch.receipts ?? JSON.parse(localStorage.getItem("processor_receipts") || "{}")
        const v = patch.verifications ?? JSON.parse(localStorage.getItem("processor_verifications") || "{}")
        const ins = patch.inspections ?? JSON.parse(localStorage.getItem("processor_inspections") || "{}")
        const d = patch.decisions ?? JSON.parse(localStorage.getItem("processor_decisions") || "{}")
        const l = patch.auditLogs ?? JSON.parse(localStorage.getItem("processor_logs") || "[]")
        const i = patch.interests ?? JSON.parse(localStorage.getItem("processor_interests") || "[]")
        const de = patch.deals ?? JSON.parse(localStorage.getItem("farmer_deals") || "{}")
        const dp = patch.declinedProducts ?? JSON.parse(localStorage.getItem("processor_declined_products") || "{}")

        await axios.put(`${API}/processor/state`, {
          batches: b,
          receipts: r,
          verifications: v,
          inspections: ins,
          decisions: d,
          auditLogs: l,
          interests: i,
          deals: de,
          declinedProducts: dp
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch (err) {
        console.warn("Could not sync processor state to cloud", err)
      }
    }, 400)
  }, [token])

  const fetchProcessorCloudState = useCallback(async () => {
    if (!token) return
    try {
      const res = await axios.get(`${API}/processor/state`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.success && res.data.data) {
        const cloud = res.data.data
        let localBatches = JSON.parse(localStorage.getItem("processor_batches") || "{}")
        let localReceipts = JSON.parse(localStorage.getItem("processor_receipts") || "{}")
        let localVerifications = JSON.parse(localStorage.getItem("processor_verifications") || "{}")
        let localInspections = JSON.parse(localStorage.getItem("processor_inspections") || "{}")
        let localDecisions = JSON.parse(localStorage.getItem("processor_decisions") || "{}")
        let localLogs = JSON.parse(localStorage.getItem("processor_logs") || "[]")
        let localInterests = JSON.parse(localStorage.getItem("processor_interests") || "[]")
        let localDeals = JSON.parse(localStorage.getItem("farmer_deals") || "{}")
        let localDeclined = JSON.parse(localStorage.getItem("processor_declined_products") || "{}")

        const stageWeight = (s?: string) => {
          switch (s) {
            case "Transferred": return 6
            case "Processing Completed": return 5
            case "Quality Check": return 4
            case "Processing In Progress": return 3
            case "Processing Started": return 2
            case "Accepted": return 1
            default: return 0
          }
        }

        // Cloud is authoritative source of truth across all devices
        const cloudBatches: Record<string, ProcessingBatch> = cloud.batches || {}
        const mergedBatches: Record<string, ProcessingBatch> = {}
        const seenBatchedProducts = new Set<string>()

        // Check all batch keys from cloud and local
        const allKeys = Array.from(new Set([...Object.keys(cloudBatches), ...Object.keys(localBatches)]))

        for (const k of allKeys) {
          const cB = cloudBatches[k]
          const lB = localBatches[k]

          // Decide winning batch: Cloud is authoritative, but if both exist pick highest progress stage
          let chosen = cB || lB
          if (cB && lB) {
            if (stageWeight(lB.stage) > stageWeight(cB.stage)) {
              chosen = { ...cB, ...lB }
            } else {
              chosen = { ...lB, ...cB }
            }
          }

          if (!chosen || !chosen.originalProduct) continue
          const pId = String(chosen.productId || chosen.originalProduct?.id || "")
          const bNum = String(chosen.originalProduct?.batch_number || (chosen.originalProduct as any)?.batchNumber || "")

          if (products.length > 0) {
            const exists = products.some(p => String(p.id) === pId || (bNum && p.batch_number === bNum))
            if (!exists) continue
          }

          const dedupeKey = pId || bNum || k
          if (!seenBatchedProducts.has(dedupeKey)) {
            seenBatchedProducts.add(dedupeKey)
            mergedBatches[k] = chosen
          } else {
            // Deduplicate by keeping the most advanced stage
            const existingKey = Object.keys(mergedBatches).find(ek => {
              const eb = mergedBatches[ek]
              return String(eb.productId || eb.originalProduct?.id || "") === pId ||
                (bNum && String(eb.originalProduct?.batch_number || "") === bNum)
            })
            if (existingKey) {
              const existingBatch = mergedBatches[existingKey]
              if (stageWeight(chosen.stage) > stageWeight(existingBatch.stage)) {
                delete mergedBatches[existingKey]
                mergedBatches[k] = chosen
              }
            }
          }
        }

        // Cloud overrides local for receipts, verifications, inspections, decisions, deals, and declined
        const mergedReceipts = { ...localReceipts, ...(cloud.receipts || {}) }
        const mergedVerifications = { ...localVerifications, ...(cloud.verifications || {}) }
        const mergedInspections = { ...localInspections, ...(cloud.inspections || {}) }
        const mergedDecisions = { ...localDecisions, ...(cloud.decisions || {}) }
        
        const existingLogIds = new Set(localLogs.map((l: any) => l.id))
        const newCloudLogs = (cloud.auditLogs || []).filter((l: any) => !existingLogIds.has(l.id))
        const mergedLogs = [...localLogs, ...newCloudLogs]

        const mergedInterests = Array.from(new Set([...localInterests, ...(cloud.interests || [])]))
        const mergedDeals = { ...localDeals, ...(cloud.deals || {}) }
        const mergedDeclined = { ...localDeclined, ...(cloud.declinedProducts || {}) }

        setBatches(mergedBatches)
        setReceipts(mergedReceipts)
        setVerifications(mergedVerifications)
        setInspections(mergedInspections)
        setDecisions(mergedDecisions)
        setAuditLogs(mergedLogs)
        setInterests(mergedInterests)
        setDeals(mergedDeals)
        setDeclinedProducts(mergedDeclined)

        try {
          localStorage.setItem("processor_batches", JSON.stringify(mergedBatches))
          localStorage.setItem("processor_receipts", JSON.stringify(mergedReceipts))
          localStorage.setItem("processor_verifications", JSON.stringify(mergedVerifications))
          localStorage.setItem("processor_inspections", JSON.stringify(mergedInspections))
          localStorage.setItem("processor_decisions", JSON.stringify(mergedDecisions))
          localStorage.setItem("processor_logs", JSON.stringify(mergedLogs))
          localStorage.setItem("processor_interests", JSON.stringify(mergedInterests))
          localStorage.setItem("farmer_deals", JSON.stringify(mergedDeals))
          localStorage.setItem("processor_declined_products", JSON.stringify(mergedDeclined))
        } catch {}

        if (Object.keys(localBatches).length > 0 && (!cloud.batches || Object.keys(cloud.batches).length < Object.keys(mergedBatches).length)) {
          axios.put(`${API}/processor/state`, {
            batches: mergedBatches,
            receipts: mergedReceipts,
            verifications: mergedVerifications,
            inspections: mergedInspections,
            decisions: mergedDecisions,
            auditLogs: mergedLogs,
            interests: mergedInterests,
            deals: mergedDeals,
            declinedProducts: mergedDeclined
          }, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => {})
        }
      }
    } catch (err) {
      console.warn("Could not fetch processor state from cloud", err)
    }
  }, [token])

  // Load local storage keys & sync with cloud
  useEffect(() => {
    fetchProducts()
    fetchDistributors()
    syncDeliveryRequests()
    fetchProcessorCloudState()
    
    // Interests
    const storedInterests = localStorage.getItem("processor_interests")
    if (storedInterests) setInterests(JSON.parse(storedInterests))

    // Receipts
    const storedReceipts = localStorage.getItem("processor_receipts")
    if (storedReceipts) setReceipts(JSON.parse(storedReceipts))

    // Verifications
    const storedVerifications = localStorage.getItem("processor_verifications")
    if (storedVerifications) setVerifications(JSON.parse(storedVerifications))

    // Inspections
    const storedInspections = localStorage.getItem("processor_inspections")
    if (storedInspections) setInspections(JSON.parse(storedInspections))

    // Decisions
    const storedDecisions = localStorage.getItem("processor_decisions")
    if (storedDecisions) setDecisions(JSON.parse(storedDecisions))

    // Batches
    const storedBatches = localStorage.getItem("processor_batches")
    if (storedBatches) setBatches(JSON.parse(storedBatches))

    // Logs
    const storedLogs = localStorage.getItem("processor_logs")
    if (storedLogs) setAuditLogs(JSON.parse(storedLogs))

    // Deals & Declined Status
    const loadDealsAndDeclined = () => {
      try {
        const stored = JSON.parse(localStorage.getItem("farmer_deals") || "{}")
        setDeals(stored)
      } catch {
        setDeals({})
      }
      try {
        const storedDeclined = JSON.parse(localStorage.getItem("processor_declined_products") || "{}")
        setDeclinedProducts(storedDeclined)
      } catch {
        setDeclinedProducts({})
      }
    }
    loadDealsAndDeclined()
    window.addEventListener("farmer_deals_updated", loadDealsAndDeclined)
    window.addEventListener("storage", loadDealsAndDeclined)

    const interval = setInterval(() => {
      fetchProducts()
      syncDeliveryRequests()
      fetchDistributors(true)
      fetchProcessorCloudState()
    }, 8000)

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        fetchProducts()
        syncDeliveryRequests()
        fetchProcessorCloudState()
      }
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("visibilitychange", handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener("farmer_deals_updated", loadDealsAndDeclined)
      window.removeEventListener("storage", loadDealsAndDeclined)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("visibilitychange", handleFocus)
    }
  }, [token, fetchProcessorCloudState])

  // Helper: Add log
  const addLog = (action: string, status: string, productId?: string, batchId?: string) => {
    const now = new Date()
    const newLog: AuditLog = {
      id: Math.random().toString(36).substring(2, 9),
      date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      user: processorName,
      action,
      status,
      productId,
      batchId
    }
    const updated = [newLog, ...auditLogs]
    persistProcessorState({ auditLogs: updated })
  }

  // DB update helper
  const updateDbStatus = async (id: string, status: string) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await axios.put(`${API}/products/${id}/status`, { status }, { headers })
      // Update local products state
      setProducts(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    } catch (err) {
      console.error("Could not update product status in database", err)
    }
  }

  // Action: Mark Interest (Permanent, cannot be undone)
  const markInterest = async (product: Product) => {
    const prodId = String(product.id)

    // Clear any past test receipt/decision for this fresh product
    const updatedReceipts = { ...receipts }
    delete updatedReceipts[prodId]
    delete updatedReceipts[product.id]
    setReceipts(updatedReceipts)
    localStorage.setItem("processor_receipts", JSON.stringify(updatedReceipts))

    const updatedDecisions = { ...decisions }
    delete updatedDecisions[prodId]
    delete updatedDecisions[product.id]
    setDecisions(updatedDecisions)
    localStorage.setItem("processor_decisions", JSON.stringify(updatedDecisions))

    const updated = Array.from(new Set([...interests, prodId, product.id]))
    setInterests(updated)
    localStorage.setItem("processor_interests", JSON.stringify(updated))
    addLog(`Marked interest in ${product.name}`, "Interested", prodId)
    persistProcessorState({ interests: updated })

    // Generate & save Farmer Notification and Deal State
    try {
      const now = new Date()
      const newNotif = {
        id: "notif-" + Math.random().toString(36).substring(2, 9),
        type: "processor_interest",
        productId: prodId,
        batchNumber: product.batch_number || (product as any).batchNumber || "",
        productName: product.name,
        quantity: product.quantity,
        processorName: processorName || "Processing Facility",
        date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now(),
        read: false,
        message: `${processorName || "Processing Facility"} has expressed interest in your harvest batch "${product.name}" (${product.batch_number || (product as any).batchNumber || ""}).`
      }
      const existingNotifs = JSON.parse(localStorage.getItem("farmer_notifications") || "[]")
      const filteredNotifs = existingNotifs.filter((n: any) => n.productId !== prodId && n.batchNumber !== (product.batch_number || (product as any).batchNumber))
      const updatedNotifs = [newNotif, ...filteredNotifs]
      localStorage.setItem("farmer_notifications", JSON.stringify(updatedNotifs))
      window.dispatchEvent(new Event("farmer_notifications_updated"))

      // Record requested status in farmer_deals
      const storedDeals = JSON.parse(localStorage.getItem("farmer_deals") || "{}")
      storedDeals[prodId] = "requested"
      if (product.batch_number) storedDeals[product.batch_number] = "requested"
      if ((product as any).batchNumber) storedDeals[(product as any).batchNumber] = "requested"
      localStorage.setItem("farmer_deals", JSON.stringify(storedDeals))
      setDeals(storedDeals)
      window.dispatchEvent(new Event("farmer_deals_updated"))
    } catch (e) {
      console.warn("Could not save farmer notification/deal", e)
    }

    await updateDbStatus(product.id, "Processing")
    if (prodId !== product.id) {
      await updateDbStatus(prodId, "Processing")
    }
  }

  // Action: Dismiss Declined Product from Pipeline
  const handleDismissDeclined = (productId: string, batchNumber?: string) => {
    const updated = interests.filter(
      id => id !== productId && id !== String(productId) && (!batchNumber || id !== batchNumber)
    )
    setInterests(updated)
    localStorage.setItem("processor_interests", JSON.stringify(updated))
    addLog(`Dismissed declined product from pipeline`, "Dismissed", productId)
  }

  // Action: Receive Product Form Submit
  const handleReceiveProduct = async () => {
    if (!selectedProduct || !receivedQtyInput) return

    const receivedQtyNum = Number(receivedQtyInput)
    const registeredQty = selectedProduct.quantity
    const hasShortage = receivedQtyNum < registeredQty
    const shortageAmount = registeredQty - receivedQtyNum
    const shortagePercent = registeredQty > 0 ? ((shortageAmount / registeredQty) * 100).toFixed(0) : "0"

    const receipt: ReceiptDetails = {
      productId: selectedProduct.id,
      receivedQty: receivedQtyNum,
      arrivalDate: arrivalDateInput,
      arrivalTime: arrivalTimeInput,
      receivedBy: processorName
    }

    const updatedReceipts = { 
      ...receipts, 
      [selectedProduct.id]: receipt,
      [String(selectedProduct.id)]: receipt 
    }
    setReceipts(updatedReceipts)
    localStorage.setItem("processor_receipts", JSON.stringify(updatedReceipts))

    const logMessage = hasShortage
      ? `Received product ${selectedProduct.name} (${receivedQtyNum} kg vs ${registeredQty} kg registered - ${shortageAmount} kg Shortage [${shortagePercent}%], Reason: ${transitLossReasonInput})`
      : `Received product ${selectedProduct.name} (${receivedQtyNum} kg) at facility`

    addLog(logMessage, "Received", selectedProduct.id)
    await updateDbStatus(selectedProduct.id, "Processing")

    setIsReceiveModalOpen(false)
    setReceivedQtyInput("")
    setSelectedProduct(null)
    setPipelineStep("received")
  }

  // Live Camera QR Scanner Methods
  const startLiveCamera = async () => {
    setCameraError("")
    setQrScanning(true)
    setCameraActive(true)

    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop()
      }
      const html5QrCode = new Html5Qrcode("live-qr-reader")
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 }
        },
        (decodedText) => {
          handleQrSuccess(decodedText)
        },
        () => {}
      )
    } catch (err: any) {
      console.error("Camera error", err)
      setCameraError(err?.message || "Could not access camera. Please allow camera permissions or upload a QR image.")
      setCameraActive(false)
      setQrScanning(false)
    }
  }

  const stopLiveCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop()
        }
        html5QrCodeRef.current.clear()
      } catch (e) {
        console.error("Error stopping scanner", e)
      }
    }
    setCameraActive(false)
    setQrScanning(false)
  }

  const format6DigitId = (id: number | string) => {
    const num = Number(id)
    if (num >= 100000 && num <= 999999) return String(num)
    if (num > 0) return String(100000 + num)
    return "100000"
  }

  const handleQrSuccess = async (decodedText: string) => {
    await stopLiveCamera()
    setScannedRawText(decodedText)

    // Extract ID from scanned QR URL or raw payload
    let scannedId = decodedText.trim()
    if (scannedId.includes("?id=")) {
      scannedId = scannedId.split("?id=")[1].split("&")[0].trim()
    }
    scannedId = scannedId.replace("FP-", "").trim().toLowerCase()

    const pId = String(selectedProduct?.id || "").toLowerCase()
    const pProdId = String(selectedProduct?.product_id || "").toLowerCase()
    const pBatch = String(selectedProduct?.batch_number || "").toLowerCase()
    const p6Digit = format6DigitId(selectedProduct?.product_id || selectedProduct?.id || 0).toLowerCase()
    const cleanDecoded = decodedText.toLowerCase()

    // Strict validation: Must match the selected product's ID, DB ID, 6-digit mapped ID, or Batch Number
    const isMatch = Boolean(
      (pId && scannedId === pId) ||
      (pProdId && scannedId === pProdId) ||
      (p6Digit && scannedId === p6Digit) ||
      (pBatch && (scannedId === pBatch || cleanDecoded.includes(pBatch))) ||
      (pId && cleanDecoded.includes(`id=${pId}`)) ||
      (pProdId && cleanDecoded.includes(`id=${pProdId}`))
    )

    if (isMatch) {
      setCameraError("")
      setInfoVerified("Verified")
      setRemarksInput("")
      setIsInspectionConfirmed(false)
      // ONLY advance to the physical inspection grading page on successful verification!
      setQrScanned(true)
    } else {
      setInfoVerified("Mismatch")
      // DO NOT advance on mismatch: keep user on the scanner view with clear error
      setQrScanned(false)
      
      // Dynamic cross-catalog search across all products
      const otherProduct = products.find(p => {
        if (p.id === selectedProduct?.id) return false
        const otherId = String(p.id).toLowerCase()
        const otherProdId = String(p.product_id || "").toLowerCase()
        const otherBatch = String(p.batch_number || "").toLowerCase()
        const other6Digit = format6DigitId(p.product_id || p.id).toLowerCase()
        return (
          (otherId && scannedId === otherId) ||
          (otherProdId && scannedId === otherProdId) ||
          (other6Digit && scannedId === other6Digit) ||
          (otherBatch && (scannedId === otherBatch || cleanDecoded.includes(otherBatch))) ||
          (otherId && cleanDecoded.includes(`id=${otherId}`)) ||
          (otherProdId && cleanDecoded.includes(`id=${otherProdId}`))
        )
      })

      if (otherProduct) {
        setCameraError(`❌ QR Mismatch! You scanned the QR code for "${otherProduct.name}" (Batch: ${otherProduct.batch_number || format6DigitId(otherProduct.product_id || otherProduct.id)}), but this verification is for "${selectedProduct?.name}" (Batch: ${selectedProduct?.batch_number || p6Digit}). Please scan the correct QR code.`)
      } else {
        setCameraError(`❌ QR Mismatch / Unrecognized Code! Scanned payload does not match this batch (${selectedProduct?.batch_number || p6Digit}). Please scan the authentic QR code.`)
      }
    }
  }

  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCameraError("")

    // Helper: read file as Image
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl)

      // Layer 1: Native BarcodeDetector (Modern Hardware-Accelerated Detection)
      if ("BarcodeDetector" in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
          const barcodes = await barcodeDetector.detect(img)
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleQrSuccess(barcodes[0].rawValue)
            return
          }
        } catch (err) {
          console.warn("BarcodeDetector fallback", err)
        }
      }

      // Layer 2: jsQR Direct Pixel Decoding on Canvas
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          }) || jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          })

          if (code && code.data) {
            handleQrSuccess(code.data)
            return
          }
        }
      } catch (err) {
        console.warn("jsQR canvas scan fallback", err)
      }

      // Layer 3: Html5Qrcode fallback
      try {
        const html5QrCode = new Html5Qrcode("live-qr-reader")
        const result = await html5QrCode.scanFile(file, false)
        if (result) {
          handleQrSuccess(result)
          return
        }
      } catch (err) {
        console.warn("Html5Qrcode scanFile fallback", err)
      }

      setCameraError("Could not detect a valid QR code in this image. Please upload a clear QR photo or use the Camera Scanner.")
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setCameraError("Invalid image file format. Please select a PNG or JPEG photo.")
    }

    img.src = objectUrl
  }

  const closeVerifyModal = async () => {
    await stopLiveCamera()
    setIsVerifyModalOpen(false)
    setSelectedProduct(null)
    setQrScanned(false)
    setCameraError("")
    setScannedRawText("")
    setIsInspectionConfirmed(false)
    setInfoVerified("")
    setRemarksInput("")
  }

  // Submit Inspection and Accept/Reject Decision
  const handleInspectionDecision = async (decision: "Accepted" | "Rejected") => {
    if (!selectedProduct) return

    const now = new Date()
    const formattedDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    const formattedTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

    // Save QR Verify info
    const verification: VerificationDetails = {
      productId: selectedProduct.id,
      status: infoVerified === "Verified" ? "Verified" : "Mismatch",
      remarks: remarksInput || "Blockchain batch cryptographic match confirmed",
      date: formattedDate,
      time: formattedTime
    }
    const updatedVerifications = { ...verifications, [selectedProduct.id]: verification }
    setVerifications(updatedVerifications)
    localStorage.setItem("processor_verifications", JSON.stringify(updatedVerifications))

    // Save Quality inspection details
    const computedScore = computePhysicalQualityScore(appearanceInput, freshnessInput, cleanlinessInput, damageInput)
    const autoGrade: "A" | "B" | "C" = computedScore >= 85 ? "A" : computedScore >= 60 ? "B" : "C"
    const inspection: InspectionDetails = {
      productId: selectedProduct.id,
      appearance: appearanceInput,
      freshness: freshnessInput,
      damage: damageInput,
      cleanliness: cleanlinessInput,
      grade: qualityGradeInput,
      remarks: remarksInput || `Quality Score: ${computedScore}% (Grade ${autoGrade})`,
      inspectorName: processorName,
      facilityLocation: processorAddress,
      date: formattedDate,
      time: formattedTime
    }
    const updatedInspections = { ...inspections, [selectedProduct.id]: inspection }
    setInspections(updatedInspections)
    localStorage.setItem("processor_inspections", JSON.stringify(updatedInspections))

    // Save Decision details
    const decisionRecord = {
      decision,
      reason: decision === "Rejected" ? rejectionReasonInput : undefined,
      date: formattedDate,
      time: formattedTime
    }
    const updatedDecisions = { 
      ...decisions, 
      [selectedProduct.id]: decisionRecord, 
      [String(selectedProduct.id)]: decisionRecord 
    }
    setDecisions(updatedDecisions)
    localStorage.setItem("processor_decisions", JSON.stringify(updatedDecisions))

    if (decision === "Accepted") {
      const verifiedQty = (receivedQtyInput && Number(receivedQtyInput) > 0) 
        ? Number(receivedQtyInput) 
        : selectedProduct.quantity
      const hasShortage = verifiedQty < selectedProduct.quantity
      const shortageAmount = selectedProduct.quantity - verifiedQty
      const shortagePercent = selectedProduct.quantity > 0 ? ((shortageAmount / selectedProduct.quantity) * 100).toFixed(0) : "0"

      // Save/update receipt details with weighed scale quantity
      const receipt: ReceiptDetails = {
        productId: selectedProduct.id,
        receivedQty: verifiedQty,
        arrivalDate: arrivalDateInput,
        arrivalTime: arrivalTimeInput,
        receivedBy: processorName
      }
      const updatedReceipts = { 
        ...receipts, 
        [selectedProduct.id]: receipt, 
        [String(selectedProduct.id)]: receipt 
      }
      setReceipts(updatedReceipts)
      localStorage.setItem("processor_receipts", JSON.stringify(updatedReceipts))

      const verifiedProduct: Product = {
        ...selectedProduct,
        quantity: verifiedQty,
        ai_quality_score: computedScore,
        ai_quality_label: `Grade ${autoGrade}`
      }

      // Create batch ID: PB-XXXXXX mapped randomly
      const randomBatchId = `PB-${Math.floor(10000 + Math.random() * 90000)}`
      const remarksText = hasShortage
        ? `Batch verified & accepted at gate. Scale Weight: ${verifiedQty} kg (${shortageAmount} kg Shortage [${shortagePercent}%], Reason: ${transitLossReasonInput}). Quality Score: ${computedScore}% (Grade ${autoGrade}). Remarks: ${remarksInput || "Standard Intake"}`
        : `Batch verified & accepted at gate. Scale Weight: ${verifiedQty} kg. Quality Score: ${computedScore}% (Grade ${autoGrade}). Remarks: ${remarksInput || "Standard Intake"}`

      const newBatch: ProcessingBatch = {
        batchId: randomBatchId,
        productId: selectedProduct.id,
        originalProduct: verifiedProduct,
        processorName: processorName,
        facilityLocation: processorAddress,
        stage: "Accepted",
        stageLogs: [{ stage: "Accepted", date: formattedDate, time: formattedTime, remarks: remarksText }],
        createdDate: formattedDate,
        createdTime: formattedTime
      }
      const updatedBatches = { ...batches, [randomBatchId]: newBatch }
      persistProcessorState({
        receipts: updatedReceipts,
        batches: updatedBatches,
        decisions: updatedDecisions
      })

      addLog(`Accepted product ${selectedProduct.name} (Batch: ${randomBatchId}) - Scale Weight: ${verifiedQty} kg, Quality: ${computedScore}% (Grade ${autoGrade})`, "Accepted - Ready for Processing", selectedProduct.id, randomBatchId)

      // Notify Farmer of Acceptance & sync across cloud
      try {
        const acceptNotif = {
          id: "notif-" + Math.random().toString(36).substring(2, 9),
          type: "processor_accepted",
          productId: String(selectedProduct.id),
          batchNumber: selectedProduct.batch_number || (selectedProduct as any).batchNumber || "",
          productName: selectedProduct.name,
          quantity: verifiedQty,
          processorName: processorName || "Processing Facility",
          date: formattedDate,
          time: formattedTime,
          timestamp: Date.now(),
          read: false,
          message: `${processorName || "Processing Facility"} has verified and accepted batch "${selectedProduct.name}" (${verifiedQty} kg, Grade ${autoGrade}) on blockchain.`
        }
        const existingNotifs = JSON.parse(localStorage.getItem("farmer_notifications") || "[]")
        localStorage.setItem("farmer_notifications", JSON.stringify([acceptNotif, ...existingNotifs]))
        window.dispatchEvent(new Event("farmer_notifications_updated"))

        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        axios.post(`${API}/processor/notify-farmer`, {
          farmer_id: (selectedProduct as any).farmer_id || (selectedProduct.farmer as any)?._id || (selectedProduct as any).farmer?.id || "",
          product_id: selectedProduct.id,
          batch_number: selectedProduct.batch_number || (selectedProduct as any).batchNumber || "",
          status: "accepted",
          quantity: verifiedQty,
          grade: autoGrade,
          message: acceptNotif.message
        }, { headers }).catch(() => {})
      } catch (e) {
        console.warn("Could not save farmer notification", e)
      }

      await updateDbStatus(selectedProduct.id, "Processing")
      setPipelineStep("processing")
    } else {
      addLog(`Rejected product ${selectedProduct.name}: ${rejectionReasonInput}`, "Rejected by Processor", selectedProduct.id)

      // Notify Farmer of Rejection
      try {
        const rejectNotif = {
          id: "notif-" + Math.random().toString(36).substring(2, 9),
          type: "processor_rejected",
          productId: String(selectedProduct.id),
          batchNumber: selectedProduct.batch_number || (selectedProduct as any).batchNumber || "",
          productName: selectedProduct.name,
          quantity: selectedProduct.quantity,
          processorName: processorName || "Processing Facility",
          date: formattedDate,
          time: formattedTime,
          timestamp: Date.now(),
          read: false,
          message: `${processorName || "Processing Facility"} rejected batch "${selectedProduct.name}" (${selectedProduct.quantity} kg) — Reason: ${rejectionReasonInput || "Intake verification discrepancy"}.`
        }
        const existingNotifs = JSON.parse(localStorage.getItem("farmer_notifications") || "[]")
        localStorage.setItem("farmer_notifications", JSON.stringify([rejectNotif, ...existingNotifs]))
        window.dispatchEvent(new Event("farmer_notifications_updated"))
      } catch (e) {
        console.warn("Could not save farmer notification", e)
      }

      await updateDbStatus(selectedProduct.id, "Rejected by Processor")
      setPipelineStep("interested")
    }

    // Reset Form
    setIsVerifyModalOpen(false)
    setQrScanned(false)
    setInfoVerified("")
    setRemarksInput("")
    setIsInspectionConfirmed(false)
    setRejectionReasonInput("")
    setShowRejectionForm(false)
    setSelectedProduct(null)
  }

  // Complete Processing Action (Manual Processed Quantity + Manual Estimated Shelf Life Date + Auto Completion Date & Time)
  const handleCompleteProcessing = async (
    batchId: string, 
    processedQty: number,
    expiryDateInput: string
  ) => {
    const batch = batches[batchId]
    if (!batch) return

    const now = new Date()
    const formattedDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    const formattedTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    const formattedExpiry = formatToDdMmYyyy(expiryDateInput)
    const shelfLifeDays = computeShelfLifeDays(expiryDateInput)

    const updatedLogs = [
      ...batch.stageLogs,
      { 
        stage: "Processing Completed", 
        date: formattedDate, 
        time: formattedTime, 
        remarks: `Processing completed. Processed Quantity: ${processedQty} kg. Estimated Shelf Life: ${formattedExpiry} (${shelfLifeDays} Days).` 
      },
      { 
        stage: "Transferred", 
        date: formattedDate, 
        time: formattedTime, 
        remarks: `Certified batch ready and transferred to distribution pipeline.` 
      }
    ]

    const updatedBatch: ProcessingBatch = {
      ...batch,
      stage: "Transferred",
      stageLogs: updatedLogs,
      processedQuantity: processedQty,
      estimatedShelfLifeDays: shelfLifeDays,
      expiryDate: formattedExpiry,
      completionDate: formattedDate,
      completionTime: formattedTime,
      transferDate: formattedDate,
      transferTime: formattedTime
    }

    const updatedBatches = { ...batches, [batchId]: updatedBatch }
    persistProcessorState({ batches: updatedBatches })

    addLog(`Completed Processing for Batch ${batchId} (${processedQty} kg, Est. Shelf Life: ${formattedExpiry})`, "Processing Completed", batch.productId, batchId)
    await updateDbStatus(batch.productId, "In Transit")
    setProcessingModalBatch(null)
    setPipelineStep("completed")
    openDispatchModal(updatedBatch)
  }

  // Distributor Logistics Fleet Fetching & Dispatch Assignment
  const fetchDistributors = async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingDistributors(true)
      const res = await axios.get(`${API}/processor/distributors`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.success) {
        setAvailableDistributors(res.data.distributors || [])
        setAvailableRetailers(res.data.retailers || [])
      }
    } catch (err) {
      console.warn("Could not load distributors from API", err)
      setAvailableDistributors([])
      setAvailableRetailers([])
    } finally {
      if (!isSilent) setLoadingDistributors(false)
    }
  }

  const syncDeliveryRequests = async () => {
    try {
      const res = await axios.get(`${API}/processor/delivery-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.success && res.data.data) {
        const serverRequests: any[] = res.data.data
        setBatches((prevBatches) => {
          let hasChanges = false
          const nextBatches = { ...prevBatches }
          Object.keys(nextBatches).forEach((batchId) => {
            const b = nextBatches[batchId]
            const matchedReq = serverRequests.find(
              (r) =>
                r.batch_number === b.batchId ||
                r.product_id === b.productId ||
                r.tracking_id === b.trackingId ||
                r.id === b.trackingId
            )
            if (matchedReq) {
              const isNowTransferred = b.stage !== "Transferred"
              if (
                isNowTransferred ||
                b.deliveryRequestStatus !== matchedReq.status ||
                (matchedReq.status === "DECLINED" && b.declineReason !== matchedReq.decline_reason) ||
                b.pickupQrToken !== matchedReq.pickup_qr_token ||
                b.driverName !== matchedReq.driver_name
              ) {
                hasChanges = true
                nextBatches[batchId] = {
                  ...b,
                  stage: "Transferred",
                  deliveryRequestStatus: matchedReq.status,
                  declineReason: matchedReq.decline_reason,
                  distributorName: matchedReq.distributor?.name || b.distributorName,
                  distributorId: matchedReq.distributor?.id || b.distributorId,
                  trackingId: matchedReq.tracking_id || matchedReq.id || b.trackingId,
                  distributorVehicle: matchedReq.vehicle_number || matchedReq.distributor?.vehicle_number || b.distributorVehicle,
                  blockchainTx: matchedReq.blockchain_hash || b.blockchainTx,
                  driverName: matchedReq.driver_name,
                  driverPhone: matchedReq.driver_phone,
                  pickupQrToken: matchedReq.pickup_qr_token,
                  pickupQrData: matchedReq.pickup_qr_data
                }
              }
            }
          })
          // Auto-reconstruct missing dispatched batches from server requests
          serverRequests.forEach((req: any) => {
            const batchNum = req.batch_number || `PB-${req.id?.slice(0, 6)}`
            const alreadyExists = Object.values(nextBatches).some(
              b => b.batchId === batchNum || b.trackingId === req.id || b.trackingId === req.tracking_id
            )
            if (!alreadyExists) {
              hasChanges = true
              nextBatches[batchNum] = {
                batchId: batchNum,
                productId: req.product_id || req.product?.id || `prod-${batchNum}`,
                originalProduct: req.product || {
                  id: req.product_id || `prod-${batchNum}`,
                  name: req.product_name || "Agro Produce Batch",
                  quantity: req.quantity || 100,
                  batch_number: batchNum,
                  category: "Processed",
                  status: "In Transit"
                } as any,
                processorName: processorName,
                facilityLocation: processorAddress,
                stage: req.status === "DELIVERED" ? "Transferred" : "Transferred",
                stageLogs: [{
                  stage: "Dispatched",
                  date: req.created_at ? new Date(req.created_at).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB"),
                  time: "10:00 AM",
                  remarks: `Dispatched to carrier ${req.distributor?.name || "Assigned Driver"}`
                }],
                processedQuantity: req.quantity,
                deliveryRequestStatus: req.status,
                distributorName: req.distributor?.name,
                distributorId: req.distributor?.id,
                trackingId: req.tracking_id || req.id,
                distributorVehicle: req.vehicle_number || req.distributor?.vehicle_number,
                blockchainTx: req.blockchain_hash,
                driverName: req.driver_name,
                driverPhone: req.driver_phone,
                pickupQrToken: req.pickup_qr_token,
                pickupQrData: req.pickup_qr_data,
                createdDate: req.created_at ? new Date(req.created_at).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB"),
                createdTime: "10:00 AM"
              }
            }
          })

          if (hasChanges) {
            localStorage.setItem("processor_batches", JSON.stringify(nextBatches))
            return nextBatches
          }
          return prevBatches
        })
      }
    } catch {
      // silent
    }
  }

  const handleGeneratePickupQR = async (batch: ProcessingBatch) => {
    setPickupModalData({ isOpen: true, loading: true, batch })
    try {
      const reqRes = await axios.get(`${API}/processor/delivery-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const requests = reqRes.data?.data || []
      const matched = requests.find(
        (r: any) =>
          r.batch_number === batch.batchId ||
          r.product_id === batch.productId ||
          r.id === batch.trackingId ||
          r.shipment_tracking_id === batch.trackingId
      )
      const targetId = matched?.id || batch.trackingId

      const genRes = await axios.post(
        `${API}/processor/delivery-requests/${targetId}/generate-pickup-qr`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (genRes.data?.success) {
        const qrPayload = genRes.data.data
        const tokenStr = qrPayload.pickup_token || qrPayload.pickup_qr_token || qrPayload.qr_payload;
        const dataStr = qrPayload.qr_payload || qrPayload.pickup_qr_data || tokenStr;
        setPickupModalData({
          isOpen: true,
          loading: false,
          batch,
          qrToken: tokenStr,
          qrData: dataStr,
          txHash: qrPayload.blockchain_hash
        })

        setBatches((prevBatches) => {
          const next = { ...prevBatches }
          if (next[batch.batchId]) {
            next[batch.batchId] = {
              ...next[batch.batchId],
              deliveryRequestStatus: "PICKUP_QR_GENERATED",
              pickupQrToken: tokenStr,
              pickupQrData: dataStr,
              blockchainTx: qrPayload.blockchain_hash || next[batch.batchId].blockchainTx
            }
          }
          localStorage.setItem("processor_batches", JSON.stringify(next))
          return next
        })

        addLog(
          `Generated Blockchain Pickup QR for Batch ${batch.batchId}`,
          "Transferred",
          batch.productId,
          batch.batchId
        )
      } else {
        setPickupModalData({
          isOpen: true,
          loading: false,
          batch,
          error: genRes.data?.message || "Failed to generate pickup QR."
        })
      }
    } catch (err: any) {
      setPickupModalData({
        isOpen: true,
        loading: false,
        batch,
        error: err.response?.data?.message || "Failed to generate pickup QR on server."
      })
    }
  }

  const openDispatchModal = (batch: ProcessingBatch) => {
    setDispatchModalBatch(batch)
    setDispatchSuccessResult(null)
    setDispatchNotesInput(`Cold-chain handover verified. Batch ${batch.batchId} certified produce.`)
    fetchDistributors()
    if (availableDistributors.length > 0) {
      const avail = availableDistributors.find(d => d.current_status === "AVAILABLE") || availableDistributors[0]
      setSelectedDistributorId(avail.id)
    }

    const defaultProcLoc = getProcessorLocation(user?.email || user?.name)
    setProcessorPickupLocation(defaultProcLoc)

    // Pull verified active profile location for processor
    axios.get(`${API}/profile/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.data.success && res.data.data?.active_profile?.address) {
          setProcessorPickupLocation(res.data.data.active_profile.address)
        }
      })
      .catch(err => console.warn("Failed to fetch verified processor profile for dispatch", err))

    if (availableRetailers.length > 0) {
      const firstRet = availableRetailers[0]
      setSelectedRetailerId(firstRet.id)
      setSelectedDestinationStore(firstRet.name)
      setDestinationStoreAddress(getRetailerLocation(firstRet.email || firstRet.name))

      // Pull verified active profile location for retailer
      axios.get(`${API}/profile/user/${firstRet.id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.data.success && res.data.data?.address) {
            setDestinationStoreAddress(res.data.data.address)
            setSelectedDestinationStore(res.data.data.business_name || firstRet.name)
          }
        })
        .catch(err => console.warn("Failed to fetch verified retailer profile for dispatch", err))
    } else {
      setSelectedDestinationStore("Metro Fresh Mart (Koramangala)")
      setDestinationStoreAddress(getRetailerLocation("retailer@gmail.com"))
    }
  }

  const handleAssignDistributor = async () => {
    if (!dispatchModalBatch || !selectedDistributorId) return
    setDispatchLoading(true)
    try {
      const chosenDist = availableDistributors.find((d) => d.id === selectedDistributorId)
      const chosenRet = availableRetailers.find((r) => r.id === selectedRetailerId)
      const storeName = selectedDestinationStore || chosenRet?.name || "Metro Fresh Mart"
      const storeLoc = destinationStoreAddress || getRetailerLocation(chosenRet?.email || chosenRet?.name)
      const targetStoreWithAddress = `${storeName} — ${storeLoc}`
      const targetStoreName = targetStoreWithAddress

      let trackingId = `REQ-${Date.now()}`

      // Call Backend API to send formal delivery request to distributor
      try {
        const res = await axios.post(
          `${API}/processor/request-delivery`,
          {
            product_id: dispatchModalBatch.productId,
            distributor_id: selectedDistributorId,
            retailer_id: selectedRetailerId || undefined,
            destination_store: targetStoreWithAddress,
            pickup_location: processorPickupLocation || processorAddress,
            required_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            temperature_sla: "2°C to 6°C Precision Chilled",
            dispatch_notes: dispatchNotesInput,
            quantity: dispatchModalBatch.processedQuantity || dispatchModalBatch.originalProduct.quantity
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (res.data?.success && res.data.data) {
          trackingId = res.data.data.tracking_id || trackingId
        }
      } catch (apiErr) {
        console.warn("Backend API request-delivery warning, proceeding with local update:", apiErr)
      }

      // Update batch in local state & localStorage
      const updatedBatch: ProcessingBatch = {
        ...dispatchModalBatch,
        distributor: chosenDist?.fleet_name || chosenDist?.name || "Distributor Fleet",
        distributorId: selectedDistributorId,
        distributorName: chosenDist?.name || "Distributor",
        distributorVehicle: chosenDist?.vehicle_number || "KA-04-E2941",
        destinationHub: targetStoreName,
        destinationStore: targetStoreName,
        trackingId: trackingId,
        deliveryRequestStatus: "REQUESTED",
        declineReason: undefined
      }

      const updatedBatches = { ...batches, [dispatchModalBatch.batchId]: updatedBatch }
      persistProcessorState({ batches: updatedBatches })

      addLog(
        `Dispatched Delivery Request for Batch ${dispatchModalBatch.batchId} to ${chosenDist?.name || 'Distributor'} (${targetStoreName})`,
        "Transferred",
        dispatchModalBatch.productId,
        dispatchModalBatch.batchId
      )

      setDispatchSuccessResult({
        tracking_id: trackingId,
        blockchain_hash: null,
        message: `Delivery request for Batch ${dispatchModalBatch.batchId} successfully sent to ${chosenDist?.name || 'Distributor'}. The distributor will review and choose to accept or decline.`
      })
    } catch (err: any) {
      console.error("Failed to send delivery request", err)
    } finally {
      setDispatchLoading(false)
    }
  }






  // Filter and Sort logic
  const filteredProducts = products
    .filter(p => {
      // 1. Search filter
      const term = searchTerm.trim().toLowerCase()
      const cleanTerm = term.replace(/^fp-?/i, '')
      const mappedId = (p.product_id && p.product_id >= 100000 && p.product_id <= 999999)
        ? p.product_id
        : 100000 + (Math.abs(Number(p.product_id || 0)) % 899999)
      const fullProductIdStr = `fp-${mappedId}`.toLowerCase()

      const productName = (p.name || "").toLowerCase()
      const farmerName = (p.farmer?.name || "Ravi").toLowerCase()
      const farmerEmail = (p.farmer?.email || "").toLowerCase()
      const categoryName = (p.category || "").toLowerCase()
      const batchNo = (p.batch_number || "").toLowerCase()

      const matchesSearch = !term ||
        productName.includes(term) ||
        fullProductIdStr.includes(term) ||
        String(mappedId).includes(cleanTerm || term) ||
        String(p.product_id || "").includes(cleanTerm || term) ||
        farmerName.includes(term) ||
        farmerEmail.includes(term) ||
        categoryName.includes(term) ||
        batchNo.includes(term)
      
      // 2. Category filter (case-insensitive & matches singular/plural roots)
      const matchesCategory = filterCategory === "all" || (() => {
        const cat = (p.category || "").toLowerCase().trim()
        const target = filterCategory.toLowerCase().trim()
        if (target === "fruits") return cat.startsWith("fruit")
        if (target === "vegetables") return cat.startsWith("veg")
        if (target === "grains") return cat.startsWith("grain")
        return cat === target
      })()

      // 3. Status filter
      // Only available/harvested farmer products appear in the browse marketplace.
      const statusLower = (p.status || "").toLowerCase().trim()
      const matchesStatus = statusLower === "harvested" || statusLower === "available"

      // 4. Exclude products declined by farmer for this processor
      const isDeclined = Boolean(
        declinedProducts[p.id] ||
        declinedProducts[String(p.id)] ||
        (p.batch_number && declinedProducts[p.batch_number]) ||
        ((p as any).batchNumber && declinedProducts[(p as any).batchNumber])
      )

      return matchesSearch && matchesCategory && matchesStatus && !isDeclined
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === "quantity") return b.quantity - a.quantity
      return 0
    })

  // Strict Active DB Product Validation & Deduplication across pipeline & history
  const validProductIds = new Set(products.map(p => String(p.id)))
  const validBatchNumbers = new Set(products.map(p => String(p.batch_number || "")).filter(Boolean))

  const isValidBatch = (b: ProcessingBatch) => {
    if (!b || !b.originalProduct) return false
    const pId = String(b.productId || b.originalProduct?.id || "")
    const bNum = String(b.originalProduct?.batch_number || (b.originalProduct as any)?.batchNumber || "")
    return validProductIds.has(pId) || (bNum && validBatchNumbers.has(bNum))
  }

  const deduplicateBatches = (batchList: ProcessingBatch[]) => {
    const map = new Map<string, ProcessingBatch>()
    for (const b of batchList) {
      if (!isValidBatch(b)) continue
      const key = String(b.productId || b.originalProduct?.id || b.originalProduct?.batch_number || b.batchId)
      if (!map.has(key)) {
        map.set(key, b)
      } else {
        const existing = map.get(key)!
        const stageWeight = (s: string) => s === "Transferred" ? 3 : s === "Processing Completed" ? 2 : 1
        if (stageWeight(b.stage) >= stageWeight(existing.stage)) {
          map.set(key, b)
        }
      }
    }
    return Array.from(map.values())
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-20 pt-6">
      {/* Header bar */}
      <div className="border-b border-emerald-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-200">
            {activeTab === "demands" ? (
              <Store className="h-7 w-7" />
            ) : activeTab === "inventory" ? (
              <Boxes className="h-7 w-7" />
            ) : activeTab === "profile" ? (
              <ShieldCheck className="h-7 w-7" />
            ) : (
              <Factory className="h-7 w-7" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-emerald-950">
              {activeTab === "browse" && "Processor Operations & Marketplace"}
              {activeTab === "pipeline" && "Processing Pipeline & Dispatch"}
              {activeTab === "inventory" && "Warehouse Inventory & Stock Management"}
              {activeTab === "demands" && "Retailer Demand Desk"}
              {activeTab === "history" && "Operational History & Audit"}
              {activeTab === "profile" && "Facility Profile & Compliance"}
            </h1>
            <p className="text-slate-600 text-sm mt-0.5 font-medium">
              {activeTab === "browse" && "Browse, source, and inspect crops registered by local farmers."}
              {activeTab === "pipeline" && "Track gate intake, AI quality inspection, crate packaging, and distributor handover."}
              {activeTab === "inventory" && "Manage farmer produce batches, track available vs allocated stock, and fulfill retailer demands."}
              {activeTab === "demands" && "Review incoming retailer purchase orders. Fulfill from stock or broadcast to farmers."}
              {activeTab === "history" && "Chronological audit logs and history of all processor facility transactions."}
              {activeTab === "profile" && "Manage verified legal facility name, FSSAI / trade license, and physical pickup address."}
            </p>
          </div>
        </div>

        {/* Tab Quick Selector (White & Green Theme) */}
        <div className="flex overflow-x-auto gap-2 mt-5 pt-1 pb-1 no-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0">
          <button
            onClick={() => setActiveTab("browse")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "browse"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200"
            }`}
          >
            Farmer Crops & Batches
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "pipeline"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200"
            }`}
          >
            Processing Pipeline
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "inventory"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200"
            }`}
          >
            <Boxes className="h-3.5 w-3.5" />
            Inventory & Stock
          </button>
          <button
            onClick={() => setActiveTab("demands")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "demands"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200"
            }`}
          >
            <Store className="h-3.5 w-3.5" />
            Retailer Demand Desk
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200"
            }`}
          >
            Operational History
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "profile"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Facility Profile
          </button>
        </div>
      </div>

      {/* Tabs rendering */}
      {activeTab === "browse" && (
        <Card className="rounded-3xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 py-5 px-6">
            <CardTitle className="text-xl font-extrabold text-emerald-950">Available Farmer Harvests</CardTitle>
            <CardDescription className="text-slate-600 text-xs mt-0.5">
              Browse, search, and procure freshly harvested agricultural produce directly from verified farmers.
            </CardDescription>
            
            {/* Search, Filter, Sort Controls - Clean 3 Columns */}
            <div className="grid gap-3 md:grid-cols-3 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-emerald-700/60" />
                <input
                  type="text"
                  placeholder="Search crop name, ID, farmer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 w-full rounded-xl border border-emerald-200 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                />
              </div>

              <div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="h-10 w-full rounded-xl border border-emerald-200 bg-white text-slate-800 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Fruits">Fruits</option>
                  <option value="Grains">Grains</option>
                </select>
              </div>

              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-10 w-full rounded-xl border border-emerald-200 bg-white text-slate-800 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="quantity">Largest Quantity</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-white">
            {loadingProducts ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                <p className="text-slate-600 text-sm font-medium">Fetching real farm data from network...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 text-slate-500 space-y-2">
                <AlertCircle className="h-12 w-12 text-slate-400 mx-auto" />
                <p className="text-lg font-bold text-slate-800">No products found</p>
                <p className="text-xs text-slate-500">Try broadening your search term or select another category.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((p) => {
                  const prodId = String(p.id)
                  const isInterested = interests.includes(prodId) || interests.includes(p.id)
                  const mappedId = (p.product_id && p.product_id >= 100000 && p.product_id <= 999999)
                    ? p.product_id
                    : 100000 + (Math.abs(Number(p.product_id || 0)) % 899999)
                  
                  return (
                    <div key={p.id} className="rounded-3xl border border-emerald-200 bg-white hover:border-emerald-400 hover:shadow-md transition-all p-6 space-y-4 flex flex-col justify-between shadow-xs">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                              {p.category}
                            </span>
                          </div>
                          {isInterested && (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold flex items-center gap-1">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Interested
                            </span>
                          )}
                        </div>
                        
                        <div>
                          <h3 className="font-black text-xl text-slate-900 flex items-center gap-1.5">
                            {p.name.includes("Tomato") ? "🍅" : p.name.includes("Mango") ? "🥭" : p.name.includes("Avocado") ? "🥑" : p.name.includes("Wheat") ? "🌾" : "🌱"}
                            {p.name}
                          </h3>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">Product ID: FP-{mappedId}</p>
                        </div>

                        <div className="border-t border-emerald-100 pt-3 space-y-2 text-xs text-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-emerald-600" /> Farmer:
                            </span>
                            <strong className="text-slate-900">{p.farmer?.name || "Ravi"}</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Origin:
                            </span>
                            <span className="text-slate-700 text-right truncate max-w-[170px]">{getFarmerLocation(p)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 flex items-center gap-1.5">
                              <Package className="h-3.5 w-3.5 text-emerald-600" /> Yield Qty:
                            </span>
                            <strong className="text-emerald-800 font-bold text-sm">{p.quantity} kg</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-emerald-600" /> Harvested:
                            </span>
                            <span className="text-slate-600 font-medium">
                              {new Date(p.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-emerald-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold cursor-pointer"
                          onClick={() => setSelectedProduct(p)}
                        >
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          disabled={isInterested}
                          className={`flex-1 rounded-xl text-xs font-bold shadow-xs cursor-pointer ${
                            isInterested
                              ? "bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed opacity-90"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white"
                          }`}
                          onClick={() => markInterest(p)}
                        >
                          {isInterested ? "Interested ✓" : "Express Interest"}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "pipeline" && (() => {
        const isProductDispatched = (p: Product) => {
          const isDeclined = Boolean(
            deals[String(p.id)] === "declined" ||
            deals[p.batch_number || ""] === "declined" ||
            deals[p.id] === "declined" ||
            declinedProducts[p.id] ||
            declinedProducts[String(p.id)] ||
            (p.batch_number && declinedProducts[p.batch_number]) ||
            ((p as any).batchNumber && declinedProducts[(p as any).batchNumber])
          )
          if (isDeclined) return false

          return (
            p.status === "In Transit" ||
            p.status === "Processing" ||
            p.status === "Delivered" ||
            deals[String(p.id)] === "dispatched" ||
            deals[p.batch_number || ""] === "dispatched" ||
            deals[p.id] === "dispatched"
          )
        }

        const isProductDecidedOrBatched = (p: Product) => {
          const pId = String(p.id)
          const bNum = String(p.batch_number || "")
          const hasDecision = Boolean(decisions[pId] || (bNum && decisions[bNum]))
          const hasBatch = Object.values(batches).some(b => 
            isValidBatch(b) && (String(b.productId) === pId || String(b.originalProduct?.id) === pId || (bNum && String(b.originalProduct?.batch_number) === bNum))
          )
          return hasDecision || hasBatch
        }

        const interestedProductsList = products.filter(p => 
          (interests.includes(String(p.id)) || interests.includes(p.id)) &&
          !isProductDispatched(p) &&
          !isProductDecidedOrBatched(p)
        )

        const receivedProductsList = products.filter(p => 
          (interests.includes(String(p.id)) || interests.includes(p.id) || p.status === "In Transit" || p.status === "Processing") &&
          isProductDispatched(p) &&
          !isProductDecidedOrBatched(p)
        )

        const allUniqueBatches = deduplicateBatches(Object.values(batches))

        const activeProcessingBatchesList = allUniqueBatches.filter(
          b => b.stage !== "Processing Completed" && b.stage !== "Transferred" && !b.deliveryRequestStatus
        )

        // Helper to check if a batch has been physically collected / in transit / delivered by distributor
        const isBatchCollectedByDistributor = (b: ProcessingBatch) => {
          const st = (b.deliveryRequestStatus || "").toUpperCase()
          return (
            st === "IN_TRANSIT" ||
            st === "PICKED_UP" ||
            st === "ARRIVED_AT_RETAILER" ||
            st === "DELIVERED" ||
            st === "COMPLETED"
          )
        }

        // Active batches awaiting carrier assignment, pickup QR generation, or driver dock scan
        const transferredBatchesList = allUniqueBatches.filter(
          b => (b.stage === "Transferred" || Boolean(b.deliveryRequestStatus) || b.stageLogs?.some(l => l.stage === "Transferred")) &&
               !isBatchCollectedByDistributor(b)
        )

        // Batches already collected by carrier (custody handed over and en route or delivered)
        const collectedBatchesList = allUniqueBatches.filter(
          b => (b.stage === "Transferred" || Boolean(b.deliveryRequestStatus) || b.stageLogs?.some(l => l.stage === "Transferred")) &&
               isBatchCollectedByDistributor(b)
        )

        return (
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Pipeline Sidebar Step controls */}
          <Card className="col-span-1 rounded-3xl border border-emerald-200 bg-white shadow-sm p-4 h-fit space-y-2">
            <h3 className="font-black text-lg px-2 mb-3 text-emerald-950">Pipeline Status</h3>
            {[
              { id: "interested", label: "★ Interested Products", count: interestedProductsList.length },
              { id: "received", label: "📥 Received / Verify QR", count: receivedProductsList.length },
              { id: "processing", label: "🏭 Active Processing", count: activeProcessingBatchesList.length },
              { id: "completed", label: "🚚 Transferred to Distributor", count: transferredBatchesList.length }
            ].map((step) => (
              <button
                key={step.id}
                onClick={() => setPipelineStep(step.id as any)}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between text-sm transition-all ${
                  pipelineStep === step.id
                    ? "bg-emerald-600 text-white font-bold shadow-xs"
                    : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 font-medium"
                }`}
              >
                <span>{step.label}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  pipelineStep === step.id ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}>{step.count}</span>
              </button>
            ))}
          </Card>

          {/* Pipeline Main Window */}
          <Card className="col-span-3 rounded-3xl border border-emerald-200 bg-white shadow-sm p-6 min-h-[500px]">
            {pipelineStep === "interested" && (
              <div className="space-y-4">
                <div className="border-b border-emerald-100 pb-4">
                  <h3 className="text-xl font-black text-emerald-950">Interested Farmer Yields</h3>
                  <p className="text-slate-600 text-sm">Farmer registered products you marked interest in. Once the farmer prepares and dispatches them, they move to "Received / Verify QR".</p>
                </div>

                {interestedProductsList.length === 0 ? (
                  <div className="text-center py-20 text-slate-500">
                    <Star className="h-10 w-10 mx-auto text-emerald-300 mb-3" />
                    <p className="font-bold text-lg text-slate-800">No pending interested products</p>
                    <p className="text-sm text-slate-500">Browse available products and click "Express Interest" to request them from farmers.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {interestedProductsList.map(p => {
                      const isDeclined = Boolean(
                        deals[String(p.id)] === "declined" ||
                        deals[p.batch_number || ""] === "declined" ||
                        deals[p.id] === "declined" ||
                        declinedProducts[p.id] ||
                        declinedProducts[String(p.id)] ||
                        (p.batch_number && declinedProducts[p.batch_number]) ||
                        ((p as any).batchNumber && declinedProducts[(p as any).batchNumber])
                      )
                      const isAccepted = deals[String(p.id)] === "accepted" || deals[p.batch_number || ""] === "accepted" || deals[p.id] === "accepted" || p.status === "Accepted"
                      const dealStatus = isDeclined ? "declined" : isAccepted ? "accepted" : "requested"

                      if (isDeclined || dealStatus === "declined") {
                        return (
                          <div key={p.id} className="p-5 rounded-2xl border border-red-200 bg-red-50/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-lg text-slate-900 flex items-center gap-1.5">
                                  {p.name.includes("Tomato") ? "🍅" : p.name.includes("Mango") ? "🥭" : "🌱"}
                                  {p.name}
                                </h4>
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                                  ❌ Declined by Farmer
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">
                                Farmer: {p.farmer?.name || "Ravi"} • Quantity: {p.quantity} kg • Batch: {p.batch_number || p.id}
                              </p>
                              <p className="text-xs text-red-700 mt-1 font-medium">
                                Farmer declined your procurement request. This yield has been released back to the open market.
                              </p>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto items-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedProduct(p)}
                                className="rounded-xl flex-1 md:flex-initial border-emerald-200 text-emerald-800 hover:bg-emerald-50 font-bold"
                              >
                                Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDismissDeclined(String(p.id), p.batch_number)}
                                className="rounded-xl border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400 flex-1 md:flex-initial gap-1.5 font-bold"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Dismiss from Pipeline
                              </Button>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={p.id} className="p-5 rounded-2xl border border-emerald-200 bg-white hover:border-emerald-300 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-lg text-slate-900 flex items-center gap-1.5">
                                {p.name.includes("Tomato") ? "🍅" : p.name.includes("Mango") ? "🥭" : "🌱"}
                                {p.name}
                              </h4>
                              {dealStatus === "requested" && (
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                  ⏳ Awaiting Farmer Acceptance
                                </span>
                              )}
                              {dealStatus === "accepted" && (
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                                  📦 Farmer Preparing Batch
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1">Farmer: {p.farmer?.name || "Ravi"} • Quantity: {p.quantity} kg • Batch: {p.batch_number || p.id}</p>
                          </div>
                          <div className="flex gap-2 w-full md:w-auto items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedProduct(p)}
                              className="rounded-xl flex-1 md:flex-initial border-emerald-200 text-emerald-800 hover:bg-emerald-50 font-bold"
                            >
                              Details
                            </Button>
                            <Button
                              size="sm"
                              disabled
                              title={dealStatus === "requested" ? "Waiting for farmer to accept your interest request." : "Waiting for farmer to mark batch ready for dispatch."}
                              className="rounded-xl text-slate-400 bg-slate-100 border border-slate-200 flex-1 md:flex-initial gap-1.5 font-medium cursor-not-allowed"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              {dealStatus === "requested" ? "Awaiting Acceptance" : "Awaiting Dispatch"}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {pipelineStep === "received" && (
              <div className="space-y-4">
                <div className="border-b border-emerald-100 pb-4">
                  <h3 className="text-xl font-black text-emerald-950">Received Products & Verification</h3>
                  <p className="text-slate-600 text-sm">Physically received produce arrived at the gate. Scan product QR code to verify blockchain authenticity and certify scale weight.</p>
                </div>

                {receivedProductsList.length === 0 ? (
                  <div className="text-center py-20 text-slate-500">
                    <Package className="h-10 w-10 mx-auto text-emerald-300 mb-3" />
                    <p className="font-bold text-lg text-slate-800">No received items awaiting check</p>
                    <p className="text-sm text-slate-500">Produce dispatched by farmers will arrive here automatically for gate intake and QR code scanning.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {receivedProductsList.map(p => (
                      <div key={p.id} className="p-5 rounded-2xl border border-emerald-200 bg-white hover:border-emerald-300 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-lg text-slate-900 flex items-center gap-1.5">
                              {p.name.includes("Tomato") ? "🍅" : p.name.includes("Mango") ? "🥭" : "🌱"}
                              {p.name}
                            </h4>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                              🚚 Arrived at Gate / Ready for Inspection
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">Farmer: {p.farmer?.name || "Ravi"} • Registered: {p.quantity} kg • Batch: {p.batch_number || p.id}</p>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedProduct(p)}
                            className="rounded-xl flex-1 md:flex-initial border-emerald-200 text-emerald-800 hover:bg-emerald-50 font-bold"
                          >
                            Details
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedProduct(p)
                              setReceivedQtyInput(String(receipts[p.id]?.receivedQty || p.quantity))
                              setRemarksInput("")
                              setIsInspectionConfirmed(false)
                              setIsVerifyModalOpen(true)
                            }}
                            className="rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 font-bold shadow-xs flex-1 md:flex-initial cursor-pointer gap-2"
                          >
                            <QrCode className="h-4 w-4" />
                            Scan QR & Verify
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pipelineStep === "processing" && (
              <div className="space-y-6">
                <div className="border-b border-emerald-100 pb-4">
                  <h3 className="text-xl font-black text-emerald-950">Active Processing Batches</h3>
                  <p className="text-slate-600 text-sm">Accepted batches currently undergoing sorting, processing, packaging or final verification.</p>
                </div>

                {activeProcessingBatchesList.length === 0 ? (
                  <div className="text-center py-20 text-slate-500">
                    <Factory className="h-10 w-10 mx-auto text-emerald-300 mb-3" />
                    <p className="font-bold text-lg text-slate-800">No active batches in processing</p>
                    <p className="text-sm text-slate-500">Accept a received product from "Received / Verify QR" to create a processing batch.</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {activeProcessingBatchesList.map(b => (
                      <div key={b.batchId} className="p-6 rounded-3xl border border-emerald-200 bg-white space-y-5 shadow-xs">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                          <div>
                            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Batch: {b.batchId}
                            </span>
                            <h4 className="font-black text-xl mt-2 text-slate-900">
                              {b.originalProduct.name} Processing Pipeline
                            </h4>
                            <p className="text-xs text-slate-600">Original ID: FP-{(b.originalProduct.product_id && b.originalProduct.product_id >= 100000 && b.originalProduct.product_id <= 999999) ? b.originalProduct.product_id : 100000 + (Math.abs(Number(b.originalProduct.product_id || 0)) % 899999)} • Farmer: {b.originalProduct.farmer?.name || "Ravi"}</p>
                          </div>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                            {b.stage}
                          </span>
                        </div>

                        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-1">
                            <span className="text-xs font-black text-emerald-900 uppercase flex items-center gap-1.5">
                              <Package className="h-4 w-4 text-emerald-600" />
                              Batch Status: Intake Verified & Ready for Processing
                            </span>
                            <p className="text-xs text-slate-700">
                              Produce verified at scale with <strong className="text-emerald-800 font-bold">{b.originalProduct.ai_quality_score || 90}% ({b.originalProduct.ai_quality_label || "Grade A"})</strong> quality score.
                            </p>
                          </div>
                          <Button
                            onClick={() => openProcessingModal(b)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs gap-2 shrink-0 shadow-xs py-2.5 px-4 cursor-pointer"
                          >
                            <Package className="h-4 w-4" />
                            📦 Complete Processing
                          </Button>
                        </div>

                        {/* AI Quality & Intake Details */}
                        <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-2xl grid gap-4 md:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-emerald-600" />
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold">AI Quality Score</p>
                              <p className="text-sm font-bold text-emerald-900">{b.originalProduct.ai_quality_score || 90}% ({b.originalProduct.ai_quality_label || "Grade A"})</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Scale className="h-5 w-5 text-emerald-600" />
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold">Intake Scale Weight</p>
                              <p className="text-sm font-bold text-slate-900">{receipts[b.originalProduct.id]?.receivedQty || b.originalProduct.quantity} kg</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQrViewBatch(b)}
                            className="rounded-xl text-xs font-bold gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            Batch QR Sticker
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pipelineStep === "completed" && (
              <div className="space-y-6">
                <div className="border-b border-emerald-100 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black flex items-center gap-2 text-emerald-950">
                        <Truck className="h-6 w-6 text-emerald-600" />
                        Transferred to Distributor (Dispatch Manifest)
                      </h3>
                      <p className="text-slate-600 text-sm">
                        Verified agricultural yields packaged, quality-certified, and awaiting carrier pickup and blockchain handoff verification.
                      </p>
                    </div>
                    {collectedBatchesList.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveTab("history")
                          setHistorySubTab("transferred")
                        }}
                        className="border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 rounded-xl text-xs font-bold gap-1.5 self-start sm:self-auto shrink-0"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        View Past Dispatches ({collectedBatchesList.length})
                      </Button>
                    )}
                  </div>
                </div>

                {transferredBatchesList.length === 0 ? (
                  collectedBatchesList.length > 0 ? (
                    <div className="text-center py-16 px-4 bg-emerald-50/40 border border-emerald-200 rounded-3xl space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                        <CheckCircle className="h-7 w-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-black text-lg text-emerald-950">All Dispatches Collected by Carrier</p>
                        <p className="text-sm text-slate-600 max-w-md mx-auto">
                          Distributor drivers have scanned the pickup QR and taken physical custody of all transferred batches. No batches are currently awaiting dock collection.
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-center gap-3">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setActiveTab("history")
                            setHistorySubTab("transferred")
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          View Collected Dispatches in History ({collectedBatchesList.length})
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-500 space-y-2">
                      <Truck className="h-12 w-12 mx-auto text-emerald-300 mb-2" />
                      <p className="font-bold text-lg text-slate-800">No batches transferred yet</p>
                      <p className="text-sm text-slate-500">Package and transfer an active processing batch to generate its dispatch manifest here.</p>
                    </div>
                  )
                ) : (
                  <div className="grid gap-6">
                    {transferredBatchesList.map(b => {
                      const originalId = (b.originalProduct.product_id && b.originalProduct.product_id >= 100000 && b.originalProduct.product_id <= 999999) 
                        ? b.originalProduct.product_id 
                        : 100000 + (Math.abs(Number(b.originalProduct.product_id || 0)) % 899999)
                      const receivedWeight = receipts[b.originalProduct.id]?.receivedQty || b.originalProduct.quantity

                      return (
                        <div key={b.batchId} className="p-6 rounded-3xl border border-emerald-200 bg-white hover:border-emerald-300 transition-all space-y-5 shadow-xs">
                          {/* Top Row: Batch Identity & Status */}
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-emerald-100 pb-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Batch {b.batchId}
                                </span>
                                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                  Farm Origin: FP-{originalId}
                                </span>
                              </div>
                              <h4 className="font-black text-xl text-slate-900 flex items-center gap-2 pt-1">
                                {b.originalProduct.name.includes("Tomato") ? "🍅" : b.originalProduct.name.includes("Mango") ? "🥭" : b.originalProduct.name.includes("Wheat") ? "🌾" : "🌱"}
                                {b.originalProduct.name}
                              </h4>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              b.deliveryRequestStatus === "DECLINED"
                                ? "bg-red-100 text-red-900 border border-red-300"
                                : b.deliveryRequestStatus === "ACCEPTED"
                                ? "bg-indigo-100 text-indigo-900 border border-indigo-300"
                                : b.deliveryRequestStatus === "PICKUP_QR_GENERATED"
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : b.deliveryRequestStatus === "REQUESTED"
                                ? "bg-blue-100 text-blue-900 border border-blue-300"
                                : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            }`}>
                              <Truck className="h-3.5 w-3.5 text-emerald-600" />
                              {b.deliveryRequestStatus === "DECLINED"
                                ? "Carrier Declined"
                                : b.deliveryRequestStatus === "ACCEPTED"
                                ? "Carrier Accepted — Ready for QR"
                                : b.deliveryRequestStatus === "PICKUP_QR_GENERATED"
                                ? "Pickup QR Active — Awaiting Driver Scan"
                                : b.deliveryRequestStatus === "REQUESTED"
                                ? "Delivery Requested (Pending Review)"
                                : "Awaiting Carrier Assignment"}
                            </span>
                          </div>

                          {/* 4-Grid Key Logistics Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                            <div className="p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                📦 Processed Quantity
                              </span>
                              <p className="font-bold text-sm text-slate-900">{b.processedQuantity || receivedWeight} kg</p>
                              <p className="text-[11px] text-emerald-700 font-semibold">Output Packaged Produce</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                ⏳ Estimated Shelf Life
                              </span>
                              <p className="font-bold text-sm text-slate-900">{b.expiryDate || (b.estimatedShelfLifeDays ? `${b.estimatedShelfLifeDays} Days` : "14 Days")}</p>
                              <p className="text-[11px] text-slate-600 font-medium">{b.expiryDate ? `~${b.estimatedShelfLifeDays || 14} Days Certified` : "Certified Shelf Life"}</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                🏅 Certified Quality & Grade
                              </span>
                              <p className="font-bold text-emerald-800">
                                {b.originalProduct.ai_quality_label || "Grade A"} ({b.originalProduct.ai_quality_score || 90}% Score)
                              </p>
                              <p className="text-[11px] text-slate-600 font-medium">Gate Physical Inspection</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                🕒 Processing Completed
                              </span>
                              <p className="font-semibold text-slate-900">
                                {b.completionDate || b.transferDate || b.createdDate} • {b.completionTime || b.transferTime || b.createdTime}
                              </p>
                              <p className="text-[11px] text-emerald-700 font-semibold">Recorded on Blockchain</p>
                            </div>
                          </div>

                          {/* Cold-Chain Logistics Carrier & Destination Delivery Manifest */}
                          <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-2.5">
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-emerald-600" />
                                <span className="font-black text-sm text-emerald-950">Logistics Handshake & Delivery Request</span>
                              </div>
                              <Button
                                size="sm"
                                variant={b.distributorName ? "outline" : "default"}
                                onClick={() => openDispatchModal(b)}
                                className={`rounded-xl text-xs gap-1.5 h-8 font-bold ${
                                  b.distributorName
                                    ? "border-emerald-300 text-emerald-800 hover:bg-emerald-100/60"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                                }`}
                              >
                                <Send className="h-3.5 w-3.5" />
                                {b.deliveryRequestStatus === "REQUESTED"
                                  ? "Resend / Change Carrier"
                                  : b.deliveryRequestStatus === "DECLINED"
                                  ? "Send to Another Distributor"
                                  : b.distributorName
                                  ? "View Carrier Request"
                                  : "Send Delivery Request"}
                              </Button>
                            </div>

                            {/* State 1: REQUESTED / Pending Distributor Acceptance */}
                            {b.deliveryRequestStatus === "REQUESTED" ? (
                              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                    <Clock className="h-4 w-4 text-amber-600 animate-pulse" />
                                    Delivery Request Sent — Waiting for Distributor Review
                                  </span>
                                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                                    Tracking: {b.trackingId || `REQ-${b.batchId}`}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700 pt-1">
                                  <div>Carrier: <strong className="text-slate-900 font-bold">{b.distributorName}</strong> ({b.distributorVehicle})</div>
                                  <div>Destination: <strong className="text-slate-900 font-bold">{b.destinationStore}</strong></div>
                                  <div>Status: <span className="text-amber-800 font-bold">Distributor Notified</span></div>
                                </div>
                                <p className="text-[11px] text-amber-800/90 italic">
                                  The distributor will review pickup facility, temperature SLA, and route in their dashboard to accept or decline.
                                </p>
                              </div>
                            ) : b.deliveryRequestStatus === "DECLINED" ? (
                              /* State 2: DECLINED by Distributor */
                              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 space-y-2 text-xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="font-bold text-red-900 flex items-center gap-1.5">
                                    <X className="h-4 w-4 text-red-600" />
                                    Delivery Request Declined by Distributor ({b.distributorName})
                                  </span>
                                  <Button
                                    size="sm"
                                    onClick={() => openDispatchModal(b)}
                                    className="bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs h-7 px-3 font-bold shadow-xs"
                                  >
                                    Select Another Carrier
                                  </Button>
                                </div>
                                {b.declineReason && (
                                  <p className="text-xs text-red-800">
                                    <strong>Distributor Note:</strong> "{b.declineReason}"
                                  </p>
                                )}
                              </div>
                            ) : b.deliveryRequestStatus === "ACCEPTED" ? (
                              /* State 3: ACCEPTED by Distributor -> Action: Generate Blockchain Pickup QR */
                              <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-3 text-xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                                    <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                                    Carrier Accepted Request — Action: Generate Blockchain Pickup QR
                                  </span>
                                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold">
                                    Carrier: {b.distributorName}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700 pt-1">
                                  <div>Vehicle: <strong className="text-slate-900 font-bold">{b.distributorVehicle || "Reefer Fleet"}</strong></div>
                                  <div>Destination: <strong className="text-slate-900 font-bold">{b.destinationStore}</strong></div>
                                  <div>Next Step: <span className="text-indigo-700 font-bold">Generate Pickup Pass</span></div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                  <p className="text-[11px] text-slate-600">
                                    Generate a cryptographically-signed pickup QR for the driver to scan upon arriving at your facility.
                                  </p>
                                  <Button
                                    size="sm"
                                    onClick={() => handleGeneratePickupQR(b)}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-8 px-4 font-bold shrink-0 gap-1.5 shadow-xs"
                                  >
                                    <QrCode className="h-4 w-4" />
                                    Generate Pickup QR
                                  </Button>
                                </div>
                              </div>
                            ) : b.deliveryRequestStatus === "PICKUP_QR_GENERATED" ? (
                              /* State 4: PICKUP_QR_GENERATED -> Ready for Driver Arrival & Scan */
                              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3 text-xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                                    <QrCode className="h-4 w-4 text-emerald-600 animate-pulse" />
                                    Blockchain Pickup QR Active — Awaiting Carrier Arrival
                                  </span>
                                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                                    Token: {b.pickupQrToken?.slice(0, 16) || "PKP_ACTIVE"}...
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700 pt-1">
                                  <div>Carrier: <strong className="text-slate-900 font-bold">{b.distributorName}</strong> ({b.distributorVehicle})</div>
                                  <div>Destination: <strong className="text-slate-900 font-bold">{b.destinationStore}</strong></div>
                                  <div>Status: <span className="text-emerald-800 font-bold">Ready for Driver Scan</span></div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                  <p className="text-[11px] text-slate-600">
                                    Display this QR to the driver when they reach your dock. They will scan to verify manifest & confirm custody.
                                  </p>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setPickupModalData({
                                        isOpen: true,
                                        loading: false,
                                        batch: b,
                                        qrToken: b.pickupQrToken || `PKP_${b.trackingId}`,
                                        qrData: b.pickupQrData || {},
                                        txHash: b.blockchainTx
                                      })
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs h-8 px-4 font-bold shrink-0 gap-1.5 shadow-xs"
                                  >
                                    <QrCode className="h-4 w-4" />
                                    View / Display Pickup QR
                                  </Button>
                                </div>
                              </div>
                            ) : b.deliveryRequestStatus === "IN_TRANSIT" ? (
                              /* State 5: IN_TRANSIT -> Cargo Collected, Driver en route */
                              <div className="p-3.5 rounded-2xl bg-cyan-50 border border-cyan-200 space-y-2 text-xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="font-bold text-cyan-950 flex items-center gap-1.5">
                                    <Truck className="h-4 w-4 text-cyan-600 animate-bounce" />
                                    Cargo Picked Up & In Transit to Retailer
                                  </span>
                                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 font-bold">
                                    Vehicle: {b.distributorVehicle || "Reefer Van"}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700 pt-1">
                                  <div>Driver: <strong className="text-slate-900 font-bold">{b.driverName || b.distributorName}</strong> {b.driverPhone ? `(${b.driverPhone})` : ''}</div>
                                  <div>Destination: <strong className="text-slate-900 font-bold">{b.destinationStore}</strong></div>
                                  <div>Retailer Status: <span className="text-cyan-800 font-bold">Notified with Manifest & Reg #</span></div>
                                </div>
                                <p className="text-[11px] text-cyan-800/90 italic">
                                  Cargo collected after physical QR inspection. Destination retailer received produce manifest & carrier vehicle number.
                                </p>
                              </div>
                            ) : b.deliveryRequestStatus === "ARRIVED_AT_RETAILER" ? (
                              /* State 6: ARRIVED_AT_RETAILER */
                              <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 space-y-2 text-xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="font-bold text-purple-950 flex items-center gap-1.5">
                                    <Store className="h-4 w-4 text-purple-600" />
                                    Arrived at Retailer Dock — Handoff QR Scanned & Verifying
                                  </span>
                                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 font-bold">
                                    Store: {b.destinationStore}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600">
                                  Distributor vehicle has docked at the retailer supermarket. Store officer is performing digital-physical side-by-side inspection.
                                </p>
                              </div>
                            ) : b.deliveryRequestStatus === "COMPLETED" ? (
                              /* State 7: COMPLETED */
                              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-2 text-xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                                    Delivery Verified & Accepted by Retailer — Job Completed
                                  </span>
                                  {b.blockchainTx && (
                                    <a
                                      href={`https://sepolia.etherscan.io/tx/${b.blockchainTx}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 hover:underline flex items-center gap-1 font-bold"
                                    >
                                      Sepolia: {b.blockchainTx.slice(0, 10)}... <ExternalLink className="h-3 w-3 inline" />
                                    </a>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700 pt-1">
                                  <div>Carrier: <strong className="text-slate-900 font-bold">{b.distributorName}</strong> ({b.distributorVehicle})</div>
                                  <div>Received by: <strong className="text-slate-900 font-bold">{b.destinationStore}</strong></div>
                                  <div>Distributor Role: <span className="text-emerald-800 font-bold">Successfully Completed</span></div>
                                </div>
                              </div>
                            ) : b.distributorName ? (
                              /* State 8: General Carrier Accepted fallback */
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                    🚚 Accepted Carrier
                                  </span>
                                  <p className="font-bold text-slate-900 text-sm">{b.distributorName}</p>
                                  <p className="font-mono text-[11px] text-emerald-700 font-bold">{b.distributorVehicle || "KA-04-E2941"} (Cold-Chain Reefer)</p>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                    🏬 Destination Retailer
                                  </span>
                                  <p className="font-bold text-slate-900 text-sm">{b.destinationStore || b.destinationHub || "Metro Fresh Mart Koramangala Store #104"}</p>
                                  <p className="text-[11px] text-slate-500">Retail Supermarket Store Hub</p>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                    🛡️ Tracking & Proof
                                  </span>
                                  <p className="font-mono font-bold text-emerald-800 text-xs">{b.trackingId || `TRK-${b.batchId}`}</p>
                                  {b.blockchainTx ? (
                                    <a
                                      href={`https://sepolia.etherscan.io/tx/${b.blockchainTx}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-mono font-bold"
                                    >
                                      Sepolia: {b.blockchainTx.slice(0, 10)}... <ExternalLink className="h-3 w-3 inline" />
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-emerald-700 font-bold">Custody verified on chain</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* State 4: Not yet requested */
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-100/50 border border-emerald-200 text-xs text-emerald-950">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4 shrink-0 text-emerald-700" />
                                  <span>
                                    <strong>Ready for Delivery Handshake:</strong> Send a formal delivery dispatch request with pickup, crop manifest, and temperature SLA specs to a distributor.
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => openDispatchModal(b)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shrink-0 h-8 gap-1.5 shadow-xs"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Send Delivery Request
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Footer Actions & Blockchain Verification */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-emerald-100 text-xs">
                            <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                              <span>Chain-of-custody transfer signed and verified on blockchain ledger.</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setQrViewBatch(b)}
                              className="rounded-xl text-xs font-bold gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                              View Batch QR Sticker
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
        )
      })()}

      {activeTab === "history" && (
        <div className="grid gap-6 lg:grid-cols-4">
          {/* History categories side bar */}
          <Card className="col-span-1 rounded-3xl border border-emerald-200 bg-white shadow-sm p-4 h-fit space-y-2">
            <h3 className="font-black text-lg px-2 mb-3 text-emerald-950">Logs & Audit</h3>
            <p className="text-xs text-slate-600 px-2 pb-4 border-b border-emerald-100">Track chronological processor logs and blockchain timestamps.</p>
            <div className="flex flex-col gap-2 pt-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Operational Categories</span>
              <div className="text-xs text-slate-800 space-y-2.5 px-2 mt-2 font-medium">
                <div className="flex justify-between"><span>★ Interested:</span> <strong className="text-emerald-700 font-bold">{interests.length}</strong></div>
                <div className="flex justify-between"><span>📥 Received:</span> <strong className="text-emerald-700 font-bold">{Object.keys(receipts).length}</strong></div>
                <div className="flex justify-between"><span>✅ Accepted:</span> <strong className="text-emerald-700 font-bold">{Object.values(decisions).filter(d => d.decision === "Accepted").length}</strong></div>
                <div className="flex justify-between"><span>❌ Rejected:</span> <strong className="text-red-600 font-bold">{Object.values(decisions).filter(d => d.decision === "Rejected").length}</strong></div>
                <div className="flex justify-between"><span>🏭 Processing:</span> <strong className="text-emerald-700 font-bold">{Object.keys(batches).length}</strong></div>
                <div className="flex justify-between"><span>🚚 Transferred:</span> <strong className="text-emerald-700 font-bold">{deduplicateBatches(Object.values(batches)).filter((b: ProcessingBatch) => b.stage === "Transferred" || Boolean(b.deliveryRequestStatus) || b.stageLogs?.some((log: any) => log.stage === "Transferred")).length}</strong></div>
              </div>
            </div>
          </Card>

          {/* Audit trail list */}
          <Card className="col-span-3 rounded-3xl border border-emerald-200 bg-white shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-emerald-100 pb-4 mb-6 gap-3">
              <div>
                <h3 className="text-xl font-black text-emerald-950">
                  {historySubTab === "audit" ? "Chronological Audit Trail" : "Transfer & History Records"}
                </h3>
                <p className="text-slate-600 text-sm">
                  {historySubTab === "audit" 
                    ? "Immutable operations trace recording Date, Time, User, Action and status updates."
                    : "Listing of all finalized agricultural batches transferred to cold chain distributors."}
                </p>
              </div>
              <div className="flex gap-1.5 bg-emerald-50 border border-emerald-200 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setHistorySubTab("audit")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    historySubTab === "audit"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-700 hover:text-emerald-950 hover:bg-white/60"
                  }`}
                >
                  Audit Trail
                </button>
                <button
                  onClick={() => setHistorySubTab("transferred")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    historySubTab === "transferred"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-700 hover:text-emerald-950 hover:bg-white/60"
                  }`}
                >
                  Transferred Batches
                </button>
              </div>
            </div>

            {historySubTab === "audit" ? (
              auditLogs.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                  <Clock className="h-10 w-10 mx-auto text-emerald-300 mb-3" />
                  <p className="font-bold text-lg text-slate-800">No operational logs recorded</p>
                  <p className="text-sm text-slate-500">Perform actions in browse or pipeline tabs to view audit logs.</p>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/60 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          {log.action.includes("Received") ? "📥" : log.action.includes("Accepted") ? "✅" : log.action.includes("Rejected") ? "❌" : log.action.includes("Transferred") ? "🚚" : "★"}
                          {log.action}
                        </p>
                        <p className="text-xs text-slate-600">By: <strong className="text-slate-800">{log.user}</strong> {log.productId && `• Product ID: ${log.productId.slice(0, 8)}...`} {log.batchId && `• Batch ID: ${log.batchId}`}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">{log.status}</span>
                        <p className="text-[10px] text-slate-500 mt-1 font-medium">{log.date} • {log.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (() => {
              const historicalTransferredBatches: ProcessingBatch[] = deduplicateBatches(Object.values(batches)).filter(
                (b: ProcessingBatch) => b.stage === "Transferred" || Boolean(b.deliveryRequestStatus) || b.stageLogs?.some((l: any) => l.stage === "Transferred")
              )

              if (historicalTransferredBatches.length === 0) {
                return (
                  <div className="text-center py-20 text-slate-500">
                    <Truck className="h-10 w-10 mx-auto text-emerald-300 mb-3" />
                    <p className="font-bold text-lg text-slate-800">No transferred batches found</p>
                    <p className="text-sm text-slate-500">Distributor transfer records will appear here after shipment dispatch.</p>
                  </div>
                )
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-200 text-slate-600 font-bold">
                        <th className="py-3 px-3">Product Name</th>
                        <th className="py-3 px-3">Product ID</th>
                        <th className="py-3 px-3">Batch ID</th>
                        <th className="py-3 px-3">Distributor</th>
                        <th className="py-3 px-3">Transfer Status</th>
                        <th className="py-3 px-3 text-right">Date & Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100 text-slate-800">
                      {historicalTransferredBatches.map((b: ProcessingBatch) => {
                        const originalId = (b.originalProduct.product_id && b.originalProduct.product_id >= 100000 && b.originalProduct.product_id <= 999999) 
                          ? b.originalProduct.product_id 
                          : 100000 + (Math.abs(Number(b.originalProduct.product_id || 0)) % 899999)
                        const st = (b.deliveryRequestStatus || "").toUpperCase()
                        return (
                          <tr key={b.batchId} className="hover:bg-emerald-50/50 transition-colors">
                            <td className="py-3.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                              {b.originalProduct.name.includes("Tomato") ? "🍅" : b.originalProduct.name.includes("Mango") ? "🥭" : "🌱"}
                              {b.originalProduct.name}
                            </td>
                            <td className="py-3.5 px-3 font-mono text-slate-600 font-medium">FP-{originalId}</td>
                            <td className="py-3.5 px-3 font-mono text-emerald-800 font-bold">{b.batchId}</td>
                            <td className="py-3.5 px-3 font-semibold text-slate-800">{b.distributorName || b.distributor || "Assigned Carrier"}</td>
                            <td className="py-3.5 px-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                st === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                  : st === "ARRIVED_AT_RETAILER"
                                  ? "bg-purple-100 text-purple-900 border border-purple-300"
                                  : st === "IN_TRANSIT"
                                  ? "bg-cyan-100 text-cyan-900 border border-cyan-300"
                                  : st === "PICKUP_QR_GENERATED"
                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                  : st === "ACCEPTED"
                                  ? "bg-indigo-100 text-indigo-900 border border-indigo-300"
                                  : "bg-slate-100 text-slate-800 border border-slate-300"
                              }`}>
                                {st === "COMPLETED"
                                  ? "Delivered & Verified"
                                  : st === "ARRIVED_AT_RETAILER"
                                  ? "Arrived at Retailer"
                                  : st === "IN_TRANSIT"
                                  ? "In Transit (Collected)"
                                  : st === "PICKUP_QR_GENERATED"
                                  ? "Pickup QR Active"
                                  : st === "ACCEPTED"
                                  ? "Carrier Accepted"
                                  : st === "REQUESTED"
                                  ? "Delivery Requested"
                                  : "Transferred"}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right text-slate-600">
                              <div className="font-medium">{b.transferDate || b.createdDate}</div>
                              <div className="text-[10px] text-slate-500">{b.transferTime || b.createdTime}</div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </Card>
        </div>
      )}

      {/* Warehouse Inventory & Stock Management Tab */}
      {activeTab === "inventory" && (
        <ProcessorInventory
          api={API}
          token={token}
          products={products}
          batches={batches}
          receipts={receipts}
          decisions={decisions}
          onRefreshProducts={fetchProducts}
          onAdjustBatchQuantity={(batchId, newQty, reason) => {
            setBatches(prev => {
              if (!prev[batchId]) return prev
              const updated = {
                ...prev[batchId],
                processedQuantity: newQty,
                stageLogs: [
                  ...(prev[batchId].stageLogs || []),
                  {
                    stage: "Stock Adjusted",
                    date: new Date().toLocaleDateString("en-GB"),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    remarks: `Quantity adjusted to ${newQty} kg (${reason})`
                  }
                ]
              }
              const next = { ...prev, [batchId]: updated }
              persistProcessorState({ batches: next })
              return next
            })
            addLog(`Adjusted inventory quantity for Batch ${batchId} to ${newQty} kg (${reason})`, "Stock Adjusted", undefined, batchId)
          }}
          onOpenPipeline={(step) => {
            if (step) setPipelineStep(step as any)
            setActiveTab("pipeline")
          }}
        />
      )}

      {/* Retailer Demand Desk Tab */}
      {activeTab === "demands" && (
        <RetailerDemandDesk
          api={API}
          token={token}
          products={products}
          onRefreshProducts={fetchProducts}
        />
      )}

      {/* MODAL: Receive Product Form */}
      {isReceiveModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full rounded-3xl border border-emerald-200 shadow-2xl p-6 space-y-4 bg-white text-slate-900">
            <div className="flex justify-between items-start border-b border-emerald-100 pb-3">
              <h3 className="font-black text-xl text-emerald-950">Confirm Product Receipt</h3>
              <button onClick={() => { setIsReceiveModalOpen(false); setSelectedProduct(null); }} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Product</p>
                <p className="text-base font-bold text-slate-900">{selectedProduct.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">Registered Qty</p>
                  <p className="text-base font-bold text-emerald-800">{selectedProduct.quantity} kg</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold">Received Qty (kg)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={receivedQtyInput}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === "" || Number(val) >= 0) {
                        setReceivedQtyInput(val)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e") {
                        e.preventDefault()
                      }
                    }}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 mt-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-medium"
                    placeholder="Enter physical scale quantity"
                  />
                </div>
              </div>

              {/* Weight Shortage / Discrepancy Alert */}
              {Number(receivedQtyInput) > 0 && Number(receivedQtyInput) < selectedProduct.quantity && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2.5 text-xs">
                  <div className="flex items-start gap-2 text-amber-900 font-bold">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>Weight Discrepancy Detected: {selectedProduct.quantity - Number(receivedQtyInput)} kg Shortage ({(((selectedProduct.quantity - Number(receivedQtyInput)) / selectedProduct.quantity) * 100).toFixed(0)}% vs Farm Origin)</span>
                  </div>
                  <div>
                    <label className="text-amber-900 uppercase text-[10px] font-bold">Observed Transit Loss Reason</label>
                    <select
                      value={transitLossReasonInput}
                      onChange={(e) => setTransitLossReasonInput(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 mt-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Transit Spoilage / Physical Damage on Route">Transit Spoilage / Physical Damage on Route</option>
                      <option value="Partial / Split Truck Delivery">Partial / Split Truck Delivery</option>
                      <option value="Natural Moisture Evaporation / Shrinkage">Natural Moisture Evaporation / Shrinkage</option>
                      <option value="Short Shipment / Missing Crates">Short Shipment / Missing Crates</option>
                      <option value="Weighbridge Scale Recalibration">Weighbridge Scale Recalibration</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold">Arrival Date</label>
                  <input
                    type="date"
                    value={arrivalDateInput}
                    onChange={(e) => setArrivalDateInput(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 mt-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold">Arrival Time</label>
                  <input
                    type="time"
                    value={arrivalTimeInput}
                    onChange={(e) => setArrivalTimeInput(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 mt-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Received By</p>
                <p className="text-sm font-bold text-slate-900">{processorName}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => { setIsReceiveModalOpen(false); setSelectedProduct(null); }}
                className="flex-1 rounded-xl border-emerald-200 text-slate-700 hover:bg-emerald-50 font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReceiveProduct}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs"
              >
                Confirm Receipt
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: Verify QR & Physical Quality Inspection Form */}
      {isVerifyModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-2xl w-full max-h-[92vh] flex flex-col rounded-3xl border border-emerald-200 shadow-2xl p-0 bg-white text-slate-900 my-auto overflow-hidden">
            <div className="flex justify-between items-start border-b border-emerald-100 p-6 pb-4 shrink-0 bg-white z-10">
              <div>
                <h3 className="font-black text-xl text-emerald-950">Scan QR & Verify Yield</h3>
                <p className="text-xs text-slate-600">Product: <span className="text-slate-900 font-bold">{selectedProduct.name}</span> • Registered: <span className="text-emerald-800 font-bold">{selectedProduct.quantity} kg</span></p>
              </div>
              <button
                onClick={closeVerifyModal}
                className="flex items-center justify-center p-2 rounded-full bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200 transition-all shadow-xs shrink-0 cursor-pointer"
                title="Close / Cancel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* CAMERA / QR SCANNER VIEW */}
              {!qrScanned ? (
                <div className="space-y-4">
                  <div className="relative w-full max-w-sm aspect-square mx-auto rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 overflow-hidden flex flex-col items-center justify-center shadow-inner">
                    {/* Container for html5-qrcode video element */}
                    <div id="live-qr-reader" className="w-full h-full" />

                    {!cameraActive && !qrScanning && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-white/95 z-10">
                        <div className="p-4 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700">
                          <Camera className="h-8 w-8" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900">Live Optical QR Scanner</p>
                          <p className="text-xs text-slate-600 mt-1 max-w-[240px]">
                            Hold up the printed product QR sticker or display it on a phone.
                          </p>
                        </div>
                      </div>
                    )}

                    {qrScanning && (
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-pulse top-1/2 shadow-lg shadow-emerald-500/50 z-20" />
                    )}
                  </div>

                  {cameraError && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 font-medium">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  {/* SCAN CONTROLS */}
                  <div className="flex flex-col gap-2 pt-1 max-w-sm mx-auto">
                    {cameraActive ? (
                      <Button
                        onClick={stopLiveCamera}
                        variant="outline"
                        className="w-full rounded-xl border-red-300 text-red-700 hover:bg-red-50 font-bold gap-2"
                      >
                        <VideoOff className="h-4 w-4" />
                        Stop Camera Scanner
                      </Button>
                    ) : (
                      <Button
                        onClick={startLiveCamera}
                        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-xs cursor-pointer"
                      >
                        <Video className="h-4 w-4" />
                        📷 Open Live Camera Scanner
                      </Button>
                    )}

                    <div>
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
                        className="w-full rounded-xl text-xs gap-2 border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800 font-bold py-2.5 cursor-pointer"
                      >
                        <Upload className="h-4 w-4 text-emerald-600" />
                        📁 Upload & Verify QR Image File
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* QR VERIFICATION DETAILS */}
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-emerald-200">
                      <span className="text-xs font-bold text-slate-600 uppercase">QR Verification Metadata</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Blockchain: Verified
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div><span className="text-slate-600 font-medium">Product:</span> <strong className="text-emerald-950 font-bold ml-1">{selectedProduct.name}</strong></div>
                      <div><span className="text-slate-600 font-medium">Product ID:</span> <strong className="text-emerald-950 font-mono font-bold ml-1">FP-{(selectedProduct.product_id && selectedProduct.product_id >= 100000 && selectedProduct.product_id <= 999999) ? selectedProduct.product_id : 100000 + (Math.abs(Number(selectedProduct.product_id || 0)) % 899999)}</strong></div>
                      <div><span className="text-slate-600 font-medium">Farmer:</span> <strong className="text-emerald-950 font-bold ml-1">{selectedProduct.farmer?.name || "Ravi"}</strong></div>
                      <div><span className="text-slate-600 font-medium">Location:</span> <strong className="text-emerald-950 font-bold ml-1">{getFarmerLocation(selectedProduct)}</strong></div>
                      <div><span className="text-slate-600 font-medium">Quantity:</span> <strong className="text-emerald-950 font-bold ml-1">{selectedProduct.quantity} kg</strong></div>
                      <div><span className="text-slate-600 font-medium">Harvest Date:</span> <strong className="text-emerald-950 font-bold ml-1">{new Date(selectedProduct.created_at).toLocaleDateString()}</strong></div>
                    </div>
                    {scannedRawText && (
                      <div className="pt-2 border-t border-emerald-200 text-[11px] text-slate-700 break-all font-mono">
                        <span className="text-emerald-800 font-bold">Decoded Optical QR:</span> {scannedRawText}
                      </div>
                    )}
                  </div>

                  {/* AUTOMATIC BLOCKCHAIN VERIFICATION CONFIRMATION */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm text-slate-800">1. Verification Status</h4>
                    <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-950">Blockchain Cryptographic Match Confirmed</p>
                          <p className="text-[11px] text-slate-600">Produce batch authenticity verified against farmer on-chain record.</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-300 shrink-0">
                        Verified ✓
                      </span>
                    </div>
                  </div>

                  {/* 2. PHYSICAL DOCK SCALE WEIGHING & SHORTAGE VERIFICATION */}
                  <div className="space-y-3 border-t border-emerald-100 pt-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <Scale className="h-4 w-4 text-emerald-600" />
                        2. Physical Scale Weight Verification
                      </h4>
                      <span className="text-[11px] text-slate-600">
                        Origin Farm Weight: <strong className="text-emerald-800 font-bold">{selectedProduct.quantity} kg</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-500 uppercase font-bold">Origin Registered Qty</label>
                        <div className="p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-950 mt-1">
                          {selectedProduct.quantity} kg
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 uppercase font-bold">Actual Scale Weighed (kg)</label>
                        <input
                          type="number"
                          min="0"
                          max={selectedProduct.quantity}
                          step="any"
                          value={receivedQtyInput}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === "") {
                              setReceivedQtyInput("")
                            } else {
                              const num = Number(val)
                              if (num >= 0 && num <= selectedProduct.quantity) {
                                setReceivedQtyInput(val)
                              } else if (num > selectedProduct.quantity) {
                                setReceivedQtyInput(String(selectedProduct.quantity))
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "-" || e.key === "e") {
                              e.preventDefault()
                            }
                          }}
                          placeholder={`Enter scale weight (e.g. ${selectedProduct.quantity})`}
                          className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 mt-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>

                    {/* Weight Shortage Live Notice (Produce can still be accepted) */}
                    {(() => {
                      const scaleWeight = Number(receivedQtyInput)
                      const originWeight = selectedProduct.quantity
                      const hasShortage = scaleWeight > 0 && scaleWeight < originWeight
                      if (!hasShortage) return null

                      const diffAmount = Math.abs(originWeight - scaleWeight)
                      const diffPercent = originWeight > 0 ? ((diffAmount / originWeight) * 100).toFixed(0) : "0"

                      return (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5 text-xs">
                          <div className="flex items-start gap-2.5 text-amber-900 font-bold">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                            <div>
                              <p className="font-bold text-sm text-amber-900">
                                ⚠️ Scale Weight Shortage: {diffAmount} kg Shortage ({diffPercent}% vs Registered {originWeight} kg)
                              </p>
                              <p className="text-slate-700 font-normal mt-0.5 text-[11px]">
                                Actual scale weight ({scaleWeight} kg) is less than origin registered quantity ({originWeight} kg). Produce can still be inspected and accepted with actual weighed quantity.
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                {/* 3. PHYSICAL QUALITY INSPECTION FORM */}
                <div className="space-y-4 border-t border-emerald-100 pt-4">
                  <h4 className="font-bold text-sm text-slate-800">3. Physical Quality Inspection</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 font-bold uppercase">Appearance</label>
                      <select value={appearanceInput} onChange={(e) => handlePhysicalParamChange("appearance", e.target.value)} className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-medium">
                        <option>Good</option>
                        <option>Excellent</option>
                        <option>Average</option>
                        <option>Poor</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-bold uppercase">Freshness</label>
                      <select value={freshnessInput} onChange={(e) => handlePhysicalParamChange("freshness", e.target.value)} className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-medium">
                        <option>Excellent</option>
                        <option>Good</option>
                        <option>Average</option>
                        <option>Stale</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-bold uppercase">Damage</label>
                      <select value={damageInput} onChange={(e) => handlePhysicalParamChange("damage", e.target.value)} className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-medium">
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-bold uppercase">Cleanliness</label>
                      <select value={cleanlinessInput} onChange={(e) => handlePhysicalParamChange("cleanliness", e.target.value)} className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-medium">
                        <option>Good</option>
                        <option>Excellent</option>
                        <option>Average</option>
                        <option>Poor</option>
                      </select>
                    </div>
                  </div>

                  {/* Live in-hand calculated score */}
                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-600 font-bold">In-Hand Verified Quality Score</p>
                      <p className="text-[11px] text-slate-500">Calculated from physical appearance, freshness, damage & cleanliness</p>
                    </div>
                    {(() => {
                      const score = computePhysicalQualityScore(appearanceInput, freshnessInput, cleanlinessInput, damageInput)
                      const grade = score >= 85 ? "A" : score >= 60 ? "B" : "C"
                      return (
                        <span className={`text-base font-bold px-3 py-1 rounded-xl border ${
                          grade === "C"
                            ? "text-red-700 bg-red-100 border-red-300"
                            : "text-emerald-900 bg-emerald-100 border-emerald-300"
                        }`}>
                          {score}% (Grade {grade})
                        </span>
                      )
                    })()}
                  </div>

                  {/* Quality Failure Alert Banner if Grade C (<60%) */}
                  {computePhysicalQualityScore(appearanceInput, freshnessInput, cleanlinessInput, damageInput) < 60 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-1.5 text-xs">
                      <div className="flex items-start gap-2.5 text-red-700 font-bold">
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
                        <div>
                          <p className="font-bold text-sm text-red-900">
                            Quality Standards Failed (Grade C · {computePhysicalQualityScore(appearanceInput, freshnessInput, cleanlinessInput, damageInput)}%)
                          </p>
                          <p className="text-slate-700 font-normal mt-0.5 text-[11px]">
                            Physical quality parameters do not meet minimum processor intake specifications (60% / Grade B required). Accepting this batch on blockchain is restricted and produce delivery must be rejected.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 font-bold uppercase">Certified Quality Grade</label>
                      <div className="flex gap-2 mt-1">
                        {(["A", "B", "C"] as const).map(g => {
                          const computedScore = computePhysicalQualityScore(appearanceInput, freshnessInput, cleanlinessInput, damageInput)
                          const autoGrade = computedScore >= 85 ? "A" : computedScore >= 60 ? "B" : "C"
                          const isCurrentGrade = autoGrade === g
                          return (
                            <button
                              key={g}
                              type="button"
                              disabled={!isCurrentGrade}
                              className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                                isCurrentGrade
                                  ? autoGrade === "C"
                                    ? "bg-red-600 border-red-600 text-white shadow-xs cursor-default"
                                    : "bg-emerald-600 border-emerald-600 text-white shadow-xs cursor-default"
                                  : "border-slate-200 text-slate-400 opacity-40 cursor-not-allowed bg-slate-50"
                              }`}
                            >
                              Grade {g}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Auto-locked: Grade A (85-100%), Grade B (60-84%), Grade C (&lt;60%)
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-bold uppercase">
                        Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={remarksInput}
                        onChange={(e) => setRemarksInput(e.target.value)}
                        placeholder="Enter remarks e.g. Batch verified in good condition"
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-medium"
                      />
                    </div>
                  </div>

                  {/* Physical Inspection Confirmation - Only displayed for Grade A or B (score >= 60) */}
                  {computePhysicalQualityScore(appearanceInput, freshnessInput, cleanlinessInput, damageInput) >= 60 && (
                    <label className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isInspectionConfirmed
                        ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold"
                        : "bg-slate-50 border-slate-200 hover:border-emerald-300 text-slate-700"
                    }`}>
                      <input
                        type="checkbox"
                        checked={isInspectionConfirmed}
                        onChange={(e) => setIsInspectionConfirmed(e.target.checked)}
                        className="h-4 w-4 rounded accent-emerald-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold">
                        I have physically inspected this produce and certify the verified Quality Score & Grade.
                      </span>
                    </label>
                  )}
                </div>

                {/* DECISION ACTION SUBMIT */}
                <div className="flex flex-col gap-3 border-t border-emerald-100 pt-4">
                  {showRejectionForm ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-3">
                      <label className="text-xs text-red-900 font-bold uppercase">Rejection Reason</label>
                      <select
                        value={rejectionReasonInput}
                        onChange={(e) => setRejectionReasonInput(e.target.value)}
                        className="w-full bg-white border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 font-medium"
                      >
                        <option value="">Select reason</option>
                        <option value="Quality Standards Failed (Grade C / Spoiled)">Quality Standards Failed (Grade C / Spoiled)</option>
                        <option value="Severe Physical Damage">Severe Physical Damage</option>
                        <option value="Information mismatch">Information Mismatch</option>
                        <option value="Poor quality">Poor Quality</option>
                        <option value="Product not suitable for processing">Product not suitable for processing</option>
                      </select>
                      <div className="flex gap-2">
                        <Button
                          disabled={!rejectionReasonInput}
                          onClick={() => handleInspectionDecision("Rejected")}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                        >
                          Confirm Rejection on Chain
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setShowRejectionForm(false)}
                          className="rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer font-bold"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : computePhysicalQualityScore(appearanceInput, freshnessInput, cleanlinessInput, damageInput) < 60 ? (
                    /* ONLY DISPLAY REJECT PRODUCT WHEN QUALITY STANDARDS FAIL (GRADE C) */
                    <div className="space-y-2">
                      <Button
                        onClick={() => {
                          const score = computePhysicalQualityScore(appearanceInput, freshnessInput, cleanlinessInput, damageInput)
                          setRejectionReasonInput(`Quality Standards Failed: Grade C produce (${score}%) does not meet intake quality specifications`)
                          setShowRejectionForm(true)
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl py-3 text-sm shadow-xs gap-2 cursor-pointer"
                      >
                        ❌ Reject Product (Quality Standards Failed)
                      </Button>
                    </div>
                  ) : (
                    /* NORMAL VIEW: ACCEPT OR REJECT */
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowRejectionForm(true)}
                        className="flex-1 rounded-xl border-red-300 text-red-700 hover:bg-red-50 font-bold cursor-pointer"
                      >
                        ❌ Reject Product
                      </Button>
                      <Button
                        disabled={infoVerified !== "Verified" || !isInspectionConfirmed}
                        onClick={() => handleInspectionDecision("Accepted")}
                        className={`flex-1 rounded-xl text-white font-bold shadow-xs ${
                          infoVerified === "Verified" && isInspectionConfirmed
                            ? "bg-emerald-600 hover:bg-emerald-500 cursor-pointer"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                        }`}
                      >
                        ✅ Accept & Record on Chain
                      </Button>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={closeVerifyModal}
                    className="w-full text-xs text-slate-500 hover:text-slate-800 hover:bg-emerald-50 rounded-xl mt-1 cursor-pointer font-bold"
                  >
                    Cancel & Close Verification
                  </Button>
                </div>
              </div>
            )}
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: View Details / AI Insights Modal */}
      {selectedProduct && !isReceiveModalOpen && !isVerifyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-xl w-full rounded-3xl border border-emerald-200 shadow-xl p-6 bg-white text-slate-900 space-y-5">
            <div className="flex justify-between items-start border-b border-emerald-100 pb-3">
              <div>
                <h3 className="font-black text-xl text-emerald-950">{selectedProduct.name} Detail Analysis</h3>
                <p className="text-xs text-slate-600">Product Mapped ID: FP-{(selectedProduct.product_id && selectedProduct.product_id >= 100000 && selectedProduct.product_id <= 999999) ? selectedProduct.product_id : 100000 + (Math.abs(Number(selectedProduct.product_id || 0)) % 899999)}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold">Category</span>
                  <p className="font-bold text-emerald-900">{selectedProduct.category || "Produce"}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold">Quantity</span>
                  <p className="font-bold text-emerald-900">{receipts[selectedProduct.id]?.receivedQty || selectedProduct.quantity} kg</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold">Harvest Batch</span>
                  <p className="font-bold font-mono text-xs text-emerald-900">{selectedProduct.batch_number || (selectedProduct as any).batchNumber || "BCH-20260903-RH59"}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold">Current Status</span>
                  <p className="font-bold text-emerald-700">{selectedProduct.status}</p>
                </div>
              </div>

              {/* Quality & Processing Status Box */}
              {(() => {
                const inspection = inspections[selectedProduct.id]
                const isInspected = Boolean(inspection || receipts[selectedProduct.id] || (selectedProduct.status !== "Harvested" && (selectedProduct.ai_quality_score || 0) > 0))
                const score = inspection ? computePhysicalQualityScore(inspection.appearance, inspection.freshness, inspection.cleanliness, inspection.damage) : (selectedProduct.ai_quality_score || 90)
                const grade = inspection?.grade || (score >= 85 ? "A" : score >= 60 ? "B" : "C")

                return (
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
                    <h4 className="font-black text-sm flex items-center gap-1.5 text-emerald-950">
                      <Brain className="h-4 w-4 text-emerald-600" />
                      Quality & Processing Status
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-600 font-medium">Quality Assessment:</span>{" "}
                        {isInspected ? (
                          <strong className="text-emerald-900 font-bold">{score}% (Grade {grade}) - Verified ✓</strong>
                        ) : (
                          <strong className="text-amber-700 font-bold">Pending Physical Inspection</strong>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-600 font-medium">Grading Facility:</span>{" "}
                        <strong className="text-emerald-900 font-bold">{processorName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-600 font-medium">Inspection Method:</span>{" "}
                        <strong className="text-emerald-900 font-bold">In-Hand Physical Verification</strong>
                      </div>
                      <div>
                        <span className="text-slate-600 font-medium">Grade Ranges:</span>{" "}
                        <strong className="text-emerald-900 font-bold">Grade A (85-100%), B (60-84%), C (&lt;60%)</strong>
                      </div>
                    </div>

                    {isInspected && inspection && (
                      <div className="border-t border-emerald-200 pt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div><span className="text-slate-600 font-medium">Appearance:</span> <strong className="text-emerald-900 font-bold ml-1">{inspection.appearance}</strong></div>
                        <div><span className="text-slate-600 font-medium">Freshness:</span> <strong className="text-emerald-900 font-bold ml-1">{inspection.freshness}</strong></div>
                        <div><span className="text-slate-600 font-medium">Damage:</span> <strong className="text-emerald-900 font-bold ml-1">{inspection.damage}</strong></div>
                        <div><span className="text-slate-600 font-medium">Cleanliness:</span> <strong className="text-emerald-900 font-bold ml-1">{inspection.cleanliness}</strong></div>
                      </div>
                    )}

                    <div className="border-t border-emerald-200 pt-2 text-xs text-slate-600">
                      <span className="text-emerald-900 font-bold">Processor workflow:</span> {isInspected ? "Physical quality parameters verified and registered on blockchain." : "Physical quality score and certified grade are verified upon QR scan and batch receipt."}
                    </div>
                  </div>
                )
              })()}

              {/* Blockchain Transaction Hash */}
              <div>
                <span className="text-xs text-slate-500 uppercase font-bold">Blockchain Authenticity Certificate</span>
                {selectedProduct.blockchain_hash ? (
                  <div className="mt-1 p-3 bg-emerald-50/50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <p className="font-mono text-xs text-emerald-900 font-bold break-all">
                      {selectedProduct.blockchain_hash}
                    </p>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${selectedProduct.blockchain_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-bold shrink-0"
                    >
                      View on Sepolia Etherscan ↗
                    </a>
                  </div>
                ) : (
                  <p className="font-mono text-xs text-slate-500 p-3 bg-slate-50 border border-slate-200 rounded-2xl mt-1">
                    Pending on-chain registration
                  </p>
                )}
              </div>
            </div>

            <div className="flex pt-4">
              <Button onClick={() => setSelectedProduct(null)} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                Close Report
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: Batch QR Code View / Print Sticker */}
      {qrViewBatch && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-sm w-full rounded-3xl border border-emerald-200 shadow-2xl p-6 bg-white text-slate-900 space-y-5 text-center">
            <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
              <h3 className="font-black text-lg flex items-center gap-2 text-emerald-950">
                <QrCode className="h-5 w-5 text-emerald-600" />
                Batch QR Certificate
              </h3>
              <button onClick={() => setQrViewBatch(null)} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
            </div>

            {/* Offscreen Canvas used for high-res crisp PNG export */}
            <div style={{ position: "fixed", left: "-9999px", top: "-9999px", pointerEvents: "none" }}>
              <QRCodeCanvas
                id="processor-batch-qr-canvas"
                value={`${window.location.origin}/tracker?id=${qrViewBatch.originalProduct.id}`}
                size={400}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
                includeMargin={true}
                marginSize={4}
              />
            </div>

            <div className="p-4 bg-emerald-50/50 rounded-2xl flex flex-col items-center justify-center shadow-inner mx-auto w-fit border border-emerald-200">
              <QRCodeSVG
                value={`${window.location.origin}/tracker?id=${qrViewBatch.originalProduct.id}`}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="space-y-1 text-xs text-left bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200">
              <p className="font-bold text-sm text-slate-900">{qrViewBatch.originalProduct.name}</p>
              <p className="text-slate-600 font-mono">Batch ID: <span className="text-emerald-800 font-bold">{qrViewBatch.batchId}</span></p>
              <p className="text-slate-600">Certified Grade: <span className="text-emerald-900 font-bold">{qrViewBatch.originalProduct.ai_quality_label || "Grade A"} ({qrViewBatch.originalProduct.ai_quality_score || 90}%)</span></p>
              <p className="text-slate-600">Processor: <span className="text-slate-800 font-medium">{processorName} • {processorAddress}</span></p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                className="w-full rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs"
                onClick={() => {
                  const canvas = document.getElementById("processor-batch-qr-canvas") as HTMLCanvasElement
                  if (!canvas) return
                  const pngUrl = canvas.toDataURL("image/png")
                  const downloadLink = document.createElement("a")
                  downloadLink.href = pngUrl
                  downloadLink.download = `Batch_${qrViewBatch.batchId}_${qrViewBatch.originalProduct.name.replace(/\s+/g, '_')}_QR.png`
                  document.body.appendChild(downloadLink)
                  downloadLink.click()
                  document.body.removeChild(downloadLink)
                }}
              >
                <Download className="h-3.5 w-3.5" /> Download QR Image (PNG)
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl text-xs gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50 font-bold"
                  onClick={() => window.print()}
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 rounded-xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold"
                  onClick={() => setQrViewBatch(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: Processing Completion & Certification Modal */}
      {processingModalBatch && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-lg w-full rounded-3xl border border-emerald-200 shadow-2xl p-6 bg-white text-slate-900 space-y-5 my-auto">
            <div className="flex justify-between items-start border-b border-emerald-100 pb-3">
              <div>
                <h3 className="font-black text-xl text-emerald-950 flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-600" />
                  Processing Completion & Certification
                </h3>
                <p className="text-xs text-slate-600">
                  Batch: <span className="text-emerald-800 font-mono font-bold">{processingModalBatch.batchId}</span> • Product: <span className="text-slate-900 font-bold">{processingModalBatch.originalProduct.name}</span>
                </p>
              </div>
              <button
                onClick={() => setProcessingModalBatch(null)}
                className="flex items-center justify-center p-2 rounded-full bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200 transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const verifiedQty = receipts[processingModalBatch.originalProduct.id]?.receivedQty || processingModalBatch.originalProduct.quantity || 100
              const now = new Date()
              const formattedDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
              const formattedTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

              return (
                <>
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-slate-600 font-medium">Produce:</span> <strong className="text-slate-900 font-bold ml-1">{processingModalBatch.originalProduct.name}</strong></div>
                    <div><span className="text-slate-600 font-medium">Intake Scale Weight:</span> <strong className="text-emerald-800 font-bold ml-1">{verifiedQty} kg</strong></div>
                    <div><span className="text-slate-600 font-medium">Certified Quality:</span> <strong className="text-emerald-800 font-bold ml-1">{processingModalBatch.originalProduct.ai_quality_score || 90}% ({processingModalBatch.originalProduct.ai_quality_label || "Grade A"})</strong></div>
                    <div><span className="text-slate-600 font-medium">Farmer Origin:</span> <strong className="text-slate-900 font-bold ml-1">{processingModalBatch.originalProduct.farmer?.name || "Ravi"}</strong></div>
                  </div>

                  <div className="space-y-4 text-sm">
                    {/* 1. PROCESSED QUANTITY (KG) */}
                    <div>
                      <label className="text-xs text-slate-500 uppercase font-bold">Processed Quantity (kg)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={processedQtyInput}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === "" || Number(val) >= 0) {
                            setProcessedQtyInput(val)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e") e.preventDefault()
                        }}
                        placeholder={`e.g. ${verifiedQty}`}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-sm mt-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>

                    {/* 2. ESTIMATED SHELF LIFE (DD-MM-YYYY) */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-slate-500 uppercase font-bold">Estimated shelf life</label>
                        <span className="text-xs font-mono font-bold text-emerald-800">
                          {formatToDdMmYyyy(estimatedShelfLifeInput) || "dd-mm-yyyy"}
                        </span>
                      </div>
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={estimatedShelfLifeInput}
                        onChange={(e) => setEstimatedShelfLifeInput(e.target.value)}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-sm mt-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
                      />
                      <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                        <span>Format: <strong className="text-slate-700 font-mono font-bold">dd-mm-yyyy</strong></span>
                        {estimatedShelfLifeInput && (
                          <span className="text-emerald-800 font-bold">
                            (~{computeShelfLifeDays(estimatedShelfLifeInput)} days shelf life)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3. PROCESSING COMPLETION DATE & TIME (AUTOMATIC) */}
                    <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-slate-700">
                        <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-[11px] text-slate-500 uppercase font-bold">Processing Completion Timestamp</p>
                          <p className="text-xs font-bold text-emerald-950">{formattedDate} • {formattedTime} (Auto-recorded)</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        Live Clock ✓
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setProcessingModalBatch(null)}
                        className="flex-1 rounded-xl border-emerald-200 text-slate-700 hover:bg-emerald-50 font-bold"
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={!processedQtyInput || Number(processedQtyInput) <= 0 || !estimatedShelfLifeInput}
                        onClick={async () => {
                          await handleCompleteProcessing(
                            processingModalBatch.batchId, 
                            Number(processedQtyInput),
                            estimatedShelfLifeInput
                          )
                        }}
                        className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Complete Processing & Record on Chain
                      </Button>
                    </div>
                  </div>
                </>
              )
            })()}
          </Card>
        </div>
      )}

      {/* Facility Profile & Compliance Section */}
      {activeTab === "profile" && (
        <ProfileManagementSection
          role="processor"
          onProfileUpdated={(p) => {
            setProcessorPickupLocation(p.address)
          }}
        />
      )}

      {/* DISTRIBUTOR LOGISTICS & DISPATCH MODAL */}
      {dispatchModalBatch && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-2xl w-full rounded-3xl border border-emerald-200 bg-white text-slate-900 shadow-2xl p-6 space-y-5 my-8">
            <div className="flex justify-between items-start border-b border-emerald-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-xl font-black text-emerald-950">Send Delivery Request to Distributor</CardTitle>
                </div>
                <CardDescription className="text-slate-600 text-xs mt-1">
                  Send complete crop manifest, cold-chain temperature SLA, and destination retailer store to the distributor. The distributor will review and decide whether to accept or decline the delivery.
                </CardDescription>
              </div>
              <button
                onClick={() => setDispatchModalBatch(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {dispatchSuccessResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-emerald-950">
                  <div className="flex items-center gap-2 font-bold text-base text-emerald-800">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span>Delivery Request Dispatched to Distributor!</span>
                  </div>
                  <p className="text-xs text-slate-700">{dispatchSuccessResult.message}</p>
                  <div className="p-3 bg-white rounded-xl space-y-1.5 font-mono text-xs text-slate-800 border border-emerald-200 mt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Request Tracking ID:</span>
                      <span className="font-bold text-emerald-800">{dispatchSuccessResult.tracking_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                        Awaiting Distributor Acceptance
                      </span>
                    </div>
                    {dispatchSuccessResult.blockchain_hash && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-500">Sepolia Proof:</span>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${dispatchSuccessResult.blockchain_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 underline flex items-center gap-1 hover:text-emerald-900 font-bold"
                        >
                          {dispatchSuccessResult.blockchain_hash.slice(0, 14)}...
                          <ExternalLink className="h-3 w-3 inline" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => setDispatchModalBatch(null)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs"
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Batch Summary Strip */}
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 uppercase text-[10px] font-bold block">Certified Batch</span>
                    <span className="font-bold text-slate-900 text-sm">{dispatchModalBatch.originalProduct.name}</span>
                    <span className="text-slate-600 ml-2 font-mono font-bold">({dispatchModalBatch.processedQuantity || dispatchModalBatch.originalProduct.quantity} kg)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 uppercase text-[10px] font-bold block">Quality & Expiry</span>
                    <span className="font-bold text-emerald-900">{dispatchModalBatch.originalProduct.ai_quality_label || "Grade A"}</span>
                    <span className="text-slate-600 ml-2 font-medium">Exp: {dispatchModalBatch.expiryDate || "14 Days"}</span>
                  </div>
                </div>

                {/* Section 1: Available Distributors List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-emerald-600" />
                      1. Select Distributor Logistics Carrier
                    </label>
                    <span className="text-[11px] text-emerald-800 font-bold">
                      {availableDistributors.length} Registered Carrier{availableDistributors.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {loadingDistributors ? (
                    <div className="py-8 text-center text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      <span className="text-xs font-medium">Scanning available distributor fleets...</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {availableDistributors.map((dist) => {
                        const isSelected = selectedDistributorId === dist.id
                        const isAvail = dist.current_status === "AVAILABLE"
                        return (
                          <div
                            key={dist.id}
                            onClick={() => setSelectedDistributorId(dist.id)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isSelected
                                ? "bg-emerald-50 border-2 border-emerald-600 shadow-xs"
                                : "bg-white border-emerald-200 hover:bg-emerald-50/40 hover:border-emerald-300"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-emerald-600 bg-emerald-600" : "border-slate-300"}`}>
                                  {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </span>
                                <span className="font-bold text-sm text-slate-900">{dist.name}</span>
                                <span className="text-xs text-slate-500 font-mono">({dist.email})</span>
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold">
                                  {dist.vehicle_number}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  isAvail
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : dist.current_status === "ON_ROUTE"
                                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                                    : "bg-red-100 text-red-900 border border-red-300"
                                }`}>
                                  {dist.current_status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                                <span className="text-[11px] font-bold text-emerald-900 bg-emerald-100/60 px-2 py-0.5 rounded-md border border-emerald-200">
                                  {dist.status_reason || dist.availability_status || "Ready for Trip"}
                                </span>
                                <span className="flex items-center gap-1 text-slate-700 font-medium">
                                  <Thermometer className="h-3 w-3 text-emerald-600" /> {dist.temperature_control}
                                </span>
                                <span>Hub: <strong className="text-slate-800">{dist.base_hub}</strong></span>
                              </div>
                            </div>

                            <div className="text-right text-xs text-slate-600 shrink-0 sm:border-l sm:border-emerald-100 sm:pl-3">
                              <div className="text-emerald-800 font-bold">{dist.completed_trips || 0} completed trips</div>
                              <div className="text-[11px]">
                                {dist.active_deliveries && dist.active_deliveries > 0 ? (
                                  <span className="text-amber-800 font-bold">{dist.active_deliveries} active cargo in transit</span>
                                ) : (
                                  <span className="text-emerald-700 font-bold">Fleet Free & Ready</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 justify-end pt-0.5 font-medium">
                                <Phone className="h-3 w-3 text-emerald-600" /> {dist.phone}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Section 2: Source Pickup Location (Processor Profile) */}
                <div className="space-y-2 p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                      2. Source: Processor Facility Pickup Location
                    </label>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      Verified Profile Location
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">{processorName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDispatchModalBatch(null)
                          setActiveTab("profile")
                        }}
                        className="text-[10px] text-emerald-700 hover:text-emerald-900 hover:underline font-bold cursor-pointer"
                      >
                        Edit in Profile Tab →
                      </button>
                    </div>
                    <p className="text-slate-700 leading-relaxed text-[11px]">
                      {processorPickupLocation || "Agro-Processing Unit #4, Yeshwanthpur Industrial Suburb, APMC Yard, Bengaluru 560022"}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Distributor fleets strictly navigate to your admin-verified facility address for cargo intake.
                  </p>
                </div>

                {/* Section 3: Destination Retailer Store & Address (From Profile) */}
                <div className="space-y-2 p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-emerald-600" />
                      3. Destination: Retailer Store & Delivery Location
                    </label>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      Verified Retail Store
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableRetailers.length > 0 && (
                      <select
                        value={selectedRetailerId}
                        onChange={(e) => {
                          const retId = e.target.value
                          setSelectedRetailerId(retId)
                          const ret = availableRetailers.find(r => r.id === retId)
                          if (ret) {
                            setSelectedDestinationStore(ret.name)
                            axios.get(`${API}/profile/user/${retId}`, { headers: { Authorization: `Bearer ${token}` } })
                              .then(res => {
                                if (res.data.success && res.data.data?.address) {
                                  setDestinationStoreAddress(res.data.data.address)
                                  setSelectedDestinationStore(res.data.data.business_name || ret.name)
                                } else {
                                  setDestinationStoreAddress(getRetailerLocation(ret.email || ret.name))
                                }
                              })
                              .catch(() => setDestinationStoreAddress(getRetailerLocation(ret.email || ret.name)))
                          }
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-emerald-200 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      >
                        {availableRetailers.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.email})
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      value={selectedDestinationStore}
                      onChange={(e) => setSelectedDestinationStore(e.target.value)}
                      placeholder="Store Name (e.g. Metro Fresh Mart Koramangala)"
                      className="w-full h-10 px-3 rounded-xl border border-emerald-200 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Verified Receiving Dock Address:</span>
                    <p className="text-slate-700 text-[11px] leading-relaxed">
                      {destinationStoreAddress || "Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru 560034"}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Distributor delivery vehicles navigate directly to this verified retailer store address.
                  </p>
                </div>

                {/* Section 4: Dispatch & Cold-Chain SLA Notes */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    4. Dispatch Handover Notes & Handling SLA
                  </label>
                  <textarea
                    rows={2}
                    value={dispatchNotesInput}
                    onChange={(e) => setDispatchNotesInput(e.target.value)}
                    placeholder="Temperature specs, packaging integrity notes, departure seal numbers..."
                    className="w-full p-3 rounded-xl border border-emerald-200 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setDispatchModalBatch(null)}
                    className="flex-1 rounded-xl border-emerald-200 text-slate-700 hover:bg-emerald-50 font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={!selectedDistributorId || dispatchLoading}
                    onClick={handleAssignDistributor}
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {dispatchLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending Delivery Request...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Delivery Request to Distributor
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
      {/* BLOCKCHAIN-BACKED PICKUP DISPATCH QR MODAL */}
      {pickupModalData?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-lg w-full rounded-3xl border border-emerald-300 bg-white text-slate-900 shadow-2xl p-6 space-y-5 my-8">
            <div className="flex justify-between items-start border-b border-emerald-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black text-emerald-950">Blockchain Pickup Dispatch Pass</CardTitle>
                    <p className="text-slate-600 text-xs font-medium">Processor Facility Cargo Handover</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPickupModalData(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {pickupModalData.loading ? (
              <div className="p-12 text-center space-y-3">
                <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-700">Generating cryptographic dispatch token & anchoring to blockchain...</p>
              </div>
            ) : pickupModalData.error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-3 text-red-700">
                <div className="flex items-center gap-2 font-bold text-red-800">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span>Could Not Generate Pickup QR</span>
                </div>
                <p className="text-xs">{pickupModalData.error}</p>
                <Button
                  onClick={() => pickupModalData.batch && handleGeneratePickupQR(pickupModalData.batch)}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs rounded-xl font-bold shadow-xs"
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-6 bg-emerald-50/40 rounded-2xl shadow-inner border-2 border-emerald-300">
                  <QRCodeCanvas
                    id="processor-pickup-qr-canvas"
                    value={pickupModalData.qrData || pickupModalData.qrToken || ""}
                    size={220}
                    level="H"
                    includeMargin={true}
                    className="rounded-xl shadow-xs bg-white p-1"
                  />
                  <div className="mt-3 text-center">
                    <span className="font-mono text-xs font-bold text-emerald-950 bg-white px-3 py-1.5 rounded-md border border-emerald-300 select-all block shadow-xs">
                      {pickupModalData.qrToken}
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1 font-medium">Cryptographically-signed Pickup Dispatch Token</p>
                  </div>
                </div>

                {/* Produce & Carrier Details Snapshot */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-emerald-200">
                    <span className="text-slate-600 font-medium">Batch Number:</span>
                    <span className="font-mono font-bold text-emerald-950">{pickupModalData.batch?.batchId}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-emerald-200">
                    <span className="text-slate-600 font-medium">Produce & Quantity:</span>
                    <span className="font-bold text-slate-900">
                      {pickupModalData.batch?.originalProduct?.name || "Certified Produce"} — {pickupModalData.batch?.processedQuantity || pickupModalData.batch?.originalProduct.quantity} kg
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-emerald-200">
                    <span className="text-slate-600 font-medium">Authorized Carrier:</span>
                    <span className="font-bold text-emerald-950">
                      {pickupModalData.batch?.distributorName || pickupModalData.batch?.distributor} ({pickupModalData.batch?.distributorVehicle || "Reefer Reefer"})
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-emerald-200">
                    <span className="text-slate-600 font-medium">Destination Retailer:</span>
                    <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">
                      {pickupModalData.batch?.destinationStore || "Retail Store"}
                    </span>
                  </div>
                  {pickupModalData.txHash && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-600 font-medium">Blockchain Hash:</span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${pickupModalData.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-emerald-700 underline hover:text-emerald-900 flex items-center gap-1 font-bold"
                      >
                        {pickupModalData.txHash.slice(0, 10)}... <ExternalLink className="h-3 w-3 inline" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>
                    <strong>Driver Pickup Instructions:</strong> When the distributor arrives at your facility, have them open their dashboard scanner and scan this QR code. Once scanned, they will inspect the physical crates, record their vehicle registration number, and confirm collection.
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const canvas = document.getElementById("processor-pickup-qr-canvas") as HTMLCanvasElement
                      if (!canvas) return
                      const pngUrl = canvas.toDataURL("image/png")
                      const downloadLink = document.createElement("a")
                      downloadLink.href = pngUrl
                      downloadLink.download = `Pickup_QR_${(pickupModalData.batch?.batchId || "Batch").replace(/[^\w-]/g, "_")}.png`
                      document.body.appendChild(downloadLink)
                      downloadLink.click()
                      document.body.removeChild(downloadLink)
                    }}
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download QR (PNG)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.print()}
                    className="rounded-xl border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-xs gap-1.5 font-bold cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print
                  </Button>
                  <Button
                    onClick={() => setPickupModalData(null)}
                    variant="outline"
                    className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs"
                  >
                    Done
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

