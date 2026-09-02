import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const doc = new jsPDF({ unit: 'mm', format: 'letter' });

const M = 22;
const W = 215.9 - M * 2;
const MAX_Y = 279.4 - 18;

let y = M;
let page = 1;

function cabezal() {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Anteproyecto de Trabajo de Grado - Sistema de Gestión de Talento Humano con OCR', W / 2 + M, 10, { align: 'center' });
  doc.setDrawColor(160);
  doc.setLineWidth(0.3);
  doc.line(M, 12.5, 215.9 - M, 12.5);
}

function pie() {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(String(page), 215.9 / 2, 279.4 - 8, { align: 'center' });
}

function checkPage() {
  if (y > MAX_Y) {
    pie();
    doc.addPage();
    page++;
    cabezal();
    y = M;
  }
}

function title(txt) {
  checkPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text(txt, M, y);
  const ty = y + 2.5;
  doc.setDrawColor(40);
  doc.setLineWidth(0.6);
  doc.line(M, ty, W + M, ty);
  y += 8;
}

function subtitle(txt) {
  checkPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(30);
  doc.text(txt, M, y);
  y += 6.5;
}

function para(txt, opts = {}) {
  checkPage();
  const size = opts.size || 10.5;
  const leading = opts.leading || 5.2;
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(opts.color || 30);
  const lines = doc.splitTextToSize(txt, W);
  for (const line of lines) {
    checkPage();
    doc.text(line, M, y);
    y += leading;
  }
  y += opts.after != null ? opts.after : 2;
}

function bullet(txt) {
  checkPage();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(30);
  const lines = doc.splitTextToSize(txt, W - 6);
  doc.text('\u2022', M, y);
  for (const line of lines) {
    checkPage();
    doc.text(line, M + 4, y);
    y += 5.2;
  }
  y += 1.5;
}

function blank(n = 3) {
  y += n * 5;
}

// ================= PORTADA =================
doc.setFont('helvetica', 'bold');
doc.setFontSize(16);
doc.setTextColor(25);
doc.text('ANTEPROYECTO DE TRABAJO DE GRADO', W / 2 + M, 42, { align: 'center' });

doc.setFontSize(13.5);
doc.text('Sistema de Gestión de Talento Humano y', W / 2 + M, 56, { align: 'center' });
doc.text('Análisis de Hojas de Vida con Reconocimiento', W / 2 + M, 62, { align: 'center' });
doc.text('Óptico de Caracteres (OCR) en el Navegador', W / 2 + M, 68, { align: 'center' });

doc.setDrawColor(140);
doc.setLineWidth(0.8);
doc.line(M + 40, 74, 215.9 - M - 40, 74);

doc.setFont('helvetica', 'normal');
doc.setFontSize(11);
doc.setTextColor(55);
y = 90;
para('Modalidad: Desarrollo de software y sistema de información', { size: 11, after: 1 });
para('Área del conocimiento: Ingeniería de software / Ciencia de datos aplicada', { size: 11, after: 1 });
para('Estudio de caso: Rosimar S.A.S.', { size: 11, after: 1 });
para('Modalidad de grado: Anteproyecto', { size: 11 });

blank(2);
y += 14;
doc.setFont('helvetica', 'bold');
doc.setFontSize(11);
doc.setTextColor(25);
doc.text('Aceptación director de la tesis:', M, y);
y += 6;
doc.text('NOMBRE: ______________________________________________', M, y);
y += 4;
doc.text('FIRMA: _______________________________________________', M, y);
y += 8;
blank();
blank();

// ================= 1. GENERALIDADES =================
title('1. GENERALIDADES DEL PROYECTO');

subtitle('1.1 Título');
para('Sistema de Gestión de Talento Humano y Análisis de Hojas de Vida con Reconocimiento Óptico de Caracteres (OCR) 100% en el navegador, aplicado al proceso de selección y contratación de Rosimar S.A.S.', { bold: true });

subtitle('1.2 Planteamiento del problema');
para('Rosimar S.A.S. recibe a diario decenas de hojas de vida en formatos heterogéneos: PDF escaneado, imágenes fotografiadas con el teléfono, y documentos de Word. El proceso de reclutamiento se apoya casi por completo en la lectura manual de cada documento: un reclutador debe abrir cada hoja de vida, leer el texto, identificar los datos del candidato (nombre, documento, teléfono, correo, cargo deseado y experiencia) y luego transcribirlos a una base de datos para poder filtrarlos y compararlos. Esta tarea es lenta, propensa a errores humanos de captura y hace que la información no esté disponible en tiempo real durante la entrevista inicial.');
blank(1);
para('El problema se agrava porque las hojas de vida no siguen un formato estandarizado: cada aspirante organiza la información de manera distinta, la calidad de los escaneos y fotografías varía, y con frecuencia hay texto en varias columnas que dificulta la lectura automática. Además, el proceso de contratación posterior sobre el candidato seleccionado (estado del contrato, fechas, datos del empleador y del trabajador) también se gestiona de forma manual o semimanual.');
blank(1);
para('De esta forma, la organización no dispone de una herramienta económica que concentre la lectura, la estructuración y la explotación de la información contenida en las hojas de vida, ni de una que acompañe el flujo completo desde el candidato hasta el empleado contratado.');

subtitle('1.3 Justificación');
para('¿Por qué se desarrolla este proyecto? Porque la gestión manual de hojas de vida consume tiempo valioso del equipo de talento humano, introduce errores de digitación y retrasa la toma de decisiones sobre una vacante. Una herramienta que automatiza la lectura de los documentos y estructura la información permite al reclutador dedicarse a lo que aporta valor real: evaluar candidatos y tomar decisiones, no transcribir datos.');
blank(1);
para('¿Qué soluciona? Soluciona la captura desordenada de la información de los aspirantes y la falta de integración entre la lectura del documento y la gestión posterior del empleado. Al extraer automáticamente los datos estructurados de cada hoja de vida y vincularlos con el proceso de contratación, se elimina la doble digitación y se garantiza que la información esté disponible, ordenada y siempre editable.');
blank(1);
para('¿Cuál es el aporte? El aporte principal es un sistema de costo cero en infraestructura que ejecuta el reconocimiento óptico de caracteres dentro del navegador del usuario, sin enviar documentos sensibles (datos personales de los candidatos) a servidores externos. Esto, además de reducir costos, protege la confidencialidad de la información y cumple con los principios de minimización de datos. El proyecto aporta además una metodología reproducible para segmentar documentos con columnas y extraer campos etiquetados, que puede aplicarse a otros tipos de documento en la organización.');

subtitle('1.4 Objetivos');

doc.setFont('helvetica', 'bold');
doc.setFontSize(11);
doc.setTextColor(30);
doc.text('Objetivo general', M, y);
y += 6;
para('Desarrollar un sistema web progresivo (PWA) de gestión de talento humano que permita analizar hojas de vida mediante reconocimiento óptico de caracteres ejecutado 100% en el navegador, extraer los datos estructurados de cada candidato y administrar el flujo de selección y contratación, aplicado al proceso de Rosimar S.A.S.', { after: 3 });

doc.setFont('helvetica', 'bold');
doc.setFontSize(11);
doc.setTextColor(30);
doc.text('Objetivos específicos', M, y);
y += 6;
bullet('Diseñar una arquitectura de lectura de documentos que reconstruya el orden de lectura (renglones y columnas) a partir de las palabras detectadas por OCR en formatos PDF, imagen y Word.');
bullet('Implementar un proceso de segmentación por secciones y un extractor por campo (nombre, documento, teléfono, correo, cargo, salario, experiencia) que opere sobre la estructura del documento.');
bullet('Construir el módulo de gestión de talento humano que administre el estado de los candidatos (aspirante, entrevista, seleccionado, contratado) y el ciclo de vida del empleado, respetando las reglas de negocio de la organización.');
bullet('Diseñar e implementar el almacenamiento local con soporte offline (IndexedDB) y la persistencia en un backend gratuito de bajo costo (Supabase) con seguridad a nivel de fila (RLS).');
bullet('Evaluar la precisión del lector sobre un banco de hojas de vida escaneadas, medir su correlación con la confianza reportada por el motor y validar la usabilidad del sistema en el caso de estudio.');

subtitle('1.5 Alcance y acotaciones');
para('El sistema se aplica inicialmente al proceso de selección de personal de Rosimar S.A.S. Se limita al análisis de documentos en español (español e inglés para el motor OCR), a los formatos PDF, imágenes JPEG/PNG y Word. La extracción se orienta a los campos estándar de una hoja de vida: información personal, información de contacto, formación académica, experiencia laboral y habilidades.');
blank(1);
para('Quedan fuera del alcance: la redacción automática de hojas de vida, la verificación automática de antecedentes, la integración con bolsas de trabajo externas y el despliegue en infraestructura de pago. La ejecución del OCR se realiza en la CPU del dispositivo del usuario; no se usan servicios de pago por documento.');

// ================= 2. MARCO =================
title('2. MARCO TEÓRICO Y ESTADO DEL ARTE');

subtitle('2.1 Marco teórico');
para('Reconocimiento Óptico de Caracteres (OCR). Es el proceso que convierte imágenes de texto impreso o manuscrito en texto codificado. Se compone típicamente de etapas de preprocesamiento (reescalado, binarización, corrección de inclinación), detección de regiones de texto, segmentación en palabras y clasificación de caracteres. En este proyecto se utiliza el motor Tesseract.js, una compilación a WebAssembly del motor Tesseract, lo que permite ejecutar el reconocimiento sin enviar el documento a un servidor.', { after: 4 });
para('Análisis de layout y orden de lectura. Un documento puede tener texto en varias columnas (encabezados, tablas, listas). Para extraer datos de forma fiable es necesario reconstruir el orden lógico de lectura, agrupar las palabras en renglones y detectar la estructura de columnas, en lugar de procesar el texto plano secuencialmente. Este orden reconstruido se comparte entre los distintos formatos de origen (PDF, imagen, Word).', { after: 4 });
para('Coordenadas y geometría de página. El motor OCR entrega, junto con cada palabra, sus coordenadas en la página. Este dato geométrico permite alineaciones verticales, detección de pares etiqueta-valor en tablas de dos columnas y la asociación de un campo con su valor aunque el texto esté partido en varios renglones.', { after: 4 });
para('Aplicación web progresiva (PWA) y almacenamiento offline. Una PWA funciona sin conexión, se instala en el dispositivo y sincroniza los cambios cuando hay red. El almacenamiento local en IndexedDB permite trabajar sin conexión y acumular una cola de sincronización, mientras que un backend gratuito provee persistencia compartida entre usuarios.', { after: 4 });
para('Seguridad a nivel de fila (RLS). Mecanismo de la base de datos que restringe el acceso a los registros según el rol y el contexto del usuario autenticado. En un sistema que maneja datos personales de candidatos y empleados, es imprescindible que cada rol solo pueda leer y modificar la información para la que está autorizado.');

subtitle('2.2 Estado del arte');
para('En el ámbito internacional existen soluciones comerciales de análisis de hojas de vida (software de reclutamiento y sistemas de seguimiento de candidatos) que extraen datos de los documentos mediante servicios de procesamiento en la nube. Estas herramientas suelen tener costo por documento y envían la información a servidores externos, lo que plantea consideraciones de costo y de privacidad para las organizaciones.', { after: 4 });
para('En el ámbito regional y nacional, la mayoría de las pequeñas y medianas empresas colombianas gestionan las hojas de vida de forma manual con planillas de cálculo o sistemas genéricos de gestión documental que no ofrecen extracción automática de datos ni una ruta integrada hacia el proceso de contratación. La literatura y los casos de aplicación coinciden en señalar que la adopción de herramientas de automatización en talento humano se ve limitada por el costo de la infraestructura y por la necesidad de proteger los datos personales.', { after: 4 });
para('Frente a este panorama, la propuesta se distinguen por ejecutar todo el cómputo del OCR en el navegador del usuario (costo de infraestructura cercano a cero y documentos que nunca salen del dispositivo), por reconstruir el orden de lectura para manejar documentos con columnas, y por integrar el análisis del documento con la gestión de candidatos y empleados bajo reglas de negocio definidas.');

// ================= 3. METODOLOGIA =================
title('3. METODOLOGÍA Y CRONOGRAMA');

subtitle('3.1 Metodología');
para('El proyecto se desarrolla con un enfoque de desarrollo iterativo e incremental, con fases que van de la fundamentación al desarrollo y a la validación:', { after: 2 });
bullet('Fase 1. Diseño de la arquitectura del lector, definición del modelo de datos y de las reglas de negocio.');
bullet('Fase 2. Implementación del pipeline de lectura: extracción, layout (renglones y columnas), segmentación por secciones y extractores por campo.');
bullet('Fase 3. Implementación de los módulos de gestión de candidatos, empleados, contratos y alertas.');
bullet('Fase 4. Persistencia local con soporte offline y sincronización con el backend.');
bullet('Fase 5. Pruebas con un banco de hojas de vida escaneadas, medición de precisión y ajustes.');
bullet('Fase 6. Validación final, documentación y entrega.');

// ================= 4. RESULTADOS =================
title('4. RESULTADOS / PRODUCTOS ESPERADOS Y BENEFICIARIOS');

subtitle('4.1 Resultados y productos esperados');
bullet('Un sistema web progresivo (PWA) funcional que lee hojas de vida en PDF, imagen y Word, extrae los campos del candidato y muestra un formulario editable antes de guardar.');
bullet('Un banco de pruebas con hojas de vida escaneadas y un conjunto de métricas de precisión del lector por campo.');
bullet('El módulo de gestión de talento humano que administra el estado del candidato y el ciclo de vida del empleado, con sus reglas de negocio y alertas.');
bullet('El módulo de reportes y gráficos estadísticos del proceso de selección, y la exportación de listados a Excel y a PDF.');
bullet('La documentación técnica del sistema (arquitectura, modelo de datos, sistema de diseño) y la guía de despliegue en infraestructura gratuita.');

subtitle('4.2 Potenciales beneficiarios');
para('El beneficiario directo es el área de talento humano de Rosimar S.A.S., que reduce el tiempo de captura de hojas de vida, disminuye los errores de digitación y concentra la información del candidato y del empleado en un solo lugar. Como beneficiarios indirectos se encuentran los aspirantes, que ven un proceso de selección más ágil, y la compañía en general, al contar con información confiable y disponible para la toma de decisiones.');

// ================= 5. REFERENCIAS =================
title('5. REFERENCIAS BIBLIOGRÁFICAS');
para('Relacione aquí únicamente las referencias citadas en el texto; utilice las normas ICONTEC para la relación y cita de las referencias.', { color: 100 });
blank(1);
para('Referencias sugeridas para iniciar la revisión bibliográfica (a completar y formatear según normas ICONTEC):', { size: 10 });
blank(1);
bullet('Smith, R. (2007). An Overview of the Tesseract OCR Engine. Proceedings of the International Conference on Document Analysis and Recognition (ICDAR).');
bullet('Tesseract.js Project. Documentación oficial del motor OCR en WebAssembly. Disponible en https://tesseract.projectnaptha.com');
bullet('MDN Web Docs. IndexedDB API y aplicaciones web progresivas (PWA). Disponible en https://developer.mozilla.org');
bullet('Supabase Documentation. Base de datos PostgreSQL, Autenticación y Políticas de Seguridad a Nivel de Fila (RLS). Disponible en https://supabase.com/docs');
bullet('Oriol, N. (2021). Gestión del talento humano en las PYMES: retos y oportunidades. (Referencia de contexto empresarial, a verificar y completar).');

// numero de pagina de portada
pie();

doc.save('Anteproyecto_Sistema_Gestion_Talento_Humano_OCR.pdf');
console.log('PDF generado: Anteproyecto_Sistema_Gestion_Talento_Humano_OCR.pdf');
