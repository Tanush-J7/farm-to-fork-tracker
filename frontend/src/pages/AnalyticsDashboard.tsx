import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { TrendingUp, Users, Package, ShieldCheck } from "lucide-react"

const monthlyData = [
  { month: "Jan", products: 42, revenue: 12000 },
  { month: "Feb", products: 58, revenue: 15500 },
  { month: "Mar", products: 73, revenue: 19200 },
  { month: "Apr", products: 61, revenue: 16800 },
  { month: "May", products: 95, revenue: 24300 },
  { month: "Jun", products: 112, revenue: 28900 },
  { month: "Jul", products: 138, revenue: 35600 },
]

const qualityData = [
  { name: "Excellent", value: 45, color: "#22c55e" },
  { name: "Good", value: 30, color: "#84cc16" },
  { name: "Average", value: 18, color: "#eab308" },
  { name: "Poor", value: 7, color: "#ef4444" },
]

const userGrowthData = [
  { month: "Jan", farmers: 12, processors: 4, distributors: 6 },
  { month: "Feb", farmers: 18, processors: 6, distributors: 9 },
  { month: "Mar", farmers: 24, processors: 9, distributors: 14 },
  { month: "Apr", farmers: 31, processors: 12, distributors: 18 },
  { month: "May", farmers: 42, processors: 15, distributors: 24 },
  { month: "Jun", farmers: 55, processors: 19, distributors: 31 },
]

const recentTx = [
  { id: "0x8f2a...391c", product: "Organic Avocados", type: "Register", time: "2 mins ago", status: "Confirmed" },
  { id: "0x4b1e...882a", product: "Wheat Batch B-12", type: "Stage Update", time: "14 mins ago", status: "Confirmed" },
  { id: "0x9c3d...110f", product: "Tomatoes - Farm 3", type: "Transfer", time: "1 hour ago", status: "Confirmed" },
  { id: "0x2e7f...449d", product: "Mango Export Lot", type: "Register", time: "3 hours ago", status: "Pending" },
  { id: "0x1a4b...cc23", product: "Rice Premium", type: "Stage Update", time: "5 hours ago", status: "Confirmed" },
]

export function AnalyticsDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Complete visibility into your supply chain performance.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Revenue", value: "$152,400", change: "+18.2%", icon: TrendingUp, color: "text-green-500" },
          { title: "Active Users", value: "2,847", change: "+12.5%", icon: Users, color: "text-blue-500" },
          { title: "Products Tracked", value: "14,382", change: "+9.1%", icon: Package, color: "text-amber-500" },
          { title: "Blockchain TXs", value: "48,291", change: "+24.3%", icon: ShieldCheck, color: "text-purple-500" },
        ].map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-green-500 mt-1">{kpi.change} this month</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Monthly Products & Revenue</CardTitle>
            <CardDescription>Products registered and revenue generated per month.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorProducts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                <Legend />
                <Area type="monotone" dataKey="products" stroke="#22c55e" fill="url(#colorProducts)" strokeWidth={2} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quality Distribution</CardTitle>
            <CardDescription>AI-assessed quality breakdown.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={qualityData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                  {qualityData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Growth by Role</CardTitle>
            <CardDescription>New user registrations across supply chain roles.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={userGrowthData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                <Legend />
                <Bar dataKey="farmers" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="processors" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="distributors" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Blockchain Transactions</CardTitle>
            <CardDescription>Latest on-chain product events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTx.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border text-sm">
                <div>
                  <p className="font-medium truncate max-w-[160px]">{tx.product}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tx.type} · {tx.time}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tx.status === "Confirmed" ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}>
                    {tx.status}
                  </span>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{tx.id}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
