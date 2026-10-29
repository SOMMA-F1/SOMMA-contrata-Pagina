const form = document.getElementById('form-campo');
const status = document.getElementById('form-status');
const fecha = document.getElementById('fecha');
const altoRiesgo = document.getElementById('alto-riesgo');
const seccionDocs = document.getElementById('sec-docs');
const listaDocs = document.getElementById('docs-lista');

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

form.addEventListener('submit', (e) => {
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

  // Pendiente: guardar los archivos y los datos en Supabase.
  status.textContent = 'Datos válidos. El guardado se activará cuando se conecte el almacenamiento de archivos.';
  status.classList.add('ok');
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
