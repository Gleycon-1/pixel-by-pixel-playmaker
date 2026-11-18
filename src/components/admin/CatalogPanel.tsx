import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Pencil, Plus, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  adminCatalog,
  adminCreateUploadUrl,
  adminDeleteCategory,
  adminDeleteProduct,
  adminGetSettings,
  adminMoveCategory,
  adminSaveCategory,
  adminSaveProduct, adminAddStock,
  adminSetFeaturedEnabled,
  adminToggleProduct,
} from "@/lib/admin.functions";
import { centsToInput, money, parseMoneyInput } from "@/lib/format";
import { useAdmin } from "./use-admin";

type Product = { id: string; category_id: string | null; name: string; description: string | null; price_cents: number; image_url: string | null; featured: boolean; available: boolean; stock: number | null; barcode: string | null };
type Draft = Omit<Product, "id" | "price_cents" | "stock"> & { id: string | null; price: string; stock: string };

export function CatalogPanel() {
  const { token, run } = useAdmin();
  const qc = useQueryClient();
  const fetchCatalog = useServerFn(adminCatalog);
  const fetchSettings = useServerFn(adminGetSettings);
  const saveCat = useServerFn(adminSaveCategory);
  const delCat = useServerFn(adminDeleteCategory);
  const moveCat = useServerFn(adminMoveCategory);
  const saveProd = useServerFn(adminSaveProduct);
  const delProd = useServerFn(adminDeleteProduct);
  const toggle = useServerFn(adminToggleProduct);
  const setFeat = useServerFn(adminSetFeaturedEnabled);
  const uploadUrl = useServerFn(adminCreateUploadUrl);

  const cat = useQuery({ queryKey: ["admin-catalog"], queryFn: () => fetchCatalog({ data: { token } }) });
  const settings = useQuery({ queryKey: ["admin-settings"], queryFn: () => fetchSettings({ data: { token } }) });
  const [newCat, setNewCat] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [batch, setBatch] = useState("");
  const addStock = useServerFn(adminAddStock);
  const launchBatch = async () => {
    const qty = Math.floor(Number(batch) || 0);
    if (!draft?.id || qty <= 0) return;
    const r = await run(() => addStock({ data: { token, id: draft.id!, qty } }), `Entrada de +${qty} un. lançada!`);
    if (r) {
      setBatch("");
      setDraft((d) => (d ? { ...d, stock: String(r.stock ?? 0), available: true } : d));
      refresh();
    }
  };
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-catalog"] });
    void qc.invalidateQueries({ queryKey: ["catalog"] });
  };

  const categories = cat.data?.categories ?? [];
  const products = (cat.data?.products ?? []) as Product[];

  const openProduct = (p?: Product) =>
    setDraft(
      p
        ? { ...p, price: centsToInput(p.price_cents), stock: p.stock == null ? "" : String(p.stock), barcode: p.barcode ?? "" }
        : { id: null, category_id: categories[0]?.id ?? null, name: "", description: "", image_url: null, featured: false, available: true, price: "", stock: "", barcode: "" },
    );

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const u = await uploadUrl({ data: { token, filename: file.name } });
      const { error } = await supabase.storage.from("product-images").uploadToSignedUrl(u.path, u.uploadToken, file);
      if (error) throw error;
      setDraft((d) => (d ? { ...d, image_url: u.publicUrl } : d));
    } catch {
      toast.error("Falha ao enviar a foto.");
    } finally {
      setUploading(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const r = await run(
      () =>
        saveProd({
          data: {
            token,
            id: draft.id,
            category_id: draft.category_id,
            name: draft.name,
            description: draft.description || null,
            price_cents: parseMoneyInput(draft.price),
            image_url: draft.image_url,
            featured: draft.featured,
            available: draft.available,
            stock: draft.stock.trim() === "" ? null : Math.max(0, Math.floor(Number(draft.stock) || 0)),
            barcode: draft.barcode?.trim() || null,
          },
        }),
      "Produto salvo!",
    );
    if (r) {
      setDraft(null);
      refresh();
    }
  };

  return (
    <div className="grid gap-4 pt-2 lg:grid-cols-[320px_1fr]">
      <section className="h-fit space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">Categorias</h2>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newCat.trim()) return;
            if (await run(() => saveCat({ data: { token, name: newCat, active: true } }))) {
              setNewCat("");
              refresh();
            }
          }}
        >
          <Input placeholder="Nova categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <Button type="submit" size="icon" aria-label="Adicionar categoria"><Plus /></Button>
        </form>
        <ul className="space-y-1">
          {categories.map((c, i) => (
            <li key={c.id} className="flex items-center gap-1 rounded-lg bg-muted/40 px-2 py-1 text-sm">
              <span className={c.active ? "flex-1 font-semibold" : "flex-1 text-muted-foreground line-through"}>{c.name}</span>
              <Switch checked={c.active} aria-label="Ativa" onCheckedChange={async (v) => (await run(() => saveCat({ data: { token, id: c.id, name: c.name, active: v } }))) && refresh()} />
              <Button size="icon" variant="ghost" className="size-7" disabled={i === 0} aria-label="Subir" onClick={async () => (await run(() => moveCat({ data: { token, id: c.id, direction: "up" } }))) && refresh()}><ArrowUp /></Button>
              <Button size="icon" variant="ghost" className="size-7" disabled={i === categories.length - 1} aria-label="Descer" onClick={async () => (await run(() => moveCat({ data: { token, id: c.id, direction: "down" } }))) && refresh()}><ArrowDown /></Button>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Renomear" onClick={async () => {
                const name = prompt("Novo nome", c.name);
                if (name?.trim() && (await run(() => saveCat({ data: { token, id: c.id, name, active: c.active } })))) refresh();
              }}><Pencil /></Button>
              <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label="Excluir" onClick={async () => confirm(`Excluir "${c.name}"?`) && (await run(() => delCat({ data: { token, id: c.id } }))) && refresh()}><Trash2 /></Button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <span className="flex items-center gap-2 text-sm font-bold"><Star className="size-4 text-primary" /> Vitrine "Destaques" na loja</span>
          <Switch
            checked={settings.data?.featured_enabled ?? false}
            onCheckedChange={async (v) => {
              if (await run(() => setFeat({ data: { token, value: v } }))) {
                void qc.invalidateQueries({ queryKey: ["admin-settings"] });
                refresh();
              }
            }}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">Produtos ({products.length})</h2>
          <Button onClick={() => openProduct()}><Plus /> Novo produto</Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-border bg-card p-2 last:border-0">
              {p.image_url ? <img src={p.image_url} alt="" className="size-12 rounded-lg object-cover" /> : <div className="size-12 rounded-lg bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {money(p.price_cents)} · {categories.find((c) => c.id === p.category_id)?.name ?? "Sem categoria"} · {p.stock == null ? "sem controle de estoque" : `estoque ${p.stock}`}
                </p>
              </div>
              <Button size="icon" variant={p.featured ? "default" : "ghost"} className="size-8" aria-label="Destaque" onClick={async () => (await run(() => toggle({ data: { token, id: p.id, field: "featured", value: !p.featured } }))) && refresh()}><Star /></Button>
              <Switch checked={p.available} aria-label="Disponível" onCheckedChange={async (v) => (await run(() => toggle({ data: { token, id: p.id, field: "available", value: v } }))) && refresh()} />
              <Button size="icon" variant="ghost" className="size-8" aria-label="Editar" onClick={() => openProduct(p)}><Pencil /></Button>
              <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Excluir" onClick={async () => confirm(`Excluir "${p.name}"?`) && (await run(() => delProd({ data: { token, id: p.id } }))) && refresh()}><Trash2 /></Button>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Preço (R$)</Label><Input inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
                <div><Label>Estoque (vazio = sem controle)</Label><Input inputMode="numeric" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value.replace(/\D/g, "") })} /></div>
              </div>
              <div><Label>Código de barras (EAN)</Label><Input inputMode="numeric" placeholder="Bipe ou digite o código" value={draft.barcode ?? ""} onChange={(e) => setDraft({ ...draft, barcode: e.target.value.replace(/\s/g, "") })} /></div>
              {draft.id && (
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <Label>Entrada de mercadoria (lote)</Label>
                  <p className="mb-2 text-xs text-muted-foreground">Some de uma vez a quantidade que chegou. Estoque atual: {draft.stock || "sem controle"}</p>
                  <div className="flex gap-2">
                    <Input inputMode="numeric" placeholder="Ex.: 2000" value={batch} onChange={(e) => setBatch(e.target.value.replace(/\D/g, ""))} />
                    <Button type="button" onClick={launchBatch} disabled={!batch}>+ Lançar</Button>
                  </div>
                </div>
              )}
              <div>
                <Label>Categoria</Label>
                <Select value={draft.category_id ?? ""} onValueChange={(v) => setDraft({ ...draft, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                {draft.image_url && <img src={draft.image_url} alt="" className="size-16 rounded-lg object-cover" />}
                <Button variant="outline" asChild disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload /> {uploading ? "Enviando…" : "Enviar foto"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                  </label>
                </Button>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={draft.featured} onCheckedChange={(v) => setDraft({ ...draft, featured: v })} /> Destaque</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={draft.available} onCheckedChange={(v) => setDraft({ ...draft, available: v })} /> Disponível</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={saveDraft} disabled={!draft?.name.trim() || uploading}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
