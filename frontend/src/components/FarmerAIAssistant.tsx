import { useState } from "react"
import { Button } from "./ui/Button"
import { TrendingUp, TrendingDown, Minus, Info, Calendar, MapPin, Package, AlertTriangle } from "lucide-react"
import axios from "axios"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"

const AI_API = import.meta.env.VITE_AI_API_URL || "http://localhost:8000"
const RUPEE = "\u20B9"

interface PredictionItem {
  date: string
  predicted_price: number
  predicted_retail_price?: number
}

interface HistoricalItem {
  date: string
  price: number
  retail_price?: number
}

interface PricePredictionResponse {
  commodity: string
  market: string
  current_price: number
  current_retail_price?: number
  historical_data?: HistoricalItem[]
  predictions: PredictionItem[]
  trend: "INCREASING" | "DECREASING" | "STABLE"
  data_source: string
  data_as_of: string
  data_age_days: number
  model_version: string
}

export function FarmerAIAssistant() {
  const [commodity, setCommodity] = useState("Tomato")
  const [market, setMarket] = useState("Bangalore")
  const [forecastDays, setForecastDays] = useState<number>(7)
  const [priceMode, setPriceMode] = useState<"wholesale" | "retail">("wholesale")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PricePredictionResponse | null>(null)
  const [error, setError] = useState("")

  const handlePredict = async () => {
    setLoading(true)
    setError("")
    
    try {
      const response = await axios.post(`${AI_API}/api/farmer/price-prediction`, {
        commodity,
        market,
        forecast_days: forecastDays
      })
      
      if (response.data.error) {
        setError(response.data.message || "Failed to fetch prediction")
        setResult(null)
      } else {
        setResult(response.data)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "AI Service is unreachable.")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  // Chart data: ONLY future predictions
  const chartData = result ? result.predictions.map(p => {
    const d = new Date(p.date)
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: priceMode === 'retail' ? (p.predicted_retail_price || p.predicted_price * 1.3) : p.predicted_price
    }
  }) : []

  // Historical data for the table
  const historyTableData = result ? (result.historical_data || []).map(h => ({
    date: new Date(h.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    wholesale: h.price,
    retail: h.retail_price || Math.round(h.price * 1.3 * 100) / 100
  })) : []

  // Y-axis domain
  const minPrice = chartData.length > 0 ? Math.floor(Math.min(...chartData.map(d => d.price)) * 0.95) : 0
  const maxPrice = chartData.length > 0 ? Math.ceil(Math.max(...chartData.map(d => d.price)) * 1.05) : 0

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm text-slate-900 dark:text-white">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
          <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold">AI Price Prediction</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Forecast market prices using historical data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            <Package className="h-3 w-3" /> Commodity
          </label>
          <select 
            value={commodity}
            onChange={(e) => setCommodity(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
          >
            <option value="Tomato">Tomato</option>
            <option value="Onion">Onion</option>
            <option value="Potato">Potato</option>
            <option value="Carrot">Carrot</option>
            <option value="Cabbage">Cabbage</option>
            <option value="Green Chilli">Green Chilli</option>
            <option value="Brinjal">Brinjal</option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            <MapPin className="h-3 w-3" /> Market
          </label>
          <select 
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
          >
            <option value="Bangalore">Bangalore</option>
            <option value="Mysore">Mysore</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Pune">Pune</option>
            <option value="Delhi">Delhi</option>
            <option value="Hyderabad">Hyderabad</option>
            <option value="Chennai">Chennai</option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            <Calendar className="h-3 w-3" /> Forecast Horizon
          </label>
          <select 
            value={forecastDays}
            onChange={(e) => setForecastDays(Number(e.target.value))}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
          >
            <option value={1}>1 Day</option>
            <option value={3}>3 Days</option>
            <option value={7}>7 Days</option>
          </select>
        </div>
      </div>

      <Button 
        onClick={handlePredict} 
        disabled={loading}
        className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20 mb-6"
      >
        {loading ? "Analyzing Market Data..." : "Predict Price"}
      </Button>

      {error && (
        <div className="p-4 mb-6 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Data Source Warnings */}
          {(result.data_source === "CEDA_AGMARKNET" || result.data_source === "DATABASE_CACHE" || !result.data_source) && (
            <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 text-amber-700 dark:text-amber-300 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">
                {result.data_source === "CEDA_AGMARKNET" 
                  ? "Primary market data source unavailable. Using CEDA Agmarknet data." 
                  : "Live market data unavailable. Using the latest stored market data."}
              </p>
            </div>
          )}

          {/* Price Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg w-max">
            <button
              onClick={() => setPriceMode("wholesale")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                priceMode === "wholesale" 
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Wholesale Mandi
            </button>
            <button
              onClick={() => setPriceMode("retail")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                priceMode === "retail" 
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              City Retail
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Current {priceMode === 'retail' ? 'Retail' : 'Wholesale'}</p>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{RUPEE}{
                priceMode === 'retail' 
                  ? (result.current_retail_price?.toFixed(2) || (result.current_price * 1.3).toFixed(2))
                  : (result.current_price?.toFixed(2) || "0.00")
              }<span className="text-sm text-slate-500 dark:text-slate-400 font-normal">/kg</span></div>
            </div>
            
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Predicted {priceMode === 'retail' ? 'Retail' : 'Wholesale'}</p>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{RUPEE}{
                priceMode === 'retail'
                  ? (result.predictions[result.predictions.length - 1].predicted_retail_price?.toFixed(2) || (result.predictions[result.predictions.length - 1].predicted_price * 1.3).toFixed(2))
                  : result.predictions[result.predictions.length - 1].predicted_price.toFixed(2)
              }<span className="text-sm font-normal text-blue-400/70">/kg</span></div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Market Trend</p>
              <div className="flex items-center gap-2">
                {result.trend === 'INCREASING' && <TrendingUp className="h-6 w-6 text-green-500" />}
                {result.trend === 'DECREASING' && <TrendingDown className="h-6 w-6 text-red-500" />}
                {result.trend === 'STABLE' && <Minus className="h-6 w-6 text-slate-400" />}
                <span className={`text-xl font-bold ${
                  result.trend === 'INCREASING' ? 'text-green-600 dark:text-green-400' : 
                  result.trend === 'DECREASING' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {result.trend.charAt(0) + result.trend.slice(1).toLowerCase()}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Data Age</p>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {result.data_age_days === 0 ? "Today" : `${result.data_age_days} Days`}
              </div>
            </div>
          </div>

          {/* Predicted Price Forecast Chart - ONLY future data */}
          <div className="p-6 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-6">{forecastDays}-Day Price Forecast</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  domain={[minPrice, maxPrice]}
                  stroke="#64748b" 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${RUPEE}${val}`}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#f8fafc' }}
                  itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                  formatter={(value: number) => [`${RUPEE}${value.toFixed(2)}`, 'Price']}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#60a5fa' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Historical Price Table */}
          {historyTableData.length > 0 && (
            <div className="p-6 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">Previous 10-Day Market History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Wholesale (per kg)</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Est. Retail (per kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyTableData.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">{row.date}</td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-white font-semibold">{RUPEE}{row.wholesale.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{RUPEE}{row.retail.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Model Info */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
              <span>Forecast based on historical market patterns.</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 opacity-80">
              <span><strong>Data Source:</strong> {(result.data_source || 'DATABASE_CACHE').replace('_', ' ')}</span>
              <span><strong>Data As Of:</strong> {new Date(result.data_as_of).toLocaleDateString()}</span>
              <span><strong>Model:</strong> XGBoost v{result.model_version}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
