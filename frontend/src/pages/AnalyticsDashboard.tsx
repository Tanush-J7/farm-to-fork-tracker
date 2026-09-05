import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { TrendingUp, Users, Package, ShieldCheck } from "lucide-react"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function AnalyticsDashboard() {
  const { token } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get(`${API}/admin/analytics`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.data.success) {
          setData(res.data.data)
        }
      } catch (err) {
        console.error("Failed to fetch analytics", err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [token])

  if (loading) return <div className="p-8">Loading analytics...</div>
  if (!data) return <div className="p-8">Failed to load analytics data.</div>

  const { totalRevenue, activeUsers, productsTracked, blockchainTxs, monthlyData, qualityData, userGrowthData, recentTx } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Complete visibility into your supply chain performance.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, change: "estimated total", icon: TrendingUp, color: "text-green-500" },
          { title: "Active Users", value: activeUsers.toLocaleString(), change: "registered", icon: Users, color: "text-blue-500" },
          { title: "Products Tracked", value: productsTracked.toLocaleString(), change: "total batches", icon: Package, color: "text-amber-500" },
          { title: "Blockchain TXs", value: blockchainTxs.toLocaleString(), change: "on-chain events", icon: ShieldCheck, color: "text-purple-500" },
        ].map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpi.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Monthly Products & Revenue</CardTitle>
            <CardDescription>Products registered and revenue generated per month (Last 6 Months).</CardDescription>
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
            {qualityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={qualityData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                    {qualityData.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">No quality data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Growth by Role</CardTitle>
            <CardDescription>New user registrations (Last 6 Months).</CardDescription>
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
            {recentTx.length > 0 ? recentTx.map((tx: any) => (
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
            )) : (
               <div className="text-sm text-muted-foreground">No recent transactions found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
