const MP = "https://api.mercadopago.com";

export async function mpToken() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("payment_gateway_settings")
    .select("access_token")
    .eq("id", 1)
    .maybeSingle();
  return data?.access_token || process.env["MERCADO_PAGO_ACCESS_TOKEN"] || null;
}

export async function createPixOrder(input: {
  orderId: string;
  amountCents: number;
  payerEmail: string;
}) {
  const token = await mpToken();
  if (!token) throw new Error("Pix online ainda não configurado pela loja.");
  const amount = (input.amountCents / 100).toFixed(2);
  const res = await fetch(`${MP}/v1/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.orderId,
    },
    body: JSON.stringify({
      type: "online",
      processing_mode: "automatic",
      external_reference: input.orderId,
      total_amount: amount,
      payer: { email: input.payerEmail },
      transactions: {
        payments: [
          {
            amount,
            payment_method: { id: "pix", type: "bank_transfer" },
            expiration_time: "PT30M",
          },
        ],
      },
    }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    id?: string;
    transactions?: { payments?: Array<{ payment_method?: { qr_code?: string; qr_code_base64?: string } }> };
  };
  if (!res.ok || !j.id) {
    console.error("Mercado Pago create order failed", res.status, JSON.stringify(j));
    throw new Error("Não foi possível gerar o Pix agora. Tente outra forma de pagamento.");
  }
  const pm = j.transactions?.payments?.[0]?.payment_method;
  return { mpOrderId: j.id, qrCode: pm?.qr_code ?? "", qrBase64: pm?.qr_code_base64 ?? null };
}

/** Consulta a ordem diretamente na API (fonte da verdade, usada também para validar webhooks). */
export async function fetchMpOrder(mpOrderId: string) {
  const token = await mpToken();
  if (!token) return null;
  const res = await fetch(`${MP}/v1/orders/${encodeURIComponent(mpOrderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { id: string; status?: string; status_detail?: string; external_reference?: string };
  return {
    id: j.id,
    externalReference: j.external_reference ?? null,
    paid: j.status === "processed" || j.status_detail === "accredited",
  };
}
