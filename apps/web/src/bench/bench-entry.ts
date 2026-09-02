/**
 * Entrada del banco de precision del lector. NO forma parte de la aplicacion:
 * `vite build` solo sigue `index.html`, asi que este modulo nunca entra al
 * paquete de produccion. Existe para que `scripts/bench-ocr.mjs` pueda ejecutar
 * el pipeline REAL dentro de Chromium en vez de reimplementarlo en Node.
 *
 * Es la leccion del PR #1: las pruebas que reimplementan el camino del motor
 * pasan en verde mientras el motor esta roto.
 */

import { processDocument } from '../lib/ocr';
import { normalize, similarity } from '../lib/ocr/text-utils';
import { ExtractedDocumentData } from '../types/reader';
import { CandidateFormData } from '../types/candidate';

/** Umbral a partir del cual un campo se cuenta como acierto. */
const UMBRAL_ACIERTO = 0.9;
/** Por debajo del acierto pero reconocible: sirve para separar error de OCR de error de extraccion. */
const UMBRAL_CASI = 0.75;

export type EstadoCampo = 'acierto' | 'casi' | 'error' | 'vacio';

export interface ResultadoCampo {
  campo: string;
  esperado: string;
  obtenido: string;
  similitud: number;
  estado: EstadoCampo;
}

export interface ResultadoDocumento {
  archivo: string;
  plantilla: string;
  perfil: string;
  metodo: ExtractedDocumentData['method'];
  /** Que creyo el motor que era el documento. Sin esto, un fallo de
   *  clasificacion se ve identico a un fallo de extraccion. */
  tipoDetectado: ExtractedDocumentData['detectedType'];
  confianzaMotor: number;
  ms: number;
  caracteres: number;
  avisos: string[];
  campos: ResultadoCampo[];
}

/** Solo digitos: telefonos y cedulas se comparan por su contenido numerico. */
function soloDigitos(valor: string): string {
  return valor.replace(/\D+/g, '');
}

function valorTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function estadoDe(similitud: number, obtenido: string): EstadoCampo {
  if (!obtenido) return 'vacio';
  if (similitud >= UMBRAL_ACIERTO) return 'acierto';
  if (similitud >= UMBRAL_CASI) return 'casi';
  return 'error';
}

/** Compara un campo simple: normaliza tildes y mayusculas y mide similitud. */
function compararTexto(campo: string, esperado: string, obtenido: string): ResultadoCampo {
  const numerico = campo === 'phone' || campo === 'documentNumber' || campo === 'employerNit';
  const e = numerico ? soloDigitos(esperado) : normalize(esperado);
  const o = numerico ? soloDigitos(obtenido) : normalize(obtenido);
  const sim = e && o ? similarity(e, o) : 0;
  return { campo, esperado, obtenido, similitud: sim, estado: estadoDe(sim, obtenido) };
}

/** El valor esperado debe aparecer dentro del extraido (ciudad, titular). */
function compararContenido(campo: string, esperado: string, obtenido: string): ResultadoCampo {
  const e = normalize(esperado);
  const o = normalize(obtenido);
  let sim = 0;

  if (e && o) {
    sim = o.includes(e) ? 1 : similarity(e, o);
    if (sim < 1) {
      // Tambien cuenta si alguna palabra larga del esperado aparece completa.
      for (const parte of e.split(/\s+/)) {
        if (parte.length >= 5 && o.includes(parte)) sim = Math.max(sim, 0.92);
      }
    }
  }

  return { campo, esperado, obtenido, similitud: sim, estado: estadoDe(sim, obtenido) };
}

/** La lista extraida debe tener al menos la cantidad esperada de elementos. */
function compararCantidad(campo: string, esperado: number, obtenido: number): ResultadoCampo {
  const sim = esperado === 0 ? 1 : Math.min(1, obtenido / esperado);
  return {
    campo,
    esperado: String(esperado),
    obtenido: String(obtenido),
    similitud: sim,
    estado: obtenido === 0 ? 'vacio' : sim >= 1 ? 'acierto' : sim >= 0.5 ? 'casi' : 'error',
  };
}

/**
 * Cada valor esperado se busca en la lista extraida y se puntua con el mejor
 * parecido encontrado. El promedio es la nota del campo: asi un CV con cuatro
 * empleos de los que se leyeron tres no se cuenta ni como acierto ni como fallo
 * total.
 */
function compararLista(campo: string, esperados: string[], obtenidos: string[]): ResultadoCampo {
  if (esperados.length === 0) {
    return { campo, esperado: '', obtenido: '', similitud: 1, estado: 'acierto' };
  }

  const notas = esperados.map((esperado) => {
    const e = normalize(esperado);
    let mejor = 0;
    for (const obtenido of obtenidos) {
      const o = normalize(obtenido);
      if (!o) continue;
      mejor = Math.max(mejor, o.includes(e) || e.includes(o) ? 1 : similarity(e, o));
    }
    return mejor;
  });

  const sim = notas.reduce((a, b) => a + b, 0) / notas.length;

  return {
    campo,
    esperado: esperados.join(' | '),
    obtenido: obtenidos.join(' | '),
    similitud: sim,
    estado: obtenidos.length === 0 ? 'vacio' : estadoDe(sim, 'x'),
  };
}

function listaDe(candidato: CandidateFormData | undefined, ruta: string): string[] {
  if (!candidato) return [];
  const [coleccion, propiedad] = ruta.split('.');
  const items = (candidato as unknown as Record<string, unknown>)[coleccion];
  if (!Array.isArray(items)) return [];
  return items.map((item) => valorTexto((item as Record<string, unknown>)[propiedad]));
}

function largoDe(candidato: CandidateFormData | undefined, coleccion: string): number {
  if (!candidato) return 0;
  const items = (candidato as unknown as Record<string, unknown>)[coleccion];
  return Array.isArray(items) ? items.length : 0;
}

/** Aplica la convencion de sufijos de los ficheros de verdad de referencia. */
export function compararCampos(
  esperados: Record<string, unknown>,
  candidato: CandidateFormData | undefined
): ResultadoCampo[] {
  const resultados: ResultadoCampo[] = [];

  for (const [clave, esperado] of Object.entries(esperados)) {
    if (clave.endsWith('#')) {
      const campo = clave.slice(0, -1);
      resultados.push(compararCantidad(campo, Number(esperado), largoDe(candidato, campo)));
      continue;
    }

    if (clave.includes('[].')) {
      const ruta = clave.replace('[].', '.');
      resultados.push(compararLista(clave, esperado as string[], listaDe(candidato, ruta)));
      continue;
    }

    if (clave.endsWith('~')) {
      const campo = clave.slice(0, -1);
      const obtenido = valorTexto((candidato as unknown as Record<string, unknown>)?.[campo]);
      resultados.push(compararContenido(campo, String(esperado), obtenido));
      continue;
    }

    const obtenido = valorTexto((candidato as unknown as Record<string, unknown>)?.[clave]);
    resultados.push(compararTexto(clave, String(esperado), obtenido));
  }

  return resultados;
}

async function medirDocumento(registro: {
  archivo: string;
  plantilla: string;
  perfil: string;
  /** Formulario contra el que se compara. Por defecto, hoja de vida. */
  formulario?: 'cv' | 'contrato';
  campos: Record<string, unknown>;
}): Promise<ResultadoDocumento> {
  const respuesta = await fetch(`/test-scans/${registro.archivo}`);
  if (!respuesta.ok) throw new Error(`No se pudo leer ${registro.archivo}: ${respuesta.status}`);

  const blob = await respuesta.blob();
  const file = new File([blob], registro.archivo, { type: 'application/pdf' });

  const inicio = performance.now();
  const datos = await processDocument(file);
  const ms = Math.round(performance.now() - inicio);

  const resultado: ResultadoDocumento = {
    archivo: registro.archivo,
    plantilla: registro.plantilla,
    perfil: registro.perfil,
    metodo: datos.method,
    tipoDetectado: datos.detectedType,
    confianzaMotor: datos.confidenceScore,
    ms,
    caracteres: datos.extractedText.length,
    avisos: datos.warnings ?? [],
    campos: compararCampos(
      registro.campos,
      registro.formulario === 'contrato'
        ? (datos.contractData as unknown as CandidateFormData | undefined)
        : datos.candidateData
    ),
  };

  if (registro.formulario === 'contrato' && (window as any).__diagArchivo === registro.archivo) {
    (window as any).__diagResultado = {
      texto: datos.extractedText,
      contractData: datos.contractData,
      campos: resultado.campos,
    };
  }

  return resultado;
}

async function diagnosticar(archivo: string): Promise<{
  texto: string;
  contrato: unknown;
  lineasLayout: { text: string; column: number; y: number; height: number; fontSize: number }[];
}> {
  const respuesta = await fetch(`/test-scans/${archivo}`);
  if (!respuesta.ok) throw new Error(`No se pudo leer ${archivo}: ${respuesta.status}`);
  const blob = await respuesta.blob();
  const file = new File([blob], archivo, { type: 'application/pdf' });

  const pdfReaderMod = await import('../lib/ocr/pdf-reader');
  const ocrMod = await import('../lib/ocr/tesseract-worker');
  const layoutMod = await import('../lib/ocr/layout');
  const parserMod = await import('../lib/ocr/parser-contract');

  const extension = archivo.split('.').pop()?.toLowerCase() || '';
  let layoutObject: any = null;
  let texto = '';

  if (extension === 'pdf') {
    const pdfResult = await (pdfReaderMod as any).readPdfFile(file);
    if (pdfResult.isDigitalText && pdfResult.layout) {
      layoutObject = pdfResult.layout;
      texto = pdfResult.text;
    } else if (pdfResult.renderedPages) {
      const ocrRes = await (ocrMod as any).performOcr(pdfResult.renderedPages);
      layoutObject = ocrRes.layout;
      texto = ocrRes.text;
    }
  }

  const lineasLayout = layoutObject
    ? layoutObject.lines.map((l: any) => ({
        text: l.text, column: l.column, y: Math.round(l.y),
        height: Math.round(l.height), fontSize: Math.round(l.fontSize * 10) / 10,
      }))
    : [];

  const contrato = (parserMod as any).parseContractText(texto, layoutObject);

  return { texto, contrato, lineasLayout };
}

declare global {
  interface Window {
    bancoLector?: {
      medirDocumento: typeof medirDocumento;
      diagnosticar: typeof diagnosticar;
    };
  }
}

window.bancoLector = { medirDocumento, diagnosticar };
document.body.dataset.bancoListo = '1';
