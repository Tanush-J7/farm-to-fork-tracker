import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card"
import { Activity, Leaf, TrendingUp, ShieldAlert } from "lucide-react"

export function Dashboard() {
  const stats = [
    { title: "Total Products", value: "1,248", description: "+12% from last month", icon: Leaf },
    { title: "Active Shipments", value: "43", description: "In transit right now", icon: Activity },
    { title: "Revenue", value: "$45,231", description: "+8% from last month", icon: TrendingUp },
    { title: "AI Alerts", value: "3", description: "Requires attention", icon: ShieldAlert, alert: true },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Monitor your farm-to-fork supply chain activity.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className={stat.alert ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.alert ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Supply chain movements on the blockchain.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Placeholder for chart/table */}
            <div className="h-[300px] w-full rounded-md border border-dashed flex items-center justify-center text-muted-foreground bg-white/10">
              Blockchain Activity Chart
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>AI Quality Reports</CardTitle>
            <CardDescription>Latest crop analysis results.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               {[1, 2, 3].map((_, i) => (
                 <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-white/40 dark:bg-black/40 border">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Leaf className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Batch #{1042 + i} - Organic Apples</p>
                      <p className="text-xs text-muted-foreground">Quality: Excellent (98%)</p>
                    </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
