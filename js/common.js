// Comportamiento compartido por todas las páginas: menú móvil, año del pie y sesión.
(function () {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const abierto = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(abierto));
    });
  }

  // Usuario en sesión (avatar, nombre y rol) y botón para cerrarla (solo en páginas con sesión).
  const enlaces = document.querySelector('.toplinks');
  const sesion = typeof leerSesion === 'function' ? leerSesion() : null;
  if (enlaces && sesion) {
    const esAdmin = sesion.rol === 'admin';
    const nombreCompleto = sesion.nombre || sesion.usuario || '';

    const caja = document.createElement('div');
    caja.className = 'sesion-usuario';

    const avatar = document.createElement('span');
    avatar.className = 'sesion-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = (nombreCompleto.trim()[0] || '?').toUpperCase();

    const datos = document.createElement('span');
    datos.className = 'sesion-datos';
    const nombre = document.createElement('strong');
    nombre.textContent = nombreCompleto;
    nombre.title = nombreCompleto;
    const rol = document.createElement('small');
    rol.textContent = esAdmin ? 'Administrador' : 'Contrata';
    datos.append(nombre, rol);

    const salir = document.createElement('button');
    salir.type = 'button';
    salir.className = 'btn-salir';
    salir.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg>';
    salir.append('Cerrar sesión');
    salir.addEventListener('click', cerrarSesion);

    caja.append(avatar, datos, salir);
    enlaces.appendChild(caja);

    // En el celular los enlaces de arriba se ocultan: la sesión se cierra desde el menú.
    const pestanas = document.getElementById('menu');
    if (pestanas) {
      const movil = document.createElement('button');
      movil.type = 'button';
      movil.className = 'tab tab-salir';
      movil.textContent = `Cerrar sesión (${nombreCompleto})`;
      movil.addEventListener('click', cerrarSesion);
      pestanas.appendChild(movil);
    }
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
