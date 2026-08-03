import { Factory, CheckCircle, BarChart3, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"
import { Button } from "../components/ui/Button"

const pendingBatches = [
  { id: "BCH-001", product: "Organic Avocados", farmer: "Green Valley Farms", quantity: "500 kg", received: "Oct 12", status: "Pending Cleaning" },
  { id: "BCH-002", product: "Premium Mangoes", farmer: "Sunshine Orchards", quantity: "280 kg", received: "Oct 13", status: "In Sorting" },
  { id: "BCH-003", product: "Wheat Grain", farmer: "GoldenFields Co.", quantity: "1200 kg", received: "Oct 14", status: "In Packaging" },
]

export function ProcessorDashboard() {
  const stats = [
    { title: "Pending Batches", value: "18", icon: Factory, color: "text-amber-500" },
    { title: "Processed Today", value: "9", icon: CheckCircle, color: "text-green-500" },
    { title: "Avg Quality Score", value: "87%", icon: BarChart3, color: "text-blue-500" },
    { title: "Failed QC", value: "1", icon: AlertCircle, color: "text-red-500" },
  ]

  const stages = ["Cleaning", "Sorting", "Grading", "Packaging", "Quality Verified"]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Processor Portal</h1>
        <p className="text-muted-foreground">Manage batch processing and quality verification.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{s.title}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Processing Pipeline</CardTitle>
          <CardDescription>Update processing stage and store blockchain record for each batch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingBatches.map((batch) => (
            <div key={batch.id} className="p-5 rounded-2xl border bg-muted/20 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-base">{batch.product}</p>
                  <p className="text-sm text-muted-foreground">{batch.farmer} · {batch.quantity} · Received: {batch.received}</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 font-medium">{batch.status}</span>
              </div>
              
              {/* Stage selector */}
              <div className="flex flex-wrap gap-2">
                {stages.map((stage) => (
                  <button
                    key={stage}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      batch.status.includes(stage.split(" ")[0])
                        ? "bg-primary text-white border-primary"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm">View AI Report</Button>
                <Button size="sm">Update Stage & Record on Chain</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
