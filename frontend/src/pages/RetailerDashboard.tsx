import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"
import { ShoppingBag, AlertTriangle, TrendingDown, TrendingUp, ShieldCheck, QrCode, Tag, Truck, RefreshCw, Star, BarChart3, Package, Store } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { Button } from "../components/ui/Button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

const demandForecast = [
  { day: "Mon", actual: 42, forecast: 45 },
  { day: "Tue", actual: 38, forecast: 40 },
  { day: "Wed", actual: 55, forecast: 52 },
  { day: "Thu", actual: 61, forecast: 58 },
  { day: "Fri", actual: 72, forecast: 70 },
  { day: "Sat", actual: 88, forecast: 85 },
  { day: "Sun", actual: 65, forecast: 68 },
]

export function RetailerDashboard() {
  const { user, token } = useAuth()
  const [activeTab, setActiveTab] = useState("overview")
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Handoff state
  const [handoffId, setHandoffId] = useState("")
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [handoffSuccess, setHandoffSuccess] = useState("")
  const [handoffError, setHandoffError] = useState("")

  // Quality Feedback state
  const [qualityFeedback, setQualityFeedback] = useState("Excellent")

  const fetchInventory = async () => {
    try {
      const res = await axios.get(`${API_URL}/products/my`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setInventory(res.data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchInventory()
  }, [token])

  const handleTakeCustody = async () => {
    if (!handoffId) return;
    setHandoffLoading(true)
    setHandoffError("")
    setHandoffSuccess("")
    
    try {
      const res = await axios.get(`${API_URL}/products/blockchain/${handoffId}`)
      const product = res.data.data
      
      await axios.put(`${API_URL}/products/${product.id}/status`, {
        status: 'In Retail',
        current_owner_id: user?.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      setHandoffSuccess(`Successfully received ${product.name} (Batch: ${product.batch_number}). Quality feedback submitted to blockchain.`)
      setHandoffId("")
      fetchInventory()
    } catch (err: any) {
      setHandoffError(err.response?.data?.message || "Failed to verify ID or take custody.")
    } finally {
      setHandoffLoading(false)
    }
  }

  const handleRestock = (productName: string) => {
    alert(`Restock request for ${productName} sent directly to the local processor/farmer!`)
  }

  const getShelfLifeAnalysis = (expiryDate: string) => {
    if (!expiryDate) return { daysLeft: 99, risk: 'low', recommendation: 'Standard Shelf', discount: '0%' }
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24))
    if (days <= 0) return { daysLeft: days, risk: 'expired', recommendation: 'Discard / Compost', discount: '100%' }
    if (days <= 2) return { daysLeft: days, risk: 'high', recommendation: 'Flash Sale Kiosk', discount: '50% OFF' }
    if (days <= 5) return { daysLeft: days, risk: 'medium', recommendation: 'Front Promo Display', discount: '15% OFF' }
    return { daysLeft: days, risk: 'low', recommendation: 'Standard Aisle', discount: '0%' }
  }

  // Sort inventory by FEFO (First Expiring First Out)
  const sortedInventory = [...inventory].sort((a, b) => {
    if (!a.expiry_date) return 1
    if (!b.expiry_date) return -1
    return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
  })

  const stats = [
    { title: "Total Stock", value: inventory.length + " Batches", icon: ShoppingBag, color: "text-blue-500" },
    { title: "Consumer Scans", value: "1,248", icon: QrCode, color: "text-emerald-500" },
    { title: "Waste Avoided", value: "312 kg", icon: TrendingDown, color: "text-green-500" },
    { title: "Food Miles Saved", value: "12,400 km", icon: Truck, color: "text-amber-500" },
  ]

  const OverviewTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.title} className="col-span-1 border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{s.title}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Consumer QR Scans</CardTitle>
            <CardDescription>Shoppers actively checking farm-to-fork origin.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={demandForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="actual" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} name="QR Scans" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Sustainability Impact</CardTitle>
            <CardDescription>Why your local sourcing matters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <TrendingDown className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">-40% Carbon Footprint</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Sourcing from local farms reduced CO2 emissions compared to imports.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">100% Verified Organic</p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">Blockchain verifies all active stock is free from synthetic pesticides.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const ReceivingTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <Card className="max-w-2xl mx-auto border-border/50 shadow-sm">
        <CardHeader className="text-center pb-8">
          <ShieldCheck className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-2xl">Receive Store Delivery</CardTitle>
          <CardDescription>
            Scan logistics QR code to take final retail custody. This completes the B2B supply chain on the blockchain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-3">
            <input 
              type="text" 
              value={handoffId}
              onChange={(e) => setHandoffId(e.target.value)}
              placeholder="e.g. BATCH-XYZ" 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" 
            />
          </div>

          <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border">
            <h4 className="text-sm font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Arrival Quality Feedback</h4>
            <p className="text-xs text-muted-foreground">This feedback is permanently logged to the blockchain to hold distributors and farmers accountable.</p>
            <select 
              value={qualityFeedback}
              onChange={(e) => setQualityFeedback(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="Excellent">Excellent - Fresh and Undamaged</option>
              <option value="Good">Good - Minor standard wear</option>
              <option value="Poor">Poor - Bruised or Overripe</option>
              <option value="Rejected">Rejected - Spoiled or Damaged</option>
            </select>
          </div>

          {handoffSuccess && <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm">{handoffSuccess}</div>}
          {handoffError && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">{handoffError}</div>}

          <Button className="w-full" onClick={handleTakeCustody} disabled={!handoffId || handoffLoading}>
            {handoffLoading ? "Processing on Blockchain..." : "Take Retail Custody & Submit Feedback"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const InventoryTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Smart Inventory (FEFO)</CardTitle>
          <CardDescription>AI-driven dynamic pricing and shelf placement to eliminate food waste.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading inventory...</div>
          ) : sortedInventory.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Your store inventory is empty. Receive a batch first!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-2">Batch / Product</th>
                    <th className="text-left py-3 px-2">AI Shelf Life</th>
                    <th className="text-left py-3 px-2">Actionable Intelligence</th>
                    <th className="text-right py-3 px-2">Consumer QR</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInventory.map((item) => {
                    const analysis = getShelfLifeAnalysis(item.expiry_date)
                    return (
                      <tr key={item.id} className="border-b border-muted/30">
                        <td className="py-4 px-2">
                          <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{item.batch_number} • {item.quantity} units</div>
                        </td>
                        <td className="py-4 px-2">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            analysis.risk === 'expired' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                            analysis.risk === 'high' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                            analysis.risk === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
                            {analysis.daysLeft > 0 ? `${analysis.daysLeft} Days Left` : 'Expired'}
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex flex-col gap-1.5">
                            {analysis.discount !== '0%' && analysis.risk !== 'expired' && (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                                <Tag className="h-3.5 w-3.5" /> Recommend {analysis.discount} Markdown
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                              <Store className="h-3.5 w-3.5" /> {analysis.recommendation}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            <QrCode className="mr-1.5 h-3.5 w-3.5" /> Print Shelf Tag
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const RestockingTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>AI Demand Forecasting</CardTitle>
            <CardDescription>Predicted vs actual sales units this week.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={demandForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="forecast" fill="#3b82f6" fillOpacity={0.4} radius={[4,4,0,0]} name="AI Forecast" />
                <Bar dataKey="actual" fill="#22c55e" radius={[4,4,0,0]} name="Actual Sales" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>1-Click Restocking</CardTitle>
            <CardDescription>Items predicted to run out in the next 48 hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { product: "Organic Avocados", current: 12, predicted: 45, supplier: "Green Valley Farm" },
              { product: "Fresh Tomatoes", current: 8, predicted: 60, supplier: "Sunrise Organics" }
            ].map((item, idx) => (
              <div key={idx} className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">{item.product}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Supplier: {item.supplier}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium border border-red-200">Critical Stock</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Current Stock</span>
                    <span className="font-mono font-medium">{item.current} units</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Predicted Weekend Demand</span>
                    <span className="font-mono font-medium">{item.predicted} units</span>
                  </div>
                </div>
                <Button onClick={() => handleRestock(item.product)} className="w-full mt-2" variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Auto-Restock {item.predicted} units
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Retailer Portal</h1>
        <p className="text-muted-foreground mt-1">Smart inventory management, zero waste optimization, and consumer transparency.</p>
      </div>

      <div className="flex overflow-x-auto pb-2 -mb-2 scrollbar-none gap-2">
        <Button variant={activeTab === "overview" ? "default" : "outline"} onClick={() => setActiveTab("overview")} className="rounded-full px-6">
          <BarChart3 className="mr-2 h-4 w-4" />
          Store Overview
        </Button>
        <Button variant={activeTab === "receiving" ? "default" : "outline"} onClick={() => setActiveTab("receiving")} className="rounded-full px-6">
          <QrCode className="mr-2 h-4 w-4" />
          Receiving & Quality
        </Button>
        <Button variant={activeTab === "inventory" ? "default" : "outline"} onClick={() => setActiveTab("inventory")} className="rounded-full px-6">
          <Package className="mr-2 h-4 w-4" />
          Smart Inventory
        </Button>
        <Button variant={activeTab === "restock" ? "default" : "outline"} onClick={() => setActiveTab("restock")} className="rounded-full px-6">
          <RefreshCw className="mr-2 h-4 w-4" />
          Restocking
        </Button>
      </div>

      <div className="mt-6">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "receiving" && <ReceivingTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "restock" && <RestockingTab />}
      </div>
    </div>
  )
}
