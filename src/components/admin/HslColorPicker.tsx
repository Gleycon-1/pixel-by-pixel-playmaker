import { Label } from "@/components/ui/label";
import { buttonForeground, normalizeButtonColor } from "@/lib/store-theme";

const shortcuts = [
  ["Âmbar", "38 92% 50%"],
  ["Verde", "145 65% 38%"],
  ["Azul", "215 85% 55%"],
  ["Vermelho", "0 75% 50%"],
  ["Claro", "210 20% 94%"],
  ["Preto", "0 0% 5%"],
] as const;

export function HslColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const color = normalizeButtonColor(value);
  const [h = 38, s = 92, l = 50] = color.match(/\d+/g)!.map(Number);
  const update = (next: { h?: number; s?: number; l?: number }) => onChange(`${next.h ?? h} ${next.s ?? s}% ${next.l ?? l}%`);

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-3">
        <span className="size-12 shrink-0 rounded-xl border border-border" style={{ backgroundColor: `hsl(${color})` }} aria-label="Cor selecionada" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Cor dos botões e destaques</p>
          <p className="text-xs text-muted-foreground">HSL {color} · o contraste do texto é automático.</p>
        </div>
        <button type="button" className="rounded-lg px-3 py-2 text-xs font-extrabold" style={{ backgroundColor: `hsl(${color})`, color: buttonForeground(color) }}>
          Exemplo
        </button>
      </div>
      <div>
        <Label htmlFor="button-hue">Matiz: {h}°</Label>
        <input
          id="button-hue"
          aria-label="Matiz da cor"
          type="range"
          min={0}
          max={360}
          value={h}
          onChange={(e) => update({ h: Number(e.target.value) })}
          className="mt-2 h-4 w-full cursor-pointer appearance-none rounded-full"
          style={{ background: "linear-gradient(to right, hsl(0 90% 50%), hsl(60 90% 50%), hsl(120 90% 50%), hsl(180 90% 50%), hsl(240 90% 50%), hsl(300 90% 50%), hsl(360 90% 50%))" }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="button-saturation">Saturação: {s}%</Label>
          <input
            id="button-saturation"
            aria-label="Saturação da cor"
            type="range"
            min={0}
            max={100}
            value={s}
            onChange={(e) => update({ s: Number(e.target.value) })}
            className="mt-2 h-4 w-full cursor-pointer appearance-none rounded-full"
            style={{ background: `linear-gradient(to right, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))` }}
          />
        </div>
        <div>
          <Label htmlFor="button-lightness">Luminosidade: {l}%</Label>
          <input
            id="button-lightness"
            aria-label="Luminosidade da cor"
            type="range"
            min={0}
            max={100}
            value={l}
            onChange={(e) => update({ l: Number(e.target.value) })}
            className="mt-2 h-4 w-full cursor-pointer appearance-none rounded-full"
            style={{ background: `linear-gradient(to right, hsl(${h} ${s}% 0%), hsl(${h} ${s}% 50%), hsl(${h} ${s}% 100%))` }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {shortcuts.map(([label, shortcut]) => (
          <button
            key={label}
            type="button"
            aria-label={`Usar cor ${label}`}
            title={label}
            onClick={() => onChange(shortcut)}
            className="size-7 rounded-full border-2 border-background ring-1 ring-border transition-transform hover:scale-110"
            style={{ backgroundColor: `hsl(${shortcut})` }}
          />
        ))}
      </div>
    </div>
  );
}
