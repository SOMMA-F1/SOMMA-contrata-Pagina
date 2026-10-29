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

  // Usuario en sesión y botón para cerrarla (solo en páginas con sesión).
  const enlaces = document.querySelector('.toplinks');
  const sesion = typeof leerSesion === 'function' ? leerSesion() : null;
  if (enlaces && sesion) {
    const caja = document.createElement('div');
    caja.className = 'sesion-usuario';
    const nombre = document.createElement('span');
    nombre.textContent = sesion.rol === 'admin' ? 'Administrador' : (sesion.nombre || sesion.usuario);
    const salir = document.createElement('button');
    salir.type = 'button';
    salir.textContent = 'Cerrar sesión';
    salir.addEventListener('click', cerrarSesion);
    caja.append(nombre, salir);
    enlaces.appendChild(caja);
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
