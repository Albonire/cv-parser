import { describe, it, expect } from 'vitest';
import {
  agruparPorEmpleado,
  identidadDeResultado,
  sintetizarResultadoConsolidado,
  buscarNombreEnTexto,
} from './agrupar-lote';
import { ExtractedDocumentData } from '../../types/reader';

/**
 * Regresion sobre el texto OCR REAL (escala de grises) de las 8 fotos de
 * WhatsApp que sube un empleado de Rosimar. Antes con binarizacion Sauvola el
 * OCR producia basura; en grises los documentos se leen y el lote debe fundirse
 * en un solo expediente con el nombre y la cedula detectados.
 */

function resultado(fileName: string, texto: string, detectedType: ExtractedDocumentData['detectedType'] = 'unknown'): ExtractedDocumentData {
  return { detectedType, fileName, fileSize: 1000, fileType: 'image/jpeg', extractedText: texto, confidenceScore: 0.85, processingTimeMs: 100, method: 'image_ocr' };
}

describe('Consolidacion del lote real de un empleado (OCR en grises)', () => {
  it('detecta el nombre desde el encabezado PARA: de un memorando', () => {
    expect(buscarNombreEnTexto('MEMORANDO\nNo. 026\nPARA: ALIBIS CALLEJAS NAVARRO\nDE: DISTRIBUCIONES ROSIMAR SAS')).toBe('ALIBIS CALLEJAS NAVARRO');
  });

  it('funde las 8 fotos en un solo grupo por cedula y nombre', () => {
    const contrato = resultado(
      'contrato.jpeg',
      'CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO FIJO\nTRABAJADOR: ALIBIS CALLEJAS NAVARRO\nCC No. 32.891.622\nCALLE 84 56-36 VILLA OLIMPICA GALAPA\nADMINISTRADORA PUNTO DE VENTA\n2.000.000\nQUINCENAL\nTRES MESES',
      'contract'
    );
    const funciones = resultado(
      'funciones.jpeg',
      'DISTRIBUCIONES ROSIMAR SAS\nFUNCIONES\nADMINISTRADORA PUNTO DE VENTA\nRealizar apertura y cierre del almacen.\nCuadre diario de caja.'
    );
    const llamada = resultado(
      'llamada.jpeg',
      'LLAMADO DE ATENCION\nPARA: ALIBIS CALLEJAS NAVARRO\nDE: DISTRIBUCIONES ROSIMAR SAS\nASUNTO: NO COLOCAR FECHA A CONSIGNACIONES\nFECHA: 23/09/2021'
    );
    const memorando = resultado(
      'memorando.jpeg',
      'MEMORANDO\nNo. 026\nPARA: ALIBIS CALLEJAS NAVARRO\nDE: DISTRIBUCIONES ROSIMAR SAS\nASUNTO: NO HACER SOPORTE DE RECIBIDO'
    );
    const adres = resultado(
      'adres.jpeg',
      'SEGURIDAD SOCIAL EN SALUD\nInformacion Basica del Afiliado\nNOMBRES ALIBIS\nAPELLIDOS CALLEJAS NAVARRO\nNUMERO DE IDENTIFICACION 32891622\nDEPARTAMENTO MUNICIPIO BARRANQUILLA',
      'health'
    );
    const empleador = resultado(
      'empleador.jpeg',
      'NOMBRE DEL EMPLEADOR: GONZALO GUALDRON SANCHEZ\nNOMBRE DEL EMPLEADO ALIBIS CALLEJAS NAVARRO\nCALLE 51B # 58-41\n26/01/1979\n32.891.622\nADMINISTRADORA',
      'contract'
    );
    const llamado2 = resultado(
      'llamado2.jpeg',
      'LLAMADO DE ATENCION\nNo. 033\nPARA: ALIBIS CALLEJAS NAVARRO\nDE: DISTRIBUCIONES ROSIMAR SAS\nASUNTO: NO ENVIAR CONSIGNACIONES'
    );
    const cedula = resultado(
      'cedula.jpeg',
      'REPUBLICA DE COLOMBIA\nCEDULA DE CIUDADANIA\nALIBIS CALLEJAS NAVARRO\n32.891.622\nBARRANQUILLA',
      'id_card'
    );

    const grupos = agruparPorEmpleado([contrato, funciones, llamada, memorando, adres, empleador, llamado2, cedula]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].cedula).toBe('32891622');
    expect(grupos[0].items).toHaveLength(8);

    const consolidado = sintetizarResultadoConsolidado(grupos[0]);
    expect(consolidado.detectedType).toBe('cv');
    expect(consolidado.candidateData?.firstNames?.toUpperCase()).toContain('ALIBIS');
    expect(consolidado.candidateData?.lastNames?.toUpperCase()).toContain('CALLEJAS');
    expect(consolidado.candidateData?.documentNumber).toMatch(/32891622/);
  });

  it('no convierte un nombre mal formado en identidad', () => {
    expect(buscarNombreEnTexto('ASUNTO: NO COLOCAR FECHA A CONSIGNACIONES\nFECHA: 23/09/2021')).toBeUndefined();
  });
});
