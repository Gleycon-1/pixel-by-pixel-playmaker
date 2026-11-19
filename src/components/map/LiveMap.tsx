import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const Inner = lazy(() => import("./LiveMapInner"));
type P = { lat: number; lng: number };

/** Mapa ao vivo do motoboy (só usado quando o rastreio GPS do pedido está ligado). */
export function LiveMap({ courier, destination, updatedAt }: { courier: P | null; destination: P | null; updatedAt?: string | null }) {
  const fallback = <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />;
  return (
    <div className="space-y-1">
      <ClientOnly fallback={fallback}>
        <Suspense fallback={fallback}>
          <Inner courier={courier} destination={destination} />
        </Suspense>
      </ClientOnly>
      <p className="text-xs text-muted-foreground">
        {courier
          ? `📍 Posição do motoboy atualizada às ${updatedAt ? new Date(updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--"}`
          : "Aguardando o motoboy abrir o link e liberar a localização…"}
      </p>
    </div>
  );
}

export function orderMapPoints(o: { courier_lat: number | null; courier_lng: number | null; address: { lat?: number | null; lng?: number | null } | null }) {
  return {
    courier: o.courier_lat != null && o.courier_lng != null ? { lat: o.courier_lat, lng: o.courier_lng } : null,
    destination: o.address?.lat != null && o.address?.lng != null ? { lat: o.address.lat, lng: o.address.lng } : null,
  };
}
