import { describe, expect, it } from 'vitest';
import {
  construirVocabulario,
  limpiarTextoOCR,
  segmentarPalabraOriginal,
} from './limpiar-texto';

const SEMILLAS = [
  'auxiliar de bodega', 'auxiliar de aseo', 'lugar de nacimiento', 'fecha de nacimiento',
  'bodega', 'vendedor externo', 'cedula de ciudadania', 'compensacion familiar',
  'barranquilla', 'calle', 'atletico',
  'contrato individual de trabajo', 'distribuciones rosimar', 'telefono', 'correo',
  'especialidad', 'terminacion', 'iniciacion', 'estrato', 'electronico', 'direccion',
];

function S(original: string, semillas: string[] = SEMILLAS): string {
  const voc = construirVocabulario(original, semillas);
  return segmentarPalabraOriginal(original, voc);
}

describe('limpiar-texto', () => {
  it('separa el cargo fusionado en mayusculas', () => {
    expect(S('AUXILIARDEBODEGA')).toBe('AUXILIAR DE BODEGA');
  });

  it('separa lugar y calle fusionados', () => {
    expect(S('BARRANQUILLACALLE')).toBe('BARRANQUILLA CALLE');
  });

  it('separa la cadena de etiquetas de formulario', () => {
    expect(
      S('ESPECIALIDADTERMINACIONFECHAINICIACIONFECHAESTRATOELECTRONICOCORREOTELEFONODIRECCIONNACIMIENTOFECHACEDULANOMBRE')
    ).toContain('ESPECIALIDAD');
  });

  it('deja identicas las palabras que ya estan bien', () => {
    expect(S('BARRANQUILLA')).toBe('BARRANQUILLA');
    expect(S('CONTRATO')).toBe('CONTRATO');
  });

  it('no parte palabras inseparables conocidas', () => {
    expect(S('ROSIMAR')).toBe('ROSIMAR');
    expect(S('COMBARRANQUILLA')).toBe('COMBARRANQUILLA');
  });

  it('limpiarTextoOCR devuelve el texto reorganizado', () => {
    const res = limpiarTextoOCR('NIT N° 901.167.9554\nAUXILIARDEBODEGA\nBARRANQUILLACALLE 10', SEMILLAS);
    expect(res.texto).toContain('AUXILIAR DE BODEGA');
    expect(res.texto).toContain('BARRANQUILLA CALLE');
    expect(res.separaciones).toBeGreaterThan(0);
  });
});