import { describe, expect, it } from 'vitest';
import { extractSkillsFromText } from './skills-taxonomy';

/**
 * El OCR de un escaneo degradado pierde las tildes con toda naturalidad. La
 * taxonomia si las lleva, asi que comparar literalmente hacia que el campo
 * dependiera de que la tilde sobreviviera al escaneo.
 */
describe('extractSkillsFromText', () => {
  const nombres = (texto: string) => extractSkillsFromText(texto).map((s) => s.skillName).sort();

  it('encuentra las mismas habilidades con tildes y sin ellas', () => {
    const conTildes = 'HABILIDADES\nGestión Documental\nArchivo\nAtención al Cliente';
    const sinTildes = 'HABILIDADES\nGestion Documental\nArchivo\nAtencion al Cliente';

    expect(nombres(conTildes)).toEqual(['Archivo', 'Atención al Cliente', 'Gestión Documental']);
    expect(nombres(sinTildes)).toEqual(nombres(conTildes));
  });

  it('devuelve el nombre con su tilde aunque el texto no la traiga', () => {
    // Lo que se guarda en la ficha es el nombre canonico, no el del OCR.
    expect(nombres('Manejo de Nomina y Liquidacion de Prestaciones')).toContain('Nómina');
  });

  it('sigue exigiendo limite de palabra', () => {
    expect(nombres('Archivador de metal')).not.toContain('Archivo');
  });
});
