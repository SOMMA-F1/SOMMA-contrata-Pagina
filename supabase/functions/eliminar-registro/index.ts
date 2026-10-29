import { createClient } from "jsr:@supabase/supabase-js@2";

// Elimina un registro de Documentos de Campo: primero pide al flujo de Power Automate que mande
// la carpeta del registro a la papelera de SharePoint, y después borra los archivos y la fila en Supabase.
// Puede borrar el dueño del registro o un administrador (lo decide la base con el token del usuario).

const BUCKET = "documentos-campo";
const SITIO = "/sites/SISTEMADEGESTINDESEGURIDADYSALUDENELTRABAJOF1";
const BIBLIOTECA = "Documentos compartidos";
const RAIZ = "PAGINA CONTRATA SOMMA";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Misma limpieza que usa enviar-sharepoint para nombrar las carpetas.
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

  const { registro_id } = await req.json().catch(() => ({}));
  if (!registro_id) return json({ error: "Falta registro_id" }, 400);

  const { data: reg } = await usuario
    .from("documentos_campo")
    .select("id, creado_en, archivos, perfiles(nombre)")
    .eq("id", registro_id)
    .maybeSingle();
  if (!reg) return json({ error: "Registro no encontrado" }, 404);

  const { data: conf } = await admin.from("configuracion").select("valor").eq("clave", "sharepoint_webhook").single();
  const webhook = conf?.valor?.trim();

  // 1) SharePoint: la carpeta del registro va a la papelera (recuperable). Si falla, no se borra nada.
  if (webhook) {
    const contrata = limpiar((reg.perfiles as { nombre: string } | null)?.nombre ?? "SIN CONTRATA");
    const fecha = new Date(reg.creado_en).toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace(/:/g, "-");
    // Ruta relativa al servidor; el apóstrofo se duplica y los espacios se codifican para la URL de la API.
    const ruta = `${SITIO}/${BIBLIOTECA}/${RAIZ}/${contrata}/${fecha}`.replace(/'/g, "''").replace(/ /g, "%20");
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "borrar", ruta }),
    });
    if (!res.ok) return json({ error: `No se pudo pedir el borrado en SharePoint (${res.status}).` }, 502);
  }

  // 2) Supabase: archivos y registro.
  const rutas = (reg.archivos as { ruta: string }[]).map((a) => a.ruta);
  if (rutas.length) {
    const { error } = await admin.storage.from(BUCKET).remove(rutas);
    if (error) return json({ error: "No se pudieron borrar los archivos." }, 500);
  }
  const { error: errFila } = await admin.from("documentos_campo").delete().eq("id", reg.id);
  if (errFila) return json({ error: "No se pudo borrar el registro." }, 500);

  return json({ ok: true });
});
