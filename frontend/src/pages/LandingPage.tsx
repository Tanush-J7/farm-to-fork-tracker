import { Link } from "react-router-dom"
import { Button } from "../components/ui/Button"
import {
  Leaf, ShieldCheck, ArrowRight, QrCode,
  Brain, Users, Package, Truck, Factory, Store
} from "lucide-react"

export function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="w-full min-h-[calc(100vh-5rem)] flex items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent -z-10" />
        <div className="container px-4 md:px-6 mx-auto flex flex-col items-center justify-center">
          <div className="flex flex-col items-center space-y-8 text-center">
            <div className="space-y-4 max-w-4xl">
              <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
                Track Every Food Product from <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">Farm to Fork</span>
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-2xl/relaxed">
                Ensure complete transparency, food safety, authenticity, and trust throughout the agricultural supply chain using Blockchain and AI.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
              <Link to="/register">
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full text-white bg-primary hover:bg-primary/95">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-20 md:py-32 bg-white/40 dark:bg-black/40 border-y">
        <div className="container px-4 md:px-6 mx-auto">
          <div id="features" className="scroll-mt-24 text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto md:text-lg">Powered by modern web technologies, immutable smart contracts, and predictive machine learning.</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Brain,
                title: "AI-Powered Insights",
                description: "Quality, disease, shelf-life, price, demand, and fraud predictions using advanced machine learning models.",
                color: "text-blue-500",
                bg: "bg-blue-500/10"
              },
              {
                icon: ShieldCheck,
                title: "Blockchain Traceability",
                description: "Every step is recorded on the Ethereum blockchain, ensuring secure product and ownership history.",
                color: "text-emerald-500",
                bg: "bg-emerald-500/10"
              },
              {
                icon: Users,
                title: "Role-Based Access",
                description: "Custom dashboards and verification pipelines tailored for Farmer, Processor, Distributor, Retailer, and Consumer.",
                color: "text-indigo-500",
                bg: "bg-indigo-500/10"
              },
              {
                icon: Package,
                title: "Product & Batch Management",
                description: "Effortlessly register crops, record harvest weights, and manage processing batches securely.",
                color: "text-amber-500",
                bg: "bg-amber-500/10"
              },
              {
                icon: Truck,
                title: "Supply Chain Tracking",
                description: "Monitor product status transitions, transit routes, temperatures, and ownership transfers.",
                color: "text-purple-500",
                bg: "bg-purple-500/10"
              },
              {
                icon: QrCode,
                title: "QR-Based Product Tracking",
                description: "End consumers can scan QR codes to instantly view the complete farm-to-fork journey.",
                color: "text-pink-500",
                bg: "bg-pink-500/10"
              }
            ].map((f, i) => (
              <div key={i} className="flex flex-col items-center space-y-4 text-center p-8 rounded-3xl border bg-card/50 glass-card">
                <div className={`p-4 ${f.bg} rounded-2xl`}>
                  <f.icon className={`h-10 w-10 ${f.color}`} />
                </div>
                <h3 className="text-xl font-bold">{f.title}</h3>
                <p className="text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="w-full py-20 md:py-32 bg-slate-50 dark:bg-zinc-950 border-b">
        <div className="container px-4 md:px-6 mx-auto">
          <div id="how-it-works" className="scroll-mt-24 text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">How it Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto md:text-lg">Follow the step-by-step blockchain verification process from harvest to plate.</p>
          </div>

          {/* Visual flow indicators */}
          <div className="flex items-center justify-center gap-4 md:gap-8 text-3xl md:text-5xl py-6 mb-12 text-slate-400 bg-white/40 dark:bg-black/40 border border-dashed rounded-2xl max-w-2xl mx-auto">
            <span title="Farmer" className="hover:text-primary transition-colors cursor-default">🌱</span>
            <span>→</span>
            <span title="Processor" className="hover:text-blue-400 transition-colors cursor-default">🏭</span>
            <span>→</span>
            <span title="Distributor" className="hover:text-amber-400 transition-colors cursor-default">🚚</span>
            <span>→</span>
            <span title="Retailer" className="hover:text-purple-400 transition-colors cursor-default">🏪</span>
            <span>→</span>
            <span title="Consumer" className="hover:text-pink-400 transition-colors cursor-default">👤</span>
          </div>

          <div className="grid gap-8 md:grid-cols-5">
            {[
              {
                step: 1,
                role: "Farmer",
                icon: Leaf,
                desc: "Product registration is created and secured with AI quality analysis.",
                color: "text-green-500",
                bg: "bg-green-500/10"
              },
              {
                step: 2,
                role: "Processor",
                icon: Factory,
                desc: "Receives the batch, accepts/rejects, and processes the raw ingredients.",
                color: "text-blue-500",
                bg: "bg-blue-500/10"
              },
              {
                step: 3,
                role: "Distributor",
                icon: Truck,
                desc: "Manages shipment logistics and secures custody transfers during transit.",
                color: "text-amber-500",
                bg: "bg-amber-500/10"
              },
              {
                step: 4,
                role: "Retailer",
                icon: Store,
                desc: "Receives the product, manages shelf inventory, and offers item for sale.",
                color: "text-purple-500",
                bg: "bg-purple-500/10"
              },
              {
                step: 5,
                role: "Consumer",
                icon: Users,
                desc: "Scans QR code in-store to view the complete journey and verify authenticity.",
                color: "text-pink-500",
                bg: "bg-pink-500/10"
              }
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center space-y-3 text-center p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 relative">
                <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 font-bold flex items-center justify-center text-xs">
                  {s.step}
                </div>
                <div className={`p-3 ${s.bg} rounded-xl mt-2`}>
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
                <h3 className="font-semibold text-lg">{s.role}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="w-full py-20 md:py-32 bg-white/40 dark:bg-black/40 border-b">
        <div className="container px-4 md:px-6 mx-auto">
          <div id="technology" className="scroll-mt-24 text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4 flex items-center justify-center gap-3">
              <span>💻</span> Technology
            </h2>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            <blockquote className="p-6 rounded-2xl bg-emerald-500/10 border-l-4 border-emerald-500 text-foreground text-base md:text-lg leading-relaxed">
              FarmChainAI combines <strong>Blockchain, Artificial Intelligence, and modern web technologies</strong> to create a secure and intelligent farm-to-fork tracking platform.
            </blockquote>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="p-6 rounded-3xl border bg-card/50 glass-card space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⛓️</span>
                  <h3 className="text-lg font-bold text-foreground">Blockchain</h3>
                </div>
                <p className="text-muted-foreground text-sm">Secure and tamper-resistant supply-chain records.</p>
              </div>

              <div className="p-6 rounded-3xl border bg-card/50 glass-card space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🤖</span>
                  <h3 className="text-lg font-bold text-foreground">Artificial Intelligence</h3>
                </div>
                <p className="text-muted-foreground text-sm">Smart insights for quality, disease, shelf-life, price, demand, and fraud.</p>
              </div>

              <div className="p-6 rounded-3xl border bg-card/50 glass-card space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚛️</span>
                  <h3 className="text-lg font-bold text-foreground">React</h3>
                </div>
                <p className="text-muted-foreground text-sm">A modern and responsive user interface.</p>
              </div>

              <div className="p-6 rounded-3xl border bg-card/50 glass-card space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🟢</span>
                  <h3 className="text-lg font-bold text-foreground">Node.js</h3>
                </div>
                <p className="text-muted-foreground text-sm">Reliable backend services and API management.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section className="w-full py-20 md:py-32 bg-slate-50 dark:bg-zinc-950 border-b">
        <div className="container px-4 md:px-6 mx-auto">
          <div id="about-us" className="scroll-mt-24 text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4 flex items-center justify-center gap-3">
              <span>👥</span> About Us
            </h2>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            <blockquote className="p-6 rounded-2xl bg-primary/10 border-l-4 border-primary text-foreground text-base md:text-lg leading-relaxed">
              FarmChainAI is a blockchain-based platform that brings <strong>transparency, traceability, and trust</strong> to the agricultural supply chain — from <strong>farm to fork</strong>.
            </blockquote>

            <div className="grid gap-6 sm:grid-cols-3">
              <div className="p-6 rounded-3xl border bg-card/50 glass-card space-y-2 text-center flex flex-col items-center">
                <span className="text-3xl mb-2">🌱</span>
                <h3 className="text-lg font-bold text-foreground">Transparency</h3>
                <p className="text-muted-foreground text-sm">Clear visibility across the agricultural supply chain.</p>
              </div>

              <div className="p-6 rounded-3xl border bg-card/50 glass-card space-y-2 text-center flex flex-col items-center">
                <span className="text-3xl mb-2">🔗</span>
                <h3 className="text-lg font-bold text-foreground">Traceability</h3>
                <p className="text-muted-foreground text-sm">Follow products from their origin to the consumer.</p>
              </div>

              <div className="p-6 rounded-3xl border bg-card/50 glass-card space-y-2 text-center flex flex-col items-center">
                <span className="text-3xl mb-2">🛡️</span>
                <h3 className="text-lg font-bold text-foreground">Trust</h3>
                <p className="text-muted-foreground text-sm">Secure and reliable supply-chain records.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </>
  )
}
