import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Image, Moon, RotateCcw, Sun, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { adminCreateStoreUploadUrl } from "@/lib/admin.functions";
import { STORE_CONFIG } from "@/store.config";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "./use-admin";
import { HslColorPicker } from "./HslColorPicker";

export type IdentityValues = {
  logo_url: string | null;
  banner_url: string | null;
  banner_enabled: boolean;
  button_color: string;
  store_theme: "dark" | "light";
};

export function IdentitySettings({ values, onChange }: { values: IdentityValues; onChange: (patch: Partial<IdentityValues>) => void }) {
  const { token } = useAdmin();
  const createUpload = useServerFn(adminCreateStoreUploadUrl);
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<"logo" | "banner", string>>>({});
  const previewUrls = useRef<string[]>([]);

  const upload = async (kind: "logo" | "banner", file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 5 * 1024 * 1024) {
      toast.error("Use JPG, PNG ou WebP de até 5 MB.");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    previewUrls.current.push(localUrl);
    setPreviews((p) => ({ ...p, [kind]: localUrl }));
    setUploading(kind);
    try {
      const u = await createUpload({ data: { token, filename: file.name, kind } });
      const { error } = await supabase.storage.from("product-images").uploadToSignedUrl(u.path, u.uploadToken, file);
      if (error) throw error;
      onChange(kind === "logo" ? { logo_url: u.publicUrl } : { banner_url: u.publicUrl, banner_enabled: true });
      setPreviews((p) => ({ ...p, [kind]: undefined }));
      toast.success("Imagem enviada. Clique em Salvar configurações para publicar.");
    } catch {
      setPreviews((p) => ({ ...p, [kind]: undefined }));
      toast.error("Falha ao enviar a imagem.");
    } finally {
      setUploading(null);
    }
  };

  const imageField = (kind: "logo" | "banner") => {
    const isLogo = kind === "logo";
    const saved = isLogo ? values.logo_url : values.banner_url;
    const fallback = isLogo ? STORE_CONFIG.logoUrl : STORE_CONFIG.headerBannerUrl;
    const src = previews[kind] || saved || fallback;
    return (
      <div className="space-y-2 rounded-xl border border-border p-3">
        <Label>{isLogo ? "Logo da loja" : "Banner principal"}</Label>
        <div className={isLogo ? "flex h-24 items-center justify-center rounded-lg bg-muted/50 p-3" : "overflow-hidden rounded-lg bg-muted/50"}>
          <img src={src} alt={`Prévia ${isLogo ? "da logo" : "do banner"}`} className={isLogo ? "max-h-20 max-w-full object-contain" : "aspect-[2/1] w-full object-cover"} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild disabled={uploading !== null}>
            <label className="cursor-pointer">
              <Upload /> {uploading === kind ? "Enviando…" : saved ? "Trocar" : "Enviar"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(kind, file);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!saved && !previews[kind]}
            onClick={() => {
              setPreviews((p) => ({ ...p, [kind]: undefined }));
              onChange(isLogo ? { logo_url: null } : { banner_url: null, banner_enabled: true });
            }}
          >
            <RotateCcw /> Remover / restaurar padrão
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 5 MB.</p>
      </div>
    );
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 lg:col-span-2">
      <div className="flex items-center gap-2">
        <Sun className="size-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-extrabold">Identidade Visual da Loja</h2>
          <p className="text-xs text-muted-foreground">As mudanças aparecem na vitrine depois de salvar.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {imageField("logo")}
        {imageField("banner")}
      </div>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm font-semibold">
        <span className="flex items-center gap-2"><Image className="size-4" /> Exibir banner principal</span>
        <Switch checked={values.banner_enabled} onCheckedChange={(banner_enabled) => onChange({ banner_enabled })} />
      </label>
      <HslColorPicker value={values.button_color} onChange={(button_color) => onChange({ button_color })} />
      <fieldset>
        <legend className="mb-2 text-sm font-bold">Tema geral da loja</legend>
        <RadioGroup value={values.store_theme} onValueChange={(store_theme) => onChange({ store_theme: store_theme as "dark" | "light" })} className="grid-cols-2">
          <Label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 ${values.store_theme === "dark" ? "border-primary bg-primary/10" : "border-border"}`}>
            <RadioGroupItem value="dark" aria-label="Tema Padrão escuro" />
            <Moon className="size-4" />
            <span><b className="block text-sm">Padrão</b><span className="text-xs text-muted-foreground">Escuro Padrão</span></span>
          </Label>
          <Label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 ${values.store_theme === "light" ? "border-primary bg-primary/10" : "border-border"}`}>
            <RadioGroupItem value="light" aria-label="Tema Claro" />
            <Sun className="size-4" />
            <span><b className="block text-sm">Claro</b><span className="text-xs text-muted-foreground">Cinza-gelo suave</span></span>
          </Label>
        </RadioGroup>
      </fieldset>
    </section>
  );
}
