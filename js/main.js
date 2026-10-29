// Los trabajadores y su estado de acreditación vienen de Supabase (vista resumen_contratas).
// La base ya limita lo que se ve: el administrador recibe todas las contratas y cada contrata solo la suya.
// Vencimientos y avisos aún no tienen fuente de datos y arrancan vacíos.
const trabajadores = { total: 0, acreditados: 0, noAcreditados: 0, sinAuditar: 0 };
const vencimientos = []; // { nombre, rut, doc, dias }
const avisos = [];       // { titulo, texto, fecha }

const $ = (id) => document.getElementById(id);

function nivel(pct) {
  if (pct < 60) return { clase: 'bajo', texto: 'Bajo' };
  if (pct < 85) return { clase: 'medio', texto: 'Medio' };
  return { clase: 'alto', texto: 'Alto' };
}

function pintarTabla() {
  const body = $('docs-body');
  body.replaceChildren();

  if (vencimientos.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'Sin datos para mostrar.';
    tr.appendChild(td);
    body.appendChild(tr);
  }

  vencimientos.forEach((v) => {
    const tr = document.createElement('tr');
    const celdas = [
      ['worker', v.nombre],
      ['', v.rut],
      ['', v.doc],
      ['due' + (v.dias > 15 ? ' warn' : ''), v.dias < 0 ? `Vencido hace ${-v.dias} ${v.dias === -1 ? 'día' : 'días'}` : v.dias === 0 ? 'Vence hoy' : `En ${v.dias} ${v.dias === 1 ? 'día' : 'días'}`],
    ];
    celdas.forEach(([clase, texto]) => {
      const td = document.createElement('td');
      if (clase) td.className = clase;
      td.textContent = texto;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  $('count-docs').textContent = vencimientos.length;
  $('count-docs').classList.toggle('pill-red', vencimientos.length > 0);
  $('count-docs').classList.toggle('pill-muted', vencimientos.length === 0);
}

function pintarCumplimiento() {
  const badge = $('nivel-badge');
  const bar = $('nivel-bar');

  if (trabajadores.total === 0) {
    $('nivel-valor').textContent = '—';
    badge.textContent = 'Sin datos';
    badge.className = 'badge sin-datos';
    bar.className = 'bar';
    bar.removeAttribute('aria-valuenow');
    $('nivel-fill').style.width = '0';
    $('nivel-detalle').textContent = 'Sin trabajadores registrados.';
    return;
  }

  const pct = Math.round((trabajadores.acreditados / trabajadores.total) * 1000) / 10;
  const n = nivel(pct);

  $('nivel-valor').textContent = pct.toLocaleString('es-PE', { minimumFractionDigits: 1 }) + '%';
  badge.textContent = n.texto;
  badge.className = 'badge ' + n.clase;

  bar.className = 'bar ' + n.clase;
  bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  $('nivel-fill').style.width = pct + '%';

  $('nivel-detalle').textContent =
    `${trabajadores.acreditados} acreditados de un total de ${trabajadores.total} trabajadores vigentes`;
}

function pintarDonut() {
  $('total-trab').textContent = trabajadores.total;

  const partes = [
    { n: trabajadores.acreditados, color: '#10b981', texto: 'Acreditados' },
    { n: trabajadores.noAcreditados, color: '#ef4444', texto: 'No acreditados' },
    { n: trabajadores.sinAuditar, color: '#625e5b', texto: 'Sin auditar' },
  ];

  const donut = $('donut');
  if (trabajadores.total === 0) {
    donut.style.background = '#ede8e2';
  } else {
    let acumulado = 0;
    const tramos = partes
      .filter((p) => p.n > 0)
      .map((p) => {
        const ini = (acumulado / trabajadores.total) * 360;
        acumulado += p.n;
        const fin = (acumulado / trabajadores.total) * 360;
        return `${p.color} ${ini}deg ${fin}deg`;
      });
    donut.style.background = `conic-gradient(${tramos.join(', ')})`;
  }

  const legend = $('legend');
  legend.replaceChildren();
  partes.forEach((p) => {
    const li = document.createElement('li');
    const punto = document.createElement('i');
    punto.style.background = p.color;
    li.append(punto, `${p.n} ${p.texto}`);
    legend.appendChild(li);
  });
}

function pintarVencimientos() {
  const vencidos = vencimientos.filter((v) => v.dias < 0).length;
  const proximos = vencimientos.filter((v) => v.dias >= 0).length;
  const criticos = vencimientos.filter((v) => v.dias >= 0 && v.dias < 15).length;
  $('docs-total').textContent = proximos;

  const alerta = $('docs-alert');
  const partes = [];
  if (vencidos > 0) partes.push(`${vencidos} ya vencidos`);
  if (criticos > 0) partes.push(`${criticos} vencen en menos de 15 días`);
  alerta.classList.toggle('hidden', partes.length === 0);
  alerta.textContent = `⚠ ${partes.join(' · ')}`;

  const badge = $('docs-badge');
  if (vencimientos.length === 0) {
    badge.textContent = 'Sin vencimientos';
    badge.className = 'badge sin-datos';
  } else if (vencidos > 0 || criticos > 0) {
    badge.textContent = 'Crítico';
    badge.className = 'badge badge-red-soft';
  } else {
    badge.textContent = 'Normal';
    badge.className = 'badge badge-green';
  }
}

function pintarAvisos() {
  const lista = $('aviso-list');
  lista.replaceChildren();

  if (avisos.length === 0) {
    const li = document.createElement('li');
    li.className = 'aviso-vacio';
    li.textContent = 'No hay avisos por el momento.';
    lista.appendChild(li);
    return;
  }

  avisos.forEach((a) => {
    const li = document.createElement('li');
    li.className = 'aviso';
    const t = document.createElement('time');
    t.textContent = a.fecha;
    const h = document.createElement('h3');
    h.textContent = a.titulo;
    const p = document.createElement('p');
    p.textContent = a.texto;
    li.append(t, h, p);
    lista.appendChild(li);
  });
}

// Pestañas de la tarjeta principal
const tabs = [
  { btn: $('tab-docs'), panel: $('panel-docs') },
  { btn: $('tab-prov'), panel: $('panel-prov') },
];
tabs.forEach((t) => {
  t.btn.addEventListener('click', () => {
    tabs.forEach((o) => {
      const activo = o === t;
      o.btn.classList.toggle('active', activo);
      o.btn.setAttribute('aria-selected', String(activo));
      o.panel.hidden = !activo;
    });
  });
});

$('btn-ayuda').addEventListener('click', () => alert('Ayuda: próximamente.'));
$('btn-reportes').addEventListener('click', () => alert('Reportes de acreditación: próximamente.'));

pintarTabla();
pintarCumplimiento();
pintarDonut();
pintarVencimientos();
pintarAvisos();

// ---------- Datos reales desde Supabase ----------
const sesion = leerSesion();
const esAdmin = !!sesion && sesion.rol === 'admin';

function pintarResumenContratas(filas) {
  const body = $('resumen-body');
  body.replaceChildren();
  const ordenadas = [...filas].sort((a, b) => b.trabajadores - a.trabajadores || a.nombre.localeCompare(b.nombre, 'es'));
  ordenadas.forEach((f) => {
    const tr = document.createElement('tr');
    const celda = (texto, clase) => { const td = document.createElement('td'); td.textContent = texto; if (clase) td.className = clase; tr.appendChild(td); };
    celda(f.rol === 'admin' ? `${f.nombre} (administrador)` : f.nombre, 'worker');
    celda(f.trabajadores);
    celda(f.acreditados);
    celda(f.no_acreditados);
    celda(f.trabajadores ? `${Math.round((f.acreditados / f.trabajadores) * 100)}%` : '—');
    celda(f.registros_campo);
    body.appendChild(tr);
  });
  $('resumen-contratas').hidden = false;
}

async function cargarDashboard() {
  try {
    const filas = await supabase('resumen_contratas?select=*');
    trabajadores.total = filas.reduce((s, f) => s + f.trabajadores, 0);
    trabajadores.acreditados = filas.reduce((s, f) => s + f.acreditados, 0);
    trabajadores.noAcreditados = filas.reduce((s, f) => s + f.no_acreditados, 0);
    trabajadores.sinAuditar = 0;
    pintarCumplimiento();
    pintarDonut();
    if (esAdmin) {
      $('dash-subtitulo').textContent = 'Dashboard de Acreditación · Todas las contratas';
      pintarResumenContratas(filas);
    } else if (filas[0]) {
      $('dash-subtitulo').textContent = `Dashboard de Acreditación · ${filas[0].nombre}`;
    }
  } catch {
    $('nivel-detalle').textContent = 'No se pudieron cargar los datos.';
  }
}

// Documentos de trabajadores ya vencidos o que vencen en los próximos 30 días (según su regla de vencimiento).
const ETIQUETAS_DOC = {
  sctr: 'SCTR',
  camo: 'CAMO',
  curso_altura: 'Certificado de altura',
  curso_riesgo_electrico: 'Certificado de riesgo eléctrico',
  dni: 'DNI',
};

async function cargarVencimientos() {
  try {
    const l = new Date();
    l.setDate(l.getDate() + 30);
    const limite = `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, '0')}-${String(l.getDate()).padStart(2, '0')}`;
    const filas = await supabase(
      'trabajador_documentos?select=tipo,fecha_vencimiento,trabajadores(apellido_paterno,apellido_materno,nombres,dni,perfiles(nombre))'
      + `&fecha_vencimiento=lte.${limite}&order=fecha_vencimiento.asc&limit=500`,
    );
    vencimientos.length = 0;
    filas.forEach((f) => {
      const t = f.trabajadores;
      if (!t) return;
      const nombre = `${t.apellido_paterno} ${t.apellido_materno}, ${t.nombres}`;
      vencimientos.push({
        nombre: esAdmin && t.perfiles ? `${nombre} · ${t.perfiles.nombre}` : nombre,
        rut: t.dni,
        doc: ETIQUETAS_DOC[f.tipo] || f.tipo,
        dias: diasHasta(f.fecha_vencimiento),
      });
    });
    pintarTabla();
    pintarVencimientos();
  } catch { /* se queda en "Sin datos" */ }
}

cargarDashboard();
cargarVencimientos();
