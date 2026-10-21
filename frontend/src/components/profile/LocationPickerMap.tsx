import React, { useEffect, useRef, useState } from "react"
import L from "leaflet"
import { Locate, Search, MapPin, CheckCircle2, Loader2, ExternalLink, HelpCircle, Navigation } from "lucide-react"
import { Button } from "../ui/Button"

interface LocationPickerMapProps {
  lat: number
  lng: number
  onLocationChange: (newLocation: {
    lat: number
    lng: number
    address: string
    city?: string
    state?: string
    pincode?: string
    accuracy?: number
  }) => void
}

export function LocationPickerMap({
  lat,
  lng,
  onLocationChange
}: LocationPickerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)

  const [locating, setLocating] = useState(false)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Custom SVG Pin Icon for Leaflet
  const createPinIcon = () => {
    return L.divIcon({
      className: "custom-leaflet-marker",
      html: `
        <div style="position: relative; width: 38px; height: 48px; transform: translate(-50%, -100%);">
          <svg viewBox="0 0 24 32" width="38" height="48" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 8.5 12 20 12 20s12-11.5 12-20c0-6.627-5.373-12-12-12z" fill="#10b981"/>
            <circle cx="12" cy="11" r="5" fill="#ffffff"/>
            <circle cx="12" cy="11" r="2.5" fill="#047857"/>
          </svg>
          <div style="
            position: absolute;
            top: -24px;
            left: 50%;
            transform: translateX(-50%);
            background: #064e3b;
            color: #ffffff;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 9999px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            pointer-events: none;
          ">
            Delivery Dock
          </div>
        </div>
      `,
      iconSize: [38, 48],
      iconAnchor: [19, 48]
    })
  }

  // Reverse Geocoding helper
  const reverseGeocode = async (latitude: number, longitude: number, acc?: number) => {
    try {
      setStatusMessage("Fetching address details for pinned coordinates...")
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      )
      const data = await res.json()

      let cleanAddress = ""
      let city = ""
      let state = ""
      let pincode = ""

      if (data && data.address) {
        const addr = data.address
        // Form a clean, well-structured facility address
        const parts = [
          addr.building || addr.amenity || addr.shop || addr.house_number || "",
          addr.road || addr.street || addr.pedestrian || "",
          addr.neighbourhood || addr.suburb || addr.residential || "",
          addr.city_district || addr.subdistrict || "",
          addr.city || addr.town || addr.village || addr.county || "",
          addr.state || "",
          addr.postcode || ""
        ].filter(Boolean)

        cleanAddress = parts.join(", ") || data.display_name || `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
        city = addr.city || addr.town || addr.village || addr.county || "Bengaluru"
        state = addr.state || "Karnataka"
        pincode = addr.postcode || ""
      } else {
        cleanAddress = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
      }

      onLocationChange({
        lat: latitude,
        lng: longitude,
        address: cleanAddress,
        city,
        state,
        pincode,
        accuracy: acc
      })

      setStatusMessage(null)
    } catch {
      setStatusMessage(null)
      onLocationChange({
        lat: latitude,
        lng: longitude,
        address: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`,
        accuracy: acc
      })
    }
  }

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapInstanceRef.current) return

    const initialLat = lat || 13.0285
    const initialLng = lng || 77.5456

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: true,
      scrollWheelZoom: true
    })

    // OpenStreetMap high-contrast tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map)

    const marker = L.marker([initialLat, initialLng], {
      icon: createPinIcon(),
      draggable: true,
      autoPan: true
    }).addTo(map)

    // Handle pin drag
    marker.on("dragend", () => {
      const pos = marker.getLatLng()
      if (circleRef.current) {
        circleRef.current.setLatLng(pos)
      }
      reverseGeocode(pos.lat, pos.lng)
    })

    // Handle map click
    map.on("click", (e) => {
      marker.setLatLng(e.latlng)
      if (circleRef.current) {
        circleRef.current.setLatLng(e.latlng)
      }
      reverseGeocode(e.latlng.lat, e.latlng.lng)
    })

    mapInstanceRef.current = map
    markerRef.current = marker

    // Invalidate size to ensure proper initial rendering
    setTimeout(() => {
      map.invalidateSize()
    }, 250)

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Keep marker in sync when external lat/lng changes
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      const cur = markerRef.current.getLatLng()
      if (Math.abs(cur.lat - lat) > 0.0001 || Math.abs(cur.lng - lng) > 0.0001) {
        markerRef.current.setLatLng([lat, lng])
        mapInstanceRef.current.panTo([lat, lng])
      }
    }
  }, [lat, lng])

  // Real-time GPS Detection with MAXIMUM ACCURACY & NO CACHE
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.")
      return
    }

    setLocating(true)
    setStatusMessage("Acquiring high-precision hardware GPS coordinates...")

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const currentLat = pos.coords.latitude
        const currentLng = pos.coords.longitude
        const acc = Math.round(pos.coords.accuracy)

        setAccuracy(acc)
        setLocating(false)

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([currentLat, currentLng], 17, { animate: true })
          markerRef.current.setLatLng([currentLat, currentLng])

          // Draw accuracy circle
          if (circleRef.current) {
            circleRef.current.setLatLng([currentLat, currentLng])
            circleRef.current.setRadius(acc)
          } else {
            circleRef.current = L.circle([currentLat, currentLng], {
              radius: acc,
              color: "#10b981",
              fillColor: "#10b981",
              fillOpacity: 0.12,
              weight: 1.5
            }).addTo(mapInstanceRef.current)
          }
        }

        reverseGeocode(currentLat, currentLng, acc)
      },
      (err) => {
        console.warn("GPS error:", err)
        setLocating(false)
        setStatusMessage("Could not retrieve hardware GPS. Drag the map marker or search your address below.")
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0, // CRITICAL: bypass stale cached IP/Wi-Fi locations!
        timeout: 15000
      }
    )
  }

  // Address Search on Map
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setSearching(true)
    setSearchResults([])
    setStatusMessage("Searching address and landmark database...")

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5&addressdetails=1`
      )
      const data = await res.json()

      if (data && data.length > 0) {
        setSearchResults(data)
        setStatusMessage(null)
      } else {
        setStatusMessage("No matching places found. Try entering a nearby road or landmark.")
      }
    } catch {
      setStatusMessage("Search service temporarily busy. You can directly click on the map.")
    } finally {
      setSearching(false)
    }
  }

  const handleSelectSearchResult = (result: any) => {
    const newLat = parseFloat(result.lat)
    const newLng = parseFloat(result.lon)

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([newLat, newLng], 17, { animate: true })
      markerRef.current.setLatLng([newLat, newLng])
      if (circleRef.current) {
        circleRef.current.setLatLng([newLat, newLng])
        circleRef.current.setRadius(25)
      }
    }

    setSearchResults([])
    setSearchQuery("")
    reverseGeocode(newLat, newLng, 20)
  }

  return (
    <div className="space-y-3 bg-white rounded-2xl border border-emerald-200/90 p-4 shadow-sm">
      {/* Header controls: Search & GPS button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search road, landmark, building, or area name..."
            className="w-full pl-9 pr-20 py-2 text-xs rounded-xl border border-emerald-200 bg-white text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            disabled={searching}
            className="absolute right-1.5 top-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            {searching ? "Searching..." : "Find"}
          </button>
        </form>

        <Button
          type="button"
          onClick={handleDetectGPS}
          disabled={locating}
          className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm"
        >
          {locating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Locking Real-time GPS...
            </>
          ) : (
            <>
              <Locate className="h-3.5 w-3.5" />
              Detect My Exact GPS
            </>
          )}
        </Button>
      </div>

      {/* Search dropdown results */}
      {searchResults.length > 0 && (
        <div className="p-2 rounded-xl bg-white border border-emerald-300 shadow-lg space-y-1 z-30 max-h-48 overflow-y-auto">
          <span className="text-[10px] font-bold uppercase text-emerald-800 px-2 block">
            Select Matching Location:
          </span>
          {searchResults.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSearchResult(item)}
              className="w-full text-left p-2 rounded-lg hover:bg-emerald-50 text-xs text-emerald-950 transition-colors flex items-start gap-2"
            >
              <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{item.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Interactive Map Box */}
      <div className="relative w-full h-72 sm:h-80 rounded-xl overflow-hidden border border-emerald-200 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Live Pin Instruction Overlay */}
        <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-md border border-emerald-300 rounded-xl px-3 py-1.5 text-xs text-emerald-950 font-semibold shadow-md flex items-center gap-2 z-[400] pointer-events-none">
          <Navigation className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
          <span>Drag the marker or click on the map to pinpoint your exact facility gate / doorstep</span>
        </div>

        {/* Accuracy badge */}
        {accuracy !== null && (
          <div className="absolute bottom-2.5 right-2.5 bg-white/95 backdrop-blur-md border border-emerald-200 rounded-xl px-2.5 py-1 text-[11px] text-emerald-900 font-medium shadow-md z-[400]">
            GPS Accuracy: ±{accuracy}m
          </div>
        )}
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Locked Coordinates Bar */}
      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold text-emerald-950">Precise Geolocation Coordinates Locked:</span>
            <span className="font-mono text-emerald-800 ml-2 font-semibold">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
          </div>
        </div>

        <a
          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline"
        >
          Verify Pin on Google Maps <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
