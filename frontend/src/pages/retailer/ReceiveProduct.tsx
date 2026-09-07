import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Html5QrcodeScanner } from "html5-qrcode"
import { QrCode, AlertCircle, CheckCircle2, Package, Search } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function ReceiveProduct() {
  const { token } = useAuth()
  const [shipments, setShipments] = useState<any[]>([])
  const [selectedShipment, setSelectedShipment] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  
  const [scanning, setScanning] = useState(false)
  const [verifiedData, setVerifiedData] = useState<any>(null)
  const [verificationError, setVerificationError] = useState("")
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const fetchEligibleShipments = async () => {
      try {
        setLoading(true)
        const res = await axios.get(`${API_URL}/retailer/shipments`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        // Only show shipments that can be received
        const eligible = res.data.data?.filter((s: any) => s.status === 'DELIVERED' || s.status === 'ARRIVED') || []
        setShipments(eligible)
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load shipments")
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchEligibleShipments()
  }, [token])

  useEffect(() => {
    if (scanning && selectedShipment) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      )

      scanner.render(
        async (decodedText) => {
          // Pause scanner on successful scan to prevent multiple hits
          scanner.pause(true)
          await handleVerification(decodedText)
          scanner.clear()
          setScanning(false)
        },
        (err) => {
          // Ignore frequent scan errors (expected when no QR is in view)
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
    try {
      const res = await axios.post(`${API_URL}/retailer/verify-batch`, {
        shipment_id: selectedShipment,
        qr_data: qrData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setVerifiedData(res.data.data)
    } catch (err: any) {
      setVerificationError(err.response?.data?.message || "Verification failed.")
    } finally {
      setVerifying(false)
    }
  }

  const [receiptSuccess, setReceiptSuccess] = useState<any>(null)
  const [confirming, setConfirming] = useState(false)

  const handleConfirmReceipt = async () => {
    setConfirming(true)
    try {
      const res = await axios.post(`${API_URL}/retailer/receive-product`, {
        shipment_id: selectedShipment,
        qr_data: verifiedData.batch_number // Passed back to confirm
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setReceiptSuccess(res.data.data) // Contains blockchain_hash
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to confirm receipt.")
    } finally {
      setConfirming(false)
    }
  }

  const handleManualEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const input = form.elements.namedItem('batch_number') as HTMLInputElement
    if (input.value) {
      setScanning(false)
      handleVerification(input.value)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Receive Product</h1>
        <p className="text-sm text-slate-500">Scan batch QR codes to verify incoming shipments.</p>
      </div>

      {!verifiedData ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" /> Select Shipment
            </h3>
            
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-xl">Loading shipments...</div>
            ) : error ? (
              <div className="p-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">{error}</div>
            ) : shipments.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">
                No shipments ready to receive (status ARRIVED or DELIVERED).
              </div>
            ) : (
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 text-sm font-medium text-slate-900"
                value={selectedShipment}
                onChange={(e) => setSelectedShipment(e.target.value)}
              >
                <option value="">-- Choose a shipment --</option>
                {shipments.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.shipment_tracking_id} - {s.request?.product_name} ({s.quantity} {s.unit})
                  </option>
                ))}
              </select>
            )}

            <div className="pt-4 border-t border-slate-100">
              <button 
                onClick={() => setScanning(!scanning)}
                disabled={!selectedShipment || verifying}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors"
              >
                <QrCode className="h-4 w-4" /> {scanning ? "Stop Scanner" : "Start QR Scanner"}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Or enter manually</span></div>
            </div>

            <form onSubmit={handleManualEntry} className="flex gap-2">
              <input 
                name="batch_number"
                type="text" 
                placeholder="Enter Batch Number" 
                disabled={!selectedShipment || verifying}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
              />
              <button 
                type="submit"
                disabled={!selectedShipment || verifying}
                className="px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                Verify
              </button>
            </form>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center min-h-[350px]">
            {scanning ? (
              <div className="w-full max-w-[300px]">
                <div id="qr-reader" className="w-full overflow-hidden rounded-xl border-2 border-emerald-500 shadow-lg"></div>
                <p className="text-center text-xs text-slate-500 mt-4">Point your camera at the batch QR code.</p>
              </div>
            ) : verifying ? (
              <div className="text-center space-y-3">
                <Search className="h-10 w-10 text-emerald-500 animate-pulse mx-auto" />
                <p className="text-sm font-medium text-slate-700">Verifying on backend...</p>
              </div>
            ) : verificationError ? (
              <div className="text-center space-y-3 w-full">
                <div className="mx-auto h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Verification Failed</h3>
                <p className="text-sm text-rose-600 bg-rose-50 p-4 rounded-xl border border-rose-200 mx-auto">{verificationError}</p>
                <button 
                  onClick={() => setVerificationError("")}
                  className="mt-4 px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-semibold rounded-xl transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="text-center opacity-50">
                <QrCode className="h-16 w-16 mx-auto mb-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-500">Scanner is inactive.</p>
              </div>
            )}
          </div>
        </div>
      ) : receiptSuccess ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-slate-900 p-8 text-center text-white">
            <div className="h-20 w-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Receipt Confirmed</h2>
            <p className="text-slate-400 mt-2 text-sm">Product has been securely added to your inventory.</p>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Blockchain Transaction Hash</h4>
              <p className="font-mono text-xs text-slate-700 break-all bg-white p-3 border border-slate-200 rounded-lg shadow-inner">
                {receiptSuccess.blockchain_hash || "Simulated (No RPC Provided)"}
              </p>
            </div>
            
            <button 
              onClick={() => {
                setVerifiedData(null)
                setReceiptSuccess(null)
                setSelectedShipment("")
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
            >
              Scan Next Item
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-emerald-500 shadow-lg max-w-lg mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-emerald-500 p-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-white mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-white tracking-tight">PRODUCT VERIFIED</h2>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product</p>
                <p className="text-lg font-bold text-slate-900">{verifiedData.product_name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Batch</p>
                <p className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">{verifiedData.batch_number}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quantity</p>
                <p className="text-lg font-bold text-emerald-600">{verifiedData.quantity} {verifiedData.unit}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expiry</p>
                <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {verifiedData.expiry_date ? new Date(verifiedData.expiry_date).toLocaleDateString() : "N/A"}
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <button 
                onClick={handleConfirmReceipt}
                disabled={confirming}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                {confirming ? "Writing to Blockchain..." : "Confirm Receipt"}
              </button>
              <button 
                onClick={() => setVerifiedData(null)}
                disabled={confirming}
                className="w-full mt-3 bg-transparent text-slate-500 hover:text-slate-700 disabled:opacity-50 px-6 py-3 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
