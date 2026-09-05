import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card"
import { Button } from "../components/ui/Button"
import { Activity, Leaf, ShieldAlert, Users, Server, Database, CheckCircle, Clock, AlertTriangle } from "lucide-react"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function Dashboard() {
  const { token } = useAuth()
  const [stats, setStats] = useState<any>({
    totalProducts: 0,
    activeShipments: 0,
    totalUsers: 0,
    aiAlerts: 0,
    pendingUsers: [],
    pendingProducts: [],
    alertsList: [],
    recentActivity: []
  })
  const [bcHealth, setBcHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        setStats(res.data.data)
      }
    } catch (err) {
      console.error("Failed to fetch stats", err)
    }
  }

  const fetchHealth = async () => {
    try {
      const res = await axios.get(`${API}/admin/blockchain-health`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        setBcHealth(res.data.data)
      }
    } catch (err) {
      console.error("Failed to fetch bc health", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchHealth()
  }, [token])

  const approveUser = async (id: string, currentRole: string) => {
    try {
      const newRole = currentRole.replace('pending_', '')
      await axios.put(`${API}/admin/users/${id}/role`, { role: newRole }, { headers: { Authorization: `Bearer ${token}` }})
      fetchStats()
    } catch (e) {
      alert("Failed to approve user")
    }
  }

  const approveProduct = async (id: string) => {
    try {
      await axios.put(`${API}/admin/products/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` }})
      fetchStats()
    } catch (e) {
      alert("Failed to approve product")
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div></div>

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Action Center</h1>
        <p className="text-muted-foreground mt-1">Live administration and approval queue.</p>
      </div>

      {/* Top Stat Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Products", value: stats.totalProducts, change: "Registered in system", icon: Leaf, color: "text-green-500" },
          { title: "Active Shipments", value: stats.activeShipments, change: "In transit or processing", icon: Activity, color: "text-blue-500" },
          { title: "Total Users", value: stats.totalUsers, change: "Farmers, Processors, etc.", icon: Users, color: "text-emerald-500" },
          { title: "AI Quality Alerts", value: stats.aiAlerts, change: "Products flagged as 'Poor'", icon: ShieldAlert, color: "text-red-500" },
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

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Column: Action Queues (Span 8) */}
        <div className="md:col-span-8 space-y-6">
          
          {/* Pending Approvals */}
          <Card className="border-amber-200 dark:border-amber-900/50">
            <CardHeader className="bg-amber-50 dark:bg-amber-900/10 rounded-t-xl border-b border-amber-100 dark:border-amber-900/30">
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                <Clock className="h-5 w-5" /> Pending Approvals Queue
              </CardTitle>
              <CardDescription>Users and products waiting for administrator review.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {stats.pendingUsers?.length === 0 && stats.pendingProducts?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2 opacity-50" />
                  Inbox Zero. No pending approvals.
                </div>
              ) : (
                <div className="divide-y">
                  {stats.pendingUsers?.map((u: any) => (
                    <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">User</span>
                          <span className="font-semibold text-sm">{u.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{u.email} • Requested: {new Date(u.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{u.role}</span>
                        <Button size="sm" onClick={() => approveUser(u.id, u.role)}>Approve</Button>
                      </div>
                    </div>
                  ))}
                  {stats.pendingProducts?.map((p: any) => (
                    <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Product</span>
                          <span className="font-semibold text-sm">{p.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{p.quantity}kg • Batch: {p.batch_number} • {new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      <Button size="sm" onClick={() => approveProduct(p.id)}>Approve</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Alerts */}
          {stats.alertsList?.length > 0 && (
            <Card className="border-red-200 dark:border-red-900/50">
              <CardHeader className="bg-red-50 dark:bg-red-900/10 rounded-t-xl border-b border-red-100 dark:border-red-900/30">
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-500">
                  <AlertTriangle className="h-5 w-5" /> AI Quality Alerts
                </CardTitle>
                <CardDescription>Products flagged as "Poor" quality requiring investigation.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {stats.alertsList.map((a: any) => (
                    <div key={a.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <div>
                        <p className="font-semibold text-sm">{a.name} <span className="text-muted-foreground font-normal">(Batch: {a.batch_number})</span></p>
                        <p className="text-xs text-muted-foreground mt-1">Status: {a.status}</p>
                      </div>
                      <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded">
                        Score: {(a.ai_quality_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right Column: Feeds & System (Span 4) */}
        <div className="md:col-span-4 space-y-6">
          
          {/* Live Activity Feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" /> Live Activity Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentActivity?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                <div className="space-y-4">
                  {stats.recentActivity?.map((act: any, i: number) => (
                    <div key={i} className="flex gap-3 relative">
                      {i !== stats.recentActivity.length - 1 && (
                        <div className="absolute left-[9px] top-6 bottom-[-16px] w-[2px] bg-slate-100 dark:bg-slate-800"></div>
                      )}
                      <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5 z-10">
                        <div className="h-2 w-2 rounded-full bg-primary"></div>
                      </div>
                      <div>
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">{act.name}</span> updated to <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{act.status}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(act.created_at).toLocaleString()} • {act.batch_number}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-primary" /> System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold flex items-center gap-1"><Database className="h-3 w-3"/> Database</span>
                  <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">HEALTHY</span>
                </div>
                <p className="text-xs text-muted-foreground">Serving {stats.totalUsers} users & {stats.totalProducts} products.</p>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold flex items-center gap-1"><Server className="h-3 w-3"/> Blockchain</span>
                  <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">HEALTHY</span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">Network: <span className="font-mono">{bcHealth?.network || 'Sepolia'}</span></p>
                <div className="text-[10px] font-mono text-muted-foreground break-all bg-white dark:bg-black p-1.5 rounded border">
                  Admin: {bcHealth?.address || '0x...'}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
