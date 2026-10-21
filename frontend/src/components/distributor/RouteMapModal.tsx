import { useState } from "react"
import {
  MapPin,
  Navigation,
  ExternalLink,
  X,
  Truck,
  Store,
  Thermometer,
  Clock,
  Compass,
  ArrowRight
} from "lucide-react"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { getGoogleMapsDestinationUrl, getGoogleMapsRouteUrl } from "../../utils"

interface RouteMapModalProps {
  isOpen: boolean
  onClose: () => void
  request: any
}

export function RouteMapModal({ isOpen, onClose, request }: RouteMapModalProps) {
  const [activeView, setActiveView] = useState<"destination" | "source" | "route">("destination")

  if (!isOpen || !request) return null

  const sourceName = request.processor?.facility_name || "Processor Facility"
  const sourceAddress = request.processor?.facility_location || request.processor?.facility_name || "Agro-Processing Unit #4, Yeshwanthpur Industrial Suburb, APMC Yard, Bengaluru 560022"
  
  const destName = request.retailer?.destination_store || "Retail Store"
  const destAddress = request.retailer?.store_location || request.retailer?.destination_store || "Metro Fresh Supermarket, 80 Feet Main Road, 4th Block, Koramangala, Bengaluru 560034"

  const activeLocation = activeView === "source" ? sourceAddress : destAddress
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(activeLocation)}&t=&z=14&ie=UTF8&iwloc=&output=embed`

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <Card className="max-w-4xl w-full rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-900/60">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Navigation className="h-4 w-4" />
              </span>
              <h3 className="text-lg font-bold text-white">Cold-Chain Route & Navigation Map</h3>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                {request.batch_number}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Live turn-by-turn navigation for <strong className="text-white">{request.product_name} ({request.quantity} {request.unit || "kg"})</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Route Waypoints Bar */}
        <div className="p-4 bg-zinc-900/40 border-b border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Card */}
          <div
            onClick={() => setActiveView("source")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeView === "source"
                ? "bg-emerald-500/10 border-emerald-500/50 shadow-sm"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Point A • Pickup Facility (Source)
              </span>
              <span className="text-[10px] text-zinc-500">Origin Depot</span>
            </div>
            <div className="font-bold text-sm text-white">{sourceName}</div>
            <div className="text-xs text-zinc-400 mt-1 flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{sourceAddress}</span>
            </div>
          </div>

          {/* Destination Card */}
          <div
            onClick={() => setActiveView("destination")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeView === "destination"
                ? "bg-blue-500/10 border-blue-500/50 shadow-sm"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-blue-400 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                <Store className="h-3 w-3" />
                Point B • Retail Delivery Store (Destination)
              </span>
              <span className="text-[10px] text-zinc-500">Final Store Dock</span>
            </div>
            <div className="font-bold text-sm text-white">{destName}</div>
            <div className="text-xs text-zinc-400 mt-1 flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
              <span>{destAddress}</span>
            </div>
          </div>
        </div>

        {/* Live Trip Status Strip */}
        <div className="px-5 py-2.5 bg-black/40 border-b border-zinc-800 flex items-center justify-between text-xs flex-wrap gap-3">
          <div className="flex items-center gap-4 text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-emerald-400" />
              Distance: <strong className="text-white">16.4 km</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              Est. Transit: <strong className="text-white">35 mins</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Thermometer className="h-3.5 w-3.5 text-blue-400" />
              Cold SLA: <strong className="text-emerald-400">{request.cold_chain_sla?.temperature_control || "2°C to 6°C Chilled"}</strong>
            </span>
          </div>

          {/* Toggle buttons */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setActiveView("source")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeView === "source"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Pickup Map
            </button>
            <button
              onClick={() => setActiveView("destination")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeView === "destination"
                  ? "bg-blue-600 text-white shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Retailer Map
            </button>
          </div>
        </div>

        {/* Embedded Interactive Map Container */}
        <div className="relative w-full h-80 sm:h-96 bg-zinc-900 border-b border-zinc-800">
          <iframe
            title="Logistics Navigation Map"
            src={mapEmbedUrl}
            width="100%"
            height="100%"
            style={{ border: 0, filter: "invert(90%) hue-rotate(180deg)" }}
            loading="lazy"
            allowFullScreen
          />
          {/* Map Overlay Badge */}
          <div className="absolute top-3 left-3 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2 shadow-lg">
            <span className={`w-2.5 h-2.5 rounded-full ${activeView === "source" ? "bg-emerald-400" : "bg-blue-400"}`} />
            <span className="text-zinc-300">
              Pinpointed: <strong className="text-white">{activeView === "source" ? sourceName : destName}</strong>
            </span>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div className="p-4 bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-emerald-400" />
            <span>Launch native GPS driving directions:</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={getGoogleMapsDestinationUrl(sourceAddress)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none"
            >
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl border-zinc-700 bg-zinc-900 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1.5 text-xs"
              >
                <Navigation className="h-3.5 w-3.5 text-emerald-400" />
                GPS to Pickup
                <ExternalLink className="h-3 w-3 text-zinc-500" />
              </Button>
            </a>

            <a
              href={getGoogleMapsDestinationUrl(destAddress)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none"
            >
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl border-zinc-700 bg-zinc-900 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1.5 text-xs"
              >
                <Store className="h-3.5 w-3.5 text-blue-400" />
                GPS to Store
                <ExternalLink className="h-3 w-3 text-zinc-500" />
              </Button>
            </a>

            <a
              href={getGoogleMapsRouteUrl(sourceAddress, destAddress)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none"
            >
              <Button
                size="sm"
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 text-xs shadow-lg shadow-emerald-900/30"
              >
                Full Route Directions
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </Card>
    </div>
  )
}
