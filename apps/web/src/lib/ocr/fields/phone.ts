/**
 * Deteccion de numeros telefonicos tolerante a los formatos que aparecen en las
 * hojas de vida colombianas e internacionales: "+57 318 456 7890",
 * "(+91) 9597099401", "(555) 322-7337", "312 876 5432", "3105554433".
 *
 * Se valida por cantidad de digitos en vez de encajar un formato rigido, que es
 * lo que hacia que un celular agrupado 3-3-4 no se reconociera.
 */

// Regex principal: captura la mayoría de formatos de teléfono
const CANDIDATO = /(?:\([\s]?\+[\s]?\d{1,3}[\s]?\)[\s]?)?(?:\+\d{1,3}[\s.-]?)?(?:\(\+?\d{1,4}\)\s*)?\d[\d\s.()-]{5,20}\d/g;

// Regex alternativo: para formatos más permisivos (sin validación de estructura)
const CANDIDATO_ALTERNATIVO = /\b\d[\d\s.()-]{7,20}\d\b/g;

// Regex ultra-permisivo: solo busca secuencias de dígitos separadas por espacios/guiones
const CANDIDATO_ULTRA_PERMISIVO = /\b\d{2,}[\s.-]?\d{2,}[\s.-]?\d{2,}(?:[\s.-]?\d+)*/g;

const RANGO_DE_ANIOS =
  /\b(?:19|20)\d{2}\s*(?:[-–—]|a|al|hasta|to)\s*(?:(?:19|20)\d{2}|presente|actualidad|actual|present)\b/gi;

/**
 * Valida y normaliza un candidato a telefono. Devuelve el numero limpio o null
 * si no parece un telefono. Tambien parte bloques que juntan dos telefonos
 * ("Cel. 3218055469 - 3002808775") y descarta NIT colombianos, que no lo son.
 */
function validarCandidato(brutoRaw: string, excluir?: string): string | null {
  let bruto = brutoRaw.replace(/[\s.()-]+$/, '').trim();

  // Normaliza espacios dentro de paréntesis: "( +91)" -> "(+91)"
  bruto = bruto.replace(/\(\s*\+\s*(\d)/g, '(+$1');
  bruto = bruto.replace(/\(\s*(\d)/g, '($1');

  let digitos = bruto.replace(/\D/g, '');

  // Dos telefonos pegados por un separador forman un bloque de mas de 15
  // digitos que de otro modo se descarta entero ("3218055469 - 3002808775").
  if (digitos.length > 15) {
    const partes = bruto.split(/\s*[-–—]\s*/);
    for (const parte of partes) {
      const p = parte.replace(/\D/g, '');
      if (p.length === digitos.length) continue; // sin separador real
      const r = validarCandidato(parte, excluir);
      if (r) return r;
    }
    return null;
  }

  // Rango 7-15 (extendido para soportar +1-xxx-xxx-xxxx que es 12 dígitos)
  if (digitos.length < 7 || digitos.length > 15) return null;
  if (excluir && digitos === excluir) return null;
  // Un año suelto o un rango numerico no es un telefono.
  if (/^(?:19|20)\d{2}$/.test(digitos)) return null;
  // Un NIT colombiano ("901.167.955-4") no es un telefono: termina en un
  // digito de verificacion tras un guion.
  if (/^\d{1,3}(?:[.,]\d{3}){2}-\d$/.test(bruto)) return null;

  return bruto.replace(/\s{2,}/g, ' ');
}

/**
 * Devuelve el primer telefono valido del texto.
 * @param excluir digitos a ignorar (por ejemplo, el numero de documento).
 */
export function buscarTelefono(texto: string, excluir?: string): string | null {
  const limpio = texto.replace(RANGO_DE_ANIOS, ' ');

  // Intenta regex principal primero
  CANDIDATO.lastIndex = 0;
  let candidatos: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  while ((match = CANDIDATO.exec(limpio)) !== null) {
    candidatos.push(match);
  }

  // Si no encontró con regex principal, intenta alternativo
  if (candidatos.length === 0) {
    CANDIDATO_ALTERNATIVO.lastIndex = 0;
    while ((match = CANDIDATO_ALTERNATIVO.exec(limpio)) !== null) {
      candidatos.push(match);
    }
  }

  // Si sigue sin encontrar, intenta ultra-permisivo
  if (candidatos.length === 0) {
    CANDIDATO_ULTRA_PERMISIVO.lastIndex = 0;
    while ((match = CANDIDATO_ULTRA_PERMISIVO.exec(limpio)) !== null) {
      candidatos.push(match);
    }
  }

  for (const candidato of candidatos) {
    const valido = validarCandidato(candidato[0], excluir);
    if (valido) return valido;
  }

  return null;
}
