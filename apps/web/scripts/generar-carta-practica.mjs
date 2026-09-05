/**
 * Genera la carta de aval de practica profesional para la universidad en DOCX.
 *
 * Ejecucion:
 *   cd apps/web
 *   npm run carta:practica
 *
 * El resultado queda en ../../docs/carta-aval-practica.docx (raiz del repo).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
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
const RAIZ_WEB = path.resolve(AQUI, '..');
const SALIDA = path.resolve(RAIZ_WEB, '..', '..', 'docs');

const AZUL = '1F4E79';
const GRIS_CLARO = 'D9E2F3';
const NEGRO = '1A1A1A';

const FUENTE_TITULO = 'Cambria';
const FUENTE_TEXTO = 'Cambria';
const TAMANO_CUERPO = 24; // 12 pt
const TAMANO_MEMBRETE = 46; // 23 pt

function parrafo(bloques, opciones = {}) {
  return new Paragraph({
    children: bloques,
    spacing: { after: 180, line: 300 },
    alignment: opciones.alignment ?? AlignmentType.JUSTIFIED,
    indent: opciones.indent,
  });
}

function tituloSeccion(numero, texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: AZUL, space: 4 },
    },
    children: [
      new TextRun({ text: `${numero}. `, font: FUENTE_TITULO, size: 30, bold: true, color: AZUL }),
      new TextRun({ text: texto, font: FUENTE_TITULO, size: 30, bold: true, color: AZUL }),
    ],
  });
}

const TABLA_BORDES = {
  top: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
  left: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
  right: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: AZUL },
};

const FILAS_CRONOGRAMA = [
  ['1', 'Sep 1 - 4', 'Inicio de práctica, reconocimiento de la empresa y del área de Talento Humano; definición del plan de trabajo', '1'],
  ['2', 'Sep 7 - 11', 'Levantamiento de requerimientos funcionales (recepción, filtrado y almacenamiento de hojas de vida)', '1'],
  ['3', 'Sep 14 - 18', 'Diagnóstico de requerimientos no funcionales y caracterización del proceso actual; documento de requerimientos', '1'],
  ['4-5', 'Sep 21 - Oct 2', 'Diseño de arquitectura, modelo de datos, casos de uso, interfaz e integración del motor de OCR', '2'],
  ['6-7', 'Oct 5 - 16', 'Construcción de módulos: carga masiva de hojas de vida y procesamiento OCR', '3'],
  ['8-9', 'Oct 19 - 30', 'Construcción de módulos: etiquetado dinámico y motor de búsqueda inteligente de candidatos', '3'],
  ['10', 'Nov 2 - 6', 'Pruebas funcionales, de usabilidad y de precisión del OCR con hojas de vida reales', '4'],
  ['Cierre', 'Nov 6 - 8', 'Consolidación de resultados, informe final y cierre de la práctica', '4'],
];

function celdaCronograma(texto, opciones = {}) {
  return new TableCell({
    borders: TABLA_BORDES,
    verticalAlign: VerticalAlign.CENTER,
    shading: opciones.sombreado ? { type: ShadingType.CLEAR, fill: GRIS_CLARO } : undefined,
    margins: { top: 120, bottom: 120, left: 150, right: 150 },
    width: { size: opciones.ancho ?? 25, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        alignment: opciones.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { line: 265 },
        children: [
          new TextRun({
            text: texto,
            font: FUENTE_TEXTO,
            size: 21,
            bold: opciones.bold ?? false,
            color: NEGRO,
          }),
        ],
      }),
    ],
  });
}

function filaCronograma(fila, esCabecera = false) {
  return new TableRow({
    tableHeader: esCabecera,
    children: [
      celdaCronograma(fila[0], { center: true, bold: esCabecera, sombreado: esCabecera, ancho: 14 }),
      celdaCronograma(fila[1], { center: true, bold: esCabecera, sombreado: esCabecera, ancho: 18 }),
      celdaCronograma(fila[2], { bold: esCabecera, sombreado: esCabecera, ancho: 54 }),
      celdaCronograma(fila[3], { center: true, bold: esCabecera, sombreado: esCabecera, ancho: 14 }),
    ],
  });
}

const children = [
  // ============================ MEMBRETE ============================
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [
      new TextRun({ text: 'DISTRIBUCIONES ROSIMAR S.A.S.', font: FUENTE_TITULO, size: TAMANO_MEMBRETE, bold: true, color: AZUL }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [
      new TextRun({ text: 'NIT. 901.167.955-4', font: FUENTE_TEXTO, size: 22, color: NEGRO }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [
      new TextRun({ text: 'Barranquilla - Atlántico', font: FUENTE_TEXTO, size: 22, color: NEGRO }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [
      new TextRun({ text: '[Dirección de la empresa]  ·  [Teléfono]  ·  [Correo institucional]', font: FUENTE_TEXTO, size: 20, color: NEGRO }),
    ],
  }),
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: AZUL, space: 6 } },
    spacing: { after: 300 },
  }),

  // ============================ FECHA ============================
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 300 },
    children: [
      new TextRun({ text: 'Barranquilla, [día] de septiembre de 2026', font: FUENTE_TEXTO, size: 23, color: NEGRO }),
    ],
  }),

  // ============================ DESTINATARIO ============================
  parrafo([new TextRun({ text: 'Señores', font: FUENTE_TEXTO, size: TAMANO_CUERPO, bold: true, color: NEGRO })], { alignment: AlignmentType.LEFT, indent: { left: 0 } }),
  parrafo([new TextRun({ text: '[Nombre de la Universidad]', font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO })], { alignment: AlignmentType.LEFT }),
  parrafo([new TextRun({ text: '[Programa Académico]', font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO })], { alignment: AlignmentType.LEFT }),
  parrafo([new TextRun({ text: '[Coordinación de Prácticas Profesionales]', font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO })], { alignment: AlignmentType.LEFT }),
  new Paragraph({
    spacing: { after: 260 },
    children: [new TextRun({ text: '[Ciudad]', font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO })],
  }),

  // ============================ ASUNTO ============================
  new Paragraph({
    spacing: { after: 300, line: 300 },
    children: [
      new TextRun({ text: 'Asunto: ', font: FUENTE_TEXTO, size: TAMANO_CUERPO, bold: true, color: NEGRO }),
      new TextRun({
        text: 'aval del desarrollo de práctica profesional y presentación del proyecto a cargo del estudiante [NOMBRE DEL ESTUDIANTE], código [CÓDIGO]',
        font: FUENTE_TEXTO,
        size: TAMANO_CUERPO,
        color: NEGRO,
      }),
    ],
  }),

  // ============================ CUERPO ============================
  parrafo([new TextRun({ text: 'Cordial saludo,', font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO })], { alignment: AlignmentType.LEFT }),

  parrafo([
    new TextRun({ text: 'Distribuciones Rosimar S.A.S., empresa dedicada a la distribución de productos de consumo masivo con [número] puntos de venta en la región Caribe, certifica que el estudiante ', font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO }),
    new TextRun({ text: '[NOMBRE DEL ESTUDIANTE]', font: FUENTE_TEXTO, size: TAMANO_CUERPO, bold: true, color: NEGRO }),
    new TextRun({ text: ', identificado con cédula de ciudadanía [CÉDULA], del programa [PROGRAMA] de [UNIVERSIDAD], ha sido aceptado para desarrollar su práctica profesional en el ', font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO }),
    new TextRun({ text: 'área de Talento Humano', font: FUENTE_TEXTO, size: TAMANO_CUERPO, bold: true, color: NEGRO }),
    new TextRun({ text: ' de esta organización, bajo la supervisión directa de:', font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO }),
  ]),

  // Caja del supervisor
  new Paragraph({
    indent: { left: 700, right: 400 },
    spacing: { before: 160, after: 260 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 18, color: AZUL, space: 8 },
      top: { style: BorderStyle.SINGLE, size: 4, color: AZUL, space: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: AZUL, space: 4 },
      right: { style: BorderStyle.SINGLE, size: 4, color: AZUL, space: 4 },
    },
    children: [
      new TextRun({ text: 'Gonzalo Gualdrón', font: FUENTE_TITULO, size: 24, bold: true, color: AZUL }),
      new TextRun({ text: '  -  Supervisor de práctica profesional', font: FUENTE_TEXTO, size: 22, color: NEGRO }),
    ],
  }),

  new Paragraph({
    spacing: { after: 300 },
    children: [
      new TextRun({ text: 'El periodo de la práctica comprende del ', font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO }),
      new TextRun({ text: '1 de septiembre al 8 de noviembre de 2026.', font: FUENTE_TEXTO, size: TAMANO_CUERPO, bold: true, color: NEGRO }),
    ],
  }),

  // ============================ SECCION 1 ============================
  tituloSeccion('1', 'Proyecto del estudiante'),
  new Paragraph({
    spacing: { after: 200, line: 300 },
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: 300, right: 300 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 6, color: AZUL, space: 8 },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: AZUL, space: 8 },
      left: { style: BorderStyle.SINGLE, size: 6, color: AZUL, space: 8 },
      right: { style: BorderStyle.SINGLE, size: 6, color: AZUL, space: 8 },
    },
    children: [
      new TextRun({
        text: 'Sistema de información basado en OCR para la gestión y procesamiento automatizado de hojas de vida en el área de Talento Humano de Distribuciones Rosimar S.A.S.',
        font: FUENTE_TITULO,
        size: 24,
        bold: true,
        italics: true,
        color: AZUL,
      }),
    ],
  }),
  parrafo([
    new TextRun({ text: 'Objetivo general: ', font: FUENTE_TEXTO, size: TAMANO_CUERPO, bold: true, color: NEGRO }),
    new TextRun({
      text: 'desarrollar un sistema de información basado en reconocimiento óptico de caracteres (OCR) para la gestión y procesamiento automatizado de las hojas de vida, con el fin de optimizar los tiempos de análisis, clasificación y selección de personal en el área de Talento Humano de la empresa.',
      font: FUENTE_TEXTO,
      size: TAMANO_CUERPO,
      color: NEGRO,
    }),
  ]),

  // ============================ SECCION 2 ============================
  tituloSeccion('2', 'Objetivos específicos'),
  ...[
    'Recomputar y diagnosticar los requerimientos funcionales y no funcionales del área de Talento Humano para la recepción, filtrado y almacenamiento de las hojas de vida en Distribuciones Rosimar S.A.S.',
    'Diseñar la arquitectura del sistema y la base de datos, definiendo los modelos de datos, la interfaz de usuario y la integración del motor de OCR para la extracción precisa de información clave (datos personales, formación y experiencia).',
    'Construir los módulos del sistema de información integrando las funcionalidades de carga masiva, procesamiento OCR, etiquetado dinámico y motor de búsqueda inteligente de candidatos.',
    'Validar y probar la plataforma mediante pruebas funcionales, de usabilidad y de precisión del OCR con hojas de vida reales del área de Talento Humano de la empresa.',
  ].map((texto, i) =>
    parrafo(
      [
        new TextRun({ text: `${i + 1}. `, font: FUENTE_TITULO, size: TAMANO_CUERPO, bold: true, color: AZUL }),
        new TextRun({ text: texto, font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO }),
      ],
      { indent: { left: 400 } }
    )
  ),

  // ============================ SECCION 3 ============================
  tituloSeccion('3', 'Cronograma propuesto (1 de septiembre al 8 de noviembre de 2026)'),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [filaCronograma(['Semana', 'Fecha', 'Actividad', 'Objetivo'], true), ...FILAS_CRONOGRAMA.map((f) => filaCronograma(f))],
  }),
  new Paragraph({
    spacing: { before: 120, after: 200 },
    children: [
      new TextRun({
        text: 'Total: 10 semanas, distribuidas en cuatro fases, una por cada objetivo del proyecto.',
        font: FUENTE_TEXTO,
        size: 20,
        italics: true,
        color: NEGRO,
      }),
    ],
  }),

  // ============================ SECCION 4 ============================
  tituloSeccion('4', 'Compromisos de la empresa'),
  ...[
    'Facilitar al estudiante el acceso a la información y a las hojas de vida reales del área de Talento Humano necesarias para el desarrollo y la validación del proyecto.',
    'Acompañar el proceso mediante asesorías periódicas del supervisor asignado y disposición del personal del área para las entrevistas de levantamiento de requerimientos.',
    'Garantizar la confidencialidad de los datos personales tratados, en concordancia con las normas de habeas data y las políticas internas de la organización.',
    'Validar los entregables y apoyar la ejecución de las pruebas funcionales, de usabilidad y de precisión del sistema.',
  ].map((texto) =>
    parrafo(
      [
        new TextRun({ text: '\u2022  ', font: FUENTE_TEXTO, size: 24, bold: true, color: AZUL }),
        new TextRun({ text: texto, font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO }),
      ],
      { indent: { left: 400 } }
    )
  ),

  parrafo([
    new TextRun({
      text: 'Sin otro particular, quedamos atentos a cualquier requerimiento adicional y agradecemos la confianza depositada en nuestra empresa para la formación de los futuros profesionales.',
      font: FUENTE_TEXTO,
      size: TAMANO_CUERPO,
      color: NEGRO,
    }),
  ]),

  // ============================ FIRMA ============================
  new Paragraph({ spacing: { before: 300, after: 160 }, children: [new TextRun({ text: 'Atentamente,', font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO })], alignment: AlignmentType.LEFT }),
  new Paragraph({ spacing: { after: 500 }, children: [new TextRun({ text: '', font: FUENTE_TEXTO, size: 20 })] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Gonzalo Gualdrón', font: FUENTE_TITULO, size: 26, bold: true, color: NEGRO })] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Supervisor de práctica profesional', font: FUENTE_TEXTO, size: 22, color: NEGRO })] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Distribuciones Rosimar S.A.S.', font: FUENTE_TEXTO, size: 22, color: NEGRO })] }),
  new Paragraph({ children: [new TextRun({ text: 'NIT. 901.167.955-4  ·  Barranquilla, Atlántico', font: FUENTE_TEXTO, size: 20, color: NEGRO })] }),
];

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FUENTE_TEXTO, size: TAMANO_CUERPO, color: NEGRO },
      },
      heading2: { run: { font: FUENTE_TITULO, color: AZUL } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 900, bottom: 900, left: 1000, right: 1000 },
        },
      },
      children,
    },
  ],
});

fs.mkdirSync(SALIDA, { recursive: true });
const ruta = path.join(SALIDA, 'carta-aval-practica.docx');
const bytes = await Packer.toBuffer(doc);
fs.writeFileSync(ruta, bytes);
console.log(`Carta generada: ${ruta} (${(bytes.length / 1024).toFixed(1)} KiB)`);