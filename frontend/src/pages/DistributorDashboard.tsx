import { useState, useEffect, useRef } from "react"
import axios from "axios"
import {
  Package, Truck, CheckCircle, Zap, TrendingUp, QrCode,
  SplitSquareHorizontal, Clock, ShieldCheck, Camera, Upload, X, Loader2,
  CheckCircle2, Store, Thermometer, RefreshCw, Navigation, MapPin, ExternalLink
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { Button } from "../components/ui/Button"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useAuth } from "../context/AuthContext"
import { Html5Qrcode } from "html5-qrcode"
import jsQR from "jsqr"
import { RouteMapModal } from "../components/distributor/RouteMapModal"
import { getGoogleMapsDestinationUrl } from "../utils"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

const routeData = [
  { day: "Mon", deliveries: 8, onTime: 7 },
  { day: "Tue", deliveries: 12, onTime: 11 },
  { day: "Wed", deliveries: 9, onTime: 9 },
  { day: "Thu", deliveries: 15, onTime: 13 },
  { day: "Fri", deliveries: 18, onTime: 16 },
  { day: "Sat", deliveries: 11, onTime: 10 },
]

export function DistributorDashboard() {
  const { user, token, updateUser } = useAuth()
  const [activeTab, setActiveTab] = useState("overview")
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
  const [deliveryRemarks, setDeliveryRemarks] = useState("Cold-chain temperature maintained at 3.8°C; intake acknowledged by store manager")
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [deliverySuccessTx, setDeliverySuccessTx] = useState("")
  const [deliveryError, setDeliveryError] = useState("")

  const [allProducts, setAllProducts] = useState<any[]>([])

  // Delivery Requests state (from Processors)
  const [deliveryRequests, setDeliveryRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestsFilter, setRequestsFilter] = useState<"ALL" | "REQUESTED" | "IN_TRANSIT" | "DECLINED">("ALL")
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null)
  const [declineModalRequest, setDeclineModalRequest] = useState<any | null>(null)
  const [selectedMapRequest, setSelectedMapRequest] = useState<any | null>(null)
  const [declineReasonInput, setDeclineReasonInput] = useState("Vehicle capacity currently booked on another route")

  const fetchDeliveryRequests = async () => {
    try {
      setLoadingRequests(true)
      const res = await axios.get(`${API_URL}/distributor/delivery-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.success) {
        setDeliveryRequests(res.data.data || [])
      }
    } catch (err) {
      console.warn("Could not load delivery requests", err)
    } finally {
      setLoadingRequests(false)
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
        await fetchDeliveryRequests()
        await fetchInventory()
        if (action === "ACCEPT") {
          setActiveTab("fleet")
        }
      }
    } catch (err: any) {
      console.error("Failed to respond to delivery request", err)
    } finally {
      setRespondingRequestId(null)
      setDeclineModalRequest(null)
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

      // Real-time synchronization poller every 5 seconds
      const interval = setInterval(() => {
        fetchDeliveryRequests()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [token])

  useEffect(() => {
    if (token && (activeTab === "requests" || activeTab === "overview")) {
      fetchDeliveryRequests()
    }
  }, [activeTab, token])

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

      const updateRes = await axios.put(`${API_URL}/products/${resolvedProduct.id}/status`, {
        status: 'In Transit',
        current_owner_id: user?.id,
        extraInfo: `Distributor (${user?.name || user?.email || 'Carrier'}) took custody. Cold-chain reefer truck dispatched.`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const newTxHash = updateRes.data?.data?.blockchain_hash
      setHandoffTxHash(newTxHash || "")
      setHandoffSuccess(`Successfully took custody of ${resolvedProduct.name} (Batch: ${resolvedProduct.batch_number}). Recorded on Sepolia!`)
      setHandoffId("")
      setScannedBatchPreview(null)
      fetchInventory()
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
      const updateRes = await axios.put(`${API_URL}/products/${deliveryModalItem.id}/status`, {
        status: 'At Retailer',
        extraInfo: `Delivered to ${destinationStore}: ${deliveryRemarks}`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const txHash = updateRes.data?.data?.blockchain_hash
      setDeliverySuccessTx(txHash || "0x_confirmed")
      fetchInventory()
      setTimeout(() => {
        setDeliveryModalItem(null)
        setDeliverySuccessTx("")
      }, 3500)
    } catch (err: any) {
      setDeliveryError(err.response?.data?.message || "Failed to record delivery on blockchain.")
    } finally {
      setDeliveryLoading(false)
    }
  }

  // Calculate dynamic stats
  const activeShipmentsCount = inventory.filter(p => p.status === 'In Transit').length
  const deliveredCount = inventory.filter(p => p.status === 'At Retailer' || p.status === 'Delivered').length

  const stats = [
    { title: "Active In Transit", value: activeShipmentsCount, icon: Truck, color: "text-blue-500" },
    { title: "Delivered to Retailers", value: deliveredCount, icon: CheckCircle, color: "text-green-500" },
    { title: "AI Route Efficiency", value: "94%", icon: Zap, color: "text-amber-500" },
    { title: "Cold-Chain Integrity", value: "100%", icon: ShieldCheck, color: "text-emerald-500" },
    { title: "Total Batches Handled", value: inventory.length, icon: Package, color: "text-purple-500" },
    { title: "Delivery Success Rate", value: "98.5%", icon: TrendingUp, color: "text-primary" },
  ]

  const OverviewTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      {/* PENDING DELIVERY REQUESTS ALERT BANNER */}
      {deliveryRequests.filter((r) => r.status === "REQUESTED").length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-amber-500 animate-pulse shrink-0" />
            <div>
              <p className="font-bold text-sm text-foreground">
                {deliveryRequests.filter((r) => r.status === "REQUESTED").length} Delivery Request(s) Awaiting Your Review
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Processors have submitted cargo dispatch manifests for your cold-chain fleet. Accept or decline them.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setActiveTab("requests")}
            className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shrink-0 self-start sm:self-center"
          >
            Review Requests
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.title} className="col-span-1 border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="col-span-2 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Delivery Performance</CardTitle>
            <CardDescription>AI-predicted route schedules vs. on-time arrival rate.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={routeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="deliveries" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} name="Total Deliveries" />
                <Area type="monotone" dataKey="onTime" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} name="On Time" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Logistics & Route Intelligence</CardTitle>
            <CardDescription>Real-time fleet notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Zap className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Multi-Drop Route Optimization</p>
                <p className="text-xs text-muted-foreground mt-1">Combine Koramangala and Indiranagar retail deliveries to reduce reefer fuel consumption by 18%.</p>
              </div>
            </div>

            <div className="flex gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Sepolia Ledger Active</p>
                <p className="text-xs text-muted-foreground mt-1">Every custody pickup and store delivery automatically publishes cryptographic proof to Sepolia.</p>
              </div>
            </div>

            {inventory.filter(i => i.expiry_date && new Date(i.expiry_date).getTime() < Date.now() + 3 * 24 * 60 * 60 * 1000).slice(0, 2).map((item, idx) => (
              <div key={idx} className="flex gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Priority Transit (FEFO)</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.name} ({item.batch_number}) has nearing expiry. Prioritize immediate store delivery.</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const FleetTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="col-span-2 border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active In-Transit Cargo</CardTitle>
              <CardDescription>Live batches currently in transit. Hand off to retailers upon store arrival.</CardDescription>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20">
              {inventory.filter(i => i.status === 'In Transit').length} Active
            </span>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs uppercase font-semibold">
                    <th className="text-left py-3 px-3">Batch & Product</th>
                    <th className="text-left py-3 px-3">Quantity</th>
                    <th className="text-left py-3 px-3">Transit Status</th>
                    <th className="text-right py-3 px-3">Store Delivery Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {inventory.filter(i => i.status === 'In Transit').length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-muted-foreground">
                        <Truck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm font-medium">No cargo currently in transit.</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Use the "Receive (Handoff)" tab to scan a farmer or processor batch QR code.</p>
                      </td>
                    </tr>
                  )}
                  {inventory.filter(i => i.status === 'In Transit').map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-foreground">{item.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">Batch: {item.batch_number}</div>
                      </td>
                      <td className="py-3.5 px-3 font-medium">
                        {item.quantity} kg
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          <Truck className="h-3 w-3" /> In Transit
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => setDeliveryModalItem(item)}
                        >
                          <Store className="h-3.5 w-3.5" />
                          Deliver to Store
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const matchingReq = deliveryRequests.find(r => r.batch_number === item.batch_number)
                            setSelectedMapRequest(matchingReq || {
                              batch_number: item.batch_number,
                              product_name: item.name,
                              quantity: item.quantity,
                              unit: "kg",
                              processor: {
                                facility_name: "Agro-Processing Facility",
                                facility_location: "Agro-Processing Unit #4, Yeshwanthpur APMC Yard, Bengaluru 560022"
                              },
                              retailer: {
                                destination_store: "Metro Fresh Mart Koramangala",
                                store_location: "Metro Fresh Supermarket, 80 Feet Road, 4th Block, Koramangala, Bengaluru 560034"
                              },
                              cold_chain_sla: { temperature_control: "2°C to 6°C Precision Chilled" }
                            })
                          }}
                          className="rounded-xl text-xs gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 ml-2"
                        >
                          <Navigation className="h-3 w-3" />
                          Route Map
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>AI Smart Dispatch</CardTitle>
            <CardDescription>Live GPS & cold-chain status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-2xl bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Vehicle</span>
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Reefer Truck KA-04-1234</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex justify-between">
                  <span>Reefer Cabin Temp:</span>
                  <span className="font-bold text-foreground">3.8°C (Optimal)</span>
                </p>
                <p className="flex justify-between">
                  <span>Humidity:</span>
                  <span className="font-bold text-foreground">84%</span>
                </p>
                <p className="flex justify-between">
                  <span>Next Delivery Point:</span>
                  <span className="font-bold text-foreground">Koramangala Supermarket</span>
                </p>
              </div>
              <div className="pt-2 border-t text-[11px] text-muted-foreground flex items-center gap-1.5 text-emerald-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Cold-chain SLA parameters verified.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ready for Pickup from Processing Facilities */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Ready for Transport from Processing Plants</CardTitle>
            <CardDescription>Inspected batches ready for distributor cold-chain pickup and retailer delivery.</CardDescription>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20">
            {allProducts.filter(p => p.status === 'Processed' || p.status === 'Processed - Grade A').length} Available
          </span>
        </CardHeader>
        <CardContent>
          {allProducts.filter(p => p.status === 'Processed' || p.status === 'Processed - Grade A').length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No batches currently waiting at processing facilities. Once a processor finishes grading, batches will appear here for pickup.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-2">Batch Number</th>
                    <th className="text-left py-3 px-2">Product</th>
                    <th className="text-left py-3 px-2">Quantity</th>
                    <th className="text-left py-3 px-2">Quality Grade</th>
                    <th className="text-right py-3 px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allProducts.filter(p => p.status === 'Processed' || p.status === 'Processed - Grade A').map((p) => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-3 px-2 font-mono font-medium">{p.batch_number}</td>
                      <td className="py-3 px-2">{p.name}</td>
                      <td className="py-3 px-2">{p.quantity} kg</td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600">
                          {p.ai_quality_label || "Grade A"}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button
                          size="sm"
                          className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={handoffLoading}
                          onClick={() => handleTakeCustody(p)}
                        >
                          <Truck className="h-3.5 w-3.5 mr-1" />
                          Take Custody & Start Transit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const InventoryTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Distributor Custody Inventory</CardTitle>
            <CardDescription>All batches currently or previously handled by your fleet.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading inventory...</div>
            ) : inventory.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Your inventory is empty.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase font-semibold">
                      <th className="text-left py-2.5 px-3">Batch / ID</th>
                      <th className="text-left py-2.5 px-3">Product</th>
                      <th className="text-left py-2.5 px-3">Expiry</th>
                      <th className="text-right py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {inventory.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="py-3 px-3">
                          <div className="font-mono text-xs font-semibold">{item.batch_number}</div>
                          <div className="text-[10px] text-muted-foreground">On-Chain ID: #{item.product_id || "N/A"}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.quantity} kg</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-xs text-muted-foreground">
                            {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            item.status === 'At Retailer' || item.status === 'Delivered'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Batch Consolidation & Splitting</CardTitle>
            <CardDescription>Allocate large farm harvests across multiple retail consignments.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Parent Cargo Batch</label>
                <select className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.batch_number} ({item.name}) - {item.quantity} kg
                    </option>
                  ))}
                  {inventory.length === 0 && <option>No inventory available</option>}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Retail Sub-Consignments</label>
                <input
                  type="number"
                  defaultValue={2}
                  min={2}
                  max={10}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              <Button className="w-full mt-4 rounded-xl" disabled={inventory.length === 0}>
                <SplitSquareHorizontal className="mr-2 h-4 w-4" />
                Generate Sub-Pallet QR Labels
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const BlockchainTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <Card className="max-w-2xl mx-auto border-border/50 shadow-sm">
        <CardHeader className="text-center pb-6">
          <div className="p-3 bg-primary/10 text-primary w-fit mx-auto rounded-full mb-3 border border-primary/20">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold">Logistics Handoff (Take Custody)</CardTitle>
          <CardDescription>
            Scan a batch QR code from a Farmer or Processor to cryptographically transfer custody to your fleet on Ethereum Sepolia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CAMERA SCANNER BUTTONS */}
          <div className="border-2 border-dashed border-border rounded-3xl p-8 flex flex-col items-center justify-center bg-card/50 text-center space-y-4">
            <div className="p-4 bg-muted rounded-full text-muted-foreground">
              <QrCode className="h-10 w-10 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Scan Harvest or Processor Crate QR</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Scan using your device camera or upload a saved label photo to verify batch contents.
              </p>
            </div>

            <div className="flex gap-3 w-full max-w-xs">
              <Button
                type="button"
                onClick={() => {
                  setShowScanner(true)
                  startLiveCamera()
                }}
                className="flex-1 rounded-xl text-xs gap-2 bg-primary text-white"
              >
                <Camera className="h-4 w-4" />
                Open Camera
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
                className="flex-1 rounded-xl text-xs gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Photo
              </Button>
            </div>
          </div>

          {/* SCANNED BATCH PREVIEW CARD */}
          {scannedBatchPreview && (
            <div className="p-5 rounded-2xl bg-card border border-emerald-500/30 space-y-4 animate-in fade-in">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    Batch Verified
                  </span>
                  <h3 className="text-lg font-bold text-foreground mt-1.5">{scannedBatchPreview.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    Batch: {scannedBatchPreview.batch_number} • On-Chain ID: #{scannedBatchPreview.product_id}
                  </p>
                </div>
                <button onClick={() => setScannedBatchPreview(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-muted/40 rounded-xl">
                  <span className="text-muted-foreground">Quantity:</span>
                  <p className="font-bold text-foreground text-sm">{scannedBatchPreview.quantity} kg</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl">
                  <span className="text-muted-foreground">Current Status:</span>
                  <p className="font-bold text-blue-500 text-sm">{scannedBatchPreview.status}</p>
                </div>
              </div>

              <Button
                onClick={() => handleTakeCustody(scannedBatchPreview)}
                disabled={handoffLoading}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
              >
                {handoffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Confirm Custody & Broadcast to Sepolia
              </Button>
            </div>
          )}

          {/* DIVIDER */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground font-medium">Or Enter Batch Number Manually</span>
            </div>
          </div>

          {/* SUCCESS ALERT */}
          {handoffSuccess && (
            <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-2xl text-xs space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> {handoffSuccess}
              </p>
              {handoffTxHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${handoffTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline font-mono text-[11px] text-emerald-500 hover:text-emerald-400"
                >
                  View Sepolia Block Explorer ↗
                </a>
              )}
            </div>
          )}

          {/* ERROR ALERT */}
          {handoffError && (
            <div className="p-4 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-2xl text-xs">
              {handoffError}
            </div>
          )}

          {/* MANUAL INPUT */}
          <div className="flex gap-2">
            <input
              type="text"
              value={handoffId}
              onChange={(e) => setHandoffId(e.target.value)}
              placeholder="e.g. 20 or BCH-APPLE-950801"
              className="flex h-11 w-full rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-foreground"
            />
            <Button
              onClick={() => previewBatchDetails(handoffId)}
              disabled={!handoffId || handoffLoading}
              className="h-11 px-5 rounded-xl shrink-0"
            >
              {handoffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Batch"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Availability status toggle with localStorage fallback
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusSuccess, setStatusSuccess] = useState(false)

  const updateStatus = async (status: string) => {
    setStatusLoading(true)
    setStatusSuccess(false)
    try {
      await axios.put(`${API_URL}/auth/status`, { availability_status: status }, {
        headers: { Authorization: `Bearer ${token}` }
      })
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

  const RequestsTab = () => {
    const pendingCount = deliveryRequests.filter((r) => r.status === "REQUESTED").length
    const filtered = deliveryRequests.filter((r) => {
      if (requestsFilter === "ALL") return true
      if (requestsFilter === "REQUESTED") return r.status === "REQUESTED"
      if (requestsFilter === "IN_TRANSIT") return r.status === "IN_TRANSIT" || r.status === "ACCEPTED"
      if (requestsFilter === "DECLINED") return r.status === "DECLINED"
      return true
    })

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Clock className="h-5 w-5 text-primary" />
              Incoming Delivery Requests from Processors
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Review formal crop dispatch requests sent by processing facilities. Accept to take custody or decline.
            </p>
          </div>

          {/* Filter Pills & Manual Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchDeliveryRequests}
              disabled={loadingRequests}
              className="rounded-full text-xs h-7 px-3 gap-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${loadingRequests ? "animate-spin text-primary" : ""}`} />
              Refresh
            </Button>
            {[
              { id: "ALL", label: `All (${deliveryRequests.length})` },
              { id: "REQUESTED", label: `Pending Review (${pendingCount})` },
              {
                id: "IN_TRANSIT",
                label: `Accepted (${deliveryRequests.filter((r) => r.status === "IN_TRANSIT" || r.status === "ACCEPTED").length})`
              },
              {
                id: "DECLINED",
                label: `Declined (${deliveryRequests.filter((r) => r.status === "DECLINED").length})`
              }
            ].map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={requestsFilter === f.id ? "default" : "outline"}
                onClick={() => setRequestsFilter(f.id as any)}
                className="rounded-full text-xs h-7 px-3"
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {loadingRequests ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-sm">Fetching delivery requests...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center rounded-3xl border shadow-sm">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <h4 className="text-base font-bold text-foreground">No Delivery Requests Found</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              {requestsFilter === "REQUESTED"
                ? "You have no pending delivery requests at the moment. All caught up!"
                : "When a processor finishes inspecting produce and requests your cold-chain fleet for transport, the detailed manifest will appear here."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-5">
            {filtered.map((req) => {
              const isPending = req.status === "REQUESTED"
              const isAccepted = req.status === "IN_TRANSIT" || req.status === "ACCEPTED"
              const isDeclined = req.status === "DECLINED"
              const isActioning = respondingRequestId === req.id

              return (
                <Card
                  key={req.id}
                  className="rounded-3xl border shadow-sm hover:border-primary/40 transition-all overflow-hidden p-6 space-y-4"
                >
                  {/* Top Bar: Batch, Tracking ID, Status */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {req.batch_number}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Tracking: {req.tracking_id}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          • {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-xl font-bold text-foreground flex items-center gap-2 pt-0.5">
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
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse"
                          : isAccepted
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/10 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {isPending && <Clock className="h-3.5 w-3.5" />}
                      {isAccepted && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {isDeclined && <X className="h-3.5 w-3.5" />}
                      {isPending ? "Pending Your Review" : isAccepted ? "Accepted & In Transit" : "Declined"}
                    </span>
                  </div>

                  {/* 4-Grid Specification Manifest */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {/* Cargo Quantity */}
                    <div className="p-3.5 rounded-2xl bg-muted/40 border space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                        📦 Cargo Quantity
                      </span>
                      <p className="font-bold text-sm text-foreground">
                        {req.quantity} {req.unit}
                      </p>
                      <p className="text-[11px] text-emerald-400 font-medium">Packaged Crates</p>
                    </div>

                    {/* Certified Quality & Expiry */}
                    <div className="p-3.5 rounded-2xl bg-muted/40 border space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                        🏅 Grade & Quality
                      </span>
                      <p className="font-bold text-sm text-foreground">
                        {req.quality_label || "Grade A"} ({req.quality_score || 92}%)
                      </p>
                      <p className="text-[11px] text-muted-foreground">Certified Shelf Life: {req.expiry_date || "14 Days"}</p>
                    </div>

                    {/* Route: Pickup & Destination */}
                    <div className="p-3.5 rounded-2xl bg-muted/40 border space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                        🏬 Destination Retailer
                      </span>
                      <p className="font-bold text-xs text-foreground truncate">
                        {req.retailer?.destination_store || "Retail Supermarket Hub"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Pickup: {req.processor?.facility_name || "Processor Facility"}
                      </p>
                    </div>

                    {/* Cold-Chain Temp SLA */}
                    <div className="p-3.5 rounded-2xl bg-muted/40 border space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                        ❄️ Cold-Chain Temp SLA
                      </span>
                      <p className="font-bold text-xs text-emerald-400 flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5" />{" "}
                        {req.cold_chain_sla?.temperature_control || "2°C to 6°C"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Reefer Truck Guaranteed</p>
                    </div>
                  </div>

                  {/* Verified Profile Locations & Navigation Waypoints */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Source Pickup (Processor Profile Location) */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> 1. Source (Processor Pickup Facility)
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">Origin Depot</span>
                      </div>
                      <div className="font-bold text-sm text-foreground">
                        {req.processor?.facility_name || "Agro-Processing Facility"}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {req.processor?.facility_location || req.processor?.facility_name || "Agro-Processing Unit #4, Yeshwanthpur APMC Yard, Bengaluru 560022"}
                      </p>
                      <div className="pt-1 flex items-center gap-3">
                        <a
                          href={getGoogleMapsDestinationUrl(req.processor?.facility_location || req.processor?.facility_name || "Agro-Processing Unit #4, Yeshwanthpur APMC Yard, Bengaluru 560022")}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                        >
                          <Navigation className="h-3 w-3" /> GPS to Pickup Facility
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>

                    {/* Destination Delivery (Retailer Profile Location) */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Store className="h-3 w-3" /> 2. Destination (Retailer Delivery Store)
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">Final Store Dock</span>
                      </div>
                      <div className="font-bold text-sm text-foreground">
                        {req.retailer?.destination_store || "Retail Supermarket"}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {req.retailer?.store_location || req.retailer?.destination_store || "Metro Fresh Supermarket, 80 Feet Road, 4th Block, Koramangala, Bengaluru 560034"}
                      </p>
                      <div className="pt-1 flex items-center gap-3">
                        <a
                          href={getGoogleMapsDestinationUrl(req.retailer?.store_location || req.retailer?.destination_store || "Metro Fresh Supermarket, 80 Feet Road, 4th Block, Koramangala, Bengaluru 560034")}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          <Navigation className="h-3 w-3" /> GPS to Retailer Store
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Processor Notes Strip */}
                  {req.processor_notes && (
                    <div className="p-3 rounded-xl bg-card border text-xs text-muted-foreground italic flex items-start gap-2">
                      <span className="font-bold not-italic text-foreground shrink-0">Processor Dispatch Notes:</span>
                      <span>"{req.processor_notes}"</span>
                    </div>
                  )}

                  {/* Declined Notice if applicable */}
                  {isDeclined && req.decline_reason && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                      <strong>Decline Reason Provided:</strong> "{req.decline_reason}"
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedMapRequest(req)}
                      className="w-full sm:w-auto rounded-xl text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-bold"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      View Route & Navigation Map
                    </Button>
                  {isPending && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isActioning}
                        onClick={() => setDeclineModalRequest(req)}
                        className="w-full sm:w-auto rounded-xl text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Decline Delivery
                      </Button>
                      <Button
                        size="sm"
                        disabled={isActioning}
                        onClick={() => handleRespondToRequest(req.id, "ACCEPT")}
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-sm"
                      >
                        {isActioning ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Recording Acceptance...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Accept Delivery & Start Route
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {isAccepted && (
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        Custody accepted! This cargo is in your transit inventory.
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTab("fleet")}
                        className="rounded-xl text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Truck className="h-3.5 w-3.5" />
                        View in Fleet & Deliver to Store
                      </Button>
                    </div>
                  )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* DECLINE REASON MODAL */}
        {declineModalRequest && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-md w-full rounded-3xl border border-zinc-800 bg-zinc-900 text-white shadow-2xl p-6 space-y-4">
              <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="font-bold text-base text-red-400 flex items-center gap-2">
                    <X className="h-5 w-5" />
                    Decline Delivery Request
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Provide a reason so the processor can reassign this batch ({declineModalRequest.batch_number}) to
                    another carrier.
                  </p>
                </div>
                <button onClick={() => setDeclineModalRequest(null)} className="text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Select or Enter Reason
                </label>
                <div className="space-y-1.5">
                  {[
                    "Vehicle capacity currently booked on another route",
                    "Reefer temperature unit under scheduled maintenance",
                    "Destination store outside active delivery radius",
                    "Insufficient driver hours for today's shift"
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDeclineReasonInput(r)}
                      className={`w-full text-left text-xs p-2.5 rounded-xl border transition-all ${
                        declineReasonInput === r
                          ? "bg-red-500/20 border-red-500/50 text-white font-semibold"
                          : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={declineReasonInput}
                  onChange={(e) => setDeclineReasonInput(e.target.value)}
                  placeholder="Or enter custom reason..."
                  className="w-full p-3 rounded-xl border border-zinc-700 bg-zinc-950 text-white text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeclineModalRequest(null)}
                  className="flex-1 rounded-xl border-zinc-700 text-zinc-300 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    handleRespondToRequest(declineModalRequest.id, "DECLINE", declineReasonInput)
                  }
                  className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
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

  return (
    <div className="space-y-8">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Distributor Operations</h1>
          <p className="text-muted-foreground mt-1">Manage cold-chain logistics, fleet routing, and Sepolia blockchain custody handoffs.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center bg-card px-3 py-1.5 rounded-full border shadow-sm">
            <div className={`h-2.5 w-2.5 rounded-full mr-2 ${
              user?.availability_status === 'Unavailable' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
              user?.availability_status === 'On Route' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
              'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
            }`} />
            <span className="text-xs font-semibold text-muted-foreground mr-1">Status:</span>
            <select
              className="text-xs bg-transparent border-0 focus:ring-0 py-0 pl-1 pr-6 outline-none font-semibold text-foreground cursor-pointer"
              defaultValue={user?.availability_status || "Available for Trip"}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={statusLoading}
            >
              <option value="Available for Trip">Available for Trip</option>
              <option value="On Route">On Route</option>
              <option value="Unavailable">Unavailable</option>
            </select>
          </div>
          {statusSuccess && <span className="text-[11px] text-emerald-500 font-medium">Status saved ✓</span>}
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex overflow-x-auto pb-2 -mb-2 scrollbar-none gap-2">
        <Button
          variant={activeTab === "overview" ? "default" : "outline"}
          onClick={() => setActiveTab("overview")}
          className="rounded-full px-6 text-xs"
        >
          Overview
        </Button>
        <Button
          variant={activeTab === "requests" ? "default" : "outline"}
          onClick={() => setActiveTab("requests")}
          className="rounded-full px-6 text-xs relative"
        >
          <Clock className="mr-2 h-4 w-4" />
          Delivery Requests
          {deliveryRequests.filter((r) => r.status === "REQUESTED").length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black animate-pulse">
              {deliveryRequests.filter((r) => r.status === "REQUESTED").length}
            </span>
          )}
        </Button>
        <Button
          variant={activeTab === "fleet" ? "default" : "outline"}
          onClick={() => setActiveTab("fleet")}
          className="rounded-full px-6 text-xs"
        >
          <Truck className="mr-2 h-4 w-4" />
          Fleet & Tracking
        </Button>
        <Button
          variant={activeTab === "inventory" ? "default" : "outline"}
          onClick={() => setActiveTab("inventory")}
          className="rounded-full px-6 text-xs"
        >
          <Package className="mr-2 h-4 w-4" />
          Inventory
        </Button>
        <Button
          variant={activeTab === "blockchain" ? "default" : "outline"}
          onClick={() => setActiveTab("blockchain")}
          className="rounded-full px-6 text-xs"
        >
          <QrCode className="mr-2 h-4 w-4" />
          Receive (Handoff)
        </Button>
      </div>

      {/* TAB CONTENT */}
      <div className="mt-6">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "requests" && <RequestsTab />}
        {activeTab === "fleet" && <FleetTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "blockchain" && <BlockchainTab />}
      </div>

      {/* LIVE CAMERA QR SCANNER POPUP MODAL */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-sm w-full rounded-3xl border shadow-2xl p-6 bg-zinc-900 border-zinc-800 text-white space-y-4 text-center">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-primary">
                <Camera className="h-5 w-5" />
                Scan Batch QR Code
              </h3>
              <button onClick={() => { stopLiveCamera(); setShowScanner(false); }} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="relative w-full aspect-square rounded-2xl border-2 border-dashed border-zinc-700 bg-black overflow-hidden flex items-center justify-center">
              <div id="distributor-qr-reader" className="w-full h-full" />
              {cameraActive && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse top-1/2 z-20" />
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

      {/* RETAILER STORE DELIVERY COMPLETION MODAL */}
      {deliveryModalItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full rounded-3xl border shadow-2xl p-6 bg-card space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Complete Retail Delivery</h3>
                  <p className="text-xs text-muted-foreground font-mono">Batch: {deliveryModalItem.batch_number}</p>
                </div>
              </div>
              <button onClick={() => setDeliveryModalItem(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="p-4 bg-muted/40 rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Product:</span>
                <span className="font-semibold text-foreground">{deliveryModalItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantity to Hand Off:</span>
                <span className="font-semibold text-foreground">{deliveryModalItem.quantity} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">On-Chain Product ID:</span>
                <span className="font-mono text-emerald-500 font-bold">#{deliveryModalItem.product_id || "N/A"}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Destination Retailer Store</label>
                <select
                  value={destinationStore}
                  onChange={(e) => setDestinationStore(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-foreground"
                >
                  <option value="Metro Fresh Mart (Koramangala Store #104)">Metro Fresh Mart (Koramangala Store #104)</option>
                  <option value="Nature's Basket (Indiranagar Store #12)">Nature's Basket (Indiranagar Store #12)</option>
                  <option value="Reliance Fresh (Whitefield Hub)">Reliance Fresh (Whitefield Hub)</option>
                  <option value="FreshToHome Local Outlet #3">FreshToHome Local Outlet #3</option>
                  <option value="Authorized Retail Supermarket">Authorized Retail Supermarket</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Delivery Receipt Notes</label>
                <textarea
                  rows={2}
                  value={deliveryRemarks}
                  onChange={(e) => setDeliveryRemarks(e.target.value)}
                  placeholder="e.g. Temperature checked at 3.8°C; intake acknowledged"
                  className="flex w-full rounded-xl border border-input bg-background p-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-foreground"
                />
              </div>
            </div>

            {deliverySuccessTx && (
              <div className="p-3.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs space-y-1 animate-in fade-in">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Store Delivery Recorded on Sepolia!
                </p>
                <p className="text-[11px] text-muted-foreground">Status transitioned to "At Retailer" on-chain.</p>
              </div>
            )}

            {deliveryError && (
              <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs">
                {deliveryError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setDeliveryModalItem(null)}
                className="flex-1 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCompleteDelivery}
                disabled={deliveryLoading || Boolean(deliverySuccessTx)}
                className="flex-1 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {deliveryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm & Sign on Blockchain
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ROUTE & NAVIGATION MAP MODAL */}
      <RouteMapModal
        isOpen={Boolean(selectedMapRequest)}
        onClose={() => setSelectedMapRequest(null)}
        request={selectedMapRequest}
      />
    </div>
  )
}
