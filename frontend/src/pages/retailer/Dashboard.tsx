import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { LayoutDashboard, Package, TrendingUp, AlertTriangle, ShieldAlert, ShieldCheck, Store } from "lucide-react"
import { ProfileManagementSection } from "../../components/profile/ProfileManagementSection"
import { cn } from "../../utils"

const API_URL = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function Dashboard() {
  const { user, token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = (searchParams.get("tab") as "overview" | "profile") || "overview"
  const [activeTab, setActiveTab] = useState<"overview" | "profile">(tabParam === "profile" ? "profile" : "overview")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentTab = searchParams.get("tab")
    if (currentTab === "profile") {
      setActiveTab("profile")
    } else {
      setActiveTab("overview")
    }
  }, [searchParams])

  const handleTabChange = (tab: "overview" | "profile") => {
    setActiveTab(tab)
    if (tab === "overview") {
      setSearchParams({})
    } else {
      setSearchParams({ tab: "profile" })
    }
  }

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await axios.get(`${API_URL}/retailer/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setData(res.data.data)
      } catch (err) {
        console.error("Dashboard fetch error:", err)
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchDashboard()
  }, [token])

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            {activeTab === "profile" ? (
              <>
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
                Store Profile & Compliance
              </>
            ) : (
              <>
                <Store className="h-8 w-8 text-emerald-600" />
                Retailer Dashboard
              </>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeTab === "profile"
              ? "Manage verified store name, FSSAI trade license, pinned dock location, and contact details for distributor deliveries."
              : `Welcome back, ${user?.name || "Retailer"}. Here is your live store overview and operational metrics.`}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          <button
            onClick={() => handleTabChange("overview")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeTab === "overview"
                ? "bg-white text-emerald-700 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Store Overview
          </button>
          <button
            onClick={() => handleTabChange("profile")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeTab === "profile"
                ? "bg-white text-emerald-700 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Store Profile & Verification
          </button>
        </div>
      </div>

      {/* Profile Section */}
      {activeTab === "profile" && (
        <div className="animate-in fade-in duration-200">
          <ProfileManagementSection
            role="retailer"
            onProfileUpdated={(p) => {
              if (p?.address) {
                localStorage.setItem("retailer_address", p.address)
              }
              if (user?.email && p?.address) {
                try {
                  const map = JSON.parse(localStorage.getItem("registered_user_profiles") || "{}")
                  map[user.email.toLowerCase()] = {
                    ...(map[user.email.toLowerCase()] || {}),
                    address: p.address,
                    business_name: p.business_name,
                    phone: p.phone,
                    license_number: p.license_number,
                    coordinates: p.coordinates
                  }
                  localStorage.setItem("registered_user_profiles", JSON.stringify(map))
                } catch {}
              }
            }}
          />
        </div>
      )}

      {/* Overview Section */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {loading ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
              Loading dashboard metrics...
            </div>
          ) : (
            <>
              {data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Total Inventory */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Batches</p>
                        <h3 className="text-3xl font-black text-slate-900">{data.total_inventory_items}</h3>
                      </div>
                      <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <Package className="h-5 w-5 text-indigo-600" />
                      </div>
                    </div>
                  </div>

                  {/* Revenue */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Revenue</p>
                        <h3 className="text-3xl font-black text-emerald-600">${Number(data.total_revenue || 0).toFixed(2)}</h3>
                      </div>
                      <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-2">Across {data.total_sales || 0} recorded sales</p>
                  </div>

                  {/* Low Stock */}
                  <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Low Stock Alerts</p>
                        <h3 className="text-3xl font-black text-amber-700">{data.low_stock_alerts}</h3>
                      </div>
                      <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      </div>
                    </div>
                    <p className="text-xs font-medium text-amber-700 mt-2">Batches with quantity &lt; 10</p>
                  </div>

                  {/* Expired */}
                  <div className="bg-rose-50 p-6 rounded-2xl border border-rose-200 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Expired Items</p>
                        <h3 className="text-3xl font-black text-rose-700">{data.expired_alerts}</h3>
                      </div>
                      <div className="h-10 w-10 bg-rose-100 rounded-xl flex items-center justify-center">
                        <ShieldAlert className="h-5 w-5 text-rose-600" />
                      </div>
                    </div>
                    <p className="text-xs font-medium text-rose-700 mt-2">Requires immediate wastage review</p>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <a href="/retailer/receive" className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-4 text-center transition-colors">
                    <div className="font-bold text-slate-700 text-sm">Scan Delivery</div>
                  </a>
                  <a href="/retailer/sales" className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-4 text-center transition-colors">
                    <div className="font-bold text-slate-700 text-sm">Point of Sale</div>
                  </a>
                  <a href="/retailer/expiry" className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-4 text-center transition-colors">
                    <div className="font-bold text-slate-700 text-sm">Check Expiry</div>
                  </a>
                  <a href="/retailer/requests" className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-4 text-center transition-colors">
                    <div className="font-bold text-slate-700 text-sm">Order Stock</div>
                  </a>
                  <button
                    onClick={() => handleTabChange("profile")}
                    className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl p-4 text-center transition-colors cursor-pointer"
                  >
                    <div className="font-bold text-emerald-800 text-sm flex items-center justify-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Store Profile
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-0.5">Edit license & dock pin</div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
