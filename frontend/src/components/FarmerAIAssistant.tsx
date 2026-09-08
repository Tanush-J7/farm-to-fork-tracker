import { useState } from "react"
import { Button } from "./ui/Button"
import { TrendingUp, TrendingDown, Minus, Info, Calendar, MapPin, Package, AlertTriangle } from "lucide-react"
import axios from "axios"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"

const AI_API = import.meta.env.VITE_AI_API_URL || "http://localhost:8000"

interface PredictionItem {
  date: string
  predicted_price: number
}

interface PricePredictionResponse {
  commodity: string
  market: string
  current_price: number
  predictions: PredictionItem[]
  trend: "INCREASING" | "DECREASING" | "STABLE" | "UNKNOWN"
  expected_change_pct: number
  model_version: string
  model_info: {
    type: string
    last_trained: string
    evaluation_mae: number
  }
}

export function FarmerAIAssistant() {
  const [commodity, setCommodity] = useState("Tomato")
  const [market, setMarket] = useState("Bangalore")
  const [forecastDays, setForecastDays] = useState(7)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PricePredictionResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const handlePredictPrice = async () => {
    setLoading(true)
    setErrorMsg("")
    setResult(null)
    
    try {
      const payload = {
        commodity,
        market,
        forecast_days: forecastDays
      }
      
      const res = await axios.post(`${AI_API}/api/farmer/price-prediction`, payload)
      
      if (res.data.error) {
        setErrorMsg(res.data.message || "Failed to fetch prediction.")
      } else {
        setResult(res.data)
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.response?.data?.message || "Failed to connect to AI service. Ensure it's running.")
    } finally {
      setLoading(false)
    }
  }

  // Generate chart data combining current price (Day 0) and predictions
  const chartData = result ? [
    { date: "Current", price: result.current_price },
    ...result.predictions.map(p => ({
      date: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      price: p.predicted_price
    }))
  ] : []

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">AI Price Prediction</h2>
            <p className="text-sm text-slate-400 mt-0.5">Forecast market prices using historical data</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Input Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> Commodity
          </label>
          <select 
            value={commodity} 
            onChange={(e) => setCommodity(e.target.value)}
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="Tomato">Tomato</option>
            <option value="Onion">Onion</option>
            <option value="Potato">Potato</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Market
          </label>
          <select 
            value={market} 
            onChange={(e) => setMarket(e.target.value)}
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="Bangalore">Bangalore</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Delhi">Delhi</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Forecast Horizon
          </label>
          <select 
            value={forecastDays} 
            onChange={(e) => setForecastDays(Number(e.target.value))}
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value={1}>1 Day</option>
            <option value={3}>3 Days</option>
            <option value={7}>7 Days</option>
          </select>
        </div>
      </div>

      <Button 
        onClick={handlePredictPrice} 
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50"
      >
        {loading ? "Generating Prediction..." : "Predict Price"}
      </Button>

      {/* Results Section */}
      {result && (
        <div className="space-y-6 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">CURRENT PRICE</p>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">₹{result.current_price.toFixed(2)}<span className="text-sm font-normal text-slate-500 dark:text-slate-400">/kg</span></div>
            </div>
            
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">PREDICTED PRICE</p>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                ₹{result.predictions[result.predictions.length - 1].predicted_price.toFixed(2)}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/kg</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">EXPECTED CHANGE</p>
              <div className={`text-2xl font-bold ${
                result.expected_change_pct > 0 ? "text-emerald-600 dark:text-emerald-400" : 
                result.expected_change_pct < 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"
              }`}>
                {result.expected_change_pct > 0 ? '+' : ''}{result.expected_change_pct.toFixed(2)}%
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">MARKET TREND</p>
              <div className="flex items-center gap-2 mt-1">
                {result.trend === "INCREASING" && <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
                {result.trend === "DECREASING" && <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />}
                {result.trend === "STABLE" && <Minus className="h-6 w-6 text-slate-500 dark:text-slate-400" />}
                <span className="text-lg font-bold capitalize text-slate-900 dark:text-white">{result.trend.toLowerCase()}</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="p-4 rounded-xl bg-slate-800/30 border border-white/5 h-72">
            <h3 className="text-sm font-medium text-slate-300 mb-4">{forecastDays}-Day Price Forecast</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val}`}
                  domain={['auto', 'auto']}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                  itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                  formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Price']}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#60a5fa' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Model Info - Replacing Fake Confidence */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 text-xs text-slate-400 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-400 shrink-0" />
              <span>Forecast based on historical market patterns.</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 opacity-80">
              <span><strong>Model:</strong> {result.model_info.type} v{result.model_version}</span>
              <span><strong>MAE:</strong> ₹{result.model_info.evaluation_mae.toFixed(2)}</span>
              <span><strong>Trained:</strong> {new Date(result.model_info.last_trained).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
