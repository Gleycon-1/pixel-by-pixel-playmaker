import { createFileRoute } from "@tanstack/react-router";
import { STORE_CONFIG, STORE_THEME } from "@/store.config";

/** Manifest do app instalável, gerado a partir da área white-label. */
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({
            name: STORE_CONFIG.storeName,
            short_name: STORE_CONFIG.storeName.slice(0, 24),
            description: STORE_CONFIG.tagline,
            start_url: "/",
            scope: "/",
            display: "standalone",
            orientation: "portrait",
            background_color: STORE_THEME["--store-bg"],
            theme_color: STORE_THEME["--store-bg"],
            lang: "pt-BR",
            icons: [
              { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
              { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
            ],
          }),
          { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
        ),
    },
  },
});
