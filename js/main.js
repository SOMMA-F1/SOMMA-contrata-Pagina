// Datos de ejemplo: se reemplazarán por datos reales (Supabase u otra fuente).
const trabajadores = { total: 31, acreditados: 12, noAcreditados: 19, sinAuditar: 0 };

const vencimientos = [
  { nombre: 'Trabajador de ejemplo 01', rut: '10000001', doc: 'SCTR de Salud y pensión', dias: 3 },
  { nombre: 'Trabajador de ejemplo 02', rut: '10000002', doc: 'SCTR de Salud y pensión', dias: 4 },
  { nombre: 'Trabajador de ejemplo 03', rut: '10000003', doc: 'SCTR de Salud y pensión', dias: 4 },
  { nombre: 'Trabajador de ejemplo 04', rut: '10000004', doc: 'SCTR de Salud y pensión', dias: 4 },
  { nombre: 'Trabajador de ejemplo 05', rut: '10000005', doc: 'Examen médico ocupacional', dias: 6 },
  { nombre: 'Trabajador de ejemplo 06', rut: '10000006', doc: 'Curso de trabajo en altura', dias: 9 },
  { nombre: 'Trabajador de ejemplo 07', rut: '10000007', doc: 'SCTR de Salud y pensión', dias: 12 },
  { nombre: 'Trabajador de ejemplo 08', rut: '10000008', doc: 'Curso de primeros auxilios', dias: 14 },
  { nombre: 'Trabajador de ejemplo 09', rut: '10000009', doc: 'Examen médico ocupacional', dias: 21 },
  { nombre: 'Trabajador de ejemplo 10', rut: '10000010', doc: 'Curso de trabajo en altura', dias: 28 },
];

const avisos = [
  { titulo: 'Actualización de requisitos de ingreso', texto: 'Se actualizó la lista de documentos exigidos para nuevos ingresos.', fecha: 'Ejemplo' },
  { titulo: 'Recordatorio de vencimientos', texto: 'Revisa los documentos que vencen en los próximos 30 días.', fecha: 'Ejemplo' },
];

const $ = (id) => document.getElementById(id);

function nivel(pct) {
  if (pct < 60) return { clase: 'bajo', texto: 'Bajo' };
  if (pct < 85) return { clase: 'medio', texto: 'Medio' };
  return { clase: 'alto', texto: 'Alto' };
}

function pintarTabla() {
  const body = $('docs-body');
  body.replaceChildren();
  vencimientos.forEach((v) => {
    const tr = document.createElement('tr');
    const celdas = [
      ['worker', v.nombre],
      ['', v.rut],
      ['', v.doc],
      ['due' + (v.dias > 15 ? ' warn' : ''), `En ${v.dias} ${v.dias === 1 ? 'día' : 'días'}`],
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
}

function pintarCumplimiento() {
  const pct = Math.round((trabajadores.acreditados / trabajadores.total) * 1000) / 10;
  const n = nivel(pct);

  $('nivel-valor').textContent = pct.toLocaleString('es-PE', { minimumFractionDigits: 1 }) + '%';
  const badge = $('nivel-badge');
  badge.textContent = n.texto;
  badge.className = 'badge ' + n.clase;

  const bar = $('nivel-bar');
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

  let acumulado = 0;
  const tramos = partes
    .filter((p) => p.n > 0)
    .map((p) => {
      const ini = (acumulado / trabajadores.total) * 360;
      acumulado += p.n;
      const fin = (acumulado / trabajadores.total) * 360;
      return `${p.color} ${ini}deg ${fin}deg`;
    });
  $('donut').style.background = `conic-gradient(${tramos.join(', ')})`;

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
  const total = vencimientos.length;
  const criticos = vencimientos.filter((v) => v.dias < 15).length;
  $('docs-total').textContent = total;

  const alerta = $('docs-alert');
  alerta.classList.toggle('hidden', criticos === 0);
  alerta.textContent = `⚠ ${criticos} vencen en menos de 15 días`;

  $('docs-badge').hidden = criticos === 0;
}

function pintarAvisos() {
  const lista = $('aviso-list');
  lista.replaceChildren();
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

// Menú móvil
const toggle = document.querySelector('.menu-toggle');
const menu = $('menu');
toggle.addEventListener('click', () => {
  const abierto = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(abierto));
});

$('btn-ayuda').addEventListener('click', () => alert('Ayuda: próximamente.'));
$('btn-reportes').addEventListener('click', () => alert('Reportes de acreditación: próximamente.'));

$('year').textContent = new Date().getFullYear();

pintarTabla();
pintarCumplimiento();
pintarDonut();
pintarVencimientos();
pintarAvisos();
