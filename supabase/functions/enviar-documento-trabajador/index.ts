import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

// Envía un documento de trabajador (SCTR, CAMO, cursos, DNI) a SharePoint con el mismo flujo de Power Automate.
// Estructura en SharePoint:
//   DOCUMENTOS DEL TRABAJADOR / CONTRATA / APELLIDOS NOMBRES (DNI) / DOCUMENTO (SCTR, CAMO…) / fecha y hora de subida / <documento>.<extensión>
// La dirección del flujo es secreta y vive en la tabla privada public.configuracion (clave sharepoint_webhook).

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const BUCKET = "documentos-campo";
const RAIZ = "/Documentos compartidos/DOCUMENTOS DEL TRABAJADOR";
const ETIQUETAS: Record<string, string> = {
  sctr: "SCTR",
  camo: "CAMO",
  curso_altura: "Curso de altura",
  curso_riesgo_electrico: "Curso de riesgo eléctrico",
  dni: "DNI",
};

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

type Trabajador = {
  apellido_paterno: string;
  apellido_materno: string;
  nombres: string;
  dni: string;
  perfiles: { nombre: string } | null;
};
type Documento = { id: string; tipo: string; nombre: string; ruta: string; subido_en: string; trabajadores: Trabajador | null };

async function procesar(doc: Documento, admin: ReturnType<typeof createClient>) {
  const marcar = (estado: string, detalle: string | null) =>
    admin.from("trabajador_documentos").update({
      sharepoint_estado: estado,
      sharepoint_detalle: detalle,
      sharepoint_enviado_en: estado === "enviado" ? new Date().toISOString() : null,
    }).eq("id", doc.id);

  try {
    const { data: conf } = await admin.from("configuracion").select("valor").eq("clave", "sharepoint_webhook").single();
    const webhook = conf?.valor?.trim();
    if (!webhook) { await marcar("error", "Falta configurar la dirección del flujo de Power Automate."); return; }
    const t = doc.trabajadores;
    if (!t) { await marcar("error", "No se encontró al trabajador."); return; }

    const contrata = limpiar(t.perfiles?.nombre ?? "SIN CONTRATA");
    const trabajador = limpiar(`${t.apellido_paterno} ${t.apellido_materno} ${t.nombres} (${t.dni})`);
    const fecha = new Date(doc.subido_en).toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace(/:/g, "-");

    const { data: blob, error } = await admin.storage.from(BUCKET).download(doc.ruta);
    if (error || !blob) throw new Error("No se pudo leer el archivo");

    const etiqueta = ETIQUETAS[doc.tipo] ?? limpiar(doc.tipo);
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carpeta: `${RAIZ}/${contrata}/${trabajador}/${etiqueta}/${fecha}`,
        nombre: etiqueta,
        extension: extension(doc.nombre, blob.type),
        contenido: encodeBase64(new Uint8Array(await blob.arrayBuffer())),
      }),
    });
    if (!res.ok) {
      const cuerpo = (await res.text().catch(() => "")).replace(/sig=[^&\s"]+/g, "sig=***").slice(0, 400);
      throw new Error(`El flujo respondió ${res.status}: ${cuerpo}`);
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

  const { documento_id } = await req.json().catch(() => ({}));
  if (!documento_id) return json({ error: "Falta documento_id" }, 400);

  // Con el token del usuario, la base solo devuelve documentos de sus trabajadores (o todos si es administrador).
  const { data: doc } = await usuario
    .from("trabajador_documentos")
    .select("id, tipo, nombre, ruta, subido_en, sharepoint_estado, trabajadores(apellido_paterno, apellido_materno, nombres, dni, perfiles(nombre))")
    .eq("id", documento_id)
    .maybeSingle();
  if (!doc) return json({ error: "Documento no encontrado" }, 404);
  if (doc.sharepoint_estado === "enviado") return json({ estado: "enviado" });

  // Reserva el envío de forma atómica: evita duplicados si la página llama dos veces.
  // Un envío "enviando" de hace más de 2 minutos se considera caído y puede retomarse.
  const caducado = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: tomado } = await admin.from("trabajador_documentos")
    .update({ sharepoint_estado: "enviando", sharepoint_inicio: new Date().toISOString() })
    .eq("id", doc.id)
    .or(`sharepoint_estado.in.(pendiente,error),and(sharepoint_estado.eq.enviando,sharepoint_inicio.lt.${caducado})`)
    .select("id");
  if (!tomado?.length) return json({ estado: "enviando" });

  EdgeRuntime.waitUntil(procesar(doc as unknown as Documento, admin));
  return json({ estado: "enviando" }, 202);
});
