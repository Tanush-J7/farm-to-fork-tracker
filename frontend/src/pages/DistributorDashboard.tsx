import { Package, Truck, CheckCircle, Zap, AlertTriangle, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const shipments = [
  { id: "SHP-001", product: "Organic Avocados", vehicle: "TN-01-AX-3421", driver: "Raj Kumar", pickup: "Oct 15", delivery: "Oct 17", status: "In Transit", location: "Pune, MH" },
  { id: "SHP-002", product: "Premium Mangoes", vehicle: "KA-04-BC-8812", driver: "Suresh Babu", pickup: "Oct 14", delivery: "Oct 16", status: "Delivered", location: "Mumbai, MH" },
  { id: "SHP-003", product: "Fresh Tomatoes", vehicle: "MH-12-GH-5530", driver: "Anil Sharma", pickup: "Oct 16", delivery: "Oct 18", status: "Pending", location: "Nashik, MH" },
]

const routeData = [
  { day: "Mon", deliveries: 8, onTime: 7 },
  { day: "Tue", deliveries: 12, onTime: 11 },
  { day: "Wed", deliveries: 9, onTime: 9 },
  { day: "Thu", deliveries: 15, onTime: 13 },
  { day: "Fri", deliveries: 18, onTime: 16 },
  { day: "Sat", deliveries: 11, onTime: 10 },
]

export function DistributorDashboard() {
  const stats = [
    { title: "Active Shipments", value: "14", icon: Truck, color: "text-blue-500" },
    { title: "Delivered Today", value: "7", icon: CheckCircle, color: "text-green-500" },
    { title: "AI Route Optimized", value: "92%", icon: Zap, color: "text-amber-500" },
    { title: "Delay Alerts", value: "2", icon: AlertTriangle, color: "text-red-500" },
    { title: "Total Products", value: "341", icon: Package, color: "text-purple-500" },
    { title: "Efficiency Score", value: "88%", icon: TrendingUp, color: "text-primary" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Distributor Portal</h1>
        <p className="text-muted-foreground">Manage shipments and track AI-optimized routes.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.title} className="col-span-1">
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
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Delivery Performance</CardTitle>
            <CardDescription>AI-predicted vs actual delivery success rate.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={routeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                <Area type="monotone" dataKey="deliveries" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} name="Total" />
                <Area type="monotone" dataKey="onTime" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2} name="On Time" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Route Optimization</CardTitle>
            <CardDescription>Today's recommended routes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {["Nashik → Pune: Save 34 km", "Pune → Mumbai: Avoid NH-48 (congestion)", "Kolhapur → Satara: Optimal 2.5hr"].map((route, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-sm">
                <Zap className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="text-slate-300">{route}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Shipments</CardTitle>
          <CardDescription>Real-time shipment tracking with GPS location.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-2">Shipment ID</th>
                  <th className="text-left py-3 px-2">Product</th>
                  <th className="text-left py-3 px-2">Vehicle</th>
                  <th className="text-left py-3 px-2">Driver</th>
                  <th className="text-left py-3 px-2">Location</th>
                  <th className="text-left py-3 px-2">Delivery</th>
                  <th className="text-left py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id} className="border-b border-muted/30 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-2 font-mono text-xs">{s.id}</td>
                    <td className="py-3 px-2 font-medium">{s.product}</td>
                    <td className="py-3 px-2 text-muted-foreground">{s.vehicle}</td>
                    <td className="py-3 px-2">{s.driver}</td>
                    <td className="py-3 px-2 text-muted-foreground">{s.location}</td>
                    <td className="py-3 px-2">{s.delivery}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        s.status === "Delivered" ? "bg-green-500/10 text-green-400" :
                        s.status === "In Transit" ? "bg-blue-500/10 text-blue-400" :
                        "bg-amber-500/10 text-amber-400"
                      }`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
