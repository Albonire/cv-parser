import { FuncionesOCR } from '../../types/reader';
import { normalizarOCR } from './parse-helpers';

/**
 * Parsea un documento de FUNCIONES DE CARGO y extrae el puesto y el listado de
 * responsabilidades (las "funciones"). Las funciones se guardan en la ficha del
 * empleado como `experience[].responsibilities` y el cargo como `headline`, de
 * modo que dejan de ser texto suelto del expediente.
 *
 * Formato comun (fotos de WhatsApp):
 *   FUNCIONES DEL CARGO
 *   CARGO: OPERADOR DE PUNTO DE VENTA
 *   DEPENDENCIA: ...
 *   1. Atender clientes.
 *   2. Registrar ventas en el sistema.
 *   - Manejar caja registradora.
 */
export function parseFuncionesText(text: string): FuncionesOCR {
  const lower = normalizarOCR(text);
  const lineas = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const position = extraerCargo(lower);
  const workerName = /(?:emplead[oa]|trabajad[oa]r|nombre)\s*[:#.-]?\s*([a-z\u00e0-\u00ff\u00f1\s.'-]{3,50})/i.exec(lower)?.[1];

  return {
    workerName,
    workerDocumentNumber: extraerDocumento(lower),
    position,
    funciones: extraerFunciones(lineas),
  };
}

function extraerCargo(lower: string): string | undefined {
  const m = lower.match(/(?:cargo|puesto|denominacion\s+del\s+cargo)\s*[:#.-]?\s*([a-z\u00e0-\u00ff\u00f1 \t]{3,70})/i);
  if (!m) return undefined;
  return m[1]
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Recoge funciones numeradas ("1. ...") o con viñetas ("- ..."). */
function extraerFunciones(lineas: string[]): string[] {
  const funciones: string[] = [];
  for (const linea of lineas) {
    const m = linea.match(/^\s*(?:[-\u2022\u25aa*]|\d{1,2}[\.\)])\s*(.+)$/);
    if (!m) continue;
    const texto = m[1].trim();
    // Ignora encabezados y frases sin contenido funcional.
    if (
      !texto ||
      texto.length < 4 ||
      /^(cargo|dependencia|funcion(es)?|n[oº]?\.?|punto[.:]|anexo|firma|fecha|area)\b/i.test(texto)
    ) {
      continue;
    }
    funciones.push(cap(texto));
  }
  return funciones;
}

function extraerDocumento(lower: string): string | undefined {
  const etiquetada = lower.match(
    /(?:cc|cedula|identificacion|documento)\s*(?:n[oº]?\b|no\.?)?\s*[:#.-]?\s*(\d[\d.\s-]{4,})/
  );
  if (etiquetada) {
    const digito = etiquetada[1].replace(/[.\s-]/g, '');
    if (digito.length >= 7 && digito.length <= 11) return digito;
  }
  const grupos = lower.match(/(?<![\d.])\d{8,10}(?![\d.])/g) ?? [];
  return grupos.find((n) => !n.startsWith('3'));
}

function cap(valor: string): string {
  return valor
    .replace(/[.;,\s]+$/, '')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
