import { jsPDF } from 'jspdf';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.join(process.cwd(), 'test-pdfs');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. PDF 1: Doble Columna (Ingeniero)
function createPdf1() {
  const doc = new jsPDF();
  doc.setFillColor(241, 245, 249);
  doc.rect(10, 10, 60, 277, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CONTACTO', 14, 20);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('CC: 1098765432', 14, 28);
  doc.text('Celular: +57 318 456 7890', 14, 34);
  doc.text('camilo.vega@ingenieria.com', 14, 40);
  doc.text('Bucaramanga, Santander', 14, 46);
  doc.text('Carrera 27 # 45-12', 14, 52);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('HABILIDADES', 14, 65);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('• Python & C++', 14, 73);
  doc.text('• ROS & PLC Siemens', 14, 79);
  doc.text('• Docker & Linux', 14, 85);
  doc.text('• Trabajo en Equipo', 14, 91);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('IDIOMAS', 14, 105);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('• Español: Nativo', 14, 113);
  doc.text('• Inglés: C1 Avanzado', 14, 119);
  doc.text('• Francés: B1 Intermedio', 14, 125);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICACIONES', 14, 140);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Scrum Master (Scrum Alliance, 2023)', 14, 148);
  doc.text('• Automatización (Siemens, 2022)', 14, 156);

  // Columna Derecha (Contenido Principal)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('CAMILO ANDRÉS VEGA ORTIZ', 76, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Ingeniero de Automatización y Sistemas Embebidos', 76, 28);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PERFIL PROFESIONAL', 76, 42);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const summary = 'Ingeniero electrónico y de sistemas con más de 6 años de experiencia en desarrollo de firmware, automatización de líneas de producción industrial y diseño de controladores para maquinaria.';
  doc.text(doc.splitTextToSize(summary, 120), 76, 48);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EXPERIENCIA LABORAL', 76, 70);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Soluciones Mecatrónicas de Colombia SAS', 76, 78);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Líder Técnico de Automatización | Marzo 2021 a Diciembre 2023', 76, 83);
  doc.setFont('helvetica', 'normal');
  doc.text('• Diseño e integración de tableros de control y sistemas SCADA.', 76, 89);
  doc.text('• Reducción de tiempos muertos en planta en un 18%.', 76, 94);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Robótica Andina Ltda.', 76, 105);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Desarrollador de Firmware | Enero 2018 a Febrero 2021', 76, 110);
  doc.setFont('helvetica', 'normal');
  doc.text('• Programación de microcontroladores ARM y protocolos CAN bus.', 76, 116);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EDUCACIÓN', 76, 132);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Universidad Industrial de Santander', 76, 140);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Posgrado: Maestría en Ingeniería Electrónica (2020)', 76, 145);
  doc.text('Universitario: Ingeniería Electrónica (2017)', 76, 151);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('REFERENCIAS', 76, 168);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Ing. Rodrigo Pérez (Laboral) - Tel: 310 987 6543', 76, 176);
  doc.text('• Dra. Carmen Vega (Familiar) - Tel: 315 123 4567', 76, 182);

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, 'CV_01_DobleColumna_Ingeniero.pdf'), Buffer.from(pdfData));
}

// 2. PDF 2: Formato Ejecutivo Lineal
function createPdf2() {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('VALERIA SOFÍA RESTREPO HENAO', 105, 20, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('Directora Administrativa y Financiera', 105, 27, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Cédula: 1020304050 | Celular: +57 301 234 5678 | valeria.restrepo@financiera.com', 105, 34, { align: 'center' });
  doc.text('Medellín, Antioquia | Estado Civil: Casada | Fecha de Nacimiento: 14 de Mayo de 1988', 105, 40, { align: 'center' });
  doc.text('Expectativa Salarial: $ 5.800.000 COP | Disponibilidad: Inmediata', 105, 46, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.line(14, 50, 196, 50);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RESUMEN EJECUTIVO', 14, 58);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const profile = 'Administradora de Empresas y Especialista en Finanzas con más de 10 años de liderazgo corporativo en optimización de costos, estructuración presupuestal, auditoría interna y negociación bancaria.';
  doc.text(doc.splitTextToSize(profile, 180), 14, 64);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EXPERIENCIA LABORAL', 14, 82);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Grupo Empresarial del Café SAS', 14, 90);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Directora Administrativa y Financiera | Febrero 2020 a Presente', 14, 95);
  doc.setFont('helvetica', 'normal');
  doc.text('• Liderazgo del departamento financiero y gestión de un presupuesto anual de $ 12.000 millones COP.', 14, 101);
  doc.text('• Implementación del nuevo ERP institucional reduciendo el ciclo de facturación en 25%.', 14, 106);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Logística y Distribución Nacional SA', 14, 118);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Coordinadora de Presupuestos | Enero 2015 a Enero 2020', 14, 123);
  doc.setFont('helvetica', 'normal');
  doc.text('• Control de costos de distribución y análisis de márgenes de rentabilidad por producto.', 14, 129);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('FORMACIÓN ACADÉMICA', 14, 145);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Posgrado: Especialización en Finanzas Corporativas - Universidad EAFIT (2016)', 14, 153);
  doc.text('• Universitario: Administración de Empresas - Universidad de Antioquia (2012)', 14, 159);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('IDIOMAS Y CERTIFICACIONES', 14, 173);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Idiomas: Español (Nativo), Inglés (Avanzado B2)', 14, 181);
  doc.text('• Diplomado en Normas Internacionales NIIF - Cámara de Comercio de Medellín (2021)', 14, 187);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('REFERENCIAS', 14, 201);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Dr. Juan Camilo Londoño (Laboral) - Celular: 312 876 5432', 14, 209);
  doc.text('• Abg. María Paula Restrepo (Familiar) - Celular: 310 456 7890', 14, 215);

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, 'CV_02_Ejecutivo_Administrativo.pdf'), Buffer.from(pdfData));
}

// 3. PDF 3: Formato Técnico Industrial SENA
function createPdf3() {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('JORGE ELIÉCER MORALES CASTRO', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Técnico en Mantenimiento Electromecánico Industrial', 14, 26);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('CC: 1094876123 | Celular: 314 567 8901 | Teléfono Fijo: 607 568 1234', 14, 33);
  doc.text('Email: jorge.morales@tecnicos.co | Ciudad: Pamplona, Norte de Santander | Estado Civil: Soltero', 14, 39);

  doc.line(14, 43, 196, 43);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PERFIL LABORAL', 14, 52);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const prof = 'Técnico graduado del SENA con 5 años de experiencia en mantenimiento electromecánico industrial, sistemas hidráulicos, neumáticos, motores trifásicos y soldadura SMAW.';
  doc.text(doc.splitTextToSize(prof, 180), 14, 58);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EXPERIENCIA LABORAL', 14, 75);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Industrias Metalmecánicas del Oriente SAS', 14, 83);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Operario Técnico de Mantenimiento | Enero 2020 a Noviembre 2023', 14, 88);
  doc.setFont('helvetica', 'normal');
  doc.text('• Mantenimiento correctivo y preventivo de tornos, fresadoras y líneas de inyección.', 14, 94);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Agroindustrias del Norte', 14, 106);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Auxiliar Electromecánico | Enero 2018 a Diciembre 2019', 14, 111);
  doc.setFont('helvetica', 'normal');
  doc.text('• Inspección y alineación de bandas transportadoras y motores eléctricos.', 14, 117);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EDUCACIÓN', 14, 133);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Técnico: Mantenimiento Electromecánico Industrial - SENA Regional Santander (2017)', 14, 141);
  doc.text('• Bachiller: Técnico Industrial - Colegio Técnico Provincial Pamplona (2015)', 14, 147);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CERTIFICACIONES Y CURSOS', 14, 161);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Trabajo Seguro en Alturas Nivel Avanzado - SENA (2023)', 14, 169);
  doc.text('• Soldadura de Estructuras 3G - SENA (2022)', 14, 175);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('REFERENCIAS', 14, 189);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Mario Morales (Familiar) - Tel: 316 789 0123', 14, 197);
  doc.text('• Ing. Daniel Osorio (Laboral) - Tel: 317 456 7890', 14, 203);

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, 'CV_03_Tecnico_Industrial_SENA.pdf'), Buffer.from(pdfData));
}

// 4. PDF 4: Coordinadora Talento Humano
function createPdf4() {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DIANA MARCELA GUERRERO PARRA', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('Coordinadora de Talento Humano y Selección', 14, 26);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Cédula: 1092789456 | Celular: +57 320 987 6543 | diana.guerrero@recursoshumanos.com', 14, 33);
  doc.text('Bogotá, Cundinamarca | Aspiración Salarial: $ 4.200.000 COP | Disponibilidad: 15 días', 14, 39);

  doc.line(14, 43, 196, 43);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PERFIL PROFESIONAL', 14, 52);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const prof = 'Psicóloga con Especialización en Gerencia de Recursos Humanos y 7 años de trayectoria liderando procesos de atracción de talento, bienestar laboral, clima organizacional y nómina en empresas de servicios.';
  doc.text(doc.splitTextToSize(prof, 180), 14, 58);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EXPERIENCIA PROFESIONAL', 14, 75);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Consultores de Talento Humano SAS', 14, 83);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Coordinadora de Selección | Abril 2019 a Actualidad', 14, 88);
  doc.setFont('helvetica', 'normal');
  doc.text('• Coordinación del equipo de reclutamiento para más de 80 vacantes mensuales.', 14, 94);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Alimentos del Campo SA', 14, 106);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Analista de Gestión Humana | Junio 2016 a Marzo 2019', 14, 111);
  doc.setFont('helvetica', 'normal');
  doc.text('• Manejo de afiliaciones a seguridad social, contratos laborales y bienestar.', 14, 117);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EDUCACIÓN SUPERIOR', 14, 133);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Posgrado: Especialización en Gerencia de Talento Humano - Universidad del Rosario (2018)', 14, 141);
  doc.text('• Universitario: Psicología - Universidad Nacional de Colombia (2015)', 14, 147);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('IDIOMAS Y CURSOS', 14, 161);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Idiomas: Español (Nativo), Inglés (C1 Avanzado), Portugués (B1 Intermedio)', 14, 169);
  doc.text('• Diplomado en Legislación Laboral y Seguridad Social - Universidad Javeriana (2022)', 14, 175);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('REFERENCIAS', 14, 189);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Dra. Patricia Gómez (Laboral) - Celular: 311 234 5678', 14, 197);
  doc.text('• Carlos Guerrero (Familiar) - Celular: 312 345 6789', 14, 203);

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, 'CV_04_Coordinadora_TalentoHumano.pdf'), Buffer.from(pdfData));
}

// 5. PDF 5: Compacto Multicursos
function createPdf5() {
  const doc = new jsPDF();

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('SEBASTIÁN QUINTERO ARDILA', 14, 18);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Desarrollador Full Stack y Administrador de Bases de Datos', 14, 24);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('CC: 1088765432 | Cel: +57 300 123 9876 | sebastian.quintero@devstack.org | Pereira, Risaralda | Calle 19 # 12-40', 14, 30);

  doc.line(14, 34, 196, 34);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RESUMEN PROFESIONAL', 14, 41);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const prof = 'Ingeniero de sistemas con 6 años de experiencia en desarrollo web backend y frontend, microservicios, bases de datos PostgreSQL, React y contenedores Docker.';
  doc.text(doc.splitTextToSize(prof, 180), 14, 46);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPERIENCIA LABORAL', 14, 60);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CloudTech Solutions SAS - Desarrollador Senior Full Stack', 14, 67);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Enero 2022 a Presente', 14, 71);
  doc.setFont('helvetica', 'normal');
  doc.text('• Arquitectura de microservicios con Node.js, React y bases de datos relacionales.', 14, 76);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Digital Factory Latam - Desarrollador Frontend', 14, 85);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Febrero 2019 a Diciembre 2021', 14, 89);
  doc.setFont('helvetica', 'normal');
  doc.text('• Construcción de portales web interactivos y optimización de rendimiento.', 14, 94);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FORMACIÓN ACADÉMICA', 14, 107);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('• Universitario: Ingeniería de Sistemas y Computación - Universidad Tecnológica de Pereira (2017)', 14, 114);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('IDIOMAS', 14, 126);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('• Español: Nativo | Inglés: B2 Avanzado | Alemán: A2 Básico', 14, 133);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICACIONES', 14, 145);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('• AWS Certified Solutions Architect - Amazon Web Services (2023)', 14, 152);
  doc.text('• Certificación Profesional en PostgreSQL - Linux Foundation (2022)', 14, 158);
  doc.text('• Diplomado en Desarrollo Seguro de Software - MinTIC (2021)', 14, 164);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('REFERENCIAS', 14, 177);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('• Ing. Felipe Cardona (Laboral) - Celular: 318 654 3210', 14, 184);
  doc.text('• Sofía Ardila (Familiar) - Celular: 313 789 4561', 14, 190);

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, 'CV_05_Diseno_Compacto_Multicursos.pdf'), Buffer.from(pdfData));
}

// 6. PDF 6: Sin Titulos de Seccion (Parrafo Directo)
function createPdf6() {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('MARÍA ALEJANDRA OSORIO GÓMEZ', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('Contadora Pública y Auditora Tributaria', 14, 26);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('CC 1095678123 | Tel: 315 890 1234 | maria.osorio@contabilidad.co | Bucaramanga, Santander', 14, 33);

  // Parrafo Directo de Resumen (SIN TITULO 'RESUMEN' O 'PERFIL')
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const directSummary = 'Contadora pública con 8 años de trayectoria liderando auditorías tributarias, planeación fiscal, estados financieros bajo NIIF y conciliaciones bancarias para empresas del sector comercial.';
  doc.text(doc.splitTextToSize(directSummary, 180), 14, 44);

  // Experiencia (SIN TITULO 'EXPERIENCIA')
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Auditoría Contable del Oriente SAS', 14, 65);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Contadora Senior | Enero 2020 a Presente', 14, 70);
  doc.setFont('helvetica', 'normal');
  doc.text('• Elaboración de declaraciones de renta, IVA y retención en la fuente.', 14, 76);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Distribuidora Mayorista SA', 14, 88);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Auxiliar Contable | Marzo 2016 a Diciembre 2019', 14, 93);
  doc.setFont('helvetica', 'normal');
  doc.text('• Registro de comprobantes contables y facturación electrónica.', 14, 99);

  // Educacion (SIN TITULO 'EDUCACION')
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('• Posgrado: Especialización en Gestión Tributaria - Universidad Autónoma de Bucaramanga (2019)', 14, 115);
  doc.text('• Universitario: Contaduría Pública - Universidad Autónoma de Bucaramanga (2015)', 14, 121);

  // Idiomas y Certificaciones (SIN TITULO)
  doc.text('• Inglés: B2 Intermedio', 14, 133);
  doc.text('• Diplomado en Facturación Electrónica y NIIF - DIAN (2022)', 14, 139);

  // Referencia
  doc.text('• Referencia: Dr. Roberto Gómez - Celular: 310 987 6543', 14, 151);

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, 'CV_06_SinTitulos_ParrafoDirecto.pdf'), Buffer.from(pdfData));
}

// 7. PDF 7: Estilo Minimalista (Sin Encabezados de Seccion)
function createPdf7() {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('ANDRÉS FELIPE CARMONA BEDOYA', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Diseñador Gráfico & Productor Audiovisual', 14, 26);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('andres.carmona@creativo.com | Celular: 300 456 7890 | Medellín, Antioquia', 14, 33);

  // Parrafo directo
  const directSummary = 'Diseñador visual y productor multimedia especializado en creación de identidad de marca, animación 2D y postproducción de video para agencias de publicidad digital.';
  doc.text(doc.splitTextToSize(directSummary, 180), 14, 43);

  // Experiencia sin titulos
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Agencia Creativa Nova SAS', 14, 62);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Diseñador Lead | Enero 2021 a Presente', 14, 67);
  doc.setFont('helvetica', 'normal');
  doc.text('• Dirección de arte para campañas digitales multicanal.', 14, 73);

  // Educacion sin titulos
  doc.text('• Universitario: Diseñador Gráfico - Universidad de Medellín (2018)', 14, 88);

  // Idiomas y Certificaciones
  doc.text('• Idiomas: Español (Nativo), Inglés (C1 Avanzado)', 14, 100);
  doc.text('• Certificado en Animación 3D - Adobe (2021)', 14, 106);

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, 'CV_07_SinTitulos_EstiloMinimalista.pdf'), Buffer.from(pdfData));
}

// 8. PDF 8: Técnico Operativo sin encabezados
function createPdf8() {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('GUSTAVO ADOLFO SILVA PEÑA', 14, 20);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('CC 1098456123 | Pamplona, Norte de Santander | Celular: 318 765 4321 | gustavo.silva@industrias.com', 14, 27);

  // Parrafo de resumen sin encabezado
  const directSummary = 'Técnico electromecánico con 6 años de experiencia en mantenimiento de plantas de procesamiento, calderas, sistemas de refrigeración industrial y soldadura eléctrica.';
  doc.text(doc.splitTextToSize(directSummary, 180), 14, 38);

  // Trayectoria sin encabezado
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Frigoríficos del Norte SAS', 14, 56);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Técnico de Refrigeración | Enero 2019 a Noviembre 2023', 14, 61);
  doc.setFont('helvetica', 'normal');
  doc.text('• Mantenimiento predictivo de compresores y cuartos fríos.', 14, 67);

  // Educacion sin encabezado
  doc.text('• Técnico: Refrigeración y Climatización - SENA Regional Santander (2017)', 14, 82);

  // Certificados sin encabezado
  doc.text('• Curso de Mantenimiento de Calderas - SENA (2022)', 14, 94);
  doc.text('• Certificado de Trabajo Seguro en Alturas - SENA (2023)', 14, 100);

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, 'CV_08_SinTitulos_TecnicoOperativo.pdf'), Buffer.from(pdfData));
}

// 9. PDF 9: Exportación Computrabajo (Junior sin experiencia)
function createPdf9() {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175); // Azul Computrabajo
  doc.text('JUAN DAVID HERRERA RAMÍREZ', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('Técnico en Logística y Transporte', 14, 28);
  doc.text('CC: 1001234567 | Edad: 20 años', 14, 34);
  doc.text('Celular: 312 987 6543 | juan.herrera@correo.com', 14, 40);
  doc.text('Cartagena, Bolívar', 14, 46);

  doc.setFont('helvetica', 'bold');
  doc.text('Documentos Adicionales:', 14, 56);
  doc.setFont('helvetica', 'normal');
  doc.text('- Licencia de conducción: C1', 14, 62);
  doc.text('- Libreta militar: Segunda clase', 14, 68);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFIL LABORAL', 14, 80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Joven proactivo, recién egresado del SENA con interés en aprender y aportar en el área de bodega, inventarios y despacho. Sin experiencia laboral formal, pero con muchas ganas de trabajar en mi primera oportunidad laboral. Responsable y puntual.', 14, 88, { maxWidth: 180 });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPERIENCIA', 14, 110);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('Sin experiencia laboral previa.', 14, 118);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTUDIOS', 14, 130);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('• Técnico en Gestión Logística - SENA Regional Bolívar (2023)', 14, 138);

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, 'CV_09_Computrabajo_Junior.pdf'), Buffer.from(pdfData));
}

// 10. PDF 10: Formato Único DAFP (Función Pública Colombia)
function createPdf10() {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('FORMATO ÚNICO DE HOJA DE VIDA', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Persona Natural - Función Pública', 105, 26, { align: 'center' });

  doc.rect(14, 32, 182, 6);
  doc.setFontSize(10);
  doc.text('1. DATOS PERSONALES', 16, 36.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('NOMBRES: ANA MARÍA', 16, 45);
  doc.text('APELLIDOS: PÉREZ LÓPEZ', 90, 45);
  
  doc.text('Cédula de ciudadanía No.: 45987123', 16, 52);
  doc.text('Sexo: Femenino', 90, 52);
  
  doc.text('Lugar de nacimiento: Bogotá D.C., Cundinamarca', 16, 59);
  doc.text('Nacionalidad: Colombiana', 105, 59);

  doc.text('Dirección de residencia: Calle 45 # 12-34', 16, 66);
  doc.text('Ciudad: Bogotá D.C.', 105, 66);
  
  doc.text('Teléfono: 300 123 4567', 16, 73);
  doc.text('E-mail: ana.perez@abogados.co', 70, 73);

  doc.text('Tarjeta Profesional No.: 123456-T', 16, 80);
  doc.text('LinkedIn: www.linkedin.com/in/anaperezlaw', 90, 80);

  doc.rect(14, 90, 182, 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. FORMACIÓN ACADÉMICA', 16, 94.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Nivel: Universitario', 16, 103);
  doc.text('Título: Abogada', 70, 103);
  doc.text('Institución: Universidad Externado de Colombia (2015)', 16, 109);

  doc.text('Nivel: Posgrado', 16, 116);
  doc.text('Título: Especialista en Derecho Administrativo', 70, 116);
  doc.text('Institución: Universidad Libre (2018)', 16, 122);

  doc.rect(14, 132, 182, 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('3. EXPERIENCIA LABORAL', 16, 136.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Empresa: Ministerio de Justicia y del Derecho', 16, 145);
  doc.text('Cargo: Asesora Jurídica', 120, 145);
  doc.text('Fecha: Enero 2019 a Actualidad', 16, 151);

  doc.text('Empresa: Contraloría General de la República', 16, 160);
  doc.text('Cargo: Auxiliar Jurídico', 120, 160);
  doc.text('Fecha: Marzo 2016 - Diciembre 2018', 16, 166);

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, 'CV_10_Formato_Publico_DAFP.pdf'), Buffer.from(pdfData));
}

createPdf1();
createPdf2();
createPdf3();
createPdf4();
createPdf5();
createPdf6();
createPdf7();
createPdf8();
createPdf9();
createPdf10();
console.log('10 PDFs digitales generados exitosamente en test-pdfs/');
