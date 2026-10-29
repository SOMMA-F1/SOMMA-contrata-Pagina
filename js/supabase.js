// Cliente mínimo de Supabase (REST + Auth). La clave publicable es pública por diseño:
// la seguridad real la dan el inicio de sesión y las políticas RLS de la base de datos.
const SUPABASE_URL = 'https://shfrkekcheuuqsvuksos.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rzAbmJw78HNY2ioQ__3e1A_VwQnJsay';
const CLAVE_SESION = 'somma-sesion';
// Supabase Auth exige un correo: el usuario se traduce a uno técnico que nunca se muestra.
const DOMINIO_USUARIOS = '@somma.f1';

function leerSesion() {
  try { return JSON.parse(localStorage.getItem(CLAVE_SESION)); } catch { return null; }
}

function guardarSesion(sesion) {
  try { localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion)); } catch { /* sin almacenamiento */ }
}

function cerrarSesion() {
  try { localStorage.removeItem(CLAVE_SESION); } catch { /* sin almacenamiento */ }
  location.replace('login.html');
}

// Las páginas internas llaman a esta función: sin sesión se redirige al login.
function requerirSesion() {
  if (!leerSesion()) location.replace('login.html');
}

async function pedirAuth(ruta, cuerpo) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${ruta}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.msg || datos.error_description || `Error ${res.status}`);
  return datos;
}

function sesionDesdeToken(datos, previa) {
  return {
    ...previa,
    access_token: datos.access_token,
    refresh_token: datos.refresh_token,
    expira: Date.now() + (datos.expires_in - 60) * 1000,
    user_id: datos.user.id,
  };
}

async function iniciarSesion(usuario, clave) {
  const datos = await pedirAuth('token?grant_type=password', {
    email: usuario.trim().toLowerCase() + DOMINIO_USUARIOS,
    password: clave,
  });
  let sesion = sesionDesdeToken(datos, { usuario: usuario.trim().toLowerCase() });
  guardarSesion(sesion);
  // Nombre y rol del perfil (se guardan para mostrarlos sin consultar cada vez).
  const [perfil] = await supabase(`perfiles?select=nombre,rol&user_id=eq.${sesion.user_id}`);
  sesion = { ...sesion, nombre: perfil ? perfil.nombre : sesion.usuario, rol: perfil ? perfil.rol : 'contrata' };
  guardarSesion(sesion);
  return sesion;
}

async function tokenVigente() {
  const sesion = leerSesion();
  if (!sesion) return SUPABASE_KEY;
  if (Date.now() < sesion.expira) return sesion.access_token;
  try {
    const datos = await pedirAuth('token?grant_type=refresh_token', { refresh_token: sesion.refresh_token });
    const nueva = sesionDesdeToken(datos, sesion);
    guardarSesion(nueva);
    return nueva.access_token;
  } catch {
    cerrarSesion();
    throw new Error('La sesión expiró.');
  }
}

async function supabase(ruta, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${await tokenVigente()}`,
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
