import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { Layers, Users, Package, ShieldCheck } from "lucide-react"

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

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  const { 
    activeUsers = 0, 
    productsTracked = 0, 
    totalVolume = 0, 
    blockchainTxs = 0, 
    qualityData = [], 
    stageData = [], 
    monthlyData = [], 
    recentTx = [] 
  } = data || {}

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Supply Chain Analytics</h1>
          <p className="text-muted-foreground mt-1">Complete visibility into your agricultural supply chain performance.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Volume", value: `${totalVolume.toLocaleString()} kg`, change: "tracked biomass", icon: Layers, color: "text-emerald-600" },
          { title: "Active Users", value: activeUsers.toLocaleString(), change: "registered participants", icon: Users, color: "text-blue-500" },
          { title: "Batches Tracked", value: productsTracked.toLocaleString(), change: "individual lots", icon: Package, color: "text-amber-500" },
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
            <CardTitle>Monthly Batches & Volume</CardTitle>
            <CardDescription>Biomass volume tracked and individual batches registered per month.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProducts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}kg`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="volume" name="Volume (kg)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorVolume)" />
                  <Area yAxisId="right" type="monotone" dataKey="products" name="Batches" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorProducts)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quality Distribution</CardTitle>
            <CardDescription>AI assessed quality breakdown across all tracked batches.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center relative">
              {qualityData.length === 0 ? (
                <div className="text-muted-foreground text-sm">No quality data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={qualityData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {qualityData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Supply Chain Stages</CardTitle>
            <CardDescription>Real-time distribution of batches across the supply chain.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" name="Batches" radius={[0, 4, 4, 0]}>
                    {stageData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Blockchain Transactions</CardTitle>
            <CardDescription>Latest on-chain product traceability events.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTx.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                No blockchain transactions yet
              </div>
            ) : (
              <div className="space-y-4">
                {recentTx.map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm text-foreground">{tx.product}</p>
                      <p className="text-xs text-muted-foreground">{tx.type} • {tx.time}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-[10px] font-semibold uppercase rounded-full mb-1">
                        {tx.status}
                      </span>
                      <p className="text-[10px] font-mono text-muted-foreground">{tx.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
