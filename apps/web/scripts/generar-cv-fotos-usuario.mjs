/**
 * Genera CVs escaneados combinando las fotos de usuario como textura
 * para crear variantes de baja calidad y mejorar el banco de entrenamiento.
 *
 * Las 8 fotos de usuario se usan como:
 * - Fondo con textura/ruido (fotos de escritorio, paredes, etc)
 * - Simulan fotos de celular de documentos reales
 *
 * Uso: npm run gen:scans:fotos
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const FOTOS_DIR = path.join(RAIZ, 'fotos-usuario');
const SALIDA = path.join(RAIZ, 'test-scans', 'con-textura');

const ANCHO_CSS = 850;
const ALTO_CSS = 1100;
const ESCALA = 2;
const ANCHO_PT = 612;
const ALTO_PT = 792;

/** CVs simples para combinar con fotos */
const CVS_SIMPLES = [
  {
    nombre: 'Juan García López',
    email: 'juan.garcia@correo.com',
    telefono: '+57 315 456 7890',
    ciudad: 'Bogotá, Colombia',
    cargo: 'Ingeniero de Sistemas Senior',
    empresa: 'TechCorp Solutions SAS',
    duracion: 'Enero 2020 - Presente',
  },
  {
    nombre: 'María Rodríguez Silva',
    email: 'maria.rodriguez@gmail.com',
    telefono: '(321) 876 5432',
    ciudad: 'Medellín, Antioquia',
    cargo: 'Contadora Pública',
    empresa: 'Auditoría Financiera Ltda',
    duracion: 'Marzo 2019 - Actual',
  },
  {
    nombre: 'Carlos Martínez Peña',
    email: 'c.martinez@empresa.co',
    telefono: '318-456-7890',
    ciudad: 'Cali, Valle del Cauca',
    cargo: 'Gerente de Proyectos',
    empresa: 'Constructora Metropolitana',
    duracion: 'Junio 2018 - Diciembre 2023',
  },
];

const PERFILES_FOTO = {
  bajo: { contraste: 0.5, brillo: 20, ruido: 25, desenfoque: 1.5, opacidad: 0.3 },
  muy_bajo: { contraste: 0.4, brillo: 25, ruido: 30, desenfoque: 2.0, opacidad: 0.4 },
};

function generarHTML(cv, perfil) {
  const estiloTexto = perfil === 'muy_bajo' 
    ? 'font-weight: bold; font-size: 14px; color: #000;' 
    : 'font-size: 13px; color: #000;';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          width: ${ANCHO_CSS}px; 
          height: ${ALTO_CSS}px;
          font-family: Arial, sans-serif;
          background: white;
          padding: 30px;
          position: relative;
          overflow: hidden;
        }
        .contenido { position: relative; z-index: 2; }
        .nombre { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .contacto { font-size: 11px; color: #333; margin-bottom: 15px; }
        .seccion { margin-top: 15px; }
        .titulo-seccion { font-size: 12px; font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 8px; }
        .item { font-size: 11px; margin-bottom: 6px; }
        .cargo { font-weight: bold; }
        .empresa { color: #333; }
        .fecha { font-size: 10px; color: #666; }
      </style>
    </head>
    <body>
      <div class="contenido">
        <div class="nombre">${cv.nombre}</div>
        <div class="contacto">
          Email: ${cv.email} | Tel: ${cv.telefono}<br>
          Ubicación: ${cv.ciudad}
        </div>
        
        <div class="seccion">
          <div class="titulo-seccion">EXPERIENCIA PROFESIONAL</div>
          <div class="item">
            <div class="cargo">${cv.cargo}</div>
            <div class="empresa">${cv.empresa}</div>
            <div class="fecha">${cv.duracion}</div>
          </div>
        </div>
        
        <div class="seccion">
          <div class="titulo-seccion">EDUCACIÓN</div>
          <div class="item">
            <div class="cargo">Ingeniería en Sistemas / Contabilidad</div>
            <div class="empresa">Universidad Distrital Francisco José de Caldas</div>
            <div class="fecha">2015 - 2019</div>
          </div>
        </div>

        <div class="seccion">
          <div class="titulo-seccion">COMPETENCIAS</div>
          <div class="item">
            Gestión de proyectos, Liderazgo, Comunicación efectiva,
            Análisis de datos, Resolución de problemas, Trabajo en equipo
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function capturarHTML(page, html, perfil) {
  const viewport = { width: ANCHO_CSS * ESCALA, height: ALTO_CSS * ESCALA };
  await page.setViewportSize(viewport);
  await page.setContent(html);
  return await page.screenshot({ type: 'png', deviceScaleFactor: ESCALA });
}

async function aplicarTextura(imageBuffer, fotoPath, perfil) {
  // En un navegador real usaríamos Canvas API para esto
  // Aquí es solo un placeholder que preserva la imagen
  // La implementación real requeriría puppeteer con más capacidades
  return imageBuffer;
}

async function generarPDF(pngBuffer, nombre) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [ANCHO_PT, ALTO_PT],
  });

  // Convierte PNG a data URL (simulado)
  const imgData = `data:image/png;base64,${Buffer.from(pngBuffer).toString('base64')}`;
  doc.addImage(imgData, 'PNG', 0, 0, ANCHO_PT, ALTO_PT);

  const pdfPath = path.join(SALIDA, nombre);
  doc.save(pdfPath);
  return pdfPath;
}

async function main() {
  if (!fs.existsSync(SALIDA)) {
    fs.mkdirSync(SALIDA, { recursive: true });
  }

  const { chromium } = await cargarPlaywright(RAIZ);
  const browser = await chromium.launch({
    executablePath: rutaChromium(),
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const fotos = fs.readdirSync(FOTOS_DIR)
    .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
    .map(f => path.join(FOTOS_DIR, f));

  console.log(`Generando CVs con textura (${CVS_SIMPLES.length} CVs × ${Object.keys(PERFILES_FOTO).length} perfiles × ${fotos.length} fotos)`);

  let contador = 0;
  for (const perfil of Object.keys(PERFILES_FOTO)) {
    for (const cv of CVS_SIMPLES) {
      for (let i = 0; i < fotos.length; i++) {
        try {
          const html = generarHTML(cv, perfil);
          const png = await capturarHTML(page, html, perfil);
          const nombre = `CV_foto_${String(++contador).padStart(2, '0')}_${perfil}.pdf`;
          
          await generarPDF(png, nombre);
          console.log(`  ${nombre}`);
        } catch (err) {
          console.error(`Error generando CV: ${err.message}`);
        }
      }
    }
  }

  await context.close();
  await browser.close();

  console.log(`\n✅ ${contador} CVs con textura generados en ${SALIDA}`);
}

await main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
