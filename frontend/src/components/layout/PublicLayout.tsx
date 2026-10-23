import { Outlet, Link, useLocation } from "react-router-dom"
import { Leaf, QrCode } from "lucide-react"
import { Button } from "../ui/Button"

export function PublicLayout() {
  const location = useLocation()

  // Helper to determine if we should use hash directly or full path
  const getHomeHash = (hash: string) => {
    return location.pathname === "/" ? hash : `/${hash}`
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-zinc-950 text-foreground overflow-hidden">
      {/* Header */}
      <header className="px-6 lg:px-14 h-20 flex items-center justify-between border-b bg-white/50 dark:bg-black/50 backdrop-blur-md fixed top-0 w-full z-50">
        <Link className="flex items-center justify-center gap-2" to="/">
          <Leaf className="h-7 w-7 text-primary" />
          <span className="font-bold text-2xl tracking-tight">FarmChain<span className="text-primary">AI</span></span>
        </Link>
        <nav className="ml-auto hidden md:flex items-center gap-6 sm:gap-8 mr-8">
          <Link 
            className="text-sm font-medium hover:text-primary transition-colors" 
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Home
          </Link>
          <a 
            className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
            href={getHomeHash("#consumer-scanner")}
            onClick={(e) => {
              if (location.pathname === "/") {
                e.preventDefault()
                const el = document.getElementById("consumer-scanner")
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                window.dispatchEvent(new CustomEvent("start-consumer-scanner"))
              } else {
                window.sessionStorage.setItem("auto-start-scanner", "true")
              }
            }}
          >
            <QrCode className="w-3.5 h-3.5" />
            Scan Product QR
          </a>
          <a className="text-sm font-medium hover:text-primary transition-colors cursor-pointer" href={getHomeHash("#features")}>Features</a>
          <a className="text-sm font-medium hover:text-primary transition-colors cursor-pointer" href={getHomeHash("#how-it-works")}>How it Works</a>
          <a className="text-sm font-medium hover:text-primary transition-colors cursor-pointer" href={getHomeHash("#about-us")}>About Us</a>
        </nav>
        <div className="flex gap-4">
          <Link to="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link to="/register">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Main content slot */}
      <main className="flex-1 pt-20">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="w-full py-6 border-t px-6 flex flex-col md:flex-row items-center justify-between bg-white/50 dark:bg-black/50 backdrop-blur-md z-10">
        <p className="text-xs text-muted-foreground">© 2026 FarmChain AI. All rights reserved.</p>
        <nav className="flex gap-4 sm:gap-6 mt-4 md:mt-0">
          <Link className="text-xs hover:underline underline-offset-4" to="#">Terms of Service</Link>
          <Link className="text-xs hover:underline underline-offset-4" to="#">Privacy</Link>
        </nav>
      </footer>
    </div>
  )
}
