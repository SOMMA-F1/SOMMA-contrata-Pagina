// Aún no hay fuente de datos conectada: todo arranca vacío.
// Cuando exista (Supabase u otra), solo hay que llenar estas tres variables.
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
  const total = vencimientos.length;
  const criticos = vencimientos.filter((v) => v.dias < 15).length;
  $('docs-total').textContent = total;

  const alerta = $('docs-alert');
  alerta.classList.toggle('hidden', criticos === 0);
  alerta.textContent = `⚠ ${criticos} vencen en menos de 15 días`;

  const badge = $('docs-badge');
  if (total === 0) {
    badge.textContent = 'Sin datos';
    badge.className = 'badge sin-datos';
  } else if (criticos > 0) {
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
