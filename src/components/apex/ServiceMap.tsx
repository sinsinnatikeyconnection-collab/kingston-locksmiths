import React, { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { ServiceRegion } from "@/lib/serviceAreas";

const LeafletMap = MapContainer as any;
const LeafletTiles = TileLayer as any;
const LeafletMarker = CircleMarker as any;
const LeafletTooltip = Tooltip as any;
const LeafletPopup = Popup as any;

export interface FocusTarget {
  lat: number;
  lng: number;
  zoom: number;
  nonce: number;
}

// Imperative flyTo driven by a parent-supplied focus target (nonce changes
// re-trigger even when coords are identical).
function FlyController({ target }: { target: FocusTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.nonce]);
  return null;
}

export default function ServiceMap({ regions, focusTarget }: { regions: ServiceRegion[]; focusTarget: FocusTarget | null }) {
  return (
    <LeafletMap
      center={[39.25, -84.45]}
      zoom={9}
      scrollWheelZoom={false}
      className="w-full h-[380px] sm:h-[460px] bg-titanium border border-cyan/20"
      style={{ zIndex: 0 }}
    >
      <LeafletTiles
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={18}
      />

      {/* Region hubs */}
      {regions.map((reg) => (
        <LeafletMarker
          key={"hub-" + reg.name}
          center={reg.center}
          radius={11}
          pathOptions={{ color: "#FF3E00", weight: 2, fillColor: "#FF3E00", fillOpacity: 0.3 }}
        >
          <LeafletTooltip sticky>{reg.name} — dispatch hub</LeafletTooltip>
        </LeafletMarker>
      ))}

      {/* City coverage pins */}
      {regions.flatMap((reg) =>
        reg.cities.map((c) => (
          <LeafletMarker
            key={reg.name + c.name}
            center={[c.lat, c.lng]}
            radius={5.5}
            pathOptions={{ color: "#00E5FF", weight: 1.5, fillColor: "#00E5FF", fillOpacity: 0.55 }}
          >
            <LeafletPopup>
              <div className="font-mono leading-tight">
                <div className="text-[11px] uppercase text-cyan">{c.name}</div>
                <div className="text-[10px] text-muted-foreground">{reg.name}</div>
                <div className="text-[9px] text-data/70 mt-1">Mobile + shop service available.</div>
              </div>
            </LeafletPopup>
          </LeafletMarker>
        ))
      )}

      <FlyController target={focusTarget} />
    </LeafletMap>
  );
}