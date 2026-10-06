import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#fbfefc]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_#e8f8ef_0%,_#fbfefc_42%,_#ffffff_100%)] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
