export const DEFAULT_BUTTON_COLOR = "38 92% 50%";

export function normalizeButtonColor(value: string | null | undefined) {
  const match = value?.trim().match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
  if (!match) return DEFAULT_BUTTON_COLOR;
  const h = Number(match[1]);
  const s = Number(match[2]);
  const l = Number(match[3]);
  if (h > 360 || s > 100 || l > 100) return DEFAULT_BUTTON_COLOR;
  return `${h} ${s}% ${l}%`;
}

function hslRgb(h: number, s: number, l: number) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const rgb = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return rgb.map((v) => v + m) as [number, number, number];
}

/** Escolhe a cor com maior contraste WCAG sobre o botão. */
export function buttonForeground(value: string | null | undefined) {
  const [h, s, l] = normalizeButtonColor(value).match(/\d+/g)!.map(Number) as [number, number, number];
  const channels = hslRgb(h, s, l).map((v) => {
    const c = v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    return c;
  });
  const luminance = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  const dark = "hsl(222 47% 11%)";
  const light = "hsl(0 0% 100%)";
  const darkLum = 0.0126;
  const contrastDark = (luminance + 0.05) / (darkLum + 0.05);
  const contrastLight = 1.05 / (luminance + 0.05);
  return contrastDark >= contrastLight ? dark : light;
}

export type StoreAppearance = {
  button_color: string;
  store_theme: "dark" | "light";
};

export function dynamicStoreThemeCss(settings: StoreAppearance) {
  const color = normalizeButtonColor(settings.button_color);
  const foreground = buttonForeground(color);
  const light = settings.store_theme === "light";
  const variables = [
    `--store-primary:hsl(${color})`,
    `--primary-foreground:${foreground}`,
    `--sidebar-primary-foreground:${foreground}`,
    light ? "--store-bg:#F3F4F6" : "",
    light ? "--store-card-bg:#E5E7EB" : "",
    light ? "--foreground:hsl(222 47% 11%)" : "",
    light ? "--muted-foreground:hsl(215 16% 35%)" : "",
    light ? "--border:hsl(220 13% 72%)" : "",
    light ? "--input:hsl(220 13% 65%)" : "",
    light ? "--shadow-card:0 10px 30px -15px hsl(222 47% 11% / 25%)" : "",
  ].filter(Boolean);
  return `:root{${variables.join(";")}}`;
}
