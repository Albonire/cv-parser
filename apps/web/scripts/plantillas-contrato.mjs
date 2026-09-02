/**
 * Maquetaciones del contrato laboral de Rosimar, reproduciendo el documento en
 * papel: titulo centrado a todo el ancho y una tabla de dos columnas con la
 * etiqueta a la izquierda y el valor a la derecha.
 *
 * Dos detalles del documento real que la prueba anterior no reproducia y que son
 * justamente los que rompen la lectura:
 *
 * 1. El titulo CRUZA el canal vertical entre las dos columnas. `detectGutter`
 *    busca una franja vertical vacia; un titulo centrado la tapa.
 * 2. Las celdas de la columna de valores van DESFASADAS respecto a las de la
 *    columna de etiquetas. El agrupador de renglones empareja por solapamiento
 *    vertical, asi que con medio renglon de desfase una etiqueta puede solaparse
 *    mas con el valor siguiente que con el suyo.
 *
 * El desfase es un parametro para poder medir las dos situaciones por separado.
 */

import { FILAS_CONTRATO } from './datos-contratos.mjs';

const SANS = "'Liberation Sans', 'DejaVu Sans', Arial, sans-serif";

function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function envolver(estilos, cuerpo) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 850px; background: #ffffff; color: #111111; font-family: ${SANS}; }
.hoja { width: 850px; height: 1100px; background: #ffffff; overflow: hidden; position: relative; }
${estilos}
</style></head><body>${cuerpo}</body></html>`;
}

const ESTILOS_BASE = `
.hoja { padding: 40px 48px; }
h1 { font-size: 15px; text-align: center; line-height: 1.35; margin-bottom: 16px; }
.tabla { position: relative; width: 100%; }
.col { position: absolute; top: 0; }
.etiquetas { left: 0; width: 46%; }
.valores { left: 46%; width: 54%; }
.celda {
  border: 1px solid #444;
  padding: 4px 8px;
  font-size: 11px;
  line-height: 1.25;
  overflow: hidden;
}
.etiquetas .celda { background: #d9d9d9; font-weight: bold; }
.valores .celda { background: #ffffff; }
.prosa { font-size: 11.5px; line-height: 1.5; text-align: justify; }
`;

/**
 * Tabla de dos columnas con desfase configurable.
 *
 * Las dos columnas se posicionan en absoluto y la de valores se empuja hacia
 * abajo `desfase` veces la altura de fila, que es como se ve en el documento
 * escaneado: las celdas no casan una a una.
 */
function tablaContrato(contrato, { desfase = 0, altoFila = 30, titulo = true } = {}) {
  const filas = FILAS_CONTRATO;
  const altoTabla = altoFila * (filas.length + 1);

  const etiquetas = filas
    .map(([etiqueta]) => `<div class="celda" style="height:${altoFila}px">${esc(etiqueta)}</div>`)
    .join('');

  const valores = filas
    .map(([, clave]) => `<div class="celda" style="height:${altoFila}px">${esc(contrato[clave])}</div>`)
    .join('');

  const encabezado = titulo
    ? `<h1>CONTRATO INDIVIDUAL DE TRABAJO<br>A TÉRMINO FIJO INFERIOR A UN AÑO</h1>`
    : '';

  return `<div class="hoja">
  ${encabezado}
  <div class="tabla" style="height:${altoTabla}px">
    <div class="col etiquetas">${etiquetas}</div>
    <div class="col valores" style="top:${Math.round(altoFila * desfase)}px">${valores}</div>
  </div>
  <p class="prosa" style="margin-top:${Math.round(altoFila * (desfase + 1))}px">
    Entre EL(A) EMPLEADOR y EL(A) TRABAJADOR, de las condiciones ya dichas, identificados
    como aparece en el encabezamiento, se ha celebrado el presente contrato individual de
    trabajo, regido por las siguientes cláusulas.
  </p>
</div>`;
}

export const PLANTILLAS_CONTRATO = [
  {
    clave: 'contrato-real',
    nombre: 'Tabla de dos columnas, título centrado y celdas desfasadas',
    render: (c) => ({ paginas: 1, html: envolver(ESTILOS_BASE, tablaContrato(c, { desfase: 0.5 })) }),
  },
  {
    clave: 'contrato-alineado',
    nombre: 'Tabla de dos columnas alineada, con título centrado',
    render: (c) => ({ paginas: 1, html: envolver(ESTILOS_BASE, tablaContrato(c, { desfase: 0 })) }),
  },
  {
    clave: 'contrato-sin-titulo',
    nombre: 'Tabla alineada sin título que cruce el canal',
    render: (c) => ({
      paginas: 1,
      html: envolver(ESTILOS_BASE, tablaContrato(c, { desfase: 0, titulo: false })),
    }),
  },
];
