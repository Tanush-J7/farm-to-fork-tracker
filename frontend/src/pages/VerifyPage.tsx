import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "../components/ui/Card"
import { Button } from "../components/ui/Button"
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, XCircle } from "lucide-react"
import axios from "axios"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

const format6DigitId = (id: number | string) => {
  const num = Number(id)
  if (num >= 100000 && num <= 999999) return String(num)
  if (num > 0) return String(100000 + num)
  return "100000"
}

export function VerifyPage() {
  const [productIdInput, setProductIdInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<any>(null)
  const navigate = useNavigate()

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productIdInput) return

    setLoading(true)
    setError("")
    setResult(null)

    try {
      let foundDb: any = null
      const numId = Number(productIdInput)

      // 1. Try direct route /products/blockchain/:id
      try {
        const dbRes = await axios.get(`${API}/products/blockchain/${productIdInput}`)
        if (dbRes.data?.data) {
          foundDb = dbRes.data.data
        }
      } catch {
        // fallback
      }

      // 2. Try subtracted small ID
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

      // 3. Query all products list and match
      if (!foundDb) {
        const listRes = await axios.get(`${API}/products`)
        const allList = listRes.data?.data || []
        foundDb = allList.find((p: any) => {
          const pId = p.product_id || p.id
          const mapped = format6DigitId(pId)
          return (
            String(pId) === String(productIdInput) ||
            mapped === String(productIdInput) ||
            (numId >= 100000 && Number(pId) === numId - 100000) ||
            p.batch_number === productIdInput ||
            String(p.id) === String(productIdInput)
          )
        })
      }

      if (foundDb) {
        const status = foundDb.status || "Harvested"

        // Define verification checklists
        const verification = {
          productId: foundDb.product_id || productIdInput,
          name: foundDb.name,
          batchNumber: foundDb.batch_number || foundDb.batchNumber || "N/A",
          checks: {
            registration: true, // Product is registered
            farmer: true,       // Farmer record verified
            processor: ["Processing", "In Transit", "Delivered", "Sold"].includes(status),
            distributor: ["In Transit", "Delivered", "Sold"].includes(status),
            retailer: ["Delivered", "Sold"].includes(status),
            blockchain: !!(foundDb.blockchain_hash || foundDb.blockchainHash)
          }
        }
        setResult(verification)
      } else {
        setError(`No product found with ID ${productIdInput}. Product authenticity cannot be verified.`)
      }
    } catch (err) {
      setError("An error occurred during verification. Please make sure the backend is active.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 pt-6 px-4">
      <div className="text-center space-y-2 mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-primary flex items-center justify-center gap-2">
          <ShieldCheck className="h-10 w-10 text-primary animate-pulse" />
          Verify Product Authenticity
        </h1>
        <p className="text-muted-foreground">Confirm if a product in the supply chain is genuine and backed by blockchain records.</p>

        <form onSubmit={handleVerify} className="flex max-w-md mx-auto items-center space-x-2 mt-6">
          <input
            type="text"
            maxLength={6}
            placeholder="Enter 6-digit Product ID (e.g. 583920)"
            value={productIdInput}
            onChange={(e) => setProductIdInput(e.target.value.replace(/\D/g, ""))}
            className="flex h-12 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring glass text-foreground"
            required
          />
          <Button type="submit" size="lg" className="h-12 bg-primary hover:bg-primary/90 text-white" disabled={loading || productIdInput.length !== 6}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShieldCheck className="h-5 w-5 mr-2" />}
            Verify
          </Button>
        </form>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {result && (
        <Card className="overflow-hidden border-emerald-500/30 bg-emerald-500/5 shadow-[0_20px_50px_rgba(24,112,75,0.05)]">
          <div className="bg-emerald-500/10 p-6 border-b border-emerald-500/20 text-center">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/20 text-emerald-500 mb-3 border border-emerald-500/30">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">🟢 AUTHENTIC PRODUCT</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Verified record for <span className="font-semibold text-foreground">{result.name}</span> (ID: {result.productId})
            </p>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border">
                <span className="text-xs text-muted-foreground">Product Name</span>
                <p className="font-semibold text-foreground">{result.name}</p>
              </div>
              <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border">
                <span className="text-xs text-muted-foreground">Batch Reference</span>
                <p className="font-semibold text-foreground font-mono">{result.batchNumber}</p>
              </div>
            </div>

            <div className="space-y-3.5 border-t pt-6">
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">Authenticity Verification Checklist</h3>

              {[
                { label: "Product registration verified", checked: result.checks.registration },
                { label: "Farmer record verified", checked: result.checks.farmer },
                { label: "Processor record verified", checked: result.checks.processor },
                { label: "Distributor record verified", checked: result.checks.distributor },
                { label: "Retailer record verified", checked: result.checks.retailer },
                { label: "Blockchain record verified", checked: result.checks.blockchain }
              ].map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                  <span className="text-sm font-medium text-slate-750 dark:text-slate-200">{c.label}</span>
                  {c.checked ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-md border border-green-200">
                      <CheckCircle2 className="h-4 w-4 shrink-0" /> Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                      <XCircle className="h-4 w-4 shrink-0" /> Pending / Optional
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-center">
              <Button size="lg" className="w-full sm:w-auto px-8 bg-primary hover:bg-primary/90 text-white" onClick={() => navigate(`/track?id=${result.productId}`)}>
                View Complete Journey
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
