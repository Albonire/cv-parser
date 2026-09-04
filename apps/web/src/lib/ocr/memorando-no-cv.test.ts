import { describe, it, expect } from 'vitest';
import { clasificarHistorial, classifyDocumentType } from './document-classifier';
import { parseCvText } from './parser-cv';
import { parseMemorandoText } from './parser-memorando';

/**
 * Regresion para el escaneo de un memorando de inasistencia que el OCR degrada.
 * El OCR pego "ASUNTO:" con "DE:" y no siempre deja intactas las claves fuertes
 * del clasificador. El resultado real reportado por el usuario:
 *   - nombre cortado "ECO" (de PACHECO)
 *   - titular con basura "ASUNTO:DE: DIS INASISTENCIA SIN JUSTA CAUSA"
 * Luego el documento NO debe proponerse como hoja de vida.
 */

const MEMORANDO_DEGRADADO = [
  'MEMORANDO No. 026',
  'FECHA: 05/09/2026',
  'PARA: ALEJANDRO PACHECO RAMIREZ',
  'DE: GERENCIA GENERAL',
  'ASUNTO: DE: DIS INASISTENCIA SIN JUSTA CAUSA',
  '',
  'Se le informa que, en atencion a la conducta que se relaciona, debe presentarse',
  'a descargar sus descargos en el termino legal, so perjuicio de que la conducta',
  'se tenga por aceptada.',
].join('\n');

// Caso de degradacion real: el OCR pierde "MEMORANDO" y "PARA:" (solo queda la
// pareja ASUNTO:/DE: y el cuerpo con un telefono). Sin la tripleta para:asunto:de:
// el clasificador cae a desconocido y el bloque de promocion podia ascenderlo a CV.
const MEMORANDO_SIN_PARA_KEY = [
  'FECHA: 05/09/2026',
  'ALBA NOMBRE X',
  'NIT: 900123456',
  'ASUNTO: DE: DIS INASISTENCIA SIN JUSTA CAUSA',
  '',
  'Se le informa que, en atencion a la conducta que se relaciona, debe presentarse',
  'a descargar sus descargos en el termino legal, so perjuicio de que la conducta',
  'se tenga por aceptada. Tel: 3184567890',
].join('\n');

describe('mun cris_no_cv', () => {
  it('no clasifica el memorando degradado como hoja de vida', () => {
    const categoria = clasificarHistorial(MEMORANDO_DEGRADADO);
    expect(['memorando', 'llamado_atencion', 'desconocido']).toContain(categoria);
    expect(categoria).not.toBe('hoja_de_vida');
  });

  it('el formulario estructurado no es CV (unknown o contract)', () => {
    const tipo = classifyDocumentType(MEMORANDO_DEGRADADO);
    expect(tipo).not.toBe('cv');
  });

  it('signo de memorando no favorece pareceHojaDeVida', () => {
    const cv = parseCvText(MEMORANDO_DEGRADADO);
    // El parseo de CV puede intentarse, pero nunca debe producir un titular
    // que traiga las etiquetas del encabezado.
    expect(cv.headline).not.toMatch(/ASUNTO|INASISTENCIA|PARA:|DE:/i);
    expect(cv.headline).not.toContain('DIS INASISTENCIA');
  });

  it('el parser de memorando sigue extrayendo las partes', () => {
    const memo = parseMemorandoText(MEMORANDO_DEGRADADO);
    expect(memo.workerName).toBeTruthy();
    expect(memo.responsiblePerson).toMatch(/gerencia/i);
  });

  it('aunque el OCR pierda MEMORANDO/PARA:, no asciende a hoja de vida', () => {
    const cat = clasificarHistorial(MEMORANDO_SIN_PARA_KEY);
    // Sin la tripleta para:asunto:de:, puede ser desconocido, pero NUNCA un CV.
    expect(cat).not.toBe('hoja_de_vida');
    expect(classifyDocumentType(MEMORANDO_SIN_PARA_KEY)).not.toBe('cv');
  });

  it('nunca deja basura de etiquetas en el titular ni en el nombre', () => {
    const cv = parseCvText(MEMORANDO_SIN_PARA_KEY);
    const montado = `${cv.firstNames} ${cv.lastNames}`;
    expect(montado).not.toMatch(/ASUNTO|INASISTENCIA|DE:|PARA:/i);
    expect(cv.headline).not.toMatch(/ASUNTO|INASISTENCIA|DE:|PARA:/i);
  });
});

describe('rumor de hoja de vida con cabecera de memorando', () => {
  // Un CV real no debe contener la cabecera "PARA:/DE:/ASUNTO:". Garantia extra.
  it('la presencia de PARA:/DE:/ASUNTO: como encabezados no es un CV', () => {
    const texto =
      'PARA: ALEJANDRO PACHECO RAMIREZ\nDE: GERENCIA\nASUNTO: REVISION\n\nExperiencia laboral en comercio.';
    expect(clasificarHistorial(texto)).toBe('memorando');
  });
});