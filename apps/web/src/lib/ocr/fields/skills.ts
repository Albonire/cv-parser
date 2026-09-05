import { extractSkillsFromText, SKILLS_TAXONOMY, SkillTaxonomyCategory } from '../skills-taxonomy';
import { LayoutLine } from '../layout';
import { Section } from '../sections';

export { extractSkillsFromText, SKILLS_TAXONOMY, type SkillTaxonomyCategory };

/**
 * Extrae habilidades descartando bloques de documento de identidad y secciones no relacionadas.
 * Garantiza que la sigla 'C.C.', 'C.C' o 'CC' nunca active el lenguaje de programación 'C'.
 */
export function extraerHabilidades(
  texto: string,
  _secciones?: Section[],
  _lineasExcluidas?: LayoutLine[]
): { category: string; skillName: string }[] {
  return extractSkillsFromText(texto);
}
