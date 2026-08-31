import { stripBullets } from '../text-utils';

/**
 * Helper unificado de nombres propios colombianos.
 *
 * Un solo lugar donde se decide como repartir un nombre completo en
 * `firstNames` / `lastNames` siguiendo la convencion colombiana de dos
 * apellidos, con manejo explicito de las particulas de apellido
 * (`de`, `del`, `de la`, `de los`, `de las`, `y`, `la`, `los`, `las`).
 *
 * Antes existian dos copias con reglas inconsistentes en nombres de 3
 * tokens (una ponía el primer apellido suelto y la otra lo juntaba). Este
 * modulo es la fuente unica: lo usan el parser de CV, el de contrato, el de
 * cedula y la consolidacion de lote.
 */

/** Particulas que anuncian un apellido, solas o como inicio de compuesto. */
const ES_PARTICULA_APELLIDO = /^(?:de|del|la|los|las|y)$/i;

/** Tratamientos que se descartan antes de repartir el nombre. */
const PREFIJOS_TRATAMIENTO =
  /^(?:ing\.?|ingeniero|ingeniera|dr\.?|dra\.?|doctor|doctora|lic\.?|licenciado|licenciada|abg\.?|abogado|abogada|psic\.?|tec\.?|tecn[oó]logo|sr\.?|sra\.?|srta\.?|mr\.?|ms\.?|mrs\.?)\s+/i;

/**
 * Reparte un nombre completo segun la convencion colombiana de dos apellidos.
 * Las particulas de apellido ("de", "del", "de la", ...) se mantienen unidas
 * al apellido que les sigue y nunca caen en los nombres de pila.
 */
export function repartirNombre(completo: string): { firstNames: string; lastNames: string } {
  const partes = stripBullets(completo).replace(PREFIJOS_TRATAMIENTO, '').split(/\s+/).filter(Boolean);

  if (partes.length === 0) return { firstNames: '', lastNames: '' };
  if (partes.length === 1) return { firstNames: partes[0], lastNames: '' };

  const corte = encontrarCorteApellido(partes);

  if (corte !== null && corte > 0 && corte < partes.length) {
    return {
      firstNames: partes.slice(0, corte).join(' '),
      lastNames: partes.slice(corte).join(' '),
    };
  }

  // Sin particulas que senalen el apellido, se aplica la convencion base.
  if (partes.length === 2) return { firstNames: partes[0], lastNames: partes[1] };
  if (partes.length === 3) return { firstNames: partes[0], lastNames: partes.slice(1).join(' ') };
  return { firstNames: partes.slice(0, 2).join(' '), lastNames: partes.slice(2).join(' ') };
}

/**
 * La primera palabra que es una particula de apellido (con algo despues) marca
 * el inicio de los apellidos. Ej: "Ana de la Cruz" -> corte en "de".
 * Al incluir "del", "la", "los", "las", "y", tambien se cubren compuestos como
 * "Maria de los Santos" (corte en "de", el resto "los Santos" queda junto).
 */
function encontrarCorteApellido(partes: string[]): number | null {
  for (let i = 0; i < partes.length; i++) {
    if (ES_PARTICULA_APELLIDO.test(partes[i])) {
      return i;
    }
  }
  return null;
}

/** Helpers expuestos para las pruebas. */
export { ES_PARTICULA_APELLIDO as PARTICULAS_APELLIDO, PREFIJOS_TRATAMIENTO };
