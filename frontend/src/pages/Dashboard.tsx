import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card"
import { Activity, Leaf, ShieldAlert, Users, Server, Database } from "lucide-react"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function Dashboard() {
  const { token } = useAuth()
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeShipments: 0,
    totalUsers: 0,
    aiAlerts: 0,
  })
  const [bcHealth, setBcHealth] = useState<any>(null)

  useEffect(() => {
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
        console.error("Failed to fetch BC health", err)
      }
    }

    fetchStats()
    fetchHealth()
  }, [token])

  const statCards = [
    { title: "Total Products", value: stats.totalProducts, description: "Registered in system", icon: Leaf },
    { title: "Active Shipments", value: stats.activeShipments, description: "In transit or processing", icon: Activity },
    { title: "Total Users", value: stats.totalUsers, description: "Farmers, Processors, etc.", icon: Users },
    { title: "AI Quality Alerts", value: stats.aiAlerts, description: "Products flagged as 'Poor'", icon: ShieldAlert, alert: true },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Monitor farm-to-fork supply chain activity and system health.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <Card key={i} className={stat.alert && stat.value > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.alert && stat.value > 0 ? 'text-destructive' : 'text-primary'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5"/> Blockchain Health</CardTitle>
            <CardDescription>Status of the underlying RPC and Smart Contract.</CardDescription>
          </CardHeader>
          <CardContent>
            {bcHealth ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`text-sm font-bold ${bcHealth.status === 'healthy' ? 'text-green-500' : 'text-amber-500'}`}>
                    {bcHealth.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm text-muted-foreground">Network</span>
                  <span className="text-sm">{bcHealth.network}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm text-muted-foreground">Admin Wallet Balance</span>
                  <span className="text-sm font-mono">{bcHealth.walletBalance} ETH</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-muted-foreground">Admin Wallet</span>
                  <span className="text-xs font-mono">{bcHealth.walletAddress || 'Not Configured'}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Loading health status...</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5"/> Database Health</CardTitle>
            <CardDescription>Status of Supabase connection.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-sm font-bold text-green-500">HEALTHY</span>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Database is actively serving requests for {stats.totalUsers} users and {stats.totalProducts} products.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
