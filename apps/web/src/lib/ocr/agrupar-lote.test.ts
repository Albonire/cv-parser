import { describe, it, expect } from 'vitest';
import { agruparPorEmpleado, identidadDeResultado, sintetizarResultadoConsolidado } from './agrupar-lote';
import { ExtractedDocumentData } from '../../types/reader';
import { parseCvText } from './parser-cv';
import { layoutFromPlainText } from './layout';

function resultado(
  fileName: string,
  texto: string,
  candidateData?: ExtractedDocumentData['candidateData'],
  detectedType: ExtractedDocumentData['detectedType'] = 'cv',
  confianza = 0.8
): ExtractedDocumentData {
  return {
    detectedType,
    fileName,
    fileSize: 1000,
    fileType: 'image/jpeg',
    extractedText: texto,
    confidenceScore: confianza,
    processingTimeMs: 100,
    method: 'image_ocr',
    candidateData,
  };
}

describe('Agrupacion de lote por empleado', () => {
  it('agrupa 8 fotos del mismo empleado en un solo grupo', () => {
    const base = {
      id: 'x',
      firstNames: 'ALIBIS',
      lastNames: 'CALLEJAS NAVARRO',
      documentType: 'CC' as const,
      documentNumber: '32891622',
      status: 'nuevo' as const,
      phone: '',
      email: '',
      nationality: '',
      education: [],
      experience: [],
      skills: [],
      references: [],
    };
    const fotos = Array.from({ length: 8 }, (_, i) =>
      resultado(`foto${i}.jpeg`, `Hoja de vida\n${base.firstNames} ${base.lastNames}\nCC ${base.documentNumber}`, base)
    );

    const grupos = agruparPorEmpleado(fotos);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].items).toHaveLength(8);
    expect(grupos[0].cedula).toBe('32891622');
  });

  it('separa empleados distintos en grupos propios', () => {
    const a = resultado('a.jpeg', 'ANDRES ROJAS\nCC 1098765432', {
      firstNames: 'ANDRES', lastNames: 'ROJAS', documentType: 'CC', documentNumber: '1098765432',
      status: 'nuevo', phone: '', email: '', nationality: '',
      education: [], experience: [], skills: [], references: [],
    });
    const b = resultado('b.jpeg', 'FRANCIA ORTEGA\nCC 1140891883', {
      firstNames: 'FRANCIA', lastNames: 'ORTEGA', documentType: 'CC', documentNumber: '1140891883',
      status: 'nuevo', phone: '', email: '', nationality: '',
      education: [], experience: [], skills: [], references: [],
    });

    const grupos = agruparPorEmpleado([a, b]);

    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.cedula).sort()).toEqual(['1098765432', '1140891883']);
  });

  it('identifica la cedula incluso cuando no hay estructura', () => {
    const r = resultado('foto.jpeg', 'Hoja de vida\nCC 32.891.622\nDireccion: VILLA OLIMPICA GALAPA');
    const ident = identidadDeResultado(r);
    expect(ident.cedula).toBe('32891622');
  });

  it('consolida el texto y reemite el formulario con datos fusionados', () => {
    const parte1 = 'HOJA DE VIDA\nNombres y Apellidos: Francia Elena Ortega Romero\nNumero de Cedula: 1.140.891 883\nTelefonos: 3138587655';
    const parte2 = 'EXPERIENCIA LABORAL\nEmpresa Soluciones Tech SAS\nDesarrollador Full Stack\n2021-2024';
    const g1 = resultado('f1.jpeg', parte1);
    const g2 = resultado('f2.jpeg', parte2);

    const grupos = agruparPorEmpleado([g1, g2]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].textoConsolidado).toContain('Francia Elena');
    expect(grupos[0].textoConsolidado).toContain('Desarrollador Full Stack');

    const consolidado = sintetizarResultadoConsolidado(grupos[0]);
    expect(consolidado.detectedType).toBe('cv');
    expect(consolidado.candidateData?.lastNames).toBe('Ortega Romero');
    const reparsed = parseCvText(consolidado.extractedText ?? '', layoutFromPlainText(consolidado.extractedText ?? ''));
    expect(reparsed.phone).toBe('3138587655');
  });
});
