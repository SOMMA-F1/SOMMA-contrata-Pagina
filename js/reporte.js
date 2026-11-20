const form = document.getElementById('form-reporte');
const status = document.getElementById('form-status');
const ticket = document.getElementById('ticket');
const site = document.getElementById('site');
const responsable = document.getElementById('responsable');

const sesion = leerSesion();
const esAdmin = sesion && sesion.rol === 'admin';

// La contratista sale de la sesión iniciada y no se puede editar.
const contratista = document.getElementById('contratista');
contratista.defaultValue = sesion ? (sesion.nombre || sesion.usuario) : '';
contratista.value = contratista.defaultValue;

// El ticket son los 8 primeros caracteres del id del reporte (la base calcula el mismo valor).
let reporteId = crypto.randomUUID();
function nuevoTicket() {
  reporteId = crypto.randomUUID();
  ticket.value = reporteId.slice(0, 8);
}
nuevoTicket();

function validar(campo) {
  const vacio = !campo.value.trim();
  const caja = campo.closest('.field');
  caja.classList.toggle('invalid', vacio);
  caja.querySelector('.field-error').textContent = vacio ? 'Este campo es obligatorio.' : '';
  campo.setAttribute('aria-invalid', String(vacio));
  return !vacio;
}

const camposFijos = [site, responsable];
camposFijos.forEach((c) => {
  c.addEventListener('blur', () => validar(c));
  c.addEventListener('input', () => {
    if (c.closest('.field').classList.contains('invalid')) validar(c);
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.className = 'form-status';

  const resultados = camposFijos.map(validar);
  if (resultados.includes(false)) {
    status.textContent = 'Revisa los campos marcados.';
    status.classList.add('error');
    camposFijos.find((c) => c.closest('.field').classList.contains('invalid')).focus();
    return;
  }

  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  status.textContent = 'Enviando...';

  try {
    await supabase('reportes_diarios', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: reporteId,
        site: site.value.trim(),
        responsable: responsable.value.trim(),
      }),
    });
    const enviado = ticket.value;
    form.reset();
    status.className = 'form-status ok';
    status.textContent = `Reporte ${enviado} enviado correctamente.`;
    cargarReportes();
  } catch {
    status.className = 'form-status error';
    status.textContent = 'No se pudo enviar. Inténtalo de nuevo.';
  } finally {
    boton.disabled = false;
  }
});

form.addEventListener('reset', () => {
  status.textContent = '';
  setTimeout(() => {
    nuevoTicket();
    camposFijos.forEach((c) => {
      c.closest('.field').classList.remove('invalid');
      c.closest('.field').querySelector('.field-error').textContent = '';
      c.removeAttribute('aria-invalid');
    });
  });
});

// ---------- Sites ya usados (sugerencias para el campo) ----------
async function cargarSites() {
  try {
    const [campo, reportes] = await Promise.all([
      supabase('documentos_campo?select=site&limit=500'),
      supabase('reportes_diarios?select=site&limit=500'),
    ]);
    const sites = [...new Set([...campo, ...reportes].map((f) => f.site))].sort((a, b) => a.localeCompare(b, 'es'));
    document.getElementById('lista-sites').replaceChildren(...sites.map((s) => {
      const o = document.createElement('option');
      o.value = s;
      return o;
    }));
  } catch { /* sin sugerencias: el campo sigue siendo de texto libre */ }
}

// ---------- Reportes enviados ----------
// La base ya filtra: la contrata recibe solo los suyos y el administrador recibe todos.
const cuerpo = document.getElementById('reportes-body');
const sub = document.getElementById('reportes-sub');
document.querySelector('.col-contrata').hidden = !esAdmin;

function fechaHora(iso) {
  return new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' });
}

function filaVacia(texto) {
  const tr = document.createElement('tr');
  tr.className = 'empty-row';
  const td = document.createElement('td');
  td.colSpan = esAdmin ? 5 : 4;
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
      celda(fechaHora(f.creado_en), 'nowrap');
      celda(f.ticket, 'nowrap');
      if (esAdmin) celda(f.perfiles ? f.perfiles.nombre : '-', 'col-texto');
      celda(f.site, 'col-texto');
      celda(f.responsable, 'col-texto');
      return tr;
    }));
  } catch {
    sub.textContent = '';
    filaVacia('No se pudieron cargar los reportes.');
  }
}

document.getElementById('btn-recargar').addEventListener('click', cargarReportes);
cargarSites();
cargarReportes();
