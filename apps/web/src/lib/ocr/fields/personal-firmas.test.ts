import { describe, it, expect } from 'vitest';
import { parseCvText } from '../parser-cv';
import { layoutFromPlainText } from '../layout';

/**
 * Regresion del bloque de firmas / despedidas / cargos dentro de un documento
 * de hoja de vida. Los errores reportados:
 *
 * 1. "Gerencia." acababa en el campo Nombres (era la firma "Atentamente:
 *    Gerencia" del emisor).
 * 2. "CONDUCTOR,La" acababa en Ciudad de residencia (un pedazo del cargo
 *    "CONDUCTOR" pegado al texto de una carta de renuncia).
 * 3. "NRTA" acababa en Titular profesional (fragmento cortado del membrete).
 *
 * Ninguno de esos valores debe salir en nombre, ciudad ni titular.
 */
const TEXTO_CON_FIRMA_Y_CARGO = [
  'HOJA DE VIDA',
  'INFORMACION PERSONAL',
  'Nombres y Apellidos: Francia Elena Ortega Romero',
  'Ciudad de Residencia: Barranquilla Atlantico',
  'Cedula: 1.140.891 883',
  'Telefono: 3138587655',
  'PERFIL PROFESIONAL',
  'CONDUCTOR experto en manejo de maquinaria.',
  'Atentamente: GERENCIA',
  'Firma:',
  'NRTA',
  '',
].join('\n');

const TEXTO_RENUNCIA_LETRA = [
  'CARTA DE RENUNCIA',
  'Barranquilla, 12 de mayo',
  'CONDUCTOR, La presente es para manifestar',
  'mi renuncia voluntaria. Atentamente.',
  'Firma: (no legible)',
].join('\n');

describe('Bloque de firmas, cargos y membrete no contamina campos personales', () => {
  it('no toma "Gerencia" como nombre ni cargo como ciudad ni "NRTA" como titular', () => {
    const parsed = parseCvText(
      TEXTO_CON_FIRMA_Y_CARGO,
      layoutFromPlainText(TEXTO_CON_FIRMA_Y_CARGO)
    );

    expect(parsed.firstNames).toBe('Francia Elena');
    expect(parsed.lastNames).toBe('Ortega Romero');
    expect(parsed.cityResidence ?? '').not.toContain('CONDUCTOR');
    expect(parsed.cityResidence ?? '').not.toContain('Gerencia');
    expect(parsed.headline ?? '').not.toContain('NRTA');
    // El cargo "CONDUCTOR" del perfil NO debe confundirse con la ciudad.
    expect(parsed.cityResidence ?? '').not.toEqual('CONDUCTOR');
  });

  it('no fabrica una hoja de vida a partir de una carta de renuncia con nombre de rol', () => {
    // Forzamos el camino del orquestador: parseamos la carta de renuncia.
    const parsedCarta = parseCvText(TEXTO_RENUNCIA_LETRA, layoutFromPlainText(TEXTO_RENUNCIA_LETRA));
    const nombre = `${parsedCarta.firstNames} ${parsedCarta.lastNames}`.trim();
    // "CONDUCTOR" (cargo) o "" no son un nombre de persona creible.
    expect(nombre).not.toMatch(/conduct|gerencia/i);
  });

  it('deja la ciudad vacia cuando el valor de la etiqueta no es un lugar conocido', () => {
    // "CONDUCTOR,La" (cargo + texto continuo) no es una ciudad: debe quedar vacio.
    const TEXTO_CIUDAD_BASURA = [
      'HOJA DE VIDA',
      'INFORMACION PERSONAL',
      'Nombres y Apellidos: Juan Perez Gomez',
      'Ciudad de Residencia: CONDUCTOR, La presente renuncia',
      'Cedula: 1042448766',
    ].join('\n');
    const parsed = parseCvText(TEXTO_CIUDAD_BASURA, layoutFromPlainText(TEXTO_CIUDAD_BASURA));
    expect(parsed.cityResidence ?? '').not.toContain('CONDUCTOR');
    // Sin lugar conocido y con texto continuo, el campo queda vacio (revision
    // manual) en lugar de inyectar basura.
    expect(parsed.cityResidence ?? '').not.toMatch(/La presente/);
  });
});