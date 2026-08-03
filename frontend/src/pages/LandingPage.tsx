import { Link } from "react-router-dom"
import { Button } from "../components/ui/Button"
import { Leaf, ShieldCheck, ArrowRight, BarChart3, QrCode } from "lucide-react"

export function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-zinc-950 text-foreground overflow-hidden">
      {/* Header */}
      <header className="px-6 lg:px-14 h-20 flex items-center justify-between border-b bg-white/50 dark:bg-black/50 backdrop-blur-md fixed top-0 w-full z-50">
        <Link className="flex items-center justify-center gap-2" to="/">
          <Leaf className="h-7 w-7 text-primary" />
          <span className="font-bold text-2xl tracking-tight">FarmChain<span className="text-primary">AI</span></span>
        </Link>
        <nav className="ml-auto hidden md:flex gap-6 sm:gap-8 mr-8">
          <Link className="text-sm font-medium hover:text-primary transition-colors" to="#">Features</Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors" to="#">How it Works</Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors" to="/tracker">Track Product</Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors" to="#">Contact</Link>
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

      <main className="flex-1 pt-20">
        {/* Hero Section */}
        <section className="w-full py-20 md:py-32 lg:py-48 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent -z-10" />
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-8 text-center">
              <div className="space-y-4 max-w-4xl">
                <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
                  Track Every Food Product from <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">Farm to Fork</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-2xl/relaxed">
                  Ensure complete transparency, food safety, authenticity, and trust throughout the agricultural supply chain using Blockchain and AI.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Link to="/admin">
                  <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full">
                    Start Managing
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/tracker">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full glass">
                    Track a Product
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-20 md:py-32 bg-white/40 dark:bg-black/40 border-y">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">Enterprise-Grade Traceability</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto md:text-lg">Powered by modern web technologies, immutable smart contracts, and predictive machine learning.</p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center p-8 rounded-3xl border bg-card/50 glass-card">
                <div className="p-4 bg-primary/10 rounded-2xl">
                  <ShieldCheck className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Blockchain Verification</h3>
                <p className="text-muted-foreground">Every step is recorded on the Ethereum blockchain, ensuring data cannot be tampered with.</p>
              </div>
              
              <div className="flex flex-col items-center space-y-4 text-center p-8 rounded-3xl border bg-card/50 glass-card">
                <div className="p-4 bg-blue-500/10 rounded-2xl">
                  <BarChart3 className="h-10 w-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold">AI Predictions</h3>
                <p className="text-muted-foreground">Predict crop quality, disease likelihood, and shelf life using advanced machine learning models.</p>
              </div>
              
              <div className="flex flex-col items-center space-y-4 text-center p-8 rounded-3xl border bg-card/50 glass-card">
                <div className="p-4 bg-amber-500/10 rounded-2xl">
                  <QrCode className="h-10 w-10 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold">Consumer QR Tracking</h3>
                <p className="text-muted-foreground">End consumers can simply scan a QR code to view the complete journey of their food.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="w-full py-6 border-t px-6 flex flex-col md:flex-row items-center justify-between">
        <p className="text-xs text-muted-foreground">© 2026 FarmChain AI. All rights reserved.</p>
        <nav className="flex gap-4 sm:gap-6 mt-4 md:mt-0">
          <Link className="text-xs hover:underline underline-offset-4" to="#">Terms of Service</Link>
          <Link className="text-xs hover:underline underline-offset-4" to="#">Privacy</Link>
        </nav>
      </footer>
    </div>
  )
}
