// Cliente mínimo de Supabase (API REST). La clave publicable es pública por diseño:
// la seguridad real la dan las políticas RLS de la base de datos.
const SUPABASE_URL = 'https://shfrkekcheuuqsvuksos.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rzAbmJw78HNY2ioQ__3e1A_VwQnJsay';

async function supabase(ruta, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...opciones.headers,
    },
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    const error = new Error(cuerpo.message || `Error ${res.status}`);
    error.code = cuerpo.code;
    throw error;
  }
  return res.status === 204 ? null : res.json();
}
