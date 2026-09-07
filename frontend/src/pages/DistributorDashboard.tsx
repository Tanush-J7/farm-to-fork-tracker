import { useState, useEffect } from "react"
import axios from "axios"
import { Package, Truck, CheckCircle, Zap, AlertTriangle, TrendingUp, MapPin, QrCode, SplitSquareHorizontal, Clock, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { Button } from "../components/ui/Button"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useAuth } from "../context/AuthContext"

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
  const { user, token } = useAuth()
  const [activeTab, setActiveTab] = useState("overview")
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Handoff state
  const [handoffId, setHandoffId] = useState("")
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [handoffSuccess, setHandoffSuccess] = useState("")
  const [handoffError, setHandoffError] = useState("")

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
    if (token) {
      fetchInventory()
    }
  }, [token])

  const handleTakeCustody = async () => {
    if (!handoffId) return;
    setHandoffLoading(true)
    setHandoffError("")
    setHandoffSuccess("")
    
    try {
      // 1. Get Product by Blockchain ID / Batch ID
      const res = await axios.get(`${API_URL}/products/blockchain/${handoffId}`)
      const product = res.data.data
      
      // 2. Take custody (Update status and current_owner_id)
      await axios.put(`${API_URL}/products/${product.id}/status`, {
        status: 'In Transit',
        current_owner_id: user?.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      setHandoffSuccess(`Successfully took custody of ${product.name} (Batch: ${product.batch_number})`)
      setHandoffId("")
      fetchInventory() // Refresh inventory
    } catch (err: any) {
      setHandoffError(err.response?.data?.message || "Failed to verify ID or take custody.")
    } finally {
      setHandoffLoading(false)
    }
  }

  // Calculate dynamic stats based on inventory
  const activeShipmentsCount = inventory.filter(p => p.status === 'In Transit').length;
  const deliveredCount = inventory.filter(p => p.status === 'Delivered').length;

  const stats = [
    { title: "Active Shipments", value: activeShipmentsCount, icon: Truck, color: "text-blue-500" },
    { title: "Delivered Today", value: deliveredCount, icon: CheckCircle, color: "text-green-500" },
    { title: "AI Route Optimized", value: "92%", icon: Zap, color: "text-amber-500" },
    { title: "Delay Alerts", value: "0", icon: AlertTriangle, color: "text-red-500" },
    { title: "Total Products", value: inventory.length, icon: Package, color: "text-purple-500" },
    { title: "Efficiency Score", value: "88%", icon: TrendingUp, color: "text-primary" },
  ]

  const OverviewTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
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
            <CardDescription>AI-predicted vs actual delivery success rate.</CardDescription>
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
            <CardTitle>Logistics Alerts</CardTitle>
            <CardDescription>Actionable intelligence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Zap className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Smart Consolidation</p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">2 active shipments can be grouped to save fuel.</p>
              </div>
            </div>
            {inventory.filter(i => i.expiry_date && new Date(i.expiry_date).getTime() < Date.now() + 2 * 24 * 60 * 60 * 1000).map((item, idx) => (
              <div key={idx} className="flex gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <Clock className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">FEFO Expiry Alert</p>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">{item.name} (Batch {item.batch_number}) expires soon.</p>
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
          <CardHeader>
            <CardTitle>Active Shipments & Live Tracking</CardTitle>
            <CardDescription>Monitor fleet movement and delivery statuses.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-2">Batch Number</th>
                    <th className="text-left py-3 px-2">Product</th>
                    <th className="text-left py-3 px-2">Quantity</th>
                    <th className="text-left py-3 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.filter(i => i.status === 'In Transit').length === 0 && (
                     <tr>
                       <td colSpan={4} className="py-8 text-center text-muted-foreground">No active shipments in transit.</td>
                     </tr>
                  )}
                  {inventory.filter(i => i.status === 'In Transit').map((s) => (
                    <tr key={s.id} className="border-b border-muted/30 hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-2 font-mono text-xs">{s.batch_number}</td>
                      <td className="py-3 px-2 font-medium">{s.name}</td>
                      <td className="py-3 px-2 text-muted-foreground">{s.quantity}</td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {s.status}
                        </span>
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
            <CardTitle>AI Route Optimization</CardTitle>
            <CardDescription>Live routing recommendations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Route: Hub → City Center</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Optimal</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Taking alternate route will save fuel based on traffic.</p>
              <Button size="sm" variant="outline" className="w-full text-xs h-8">Send to Driver</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const InventoryTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Warehouse Inventory</CardTitle>
            <CardDescription>Manage batches and storage zones.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading inventory...</div>
            ) : inventory.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Your inventory is empty.</div>
            ) : (
             <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2">Batch / ID</th>
                    <th className="text-left py-2 px-2">Product</th>
                    <th className="text-left py-2 px-2">Expiry</th>
                    <th className="text-right py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id} className="border-b border-muted/30">
                      <td className="py-3 px-2">
                        <div className="font-mono text-xs">{item.batch_number}</div>
                        <div className="text-[10px] text-muted-foreground">ID: {item.product_id}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.quantity} units</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-xs">
                          {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{item.status}</span>
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
            <CardTitle>Batch Splitting</CardTitle>
            <CardDescription>Split a large batch for multiple retail deliveries.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Parent Batch</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.batch_number} ({item.name}) - {item.quantity}
                    </option>
                  ))}
                  {inventory.length === 0 && <option>No inventory available</option>}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Child Pallets</label>
                <input type="number" defaultValue={2} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
              </div>
              <Button className="w-full mt-4" disabled={inventory.length === 0}>
                <SplitSquareHorizontal className="mr-2 h-4 w-4" />
                Generate New QR Codes & Split
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
        <CardHeader className="text-center pb-8">
          <ShieldCheck className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-2xl">Take Custody</CardTitle>
          <CardDescription>
            Scan a QR code from a Farmer or Processor to officially record the transfer of ownership on the blockchain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-2xl p-12 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/20">
            <QrCode className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <Button variant="outline" className="relative">
              Open Camera to Scan
              <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" />
            </Button>
            <p className="text-xs text-muted-foreground mt-4 text-center max-w-xs">
              Point your camera at the batch QR code to securely verify and log custody transfer.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or enter manually
              </span>
            </div>
          </div>

          {handoffSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm">
              {handoffSuccess}
            </div>
          )}
          {handoffError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
              {handoffError}
            </div>
          )}

          <div className="flex gap-3">
            <input 
              type="text" 
              value={handoffId}
              onChange={(e) => setHandoffId(e.target.value)}
              placeholder="e.g. 100008 or BATCH-XYZ" 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
            />
            <Button onClick={handleTakeCustody} disabled={!handoffId || handoffLoading}>
              {handoffLoading ? "Verifying..." : "Verify & Take Custody"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Distributor Operations</h1>
        <p className="text-muted-foreground mt-1">Manage logistics, smart routing, inventory, and blockchain handoffs.</p>
      </div>

      <div className="flex overflow-x-auto pb-2 -mb-2 scrollbar-none gap-2">
        <Button 
          variant={activeTab === "overview" ? "default" : "outline"} 
          onClick={() => setActiveTab("overview")}
          className="rounded-full px-6"
        >
          Overview
        </Button>
        <Button 
          variant={activeTab === "fleet" ? "default" : "outline"} 
          onClick={() => setActiveTab("fleet")}
          className="rounded-full px-6"
        >
          <Truck className="mr-2 h-4 w-4" />
          Fleet & Tracking
        </Button>
        <Button 
          variant={activeTab === "inventory" ? "default" : "outline"} 
          onClick={() => setActiveTab("inventory")}
          className="rounded-full px-6"
        >
          <Package className="mr-2 h-4 w-4" />
          Inventory
        </Button>
        <Button 
          variant={activeTab === "blockchain" ? "default" : "outline"} 
          onClick={() => setActiveTab("blockchain")}
          className="rounded-full px-6"
        >
          <QrCode className="mr-2 h-4 w-4" />
          Receive (Handoff)
        </Button>
      </div>

      <div className="mt-6">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "fleet" && <FleetTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "blockchain" && <BlockchainTab />}
      </div>
    </div>
  )
}
