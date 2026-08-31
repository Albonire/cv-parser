import { describe, it, expect } from 'vitest';
import { parseCvText } from '../parser-cv';
import { layoutFromPlainText } from '../layout';

/**
 * Regresion sobre el output real de una foto de hoja de vida tomada con
 * telefono (WhatsApp). El OCR de Tesseract reconoce bien el texto, pero la
 * maquetacion de la foto (encabezados pegados, "Nombres y Apellidos" en un solo
 * renglon, "Numero de Cedula: 1.140.891 883" partido por un espacio) hacia que
 * el parser devolviera campos vacios o equivocados.
 *
 * Se usa layoutFromPlainText porque reproduce el mismo camino de parseo que la
 * aplicacion (DocumentLayout -> detectSections -> extras): el contenido aqui es
 * el texto reconocido por Tesseract sobre la foto real.
 */
const TEXTO_FOTO_REAL = [
  'PERIODO DE PRACTICA: EN AUXILIAR AD!',
  'HOJA DE VIDA',
  '1. INFORMACION PERSONAL',
  'Nombres y Apellidos: Francia Elena Ortega Romero',
  'Lugar y Fecha de Nacimiento: 30 marzo de 1997 Barranquilla Atlantico',
  'Numero de Cedula: 1.140.891 883 de Barranquilla',
  'Estado Civil: Soltera',
  'Direccion en Balrranquilla: Carrera 20 No. 57-40 [soledad]',
  'Correo Electronico: elenaortega@gmail.com',
  'Telefonos: 3138587655',
].join('\n');

describe('Extraccion sobre foto real de hoja de vida', () => {
  it('extrae nombres, cedula, telefono y ciudad sin confundirse con datos personales', () => {
    const parsed = parseCvText(TEXTO_FOTO_REAL, layoutFromPlainText(TEXTO_FOTO_REAL));

    expect(parsed.firstNames).toBe('Francia Elena');
    expect(parsed.lastNames).toBe('Ortega Romero');
    expect(parsed.documentNumber).toBe('1140891883');
    expect(parsed.phone).toBe('3138587655');

    // "Direccion en Balrranquilla" (typo del OCR): debe recuperar un lugar real.
    expect(parsed.cityResidence?.length).toBeGreaterThan(0);
    expect(/Barranquilla|Soledad/i.test(parsed.cityResidence ?? '')).toBe(true);

    // "Estados Civil: Soltera" no puede convertirse en formacion academica.
    expect(parsed.education.some((e) => e.degree.toLowerCase().includes('estado civil'))).toBe(false);
  });
});
