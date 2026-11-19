import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type P = { lat: number; lng: number };

export default function LiveMapInner({ courier, destination }: { courier: P | null; destination: P | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true }).setView([-23.55, -46.63], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map.current);
    layers.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layers.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    if (destination) {
      L.circleMarker([destination.lat, destination.lng], { radius: 8, color: "#22c55e", fillOpacity: 0.9 }).bindTooltip("Destino").addTo(g);
      pts.push([destination.lat, destination.lng]);
    }
    if (courier) {
      L.marker([courier.lat, courier.lng], {
        icon: L.divIcon({ className: "", html: '<div style="font-size:28px;line-height:28px">🛵</div>', iconSize: [28, 28], iconAnchor: [14, 14] }),
      }).bindTooltip("Motoboy").addTo(g);
      pts.push([courier.lat, courier.lng]);
    }
    if (pts.length === 1) m.setView(pts[0]!, 15);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
  }, [courier?.lat, courier?.lng, destination?.lat, destination?.lng]);

  return <div ref={el} className="h-64 w-full overflow-hidden rounded-xl" />;
}
