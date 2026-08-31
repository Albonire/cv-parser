/**
 * Plantillas de maquetacion para el banco de hojas de vida escaneadas.
 *
 * Cada plantilla devuelve HTML de una o dos hojas carta (850 x 1100 px CSS, que
 * a deviceScaleFactor 2 dan 1700 x 2200 px, es decir unos 200 ppp). El objetivo
 * no es que sean bonitas sino que cada una rompa una suposicion distinta del
 * motor: orden de lectura, presencia de encabezados, tamano tipografico,
 * contraste, posicion del bloque de contacto.
 *
 * No hay tipografias manuscritas en el contenedor, asi que el caso dificil de
 * escritura a mano se aproxima con una serif italica inclinada. Es un limite
 * superior conocido, no una simulacion fiel.
 */

const SANS = "'Liberation Sans', 'DejaVu Sans', Arial, sans-serif";
const SERIF = "'Liberation Serif', 'DejaVu Serif', 'Bitstream Charter', serif";
const MONO = "'Courier 10 Pitch', 'Liberation Mono', 'DejaVu Sans Mono', monospace";

function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Nombre completo tal como lo escribiria la persona en su hoja de vida. */
function nombreCompleto(cv) {
  return `${cv.nombres} ${cv.apellidos}`;
}

function documento(cv) {
  return cv.cedula.length > 9 ? `C.C. ${cv.cedula}` : `C.C. ${cv.cedula}`;
}

function experienciaTexto(cv) {
  return cv.experiencia.map((e) => ({
    empresa: e.empresa,
    cargo: e.cargo,
    fechas: e.fechas,
    detalle:
      e.detalle ||
      `Responsable de las funciones propias del cargo de ${e.cargo.toLowerCase()} en ${e.empresa}.`,
  }));
}

function envolver({ estilos, cuerpo, fuente = SANS }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 850px; background: #ffffff; color: #111111; font-family: ${fuente}; }
.hoja { width: 850px; height: 1100px; background: #ffffff; overflow: hidden; position: relative; }
${estilos}
</style></head><body>${cuerpo}</body></html>`;
}

/* ------------------------------------------------------------------ */
/* 1. Una columna clasica, encabezados claros                          */
/* ------------------------------------------------------------------ */
function unaColumnaClasica(cv) {
  const exp = experienciaTexto(cv);
  const cuerpo = `<div class="hoja">
  <h1>${esc(nombreCompleto(cv))}</h1>
  <p class="cargo">${esc(cv.titular)}</p>
  <p class="contacto">${esc(documento(cv))} &nbsp;|&nbsp; Tel. ${esc(cv.telefono)} &nbsp;|&nbsp; ${esc(cv.correo)} &nbsp;|&nbsp; ${esc(cv.ciudad)}</p>
  <h2>PERFIL PROFESIONAL</h2>
  <p class="parrafo">${esc(cv.resumen)}</p>
  <h2>EXPERIENCIA LABORAL</h2>
  ${exp
    .map(
      (e) => `<div class="bloque">
    <p class="titulo">${esc(e.cargo)}</p>
    <p class="sub">${esc(e.empresa)} &mdash; ${esc(e.fechas)}</p>
    <p class="detalle">${esc(e.detalle)}</p>
  </div>`
    )
    .join('')}
  <h2>FORMACIÓN ACADÉMICA</h2>
  ${cv.educacion
    .map(
      (ed) => `<div class="bloque">
    <p class="titulo">${esc(ed.titulo)}</p>
    <p class="sub">${esc(ed.institucion)} &mdash; ${esc(ed.anio)} &mdash; ${esc(ed.nivel)}</p>
  </div>`
    )
    .join('')}
  <h2>HABILIDADES</h2>
  <p class="parrafo">${cv.habilidades.map(esc).join(' &middot; ')}</p>
  <h2>IDIOMAS</h2>
  <p class="parrafo">${cv.idiomas.map(([i, n]) => `${esc(i)}: ${esc(n)}`).join(' &middot; ')}</p>
  <h2>REFERENCIAS</h2>
  <p class="parrafo">${cv.referencias.map((r) => `${esc(r.nombre)} (${esc(r.tipo)}) ${esc(r.telefono)}`).join(' &middot; ')}</p>
</div>`;

  return {
    paginas: 1,
    html: envolver({
      cuerpo,
      estilos: `
.hoja { padding: 58px 64px; }
h1 { font-size: 28px; letter-spacing: 0.5px; }
.cargo { font-size: 15px; margin-top: 4px; color: #333; }
.contacto { font-size: 11.5px; margin-top: 10px; padding-bottom: 14px; border-bottom: 1.5px solid #222; }
h2 { font-size: 13px; letter-spacing: 1.2px; margin-top: 22px; margin-bottom: 8px; }
.parrafo { font-size: 11.5px; line-height: 1.5; }
.bloque { margin-bottom: 12px; }
.titulo { font-size: 12.5px; font-weight: bold; }
.sub { font-size: 11px; color: #333; }
.detalle { font-size: 11px; line-height: 1.45; margin-top: 3px; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 2. Dos columnas con barra lateral de color                          */
/* ------------------------------------------------------------------ */
function dosColumnasBarra(cv) {
  const exp = experienciaTexto(cv);
  const cuerpo = `<div class="hoja">
  <aside>
    <h3>CONTACTO</h3>
    <p>${esc(documento(cv))}</p>
    <p>${esc(cv.telefono)}</p>
    <p>${esc(cv.correo)}</p>
    <p>${esc(cv.ciudad)}</p>
    <h3>HABILIDADES</h3>
    ${cv.habilidades.map((h) => `<p>&bull; ${esc(h)}</p>`).join('')}
    <h3>IDIOMAS</h3>
    ${cv.idiomas.map(([i, n]) => `<p>${esc(i)}: ${esc(n)}</p>`).join('')}
    <h3>CERTIFICACIONES</h3>
    ${cv.certificaciones.map((c) => `<p>${esc(c.nombre)}, ${esc(c.institucion)} (${esc(c.anio)})</p>`).join('')}
  </aside>
  <main>
    <h1>${esc(nombreCompleto(cv))}</h1>
    <p class="cargo">${esc(cv.titular)}</p>
    <h2>PERFIL</h2>
    <p class="parrafo">${esc(cv.resumen)}</p>
    <h2>EXPERIENCIA</h2>
    ${exp
      .map(
        (e) => `<div class="bloque">
      <p class="titulo">${esc(e.cargo)}</p>
      <p class="sub">${esc(e.empresa)}</p>
      <p class="sub">${esc(e.fechas)}</p>
      <p class="detalle">${esc(e.detalle)}</p>
    </div>`
      )
      .join('')}
    <h2>EDUCACIÓN</h2>
    ${cv.educacion
      .map(
        (ed) =>
          `<div class="bloque"><p class="titulo">${esc(ed.titulo)}</p><p class="sub">${esc(ed.institucion)}, ${esc(ed.anio)}</p></div>`
      )
      .join('')}
    <h2>REFERENCIAS</h2>
    ${cv.referencias.map((r) => `<p class="detalle">${esc(r.nombre)} &mdash; ${esc(r.tipo)} &mdash; ${esc(r.telefono)}</p>`).join('')}
  </main>
</div>`;

  return {
    paginas: 1,
    html: envolver({
      cuerpo,
      estilos: `
.hoja { display: flex; }
aside { width: 290px; background: #1f3a5f; color: #ffffff; padding: 48px 26px; }
aside h3 { font-size: 11.5px; letter-spacing: 1.4px; margin: 20px 0 7px; border-bottom: 1px solid rgba(255,255,255,.45); padding-bottom: 4px; }
aside h3:first-child { margin-top: 0; }
aside p { font-size: 10.5px; line-height: 1.55; }
main { flex: 1; padding: 48px 40px; }
h1 { font-size: 25px; line-height: 1.15; }
.cargo { font-size: 13.5px; color: #1f3a5f; margin-top: 5px; margin-bottom: 6px; }
h2 { font-size: 12.5px; letter-spacing: 1.2px; color: #1f3a5f; margin-top: 18px; margin-bottom: 7px; }
.parrafo { font-size: 11px; line-height: 1.5; }
.bloque { margin-bottom: 11px; }
.titulo { font-size: 12px; font-weight: bold; }
.sub { font-size: 10.5px; color: #444; }
.detalle { font-size: 10.5px; line-height: 1.45; margin-top: 3px; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 3. Sin ningun encabezado de seccion                                 */
/* ------------------------------------------------------------------ */
function sinEncabezados(cv) {
  const exp = experienciaTexto(cv);
  const cuerpo = `<div class="hoja">
  <p class="nombre">${esc(nombreCompleto(cv))}</p>
  <p>${esc(cv.titular)}</p>
  <p>${esc(documento(cv))}</p>
  <p>${esc(cv.telefono)}</p>
  <p>${esc(cv.correo)}</p>
  <p>${esc(cv.ciudad)}</p>
  <p class="esp">${esc(cv.resumen)}</p>
  ${exp
    .map(
      (e) =>
        `<p class="esp">${esc(e.cargo)}, ${esc(e.empresa)}, ${esc(e.fechas)}. ${esc(e.detalle)}</p>`
    )
    .join('')}
  ${cv.educacion
    .map((ed) => `<p class="esp">${esc(ed.titulo)}, ${esc(ed.institucion)}, ${esc(ed.anio)}.</p>`)
    .join('')}
  <p class="esp">${cv.habilidades.map(esc).join(', ')}.</p>
  <p class="esp">${cv.idiomas.map(([i, n]) => `${esc(i)} ${esc(n)}`).join(', ')}.</p>
  <p class="esp">${cv.referencias.map((r) => `${esc(r.nombre)}, ${esc(r.telefono)}`).join('. ')}.</p>
</div>`;

  return {
    paginas: 1,
    html: envolver({
      fuente: SERIF,
      cuerpo,
      estilos: `
.hoja { padding: 70px 76px; }
p { font-size: 12px; line-height: 1.55; }
.nombre { font-size: 14px; font-weight: bold; }
.esp { margin-top: 14px; text-align: justify; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 4. Formulario tipo Minerva (etiqueta: valor)                        */
/* ------------------------------------------------------------------ */
function formularioMinerva(cv) {
  const exp = experienciaTexto(cv);
  const fila = (etiqueta, valor) =>
    `<tr><td class="et">${esc(etiqueta)}</td><td class="va">${esc(valor)}</td></tr>`;

  const cuerpo = `<div class="hoja">
  <p class="tituloDoc">HOJA DE VIDA</p>
  <table>
    ${fila('APELLIDOS', cv.apellidos)}
    ${fila('NOMBRES', cv.nombres)}
    ${fila('CÉDULA DE CIUDADANÍA', cv.cedula)}
    ${fila('TELÉFONO', cv.telefono)}
    ${fila('CORREO ELECTRÓNICO', cv.correo)}
    ${fila('CIUDAD DE RESIDENCIA', cv.ciudad)}
    ${fila('CARGO AL QUE ASPIRA', cv.titular)}
    ${cv.licencia ? fila('LICENCIA DE CONDUCCIÓN', cv.licencia) : ''}
    ${cv.libreta ? fila('LIBRETA MILITAR', cv.libreta) : ''}
  </table>
  <p class="seccion">ESTUDIOS REALIZADOS</p>
  <table>
    ${cv.educacion.map((ed) => fila(ed.nivel, `${ed.titulo} - ${ed.institucion} - ${ed.anio}`)).join('')}
  </table>
  <p class="seccion">EXPERIENCIA LABORAL</p>
  <table>
    ${exp.map((e) => fila(e.empresa, `${e.cargo} - ${e.fechas}`)).join('')}
  </table>
  <p class="seccion">REFERENCIAS</p>
  <table>
    ${cv.referencias.map((r) => fila(r.tipo, `${r.nombre} - ${r.telefono}`)).join('')}
  </table>
  <p class="firma">Firma: ______________________________</p>
</div>`;

  return {
    paginas: 1,
    html: envolver({
      cuerpo,
      estilos: `
.hoja { padding: 54px 60px; }
.tituloDoc { font-size: 18px; text-align: center; letter-spacing: 3px; margin-bottom: 22px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
td { border: 1px solid #555; padding: 6px 8px; vertical-align: top; }
.et { width: 34%; font-size: 10.5px; font-weight: bold; background: #eeeeee; }
.va { font-size: 11.5px; }
.seccion { font-size: 12px; font-weight: bold; margin: 18px 0 6px; }
.firma { font-size: 11px; margin-top: 44px; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 5. Cuerpo 7,5 pt, denso, dos paginas                                */
/* ------------------------------------------------------------------ */
function densoDosPaginas(cv) {
  const exp = experienciaTexto(cv);
  const LOGROS = [
    'Cumplimiento sostenido de los indicadores del área durante todo el periodo, con reporte mensual al jefe inmediato.',
    'Seguimiento a los procedimientos internos y apoyo a las auditorías periódicas de la compañía.',
    'Atención de requerimientos de clientes internos y externos dentro de los tiempos pactados.',
    'Elaboración y control de la documentación del proceso conforme al sistema de gestión de calidad.',
    'Capacitación al personal nuevo en las funciones propias del cargo y en las normas de seguridad.',
    'Manejo de inventarios y control de consumibles asignados al área de trabajo.',
    'Participación en los comités operativos y en los planes de mejoramiento continuo.',
    'Consolidación de informes de gestión para la gerencia con periodicidad mensual.',
  ];
  const relleno = (n, desfase = 0) =>
    Array.from({ length: n })
      .map(
        (_, k) =>
          `<p class="d">&bull; ${esc(LOGROS[(k + desfase) % LOGROS.length])}</p>`
      )
      .join('');

  const cuerpo = `<div class="hoja">
  <h1>${esc(nombreCompleto(cv))}</h1>
  <p class="cargo">${esc(cv.titular)} &nbsp;&bull;&nbsp; ${esc(documento(cv))} &nbsp;&bull;&nbsp; ${esc(cv.telefono)} &nbsp;&bull;&nbsp; ${esc(cv.correo)} &nbsp;&bull;&nbsp; ${esc(cv.ciudad)}</p>
  <h2>PERFIL PROFESIONAL</h2>
  <p class="d">${esc(cv.resumen)}</p>
  <h2>EXPERIENCIA LABORAL</h2>
  ${exp
    .map(
      (e, k) => `<p class="t">${esc(e.cargo)} &mdash; ${esc(e.empresa)} (${esc(e.fechas)})</p>
  <p class="d">${esc(e.detalle)}</p>${relleno(7, k)}`
    )
    .join('')}
  <h2>COMPETENCIAS</h2>
  <p class="d">${cv.habilidades.map(esc).join(', ')}, orientacion al detalle, manejo de indicadores, comunicacion asertiva, trabajo bajo presion, gestion documental.</p>
</div>
<div class="hoja">
  <h2>FORMACIÓN ACADÉMICA</h2>
  ${cv.educacion
    .map(
      (ed) =>
        `<p class="t">${esc(ed.titulo)} (${esc(ed.nivel)})</p><p class="d">${esc(ed.institucion)}, ${esc(ed.anio)}.</p>`
    )
    .join('')}
  <h2>CERTIFICACIONES</h2>
  ${cv.certificaciones
    .map((c) => `<p class="d">${esc(c.nombre)} &mdash; ${esc(c.institucion)}, ${esc(c.anio)}.</p>`)
    .join('')}
  <h2>LOGROS Y RECONOCIMIENTOS</h2>
  ${relleno(8, 2)}
  <h2>OTRA INFORMACIÓN</h2>
  ${relleno(8, 5)}
  <h2>IDIOMAS</h2>
  <p class="d">${cv.idiomas.map(([i, n]) => `${esc(i)}: ${esc(n)}`).join('. ')}.</p>
  <h2>REFERENCIAS PERSONALES Y LABORALES</h2>
  ${cv.referencias
    .map((r) => `<p class="d">${esc(r.nombre)} &mdash; ${esc(r.tipo)} &mdash; ${esc(r.telefono)}</p>`)
    .join('')}
</div>`;

  return {
    paginas: 2,
    html: envolver({
      cuerpo,
      estilos: `
.hoja { padding: 46px 54px; }
h1 { font-size: 16px; }
.cargo { font-size: 8.5px; margin-top: 3px; margin-bottom: 10px; }
h2 { font-size: 9.5px; letter-spacing: 1px; margin-top: 13px; margin-bottom: 4px; border-bottom: 1px solid #888; }
.t { font-size: 9px; font-weight: bold; margin-top: 6px; }
.d { font-size: 7.5px; line-height: 1.35; text-align: justify; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 6. Cuerpo grande y muy espaciado                                    */
/* ------------------------------------------------------------------ */
function grandeEspaciado(cv) {
  const exp = experienciaTexto(cv);
  const cuerpo = `<div class="hoja">
  <h1>${esc(nombreCompleto(cv))}</h1>
  <p class="cargo">${esc(cv.titular)}</p>
  <p class="c">${esc(cv.telefono)}</p>
  <p class="c">${esc(cv.correo)}</p>
  <p class="c">${esc(cv.ciudad)}</p>
  <p class="c">${esc(documento(cv))}</p>
  <h2>EXPERIENCIA</h2>
  ${exp
    .map(
      (e) => `<p class="t">${esc(e.cargo)}</p><p class="c">${esc(e.empresa)}, ${esc(e.fechas)}</p>`
    )
    .join('')}
  <h2>ESTUDIOS</h2>
  ${cv.educacion.map((ed) => `<p class="c">${esc(ed.titulo)}, ${esc(ed.institucion)}, ${esc(ed.anio)}</p>`).join('')}
</div>`;

  return {
    paginas: 1,
    html: envolver({
      cuerpo,
      estilos: `
.hoja { padding: 72px 80px; }
h1 { font-size: 32px; margin-bottom: 8px; }
.cargo { font-size: 18px; margin-bottom: 22px; color: #333; }
h2 { font-size: 17px; letter-spacing: 1.5px; margin: 30px 0 12px; }
.t { font-size: 17px; font-weight: bold; margin-top: 14px; }
.c { font-size: 15px; line-height: 2.0; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 7. Encabezado oscuro a sangre, nombre en blanco                     */
/* ------------------------------------------------------------------ */
function encabezadoOscuro(cv) {
  const exp = experienciaTexto(cv);
  const cuerpo = `<div class="hoja">
  <header>
    <h1>${esc(nombreCompleto(cv))}</h1>
    <p class="cargo">${esc(cv.titular)}</p>
    <p class="con">${esc(cv.telefono)} &nbsp;&nbsp; ${esc(cv.correo)} &nbsp;&nbsp; ${esc(cv.ciudad)} &nbsp;&nbsp; ${esc(documento(cv))}</p>
  </header>
  <section>
    <h2>Resumen</h2>
    <p class="p">${esc(cv.resumen)}</p>
    <h2>Trayectoria</h2>
    ${exp
      .map(
        (e) =>
          `<p class="t">${esc(e.cargo)} | ${esc(e.empresa)}</p><p class="s">${esc(e.fechas)}</p><p class="p">${esc(e.detalle)}</p>`
      )
      .join('')}
    <h2>Estudios</h2>
    ${cv.educacion.map((ed) => `<p class="p">${esc(ed.titulo)} &mdash; ${esc(ed.institucion)} &mdash; ${esc(ed.anio)}</p>`).join('')}
    <h2>Habilidades</h2>
    <p class="p">${cv.habilidades.map(esc).join(' / ')}</p>
    <h2>Idiomas</h2>
    <p class="p">${cv.idiomas.map(([i, n]) => `${esc(i)} (${esc(n)})`).join(' / ')}</p>
  </section>
</div>`;

  return {
    paginas: 1,
    html: envolver({
      cuerpo,
      estilos: `
header { background: #16302b; color: #ffffff; padding: 46px 60px 34px; }
h1 { font-size: 27px; }
.cargo { font-size: 14px; margin-top: 5px; color: #cfe3dd; }
.con { font-size: 11px; margin-top: 12px; color: #e6f0ed; }
section { padding: 30px 60px; }
h2 { font-size: 15px; color: #16302b; margin-top: 18px; margin-bottom: 6px; }
.t { font-size: 12.5px; font-weight: bold; margin-top: 9px; }
.s { font-size: 10.5px; color: #555; }
.p { font-size: 11.5px; line-height: 1.5; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 8. Secciones desordenadas, contacto al final                        */
/* ------------------------------------------------------------------ */
function seccionesDesordenadas(cv) {
  const exp = experienciaTexto(cv);
  const cuerpo = `<div class="hoja">
  <h2>FORMACIÓN ACADÉMICA</h2>
  ${cv.educacion.map((ed) => `<p class="p">${esc(ed.nivel)}: ${esc(ed.titulo)}. ${esc(ed.institucion)}, ${esc(ed.anio)}.</p>`).join('')}
  <h2>CERTIFICACIONES</h2>
  ${cv.certificaciones.map((c) => `<p class="p">${esc(c.nombre)}. ${esc(c.institucion)}, ${esc(c.anio)}.</p>`).join('')}
  <h2>EXPERIENCIA LABORAL</h2>
  ${exp.map((e) => `<p class="t">${esc(e.empresa)}</p><p class="p">${esc(e.cargo)}. ${esc(e.fechas)}. ${esc(e.detalle)}</p>`).join('')}
  <h2>HABILIDADES</h2>
  <p class="p">${cv.habilidades.map(esc).join(', ')}.</p>
  <h2>IDIOMAS</h2>
  <p class="p">${cv.idiomas.map(([i, n]) => `${esc(i)}: ${esc(n)}`).join('. ')}.</p>
  <h2>REFERENCIAS</h2>
  ${cv.referencias.map((r) => `<p class="p">${esc(r.nombre)}, ${esc(r.tipo)}, ${esc(r.telefono)}.</p>`).join('')}
  <h2>DATOS PERSONALES</h2>
  <p class="p">Nombre: ${esc(nombreCompleto(cv))}</p>
  <p class="p">Cargo de interés: ${esc(cv.titular)}</p>
  <p class="p">Documento: ${esc(cv.cedula)}</p>
  <p class="p">Teléfono: ${esc(cv.telefono)}</p>
  <p class="p">Correo: ${esc(cv.correo)}</p>
  <p class="p">Ciudad: ${esc(cv.ciudad)}</p>
</div>`;

  return {
    paginas: 1,
    html: envolver({
      fuente: SERIF,
      cuerpo,
      estilos: `
.hoja { padding: 56px 64px; }
h2 { font-size: 13px; letter-spacing: 1px; margin-top: 18px; margin-bottom: 6px; text-decoration: underline; }
.t { font-size: 12px; font-weight: bold; margin-top: 8px; }
.p { font-size: 11.5px; line-height: 1.5; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 9. Tabla de experiencia con bordes                                  */
/* ------------------------------------------------------------------ */
function tablaConBordes(cv) {
  const exp = experienciaTexto(cv);
  const cuerpo = `<div class="hoja">
  <div class="cab">
    <p class="nombre">${esc(nombreCompleto(cv))}</p>
    <p class="cargo">${esc(cv.titular)}</p>
    <p class="con">${esc(cv.telefono)} &nbsp;&nbsp;&nbsp; ${esc(cv.correo)}</p>
    <p class="con">${esc(cv.ciudad)} &nbsp;&nbsp;&nbsp; ${esc(documento(cv))}</p>
  </div>
  <p class="seccion">EXPERIENCIA LABORAL</p>
  <table>
    <tr><th>PERIODO</th><th>EMPRESA</th><th>CARGO</th></tr>
    ${exp.map((e) => `<tr><td>${esc(e.fechas)}</td><td>${esc(e.empresa)}</td><td>${esc(e.cargo)}</td></tr>`).join('')}
  </table>
  <p class="seccion">FORMACIÓN ACADÉMICA</p>
  <table>
    <tr><th>AÑO</th><th>INSTITUCIÓN</th><th>TÍTULO</th></tr>
    ${cv.educacion.map((ed) => `<tr><td>${esc(ed.anio)}</td><td>${esc(ed.institucion)}</td><td>${esc(ed.titulo)}</td></tr>`).join('')}
  </table>
  <p class="seccion">HABILIDADES E IDIOMAS</p>
  <table>
    <tr><td>${cv.habilidades.map(esc).join('<br>')}</td><td>${cv.idiomas.map(([i, n]) => `${esc(i)}: ${esc(n)}`).join('<br>')}</td></tr>
  </table>
  <p class="seccion">REFERENCIAS</p>
  <table>
    ${cv.referencias.map((r) => `<tr><td>${esc(r.nombre)}</td><td>${esc(r.tipo)}</td><td>${esc(r.telefono)}</td></tr>`).join('')}
  </table>
</div>`;

  return {
    paginas: 1,
    html: envolver({
      cuerpo,
      estilos: `
.hoja { padding: 52px 58px; }
.cab { border: 2px solid #7a1f1f; padding: 16px 20px; margin-bottom: 18px; }
.nombre { font-size: 22px; color: #7a1f1f; font-weight: bold; }
.cargo { font-size: 13px; margin-top: 3px; }
.con { font-size: 11px; margin-top: 5px; }
.seccion { font-size: 12px; font-weight: bold; color: #7a1f1f; margin: 16px 0 6px; }
table { width: 100%; border-collapse: collapse; }
th { background: #f0e2e2; font-size: 10.5px; }
th, td { border: 1px solid #7a1f1f; padding: 6px 8px; font-size: 11px; text-align: left; vertical-align: top; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 10. Contacto disperso en el pie de pagina                           */
/* ------------------------------------------------------------------ */
function contactoAlPie(cv) {
  const exp = experienciaTexto(cv);
  const cuerpo = `<div class="hoja">
  <div class="centro">
    <p class="nombre">${esc(nombreCompleto(cv))}</p>
    <p class="cargo">${esc(cv.titular)}</p>
  </div>
  <h2>OBJETIVO PROFESIONAL</h2>
  <p class="p">${esc(cv.resumen)}</p>
  <h2>EXPERIENCIA</h2>
  ${exp.map((e) => `<p class="t">${esc(e.cargo)} &ndash; ${esc(e.empresa)}</p><p class="p">${esc(e.fechas)}. ${esc(e.detalle)}</p>`).join('')}
  <h2>EDUCACIÓN</h2>
  ${cv.educacion.map((ed) => `<p class="p">${esc(ed.titulo)}, ${esc(ed.institucion)} (${esc(ed.anio)})</p>`).join('')}
  <h2>HABILIDADES</h2>
  <p class="p">${cv.habilidades.map(esc).join(' &bull; ')}</p>
  <footer>
    <p>${esc(cv.ciudad)}</p>
    <p>Celular ${esc(cv.telefono)}</p>
    <p>${esc(cv.correo)}</p>
    <p>${esc(documento(cv))}</p>
  </footer>
</div>`;

  return {
    paginas: 1,
    html: envolver({
      cuerpo,
      estilos: `
.hoja { padding: 60px 66px; position: relative; }
.centro { text-align: center; margin-bottom: 26px; }
.nombre { font-size: 26px; }
.cargo { font-size: 14px; color: #444; margin-top: 4px; }
h2 { font-size: 12.5px; letter-spacing: 1px; margin-top: 18px; margin-bottom: 6px; }
.t { font-size: 12px; font-weight: bold; margin-top: 8px; }
.p { font-size: 11.5px; line-height: 1.5; }
footer { position: absolute; left: 66px; right: 66px; bottom: 54px; border-top: 1px solid #333; padding-top: 10px; display: flex; justify-content: space-between; }
footer p { font-size: 10.5px; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 11. Nombre pequeno, encabezados de seccion enormes                  */
/* ------------------------------------------------------------------ */
function nombrePequenoTitularGrande(cv) {
  const exp = experienciaTexto(cv);
  const cuerpo = `<div class="hoja">
  <p class="nombre">${esc(nombreCompleto(cv).toUpperCase())}</p>
  <p class="micro">${esc(cv.titular)} &nbsp; ${esc(cv.telefono)} &nbsp; ${esc(cv.correo)} &nbsp; ${esc(cv.ciudad)} &nbsp; ${esc(documento(cv))}</p>
  <h2>TRAYECTORIA PROFESIONAL</h2>
  ${exp.map((e) => `<p class="t">${esc(e.cargo)}, ${esc(e.empresa)}</p><p class="p">${esc(e.fechas)}. ${esc(e.detalle)}</p>`).join('')}
  <h2>FORMACIÓN ACADÉMICA</h2>
  ${cv.educacion.map((ed) => `<p class="p">${esc(ed.titulo)} &mdash; ${esc(ed.institucion)} &mdash; ${esc(ed.anio)}</p>`).join('')}
  <h2>COMPETENCIAS</h2>
  <p class="p">${cv.habilidades.map(esc).join(', ')}</p>
  <h2>REFERENCIAS</h2>
  ${cv.referencias.map((r) => `<p class="p">${esc(r.nombre)} (${esc(r.tipo)}) &mdash; ${esc(r.telefono)}</p>`).join('')}
</div>`;

  return {
    paginas: 1,
    html: envolver({
      cuerpo,
      estilos: `
.hoja { padding: 58px 64px; }
.nombre { font-size: 14px; font-weight: bold; letter-spacing: 0.5px; }
.micro { font-size: 9.5px; color: #333; margin-top: 4px; margin-bottom: 16px; }
h2 { font-size: 26px; letter-spacing: 1px; margin-top: 22px; margin-bottom: 8px; color: #222; }
.t { font-size: 12px; font-weight: bold; margin-top: 8px; }
.p { font-size: 11.5px; line-height: 1.5; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 12. Serif italica inclinada (aproxima escritura a mano)             */
/* ------------------------------------------------------------------ */
function italicaInclinada(cv) {
  const exp = experienciaTexto(cv);
  const cuerpo = `<div class="hoja">
  <p class="nombre">${esc(nombreCompleto(cv))}</p>
  <p class="p">${esc(cv.titular)}</p>
  <p class="p">${esc(cv.telefono)} &mdash; ${esc(cv.correo)}</p>
  <p class="p">${esc(cv.ciudad)} &mdash; ${esc(documento(cv))}</p>
  <p class="h">Experiencia</p>
  ${exp.map((e) => `<p class="p">${esc(e.cargo)} en ${esc(e.empresa)}, ${esc(e.fechas)}.</p>`).join('')}
  <p class="h">Estudios</p>
  ${cv.educacion.map((ed) => `<p class="p">${esc(ed.titulo)}, ${esc(ed.institucion)}, ${esc(ed.anio)}.</p>`).join('')}
  <p class="h">Habilidades</p>
  <p class="p">${cv.habilidades.map(esc).join(', ')}.</p>
  <p class="h">Referencias</p>
  ${cv.referencias.map((r) => `<p class="p">${esc(r.nombre)}, ${esc(r.telefono)}.</p>`).join('')}
</div>`;

  return {
    paginas: 1,
    html: envolver({
      fuente: SERIF,
      cuerpo,
      estilos: `
.hoja { padding: 64px 70px; font-style: italic; }
.nombre { font-size: 20px; font-weight: bold; transform: skewX(-6deg); transform-origin: left; }
.h { font-size: 14px; font-weight: bold; margin-top: 18px; margin-bottom: 4px; }
.p { font-size: 13px; line-height: 1.8; transform: skewX(-4deg); transform-origin: left; }`,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 13. Mecanografiada monoespaciada, todo en mayusculas                */
/* ------------------------------------------------------------------ */
function mecanografiada(cv) {
  const exp = experienciaTexto(cv);
  const may = (t) => esc(String(t).toUpperCase());
  const cuerpo = `<div class="hoja">
  <p class="p">${may('HOJA DE VIDA')}</p>
  <p class="p">&nbsp;</p>
  <p class="p">${may(`NOMBRE: ${nombreCompleto(cv)}`)}</p>
  <p class="p">${may(`CEDULA: ${cv.cedula}`)}</p>
  <p class="p">${may(`TELEFONO: ${cv.telefono}`)}</p>
  <p class="p">CORREO: ${esc(cv.correo)}</p>
  <p class="p">${may(`CIUDAD: ${cv.ciudad}`)}</p>
  <p class="p">${may(`CARGO: ${cv.titular}`)}</p>
  <p class="p">&nbsp;</p>
  <p class="p">${may('EXPERIENCIA')}</p>
  ${exp.map((e) => `<p class="p">${may(`- ${e.cargo} / ${e.empresa} / ${e.fechas}`)}</p>`).join('')}
  <p class="p">&nbsp;</p>
  <p class="p">${may('EDUCACION')}</p>
  ${cv.educacion.map((ed) => `<p class="p">${may(`- ${ed.titulo} / ${ed.institucion} / ${ed.anio}`)}</p>`).join('')}
  <p class="p">&nbsp;</p>
  <p class="p">${may('HABILIDADES')}</p>
  <p class="p">${may(cv.habilidades.join(', '))}</p>
  <p class="p">&nbsp;</p>
  <p class="p">${may('REFERENCIAS')}</p>
  ${cv.referencias.map((r) => `<p class="p">${may(`- ${r.nombre} / ${r.tipo} / ${r.telefono}`)}</p>`).join('')}
</div>`;

  return {
    paginas: 1,
    html: envolver({
      fuente: MONO,
      cuerpo,
      estilos: `
.hoja { padding: 70px 78px; }
.p { font-size: 13px; line-height: 1.65; letter-spacing: 0.3px; }`,
    }),
  };
}

export const PLANTILLAS = [
  { clave: 'una-columna', nombre: 'Una columna clásica', render: unaColumnaClasica },
  { clave: 'dos-columnas', nombre: 'Dos columnas con barra de color', render: dosColumnasBarra },
  { clave: 'sin-encabezados', nombre: 'Sin encabezados de sección', render: sinEncabezados },
  { clave: 'formulario', nombre: 'Formulario tipo Minerva', render: formularioMinerva },
  { clave: 'denso-2p', nombre: 'Denso 7,5 pt en dos páginas', render: densoDosPaginas },
  { clave: 'grande', nombre: 'Cuerpo grande y espaciado', render: grandeEspaciado },
  { clave: 'cabecera-oscura', nombre: 'Cabecera oscura a sangre', render: encabezadoOscuro },
  { clave: 'desordenado', nombre: 'Secciones desordenadas', render: seccionesDesordenadas },
  { clave: 'tabla', nombre: 'Tablas con bordes', render: tablaConBordes },
  { clave: 'contacto-pie', nombre: 'Contacto en el pie de página', render: contactoAlPie },
  { clave: 'nombre-pequeno', nombre: 'Nombre pequeño, títulos enormes', render: nombrePequenoTitularGrande },
  { clave: 'italica', nombre: 'Serif itálica inclinada', render: italicaInclinada },
  { clave: 'mecanografiada', nombre: 'Mecanografiada monoespaciada', render: mecanografiada },
];
