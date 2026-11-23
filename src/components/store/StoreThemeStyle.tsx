import type { PublicSettings } from "@/lib/catalog.functions";
import { dynamicStoreThemeCss } from "@/lib/store-theme";

export function StoreThemeStyle({ settings }: { settings: Pick<PublicSettings, "button_color" | "store_theme"> }) {
  return <style dangerouslySetInnerHTML={{ __html: dynamicStoreThemeCss(settings) }} />;
}
