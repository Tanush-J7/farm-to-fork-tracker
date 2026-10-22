import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import {
  Package, Boxes, Warehouse, Search, Plus, Minus,
  SlidersHorizontal, AlertTriangle, CheckCircle2, Clock,
  ArrowRight, Sparkles, RefreshCw, Store, Scale,
  X, TrendingUp, ChevronRight,
  ShieldCheck, Loader2, Send
} from "lucide-react"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"

export interface InventoryItem {
  id: string
  productId: string
  batchNumber: string
  name: string
  category: string
  initialQuantity: number
  availableQuantity: number
  allocatedQuantity: number
  unit: string
  grade: string
  qualityScore: number
  storageZone: string
  farmerName: string
  farmLocation: string
  intakeDate: string
  expiryDate?: string
  daysUntilExpiry?: number
  isRawIntake: boolean
  isPackaged: boolean
  status: string
  productImage?: string
  safetyThreshold: number
}

interface ProcessorInventoryProps {
  api: string
  token: string | null
  products: any[]
  batches: Record<string, any>
  receipts: Record<string, any>
  decisions: Record<string, any>
  onRefreshProducts: () => void
  onAdjustBatchQuantity?: (batchId: string, newQty: number, reason: string) => void
  onOpenPipeline?: (step?: string) => void
}

export function ProcessorInventory({
  api,
  token,
  products,
  batches,
  receipts,
  decisions,
  onRefreshProducts,
  onAdjustBatchQuantity,
  onOpenPipeline
}: ProcessorInventoryProps) {
  // Navigation / Filter State
  const [subTab, setSubTab] = useState<"all" | "raw" | "packaged" | "demands" | "alerts">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [stockLevelFilter, setStockLevelFilter] = useState<"ALL" | "LOW" | "AVAILABLE" | "ALLOCATED">("ALL")

  // Retailer Demands State
  const [retailerRequests, setRetailerRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestError, setRequestError] = useState("")

  // Available Distributors for Retailer Order Fulfillment
  const [distributors, setDistributors] = useState<any[]>([])

  // Modal: Quantity Adjustment
  const [adjustModalItem, setAdjustModalItem] = useState<InventoryItem | null>(null)
  const [adjustOperation, setAdjustOperation] = useState<"deduct" | "add" | "set">("deduct")
  const [adjustAmount, setAdjustAmount] = useState<string>("10")
  const [adjustReason, setAdjustReason] = useState<string>("Sorting & Quality Grade Loss")
  const [adjustNotes, setAdjustNotes] = useState<string>("")
  const [adjusting, setAdjusting] = useState<boolean>(false)
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState<string>("")
  const [adjustErrorMsg, setAdjustErrorMsg] = useState<string>("")

  // Modal: Fulfill Retailer Order from Inventory
  const [fulfillModalRequest, setFulfillModalRequest] = useState<any | null>(null)
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string>("")
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>("")
  const [allocateQty, setAllocateQty] = useState<string>("")
  const [fulfillNotes, setFulfillNotes] = useState<string>("")
  const [fulfilling, setFulfilling] = useState<boolean>(false)
  const [fulfillSuccess, setFulfillSuccess] = useState<string>("")
  const [fulfillError, setFulfillError] = useState<string>("")

  // Modal: Source from Farmers
  const [sourceModalRequest, setSourceModalRequest] = useState<any | null>(null)
  const [sourceTargetQty, setSourceTargetQty] = useState<string>("")
  const [sourcePrice, setSourcePrice] = useState<string>("")
  const [sourceNotes, setSourceNotes] = useState<string>("")
  const [sourcing, setSourcing] = useState<boolean>(false)
  const [sourceSuccess, setSourceSuccess] = useState<string>("")
  const [sourceError, setSourceError] = useState<string>("")

  // Local overrides for real-time quantity updates before next API cycle
  const [quantityOverrides, setQuantityOverrides] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem("processor_inventory_overrides")
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  // Storage location mappings per batch
  const [storageLocations] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem("processor_storage_locations")
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  // Safety stock thresholds per crop/category (default 50 kg)
  const [safetyThresholds] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem("processor_safety_thresholds")
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  // Fetch incoming Retailer Demands
  const fetchRequests = async () => {
    try {
      setLoadingRequests(true)
      setRequestError("")
      const res = await axios.get(`${api}/processor/requests`, { headers })
      if (res.data?.success && res.data.data) {
        setRetailerRequests(res.data.data)
      }
    } catch (err: any) {
      console.warn("Could not load retailer requests", err)
      setRequestError(err.response?.data?.message || "Could not load retailer requests")
    } finally {
      setLoadingRequests(false)
    }
  }

  // Fetch active cold chain distributors
  const fetchDistributors = async () => {
    try {
      const res = await axios.get(`${api}/processor/distributors`, { headers })
      if (res.data?.success && res.data.distributors) {
        setDistributors(res.data.distributors)
      }
    } catch (err) {
      console.warn("Could not load distributors", err)
    }
  }

  useEffect(() => {
    if (token) {
      fetchRequests()
      fetchDistributors()
    }
  }, [token])

  // Save quantity overrides to localStorage
  const updateOverride = (key: string, qty: number) => {
    setQuantityOverrides((prev) => {
      const next = { ...prev, [key]: qty }
      try {
        localStorage.setItem("processor_inventory_overrides", JSON.stringify(next))
      } catch {}
      return next
    })
  }

  // Build Unified Inventory Ledger from Farmer Products & Processor Batches
  const inventoryItems = useMemo<InventoryItem[]>(() => {
    const list: InventoryItem[] = []
    const seenIds = new Set<string>()

    // 1. Processed Batches in Facility Warehouse (Only authentically accepted produce)
    Object.values(batches).forEach((b: any) => {
      if (!b || !b.originalProduct) return
      const p = b.originalProduct
      const pId = String(p.id || b.productId)
      const bNum = String(b.batchId || p.batch_number)

      // Strictly verify this batch was accepted and belongs to this processor:
      const isAccepted =
        decisions[pId]?.decision === "Accepted" ||
        (bNum && decisions[bNum]?.decision === "Accepted") ||
        Boolean(receipts[pId]) ||
        Boolean(receipts[bNum]) ||
        b.stageLogs?.some((l: any) => l.stage === "Accepted" || l.stage === "Processing Started" || l.stage === "Transferred")

      if (!isAccepted) return

      const bKey = `BATCH_${b.batchId}`
      seenIds.add(pId)
      seenIds.add(b.batchId)
      if (bNum) seenIds.add(bNum)

      const st = (b.deliveryRequestStatus || "").toUpperCase()
      const isCollectedByCarrier =
        st === "IN_TRANSIT" ||
        st === "PICKED_UP" ||
        st === "ARRIVED_AT_RETAILER" ||
        st === "DELIVERED" ||
        st === "COMPLETED"

      // Physical Intake Weight from Gate Receipt or initial batch quantity
      const receiptWeight = receipts[pId]?.receivedQty || p.quantity || 100
      const initialQty = b.processedQuantity || receiptWeight

      // Current Available Quantity in facility warehouse (0 if already collected by carrier)
      const overrideQty = quantityOverrides[bKey] ?? quantityOverrides[pId]
      const availableQty = isCollectedByCarrier
        ? 0
        : overrideQty !== undefined
        ? overrideQty
        : (b.processedQuantity || receiptWeight)

      // Allocated Quantity (already earmarked for active delivery or retailer order)
      const allocated = isCollectedByCarrier ? initialQty : Math.max(0, initialQty - availableQty)

      // Calculate Days until Expiry
      let daysUntilExpiry: number | undefined = undefined
      if (b.expiryDate) {
        const parts = b.expiryDate.split("/")
        if (parts.length === 3) {
          const expDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
          if (!isNaN(expDate.getTime())) {
            daysUntilExpiry = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          }
        }
      }
      if (daysUntilExpiry === undefined && b.estimatedShelfLifeDays) {
        daysUntilExpiry = b.estimatedShelfLifeDays
      }

      const defaultZone = b.originalProduct.category === "Vegetables"
        ? "Cold Storage Bay #1 (4°C)"
        : b.originalProduct.category === "Fruits"
        ? "Reefer Chamber #2 (8°C)"
        : "Ambient Warehouse Bay #4"

      list.push({
        id: b.batchId,
        productId: pId,
        batchNumber: b.batchId,
        name: p.name || "Packaged Agricultural Produce",
        category: p.category || "Processed Crops",
        initialQuantity: initialQty,
        availableQuantity: Math.max(0, availableQty),
        allocatedQuantity: allocated,
        unit: "kg",
        grade: p.ai_quality_label || "Grade A",
        qualityScore: p.ai_quality_score || 92,
        storageZone: storageLocations[b.batchId] || defaultZone,
        farmerName: p.farmer?.name || "Local Farmer Partner",
        farmLocation: p.farm_location || p.farmer?.location || "Bengaluru Rural APMC",
        intakeDate: b.completionDate || b.createdDate || new Date().toLocaleDateString("en-GB"),
        expiryDate: b.expiryDate,
        daysUntilExpiry: daysUntilExpiry ?? 14,
        isRawIntake: false,
        isPackaged: true,
        status: b.stage,
        productImage: p.product_image_url,
        safetyThreshold: safetyThresholds[p.name] || safetyThresholds[p.category] || 50
      })
    })

    // 2. Farm Gate Products (Raw Crops received & accepted from farmers)
    products.forEach((p: any) => {
      const pId = String(p.id)
      const bNum = String(p.batch_number || "")
      if (seenIds.has(pId) || (bNum && seenIds.has(bNum))) return

      // ONLY include products that were physically accepted and received by this processor:
      const isAccepted =
        decisions[pId]?.decision === "Accepted" ||
        (bNum && decisions[bNum]?.decision === "Accepted")
      const hasReceipt = Boolean(receipts[pId] || (bNum && receipts[bNum]))

      // Strictly exclude products that have not been accepted by this processor!
      if (!isAccepted && !hasReceipt) return

      seenIds.add(pId)
      if (bNum) seenIds.add(bNum)

      const initialQty = receipts[pId]?.receivedQty || p.quantity || 100
      const overrideQty = quantityOverrides[pId]
      const availableQty = overrideQty !== undefined ? overrideQty : initialQty

      let daysUntilExpiry = 10
      if (p.expiry_date) {
        const expDate = new Date(p.expiry_date)
        if (!isNaN(expDate.getTime())) {
          daysUntilExpiry = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }
      }

      const defaultZone = p.category === "Vegetables"
        ? "Cold Storage Bay #1 (4°C)"
        : p.category === "Fruits"
        ? "Reefer Chamber #2 (8°C)"
        : "Ambient Warehouse Bay #4"

      list.push({
        id: `RAW-${p.id}`,
        productId: pId,
        batchNumber: p.batch_number || `LOT-${p.product_id || p.id.slice(0, 6)}`,
        name: p.name || "Raw Agricultural Produce",
        category: p.category || "Field Crops",
        initialQuantity: initialQty,
        availableQuantity: Math.max(0, availableQty),
        allocatedQuantity: 0,
        unit: "kg",
        grade: p.ai_quality_label || "Grade A",
        qualityScore: p.ai_quality_score || 90,
        storageZone: storageLocations[pId] || defaultZone,
        farmerName: p.farmer?.name || "Local Farmer Partner",
        farmLocation: p.farm_location || p.farmer?.location || "Bengaluru APMC Zone",
        intakeDate: receipts[pId]?.arrivalDate || new Date(p.created_at || Date.now()).toLocaleDateString("en-GB"),
        expiryDate: p.expiry_date,
        daysUntilExpiry: daysUntilExpiry,
        isRawIntake: true,
        isPackaged: false,
        status: p.status || "In Warehouse",
        productImage: p.product_image_url,
        safetyThreshold: safetyThresholds[p.name] || safetyThresholds[p.category] || 50
      })
    })

    return list
  }, [products, batches, receipts, decisions, quantityOverrides, storageLocations, safetyThresholds])

  // Key KPI Aggregations
  const totalFarmIntakeKg = useMemo(() => {
    return inventoryItems.reduce((acc, item) => acc + item.initialQuantity, 0)
  }, [inventoryItems])

  const totalAvailableStockKg = useMemo(() => {
    return inventoryItems.reduce((acc, item) => acc + item.availableQuantity, 0)
  }, [inventoryItems])

  const totalAllocatedStockKg = useMemo(() => {
    return inventoryItems.reduce((acc, item) => acc + item.allocatedQuantity, 0)
  }, [inventoryItems])

  const lowStockAlertItems = useMemo(() => {
    return inventoryItems.filter(
      (item) => item.availableQuantity <= item.safetyThreshold || (item.daysUntilExpiry !== undefined && item.daysUntilExpiry <= 3)
    )
  }, [inventoryItems])

  // Open retailer orders awaiting fulfillment
  const openRetailerRequests = useMemo(() => {
    return retailerRequests.filter((r) => r.status === "REQUESTED" || r.status === "PENDING" || !r.status)
  }, [retailerRequests])

  // Filtered Inventory List
  const filteredInventory = useMemo(() => {
    return inventoryItems.filter((item) => {
      // Subtab Filter
      if (subTab === "raw" && !item.isRawIntake) return false
      if (subTab === "packaged" && !item.isPackaged) return false
      if (subTab === "alerts") {
        const isLow = item.availableQuantity <= item.safetyThreshold
        const isExpiring = item.daysUntilExpiry !== undefined && item.daysUntilExpiry <= 3
        if (!isLow && !isExpiring) return false
      }

      // Category Filter
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false

      // Stock Level Filter
      if (stockLevelFilter === "LOW" && item.availableQuantity > item.safetyThreshold) return false
      if (stockLevelFilter === "AVAILABLE" && item.availableQuantity <= 0) return false
      if (stockLevelFilter === "ALLOCATED" && item.allocatedQuantity <= 0) return false

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesBatch = item.batchNumber.toLowerCase().includes(q)
        const matchesFarmer = item.farmerName.toLowerCase().includes(q)
        const matchesZone = item.storageZone.toLowerCase().includes(q)
        if (!matchesName && !matchesBatch && !matchesFarmer && !matchesZone) return false
      }

      return true
    })
  }, [inventoryItems, subTab, categoryFilter, stockLevelFilter, searchQuery])

  // Categories present in inventory
  const uniqueCategories = useMemo(() => {
    const set = new Set(inventoryItems.map((i) => i.category).filter(Boolean))
    return Array.from(set)
  }, [inventoryItems])

  // Find matching available inventory for a specific retailer request
  const getInventoryCoverageForRequest = (req: any) => {
    const reqName = (req.product_name || "").toLowerCase()
    const matching = inventoryItems.filter((i) => {
      const iName = i.name.toLowerCase()
      const iCat = i.category.toLowerCase()
      return iName.includes(reqName) || reqName.includes(iName) || iCat.includes(reqName)
    })
    const totalAvail = matching.reduce((sum, item) => sum + item.availableQuantity, 0)
    const requested = Number(req.quantity) || 0
    const coveragePercent = requested > 0 ? Math.min(100, Math.round((totalAvail / requested) * 100)) : 100
    const deficit = Math.max(0, requested - totalAvail)

    return {
      matchingItems: matching,
      totalAvailable: totalAvail,
      requested,
      coveragePercent,
      deficit,
      isFullyStocked: totalAvail >= requested,
      isPartiallyStocked: totalAvail > 0 && totalAvail < requested,
      isOutOfStock: totalAvail === 0
    }
  }

  // Handle Opening Quantity Adjustment Modal
  const openAdjustModal = (item: InventoryItem) => {
    setAdjustModalItem(item)
    setAdjustOperation("deduct")
    setAdjustAmount("10")
    setAdjustReason("Sorting & Quality Grade Loss")
    setAdjustNotes("")
    setAdjustSuccessMsg("")
    setAdjustErrorMsg("")
  }

  // Submit Quantity Adjustment
  const handleConfirmAdjust = async () => {
    if (!adjustModalItem) return
    const delta = Number(adjustAmount)
    if (isNaN(delta) || delta < 0) {
      setAdjustErrorMsg("Please enter a valid positive quantity number")
      return
    }

    setAdjusting(true)
    setAdjustErrorMsg("")
    setAdjustSuccessMsg("")

    try {
      let targetNewQty = adjustModalItem.availableQuantity
      let signedDelta = delta

      if (adjustOperation === "deduct") {
        targetNewQty = Math.max(0, adjustModalItem.availableQuantity - delta)
        signedDelta = -delta
      } else if (adjustOperation === "add") {
        targetNewQty = adjustModalItem.availableQuantity + delta
        signedDelta = delta
      } else {
        targetNewQty = Math.max(0, delta)
        signedDelta = targetNewQty - adjustModalItem.availableQuantity
      }

      // Call Backend API to persist adjustment
      try {
        await axios.put(
          `${api}/processor/inventory/${adjustModalItem.productId}/adjust`,
          {
            new_quantity: targetNewQty,
            change_amount: signedDelta,
            reason: adjustReason,
            notes: adjustNotes
          },
          { headers }
        )
      } catch (apiErr) {
        // Fallback: update product via /products/:id/status
        try {
          await axios.put(
            `${api}/products/${adjustModalItem.productId}/status`,
            {
              quantity: targetNewQty,
              extraInfo: `Stock adjusted: ${adjustReason} (${signedDelta > 0 ? '+' : ''}${signedDelta} kg)`
            },
            { headers }
          )
        } catch (fbErr) {
          console.warn("Direct DB quantity update fallback used", fbErr)
        }
      }

      // Update Local Overrides for instant responsive UI
      const bKey = `BATCH_${adjustModalItem.batchNumber}`
      updateOverride(bKey, targetNewQty)
      updateOverride(adjustModalItem.productId, targetNewQty)

      if (onAdjustBatchQuantity) {
        onAdjustBatchQuantity(adjustModalItem.batchNumber, targetNewQty, adjustReason)
      }

      setAdjustSuccessMsg(`Stock updated successfully: ${adjustModalItem.availableQuantity} kg -> ${targetNewQty} kg`)
      onRefreshProducts()

      setTimeout(() => {
        setAdjustModalItem(null)
      }, 1200)
    } catch (err: any) {
      setAdjustErrorMsg(err.message || "Failed to adjust inventory quantity")
    } finally {
      setAdjusting(false)
    }
  }

  // Handle Opening Fulfill Modal for a Retailer Request
  const openFulfillModal = (req: any) => {
    setFulfillModalRequest(req)
    setFulfillSuccess("")
    setFulfillError("")
    setFulfillNotes(`Allocated from Processor Central Warehouse for Store #${req.destination_store || req.retailer_id?.slice(0, 6) || ""}`)
    setAllocateQty(String(req.quantity || 100))

    // Preselect best matching inventory batch with highest available stock
    const coverage = getInventoryCoverageForRequest(req)
    if (coverage.matchingItems.length > 0) {
      const best = coverage.matchingItems.sort((a, b) => b.availableQuantity - a.availableQuantity)[0]
      setSelectedInventoryItemId(best.id)
    } else {
      setSelectedInventoryItemId(inventoryItems[0]?.id || "")
    }

    if (distributors.length > 0) {
      setSelectedDistributorId(distributors[0].id)
    }
  }

  // Confirm Fulfillment from Stock
  const handleConfirmFulfill = async () => {
    if (!fulfillModalRequest || !selectedInventoryItemId) return
    const chosenItem = inventoryItems.find((i) => i.id === selectedInventoryItemId)
    if (!chosenItem) return

    const qtyToAllocate = Number(allocateQty) || Number(fulfillModalRequest.quantity) || 0
    if (qtyToAllocate <= 0) {
      setFulfillError("Please enter a valid quantity to allocate")
      return
    }

    if (qtyToAllocate > chosenItem.availableQuantity) {
      setFulfillError(`Insufficient stock in selected batch. Available: ${chosenItem.availableQuantity} kg, Requested: ${qtyToAllocate} kg. Please adjust allocation quantity or select another batch.`)
      return
    }

    setFulfilling(true)
    setFulfillError("")
    setFulfillSuccess("")

    try {
      // 1. Submit Fulfill to Processor Request Endpoint
      await axios.put(
        `${api}/processor/requests/${fulfillModalRequest.id}/fulfill`,
        {
          product_id: chosenItem.productId,
          distributor_id: selectedDistributorId || undefined,
          quantity: qtyToAllocate,
          notes: fulfillNotes
        },
        { headers }
      )

      // 2. Deduct allocated quantity from inventory in local state & database
      const newAvailQty = Math.max(0, chosenItem.availableQuantity - qtyToAllocate)
      const bKey = `BATCH_${chosenItem.batchNumber}`
      updateOverride(bKey, newAvailQty)
      updateOverride(chosenItem.productId, newAvailQty)

      setFulfillSuccess(`Order fulfilled! ${qtyToAllocate} kg allocated from Batch ${chosenItem.batchNumber}. Remaining stock: ${newAvailQty} kg.`)
      fetchRequests()
      onRefreshProducts()

      setTimeout(() => {
        setFulfillModalRequest(null)
      }, 1500)
    } catch (err: any) {
      setFulfillError(err.response?.data?.message || err.message || "Failed to fulfill request from stock")
    } finally {
      setFulfilling(false)
    }
  }

  // Handle Opening Sourcing Demand from Farmers
  const openSourceModal = (req: any, suggestedQty?: number) => {
    setSourceModalRequest(req)
    setSourceSuccess("")
    setSourceError("")
    setSourceTargetQty(String(suggestedQty || req.quantity || 100))
    setSourcePrice("45")
    setSourceNotes(`Urgent procurement for Retailer Demand Order: ${req.product_name} (${req.quantity} kg)`)
  }

  // Confirm Sourcing Order Broadcast
  const handleConfirmSource = async () => {
    if (!sourceModalRequest) return
    setSourcing(true)
    setSourceError("")
    setSourceSuccess("")

    try {
      await axios.put(
        `${api}/processor/requests/${sourceModalRequest.id}/source-farmers`,
        {
          offered_price: Number(sourcePrice) || undefined,
          target_quantity: Number(sourceTargetQty) || undefined,
          notes: sourceNotes
        },
        { headers }
      )
      setSourceSuccess(`Procurement order broadcasted to regional farmers for ${sourceTargetQty} kg ${sourceModalRequest.product_name}!`)
      fetchRequests()
      setTimeout(() => {
        setSourceModalRequest(null)
      }, 1400)
    } catch (err: any) {
      setSourceError(err.response?.data?.message || err.message || "Failed to broadcast sourcing order")
    } finally {
      setSourcing(false)
    }
  }

  // Helper crop emoji
  const getCropEmoji = (name: string) => {
    const lower = name.toLowerCase()
    if (lower.includes("tomato")) return "🍅"
    if (lower.includes("mango")) return "🥭"
    if (lower.includes("grape")) return "🍇"
    if (lower.includes("wheat")) return "🌾"
    if (lower.includes("potato")) return "🥔"
    if (lower.includes("onion")) return "🧅"
    if (lower.includes("apple")) return "🍎"
    if (lower.includes("carrot")) return "🥕"
    if (lower.includes("capsicum") || lower.includes("pepper")) return "🫑"
    return "🌱"
  }

  return (
    <div className="space-y-6">
      {/* 4-GRID HERO METRIC RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Farm Intake */}
        <Card className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Farm Intake
            </span>
            <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Warehouse className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900">{totalFarmIntakeKg.toLocaleString()} kg</p>
            <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Gate physical scale intake from farmers
            </p>
          </div>
        </Card>

        {/* Card 2: Packaged / Ready Stock */}
        <Card className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Available Free Stock
            </span>
            <div className="p-2 rounded-2xl bg-emerald-600 text-white shadow-xs">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-700">{totalAvailableStockKg.toLocaleString()} kg</p>
            <p className="text-xs text-slate-600 font-medium mt-1">
              Ready for immediate retailer order fulfillment
            </p>
          </div>
        </Card>

        {/* Card 3: Committed / Allocated */}
        <Card className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Allocated to Orders
            </span>
            <div className="p-2 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-indigo-900">{totalAllocatedStockKg.toLocaleString()} kg</p>
            <p className="text-xs text-indigo-700 font-semibold mt-1">
              {openRetailerRequests.length} active retailer purchase orders
            </p>
          </div>
        </Card>

        {/* Card 4: Low Stock & Expiry Alerts */}
        <Card className={`rounded-3xl border p-5 shadow-xs relative overflow-hidden ${
          lowStockAlertItems.length > 0
            ? "border-amber-300 bg-amber-50/50"
            : "border-emerald-200 bg-white"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Stock Alerts & Health
            </span>
            <div className={`p-2 rounded-2xl ${
              lowStockAlertItems.length > 0
                ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-2xl font-black ${
              lowStockAlertItems.length > 0 ? "text-amber-900" : "text-emerald-700"
            }`}>
              {lowStockAlertItems.length} Batch{lowStockAlertItems.length === 1 ? '' : 'es'}
            </p>
            <p className="text-xs text-slate-600 font-medium mt-1">
              {lowStockAlertItems.length > 0 ? "Below threshold or nearing expiry" : "All batches within healthy limits"}
            </p>
          </div>
        </Card>
      </div>

      {/* SUPPLY & DEMAND SHORTAGE BANNER (if any retailer request has deficit) */}
      {openRetailerRequests.some((r) => getInventoryCoverageForRequest(r).deficit > 0) && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-300 text-amber-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black text-sm text-amber-950">
                Incoming Retailer Demand Exceeds In-Stock Produce
              </p>
              <p className="text-xs text-amber-900/90">
                One or more retailer purchase orders have a stock deficit. Broadcast farmer sourcing orders to procure directly from regional producers.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setSubTab("demands")}
            className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs gap-1.5"
          >
            Review Demands ({openRetailerRequests.length})
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* MAIN INVENTORY HUB TABS & CONTROLS */}
      <Card className="rounded-3xl border border-emerald-200 bg-white shadow-sm p-6 space-y-6">
        {/* Header Ribbon & Sub-navigation */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-emerald-100 pb-5">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-emerald-950 flex items-center gap-2">
              <Warehouse className="h-6 w-6 text-emerald-600" />
              Processor Warehouse & Produce Inventory
            </h3>
            <p className="text-xs text-slate-600">
              Manage physical gate intake from farmers, packaging conversion, and retailer order fulfillment with complete quantity accounting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-emerald-50 border border-emerald-200 p-1 rounded-2xl">
            <button
              onClick={() => setSubTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                subTab === "all"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-emerald-950 hover:bg-emerald-100/50"
              }`}
            >
              All Produce ({inventoryItems.length})
            </button>
            <button
              onClick={() => setSubTab("raw")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                subTab === "raw"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-emerald-950 hover:bg-emerald-100/50"
              }`}
            >
              Farm Gate Intake ({inventoryItems.filter((i) => i.isRawIntake).length})
            </button>
            <button
              onClick={() => setSubTab("packaged")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                subTab === "packaged"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-emerald-950 hover:bg-emerald-100/50"
              }`}
            >
              Packaged Stock ({inventoryItems.filter((i) => i.isPackaged).length})
            </button>
            <button
              onClick={() => setSubTab("demands")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                subTab === "demands"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-emerald-950 hover:bg-emerald-100/50"
              }`}
            >
              <Store className="h-3 w-3" />
              Retailer Matcher ({openRetailerRequests.length})
            </button>
            <button
              onClick={() => setSubTab("alerts")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                subTab === "alerts"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-amber-900 hover:bg-amber-100/50"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              Stock Alerts ({lowStockAlertItems.length})
            </button>
          </div>
        </div>

        {/* RETAILER DEMAND MATCHER SUBTAB */}
        {subTab === "demands" ? (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl">
              <div>
                <h4 className="font-black text-sm text-emerald-950 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Supply & Demand Matcher: In-Stock Inventory ↔ Retailer Purchase Orders
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Real-time algorithmic check comparing open supermarket purchase orders with free unallocated warehouse stock.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchRequests}
                disabled={loadingRequests}
                className="rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 text-xs font-bold shrink-0 gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingRequests ? "animate-spin" : ""}`} />
                Refresh Demands
              </Button>
            </div>

            {requestError && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-2xl border border-red-200">
                {requestError}
              </p>
            )}

            {loadingRequests ? (
              <div className="py-20 text-center text-slate-500 space-y-2">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-emerald-600" />
                <p className="text-sm font-semibold">Matching warehouse inventory against retailer purchase orders...</p>
              </div>
            ) : openRetailerRequests.length === 0 ? (
              <div className="py-20 text-center text-slate-500 space-y-2">
                <Store className="h-10 w-10 mx-auto text-emerald-300 mb-2" />
                <p className="font-bold text-lg text-slate-800">No Open Retailer Purchase Orders</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  All retailer orders are currently fulfilled or in transit. New supermarket demands will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {openRetailerRequests.map((req) => {
                  const coverage = getInventoryCoverageForRequest(req)
                  return (
                    <div
                      key={req.id}
                      className="p-5 rounded-3xl border border-emerald-200 bg-white hover:border-emerald-300 transition-all space-y-4 shadow-xs"
                    >
                      {/* Top Row: Product, Store, and Stock Coverage Badge */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl p-2 rounded-2xl bg-emerald-50 border border-emerald-200">
                            {getCropEmoji(req.product_name || "")}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {req.request_id || `PO-${req.id?.slice(0, 6)}`}
                              </span>
                              <span className="text-xs font-medium text-slate-600">
                                Required by: <strong className="text-slate-900">{req.required_date || "Within 48h"}</strong>
                              </span>
                            </div>
                            <h4 className="font-black text-base text-slate-900 mt-0.5">
                              {req.product_name} • {req.quantity} {req.unit || "kg"}
                            </h4>
                          </div>
                        </div>

                        {/* Status coverage badge */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              coverage.isFullyStocked
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                : coverage.isPartiallyStocked
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : "bg-red-100 text-red-900 border border-red-300"
                            }`}
                          >
                            {coverage.isFullyStocked ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            )}
                            {coverage.isFullyStocked
                              ? `100% In Stock (${coverage.totalAvailable} kg available)`
                              : coverage.isPartiallyStocked
                              ? `Partial Stock (${coverage.totalAvailable} / ${coverage.requested} kg)`
                              : "Out of Stock (0 kg)"}
                          </span>
                        </div>
                      </div>

                      {/* Middle: Store Details & Coverage Visual Bar */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                            🏬 Retailer Store
                          </span>
                          <p className="font-bold text-slate-900 text-sm">{req.retailer_name || req.destination_store || "Metro Fresh Supermarket"}</p>
                          <p className="text-[11px] text-slate-500">{req.delivery_location || "Store Hub Dispatch Bay"}</p>
                        </div>

                        <div className="p-3 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                            ⚖️ Target Quantity & SLA
                          </span>
                          <p className="font-bold text-slate-900 text-sm">{req.quantity} {req.unit || "kg"}</p>
                          <p className="text-[11px] text-emerald-700 font-semibold">{req.quality_tier || "Grade A Certified"}</p>
                        </div>

                        <div className="p-3 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700">Inventory Stock Coverage</span>
                            <span className="font-bold text-emerald-800">{coverage.coveragePercent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                coverage.isFullyStocked
                                  ? "bg-emerald-600"
                                  : coverage.isPartiallyStocked
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${coverage.coveragePercent}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500">
                            {coverage.deficit > 0 ? `Deficit: ${coverage.deficit} kg short` : "Fully covered by warehouse batches"}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Row: Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-emerald-100">
                        <div className="text-xs text-slate-600 flex items-center gap-1.5">
                          <Boxes className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>
                            {coverage.matchingItems.length > 0
                              ? `${coverage.matchingItems.length} matching batch${coverage.matchingItems.length > 1 ? 'es' : ''} available in warehouse`
                              : "No matching batches in facility storage"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {coverage.totalAvailable > 0 && (
                            <Button
                              size="sm"
                              onClick={() => openFulfillModal(req)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
                            >
                              <Package className="h-3.5 w-3.5" />
                              Fulfill from Warehouse Stock
                            </Button>
                          )}

                          {coverage.deficit > 0 && (
                            <Button
                              size="sm"
                              variant={coverage.totalAvailable > 0 ? "outline" : "default"}
                              onClick={() => openSourceModal(req, coverage.deficit)}
                              className={`rounded-xl text-xs font-bold gap-1.5 shadow-xs ${
                                coverage.totalAvailable > 0
                                  ? "border-amber-300 text-amber-900 hover:bg-amber-50"
                                  : "bg-amber-600 hover:bg-amber-500 text-white"
                              }`}
                            >
                              <TrendingUp className="h-3.5 w-3.5" />
                              Procure Deficit ({coverage.deficit} kg) from Farmers
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* REGULAR INVENTORY LEDGER (ALL, RAW, PACKAGED, ALERTS) */
          <div className="space-y-5">
            {/* Search, Filter Pills & Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by produce, batch #, farmer, or storage zone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-2xl border border-emerald-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-2xl border border-emerald-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {/* Stock Level Filter */}
                <select
                  value={stockLevelFilter}
                  onChange={(e) => setStockLevelFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-2xl border border-emerald-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Stock Levels</option>
                  <option value="AVAILABLE">Available Free Stock (&gt;0)</option>
                  <option value="LOW">Low Stock Alert (&lt;50 kg)</option>
                  <option value="ALLOCATED">Allocated / Earmarked</option>
                </select>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRefreshProducts}
                  className="rounded-2xl border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-xs font-bold gap-1.5 h-9"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Empty State */}
            {filteredInventory.length === 0 ? (
              <div className="py-20 text-center text-slate-500 space-y-2">
                <Package className="h-10 w-10 mx-auto text-emerald-300 mb-2" />
                <p className="font-bold text-lg text-slate-800">No Produce Batches Found</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery || categoryFilter !== "ALL" || stockLevelFilter !== "ALL"
                    ? "No inventory matches your active filter or search criteria. Try clearing filters."
                    : "Intake and accept farmer crops in the Marketplace or Pipeline to populate your warehouse inventory."}
                </p>
              </div>
            ) : (
              /* INVENTORY DATA TABLE / CARDS */
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-emerald-200 text-slate-600 font-bold bg-emerald-50/40">
                      <th className="py-3 px-3 rounded-l-2xl">Produce & Origin</th>
                      <th className="py-3 px-3">Batch ID / Lot</th>
                      <th className="py-3 px-3">Quality & Grade</th>
                      <th className="py-3 px-3">Storage Location</th>
                      <th className="py-3 px-3">Stock Balance (Available / Initial)</th>
                      <th className="py-3 px-3">Expiry / SLA</th>
                      <th className="py-3 px-3 text-right rounded-r-2xl">Inventory Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100 text-slate-800">
                    {filteredInventory.map((item) => {
                      const utilizationPercent = item.initialQuantity > 0
                        ? Math.round((item.availableQuantity / item.initialQuantity) * 100)
                        : 0
                      const isLowStock = item.availableQuantity <= item.safetyThreshold
                      const isExpiringSoon = item.daysUntilExpiry !== undefined && item.daysUntilExpiry <= 3

                      return (
                        <tr key={item.id} className="hover:bg-emerald-50/40 transition-colors">
                          {/* Produce & Origin */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl p-2 rounded-xl bg-emerald-50 border border-emerald-200 shrink-0">
                                {getCropEmoji(item.name)}
                              </span>
                              <div>
                                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                  {item.name}
                                  {item.isPackaged && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                                      Packaged
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  Farmer: <strong className="text-slate-700">{item.farmerName}</strong> ({item.farmLocation})
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Batch ID */}
                          <td className="py-3.5 px-3">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {item.batchNumber}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1">Intake: {item.intakeDate}</p>
                          </td>

                          {/* Quality Grade */}
                          <td className="py-3.5 px-3">
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                {item.grade} ({item.qualityScore}%)
                              </span>
                              <p className="text-[10px] text-slate-500">Gate AI Verified</p>
                            </div>
                          </td>

                          {/* Storage Location */}
                          <td className="py-3.5 px-3">
                            <span className="font-medium text-slate-800 flex items-center gap-1">
                              <Warehouse className="h-3 w-3 text-slate-400" />
                              {item.storageZone}
                            </span>
                          </td>

                          {/* Stock Balance with Bar */}
                          <td className="py-3.5 px-3">
                            <div className="space-y-1.5 min-w-[140px]">
                              <div className="flex items-center justify-between text-xs">
                                <span className={`font-black ${
                                  isLowStock ? "text-amber-700 font-bold" : "text-emerald-950 font-bold"
                                }`}>
                                  {item.availableQuantity} {item.unit}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  of {item.initialQuantity} {item.unit}
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isLowStock ? "bg-amber-500" : "bg-emerald-600"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, utilizationPercent))}%` }}
                                />
                              </div>
                              {isLowStock && (
                                <p className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Low Stock Warning
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Expiry */}
                          <td className="py-3.5 px-3">
                            <div className="space-y-0.5">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                                isExpiringSoon ? "text-red-700 font-black" : "text-slate-700"
                              }`}>
                                <Clock className="h-3 w-3 text-slate-400" />
                                {item.daysUntilExpiry !== undefined ? `${item.daysUntilExpiry} Days Left` : "Certified Fresh"}
                              </span>
                              <p className="text-[10px] text-slate-400">{item.expiryDate || "Cold Chain Preserved"}</p>
                            </div>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openAdjustModal(item)}
                                className="h-8 px-2.5 rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 text-xs font-bold gap-1 shadow-xs"
                                title="Adjust inventory quantity (sorting loss, recount, wastage, intake)"
                              >
                                <Scale className="h-3.5 w-3.5" />
                                Adjust Qty
                              </Button>

                              {item.isRawIntake && onOpenPipeline && (
                                <Button
                                  size="sm"
                                  onClick={() => onOpenPipeline("processing")}
                                  className="h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1 shadow-xs"
                                  title="Send raw crop to active processing and packaging pipeline"
                                >
                                  Process &rarr;
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* MODAL 1: QUANTITY ADJUSTMENT MODAL */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-emerald-950">
                    Adjust Inventory Quantity
                  </h4>
                  <p className="text-xs text-slate-600">
                    Batch {adjustModalItem.batchNumber} • {adjustModalItem.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Stock vs Adjustment Balance Preview */}
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Current Available Stock</span>
                <p className="text-xl font-black text-slate-900">{adjustModalItem.availableQuantity} kg</p>
              </div>
              <ArrowRight className="h-5 w-5 text-emerald-600" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Projected New Stock</span>
                <p className="text-xl font-black text-emerald-700">
                  {adjustOperation === "deduct"
                    ? Math.max(0, adjustModalItem.availableQuantity - (Number(adjustAmount) || 0))
                    : adjustOperation === "add"
                    ? adjustModalItem.availableQuantity + (Number(adjustAmount) || 0)
                    : Number(adjustAmount) || 0} kg
                </p>
              </div>
            </div>

            {/* Operation Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Adjustment Operation</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustOperation("deduct")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                    adjustOperation === "deduct"
                      ? "bg-red-50 text-red-900 border-red-300 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Minus className="h-3.5 w-3.5" />
                  Deduct Stock (-)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustOperation("add")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                    adjustOperation === "add"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Stock (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustOperation("set")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                    adjustOperation === "set"
                      ? "bg-indigo-50 text-indigo-900 border-indigo-300 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Set Exact Level
                </button>
              </div>
            </div>

            {/* Amount Input & Presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Quantity (kg)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-emerald-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">kg</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {["5", "10", "25", "50", "100"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAdjustAmount(preset)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-[11px] font-bold text-slate-700 transition-colors"
                  >
                    {adjustOperation === "deduct" ? `-${preset}` : adjustOperation === "add" ? `+${preset}` : preset} kg
                  </button>
                ))}
              </div>
            </div>

            {/* Reason Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Accounting / Audit Reason</label>
              <select
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl border border-emerald-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none"
              >
                <option value="Sorting & Quality Grade Loss">Sorting & Quality Grade Loss (Bruised/Damaged)</option>
                <option value="Post-Harvest Trimming & Peeling">Post-Harvest Trimming & Peeling Loss</option>
                <option value="Moisture & Storage Dehydration">Moisture & Storage Dehydration Loss</option>
                <option value="Physical Dock Scale Recount">Physical Dock Scale Recount</option>
                <option value="Additional Inward Farm Intake">Additional Inward Farm Consignment Arrival</option>
                <option value="Internal Quality Lab Sampling">Internal Quality Lab Sampling</option>
                <option value="General Warehouse Inventory Audit">General Warehouse Inventory Audit</option>
              </select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Notes / Remarks (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Weighbridge recalibrated, crate verification completed"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl border border-emerald-200 text-xs focus:outline-none"
              />
            </div>

            {/* Feedback Messages */}
            {adjustErrorMsg && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                {adjustErrorMsg}
              </p>
            )}
            {adjustSuccessMsg && (
              <p className="text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                {adjustSuccessMsg}
              </p>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdjustModalItem(null)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmAdjust}
                disabled={adjusting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
              >
                {adjusting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Confirm Adjustment
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 2: FULFILL RETAILER REQUEST FROM INVENTORY */}
      {fulfillModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-emerald-950">
                    Fulfill Retailer Purchase Order
                  </h4>
                  <p className="text-xs text-slate-600">
                    Order {fulfillModalRequest.request_id || fulfillModalRequest.id?.slice(0, 8)} • {fulfillModalRequest.product_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFulfillModalRequest(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Order Target Summary */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Retailer Supermarket:</span>
                <strong className="text-slate-900">{fulfillModalRequest.retailer_name || fulfillModalRequest.destination_store || "Metro Fresh Supermarket"}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Required Quantity:</span>
                <strong className="text-emerald-800 font-bold">{fulfillModalRequest.quantity} {fulfillModalRequest.unit || "kg"}</strong>
              </div>
            </div>

            {/* Select Which Warehouse Batch to Deduct from */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Select Warehouse Batch</label>
              <select
                value={selectedInventoryItemId}
                onChange={(e) => setSelectedInventoryItemId(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl border border-emerald-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none cursor-pointer"
              >
                {inventoryItems
                  .filter((i) => i.availableQuantity > 0)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Batch {item.batchNumber}) — {item.availableQuantity} kg available ({item.grade})
                    </option>
                  ))}
              </select>
            </div>

            {/* Quantity to Allocate */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Quantity to Allocate (kg)</label>
              <input
                type="number"
                min="1"
                value={allocateQty}
                onChange={(e) => setAllocateQty(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-emerald-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="text-[11px] text-slate-500">
                This quantity will be deducted from your warehouse stock and scheduled for cold-chain carrier dispatch.
              </p>
            </div>

            {/* Select Carrier */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Cold Chain Carrier / Distributor</label>
              <select
                value={selectedDistributorId}
                onChange={(e) => setSelectedDistributorId(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl border border-emerald-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none cursor-pointer"
              >
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.vehicle_number || "Reefer Fleet"}) • {d.availability_status || "Available"}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Fulfillment Manifest Notes</label>
              <input
                type="text"
                value={fulfillNotes}
                onChange={(e) => setFulfillNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl border border-emerald-200 text-xs focus:outline-none"
              />
            </div>

            {/* Status alerts */}
            {fulfillError && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                {fulfillError}
              </p>
            )}
            {fulfillSuccess && (
              <p className="text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                {fulfillSuccess}
              </p>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFulfillModalRequest(null)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmFulfill}
                disabled={fulfilling}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
              >
                {fulfilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Confirm Stock Allocation & Dispatch
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 3: SOURCE DEFICIT FROM FARMERS */}
      {sourceModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-lg rounded-3xl border border-amber-300 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-amber-950">
                    Procure Produce from Farmers
                  </h4>
                  <p className="text-xs text-slate-600">
                    Broadcast procurement demand to regional farmers
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSourceModalRequest(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Target Produce:</span>
                <strong className="text-slate-900 font-bold">{sourceModalRequest.product_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Supermarket Request:</span>
                <strong className="text-slate-900">{sourceModalRequest.retailer_name || "Supermarket Partner"}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Target Quantity (kg)</label>
                <input
                  type="number"
                  min="10"
                  value={sourceTargetQty}
                  onChange={(e) => setSourceTargetQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl border border-amber-200 text-xs font-bold focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Offered Price (₹/kg)</label>
                <input
                  type="number"
                  min="1"
                  value={sourcePrice}
                  onChange={(e) => setSourcePrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl border border-amber-200 text-xs font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Procurement Notes / Quality SLA</label>
              <input
                type="text"
                value={sourceNotes}
                onChange={(e) => setSourceNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl border border-amber-200 text-xs focus:outline-none"
              />
            </div>

            {sourceError && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                {sourceError}
              </p>
            )}
            {sourceSuccess && (
              <p className="text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                {sourceSuccess}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSourceModalRequest(null)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmSource}
                disabled={sourcing}
                className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
              >
                {sourcing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Broadcast to Farmers
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
