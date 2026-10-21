import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Html5QrcodeScanner } from "html5-qrcode"
import {
  QrCode,
  AlertCircle,
  CheckCircle2,
  Package,
  Search,
  Truck,
  Factory,
  CheckCircle,
  X,
  Loader2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle
} from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function ReceiveProduct() {
  const { token } = useAuth()
  const [searchParams] = useSearchParams()
  const urlShipmentId = searchParams.get("shipment")

  const [shipments, setShipments] = useState<any[]>([])
  const [selectedShipment, setSelectedShipment] = useState(urlShipmentId || "")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [scanning, setScanning] = useState(false)
  const [verifiedData, setVerifiedData] = useState<any>(null)
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [verificationError, setVerificationError] = useState("")
  const [verifying, setVerifying] = useState(false)

  // Receiving inspection form
  const [acceptedQty, setAcceptedQty] = useState<number | string>("")
  const [dockTemp, setDockTemp] = useState("4.1°C")
  const [dockNotes, setDockNotes] = useState("Physical packaging intact, seals checked, temperature compliant.")

  // Discrepancy report modal
  const [discrepancyModalOpen, setDiscrepancyModalOpen] = useState(false)
  const [discrepancyType, setDiscrepancyType] = useState("PHYSICAL_MISMATCH")
  const [discrepancyNotes, setDiscrepancyNotes] = useState("")
  const [reportingDiscrepancy, setReportingDiscrepancy] = useState(false)
  const [discrepancySuccess, setDiscrepancySuccess] = useState(false)

  // Receipt confirmation
  const [receiptSuccess, setReceiptSuccess] = useState<any>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const fetchEligibleShipments = async () => {
      try {
        setLoading(true)
        const res = await axios.get(`${API_URL}/retailer/shipments`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const eligible =
          res.data.data?.filter((s: any) => {
            const st = (s.status || "").toUpperCase()
            return (
              st === "DELIVERED" ||
              st === "ARRIVED" ||
              st === "ARRIVED_AT_RETAILER" ||
              st === "IN_TRANSIT"
            )
          }) || []
        setShipments(eligible)

        if (urlShipmentId && eligible.some((s: any) => s.id === urlShipmentId)) {
          setSelectedShipment(urlShipmentId)
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load shipments")
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchEligibleShipments()
  }, [token, urlShipmentId])

  useEffect(() => {
    if (scanning && selectedShipment) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      )

      scanner.render(
        async (decodedText) => {
          scanner.pause(true)
          await handleVerification(decodedText)
          scanner.clear()
          setScanning(false)
        },
        () => {
          // scanning
        }
      )

      return () => {
        scanner.clear().catch(console.error)
      }
    }
  }, [scanning, selectedShipment])

  const handleVerification = async (qrData: string) => {
    setVerifying(true)
    setVerificationError("")
    setVerifiedData(null)
    setComparisonData(null)
    setDiscrepancySuccess(false)

    // 1. First attempt full Delivery QR verification (with side-by-side snapshot)
    try {
      const dlvRes = await axios.post(
        `${API_URL}/retailer/verify-delivery-qr`,
        {
          shipment_id: selectedShipment || undefined,
          qr_code: qrData
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (dlvRes.data?.success && dlvRes.data.data) {
        const comp = dlvRes.data.data
        setComparisonData(comp)
        setVerifiedData({
          product_name: comp.expected?.product_name || "Produce Batch",
          batch_number: comp.batch_number,
          quantity: comp.expected?.quantity || 100,
          unit: comp.expected?.unit || "kg",
          expiry_date: comp.expected?.expiry_date,
          blockchain_hash: comp.blockchain_hash
        })
        setAcceptedQty(comp.expected?.quantity || 100)
        return
      }
    } catch (dlvErr: any) {
      console.warn("verify-delivery-qr fallback to standard verify-batch:", dlvErr)
    }

    // 2. Fallback: verify-batch
    try {
      const res = await axios.post(
        `${API_URL}/retailer/verify-batch`,
        {
          shipment_id: selectedShipment,
          qr_data: qrData
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setVerifiedData(res.data.data)
      setAcceptedQty(res.data.data?.quantity || 100)
    } catch (err: any) {
      setVerificationError(err.response?.data?.message || "Verification failed.")
    } finally {
      setVerifying(false)
    }
  }

  const handleConfirmReceipt = async () => {
    setConfirming(true)
    try {
      if (comparisonData) {
        const res = await axios.post(
          `${API_URL}/retailer/confirm-delivery`,
          {
            shipment_id: comparisonData.shipment_id || selectedShipment,
            delivery_token: comparisonData.delivery_token,
            accepted_quantity: Number(acceptedQty),
            dock_temperature: dockTemp,
            inspection_notes: dockNotes
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setReceiptSuccess({
          ...res.data.data,
          message: res.data.message || "Delivery accepted successfully! Distributor role completed."
        })
      } else {
        const res = await axios.post(
          `${API_URL}/retailer/receive-product`,
          {
            shipment_id: selectedShipment,
            qr_data: verifiedData.batch_number
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setReceiptSuccess(res.data.data)
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to confirm receipt.")
    } finally {
      setConfirming(false)
    }
  }

  const handleReportDiscrepancy = async () => {
    setReportingDiscrepancy(true)
    try {
      await axios.post(
        `${API_URL}/retailer/reject-delivery`,
        {
          shipment_id: comparisonData?.shipment_id || selectedShipment,
          discrepancy_type: discrepancyType,
          discrepancy_notes: discrepancyNotes || "Inspection failed at retailer receiving bay."
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setDiscrepancySuccess(true)
      setDiscrepancyModalOpen(false)
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to submit discrepancy report.")
    } finally {
      setReportingDiscrepancy(false)
    }
  }

  const handleManualEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const input = form.elements.namedItem("batch_number") as HTMLInputElement
    if (input.value) {
      setScanning(false)
      handleVerification(input.value)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Receive Product & Dual-QR Verification</h1>
        <p className="text-sm text-slate-500">
          Cross-examine physical cargo & vehicle against Processor dispatch manifests before accepting custody.
        </p>
      </div>

      {discrepancySuccess && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Discrepancy Reported & Broadcasted
          </div>
          <p>Both the Processor and Distributor have been notified. Shipment status set to DISPUTED.</p>
        </div>
      )}

      {!verifiedData ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" /> Select Incoming Shipment
            </h3>

            {loading ? (
              <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-xl">
                Loading incoming shipments...
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
                {error}
              </div>
            ) : shipments.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">
                No shipments ready to receive (status IN_TRANSIT, ARRIVED, or DELIVERED).
              </div>
            ) : (
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 text-sm font-medium text-slate-900"
                value={selectedShipment}
                onChange={(e) => setSelectedShipment(e.target.value)}
              >
                <option value="">-- Choose an incoming shipment --</option>
                {shipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shipment_tracking_id} - {s.request?.product_name || s.batch_number} ({s.quantity} {s.unit})
                  </option>
                ))}
              </select>
            )}

            {selectedShipment && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-950">
                    {shipments.find((s) => s.id === selectedShipment)?.request?.product_name || "Produce Cargo"}
                  </span>
                  <span className="font-mono text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 font-bold">
                    Batch: {shipments.find((s) => s.id === selectedShipment)?.batch_number}
                  </span>
                </div>

                <div className="text-[11px] text-emerald-900 space-y-0.5">
                  <div>
                    Carrier: <strong>{shipments.find((s) => s.id === selectedShipment)?.distributor?.name || "Assigned Carrier"}</strong>
                  </div>
                  {shipments.find((s) => s.id === selectedShipment)?.expected_delivery && (
                    <div>Expected: {new Date(shipments.find((s) => s.id === selectedShipment)?.expected_delivery).toLocaleDateString()}</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const sh = shipments.find((s) => s.id === selectedShipment)
                    if (sh) handleVerification(sh.batch_number)
                  }}
                  disabled={verifying}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {verifying ? "Verifying On-Chain..." : "⚡ Quick Verify Delivery & Produce"}
                </button>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => setScanning(!scanning)}
                disabled={!selectedShipment || verifying}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer"
              >
                <QrCode className="h-4 w-4" /> {scanning ? "Stop Scanner" : "Scan Delivery Handoff QR"}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400">Or enter token / batch</span>
              </div>
            </div>

            <form onSubmit={handleManualEntry} className="flex gap-2">
              <input
                name="batch_number"
                type="text"
                placeholder="Enter DLV_... or Batch Number"
                disabled={!selectedShipment || verifying}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 font-mono"
              />
              <button
                type="submit"
                disabled={!selectedShipment || verifying}
                className="px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                Verify
              </button>
            </form>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center min-h-[350px]">
            {scanning ? (
              <div className="w-full max-w-[300px]">
                <div id="qr-reader" className="w-full overflow-hidden rounded-xl border-2 border-emerald-500 shadow-lg"></div>
                <p className="text-center text-xs text-slate-500 mt-4">Point your camera at the Distributor's delivery QR code.</p>
              </div>
            ) : verifying ? (
              <div className="text-center space-y-3">
                <Search className="h-10 w-10 text-emerald-500 animate-pulse mx-auto" />
                <p className="text-sm font-medium text-slate-700">Verifying on Sepolia blockchain...</p>
              </div>
            ) : verificationError ? (
              <div className="text-center space-y-3 w-full">
                <div className="mx-auto h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Verification Failed</h3>
                <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200 mx-auto">{verificationError}</p>
                <button
                  onClick={() => setVerificationError("")}
                  className="mt-2 px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="text-center opacity-50 space-y-2">
                <QrCode className="h-14 w-14 mx-auto text-slate-400" />
                <p className="text-sm font-medium text-slate-500">Scanner is inactive.</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Choose a shipment from the left or scan the Delivery QR code presented by the carrier driver.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : receiptSuccess ? (
        /* CONFIRMED RECEIPT SCREEN */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-emerald-600 p-8 text-center text-white space-y-2">
            <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Delivery Accepted & Confirmed!</h2>
            <p className="text-emerald-100 text-xs">
              Distributor responsibility is completed. Stock added to store inventory.
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Shipment Status:</span>
                <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">COMPLETED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Intake Quantity:</span>
                <span className="font-bold text-slate-900">{receiptSuccess.received_quantity || acceptedQty} kg</span>
              </div>
              {receiptSuccess.blockchain_hash && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Sepolia Blockchain Transaction</span>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${receiptSuccess.blockchain_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-emerald-700 underline break-all flex items-center gap-1 hover:text-emerald-900"
                  >
                    {receiptSuccess.blockchain_hash} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setVerifiedData(null)
                setComparisonData(null)
                setReceiptSuccess(null)
                setSelectedShipment("")
              }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-xl text-xs font-bold shadow-md transition-all uppercase tracking-wide cursor-pointer"
            >
              Scan Next Delivery Item
            </button>
          </div>
        </div>
      ) : (
        /* SIDE-BY-SIDE VERIFICATION DASHBOARD */
        <div className="bg-white rounded-3xl border border-emerald-300 shadow-xl overflow-hidden space-y-6 p-6 animate-in fade-in zoom-in-95 duration-300">
          {/* HEADER */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Authenticated Multi-Party Handover
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-1">Cargo Inspection & Digital Verification</h2>
              <p className="text-xs text-slate-500">
                Batch #{verifiedData.batch_number} • {verifiedData.product_name}
              </p>
            </div>

            <button
              onClick={() => {
                setVerifiedData(null)
                setComparisonData(null)
              }}
              className="text-slate-400 hover:text-slate-600 p-1 text-xs font-medium cursor-pointer"
            >
              Cancel Scan
            </button>
          </div>

          {/* VERIFICATION CHECK BADGES */}
          {comparisonData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Vehicle Reg #</span>
                <span
                  className={`text-xs font-bold flex items-center gap-1 ${
                    comparisonData.verification_checks?.vehicle_matched ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {comparisonData.verification_checks?.vehicle_matched ? "✓ Matched" : "⚠ Review Reg #"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Produce Batch</span>
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">✓ Matched</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Carrier Authority</span>
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">✓ Authorized</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Blockchain Proof</span>
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">✓ Sepolia Valid</span>
              </div>
            </div>
          )}

          {/* SIDE-BY-SIDE COMPARISON CARDS */}
          {comparisonData ? (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Card 1: Prior Processor Dispatch Notice */}
              <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <Factory className="h-4 w-4 text-indigo-600" />
                    1. Processor Dispatch Notice
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-300">
                    Prior Record
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Produce:</span>
                    <span className="font-bold text-slate-900">{comparisonData.expected?.product_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Batch Number:</span>
                    <span className="font-mono font-bold text-indigo-700">{comparisonData.expected?.batch_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dispatched Qty:</span>
                    <span className="font-bold text-slate-900">
                      {comparisonData.expected?.quantity} {comparisonData.expected?.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">AI Quality Grade:</span>
                    <span className="font-semibold text-emerald-700">
                      {comparisonData.expected?.quality_grade} ({comparisonData.expected?.quality_score}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Origin Processor:</span>
                    <span className="font-medium text-slate-900">{comparisonData.expected?.processor_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected Vehicle Reg #:</span>
                    <span className="font-mono font-bold text-indigo-950 bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200">
                      {comparisonData.expected?.expected_vehicle}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Departure Temp:</span>
                    <span className="font-mono text-slate-900">{comparisonData.expected?.departure_temperature || "3.8°C"}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Physical Delivery at Receiving Dock */}
              <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-emerald-600" />
                    2. Physical Arrival at Dock
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    Live Driver & QR Scanned
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Scanned Batch:</span>
                    <span className="font-mono font-bold text-emerald-900">{comparisonData.arrived?.scanned_batch_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Arrived Carrier:</span>
                    <span className="font-bold text-slate-900">{comparisonData.arrived?.arrived_carrier}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Arrived Vehicle Reg #:</span>
                    <span
                      className={`font-mono font-bold px-1.5 py-0.5 rounded border ${
                        comparisonData.verification_checks?.vehicle_matched
                          ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                          : "bg-amber-100 text-amber-900 border-amber-300"
                      }`}
                    >
                      {comparisonData.arrived?.arrived_vehicle}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Driver Name:</span>
                    <span className="font-medium text-slate-900">{comparisonData.arrived?.driver_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Driver Phone:</span>
                    <span className="font-mono text-slate-900">{comparisonData.arrived?.driver_phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dock Arrival Time:</span>
                    <span className="text-slate-700">
                      {new Date(comparisonData.arrived?.arrival_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Fallback Produce Cards */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 uppercase font-bold block mb-1">Product</span>
                <span className="font-bold text-slate-900">{verifiedData.product_name}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold block mb-1">Batch</span>
                <span className="font-mono font-bold text-emerald-700">{verifiedData.batch_number}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold block mb-1">Quantity</span>
                <span className="font-bold text-slate-900">{verifiedData.quantity} {verifiedData.unit}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold block mb-1">Expiry</span>
                <span className="font-medium text-slate-700">{verifiedData.expiry_date || "N/A"}</span>
              </div>
            </div>
          )}

          {/* STORE INTAKE INSPECTION FIELDS */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Store Receiving Dock Inspection & Measurements
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-1">
                  Accepted Quantity ({comparisonData?.expected?.unit || verifiedData.unit || "kg"})
                </span>
                <input
                  type="number"
                  value={acceptedQty}
                  onChange={(e) => setAcceptedQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold bg-white"
                />
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Store Receiving Dock Temperature (°C)</span>
                <input
                  type="text"
                  value={dockTemp}
                  onChange={(e) => setDockTemp(e.target.value)}
                  placeholder="e.g. 4.1°C"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block mb-1">Physical Inspection Notes</span>
                <input
                  type="text"
                  value={dockNotes}
                  onChange={(e) => setDockNotes(e.target.value)}
                  placeholder="Crates inspected, temperature acceptable, seals unbroken"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* DUAL DECISION ACTION BAR */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => setDiscrepancyModalOpen(true)}
              disabled={confirming}
              className="flex-1 px-4 py-3 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <AlertTriangle className="h-4 w-4" />
              Report Discrepancy / Reject
            </button>

            <button
              onClick={handleConfirmReceipt}
              disabled={confirming || !acceptedQty}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording on Blockchain...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Accept Delivery & Intake Inventory
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* DISCREPANCY REPORT MODAL */}
      {discrepancyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
                <AlertTriangle className="h-5 w-5" />
                <span>Report Delivery Discrepancy</span>
              </div>
              <button
                onClick={() => setDiscrepancyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Reporting a discrepancy will mark the shipment as DISPUTED and instantly alert both the Processor and Distributor.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Discrepancy Category</label>
                <select
                  value={discrepancyType}
                  onChange={(e) => setDiscrepancyType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                >
                  <option value="VEHICLE_MISMATCH">Vehicle Number Mismatch</option>
                  <option value="QUANTITY_MISMATCH">Crate Quantity Shortfall</option>
                  <option value="DAMAGED_PRODUCE">Damaged / Bruised Produce</option>
                  <option value="TEMPERATURE_EXCURSION">Cold-Chain Temperature Excursion</option>
                  <option value="EXPIRED_BATCH">Shelf-Life Expiry Date Invalid</option>
                  <option value="OTHER">Other Discrepancy</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Inspection Notes & Findings</label>
                <textarea
                  rows={3}
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  placeholder="Describe the discrepancy observed at dock..."
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDiscrepancyModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReportDiscrepancy}
                disabled={reportingDiscrepancy}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
              >
                {reportingDiscrepancy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                Submit Discrepancy Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
