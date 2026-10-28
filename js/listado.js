// Aún no hay fuente de datos conectada: el listado arranca vacío.
// Cuando exista, solo hay que llenar este arreglo con objetos:
// { id, nombre, rut, cargo, venc: 'AAAA-MM-DD' | null, dias: número | null, estado: 'Acreditado' | 'No acreditado' }
const trabajadores = [];

const $ = (id) => document.getElementById(id);
const estado = { orden: { key: 'id', dir: 1 }, pagina: 1 };

function filtrar() {
  const q = $('buscar').value.trim().toLowerCase();
  const fEstado = $('f-estado').value;
  const fCargo = $('f-cargo').value.trim().toLowerCase();
  const fVenc = $('f-venc').value;

  return trabajadores.filter((t) => {
    if (q && ![t.id, t.nombre, t.rut, t.cargo, t.estado].join(' ').toLowerCase().includes(q)) return false;
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

function pintar() {
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
    td.colSpan = 7;
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
    celda(tr, t.nombre, 'worker');
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
