import { createClient } from "jsr:@supabase/supabase-js@2";

// Elimina un documento de un trabajador: primero pide al flujo de Power Automate que mande su carpeta
// a la papelera de SharePoint y después borra el archivo y el registro en Supabase.
// Por defecto se recicla la carpeta del documento completa (p. ej. SCTR con todas sus fechas); con solo_fecha: true
// únicamente la carpeta de fecha de esta subida (se usa al reemplazar, para no borrar la nueva).
// Puede hacerlo la contrata dueña del trabajador o el administrador (lo decide la base con el token del usuario).

const BUCKET = "documentos-campo";
const SITIO = "/sites/SISTEMADEGESTINDESEGURIDADYSALUDENELTRABAJOF1";
const RAIZ = `${SITIO}/Documentos compartidos/DOCUMENTOS DEL TRABAJADOR`;
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

// Misma limpieza que usa enviar-documento-trabajador para nombrar las carpetas.
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

  const { documento_id, solo_fecha } = await req.json().catch(() => ({}));
  if (!documento_id) return json({ error: "Falta documento_id" }, 400);

  const { data: doc } = await usuario
    .from("trabajador_documentos")
    .select("id, tipo, ruta, subido_en, sharepoint_estado, trabajadores(apellido_paterno, apellido_materno, nombres, dni, perfiles(nombre))")
    .eq("id", documento_id)
    .maybeSingle();
  if (!doc) return json({ error: "Documento no encontrado" }, 404);
  if (doc.sharepoint_estado === "enviando") return json({ error: "El documento se está enviando a SharePoint. Espera unos segundos e inténtalo de nuevo." }, 409);

  const t = doc.trabajadores as unknown as {
    apellido_paterno: string; apellido_materno: string; nombres: string; dni: string; perfiles: { nombre: string } | null;
  } | null;

  // 1) SharePoint: la carpeta va a la papelera (recuperable). Si falla, no se borra nada.
  const { data: conf } = await admin.from("configuracion").select("valor").eq("clave", "sharepoint_webhook").single();
  const webhook = conf?.valor?.trim();
  if (webhook && t && doc.sharepoint_estado === "enviado") {
    const contrata = limpiar(t.perfiles?.nombre ?? "SIN CONTRATA");
    const trabajador = limpiar(`${t.apellido_paterno} ${t.apellido_materno} ${t.nombres} (${t.dni})`);
    const fecha = new Date(doc.subido_en).toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace(/:/g, "-");
    const etiqueta = ETIQUETAS[doc.tipo] ?? limpiar(doc.tipo);
    const carpeta = solo_fecha ? `${RAIZ}/${contrata}/${trabajador}/${etiqueta}/${fecha}` : `${RAIZ}/${contrata}/${trabajador}/${etiqueta}`;
    const ruta = carpeta.replace(/'/g, "''").replace(/ /g, "%20");
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "borrar", ruta }),
    });
    if (!res.ok) return json({ error: `No se pudo pedir el borrado en SharePoint (${res.status}).` }, 502);
  }

  // 2) Supabase: archivo y registro.
  const { error: errArchivo } = await admin.storage.from(BUCKET).remove([doc.ruta]);
  if (errArchivo) return json({ error: "No se pudo borrar el archivo." }, 500);
  const { error: errFila } = await admin.from("trabajador_documentos").delete().eq("id", doc.id);
  if (errFila) return json({ error: "No se pudo borrar el documento." }, 500);

  return json({ ok: true });
});
