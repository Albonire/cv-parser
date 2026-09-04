/**
 * Genera la FICHA LABORAL consolidada de cada persona (una por carpeta/zip) a
 * partir de los textos OCR ya extraidos (JSON en cv-extraccion) y crea un PDF
 * por persona con el nombre exacto de la carpeta.
 *
 * La consolidacion corre en el navegador (reutiliza los parsers del lector con
 * su maquetacion) y devuelve un objeto ficha; el PDF se genera en Node con
 * jsPDF + jspdf-autotable, el mismo stack de los reportes del sistema.
 *
 * Salida: <CV_SALIDA_PDF>/{nombre carpeta}.pdf
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PUERTO = 5205;

const ENTRADA = process.env.CV_SALIDA || 'C:/Users/User/AppData/Local/Temp/opencode/cv-extraccion';
const SALIDA_PDF = process.env.CV_SALIDA_PDF || 'C:/Users/User/Documents/FICHAS LABORALES ROSIMAR';
const SOLO = process.argv.slice(2).find((a) => !a.startsWith('--'));

function esperar(ms) { return new Promise((res) => setTimeout(res, ms)); }

async function arrancarVite() {
  const proceso = spawn(
    process.execPath,
    [path.join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PUERTO), '--strictPort'],
    { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    try { const r = await fetch(`http://localhost:${PUERTO}/bench-ocr.html`); if (r.ok) return proceso; } catch {}
    await esperar(400);
  }
  proceso.kill('SIGTERM');
  throw new Error('Vite no respondio en 60 s.');
}

async function main() {
  fs.mkdirSync(SALIDA_PDF, { recursive: true });
  const archivos = fs.readdirSync(ENTRADA).filter((f) => f.endsWith('.json')).sort();
  const objetivo = SOLO ? archivos.filter((f) => f.toLowerCase().includes(SOLO.toLowerCase())) : archivos;
  console.log(`Fichas a generar: ${objetivo.length}`);

  // Correcciones opcionales: { "NOMBRE CARPETA": { trabajador:{...}, cargo:..., salud:{...}, ... } }
  const rutaCorrecciones = path.join(SALIDA_PDF, 'correcciones.json');
  let correcciones = {};
  if (fs.existsSync(rutaCorrecciones)) {
    try {
      correcciones = JSON.parse(fs.readFileSync(rutaCorrecciones, 'utf8'));
      console.log(`Correcciones cargadas para ${Object.keys(correcciones).length} personas.`);
    } catch (e) {
      console.warn('correcciones.json invalido, se ignora:', e.message);
    }
  }

  const vite = await arrancarVite();
  const { chromium } = await cargarPlaywright(RAIZ);
  const navegador = await chromium.launch({ executablePath: rutaChromium() });

  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await contexto.newPage();
    page.on('pageerror', (e) => console.error('  [pagina]', e.message));
    await page.goto(`http://localhost:${PUERTO}/bench-ocr.html`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-banco-listo="1"]', { timeout: 120_000 });

    for (const archivo of objetivo) {
      const ruta = path.join(ENTRADA, archivo);
      const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
      try {
        const ficha = await page.evaluate(consolidarFicha, j, { timeout: 90_000 });
        aplicarCorrecciones(ficha, correcciones[ficha.nombre]);
        const pdfBuffer = await generarPdf(ficha);
        const nombrePdf = `${ficha.nombre}.pdf`;
        fs.writeFileSync(path.join(SALIDA_PDF, nombrePdf), pdfBuffer);
        console.log(`[ok] ${j.nombre} -> ${nombrePdf} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
      } catch (e) {
        console.log(`[fail] ${j.nombre}: ${String(e.message || e).slice(0, 150)}`);
      }
    }
  } finally {
    await navegador.close();
    vite.kill('SIGTERM');
  }
  console.log('\nGeneracion de fichas finalizada.');
}

/** Aplica las correcciones manuales (si existen) sobre la ficha consolidada. */
function aplicarCorrecciones(ficha, corr) {
  if (!corr || typeof corr !== 'object') return;
  const t = ficha.trabajador;
  if (corr.trabajador && typeof corr.trabajador === 'object') {
    for (const k of ['nombres', 'apellidos', 'documento', 'nacimiento', 'direccion', 'ciudad', 'telefono', 'email', 'estadoCivil', 'profesion']) {
      if (corr.trabajador[k] !== undefined) t[k] = String(corr.trabajador[k]);
    }
  }
  if (corr.cargo !== undefined) ficha.cargo = { titulo: String(corr.cargo), funciones: ficha.cargo?.funciones || [] };
  if (corr.cargoFunciones !== undefined && Array.isArray(corr.cargoFunciones)) {
    ficha.cargo = { titulo: ficha.cargo?.titulo || '', funciones: corr.cargoFunciones };
  }
  if (corr.salud && typeof corr.salud === 'object') {
    for (const k of ['eps', 'regimen', 'arl', 'pension', 'caja']) {
      if (corr.salud[k] !== undefined) ficha.salud[k] = String(corr.salud[k]);
    }
  }
  if (corr.contratos !== undefined && Array.isArray(corr.contratos)) ficha.contratos = corr.contratos;
  if (corr.liquidaciones !== undefined && Array.isArray(corr.liquidaciones)) ficha.liquidaciones = corr.liquidaciones;
  if (corr.historial !== undefined && Array.isArray(corr.historial)) ficha.historial = corr.historial;
  if (corr.empresa !== undefined) ficha.empresaManual = String(corr.empresa);
}

// ---------- Consolidacion (corre en el navegador) ----------
// La funcion es auto-contenida (los auxiliares viven dentro) porque page.evaluate
// serializa solo la funcion, sin su closure.
const consolidarFicha = async (j) => {
  const idx = await import('/src/lib/ocr/index.ts');
  const cls = await import('/src/lib/ocr/document-classifier.ts');
  const limpio = await import('/src/lib/ocr/limpiar-texto.ts');

  const candidatoPuntajeCampos = (c) => {
    let p = 0;
    if (c.firstNames && c.lastNames) p += 5;
    if (c.documentNumber) p += 3;
    if (c.phone) p += 2;
    if (c.email) p += 2;
    if (c.birthDate) p += 1;
    if (c.experience?.length) p += 2;
    if (c.education?.length) p += 2;
    return p;
  };
  const fusionarLista = (a, b) => {
    const visto = new Set(a.map((x) => JSON.stringify(x)));
    for (const x of b) {
      const k = JSON.stringify(x);
      if (!visto.has(k)) { a.push(x); visto.add(k); }
    }
    return a;
  };
  const tipoDocumento = (texto, detectedType) => {
    const t = (texto || '').toLowerCase();
    if (/renuncia|retiro voluntario/.test(t)) return 'Renuncia / retiro';
    if (/hoja de vida|curriculum|perfil profesional/.test(t)) return 'Hoja de vida';
    if (/memorando/.test(t)) return 'Memorando';
    if (/llamado de atencion|llamado de atenci/.test(t)) return 'Llamado de atencion';
    if (/vacaciones/.test(t) && /disfrut/.test(t)) return 'Vacaciones';
    if (/liquidacion/.test(t)) return 'Liquidacion';
    if (/funciones/.test(t) && /cargo/.test(t)) return 'Funciones del cargo';
    if (/consulta.*afiliad|adres|seguridad social|eps/.test(t) && /afiliad/.test(t)) return 'Salud / EPS';
    if (/contrato/.test(t)) return 'Contrato';
    return null;
  };
  const extraerFecha = (texto) => {
    const m = (texto || '').match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})\b/i);
    return m ? m[1] : '';
  };
  const palabraComunLarga = (a, b) => {
    const palabrasA = a.toUpperCase().split(/\s+/).filter((w) => w.length >= 4);
    const palabrasB = b.toUpperCase().split(/\s+/).filter((w) => w.length >= 4);
    return palabrasA.some((w) => palabrasB.includes(w));
  };

  // El parser de contratos a veces captura como cargo la etiqueta del formulario
  // con ruido del OCR ("U OFICIO QUE | ADMINISTRADORA", "OFICIO QueOPERADOR DE
  // MAQUINA DE MAIZ"). Esta heuristica quita la etiqueta "OFICIO QUE DESEMPENARA
  // EL TRABAJADOR" y las viñetas/pipes y conserva solo el cargo real. Es
  // conservadora: si no hay patron claro, devuelve el cargo tal cual.
  const limpiarCargo = (cargo) => {
    if (!cargo) return cargo;
    let valor = String(cargo).trim();
    // Quita la etiqueta "OFICIO QUE DESEMPENARA EL TRABAJADOR" o partes de ella.
    valor = valor
      .replace(/OFICIO\s*(?:HA\s*)?[—\-_]?\s*(?:QUE|SIDO|HA)[\s|_\-]*/gi, ' ')
      .replace(/DESEMPE\s*(?:ÑARA|NARA)\s*EL\s*TRABAJADOR\s*:/gi, ' ')
      .replace(/DESEMPENARA\s*(?:EL\s*)?TRABAJADOR\s*:?/gi, ' ')
      .replace(/CARGO\s*(?:A|QUE|U)?\s*/gi, ' ')
      .replace(/[\u007C|_]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // Si al limpiar solo queda la etiqueta o quedo vacio, regresar el original.
    if (!valor || valor.length < 3) return cargo;
    // Quita viñetas residuales de una sola letra/digito al inicio ("U ", "A ",
    // "1 ") que el OCR deja pegadas a la etiqueta "CARGO U OFICIO QUE ...".
    valor = valor.replace(/^\s*(?:[UAVuav1oO0])\s+/g, '').trim();
    if (!valor || valor.length < 3) return cargo;
    return valor;
  };

  const esBasuraOCR = (txt) => {
    if (!txt) return true;
    const s = String(txt).trim();
    if (s.length < 3) return true;
    // Firmas, roles institucionales y despedidas: nunca son datos de la persona.
    if (/(?:atentamente|cordialmente|gerencia|firm[ao]\b|talento\s+humano|recursos\s+humanos|departamento\s+de\s+personal|direcci[oó]n\s+general|administraci[oó]n\b|reci[óo]n\s+humano)/i.test(s)) return true;
    // Basura OCR aislada: siglas cortas sin vocales ("NRTA", "XXXX") no son un
    // valor real. Un nombre, cargo o ciudad legible tiene al menos una vocal.
    const soloMayus = s === s.toUpperCase();
    if (s.length <= 6 && soloMayus && !/[aeiouáéíóú]/i.test(s)) return true;
    if (s.length <= 3 && !/[aeiouáéíóú]/i.test(s)) return true;
    return false;
  };

  // Versión de esBasuraOCR orientada a nombres: además de firmas/cargos, rechaza
  // palabras del léxico de memorandos/contratos (encabezados, conectores).
  const esBasuraNombre = (txt) => {
    if (!txt) return true;
    const s = String(txt).trim();
    if (esBasuraOCR(s)) return true;
    if (/(?:memorando|llamado\s+de\s+atencion|asunto|para\b|de\b|fecha|distribuciones|ceso\s+humano|talento|recurso|emplead|trabajad)/i.test(s)) return true;
    if (/\b(?:el|la|los|las|sr|sra|ingenier[oa]|doctor[oa]|licenciad[oa])\b/i.test(s) && s.split(/\s+/).length < 3) return true;
    return false;
  };

  const persona = {
    nombre: j.nombre,
    trabajador: { nombres: '', apellidos: '', documento: '', nacimiento: '', direccion: '', ciudad: '', telefono: '', email: '', estadoCivil: '', profesion: '' },
    cargo: null,
    salud: { eps: '', regimen: '', arl: '', pension: '', caja: '' },
    contratos: [],
    historial: [],
    liquidaciones: [],
    educacion: [],
    experiencia: [],
    habilidades: [],
    documentos: [],
    documentosTexto: [],
  };

  // El nombre de la carpeta es el identificador mas confiable de la persona
  // (asi las armaron). Se guarda como respaldo para la seccion de nombre.
  const nombreCarpeta = String(j.nombre || '').trim();
  persona.nombreCarpeta = nombreCarpeta;

  let candidatoMejor = null;
  let candidatoPuntaje = 0;
  // Nombre del destinatario leido de los memorandos (etiqueta "PARA:"). Es un
  // ancla espacial fiable: el receptor es la persona, mientras el "DE:" es el
  // emisor (suele ser "GERENCIA" o un departamento). Se usa como respaldo de
  // nombre cuando el OCR de la hoja de vida falla.
  let nombreMemorando = '';

  // Semillas del limpiador de texto: terminos del diccionario de cargos del
  // sistema mas el vocabulario administrativo tipico de los contratos de Rosimar.
  // Al segmentar "AUXILIARDEBODEGA" en "AUXILIAR DE BODEGA" la ficha se vuelve
  // legible y el web puede tomar el cargo.
  const dicCargos = await import('/src/lib/contexto/diccionario.ts');
  const semillasLimpiador = [
    'auxiliar de bodega', 'auxiliar de aseo', 'auxiliar', 'ayudante de bodega', 'ayudante',
    'vendedor externo', 'vendedor', 'vendedora', 'conductor', 'operador de maquina',
    'operario de maquina', 'administradora', 'administrador', 'bodega', 'bodeguero',
    'almacenista', 'montacarguista', 'servicios generales', 'oficios varios', 'limpieza',
    'barranquilla', 'soledad', 'malambo', 'galapa', 'puerto colombia', 'atletico',
    'cargo', 'desempenara', 'trabajador', 'empleador', 'salario', 'contrato',
    'contrato individual de trabajo', 'distribuciones rosimar', 'lugar de nacimiento',
    'fecha de nacimiento', 'cedula', 'cedula de ciudadania', 'telefono', 'correo',
    'direccion', 'firma', 'nit', 'especialidad', 'terminacion', 'iniciacion', 'estrato',
    'compensacion familiar', 'calle', 'carrera', 'diagonal', 'transversal', 'numero',
    'apartamento', 'manzana', 'coosalud', 'eps', 'arl', 'seguridad social', 'capitalizacion',
  ];
  for (const fam of dicCargos.FAMILIAS_CARGOS) {
    semillasLimpiador.push(...fam.sinonimos);
  }

  for (const reg of j.registros) {
    if (reg.error || !reg.text) continue;
    persona.documentos.push(reg.fileName);

    // Texto reorganizado y legible (segun semillas del diccionario).
    const limpieza = limpio.limpiarTextoOCR(reg.text, semillasLimpiador);
    const textoLimpio = limpieza.texto;

    persona.documentosTexto.push({
      archivo: reg.fileName,
      tipo: reg.detectedType || 'desconocido',
      texto: textoLimpio,
    });

    if (reg.candidate) {
      const p = candidatoPuntajeCampos(reg.candidate);
      if (p > candidatoPuntaje) {
        candidatoPuntaje = p;
        candidatoMejor = reg.candidate;
      }
      if (reg.candidate.education?.length) persona.educacion = fusionarLista(persona.educacion, reg.candidate.education);
      if (reg.candidate.experience?.length) persona.experiencia = fusionarLista(persona.experiencia, reg.candidate.experience);
      if (reg.candidate.skills?.length) persona.habilidades = fusionarLista(persona.habilidades, reg.candidate.skills);
    }

    if (reg.contract) {
      const c = {};
      if (reg.contract.workerName) c.trabajador = reg.contract.workerName;
      if (reg.contract.position) c.cargo = limpiarCargo(reg.contract.position);
      if (reg.contract.salary) c.salario = reg.contract.salary;
      if (reg.contract.contractType) c.tipo = reg.contract.contractType;
      if (reg.contract.durationMonths) c.meses = reg.contract.durationMonths;
      if (reg.contract.startDate) c.inicio = reg.contract.startDate;
      if (reg.contract.endDate) c.fin = reg.contract.endDate;
      if (reg.contract.trialPeriodDays) c.prueba = reg.contract.trialPeriodDays;
      if (reg.contract.executionPlace) c.lugar = reg.contract.executionPlace;
      persona.contratos.push(c);
    }

    if (reg.liquidacion) {
      const l = {};
      if (reg.liquidacion.cargo) l.cargo = limpiarCargo(reg.liquidacion.cargo);
      if (reg.liquidacion.fechaIngreso) l.ingreso = reg.liquidacion.fechaIngreso;
      if (reg.liquidacion.fechaRetiro) l.retiro = reg.liquidacion.fechaRetiro;
      if (reg.liquidacion.diasTrabajados) l.dias = reg.liquidacion.diasTrabajados;
      if (reg.liquidacion.cesantias) l.cesantias = reg.liquidacion.cesantias;
      if (reg.liquidacion.interesesCesantias) l.intereses = reg.liquidacion.interesesCesantias;
      if (reg.liquidacion.prima) l.prima = reg.liquidacion.prima;
      if (reg.liquidacion.vacaciones) l.vacaciones = reg.liquidacion.vacaciones;
      if (reg.liquidacion.indemnizacion) l.indemnizacion = reg.liquidacion.indemnizacion;
      if (reg.liquidacion.salarioBase) l.salario = reg.liquidacion.salarioBase;
      if (reg.liquidacion.totalLiquidacion) l.total = reg.liquidacion.totalLiquidacion;
      persona.liquidaciones.push(l);
    }

    if (reg.health) {
      if (reg.health.epsName) persona.salud.eps = reg.health.epsName;
      if (reg.health.epsRegime) persona.salud.regimen = reg.health.epsRegime;
      if (reg.health.arlName) persona.salud.arl = reg.health.arlName;
      if (reg.health.pensionFund) persona.salud.pension = reg.health.pensionFund;
      if (reg.health.compensationBox) persona.salud.caja = reg.health.compensationBox;
    }

    if (reg.idCard) {
      if (reg.idCard.documentNumber && !persona.trabajador.documento) persona.trabajador.documento = reg.idCard.documentNumber;
      if (reg.idCard.firstNames && !persona.trabajador.nombres) persona.trabajador.nombres = reg.idCard.firstNames;
      if (reg.idCard.lastNames && !persona.trabajador.apellidos) persona.trabajador.apellidos = reg.idCard.lastNames;
      if (reg.idCard.birthDate && !persona.trabajador.nacimiento) persona.trabajador.nacimiento = reg.idCard.birthDate;
      if (reg.idCard.address && !persona.trabajador.direccion) persona.trabajador.direccion = reg.idCard.address;
      if (reg.idCard.expeditionPlace) persona.trabajador.expedicion = reg.idCard.expeditionPlace;
    }

    if (reg.memorando) {
      persona.historial.push({
        tipo: reg.detectedType === 'llamado_atencion' ? 'Llamado de atencion' : 'Memorando',
        fecha: reg.memorando.date || '',
        asunto: reg.memorando.subject || '',
      });
      // Ancla espacial: el "PARA:" de un memorando nombra al empleado. Se exige
      // que sea un nombre con apellido (2+ palabras) y que no sea una firma,
      // cargo o departamento, para no captar "GERENCIA" ni ruido del OCR.
      const mn = String(reg.memorando.workerName || '').trim();
      const palabrasMn = mn.split(/\s+/).filter(Boolean).length;
      if (palabrasMn >= 2 && !esBasuraNombre(mn) && !esBasuraOCR(mn)) {
        if (!nombreMemorando || palabrasMn >= nombreMemorando.split(/\s+/).length) {
          nombreMemorando = mn;
        }
      }
    }

    if (reg.detectedType === 'unknown' && reg.text) {
      const cat = cls.clasificarHistorial(reg.text);
      if (cat === 'funciones' && reg.funciones) {
        persona.cargo = { titulo: limpiarCargo(reg.funciones.position) || persona.cargo?.titulo || '', funciones: reg.funciones.funciones || [] };
      }
    }

    const tipoDoc = tipoDocumento(reg.text, reg.detectedType);
    if (tipoDoc) {
      persona.historial.push({ tipo: tipoDoc, fecha: extraerFecha(reg.text) || '', asunto: '' });
    }
  }

  if (candidatoMejor) {
    const t = persona.trabajador;
    // Si el unico "nombre" leido es una firma o rol institucional, todo el
    // candidato es un documento no-CV mal leido: no se toman sus datos.
    const nombreLeido = `${candidatoMejor.firstNames ?? ''} ${candidatoMejor.lastNames ?? ''}`.trim();
    const candidatoVacio = esBasuraOCR(nombreLeido);
    if (!candidatoVacio) {
      if (!t.nombres && candidatoMejor.firstNames) t.nombres = candidatoMejor.firstNames;
      if (!t.apellidos && candidatoMejor.lastNames) t.apellidos = candidatoMejor.lastNames;
      if (!t.documento && candidatoMejor.documentNumber) t.documento = candidatoMejor.documentNumber;
      if (!t.nacimiento && candidatoMejor.birthDate) t.nacimiento = candidatoMejor.birthDate;
      if (!t.ciudad && candidatoMejor.cityResidence && !esBasuraOCR(candidatoMejor.cityResidence)) t.ciudad = candidatoMejor.cityResidence;
      if (!t.direccion && candidatoMejor.address && !esBasuraOCR(candidatoMejor.address)) t.direccion = candidatoMejor.address;
      if (!t.telefono && candidatoMejor.phone && !esBasuraOCR(candidatoMejor.phone)) t.telefono = candidatoMejor.phone;
      if (!t.email && candidatoMejor.email && !esBasuraOCR(candidatoMejor.email)) t.email = candidatoMejor.email;
      if (!t.profesion && candidatoMejor.headline && !esBasuraOCR(candidatoMejor.headline)) t.profesion = candidatoMejor.headline;
    }
  }

  // Si el OCR no reconocio un nombre creible, se usa el de la carpeta (que es
  // como Rosimar armo el expediente) como nombre completo de referencia.
  const nombreOcr = [persona.trabajador.nombres, persona.trabajador.apellidos].filter(Boolean).join(' ').trim();
  const coincide = nombreCarpeta && nombreOcr && palabraComunLarga(nombreCarpeta, nombreOcr);
  if (nombreOcr && coincide) {
    // Nombre del OCR coincide con la carpeta: se conserva el desglose nombres/apellidos.
  } else if (nombreCarpeta) {
    // OCR ruidoso o ausente: la ficha identifica a la persona por el nombre de la carpeta.
    persona.trabajador.nombres = '';
    persona.trabajador.apellidos = nombreCarpeta;
  }

  if (!persona.cargo && candidatoMejor?.headline) persona.cargo = { titulo: candidatoMejor.headline, funciones: [] };

  return persona;
};

// ---------- Generacion de PDF (corre en Node) ----------
async function generarPdf(ficha) {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();

  // Extraccion de la cedula desde el texto del expediente cuando el parser no la
  // reconocio como campo (solo 3 idCard detectadas). Las cedulas colombianas
  // tienen 7 a 10 digitos; se busca tras las etiquetas tipicas (C.C., CC, CEDULA
  // DE CIUDADANIA) y se descartan numeros que la validacion rechaza.
  if (!ficha?.trabajador?.documento) {
    const cedulas = new Map();
    for (const docTxt of ficha?.documentosTexto || []) {
      const texto = docTxt.texto || '';
      for (const m of texto.matchAll(/(?:C[.:]?\s*C\s*[.:]?\s*|CEDULA\s*DE\s*CIUDADANIA|^CC\b)\s*[:.:]?\s*([1-9][0-9 .,]{6,14}[0-9])/gim)) {
        const n = m[1].replace(/[^0-9]/g, '');
        if (n.length >= 7 && n.length <= 10 && n[0] !== '0') {
          cedulas.set(n, (cedulas.get(n) || 0) + 1);
        }
      }
    }
    if (cedulas.size) {
      // La mas citada (mas confiable) o la mas corta en caso de empate.
      const mejor = [...cedulas.entries()].sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : a[0].length - b[0].length)[0][0];
      ficha.trabajador.documento = mejor;
    }
  }

  const ANCHO = doc.internal.pageSize.getWidth();
  const MARGEN = 14;
  const contenido = ANCHO - MARGEN * 2;

  // Encabezado institucional
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text('ROSIMAR S.A.S.', MARGEN, 16);
  doc.setFontSize(10);
  doc.text('GESTION DE TALENTO HUMANO - FICHA LABORAL', MARGEN, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Expediente: ${ficha.nombre}`, MARGEN, 27);
  doc.setLineWidth(0.4);
  doc.line(MARGEN, 29, ANCHO - MARGEN, 29);

  let y = 36;
  const fila = (label, valor) => {
    if (!valor) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`${label}:`, MARGEN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const v = wrap(doc, String(valor));
    v.split('\n').forEach((linea, i) => {
      doc.text(linea, MARGEN + 55, y + (i * 4.5));
    });
    y += v.split('\n').length * 4.5 + 1;
  };

  const seccion = (titulo) => {
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(titulo.toUpperCase(), MARGEN, y);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, y + 1.5, ANCHO - MARGEN, y + 1.5);
    y += 6;
  };

  seccion('Informacion personal');
  const t = ficha.trabajador;
  fila('Nombre', [t.nombres, t.apellidos].filter(Boolean).join(' ').trim());
  fila('Documento', t.documento);
  // Validacion de dominio: la cedula colombiana tiene 7 a 10 digitos. Si el
  // OCR trajo otra cosa (ruido, correo, fecha), se marca para revision manual
  // en vez de aceptar un dato invalido en silencio.
  const docNormalizado = String(t.documento || '').replace(/[^\d]/g, '');
  if (!t.documento) {
    fila('Validacion documento', '[FALTA DOCUMENTO - REVISAR]');
  } else if (docNormalizado.length < 7 || docNormalizado.length > 10) {
    fila('Validacion documento', `[Cedula con ${docNormalizado.length} digitos - REVISAR: \"${t.documento}\"]`);
  }
  fila('Fecha de nacimiento', t.nacimiento);
  fila('Direccion', t.direccion);
  fila('Ciudad', t.ciudad);
  fila('Telefono', t.telefono);
  fila('Correo', t.email);
  fila('Estado civil', t.estadoCivil);
  fila('Profesion / cargo', t.profesion);

  seccion('Datos laborales');
  const cargo = ficha.cargo;
  if (cargo?.titulo) fila('Cargo', cargo.titulo);
  fila('Empresa', ficha.empresaManual || 'DISTRIBUCIONES ROSIMAR S.A.S. (NIT 901.167.955-4)');

  const salud = ficha.salud;
  if (salud.eps || salud.regimen) {
    seccion('Salud y seguridad social');
    fila('EPS', salud.eps);
    fila('Regimen', salud.regimen);
    fila('ARL', salud.arl);
    fila('Pension', salud.pension);
    fila('Caja de compensacion', salud.caja);
  }

  if (ficha.contratos.length) {
    seccion('Contratos de trabajo');
    const filas = ficha.contratos.map((c) => [
      c.cargo || '',
      c.tipo ? tipoContrato(c.tipo) : '',
      c.inicio || '',
      c.fin || '',
      c.salario ? `$${formatoMoneda(c.salario)}` : '',
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Cargo', 'Tipo', 'Inicio', 'Fin', 'Salario']],
      body: filas,
      margin: { left: MARGEN, right: MARGEN },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [60, 60, 60] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30 },
      },
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  if (ficha.liquidaciones.length) {
    seccion('Liquidaciones');
    const filas = ficha.liquidaciones.map((l) => [
      l.cargo || '',
      l.ingreso || '',
      l.retiro || '',
      l.cesantias ? `$${formatoMoneda(l.cesantias)}` : '',
      l.prima ? `$${formatoMoneda(l.prima)}` : '',
      l.vacaciones ? `$${formatoMoneda(l.vacaciones)}` : '',
      l.total ? `$${formatoMoneda(l.total)}` : '',
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Cargo', 'Ingreso', 'Retiro', 'Cesantias', 'Prima', 'Vacaciones', 'Total']],
      body: filas,
      margin: { left: MARGEN, right: MARGEN },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [60, 60, 60] },
      columnStyles: {
        0: { cellWidth: 53 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 18 },
      },
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  if (ficha.historial.length) {
    seccion('Historial laboral y disciplinario');
    const unicos = [];
    const vistos = new Set();
    for (const h of ficha.historial) {
      const k = `${h.tipo}|${h.fecha}`;
      if (!vistos.has(k)) { vistos.add(k); unicos.push(h); }
    }
    const filas = unicos.map((h) => [h.tipo, h.fecha, h.asunto]);
    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Fecha', 'Detalle']],
      body: filas,
      margin: { left: MARGEN, right: MARGEN },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [60, 60, 60] },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 25 } },
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  if (ficha.experiencia.length || ficha.educacion.length || ficha.habilidades.length) {
    if (ficha.experiencia.length) {
      seccion('Experiencia laboral (hoja de vida)');
      const filas = ficha.experiencia.map((e) => [e?.position || '', e?.company || '', e?.startDate && e?.endDate ? `${e.startDate} - ${e.endDate}` : '']);
      autoTable(doc, {
        startY: y,
        head: [['Cargo', 'Empresa', 'Periodo']],
        body: filas,
        margin: { left: MARGEN, right: MARGEN },
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [60, 60, 60] },
      });
      y = doc.lastAutoTable.finalY + 4;
    }
    if (ficha.educacion.length) {
      seccion('Formacion academica (hoja de vida)');
      const filas = ficha.educacion.map((e) => [e?.title || '', e?.institution || '', e?.endYear ? String(e.endYear) : '']);
      autoTable(doc, {
        startY: y,
        head: [['Titulo', 'Institucion', 'Anio']],
        body: filas,
        margin: { left: MARGEN, right: MARGEN },
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [60, 60, 60] },
      });
      y = doc.lastAutoTable.finalY + 4;
    }
  }

  // Texto completo de los documentos del expediente (OCR integro)
  if (ficha.documentosTexto?.length) {
    const MAX_PAGINA = 270;
    const SALTO = 14;
    doc.addPage();
    y = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('TEXTO COMPLETO DEL EXPEDIENTE'.toUpperCase(), MARGEN, y);
    doc.setLineWidth(0.4);
    doc.line(MARGEN, y + 1.5, ANCHO - MARGEN, y + 1.5);
    y += 9;

    for (const docTxt of ficha.documentosTexto) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const lineasTitulo = doc.splitTextToSize(`DOCUMENTO: ${docTxt.archivo}  [${docTxt.tipo}]`, contenido);
      for (const lt of lineasTitulo) {
        if (y > MAX_PAGINA) { doc.addPage(); y = SALTO; }
        doc.text(lt, MARGEN, y);
        y += 5;
      }

      // Cabecera estructurada del documento (si se reconocen claves de la foto).
      const campos = cabeceraDocumento(docTxt.tipo, docTxt.texto);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      for (const campo of campos) {
        if (y > MAX_PAGINA) { doc.addPage(); y = SALTO; }
        const lineasCampo = doc.splitTextToSize(campo, contenido);
        for (const lc of lineasCampo) {
          if (y > MAX_PAGINA) { doc.addPage(); y = SALTO; }
          doc.text(lc, MARGEN, y);
          y += 3.6;
        }
      }
      if (campos.length) y += 1;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      const lineasTexto = doc.splitTextToSize(docTxt.texto || '', contenido);
      for (const lt of lineasTexto) {
        if (y > MAX_PAGINA) { doc.addPage(); y = SALTO; }
        doc.text(lt, MARGEN, y);
        y += 3.6;
      }
      y += 3;
    }
  }

  // Pie
  const finalY = doc.lastAutoTable?.finalY || y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Ficha generada a partir del expediente "${ficha.nombre}". Datos extraidos por OCR; verificar contra documentos originales.`, MARGEN, 287);

  return Buffer.from(doc.output('arraybuffer'));
}

function tipoContrato(t) {
  const map = {
    termino_fijo: 'Termino fijo',
    indefinido: 'Indefinido',
    obra_labor: 'Obra o labor',
    aprendizaje: 'Aprendizaje',
    tiempo_parcial: 'Tiempo parcial',
    otro: 'Otro',
  };
  return map[t] || t;
}

function formatoMoneda(n) {
  return Number(n).toLocaleString('es-CO');
}

/**
 * Extrae la cabecera estructurada de un documento del expediente a partir del
 * texto (limpio) del OCR. Devuelve lineas "Campo: valor" listas para imprimir.
 * Detecta claves tipicas de los documentos de Rosimar (ASUNTO, FECHA, DE/PARA,
 * NOMBRE/CEDULA) y de hojas de vida (perfil/contacto). Es conservador: si no
 * encuentra nada, no inventa campos.
 */
function cabeceraDocumento(tipo, texto) {
  if (!texto) return [];
  const lineas = texto.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const campos = [];

  const encontrar = (re) => {
    for (const l of lineas) {
      const m = l.match(re);
      if (m && m[1] && m[1].trim().length >= 2) return m[1].trim().slice(0, 200);
    }
    return null;
  };

  // 1. Fecha (varios formatos)
  const fecha = encontrar(/(?:FECHA|fecha)\s*[:.:]\s*([0-9][^\n]{0,60})/i)
    || (texto.match(/\b(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})\b/i) ?? [])[1]
    || (texto.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/) ?? [])[1];
  if (fecha) campos.push(`Fecha: ${fecha}`);

  // 2. Emisor (DE:) y Receptor (PARA:) en memorandos/llamados
  const de = encontrar(/^\s*(?:DE)\s*[:.:]\s*(.*)$/i);
  const para = encontrar(/^\s*(?:PARA|A\s*:)\s*[:.:]\s*(.*)$/i);
  if (para) campos.push(`Receptor: ${para}`);
  if (de) campos.push(`Emisor: ${de}`);

  // 3. Asunto
  const asunto = encontrar(/^\s*ASUNTO\s*[:.:]\s*(.*)$/i) || encontrar(/^\s*REFERENCIA\s*[:.:]\s*(.*)$/i);
  if (asunto) campos.push(`Asunto: ${asunto}`);

  // 4. Nombre y cedula del trabajador (en memorandos/llamados de Rosimar)
  const nombre = encontrar(/^(?:NOMBRE|DEL\s*TRABAJADOR|TRABAJADOR)\s*[:.:]\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.]+)$/i);
  const cedula = encontrar(/(?:C[.:]?\s*C[.:]?\s*|CEDULA\s*[:.:]\s*)\s*[:.:]?\s*([0-9][0-9 .]*[0-9])/i)
    || encontrar(/CEDULA\s*DE\s*CIUDADANIA\s*[:.:]?\s*([0-9][0-9 .]*)/i);
  if (nombre && cedula) campos.push(`Trabajador: ${nombre} | CC ${cedula}`);
  else if (nombre) campos.push(`Trabajador: ${nombre}`);

  return campos;
}

function wrap(doc, texto) {
  const ancho = doc.internal.pageSize.getWidth() - 14 - 55 - 14;
  const palabras = String(texto).split(' ');
  let lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (doc.getTextWidth(prueba) > ancho && actual) {
      lineas.push(actual);
      actual = p;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.join('\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
