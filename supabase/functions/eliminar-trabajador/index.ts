import { createClient } from "jsr:@supabase/supabase-js@2";

// Elimina un trabajador: primero pide al flujo de Power Automate que mande su carpeta completa de SharePoint
// (DOCUMENTOS DEL TRABAJADOR / CONTRATA / APELLIDOS NOMBRES (DNI)) a la papelera, y después borra sus archivos
// y el registro en Supabase (los documentos del trabajador se borran en cascada).
// Puede hacerlo la contrata dueña del trabajador o el administrador (lo decide la base con el token del usuario).

const BUCKET = "documentos-campo";
const SITIO = "/sites/SISTEMADEGESTINDESEGURIDADYSALUDENELTRABAJOF1";
const RAIZ = `${SITIO}/Documentos compartidos/DOCUMENTOS DEL TRABAJADOR`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

function limpiar(texto: string): string {
  return texto.replace(/["*:<>?\/\\|#%]/g, "-").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { trabajador_id } = await req.json().catch(() => ({}));
  if (!trabajador_id) return json({ error: "Falta trabajador_id" }, 400);

  const { data: t } = await usuario
    .from("trabajadores")
    .select("id, apellido_paterno, apellido_materno, nombres, dni, perfiles(nombre)")
    .eq("id", trabajador_id)
    .maybeSingle();
  if (!t) return json({ error: "Trabajador no encontrado" }, 404);

  const { data: docs } = await admin.from("trabajador_documentos").select("ruta, sharepoint_estado").eq("trabajador_id", t.id);
  if (docs?.some((d) => d.sharepoint_estado === "enviando")) {
    return json({ error: "Hay documentos enviándose a SharePoint. Espera unos segundos e inténtalo de nuevo." }, 409);
  }

  // 1) SharePoint: la carpeta del trabajador va a la papelera (recuperable), solo si ya se envió algo.
  const { data: conf } = await admin.from("configuracion").select("valor").eq("clave", "sharepoint_webhook").single();
  const webhook = conf?.valor?.trim();
  if (webhook && docs?.some((d) => d.sharepoint_estado === "enviado")) {
    const contrata = limpiar((t.perfiles as unknown as { nombre: string } | null)?.nombre ?? "SIN CONTRATA");
    const trabajador = limpiar(`${t.apellido_paterno} ${t.apellido_materno} ${t.nombres} (${t.dni})`);
    const ruta = `${RAIZ}/${contrata}/${trabajador}`.replace(/'/g, "''").replace(/ /g, "%20");
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "borrar", ruta }),
    });
    if (!res.ok) return json({ error: `No se pudo pedir el borrado en SharePoint (${res.status}).` }, 502);
  }

  // 2) Supabase: archivos y trabajador (los registros de documentos se borran en cascada).
  const rutas = (docs ?? []).map((d) => d.ruta);
  if (rutas.length) {
    const { error } = await admin.storage.from(BUCKET).remove(rutas);
    if (error) return json({ error: "No se pudieron borrar los archivos." }, 500);
  }
  const { error: errFila } = await admin.from("trabajadores").delete().eq("id", t.id);
  if (errFila) return json({ error: "No se pudo borrar al trabajador." }, 500);

  return json({ ok: true });
});
