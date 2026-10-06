import { FarmerAIAssistant } from "../components/FarmerAIAssistant"

export function FarmerAIServices() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Services</h1>
        <p className="text-slate-400 mt-1">Leverage FarmChain AI for crop health analysis, shelf-life estimation, and market price forecasting.</p>
      </div>

      <FarmerAIAssistant />
    </div>
  )
}
