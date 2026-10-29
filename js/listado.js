// Se llena desde Supabase (tabla trabajadores). Forma de cada objeto:
// { id, nombre, rut, cargo, venc: 'AAAA-MM-DD' | null, dias: número | null, estado: 'Acreditado' | 'No acreditado' }
// "rut" muestra el DNI; cargo y vencimiento aún no se registran.
const trabajadores = [];

const $ = (id) => document.getElementById(id);

// El administrador ve a los trabajadores de todas las contratas y una columna extra con la contrata.
const sesionActual = leerSesion();
const esAdmin = !!sesionActual && sesionActual.rol === 'admin';
document.querySelector('.col-contrata').hidden = !esAdmin;
const estado = { orden: { key: 'id', dir: 1 }, pagina: 1 };

function filtrar() {
  const q = $('buscar').value.trim().toLowerCase();
  const fEstado = $('f-estado').value;
  const fCargo = $('f-cargo').value.trim().toLowerCase();
  const fVenc = $('f-venc').value;

  return trabajadores.filter((t) => {
    if (q && ![t.id, t.nombre, t.contrata, t.rut, t.cargo, t.estado].join(' ').toLowerCase().includes(q)) return false;
    if (fEstado && t.estado !== fEstado) return false;
    if (fCargo && !String(t.cargo).toLowerCase().includes(fCargo)) return false;
    if (fVenc === 'none' && t.venc) return false;
    if (fVenc === '30' && !(t.dias !== null && t.dias <= 30)) return false;
    return true;
  });
}

function ordenar(lista) {
  const { key, dir } = estado.orden;
  return [...lista].sort((a, b) => {
    const va = a[key] ?? '';
    const vb = b[key] ?? '';
    return String(va).localeCompare(String(vb), 'es', { numeric: true }) * dir;
  });
}

function celda(tr, texto, clase) {
  const td = document.createElement('td');
  if (clase) td.className = clase;
  td.textContent = texto;
  tr.appendChild(td);
  return td;
}

// ---------- Menú de acciones por trabajador ----------
// Cada acción abre su ventana (editar, documentos, estado) o actúa directo (eliminar).
const ACCIONES = [
  {
    id: 'editar',
    texto: 'Editar',
    icono: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 8.5l2 2"/>',
  },
  {
    id: 'documentos',
    texto: 'Ver documentos',
    icono: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  },
  {
    id: 'acreditacion',
    texto: 'Estado de acreditación',
    icono: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h6M15 10h2"/>',
  },
  {
    id: 'eliminar',
    texto: 'Eliminar',
    peligro: true,
    icono: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  },
];

const menu = document.createElement('div');
menu.className = 'menu-acciones';
menu.setAttribute('role', 'menu');
menu.hidden = true;
document.body.appendChild(menu);

let menuBoton = null;
let menuTrabajador = null;
let avisoTimer = null;

function mostrarAviso(texto) {
  const aviso = $('toast');
  aviso.textContent = texto;
  aviso.classList.add('visible');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => aviso.classList.remove('visible'), 3500);
}

function cerrarMenu(devolverFoco = false) {
  if (menu.hidden) return;
  menu.hidden = true;
  if (menuBoton) {
    menuBoton.setAttribute('aria-expanded', 'false');
    if (devolverFoco) menuBoton.focus();
  }
  menuBoton = null;
  menuTrabajador = null;
}

function posicionarMenu() {
  if (!menuBoton) return;
  const r = menuBoton.getBoundingClientRect();
  const ancho = menu.offsetWidth;
  const left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - ancho - 8));
  menu.style.left = left + 'px';
  menu.style.top = r.bottom + window.scrollY + 4 + 'px';
}

function abrirMenu(boton, trabajador) {
  if (!menu.hidden && menuBoton === boton) { cerrarMenu(); return; }
  cerrarMenu();

  menu.replaceChildren();
  ACCIONES.forEach((a) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'menu-item' + (a.peligro ? ' peligro' : '');
    item.setAttribute('role', 'menuitem');
    item.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${a.icono}</svg>`;
    item.append(a.texto);
    item.addEventListener('click', () => {
      const t = menuTrabajador;
      cerrarMenu(true);
      if (!t) return;
      if (a.id === 'editar') abrirEditar(t);
      else if (a.id === 'acreditacion') abrirEstado(t);
      else if (a.id === 'documentos') abrirDocumentos(t);
      else if (a.id === 'eliminar') eliminarTrabajador(t);
    });
    menu.appendChild(item);
  });

  menuBoton = boton;
  menuTrabajador = trabajador;
  boton.setAttribute('aria-expanded', 'true');
  menu.hidden = false;
  posicionarMenu();
  menu.querySelector('.menu-item').focus();
}

document.addEventListener('click', (e) => { if (!menu.contains(e.target)) cerrarMenu(); });
window.addEventListener('resize', posicionarMenu);
$('lista-body').closest('.table-wrap').addEventListener('scroll', () => cerrarMenu());
menu.addEventListener('keydown', (e) => {
  const items = [...menu.querySelectorAll('.menu-item')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); cerrarMenu(true); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  else if (e.key === 'Tab') cerrarMenu();
});

function pintar() {
  cerrarMenu();
  const filtrados = ordenar(filtrar());
  const tamano = Number($('page-size').value);
  const paginas = Math.max(1, Math.ceil(filtrados.length / tamano));
  estado.pagina = Math.min(estado.pagina, paginas);
  const ini = (estado.pagina - 1) * tamano;
  const visibles = filtrados.slice(ini, ini + tamano);

  const body = $('lista-body');
  body.replaceChildren();

  if (visibles.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    const td = document.createElement('td');
    td.colSpan = esAdmin ? 8 : 7;
    td.textContent = trabajadores.length === 0
      ? 'Sin datos para mostrar.'
      : 'Ningún registro coincide con la búsqueda.';
    tr.appendChild(td);
    body.appendChild(tr);
  }

  visibles.forEach((t) => {
    const tr = document.createElement('tr');

    const tdCheck = document.createElement('td');
    tdCheck.className = 'col-check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'fila-check';
    cb.setAttribute('aria-label', `Seleccionar ${t.nombre}`);
    tdCheck.appendChild(cb);
    tr.appendChild(tdCheck);

    celda(tr, t.id);

    const tdNombre = document.createElement('td');
    tdNombre.className = 'worker';
    const btnNombre = document.createElement('button');
    btnNombre.type = 'button';
    btnNombre.className = 'nombre-btn';
    btnNombre.setAttribute('aria-haspopup', 'menu');
    btnNombre.setAttribute('aria-expanded', 'false');
    btnNombre.append(t.nombre, ' ');
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '▾';
    btnNombre.appendChild(caret);
    btnNombre.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirMenu(btnNombre, t);
    });
    tdNombre.appendChild(btnNombre);
    tr.appendChild(tdNombre);
    if (esAdmin) celda(tr, t.contrata || '-');

    celda(tr, t.rut);
    celda(tr, t.cargo);
    const urgente = t.dias !== null && t.dias <= 15;
    celda(tr, t.dias !== null && t.dias <= 15 ? `En ${t.dias} ${t.dias === 1 ? 'día' : 'días'}` : (t.venc || '-'),
      urgente ? 'due' : '');

    const tdEstado = document.createElement('td');
    const b = document.createElement('span');
    b.className = 'estado ' + (t.estado === 'Acreditado' ? 'ok' : 'no');
    b.textContent = t.estado;
    tdEstado.appendChild(b);
    tr.appendChild(tdEstado);

    body.appendChild(tr);
  });

  const total = filtrados.length;
  const desde = total === 0 ? 0 : ini + 1;
  const hasta = Math.min(ini + tamano, total);
  let info = `Mostrando ${desde} a ${hasta} de ${total} registros`;
  if (total !== trabajadores.length) info += ` (filtrado de ${trabajadores.length})`;
  $('info').textContent = info;
  $('pag-estado').textContent = `Página ${estado.pagina} de ${paginas}`;
  $('prev').disabled = estado.pagina <= 1;
  $('next').disabled = estado.pagina >= paginas;

  $('check-all').checked = false;

  document.querySelectorAll('.sort').forEach((b2) => {
    const activo = b2.dataset.key === estado.orden.key;
    b2.querySelector('.arrow').textContent = activo ? (estado.orden.dir === 1 ? '▲' : '▼') : '';
  });

  const activos = [$('f-estado').value, $('f-cargo').value.trim(), $('f-venc').value].filter(Boolean).length;
  $('filtros-count').hidden = activos === 0;
  $('filtros-count').textContent = activos;
}

$('buscar').addEventListener('input', () => { estado.pagina = 1; pintar(); });
$('page-size').addEventListener('change', () => { estado.pagina = 1; pintar(); });
['f-estado', 'f-cargo', 'f-venc'].forEach((id) => {
  $(id).addEventListener('input', () => { estado.pagina = 1; pintar(); });
});
$('panel-filtros').addEventListener('reset', () => setTimeout(() => { estado.pagina = 1; pintar(); }));

$('prev').addEventListener('click', () => { estado.pagina -= 1; pintar(); });
$('next').addEventListener('click', () => { estado.pagina += 1; pintar(); });

document.querySelectorAll('.sort').forEach((b) => {
  b.addEventListener('click', () => {
    const key = b.dataset.key;
    estado.orden = { key, dir: estado.orden.key === key ? -estado.orden.dir : 1 };
    pintar();
  });
});

$('check-all').addEventListener('change', (e) => {
  document.querySelectorAll('.fila-check').forEach((c) => { c.checked = e.target.checked; });
});

$('btn-filtros').addEventListener('click', () => {
  const panel = $('panel-filtros');
  panel.hidden = !panel.hidden;
  $('btn-filtros').setAttribute('aria-expanded', String(!panel.hidden));
});

pintar();

async function cargarTrabajadores() {
  try {
    const filas = await supabase('trabajadores?select=*,perfiles(nombre)&order=id.asc');
    trabajadores.push(...filas.map((f) => ({
      id: f.id,
      nombre: `${f.apellido_paterno} ${f.apellido_materno}, ${f.nombres}`,
      rut: f.dni,
      cargo: '-',
      venc: null,
      dias: null,
      estado: f.estado,
      contrata: f.perfiles ? f.perfiles.nombre : '',
      fila: f,
    })));
    pintar();
  } catch (err) {
    mostrarAviso('No se pudo cargar el listado de trabajadores.');
  }
}

cargarTrabajadores();

// ---------- Editar, estado de acreditación y eliminar ----------
function nombreCompleto(f) {
  return `${f.apellido_paterno} ${f.apellido_materno}, ${f.nombres}`;
}

function aTrabajador(f) {
  return {
    id: f.id,
    nombre: nombreCompleto(f),
    rut: f.dni,
    cargo: '-',
    venc: null,
    dias: null,
    estado: f.estado,
    contrata: f.perfiles ? f.perfiles.nombre : '',
    fila: f,
  };
}

function reemplazarTrabajador(f) {
  const i = trabajadores.findIndex((t) => t.id === f.id);
  if (i >= 0) {
    const nuevo = aTrabajador(f);
    nuevo.contrata = trabajadores[i].contrata; // la respuesta de la edición no trae el nombre de la contrata
    trabajadores[i] = nuevo;
  }
  pintar();
}

// --- Editar ---
const dlgEditar = $('dlg-editar');
const formEditar = $('form-editar');
const camposEditar = {
  apellido_paterno: $('e-ap-paterno'),
  apellido_materno: $('e-ap-materno'),
  nombres: $('e-nombres'),
  dni: $('e-dni'),
  fecha_nacimiento: $('e-nacimiento'),
  sexo: $('e-sexo'),
  nacionalidad: $('e-nacionalidad'),
  direccion_personal: $('e-direccion'),
  empresa: $('e-empresa'),
};
let editando = null;

camposEditar.fecha_nacimiento.max = new Date().toISOString().slice(0, 10);
camposEditar.dni.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8); });

function errorCampo(clave, campo) {
  const v = campo.value.trim();
  if (!v) return 'Este campo es obligatorio.';
  if (clave === 'dni' && !/^\d{8}$/.test(v)) return 'El DNI debe tener 8 dígitos.';
  if (clave === 'fecha_nacimiento' && v > campo.max) return 'La fecha no puede ser futura.';
  return '';
}

function marcarCampo(campo, texto) {
  const caja = campo.closest('.field');
  caja.classList.toggle('invalid', texto !== '');
  caja.querySelector('.field-error').textContent = texto;
}

function abrirEditar(t) {
  editando = t;
  Object.entries(camposEditar).forEach(([clave, campo]) => {
    campo.value = t.fila[clave] ?? '';
    marcarCampo(campo, '');
  });
  $('editar-status').textContent = '';
  $('editar-status').className = 'form-status';
  dlgEditar.showModal();
}

formEditar.addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('editar-status');
  status.className = 'form-status';

  let primero = null;
  Object.entries(camposEditar).forEach(([clave, campo]) => {
    const texto = errorCampo(clave, campo);
    marcarCampo(campo, texto);
    if (texto && !primero) primero = campo;
  });
  if (primero) { status.textContent = 'Revisa los campos marcados.'; status.classList.add('error'); primero.focus(); return; }

  const cambios = {};
  Object.entries(camposEditar).forEach(([clave, campo]) => { cambios[clave] = campo.value.trim(); });

  const boton = formEditar.querySelector('button[type="submit"]');
  boton.disabled = true;
  status.textContent = 'Guardando...';
  try {
    const [fila] = await supabase(`trabajadores?id=eq.${editando.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(cambios),
    });
    if (!fila) throw new Error('sin permiso');
    reemplazarTrabajador(fila);
    dlgEditar.close();
    mostrarAviso('Trabajador actualizado.');
  } catch (err) {
    status.className = 'form-status error';
    status.textContent = err.code === '23505' ? 'Ya existe otro trabajador con ese DNI.' : 'No se pudo guardar. Inténtalo de nuevo.';
  } finally {
    boton.disabled = false;
  }
});

$('editar-cancelar').addEventListener('click', () => dlgEditar.close());

// --- Estado de acreditación ---
const dlgEstado = $('dlg-estado');
let estadoDe = null;

function abrirEstado(t) {
  estadoDe = t;
  $('estado-nombre').textContent = t.nombre;
  $('estado-select').value = t.estado;
  $('estado-select').disabled = !esAdmin;
  $('estado-nota').textContent = esAdmin
    ? 'Como administrador puedes cambiar el estado de acreditación.'
    : 'Solo el administrador puede cambiar el estado de acreditación.';
  $('estado-guardar').hidden = !esAdmin;
  $('estado-status').textContent = '';
  dlgEstado.showModal();
}

$('form-estado').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!esAdmin || !estadoDe) return;
  const status = $('estado-status');
  const boton = $('estado-guardar');
  boton.disabled = true;
  status.className = 'form-status';
  status.textContent = 'Guardando...';
  try {
    const [fila] = await supabase(`trabajadores?id=eq.${estadoDe.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ estado: $('estado-select').value }),
    });
    if (!fila) throw new Error('sin permiso');
    reemplazarTrabajador(fila);
    dlgEstado.close();
    mostrarAviso(`Estado actualizado: ${fila.estado}.`);
  } catch {
    status.className = 'form-status error';
    status.textContent = 'No se pudo guardar. Inténtalo de nuevo.';
  } finally {
    boton.disabled = false;
  }
});

$('estado-cerrar').addEventListener('click', () => dlgEstado.close());

// --- Eliminar ---
async function eliminarTrabajador(t) {
  if (!confirm(`¿Eliminar a ${t.nombre} (DNI ${t.rut})?\n\nEsta acción no se puede deshacer.`)) return;
  const error = await eliminarTrabajadorServidor(t.id);
  if (error) { mostrarAviso(error); return; }
  const i = trabajadores.findIndex((x) => x.id === t.id);
  if (i >= 0) trabajadores.splice(i, 1);
  pintar();
  mostrarAviso('Trabajador eliminado.');
}

// ---------- Documentos del trabajador ----------
const BUCKET_DOCS = 'documentos-campo';
const TIPOS_ARCHIVO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_MB_DOC = 10;

const DOCS_TRABAJADOR = [
  { tipo: 'sctr', texto: 'SCTR' },
  { tipo: 'camo', texto: 'CAMO' },
  { grupo: 'Certificación o cursos', items: [
    { tipo: 'curso_altura', texto: 'Altura' },
    { tipo: 'curso_riesgo_electrico', texto: 'Riesgo eléctrico' },
  ] },
  { tipo: 'dni', texto: 'DNI' },
];
const TOTAL_DOCS = 5;

const dlgDocs = $('dlg-docs');
let docsDe = null;
let docsGuardados = new Map();
const docsReintentados = new Set();

function mensajeDocs(texto, tipo = '') {
  const el = $('docs-status');
  el.className = 'form-status' + (tipo ? ' ' + tipo : '');
  el.textContent = texto;
}

function crearFilaDoc(doc) {
  const guardado = docsGuardados.get(doc.tipo);
  const fila = document.createElement('div');
  fila.className = 'doc-fila';

  const info = document.createElement('div');
  info.className = 'doc-info';
  const nombre = document.createElement('strong');
  nombre.textContent = doc.texto;
  const estadoDoc = document.createElement('span');
  estadoDoc.className = 'doc-estado' + (guardado ? ' cargado' : '');
  estadoDoc.textContent = guardado ? guardado.nombre : 'Pendiente';
  info.append(nombre, estadoDoc);
  if (guardado) {
    const sp = document.createElement('span');
    const textosSp = { enviado: ['ok', 'Enviado a SharePoint'], pendiente: ['pend', 'Enviando a SharePoint…'], enviando: ['pend', 'Enviando a SharePoint…'], error: ['no', 'Error al enviar a SharePoint'] };
    const [clase, texto] = textosSp[guardado.sharepoint_estado] || textosSp.pendiente;
    sp.className = 'estado ' + clase;
    sp.textContent = texto;
    if (guardado.sharepoint_detalle) sp.title = guardado.sharepoint_detalle;
    info.appendChild(sp);
  }

  const acciones = document.createElement('div');
  acciones.className = 'doc-acciones';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,image/jpeg,image/png,image/webp';
  input.hidden = true;
  input.addEventListener('change', () => { if (input.files[0]) subirDocumento(doc, input.files[0], acciones); });

  const subir = document.createElement('button');
  subir.type = 'button';
  subir.className = 'chip-doc';
  subir.textContent = guardado ? 'Reemplazar' : 'Subir';
  subir.addEventListener('click', () => input.click());
  acciones.append(input, subir);

  if (guardado) {
    const ver = document.createElement('button');
    ver.type = 'button';
    ver.className = 'chip-doc';
    ver.textContent = 'Ver';
    ver.addEventListener('click', async () => {
      ver.disabled = true;
      try { window.open(await urlFirmada(BUCKET_DOCS, guardado.ruta), '_blank', 'noopener'); }
      catch { mensajeDocs('No se pudo abrir el archivo.', 'error'); }
      finally { ver.disabled = false; }
    });
    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'chip-doc quitar';
    quitar.textContent = 'Quitar';
    quitar.addEventListener('click', () => quitarDocumento(doc, guardado, acciones));
    acciones.append(ver, quitar);
    if (guardado.sharepoint_estado === 'error') {
      const reintentar = document.createElement('button');
      reintentar.type = 'button';
      reintentar.className = 'chip-doc';
      reintentar.textContent = 'Reintentar envío';
      reintentar.addEventListener('click', async () => {
        reintentar.disabled = true;
        await enviarDocumentoTrabajador(guardado.id);
        setTimeout(cargarDocumentos, 6000);
      });
      acciones.append(reintentar);
    }
  }

  fila.append(info, acciones);
  return fila;
}

function pintarDocumentos() {
  const lista = $('docs-lista');
  lista.replaceChildren();
  DOCS_TRABAJADOR.forEach((d) => {
    if (d.grupo) {
      const grupo = document.createElement('div');
      grupo.className = 'doc-grupo';
      const titulo = document.createElement('p');
      titulo.className = 'doc-grupo-titulo';
      titulo.textContent = d.grupo;
      grupo.appendChild(titulo);
      d.items.forEach((i) => grupo.appendChild(crearFilaDoc(i)));
      lista.appendChild(grupo);
    } else {
      lista.appendChild(crearFilaDoc(d));
    }
  });
  $('docs-contador').textContent = `${docsGuardados.size} de ${TOTAL_DOCS} documentos cargados`;
}

async function cargarDocumentos() {
  try {
    const filas = await supabase(`trabajador_documentos?select=*&trabajador_id=eq.${docsDe.id}`);
    docsGuardados = new Map(filas.map((f) => [f.tipo, f]));
    pintarDocumentos();
    // Si algún envío a SharePoint se perdió, se reintenta; mientras haya pendientes se vuelve a consultar.
    filas.filter((f) => f.sharepoint_estado === 'pendiente' && !docsReintentados.has(f.id)).forEach((f) => {
      docsReintentados.add(f.id);
      enviarDocumentoTrabajador(f.id);
    });
    if (filas.some((f) => ['pendiente', 'enviando'].includes(f.sharepoint_estado)) && dlgDocs.open) setTimeout(cargarDocumentos, 6000);
  } catch {
    mensajeDocs('No se pudieron cargar los documentos.', 'error');
  }
}

function abrirDocumentos(t) {
  docsDe = t;
  docsGuardados = new Map();
  $('docs-nombre').textContent = t.nombre;
  mensajeDocs('');
  pintarDocumentos();
  dlgDocs.showModal();
  cargarDocumentos();
}

function ocupar(acciones, ocupado) {
  acciones.querySelectorAll('button').forEach((b) => { b.disabled = ocupado; });
}

async function subirDocumento(doc, archivo, acciones) {
  mensajeDocs('');
  if (!TIPOS_ARCHIVO.includes(archivo.type)) { mensajeDocs('Solo se permite PDF o imagen (JPG, PNG, WEBP).', 'error'); return; }
  if (archivo.size > MAX_MB_DOC * 1024 * 1024) { mensajeDocs(`El archivo supera los ${MAX_MB_DOC} MB.`, 'error'); return; }

  ocupar(acciones, true);
  mensajeDocs(`Subiendo ${doc.texto}...`);
  try {
    const previo = docsGuardados.get(doc.tipo);
    const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ruta = `${docsDe.fila.contrata_id}/trabajadores/${docsDe.id}/${doc.tipo}-${Date.now()}-${limpio}`;
    await subirArchivo(BUCKET_DOCS, ruta, archivo);
    if (previo) {
      // El documento anterior se elimina completo (SharePoint y base) antes de registrar el nuevo.
      const error = await eliminarDocumentoTrabajador(previo.id, true);
      if (error) { await borrarArchivos(BUCKET_DOCS, [ruta]); mensajeDocs(error, 'error'); ocupar(acciones, false); return; }
    }
    const [guardado] = await supabase('trabajador_documentos?on_conflict=trabajador_id,tipo', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        trabajador_id: docsDe.id, tipo: doc.tipo, nombre: archivo.name, ruta,
        subido_en: new Date().toISOString(), sharepoint_estado: 'pendiente', sharepoint_detalle: null, sharepoint_enviado_en: null,
      }),
    });
    // Copia a SharePoint en segundo plano; el estado se ve en la fila.
    docsReintentados.add(guardado.id);
    enviarDocumentoTrabajador(guardado.id);
    await cargarDocumentos();
    mensajeDocs(`${doc.texto} guardado.`, 'ok');
  } catch {
    mensajeDocs('No se pudo subir el archivo. Inténtalo de nuevo.', 'error');
    ocupar(acciones, false);
  }
}

async function quitarDocumento(doc, guardado, acciones) {
  if (!confirm(`¿Quitar el documento ${doc.texto}?`)) return;
  ocupar(acciones, true);
  mensajeDocs(`Quitando ${doc.texto}...`);
  const error = await eliminarDocumentoTrabajador(guardado.id);
  if (error) {
    mensajeDocs(error, 'error');
    ocupar(acciones, false);
    return;
  }
  await cargarDocumentos();
  mensajeDocs(`${doc.texto} quitado.`, 'ok');
}

$('docs-cerrar').addEventListener('click', () => dlgDocs.close());
