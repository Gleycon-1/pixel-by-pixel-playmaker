import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { adminCouriers, adminDeleteCourier, adminSaveCourier } from "@/lib/admin.functions";
import { maskPhoneInput, phoneDisplay } from "@/lib/format";
import { waLink } from "@/lib/store-info";
import { useAdmin } from "./use-admin";

type Form = { id: string | null; name: string; plate: string; whatsapp: string; active: boolean };
const EMPTY: Form = { id: null, name: "", plate: "", whatsapp: "", active: true };

export function CouriersPanel() {
  const { token, run } = useAdmin();
  const qc = useQueryClient();
  const list = useServerFn(adminCouriers);
  const save = useServerFn(adminSaveCourier);
  const del = useServerFn(adminDeleteCourier);
  const couriers = useQuery({ queryKey: ["admin-couriers"], queryFn: () => list({ data: { token } }) });
  const [f, setF] = useState<Form>(EMPTY);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-couriers"] });

  return (
    <div className="grid gap-4 pt-2 lg:grid-cols-[340px_1fr]">
      <form
        className="h-fit space-y-2 rounded-2xl border border-border bg-card p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(
            () => save({ data: { token, id: f.id, name: f.name, plate: f.plate || null, whatsapp: f.whatsapp, active: f.active } }),
            "Motoboy salvo!",
          );
          if (ok) {
            setF(EMPTY);
            void refresh();
          }
        }}
      >
        <h2 className="font-display text-lg font-extrabold">{f.id ? "Editar motoboy" : "Novo motoboy"}</h2>
        <Input placeholder="Nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input placeholder="Placa (ABC1D23)" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value.toUpperCase() })} />
        <Input placeholder="WhatsApp" inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: maskPhoneInput(e.target.value) })} />
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> Ativo</label>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={f.name.trim().length < 2 || f.whatsapp.replace(/\D/g, "").length < 10}>Salvar</Button>
          {f.id && <Button type="button" variant="outline" onClick={() => setF(EMPTY)}>Cancelar</Button>}
        </div>
      </form>
      <div className="space-y-2">
        {(couriers.data ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex-1">
              <p className="font-bold">{c.name} {!c.active && <span className="text-xs text-muted-foreground">(inativo)</span>}</p>
              <p className="text-xs text-muted-foreground">{c.plate || "sem placa"} · {phoneDisplay(c.whatsapp)}</p>
            </div>
            <Button size="sm" variant="outline" asChild><a href={waLink(c.whatsapp, "Olá!")} target="_blank" rel="noreferrer">WhatsApp</a></Button>
            <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setF({ id: c.id, name: c.name, plate: c.plate ?? "", whatsapp: maskPhoneInput(c.whatsapp.replace(/^55/, "")), active: c.active })}><Pencil /></Button>
            <Button size="icon" variant="ghost" className="text-destructive" aria-label="Excluir" onClick={async () => confirm(`Excluir ${c.name}?`) && (await run(() => del({ data: { token, id: c.id } }))) && refresh()}><Trash2 /></Button>
          </div>
        ))}
        {!couriers.data?.length && <p className="text-sm text-muted-foreground">Nenhum motoboy cadastrado.</p>}
      </div>
    </div>
  );
}
