/**
 * Capa de consentimiento visual (in-browser) opcional.
 *
 * Es una senal de apoyo al lector deterministico, NO un extractor. El motor
 * principal (pdf.js + Tesseract + maquetacion + parsers por campo) sigue siendo
 * la fuente de verdad y no cambia nunca cuando este modulo no esta disponible
 * (sin red, sin GPU, fallo del modelo): en todos esos casos se devuelve
 * `null` y el reader sigue el camino actual.
 *
 * Que hace: asigna un capcion grueso a cada pagina renderizada con un VLM
 * (Florence-2-base-ft via Transformers.js / onnxruntime-web, 100% en el
 * navegador) y clasifica ese capcion con reglas deterministicas en una de estas
 * categorias:
 *
 *   - `firma`      : la pagina parece un cierre con firma, despedida o membrete
 *                    ("Atentamente", "Gerencia", "Firma:", "Departamento de...").
 *   - `hoja_de_vida`: se lee el encabezado o un bloque de datos de candidato.
 *   - `contrato`   : la pagina parece un contrato o documento oficial.
 *   - `otro`       : sin senal clara.
 *
 * `processDocument` usa la primera pagina (o las disponibles) como un veto
 * suave: si el modelo dice "esta pagina es una firma/carta", se evita dejar que
 * el texto de esa pagina llene campos de candidato (nombre, titular, ciudad) —
 * exactamente el problema de "GERENCIA" / "CONDUCTOR,La" / "NRTA" que el OCR
 * mezclaba. Pero por diseno, cuando el modelo esta apagado o falla, no se hace
 * NADA: el resultado es identico al de hoy.
 *
 * Se activa con la bandera `cv_visual_consent` en localStorage, apagada por
 * defecto. Asi el banco de precision (159 tests) no depende de un descarga de
 * modelo y el despliegue no cambia de tamano para quien no la quiera.
 */

/**
 * Id del modelo ONNX listo para el navegador. `-base-ft` es la variante
 * ajustada de 223 MB; se sirve desde el Hub con la configuracion de Transformers.js.
 */
const MODEL_ID = 'onnx-community/Florence-2-base-ft';

/** Prompt de capcion detallada que Florence-2 entiende nativamente. */
const CAPTION_PROMPT = '<MORE_DETAILED_CAPTION>';

export type VisualPageKind = 'firma' | 'hoja_de_vida' | 'contrato' | 'otro';

export interface VisualConsentResult {
  /** Paginas disponibles y su categoria visual. */
  pages: { kind: VisualPageKind; caption: string }[];
  /**
   * True cuando al menos una pagina tiene pinta de ser un cierre/firma/carta.
   * Es la unica senal que el reader consulta hoy.
   */
  hasSignatureLikePage: boolean;
  /** El modelo no estaba disponible o fallo; el reader debe ignorar esto. */
  available: boolean;
}

type CaptionPipe = (image: unknown, kwargs?: Record<string, unknown>) => Promise<{ generated_text: string }[]>;

let pipelinePromise: Promise<CaptionPipe> | null = null;
let modelLoadErrorLogged = false;

/** Estado de la bandera opt-in. */
function visualConsentEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem('cv_visual_consent') === '1';
}

/**
 * Clasifica un capcion grueso en una categoria visual. Las reglas son
 * deterministicas y deliberadamente conservadoras: solo las firmas/cierres/
 * membreses considerados "sospechosos" cuentan en `hasSignatureLikePage`.
 */
export function classifyCaption(caption: string): VisualPageKind {
  const texto = ` ${(caption ?? '').toLowerCase()} `;

  const esFirma =
    /\b(atentamente|cordialmente|cordial\s+s[aá]ludo|firm[aó]\b|firma\b|gerencia\b|gerencia\s+general|direcci[oó]n\s+general|recursos\s+humanos|talento\s+humano|departamento\s+de\s+personal|administraci[oó]n)\b/.test(
      texto
    ) ||
    /(firma\s+de[l]?\s+(?:empleado|trabajador|personal)|firma\s+del|recibi[oó]|recib[ií]do\s+por|responsable\s+de\s+talento)/.test(
      texto
    );

  if (esFirma) return 'firma';

  const esHojaDeVida =
    /\b(curriculum|hoja\s+de\s+vida|cur[rr]iculo|datos\s+personales|experiencia\s+laboral|perfil\s+profesional|formaci[oó]n\s+acad[eé]mica|referencias\s+(?:personales|laborales))\b/.test(
      texto
    );
  if (esHojaDeVida) return 'hoja_de_vida';

  const esContrato =
    /\b(contrato\s+de\s+trabajo|empleador|trabajador|cl[aá]usul|termino\s+fijo|periodo\s+de\s+prueba|salario|nomina)\b/.test(
      texto
  );
  if (esContrato) return 'contrato';

  return 'otro';
}

function captionToText(captions: { generated_text: string }[] | { generated_text: string }): string {
  if (Array.isArray(captions)) return captions.map((c) => c.generated_text ?? '').join(' ');
  return captions?.generated_text ?? '';
}

async function getPipeline(): Promise<CaptionPipe> {
  if (!pipelinePromise) {
    pipelinePromise = import('@huggingface/transformers').then(({ pipeline }) => {
      const pipe = pipeline('image-to-text', MODEL_ID, { device: 'wasm' });
      // El pipeline es una clase invocable con la misma firma de llamada.
      return pipe as unknown as CaptionPipe;
    });
  }
  return pipelinePromise;
}

/**
 * Clasifica las paginas de un documento por su aspecto visual.
 *
 * @param pages Blobs (PNG) de las paginas renderizadas, en orden. Cuanto antes
 *   se corte, antes se devuelve: se clasifican como mucho las primeras 3 paginas.
 * @param enabledForza Si viene definido, impone el estado de la bandera (para
 *   pruebas); si no, se lee de localStorage.
 */
export async function visualConsent(
  pages: Blob[],
  enabledForza?: boolean
): Promise<VisualConsentResult | null> {
  const activo = enabledForza === undefined ? visualConsentEnabled() : enabledForza;
  if (!activo || !pages || pages.length === 0) return null;

  try {
    const pipe = await getPipeline();
    const resultado: VisualConsentResult = { pages: [], hasSignatureLikePage: false, available: true };

    for (const page of pages.slice(0, 3)) {
      const out = await pipe(page, { prompt: CAPTION_PROMPT });
      const caption = captionToText(out);
      const kind = caption ? classifyCaption(caption) : 'otro';
      resultado.pages.push({ kind, caption });
      if (kind === 'firma') resultado.hasSignatureLikePage = true;
    }

    return resultado;
  } catch (error) {
    if (!modelLoadErrorLogged) {
      modelLoadErrorLogged = true;
      console.warn(
        'Consentimiento visual (Florence-2) no disponible, se ignora:',
        error
      );
    }
    return null;
  }
}

/** Permite resetear el modelo cargado (util en pruebas). */
export function resetVisualConsentModuleForTests(): void {
  pipelinePromise = null;
  modelLoadErrorLogged = false;
}