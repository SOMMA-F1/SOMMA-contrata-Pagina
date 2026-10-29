import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

// Envía los documentos de un registro de campo a SharePoint a través de un flujo de Power Automate.
// Estructura final en SharePoint: CONTRATA / fecha y hora del registro / <documento>.<extensión>
// La dirección del flujo es secreta y vive en la tabla privada public.configuracion (clave sharepoint_webhook).

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const BUCKET = "documentos-campo";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

// SharePoint no admite estos caracteres ni puntos/espacios al final de un nombre de carpeta.
function limpiar(texto: string): string {
  return texto.replace(/["*:<>?\/\\|#%]/g, "-").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
}

function extension(nombreOriginal: string, tipo?: string): string {
  const m = /\.([a-zA-Z0-9]{2,5})$/.exec(nombreOriginal);
  if (m) return m[1].toLowerCase();
  if (tipo === "application/pdf") return "pdf";
  if (tipo === "image/png") return "png";
  if (tipo === "image/webp") return "webp";
  return "jpg";
}

type Archivo = { tipo: string; texto: string; nombre: string; ruta: string };
type Registro = { id: string; creado_en: string; archivos: Archivo[]; perfiles: { nombre: string } | null };

async function procesar(reg: Registro, admin: ReturnType<typeof createClient>) {
  const marcar = (estado: string, detalle: string | null) =>
    admin.from("documentos_campo").update({
      sharepoint_estado: estado,
      sharepoint_detalle: detalle,
      sharepoint_enviado_en: estado === "enviado" ? new Date().toISOString() : null,
    }).eq("id", reg.id);

  try {
    const { data: conf } = await admin.from("configuracion").select("valor").eq("clave", "sharepoint_webhook").single();
    const webhook = conf?.valor?.trim();
    if (!webhook) { await marcar("error", "Falta configurar la dirección del flujo de Power Automate."); return; }

    const contrata = limpiar(reg.perfiles?.nombre ?? "SIN CONTRATA");
    const fecha = new Date(reg.creado_en).toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace(/:/g, "-");

    for (const a of reg.archivos) {
      const { data: blob, error } = await admin.storage.from(BUCKET).download(a.ruta);
      if (error || !blob) throw new Error(`No se pudo leer ${a.texto}`);
      const contenido = encodeBase64(new Uint8Array(await blob.arrayBuffer()));
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contrata,
          fecha,
          nombre: limpiar(a.texto),
          extension: extension(a.nombre, blob.type),
          contenido,
        }),
      });
      if (!res.ok) {
        const cuerpo = (await res.text().catch(() => "")).replace(/sig=[^&\s"]+/g, "sig=***").slice(0, 400);
        throw new Error(`El flujo respondió ${res.status} al enviar ${a.texto}: ${cuerpo}`);
      }
    }
    await marcar("enviado", null);
  } catch (e) {
    await marcar("error", e instanceof Error ? e.message : String(e));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { registro_id } = await req.json().catch(() => ({}));
  if (!registro_id) return json({ error: "Falta registro_id" }, 400);

  // Con el token del usuario, la base solo devuelve registros propios (o todos si es administrador).
  const { data: reg } = await usuario
    .from("documentos_campo")
    .select("id, creado_en, archivos, sharepoint_estado, perfiles(nombre)")
    .eq("id", registro_id)
    .maybeSingle();
  if (!reg) return json({ error: "Registro no encontrado" }, 404);
  if (reg.sharepoint_estado === "enviado") return json({ estado: "enviado" });

  EdgeRuntime.waitUntil(procesar(reg as unknown as Registro, admin));
  return json({ estado: "enviando" }, 202);
});
