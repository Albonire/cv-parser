/**
 * Deteccion de numeros telefonicos tolerante a los formatos que aparecen en las
 * hojas de vida colombianas e internacionales: "+57 318 456 7890",
 * "(+91) 9597099401", "(555) 322-7337", "312 876 5432", "3105554433".
 *
 * Se valida por cantidad de digitos en vez de encajar un formato rigido, que es
 * lo que hacia que un celular agrupado 3-3-4 no se reconociera.
 */
const CANDIDATO = /(?:\+\d{1,3}[\s.-]?)?(?:\(\+?\d{1,4}\)\s*)?\d[\d\s.()-]{5,16}\d/g;

const RANGO_DE_ANIOS =
  /\b(?:19|20)\d{2}\s*(?:[-–—]|a|al|hasta|to)\s*(?:(?:19|20)\d{2}|presente|actualidad|actual|present)\b/gi;

/**
 * Devuelve el primer telefono valido del texto.
 * @param excluir digitos a ignorar (por ejemplo, el numero de documento).
 */
export function buscarTelefono(texto: string, excluir?: string): string | null {
  const limpio = texto.replace(RANGO_DE_ANIOS, ' ');
  CANDIDATO.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CANDIDATO.exec(limpio)) !== null) {
    const bruto = match[0].replace(/[\s.()-]+$/, '').trim();
    const digitos = bruto.replace(/\D/g, '');

    if (digitos.length < 7 || digitos.length > 13) continue;
    if (excluir && digitos === excluir) continue;
    // Un año suelto o un rango numerico no es un telefono.
    if (/^(?:19|20)\d{2}$/.test(digitos)) continue;

    return bruto.replace(/\s{2,}/g, ' ');
  }

  return null;
}
