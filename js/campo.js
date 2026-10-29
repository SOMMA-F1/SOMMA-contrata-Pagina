const form = document.getElementById('form-campo');
const status = document.getElementById('form-status');
const fecha = document.getElementById('fecha');
const altoRiesgo = document.getElementById('alto-riesgo');
const seccionDocs = document.getElementById('sec-docs');
const listaDocs = document.getElementById('docs-lista');

const BUCKET = 'documentos-campo';
const MAX_MB = 10;
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// Documentos que siempre se anexan y los que se suman si el trabajo es de alto riesgo.
const DOCS_BASE = [
  { id: 'ats', texto: 'ATS' },
  { id: 'charla', texto: 'Charla de 5 minutos' },
  { id: 'epps', texto: 'Checklist de EPPs' },
];
const DOCS_ALTO_RIESGO = [
  { id: 'petar', texto: 'PETAR' },
  { id: 'herramientas', texto: 'Checklist inspección de herramientas' },
  { id: 'altura', texto: 'Checklist equipos de altura' },
  { id: 'escaleras', texto: 'Checklist pre uso de escaleras' },
];

// Fecha actual (hora local) y editable.
function hoy() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
fecha.value = hoy();

// La contrata sale de la sesión iniciada y no se puede editar.
const contrata = document.getElementById('contrata');
const sesion = leerSesion();
contrata.defaultValue = sesion ? (sesion.nombre || sesion.usuario) : '';
contrata.value = contrata.defaultValue;

function crearCampoArchivo(doc) {
  const caja = document.createElement('div');
  caja.className = 'field span-2';
  caja.innerHTML = `
    <label for="doc-${doc.id}">${doc.texto} <span class="req" aria-hidden="true">*</span></label>
    <input type="file" id="doc-${doc.id}" name="${doc.id}" accept=".pdf,image/jpeg,image/png,image/webp" required>
    <p class="field-error" role="alert"></p>`;
  const input = caja.querySelector('input');
  input.addEventListener('change', () => validar(input));
  return caja;
}

function pintarDocumentos() {
  const valor = altoRiesgo.value;
  listaDocs.replaceChildren();
  seccionDocs.hidden = valor === '';
  if (valor === '') return;
  const docs = valor === 'si' ? [...DOCS_BASE, ...DOCS_ALTO_RIESGO] : DOCS_BASE;
  docs.forEach((d) => listaDocs.appendChild(crearCampoArchivo(d)));
}

function mensaje(campo) {
  if (campo.type === 'file') {
    const archivo = campo.files[0];
    if (!archivo) return 'Adjunta este documento.';
    if (!TIPOS.includes(archivo.type)) return 'Solo se permite PDF o imagen (JPG, PNG, WEBP).';
    if (archivo.size > MAX_MB * 1024 * 1024) return `El archivo supera los ${MAX_MB} MB.`;
    return '';
  }
  if (campo.required && !campo.value.trim()) return 'Este campo es obligatorio.';
  return '';
}

function validar(campo) {
  const texto = mensaje(campo);
  const caja = campo.closest('.field');
  caja.classList.toggle('invalid', texto !== '');
  caja.querySelector('.field-error').textContent = texto;
  campo.setAttribute('aria-invalid', String(texto !== ''));
  return texto === '';
}

const camposFijos = [...form.querySelectorAll('#actividad, #site, #fecha, #alto-riesgo')];
camposFijos.forEach((c) => {
  c.addEventListener('blur', () => validar(c));
  c.addEventListener('input', () => {
    if (c.closest('.field').classList.contains('invalid')) validar(c);
  });
});

altoRiesgo.addEventListener('change', () => {
  // Al cambiar la respuesta se recalcula la lista; los archivos ya elegidos se descartan.
  pintarDocumentos();
  status.textContent = '';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.className = 'form-status';

  const campos = [...camposFijos, ...listaDocs.querySelectorAll('input[type="file"]')];
  const resultados = campos.map(validar);
  if (resultados.includes(false)) {
    status.textContent = 'Revisa los campos marcados.';
    status.classList.add('error');
    campos.find((c) => c.closest('.field').classList.contains('invalid')).focus();
    return;
  }

  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  status.textContent = 'Guardando...';

  try {
    // Los archivos van a la carpeta del usuario: <usuario>/<registro>/<tipo>-<nombre>.
    const registroId = crypto.randomUUID();
    const archivos = [];
    for (const input of listaDocs.querySelectorAll('input[type="file"]')) {
      const archivo = input.files[0];
      const doc = [...DOCS_BASE, ...DOCS_ALTO_RIESGO].find((d) => `doc-${d.id}` === input.id);
      const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ruta = `${sesion.user_id}/${registroId}/${doc.id}-${limpio}`;
      await subirArchivo(BUCKET, ruta, archivo);
      archivos.push({ tipo: doc.id, texto: doc.texto, nombre: archivo.name, ruta });
    }

    await supabase('documentos_campo', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: registroId,
        actividad: document.getElementById('actividad').value.trim(),
        site: document.getElementById('site').value.trim(),
        fecha: fecha.value,
        alto_riesgo: altoRiesgo.value === 'si',
        archivos,
      }),
    });

    // Copia a SharePoint en segundo plano: si falla, el registro queda guardado y marcado con error.
    reintentados.add(registroId);
    enviarASharePoint(registroId);

    form.reset();
    status.className = 'form-status ok';
    status.textContent = 'Documentos guardados correctamente.';
    cargarRegistros();
  } catch (err) {
    status.className = 'form-status error';
    status.textContent = 'No se pudo guardar. Inténtalo de nuevo.';
  } finally {
    boton.disabled = false;
  }
});

form.addEventListener('reset', () => {
  status.textContent = '';
  setTimeout(() => {
    fecha.value = hoy();
    pintarDocumentos();
    camposFijos.forEach((c) => {
      c.closest('.field').classList.remove('invalid');
      c.closest('.field').querySelector('.field-error').textContent = '';
      c.removeAttribute('aria-invalid');
    });
  });
});

// ---------- Registros guardados ----------
// La base ya filtra: la contrata recibe solo los suyos y el administrador recibe todos.
const esAdmin = sesion && sesion.rol === 'admin';
const cuerpoRegistros = document.getElementById('registros-body');
const subRegistros = document.getElementById('registros-sub');
document.querySelector('.col-contrata').hidden = !esAdmin;

function fechaLegible(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

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

function filaVacia(texto) {
  const tr = document.createElement('tr');
  tr.className = 'empty-row';
  const td = document.createElement('td');
  td.colSpan = esAdmin ? 8 : 7;
  td.textContent = texto;
  tr.appendChild(td);
  cuerpoRegistros.replaceChildren(tr);
}

const reintentados = new Set();

async function cargarRegistros() {
  try {
    const filas = await supabase('documentos_campo?select=*,perfiles(nombre)&order=creado_en.desc&limit=200');
    subRegistros.textContent = esAdmin
      ? `Todos los registros de las contratas (${filas.length}).`
      : `Tus registros (${filas.length}).`;
    if (filas.length === 0) { filaVacia('Aún no hay documentos registrados.'); return; }

    // Si una llamada a SharePoint se perdió (p. ej. se cerró la pestaña), se reintenta al cargar la lista.
    filas.filter((f) => f.sharepoint_estado === 'pendiente' && !reintentados.has(f.id)).forEach((f) => {
      reintentados.add(f.id);
      enviarASharePoint(f.id);
    });
    if (filas.some((f) => ['pendiente', 'enviando'].includes(f.sharepoint_estado))) setTimeout(cargarRegistros, 8000);

    cuerpoRegistros.replaceChildren(...filas.map((f) => {
      const tr = document.createElement('tr');
      const celda = (texto) => { const td = document.createElement('td'); td.textContent = texto; tr.appendChild(td); return td; };
      celda(fechaLegible(f.fecha));
      if (esAdmin) celda(f.perfiles ? f.perfiles.nombre : '-');
      celda(f.actividad);
      celda(f.site);
      const tdRiesgo = document.createElement('td');
      const marca = document.createElement('span');
      marca.className = 'estado ' + (f.alto_riesgo ? 'no' : 'ok');
      marca.textContent = f.alto_riesgo ? 'Sí' : 'No';
      tdRiesgo.appendChild(marca);
      tr.appendChild(tdRiesgo);

      const tdDocs = document.createElement('td');
      tdDocs.className = 'docs-chips';
      f.archivos.forEach((a) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip-doc';
        b.textContent = a.texto;
        b.title = a.nombre;
        b.addEventListener('click', () => abrirArchivo(b, a.ruta));
        tdDocs.appendChild(b);
      });
      tr.appendChild(tdDocs);

      const tdSp = document.createElement('td');
      const estadoSp = document.createElement('span');
      const textos = { enviado: ['ok', 'Enviado'], pendiente: ['pend', 'Enviando…'], enviando: ['pend', 'Enviando…'], error: ['no', 'Error'] };
      const [clase, texto] = textos[f.sharepoint_estado] || textos.pendiente;
      estadoSp.className = 'estado ' + clase;
      estadoSp.textContent = texto;
      if (f.sharepoint_detalle) estadoSp.title = f.sharepoint_detalle;
      tdSp.appendChild(estadoSp);
      if (f.sharepoint_estado === 'error') {
        const reintentar = document.createElement('button');
        reintentar.type = 'button';
        reintentar.className = 'chip-doc';
        reintentar.textContent = 'Reintentar';
        reintentar.addEventListener('click', async () => {
          reintentar.disabled = true;
          await enviarASharePoint(f.id);
          setTimeout(cargarRegistros, 6000);
        });
        tdSp.append(' ', reintentar);
      }
      tr.appendChild(tdSp);

      const tdAcc = document.createElement('td');
      const eliminar = document.createElement('button');
      eliminar.type = 'button';
      eliminar.className = 'btn-eliminar';
      eliminar.textContent = 'Eliminar';
      eliminar.addEventListener('click', async () => {
        const ok = confirm(`¿Eliminar el registro "${f.actividad}" y sus documentos?\n\nTambién se enviará su carpeta a la papelera de SharePoint.`);
        if (!ok) return;
        eliminar.disabled = true;
        eliminar.textContent = 'Eliminando…';
        const error = await eliminarRegistro(f.id);
        if (error) {
          eliminar.disabled = false;
          eliminar.textContent = 'Eliminar';
          status.className = 'form-status error';
          status.textContent = error;
          return;
        }
        status.className = 'form-status ok';
        status.textContent = 'Registro eliminado.';
        cargarRegistros();
      });
      tdAcc.appendChild(eliminar);
      tr.appendChild(tdAcc);
      return tr;
    }));
  } catch {
    subRegistros.textContent = '';
    filaVacia('No se pudieron cargar los registros.');
  }
}

document.getElementById('btn-recargar').addEventListener('click', cargarRegistros);
cargarRegistros();
