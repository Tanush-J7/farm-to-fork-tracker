import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Menu, Leaf, Factory, Truck, Store, ShieldCheck, User } from "lucide-react"
import { useAuth } from "../../context/AuthContext"

export function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user } = useAuth()

  const getRoleBadge = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "farmer":
        return { label: "Farmer", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: Leaf }
      case "processor":
        return { label: "Processor", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Factory }
      case "distributor":
        return { label: "Distributor", color: "bg-amber-100 text-amber-800 border-amber-300", icon: Truck }
      case "retailer":
        return { label: "Retailer", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: Store }
      case "admin":
        return { label: "Admin", color: "bg-rose-100 text-rose-800 border-rose-300", icon: ShieldCheck }
      default:
        return { label: "Consumer", color: "bg-slate-100 text-slate-800 border-slate-300", icon: User }
    }
  }

  const roleBadge = getRoleBadge(user?.role)
  const RoleIcon = roleBadge.icon

  return (
    <div className="flex h-screen overflow-hidden bg-[#fbfefc]">
      {/* Sidebar: Handles desktop fixed navigation and mobile slide-in drawer */}
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Mobile Header Bar (Visible on mobile only; hidden on desktop md:) */}
        <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-2xs shrink-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-extrabold text-base tracking-tight text-emerald-950 truncate">
                FarmChain <span className="text-emerald-600">AI</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleBadge.color}`}>
              <RoleIcon className="h-3 w-3" />
              {roleBadge.label}
            </span>
            {user?.photo ? (
              <img
                src={user.photo}
                alt={user.name}
                className="h-7 w-7 rounded-full object-cover border border-emerald-400"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-300">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Dashboard Viewport */}
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_#e8f8ef_0%,_#fbfefc_42%,_#ffffff_100%)] p-3 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
