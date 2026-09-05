/**
 * Genera el documento academico del proyecto de grado (formato ICONTEC) con el
 * contenido del proyecto OCR de hojas de vida para Distribuciones Rosimar S.A.S.
 *
 * Ejecucion:
 *   cd apps/web
 *   npm run academico:grado
 *
 * El resultado se escribe en Documento_Academico_Proyecto_Grado_ROSIMAR.docx
 * (en la carpeta de proyecto de grado dentro de Descargas del usuario).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const SALIDA = path.resolve(process.env.SALIDA_ACADEMICO ?? RAIZ, 'Documento_Academico_Proyecto_Grado_ROSIMAR.docx');

const NEGRO = '000000';
const AZUL = '1F4E79';
const GRIS_CABECERA = 'D9E2F3';
const FUENTE = 'Times New Roman';
const CURSO = 24; // 12 pt

const TITULO_PROYECTO =
  'Sistema de información basado en OCR para la gestión y procesamiento automatizado de hojas de vida en el área de Talento Humano de la empresa Distribuciones Rosimar S.A.S.';

const OBJETIVO_GENERAL =
  'Desarrollar un sistema de información basado en reconocimiento óptico de caracteres (OCR) para la gestión y procesamiento automatizado de hojas de vida, con el fin de optimizar los tiempos de análisis, clasificación y selección de personal en el área de Talento Humano de la empresa Distribuciones Rosimar S.A.S.';

const OBJETIVOS_ESPECIFICOS = [
  'Recomputar y diagnosticar los requerimientos funcionales y no funcionales del área de Talento Humano para la recepción, filtrado y almacenamiento de las hojas de vida en Distribuciones Rosimar S.A.S.',
  'Diseñar la arquitectura del sistema y la base de datos, definiendo los modelos de datos, la interfaz de usuario y la integración del motor de OCR para la extracción precisa de información clave (datos personales, formación y experiencia).',
  'Construir los módulos del sistema de información integrando las funcionalidades de carga masiva, procesamiento OCR, etiquetado dinámico y motor de búsqueda inteligente de candidatos.',
  'Validar y probar la plataforma mediante pruebas funcionales, de usabilidad y de precisión del OCR con hojas de vida reales del área de Talento Humano de la empresa.',
];

function t(texto, opciones = {}) {
  return new TextRun({
    text: texto,
    font: FUENTE,
    size: opciones.size ?? CURSO,
    bold: opciones.bold ?? false,
    italics: opciones.italics ?? false,
    color: opciones.color ?? NEGRO,
  });
}

function p(bloques, opciones = {}) {
  return new Paragraph({
    children: bloques,
    spacing: { before: opciones.before ?? 0, after: opciones.after ?? 180, line: 300 },
    alignment: opciones.alignment ?? AlignmentType.JUSTIFIED,
    indent: opciones.indent,
  });
}

function cuerpo(texto) {
  return p([t(texto)]);
}

function encabezado1(numero, texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 200 },
    children: [t(`${numero}. ${texto}`, { size: 30, bold: true, color: AZUL })],
  });
}

function encabezado2(texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 160 },
    children: [t(texto, { size: 28, bold: true })],
  });
}

const BORDES_TABLA = {
  top: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
  left: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
  right: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
};

function celda(texto, opciones = {}) {
  const parrafos = Array.isArray(texto) ? texto : [texto];
  return new TableCell({
    borders: BORDES_TABLA,
    verticalAlign: VerticalAlign.CENTER,
    shading: opciones.sombreado ? { type: ShadingType.CLEAR, fill: GRIS_CABECERA } : undefined,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    width: { size: opciones.ancho ?? 25, type: WidthType.PERCENTAGE },
    children: parrafos.map(
      (linea) =>
        new Paragraph({
          alignment: opciones.center ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { line: 275 },
          children: [t(linea, { size: opciones.size ?? 22, bold: opciones.bold ?? false })],
        })
    ),
  });
}

function tabla(columnas, filas) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: columnas.map((c) =>
          celda(c.texto, { ancho: c.ancho, center: true, bold: true, sombreado: true })
        ),
      }),
      ...filas.map(
        (f) =>
          new TableRow({
            children: f.map((v, i) => celda(v.texto, { ancho: columnas[i].ancho, center: f._center?.[i] ?? columnas[i].center })),
          })
      ),
    ],
  });
}

// ============================ CRONOGRAMA ============================
const SEMANAS = [
  ['S1', 'Sep 1 - 4'],
  ['S2', 'Sep 7 - 11'],
  ['S3', 'Sep 14 - 18'],
  ['S4', 'Sep 21 - 25'],
  ['S5', 'Sep 28 - Oct 2'],
  ['S6', 'Oct 5 - 9'],
  ['S7', 'Oct 12 - 16'],
  ['S8', 'Oct 19 - 23'],
  ['S9', 'Oct 26 - 30'],
  ['S10', 'Nov 2 - 8'],
];
const ACTIVIDADES_CRONO = [
  ['Inicio de la práctica: reconocimiento de la empresa y del área de Talento Humano; definición del plan de trabajo', [1]],
  ['Levantamiento de requerimientos funcionales (recepción, filtrado y almacenamiento de hojas de vida)', [2]],
  ['Diagnóstico de requerimientos no funcionales y caracterización del proceso actual; documento de requerimientos', [3]],
  ['Diseño de la arquitectura del sistema y de la base de datos: modelos de datos, interfaz de usuario e integración del motor de OCR', [4, 5]],
  ['Construcción de módulos: carga masiva de hojas de vida y procesamiento OCR', [6, 7]],
  ['Construcción de módulos: etiquetado dinámico y motor de búsqueda inteligente de candidatos', [8, 9]],
  ['Pruebas funcionales, de usabilidad y de precisión del OCR con hojas de vida reales', [10]],
  ['Consolidación de resultados, informe final y cierre de la práctica', [10]],
];

const tablaCronograma = () => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          celda('N°', { ancho: 6, center: true, bold: true, sombreado: true }),
          celda('ACTIVIDAD', { ancho: 28, bold: true, sombreado: true }),
          ...SEMANAS.map(([s, f]) =>
            celda([s, f], { ancho: 6.6, center: true, bold: true, sombreado: true })
          ),
        ],
      }),
      ...ACTIVIDADES_CRONO.map(([act, xs], r) => {
        const celdas = [
          celda(String(r + 1), { ancho: 6, center: true }),
          celda(act, { ancho: 28 }),
          ...SEMANAS.map((_, c) =>
            celda(xs.includes(c + 1) ? 'X' : '', { ancho: 6.6, center: true })
          ),
        ];
        return new TableRow({ children: celdas });
      }),
    ],
  });
};

const children = [
  // ============================ PORTADA ============================
  p([t('UNIVERSIDAD', { size: 40, bold: true })], { alignment: AlignmentType.CENTER, after: 120 }),
  p([t('Facultad de Ingeniería', { size: 30 })], { alignment: AlignmentType.CENTER, after: 40 }),
  p([t('Programa de Ingeniería de Sistemas', { size: 30 })], { alignment: AlignmentType.CENTER, after: 600 }),
  p([t('Proyecto de Grado como Práctica Empresarial', { size: 26, italics: true })], { alignment: AlignmentType.CENTER, after: 600 }),
  p([t(TITULO_PROYECTO, { size: 32, bold: true })], { alignment: AlignmentType.CENTER, after: 800 }),
  p([t('Presentado por:', { size: 26 })], { alignment: AlignmentType.CENTER, after: 60 }),
  p([t('JHOLMAN ADRIAN SOGAMOSO GUTIERREZ', { size: 28, bold: true })], { alignment: AlignmentType.CENTER, after: 60 }),
  p([t('C.C. 1006457519', { size: 24 })], { alignment: AlignmentType.CENTER, after: 400 }),
  p([t('Director:', { size: 26 })], { alignment: AlignmentType.CENTER, after: 60 }),
  p([t('[Nombre del director]', { size: 26 })], { alignment: AlignmentType.CENTER, after: 400 }),
  p([t('Empresa: Distribuciones Rosimar S.A.S.', { size: 26 })], { alignment: AlignmentType.CENTER, after: 120 }),
  p([t('Barranquilla, Atlántico', { size: 24 })], { alignment: AlignmentType.CENTER, after: 120 }),
  p([t('2026', { size: 28, bold: true })], { alignment: AlignmentType.CENTER, after: 0 }),

  // ============================ CONTENIDO ============================
  encabezado1(0, 'CONTENIDO'),
  ...['1. Objetivos', '2. Resumen del Proyecto', '3. Planteamiento del Problema', '4. Justificación', '5. Marco Teórico y Estado del Arte', '6. Delimitación', '7. Tareas y Cronograma de Actividades', '8. Resultados/Productos Esperados y Potenciales Beneficiarios', '9. Referencias Bibliográficas'].map((c) =>
    p([t(c)], { alignment: AlignmentType.LEFT, after: 100 })
  ),

  // ============================ 1. OBJETIVOS ============================
  encabezado1(1, 'OBJETIVOS'),
  encabezado2('1.1 Objetivo General'),
  cuerpo(OBJETIVO_GENERAL),
  encabezado2('1.2 Objetivos Específicos'),
  p([t('Para alcanzar el objetivo general, se plantea la siguiente secuencia metodológica:', { italics: true })], { alignment: AlignmentType.LEFT }),
  ...OBJETIVOS_ESPECIFICOS.map((o, i) =>
    p([t(`OE${i + 1}. `, { bold: true }), t(o)], { indent: { left: 480 } })
  ),

  // ============================ 2. RESUMEN ============================
  encabezado1(2, 'RESUMEN DEL PROYECTO'),
  cuerpo(
    'El presente proyecto de grado propone el desarrollo de un sistema de información basado en reconocimiento óptico de caracteres (OCR) para la gestión y procesamiento automatizado de hojas de vida en el área de Talento Humano de Distribuciones Rosimar S.A.S., empresa de comercio al por mayor de Barranquilla que recibe a diario decenas de hojas de vida en formatos heterogéneos (PDF escaneado, imágenes y Word) y las lee y transcribe de forma manual. El sistema permite la carga masiva de documentos, ejecuta el OCR en el navegador del usuario mediante Tesseract.js, reconstruye el orden lógico de lectura en documentos con columnas y aplica un etiquetado dinámico por secciones para extraer los datos de cada candidato (datos personales, formación y experiencia). Cuenta con un motor de búsqueda inteligente de candidatos que filtra, clasifica y compara perfiles para agilizar la selección de personal, así como un módulo de gestión de candidatos y empleados con almacenamiento local sin conexión (IndexedDB) y persistencia en un backend gratuito (Supabase) con seguridad a nivel de fila. Al ejecutar el OCR en el dispositivo, los datos personales de los candidatos nunca salen del equipo, lo que reduce costos de infraestructura y protege la confidencialidad. El sistema optimiza los tiempos de análisis, clasificación y selección, ofrece una herramienta económica y reproducible, y acompaña el flujo completo desde la recepción de la hoja de vida hasta la contratación.'
  ),
  encabezado2('2.1 Palabras Clave'),
  cuerpo('Reconocimiento Óptico de Caracteres; Gestión de Talento Humano; Extracción de datos; Aplicación Web Progresiva; Seguridad de datos.'),

  // ============================ 3. PLANTEAMIENTO ============================
  encabezado1(3, 'PLANTEAMIENTO DEL PROBLEMA'),
  cuerpo(
    'Distribuciones Rosimar S.A.S. recibe a diario decenas de hojas de vida en formatos heterogéneos: PDF escaneado, imágenes fotografiadas con el teléfono y documentos de Word. El proceso de reclutamiento se apoya casi por completo en la lectura manual: un reclutador debe abrir cada hoja de vida, leer el texto, identificar los datos del candidato (datos personales, formación y experiencia) y transcribirlos a una base de datos para poder filtrarlos, clasificarlos y compararlos. Esta tarea es lenta, propensa a errores humanos de captura y hace que la información no esté disponible en tiempo real durante la entrevista inicial. El problema se agrava porque las hojas de vida no siguen un formato estandarizado, la calidad de los escaneos varía y con frecuencia hay texto en varias columnas que dificulta la lectura automática; además, no existe una carga masiva de documentos ni una búsqueda inteligente de candidatos. La organización no dispone de una herramienta económica que automatice el análisis y la clasificación, concentre la lectura y estructuración de la información de las hojas de vida y optimice los tiempos del área de Talento Humano.'
  ),

  // ============================ 4. JUSTIFICACION ============================
  encabezado1(4, 'JUSTIFICACIÓN'),
  cuerpo(
    'El proyecto se desarrolla porque la gestión manual de hojas de vida consume tiempo valioso del equipo de Talento Humano, introduce errores de digitación y retrasa la toma de decisiones sobre una vacante. Automatizar la lectura, la clasificación y la selección permite al reclutador dedicarse a evaluar candidatos y decidir, no a transcribir datos. La carga masiva y el etiquetado dinámico de los documentos eliminan la captura desordenada, mientras el motor de búsqueda inteligente acelera el filtrado y la comparación de perfiles, reduciendo los tiempos de análisis y selección. El aporte principal es un sistema de costo casi nulo que ejecuta el OCR dentro del navegador sin enviar datos personales a servidores externos, protegiendo la confidencialidad y cumpliendo los principios de minimización de datos. Además, aporta una metodología reproducible para segmentar documentos con columnas que puede aplicarse a otros tipos de documento de la organización.'
  ),

  // ============================ 5. MARCO TEORICO ============================
  encabezado1(5, 'MARCO TEÓRICO Y ESTADO DEL ARTE'),
  encabezado2('5.1 Reconocimiento Óptico de Caracteres (OCR)'),
  cuerpo(
    'El OCR es el proceso que convierte imágenes de texto impreso o manuscrito en texto codificado, compuesto por etapas de preprocesamiento (reescalado, binarización, corrección de inclinación), detección de regiones de texto, segmentación en palabras y clasificación de caracteres. En este proyecto se utiliza el motor Tesseract.js, una compilación a WebAssembly del motor Tesseract, lo que permite ejecutar el reconocimiento sin enviar el documento a un servidor (Smith, 2007). El preprocesamiento con la API Canvas (escala de grises, umbral de Otsu y corrección de inclinación) mejora la precisión en escaneos de baja calidad.'
  ),
  encabezado2('5.2 Análisis de layout y reconstrucción del orden de lectura'),
  cuerpo(
    'Un documento puede tener texto en varias columnas (encabezados, tablas, listas). Para extraer datos de forma fiable es necesario reconstruir el orden lógico de lectura, agrupar las palabras en renglones y detectar la estructura de columnas, en lugar de procesar el texto plano secuencialmente. El pipeline del proyecto se organiza en extracción, layout (renglones y columnas), segmentación por secciones y un extractor por campo; el etiquetado dinámico asigna una categoría (dato personal, formación o experiencia) a cada sección detectada.'
  ),
  encabezado2('5.3 Coordenadas y geometría de página'),
  cuerpo(
    'El motor OCR entrega junto con cada palabra sus coordenadas en la página, lo que permite alineaciones verticales, detección de pares etiqueta-valor en tablas de dos columnas y la asociación de un campo con su valor aunque el texto esté partido en varios renglones.'
  ),
  encabezado2('5.4 Procesamiento de documentos y carga masiva'),
  cuerpo(
    'El procesamiento de documentos permite admitir grandes volúmenes de hojas de vida de una sola vez, gestionar colas de ingesta y normalizar formatos heterogéneos (PDF mediante pdfjs-dist, imágenes mediante Tesseract.js y Word mediante mammoth), base sobre la cual se construye el motor de búsqueda inteligente de candidatos.'
  ),
  encabezado2('5.5 Aplicación web progresiva (PWA) y almacenamiento offline'),
  cuerpo(
    'Una PWA funciona sin conexión, se instala en el dispositivo y sincroniza los cambios cuando hay red. IndexedDB (a través de Dexie.js) permite trabajar sin conexión y acumular una cola de sincronización, mientras que un backend gratuito provee persistencia compartida entre usuarios.'
  ),
  encabezado2('5.6 Backend gratuito y seguridad a nivel de fila (RLS)'),
  cuerpo(
    'Supabase ofrece PostgreSQL gratuito, autenticación, almacenamiento y funciones de borde; las políticas de seguridad a nivel de fila (RLS) restringen el acceso a los registros según el rol y el contexto de cada usuario, protegiendo los datos personales de los candidatos.'
  ),
  encabezado2('5.7 Privacidad y protección de datos'),
  cuerpo(
    'El tratamiento de datos personales se enmarca en la Ley 1581 de 2012 (República de Colombia, 2012) y sus principios de finalidad, necesidad y minimización. Ejecutar el OCR en el dispositivo del usuario evita que las hojas de vida salgan del equipo, reforzando la confidencialidad del proceso de selección.'
  ),
  encabezado2('5.8 Estado del Arte'),
  cuerpo(
    'En el ámbito internacional existen soluciones comerciales de análisis de hojas de vida (software de reclutamiento y sistemas de seguimiento de candidatos) que extraen datos mediante servicios de procesamiento en la nube, con costo por documento y envío de información a servidores externos, lo que plantea consideraciones de costo y privacidad. En el ámbito regional y nacional, la mayoría de las pequeñas y medianas empresas colombianas gestionan las hojas de vida de forma manual con planillas de cálculo o sistemas genéricos de gestión documental que no ofrecen extracción automática de datos, carga masiva, etiquetado dinámico ni una búsqueda inteligente de candidatos integrada al proceso de contratación. Frente a este panorama, la propuesta se distingue por ejecutar todo el cómputo del OCR en el navegador (costo de infraestructura cercano a cero y documentos que nunca salen del dispositivo), reconstruir el orden de lectura para manejar documentos con columnas, ofrecer carga masiva y etiquetado dinámico, e integrar un motor de búsqueda inteligente de candidatos con la gestión de candidatos y empleados bajo reglas de negocio definidas.'
  ),
  p([t('La siguiente tabla compara las alternativas disponibles frente a la propuesta de este proyecto:', { italics: true })], { alignment: AlignmentType.LEFT }),
  tabla(
    [
      { texto: 'Solución', ancho: 20 },
      { texto: 'Tipo', ancho: 12, center: true },
      { texto: 'Tecnología', ancho: 18 },
      { texto: 'Ventaja', ancho: 22 },
      { texto: 'Limitación', ancho: 28 },
    ],
    [
      [
        { texto: 'Software de reclutamiento (ATS)' },
        { texto: 'SaaS', center: true },
        { texto: 'Nube / propietaria' },
        { texto: 'Extracción y seguimiento integrados' },
        { texto: 'Costo por documento y envío de datos a servidores externos' },
      ],
      [
        { texto: 'Motores OCR en la nube (Google Vision, ABBYY)' },
        { texto: 'API', center: true },
        { texto: 'Nube' },
        { texto: 'Alta precisión' },
        { texto: 'Costo por documento, dependencia de red y privacidad' },
      ],
      [
        { texto: 'Gestión documental genérica' },
        { texto: 'Open source', center: true },
        { texto: 'Variada' },
        { texto: 'Bajo costo' },
        { texto: 'Sin extracción automática ni búsqueda de candidatos' },
      ],
      [
        { texto: 'Desarrollo a medida (propuesta)' },
        { texto: 'Custom', center: true },
        { texto: 'React + Tesseract.js (WASM)' },
        { texto: 'OCR 100% local, costo $0, privacidad' },
        { texto: 'Requiere desarrollo inicial' },
      ],
    ]
  ),

  // ============================ 6. DELIMITACION ============================
  encabezado1(6, 'DELIMITACIÓN'),
  encabezado2('6.1 Objetivo General'),
  cuerpo(OBJETIVO_GENERAL),
  encabezado2('6.2 Objetivos Específicos'),
  ...OBJETIVOS_ESPECIFICOS.map((o, i) => p([t(`OE${i + 1}. `, { bold: true }), t(o)], { indent: { left: 480 } })),
  encabezado2('6.3 Acotaciones'),
  p([t('Tecnologías computacionales a utilizar:', { bold: true })], { alignment: AlignmentType.LEFT }),
  cuerpo('Frontend: React 19, Vite, TypeScript y Tailwind CSS (aplicación web progresiva).'),
  cuerpo('OCR en el navegador: Tesseract.js (WebAssembly, idioma spa+eng), pdfjs-dist, mammoth y preprocesamiento con Canvas API.'),
  cuerpo('Persistencia local: Dexie.js / IndexedDB con cola de sincronización offline.'),
  cuerpo('Backend: Supabase (PostgreSQL, autenticación, políticas RLS y Storage) sin costo mensual.'),
  cuerpo('Reportes y exportación: Recharts, jsPDF y xlsx. Calidad: Vitest, Playwright y ESLint.'),
  p([t('Alcance geográfico:', { bold: true })], { alignment: AlignmentType.LEFT, after: 100 }),
  cuerpo('La plataforma se aplica inicialmente al proceso de selección de personal de Distribuciones Rosimar S.A.S. en Barranquilla. Se limita al análisis de documentos en español, en formatos PDF, imágenes JPEG/PNG y Word.'),
  p([t('Limitaciones de tiempo:', { bold: true })], { alignment: AlignmentType.LEFT, after: 100 }),
  cuerpo('El proyecto se desarrollará en un periodo de 10 semanas (1 de septiembre al 8 de noviembre de 2026), correspondiente a la práctica empresarial.'),
  p([t('Limitaciones de presupuesto:', { bold: true })], { alignment: AlignmentType.LEFT, after: 100 }),
  cuerpo('El sistema opera con un costo mensual de infraestructura cercano a cero: el despliegue estático se realiza en planes gratuitos y todo el cómputo del OCR se ejecuta en el dispositivo del usuario. No se utilizan servicios de pago por documento.'),
  p([t('Recurso particular:', { bold: true })], { alignment: AlignmentType.LEFT, after: 100 }),
  cuerpo('La empresa cuenta con hojas de vida reales del área de Talento Humano y con los escaneos de la práctica para conformar el banco de pruebas del lector; el motor OCR corre por completo en la CPU del navegador, sin servicios externos de pago.'),
  cuerpo('Quedan fuera del alcance la redacción automática de hojas de vida, la verificación automática de antecedentes, la integración con bolsas de trabajo externas y el despliegue en infraestructura de pago.'),

  // ============================ 7. CRONOGRAMA ============================
  encabezado1(7, 'TAREAS Y CRONOGRAMA DE ACTIVIDADES'),
  encabezado2('7.1 Cronograma de Actividades'),
  p([t('Cronograma propuesto para la práctica profesional (1 de septiembre al 8 de noviembre de 2026):', { italics: true })], { alignment: AlignmentType.LEFT }),
  tablaCronograma(),
  p([t('DURACIÓN TOTAL: 10 SEMANAS (1 de septiembre de 2026 - 8 de noviembre de 2026)', { bold: true })], { alignment: AlignmentType.CENTER, before: 200, after: 300 }),
  encabezado2('7.2 Descripción de Actividades'),
  ...[
    'Levantamiento de requerimientos (Semanas 1-3): reconocimiento de la empresa y del área de Talento Humano; levantamiento de requerimientos funcionales y no funcionales sobre la recepción, filtrado y almacenamiento de hojas de vida; documento de requerimientos.',
    'Diseño de la arquitectura y la base de datos (Semanas 4-5): arquitectura del sistema, modelos de datos, casos de uso, interfaz de usuario e integración del motor de OCR.',
    'Construcción de módulos de carga y OCR (Semanas 6-7): carga masiva de hojas de vida en PDF, imagen y Word, y procesamiento OCR.',
    'Construcción de módulos de etiquetado y búsqueda (Semanas 8-9): etiquetado dinámico por secciones y motor de búsqueda inteligente de candidatos.',
    'Pruebas de la plataforma (Semana 10): pruebas funcionales, de usabilidad y de precisión del OCR con hojas de vida reales.',
    'Consolidación y cierre (Semana 10): resultados, informe final y cierre de la práctica.',
  ].map((d, i) => cuerpo(`${i + 1}. ${d}`)),

  // ============================ 8. RESULTADOS ============================
  encabezado1(8, 'RESULTADOS/PRODUCTOS ESPERADOS Y POTENCIALES BENEFICIARIOS'),
  encabezado2('8.1 Resultados y Productos Esperados'),
  tabla(
    [
      { texto: 'N°', ancho: 6, center: true },
      { texto: 'Resultado / Producto', ancho: 47 },
      { texto: 'Entregable', ancho: 47 },
    ],
    [
      [{ texto: '1' }, { texto: 'Sistema web progresivo (PWA) funcional' }, { texto: 'Aplicación que carga masivamente hojas de vida en PDF, imagen y Word, extrae los campos del candidato y muestra un formulario editable antes de guardar' }],
      [{ texto: '2' }, { texto: 'Módulo de etiquetado dinámico y segmentación por secciones' }, { texto: 'Extracción de datos personales, formación y experiencia de cada hoja de vida' }],
      [{ texto: '3' }, { texto: 'Motor de búsqueda inteligente de candidatos' }, { texto: 'Filtrado, clasificación y comparación de perfiles para la selección de personal' }],
      [{ texto: '4' }, { texto: 'Módulo de gestión de talento humano' }, { texto: 'Estados del candidato y ciclo de vida del empleado con reglas de negocio y alertas' }],
      [{ texto: '5' }, { texto: 'Banco de pruebas y métricas del lector' }, { texto: 'Escaneos reales con indicadores de precisión por campo (reader-accuracy)' }],
      [{ texto: '6' }, { texto: 'Módulo de reportes y exportación' }, { texto: 'Gráficos del proceso de selección y exportación de listados a Excel y PDF' }],
      [{ texto: '7' }, { texto: 'Documentación técnica' }, { texto: 'Arquitectura, modelo de datos, sistema de diseño y guía de despliegue en infraestructura gratuita' }],
    ]
  ),
  encabezado2('8.2 Potenciales Beneficiarios'),
  tabla(
    [
      { texto: 'Beneficiario', ancho: 30 },
      { texto: 'Beneficio', ancho: 70 },
    ],
    [
      [{ texto: 'Área de Talento Humano de Distribuciones Rosimar S.A.S.' }, { texto: 'Reduce los tiempos de análisis y clasificación de hojas de vida, disminuye los errores de digitación y concentra la información del candidato y del empleado en un solo lugar' }],
      [{ texto: 'Aspirantes y candidatos' }, { texto: 'Proceso de selección más ágil y transparente' }],
      [{ texto: 'Directivos de la compañía' }, { texto: 'Información confiable y disponible para la toma de decisiones' }],
      [{ texto: 'Comunidad universitaria' }, { texto: 'Proyecto de referencia de OCR en el navegador y PWA de bajo costo' }],
    ]
  ),

  // ============================ 9. REFERENCIAS ============================
  encabezado1(9, 'REFERENCIAS BIBLIOGRÁFICAS'),
  ...[
    'SMITH, R. An Overview of the Tesseract OCR Engine. En: Proceedings of the International Conference on Document Analysis and Recognition (ICDAR), 2007.',
    'TESSERACT.JS PROJECT. Documentación oficial del motor OCR en WebAssembly [en línea]. 2025. [Consultado: 20 de agosto de 2026]. Disponible en: https://tesseract.projectnaptha.com',
    'MOZILLA DEVELOPER NETWORK. IndexedDB API y aplicaciones web progresivas (PWA) [en línea]. 2025. [Consultado: 20 de agosto de 2026]. Disponible en: https://developer.mozilla.org',
    'SUPABASE. Documentation: Base de datos PostgreSQL, Autenticación y Políticas de Seguridad a Nivel de Fila (RLS) [en línea]. 2025. [Consultado: 20 de agosto de 2026]. Disponible en: https://supabase.com/docs',
    'ORIOL, N. Gestión del talento humano en las PYMES: retos y oportunidades. Bogotá, 2021. 120 p.',
    'PRESSMAN, R. S.; MAXIM, B. R. Software Engineering: A Practitioner’s Approach. 9. ed. New York: McGraw-Hill Education, 2020. 768 p.',
    'REACT. Documentación oficial de React [en línea]. Meta Open Source, 2025. [Consultado: 20 de agosto de 2026]. Disponible en: https://react.dev',
    'VITE. Documentación oficial de Vite [en línea]. 2025. [Consultado: 20 de agosto de 2026]. Disponible en: https://vite.dev',
    'TYPESCRIPT. Documentación oficial de TypeScript [en línea]. Microsoft, 2025. [Consultado: 20 de agosto de 2026]. Disponible en: https://typescriptlang.org',
    'REPÚBLICA DE COLOMBIA. Ley 1581 de 2012 (17 de octubre de 2012): por la cual se dictan disposiciones generales para la protección de datos personales. Diario Oficial No. 48.587. Bogotá, 2012.',
    'INSTITUTO COLOMBIANO DE NORMAS TÉCNICAS Y CERTIFICACIÓN. NTC 1486: Documentación. Presentación de tesis, trabajos de grado y otros trabajos de investigación. Bogotá: ICONTEC, 2008.',
    'INSTITUTO COLOMBIANO DE NORMAS TÉCNICAS Y CERTIFICACIÓN. NTC 5613: Referencias bibliográficas. Contenido, forma y estructura. Bogotá: ICONTEC, 2013.',
  ].map((r) => cuerpo(r)),

  p([t('Documento elaborado conforme a las Normas ICONTEC NTC 1486 y NTC 5613', { size: 22, italics: true })], { alignment: AlignmentType.CENTER, before: 300, after: 60 }),
  p([t('Barranquilla, septiembre de 2026', { size: 22, italics: true })], { alignment: AlignmentType.CENTER, after: 0 }),
];

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FUENTE, size: CURSO, color: NEGRO },
      },
      heading1: { run: { font: FUENTE, color: AZUL } },
      heading2: { run: { font: FUENTE, color: NEGRO } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1000, bottom: 1000, left: 1400, right: 1000 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                t('Documento elaborado conforme a las Normas ICONTEC NTC 1486 y NTC 5613', { size: 18, italics: true }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [t('Página ', { size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FUENTE }), t(' de ', { size: 18 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: FUENTE })],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
const bytes = await Packer.toBuffer(doc);
fs.writeFileSync(SALIDA, bytes);
console.log(`Documento academico generado: ${SALIDA} (${(bytes.length / 1024).toFixed(1)} KiB)`);