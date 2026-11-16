import { useQuery } from "@tanstack/react-query";
import { catalogQuery } from "@/lib/catalog.functions";
import { storeInfo, waLink } from "@/lib/store-info";
import { WhatsAppIcon } from "./icons";

export function FloatingWhatsApp() {
  const { data } = useQuery(catalogQuery);
  const info = storeInfo(data?.settings);
  return (
    <a
      href={waLink(info.whatsappNumber, `Olá, ${info.name}! Vim pelo app e gostaria de fazer um pedido.`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-card animate-pulse-ring transition-transform hover:scale-105 active:scale-95"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
