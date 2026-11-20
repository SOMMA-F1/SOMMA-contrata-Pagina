const form = document.getElementById('form-reporte');
const status = document.getElementById('form-status');
const ticket = document.getElementById('ticket');
const site = document.getElementById('site');
const responsable = document.getElementById('responsable');
const proyecto = document.getElementById('proyecto');
const actividad = document.getElementById('actividad');
const fecha = document.getElementById('fecha');
const horaIngreso = document.getElementById('hora-ingreso');
const horaSalida = document.getElementById('hora-salida');
const tipoRiesgo = document.getElementById('tipo-riesgo');

const BUCKET = 'documentos-campo';
const MAX_MB = 10;

// Opciones de la lista "tipo de trabajo de alto riesgo" (provisionales: se ajustan aquí).
const TIPOS_ALTO_RIESGO = [
  'Trabajos en altura',
  'Trabajos de riesgo eléctrico',
  'Altura y riesgo eléctrico',
  'Otro trabajo de alto riesgo',
  'Ninguno',
];

// Campos de archivo. tipos: 'foto' (cámara o galería), 'pdf' o ambos (botones PDF / FOTO).
const ARCHIVOS = {
  sctr: { texto: 'Foto SCTR en campo + foto formato atención SCTR en campo', tipos: ['foto'], requerido: true, multiple: true },
  iperc: { texto: 'Adjuntar en PDF o FOTO: IPERC de proyecto (trabajo), ATS y Charla de 5 MIN', tipos: ['pdf', 'foto'], requerido: true, multiple: true },
  desinfeccion: { texto: 'Foto de materiales de desinfección para tema epidemiológicos', tipos: ['foto'], requerido: false, multiple: false },
  vehiculo: { texto: 'Foto de vehículo (que se muestre placa)', tipos: ['foto'], requerido: false, multiple: false },
  herramientas: { texto: 'Foto de caja de herramientas + camilla', tipos: ['foto'], requerido: false, multiple: false },
  declaracion: { texto: 'PDF de declaración jurada de uso de vehículo', tipos: ['pdf'], requerido: false, multiple: false },
  extintor: { texto: 'Foto extintor + botiquín', tipos: ['foto'], requerido: false, multiple: false },
  delimitacion: { texto: 'Foto delimitación del área', tipos: ['foto'], requerido: true, multiple: false },
  contingencia: { texto: 'Plan de contingencia', tipos: ['foto'], requerido: true, multiple: false },
  residuos: { texto: 'Foto de segregación de residuos en campo, contenedores de colores según norma', tipos: ['foto'], requerido: true, multiple: false },
};

const ICONOS = {
  foto: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 15h6M9 18h4"/></svg>',
};

const sesion = leerSesion();
const esAdmin = sesion && sesion.rol === 'admin';

// ---------- Datos fijos ----------
const contratista = document.getElementById('contratista');
contratista.defaultValue = sesion ? (sesion.nombre || sesion.usuario) : '';
contratista.value = contratista.defaultValue;

TIPOS_ALTO_RIESGO.forEach((t, i) => {
  if (i === 0) tipoRiesgo.add(new Option('Elige una opción...', ''));
  tipoRiesgo.add(new Option(t, t));
});

// El ticket son los 8 primeros caracteres del id del reporte (la base calcula el mismo valor).
let reporteId = crypto.randomUUID();
function valoresIniciales() {
  reporteId = crypto.randomUUID();
  ticket.value = reporteId.slice(0, 8);
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  fecha.value = d.toISOString().slice(0, 10);
  horaIngreso.value = d.toISOString().slice(11, 16);
  horaSalida.value = '';
}
valoresIniciales();

// ---------- Botones de opción (Sí/No, 1-4) ----------
document.querySelectorAll('.seg').forEach((grupo, n) => {
  const nombre = grupo.dataset.nombre;
  grupo.dataset.nombre = nombre;
  grupo.dataset.opciones.split(',').forEach((texto, i) => {
    const id = `seg-${nombre}-${i}`;
    const etiqueta = document.createElement('label');
    etiqueta.htmlFor = id;
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = nombre;
    input.id = id;
    input.value = texto;
    input.addEventListener('change', () => validarGrupo(grupo));
    const span = document.createElement('span');
    span.textContent = texto;
    etiqueta.append(input, span);
    grupo.appendChild(etiqueta);
  });
});

const requeridosSeg = ['tecnicos', 'incidentes', 'choques', 'altura', 'electrico'];
function valorSeg(nombre) {
  const marcado = form.querySelector(`input[name="${nombre}"]:checked`);
  return marcado ? marcado.value : null;
}

function marcarError(caja, texto) {
  caja.classList.toggle('invalid', texto !== '');
  const msg = caja.querySelector('.field-error');
  if (msg) msg.textContent = texto;
}

function validarGrupo(grupo) {
  const nombre = grupo.dataset.nombre;
  const caja = grupo.closest('.field');
  const falta = requeridosSeg.includes(nombre) && valorSeg(nombre) === null;
  marcarError(caja, falta ? 'Elige una opción.' : '');
  return !falta;
}

// ---------- Campos de archivo ----------
const estado = {}; // id -> File[]
const subidas = [...document.querySelectorAll('.subida')];

function esFoto(a) { return a.type.startsWith('image/'); }
function esPdf(a) { return a.type === 'application/pdf'; }

function tamanio(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function pintarLista(id) {
  const caja = document.querySelector(`.subida[data-archivo="${id}"]`);
  const lista = caja.querySelector('.archivos-lista');
  lista.replaceChildren(...estado[id].map((archivo, i) => {
    const li = document.createElement('li');
    const nombre = document.createElement('span');
    nombre.textContent = `${archivo.name} · ${tamanio(archivo.size)}`;
    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'btn-quitar';
    quitar.setAttribute('aria-label', `Quitar ${archivo.name}`);
    quitar.textContent = '✕';
    quitar.addEventListener('click', () => {
      estado[id].splice(i, 1);
      pintarLista(id);
      validarArchivo(id);
    });
    li.append(nombre, quitar);
    return li;
  }));
}

function agregarArchivos(id, tipo, archivos) {
  const cfg = ARCHIVOS[id];
  const caja = document.querySelector(`.subida[data-archivo="${id}"]`);
  const validos = [];
  let error = '';
  for (const a of archivos) {
    if (tipo === 'pdf' && !esPdf(a)) { error = 'En este botón solo se admite un archivo PDF.'; continue; }
    if (tipo === 'foto' && !esFoto(a)) { error = 'En este botón solo se admite una foto o imagen.'; continue; }
    if (a.size > MAX_MB * 1024 * 1024) { error = `"${a.name}" supera los ${MAX_MB} MB.`; continue; }
    validos.push(a);
  }
  if (validos.length) estado[id] = cfg.multiple ? [...estado[id], ...validos] : [validos[0]];
  pintarLista(id);
  marcarError(caja, error);
  if (!error) validarArchivo(id);
}

function validarArchivo(id) {
  const cfg = ARCHIVOS[id];
  const caja = document.querySelector(`.subida[data-archivo="${id}"]`);
  const falta = cfg.requerido && estado[id].length === 0;
  marcarError(caja, falta ? 'Adjunta este documento.' : '');
  return !falta;
}

subidas.forEach((caja) => {
  const id = caja.dataset.archivo;
  const cfg = ARCHIVOS[id];
  estado[id] = [];

  const rotulo = document.createElement('span');
  rotulo.className = 'label';
  rotulo.innerHTML = `${cfg.texto}${cfg.requerido ? ' <span class="req" aria-hidden="true">*</span>' : ''}`;

  const botones = document.createElement('div');
  botones.className = 'subida-botones';
  cfg.tipos.forEach((tipo) => {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'subida-btn' + (cfg.tipos.length === 1 ? ' unico' : '');
    const input = document.createElement('input');
    input.type = 'file';
    input.className = 'sr-only';
    input.multiple = cfg.multiple;
    // Sin "capture": en el celular ofrece abrir la cámara o elegir de la galería.
    input.accept = tipo === 'pdf' ? 'application/pdf,.pdf' : 'image/*';
    input.addEventListener('change', () => {
      agregarArchivos(id, tipo, [...input.files]);
      input.value = '';
    });
    const icono = document.createElement('span');
    icono.className = 'subida-icono';
    icono.innerHTML = ICONOS[tipo];
    const texto = document.createElement('span');
    texto.className = 'subida-texto';
    texto.textContent = tipo === 'pdf' ? 'PDF' : (cfg.tipos.length === 1 ? 'Tomar foto o elegir de la galería' : 'FOTO');
    etiqueta.append(input, icono, texto);
    botones.appendChild(etiqueta);
  });

  const lista = document.createElement('ul');
  lista.className = 'archivos-lista';
  const error = document.createElement('p');
  error.className = 'field-error';
  error.setAttribute('role', 'alert');
  caja.append(rotulo, botones, lista, error);
});

// ---------- Validación del formulario ----------
function validar(campo) {
  const vacio = !campo.value.trim();
  marcarError(campo.closest('.field'), vacio ? 'Este campo es obligatorio.' : '');
  campo.setAttribute('aria-invalid', String(vacio));
  return !vacio;
}

const camposFijos = [site, responsable, proyecto, actividad, fecha, horaIngreso, horaSalida, tipoRiesgo];
camposFijos.forEach((c) => {
  c.addEventListener('blur', () => validar(c));
  c.addEventListener('input', () => {
    if (c.closest('.field').classList.contains('invalid')) validar(c);
  });
});

function validarTodo() {
  const resultados = [
    ...camposFijos.map(validar),
    ...[...form.querySelectorAll('.seg')].map(validarGrupo),
    ...Object.keys(ARCHIVOS).map(validarArchivo),
  ];
  return !resultados.includes(false);
}

// ---------- Envío ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.className = 'form-status';

  if (!validarTodo()) {
    status.textContent = 'Revisa los campos marcados.';
    status.classList.add('error');
    const primero = form.querySelector('.field.invalid');
    if (primero) primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const pendientes = Object.entries(estado).flatMap(([id, lista]) => lista.map((archivo) => ({ id, archivo })));
    const archivos = [];
    let hechos = 0;
    for (const { id, archivo } of pendientes) {
      status.textContent = `Subiendo archivos (${hechos + 1} de ${pendientes.length})...`;
      const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ruta = `${sesion.user_id}/reportes/${reporteId}/${id}-${hechos + 1}-${limpio}`;
      await subirArchivo(BUCKET, ruta, archivo);
      archivos.push({ campo: id, texto: ARCHIVOS[id].texto, nombre: archivo.name, ruta });
      hechos += 1;
    }

    status.textContent = 'Guardando reporte...';
    const si = (nombre) => valorSeg(nombre) === 'Sí';
    const escalera = valorSeg('escalera');
    await supabase('reportes_diarios', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: reporteId,
        site: site.value.trim(),
        responsable: responsable.value.trim(),
        proyecto: proyecto.value.trim(),
        actividad: actividad.value.trim(),
        fecha_actividad: fecha.value,
        hora_ingreso: horaIngreso.value,
        hora_salida: horaSalida.value,
        cantidad_tecnicos: Number(valorSeg('tecnicos')),
        tipo_alto_riesgo: tipoRiesgo.value,
        incidentes: si('incidentes'),
        choques_vehiculares: si('choques'),
        usa_escalera: escalera === null ? null : escalera === 'Sí',
        trabajo_altura: si('altura'),
        trabajo_electrico: si('electrico'),
        archivos,
      }),
    });

    const enviado = ticket.value;
    form.reset();
    status.className = 'form-status ok';
    status.textContent = `Reporte ${enviado} enviado correctamente.`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    cargarReportes();
  } catch {
    status.className = 'form-status error';
    status.textContent = 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.';
  } finally {
    boton.disabled = false;
  }
});

form.addEventListener('reset', () => {
  status.textContent = '';
  setTimeout(() => {
    valoresIniciales();
    Object.keys(estado).forEach((id) => { estado[id] = []; pintarLista(id); });
    form.querySelectorAll('.field.invalid').forEach((caja) => marcarError(caja, ''));
    camposFijos.forEach((c) => c.removeAttribute('aria-invalid'));
  });
});

// ---------- Sugerencias para Site, Proyecto y Actividad ----------
function llenarLista(id, valores) {
  const unicos = [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  document.getElementById(id).replaceChildren(...unicos.map((v) => {
    const o = document.createElement('option');
    o.value = v;
    return o;
  }));
}

async function cargarSugerencias() {
  try {
    const [campo, reportes] = await Promise.all([
      supabase('documentos_campo?select=site,actividad&limit=500'),
      supabase('reportes_diarios?select=site,proyecto,actividad&limit=500'),
    ]);
    llenarLista('lista-sites', [...campo, ...reportes].map((f) => f.site));
    llenarLista('lista-proyectos', reportes.map((f) => f.proyecto));
    llenarLista('lista-actividades', [...campo, ...reportes].map((f) => f.actividad));
  } catch { /* sin sugerencias: los campos siguen siendo de texto libre */ }
}

// ---------- Reportes enviados ----------
// La base ya filtra: la contrata recibe solo los suyos y el administrador recibe todos.
const cuerpo = document.getElementById('reportes-body');
const sub = document.getElementById('reportes-sub');
document.querySelector('.col-contrata').hidden = !esAdmin;

function fechaLegible(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function filaVacia(texto) {
  const tr = document.createElement('tr');
  tr.className = 'empty-row';
  const td = document.createElement('td');
  td.colSpan = esAdmin ? 8 : 7;
  td.textContent = texto;
  tr.appendChild(td);
  cuerpo.replaceChildren(tr);
}

async function cargarReportes() {
  try {
    const filas = await supabase('reportes_diarios?select=*,perfiles(nombre)&order=creado_en.desc&limit=200');
    sub.textContent = esAdmin
      ? `Todos los reportes de las contratas (${filas.length}).`
      : `Tus reportes (${filas.length}).`;
    if (filas.length === 0) { filaVacia('Aún no hay reportes enviados.'); return; }

    cuerpo.replaceChildren(...filas.map((f) => {
      const tr = document.createElement('tr');
      const celda = (texto, clase) => { const td = document.createElement('td'); td.textContent = texto; td.className = clase; tr.appendChild(td); };
      celda(fechaLegible(f.fecha_actividad), 'nowrap');
      celda(f.ticket, 'nowrap');
      if (esAdmin) celda(f.perfiles ? f.perfiles.nombre : '-', 'col-texto');
      celda(f.site, 'col-texto');
      celda(f.proyecto, 'col-texto');
      celda(f.actividad, 'col-texto');
      celda(String(f.cantidad_tecnicos), 'nowrap');
      const tdArchivos = document.createElement('td');
      tdArchivos.className = 'nowrap';
      const ver = document.createElement('button');
      ver.type = 'button';
      ver.className = 'btn-docs';
      ver.textContent = `Ver archivos (${f.archivos.length})`;
      ver.addEventListener('click', () => abrirReporte(f));
      tdArchivos.appendChild(ver);
      tr.appendChild(tdArchivos);
      return tr;
    }));
  } catch {
    sub.textContent = '';
    filaVacia('No se pudieron cargar los reportes.');
  }
}

// ---------- Ventana con los datos y archivos de un reporte ----------
const dlg = document.getElementById('dlg-reporte');

async function abrirArchivo(boton, ruta) {
  boton.disabled = true;
  try {
    window.open(await urlFirmada(BUCKET, ruta), '_blank', 'noopener');
  } catch {
    boton.title = 'No se pudo abrir el archivo';
  } finally {
    boton.disabled = false;
  }
}

function abrirReporte(f) {
  document.getElementById('reporte-titulo-modal').textContent = `Reporte ${f.ticket}`;
  const sn = (v) => (v === null ? '—' : v ? 'Sí' : 'No');
  document.getElementById('reporte-sub-modal').textContent =
    `${f.site} · ${f.proyecto} · ${fechaLegible(f.fecha_actividad)} · ${f.hora_ingreso.slice(0, 5)}–${f.hora_salida.slice(0, 5)}` +
    ` · Resp.: ${f.responsable} · Alto riesgo: ${f.tipo_alto_riesgo}` +
    ` · Incidentes: ${sn(f.incidentes)} · Choques: ${sn(f.choques_vehiculares)} · Escalera: ${sn(f.usa_escalera)}` +
    ` · Altura: ${sn(f.trabajo_altura)} · Eléctrico: ${sn(f.trabajo_electrico)}` +
    (esAdmin && f.perfiles ? ` · ${f.perfiles.nombre}` : '');
  const lista = document.getElementById('reporte-lista');
  lista.replaceChildren();
  f.archivos.forEach((a) => {
    const fila = document.createElement('div');
    fila.className = 'doc-fila';
    const info = document.createElement('div');
    info.className = 'doc-info';
    const nombre = document.createElement('strong');
    nombre.textContent = a.texto;
    const archivo = document.createElement('span');
    archivo.className = 'doc-estado';
    archivo.textContent = a.nombre;
    info.append(nombre, archivo);
    const abrir = document.createElement('button');
    abrir.type = 'button';
    abrir.className = 'chip-doc';
    abrir.textContent = 'Abrir';
    abrir.addEventListener('click', () => abrirArchivo(abrir, a.ruta));
    fila.append(info, abrir);
    lista.appendChild(fila);
  });
  dlg.showModal();
}

document.getElementById('reporte-cerrar').addEventListener('click', () => dlg.close());
document.getElementById('btn-recargar').addEventListener('click', cargarReportes);
cargarSugerencias();
cargarReportes();
