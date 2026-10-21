import { useState } from "react"
import {
  MapPin,
  Navigation,
  ExternalLink,
  X,
  Truck,
  Store,
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <Card className="max-w-4xl w-full rounded-3xl border border-emerald-200 bg-white text-slate-900 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-emerald-200 flex items-start justify-between bg-emerald-50/80">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
                <Navigation className="h-4 w-4" />
              </span>
              <h3 className="text-lg font-bold text-emerald-950">Delivery Route & Navigation Map</h3>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-300 font-semibold">
                Batch: {request.batch_number}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Live turn-by-turn navigation for <strong className="text-slate-900">{request.product_name} ({request.quantity} {request.unit || "kg"})</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Route Waypoints Bar */}
        <div className="p-4 bg-slate-50 border-b border-emerald-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Card */}
          <div
            onClick={() => setActiveView("source")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeView === "source"
                ? "bg-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/20"
                : "bg-white/70 border-slate-200 hover:border-emerald-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-emerald-700 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                Point A • Pickup Facility (Source)
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Origin Depot</span>
            </div>
            <div className="font-bold text-sm text-slate-900">{sourceName}</div>
            <div className="text-xs text-slate-600 mt-1 flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{sourceAddress}</span>
            </div>
          </div>

          {/* Destination Card */}
          <div
            onClick={() => setActiveView("destination")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeView === "destination"
                ? "bg-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/20"
                : "bg-white/70 border-slate-200 hover:border-emerald-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-emerald-700 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                <Store className="h-3 w-3 text-emerald-600" />
                Point B • Retail Delivery Store (Destination)
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Final Store Dock</span>
            </div>
            <div className="font-bold text-sm text-slate-900">{destName}</div>
            <div className="text-xs text-slate-600 mt-1 flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{destAddress}</span>
            </div>
          </div>
        </div>

        {/* Live Trip Status Strip */}
        <div className="px-5 py-2.5 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between text-xs flex-wrap gap-3">
          <div className="flex items-center gap-4 text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <Compass className="h-3.5 w-3.5 text-emerald-600" />
              Distance: <strong className="text-slate-900">16.4 km</strong>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              Est. Transit: <strong className="text-slate-900">35 mins</strong>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Truck className="h-3.5 w-3.5 text-emerald-600" />
              Transit Mode: <strong className="text-emerald-700 font-semibold">Direct Dispatch</strong>
            </span>
          </div>

          {/* Toggle buttons */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-200">
            <button
              onClick={() => setActiveView("source")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === "source"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-emerald-700"
              }`}
            >
              Pickup Map
            </button>
            <button
              onClick={() => setActiveView("destination")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === "destination"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-emerald-700"
              }`}
            >
              Retailer Map
            </button>
          </div>
        </div>

        {/* Embedded Interactive Map Container */}
        <div className="relative w-full h-80 sm:h-96 bg-slate-100 border-b border-emerald-200">
          <iframe
            title="Logistics Navigation Map"
            src={mapEmbedUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
          />
          {/* Map Overlay Badge */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md border border-emerald-200 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2 shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span className="text-slate-700">
              Pinpointed: <strong className="text-slate-900">{activeView === "source" ? sourceName : destName}</strong>
            </span>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div className="p-4 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
            <Truck className="h-4 w-4 text-emerald-600" />
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
                className="w-full rounded-xl border-emerald-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Navigation className="h-3.5 w-3.5 text-emerald-600" />
                GPS to Pickup
                <ExternalLink className="h-3 w-3 text-slate-400" />
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
                className="w-full rounded-xl border-emerald-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Store className="h-3.5 w-3.5 text-emerald-600" />
                GPS to Store
                <ExternalLink className="h-3 w-3 text-slate-400" />
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
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 text-xs shadow-sm cursor-pointer"
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
