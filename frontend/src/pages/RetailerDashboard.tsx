import { ShoppingBag, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const demandForecast = [
  { day: "Mon", actual: 42, forecast: 45 },
  { day: "Tue", actual: 38, forecast: 40 },
  { day: "Wed", actual: 55, forecast: 52 },
  { day: "Thu", actual: 61, forecast: 58 },
  { day: "Fri", actual: 72, forecast: 70 },
  { day: "Sat", actual: 88, forecast: 85 },
  { day: "Sun", actual: 65, forecast: 68 },
]

const inventory = [
  { product: "Organic Avocados", stock: 145, expiry: "Oct 20", risk: "low" },
  { product: "Fresh Tomatoes", stock: 38, expiry: "Oct 18", risk: "medium" },
  { product: "Mangoes", stock: 12, expiry: "Oct 17", risk: "high" },
  { product: "Premium Wheat", stock: 320, expiry: "Nov 10", risk: "low" },
]

export function RetailerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Retailer Portal</h1>
        <p className="text-muted-foreground">AI-powered inventory management and demand forecasting.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { title: "Available Stock", value: "515 kg", icon: ShoppingBag, color: "text-green-500" },
          { title: "Expiring Soon", value: "3 items", icon: AlertTriangle, color: "text-amber-500" },
          { title: "Weekly Sales", value: "$12,490", icon: TrendingUp, color: "text-blue-500" },
          { title: "AI Waste Risk", value: "Low", icon: TrendingDown, color: "text-purple-500" },
        ].map((s) => (
          <Card key={s.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{s.title}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI Demand Forecast</CardTitle>
            <CardDescription>Predicted vs actual sales units this week.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={demandForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                <Bar dataKey="forecast" fill="#3b82f6" fillOpacity={0.4} radius={[4,4,0,0]} name="AI Forecast" />
                <Bar dataKey="actual" fill="#22c55e" radius={[4,4,0,0]} name="Actual Sales" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory & Expiry Risk</CardTitle>
            <CardDescription>AI-monitored stock levels and spoilage alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {inventory.map((item) => (
              <div key={item.product} className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                <div>
                  <p className="font-medium text-sm">{item.product}</p>
                  <p className="text-xs text-muted-foreground">Stock: {item.stock} kg · Expiry: {item.expiry}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  item.risk === "low" ? "bg-green-500/10 text-green-400" :
                  item.risk === "medium" ? "bg-amber-500/10 text-amber-400" :
                  "bg-red-500/10 text-red-400"
                }`}>{item.risk.charAt(0).toUpperCase() + item.risk.slice(1)} Risk</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
