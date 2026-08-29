import {
  CandidateFormData,
  EducationItem,
  ExperienceItem,
  ReferenceItem,
  LanguageItem,
  CertificationItem,
} from '../../types/candidate';
import { extractSkillsFromText } from './skills-taxonomy';

/**
 * Parsea el texto extraido de una hoja de vida (digital o escaneada, en español o ingles)
 * extrayendo de forma exhaustiva todos los campos de los formularios sin datos ficticios,
 * incluso si el documento NO contiene títulos de sección explícitos.
 */
export function parseCvText(text: string): CandidateFormData {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Extracción de Correo Electrónico
  const emailMatch = text.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/);
  const email = emailMatch ? emailMatch[0].toLowerCase() : '';

  // 2. Extracción de Teléfono
  let phone = '';
  const labeledPhoneMatch = text.match(
    /(?:(?:\b(?:phone|cell|mobile|tel[eé]fono|celular|m[oó]vil|whatsapp|tel\.|cel\.)\b|(?<=\s|^)[CP]:))\s*[:#.-]?\s*(\+?\d{1,3}[\s-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\b3\d{9}\b|\b\d{7,11}\b)/i
  );

  if (labeledPhoneMatch) {
    phone = labeledPhoneMatch[1].trim();
  } else {
    const intlPhoneMatch = text.match(
      /(?:\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\(\+\d{1,3}\)\s*\d{8,12}|\b3\d{2}[-.\s]?\d{3}[-.\s]?\d{4}\b/
    );
    if (intlPhoneMatch) {
      phone = intlPhoneMatch[0].trim();
    } else {
      const genericPhone = text.match(/\b3\d{9}\b/);
      if (genericPhone) {
        phone = genericPhone[0];
      }
    }
  }

  // 3. Extracción de Documento de Identidad
  let documentNumber = '';
  let documentType: 'CC' | 'CE' | 'TI' | 'PAS' | 'PEP' | 'PPT' | 'OTRO' = 'CC';
  const docMatch = text.match(
    /(?:\b(?:c\.?c\.?|c[eé]dula(?:\s+de\s+ciudadan[ií]a)?|identificaci[oó]n|documento|id\s+number|national\s+id|tarjeta\s+de\s+identidad|t\.?i\.?|pasaporte|pas)\b)(?:\s*n[oó]\.?)?\s*[:#.]?\s*([0-9.,]{6,12})/i
  );
  if (docMatch) {
    const rawDoc = docMatch[1].replace(/[.,]/g, '').trim();
    if (rawDoc !== phone.replace(/\D/g, '')) {
      documentNumber = rawDoc;
    }
  }

  // 4. Extracción de Ciudad / Dirección / Ubicación Universal
  const cityResidence = extractLocation(text);

  // 5. Extracción de Nacionalidad (SOLO si está escrita expresamente en el texto)
  let nationality = '';
  const nationalityMatch = text.match(
    /(?:nacionalidad|nationality|citizenship|ciudadan[ií]a)\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/i
  );
  if (nationalityMatch) {
    nationality = nationalityMatch[1].trim();
  }

  // 5.1 Extracción de Lugar de Nacimiento
  let birthPlace: string | undefined;
  const birthPlaceMatch = text.match(
    /(?:lugar\s+de\s+nacimiento|lugar\s+de\s+expedici[oó]n|born\s+in)\s*[:#.-]?\s*([A-Za-záéíóúÁÉÍÓÚñÑ\s,.-]+?)(?=\n|[|•*+]|Nacionalidad|Edad|Estado|Fecha|Sexo|G[eé]nero|$)/i
  );
  if (birthPlaceMatch && birthPlaceMatch[1].trim().length > 3) {
    birthPlace = birthPlaceMatch[1].trim();
  }

  // 6. Extracción de Estado Civil
  let maritalStatus: string | undefined;
  const maritalMatch = text.match(
    /(?:estado\s+civil|marital\s+status)\s*[:#.-]?\s*(Solter[oa]|Casad[oa]|Uni[oó]n\s+libre|Divorciad[oa]|Viud[oa]|Single|Married)/i
  );
  if (maritalMatch) {
    maritalStatus = maritalMatch[1].trim();
  }

  // 6.1 Extracción de Género/Sexo
  let gender: string | undefined;
  const genderMatch = text.match(
    /(?:g[eé]nero|sexo|gender|sex)\s*[:#.-]?\s*(Masculino|Femenino|Hombre|Mujer|Male|Female)/i
  );
  if (genderMatch) {
    gender = genderMatch[1].trim();
  }

  // 6.2 Extracción de Documentos Colombianos (Licencia, Libreta, Tarjeta Prof)
  let driverLicense: string | undefined;
  const driverMatch = text.match(
    /(?:licencia\s+de\s+(?:conducci[oó]n|tr[aá]nsito)|pase(?:(?:\s+de)?\s+conducci[oó]n)?)\s*(?:categor[ií]a)?\s*[:#.-]?\s*(A1|A2|B1|B2|B3|C1|C2|C3)/i
  );
  if (driverMatch) {
    driverLicense = driverMatch[1];
  }

  let militaryCard: string | undefined;
  const militaryMatch = text.match(
    /(?:libreta\s+militar)\s*[:#.-]?\s*([0-9]+|Primera\s+clase|Segunda\s+clase|1ra\s+clase|2da\s+clase)/i
  );
  if (militaryMatch) {
    militaryCard = militaryMatch[1].trim();
  }

  let professionalCard: string | undefined;
  const profCardMatch = text.match(
    /(?:t\.?p\.?|tarjeta\s+profesional(?: No\.?)?|copnia)\s*[:#.-]?\s*([A-Z0-9-]{4,15})/i
  );
  if (profCardMatch) {
    professionalCard = profCardMatch[1].trim();
  }

  // 6.3 Extracción de Redes Sociales (LinkedIn, GitHub)
  const socialLinks: string[] = [];
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  if (linkedinMatch) socialLinks.push(linkedinMatch[0].startsWith('http') ? linkedinMatch[0] : `https://${linkedinMatch[0]}`);
  
  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i);
  if (githubMatch) socialLinks.push(githubMatch[0].startsWith('http') ? githubMatch[0] : `https://${githubMatch[0]}`);

  // 7. Extracción de Fecha de Nacimiento
  let birthDate: string | undefined;
  const birthMatch = text.match(
    /(?:fecha\s+de\s+nacimiento|nacido\s+el|nacimiento|date\s+of\s+birth|dob)\s*[:#.-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+de\s+[a-zA-Z]+\s+de\s+\d{4})/i
  );
  if (birthMatch) {
    birthDate = birthMatch[1].trim();
  }

  // 8. Expectativa Salarial
  let salaryExpectation: number | undefined;
  const salaryMatch = text.match(
    /(?:aspiraci[oó]n|expectativa|pretensi[oó]n|sueldo\s+esperado|salario\s+esperado|salary\s+expectation)\s*(?:salarial)?\s*[:#.-]?\s*\$?\s*([0-9.,]{5,15})/i
  );
  if (salaryMatch) {
    const rawNum = salaryMatch[1].replace(/[.,]/g, '');
    const num = parseInt(rawNum, 10);
    if (!isNaN(num) && num > 10000) {
      salaryExpectation = num;
    }
  }

  // 9. Disponibilidad
  let availability: string | undefined;
  const availMatch = text.match(
    /(?:disponibilidad|incorporaci[oó]n|availability)\s*[:#.-]?\s*([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s,.-]+?)(?=\n|[|•]|$)/i
  );
  if (availMatch && availMatch[1].trim().length > 2) {
    availability = availMatch[1].trim();
  }

  // 10. Extracción de Nombres y Apellidos
  let firstNames = '';
  let lastNames = '';
  let headline = '';

  const jobTitlesPattern = /(?:senior|junior|semi-?senior|lead|head|director|gerente|jefe|coordinador|analista|desarrollador|developer|ingeniero|engineer|arquitecto|architect|consultor|consultant|t[eé]cnico|tecn[oó]logo|operario|asistente|auxiliar|especialista|specialist|abogado|contador|administrador|dise[ñn]ador|designer|profesional|estudiante|bachiller)/i;

  const ignoredKeywords =
    /(?:curriculum|hoja\s+de\s+vida|resume|cv|datos\s+personales|personal\s+information|contact|contacto|summary|perfil|profile|experience|experiencia|education|educacion|skills|habilidades|objective|job\s+objective|sample|template|university|college|universidad|colegio|instituto|institute|academy|faculty|school|escuela|campus|department)/i;

  const monthNamesNameCheck =
    '(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre|Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
  const dateRangeLineRegex = new RegExp(
    `(?:(?:${monthNamesNameCheck}\\s+)?(\\d{1,2}[/-])?(20\\d\\d|19\\d\\d|\\d{2}))\\s*(?:[-–—a]|to|hasta)\\s*(?:(?:${monthNamesNameCheck}\\s+)?(\\d{1,2}[/-])?(20\\d\\d|19\\d\\d|\\d{2})|presente|actualidad|actual|present|current)`,
    'i'
  );

  const firstNameMatch = text.match(/\b(?:nombres?|first\s*name|name)\b\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ ]+?)(?=\n|[|•*+]|$)/i);
  const lastNameMatch = text.match(/\b(?:apellidos?|last\s*name)\b\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ ]+?)(?=\n|[|•*+]|$)/i);

  if (firstNameMatch && lastNameMatch && firstNameMatch[1].length > 2 && lastNameMatch[1].length > 2) {
    firstNames = firstNameMatch[1].trim();
    lastNames = lastNameMatch[1].trim();
  } else if (firstNameMatch && firstNameMatch[1].length > 2 && !lastNameMatch) {
    // Si solo hay label de nombre, podría contener todo el nombre completo
    const parts = firstNameMatch[1].trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      firstNames = parts[0];
      lastNames = parts.slice(1).join(' ');
    } else {
      firstNames = parts[0];
    }
  } else {
    // Analizar las primeras 30 líneas buscando el nombre
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      let line = lines[i].trim();

      if (/^[•*\-+]/.test(line)) continue;
      if (dateRangeLineRegex.test(line)) continue;

      // Dividir la línea por separadores comunes (| • * + - ,) para encontrar el nombre si está camuflado con correos o teléfonos
      const fragments = line.split(/[|•*+,-]/).map(f => f.trim()).filter(Boolean);

      let foundName = false;
      for (const frag of fragments) {
        // Remover prefijos profesionales
        let cleanFrag = frag.replace(/^(?:ing(?:eniero|eniera)?\.?|dr\.?|dra\.?|lic\.?|abg\.?|psic\.?|cdor(?:a)?\.?)\s+/i, '').trim();

        if (
          !ignoredKeywords.test(cleanFrag) &&
          !jobTitlesPattern.test(cleanFrag) &&
          !cleanFrag.includes('@') &&
          !cleanFrag.includes('http') &&
          !cleanFrag.includes('www.') &&
          !/\d{2,}/.test(cleanFrag) &&
          !/^(c:|p:|phone|email|tel|cel)/i.test(cleanFrag) &&
          cleanFrag.length >= 3 &&
          cleanFrag.length <= 50 &&
          /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s']+$/.test(cleanFrag)
        ) {
          const parts = cleanFrag.split(/\s+/).filter(Boolean);
          if (parts.length >= 2 && parts.length <= 4) {
            if (parts.length === 2) {
              firstNames = parts[0];
              lastNames = parts[1];
            } else if (parts.length === 3) {
              firstNames = parts[0];
              lastNames = `${parts[1]} ${parts[2]}`;
            } else {
              firstNames = `${parts[0]} ${parts[1]}`;
              lastNames = parts.slice(2).join(' ');
            }
            foundName = true;
            break;
          }
        }
      }

      if (foundName) {
        // Buscar el titular en la línea siguiente, si existe
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (
            !ignoredKeywords.test(nextLine) &&
            !nextLine.includes('@') &&
            !/\d{4,}/.test(nextLine) &&
            nextLine.length >= 4 &&
            nextLine.length <= 60
          ) {
            headline = nextLine;
          }
        }
        break;
      }
    }
  }

  // 11. Titular Profesional
  if (!headline) {
    const headlineMatch = text.match(
      /\b(?:titular|headline|job\s+objective|career\s+objective|objective|perfil\s+profesional|target\s+role)\b\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s/&.-]{4,70})(?=\n|$)/i
    );
    if (headlineMatch && !ignoredKeywords.test(headlineMatch[1])) {
      headline = headlineMatch[1].replace(/^[^\w\d]+|[^\w\d]+$/g, '').trim();
    }
  }

  // 12. Resumen o Perfil Profesional (Con o Sin Encabezado Explícito)
  let summary = '';
  const labeledSummaryMatch = text.match(
    /(?:perfil\s+profesional|resumen|perfil\s+laboral|personal\s+summary|profile|summary|acerca\s+de\s+m[ií]|about\s+me|objective|job\s+objective)\s*[:#.-]?\s*\n?([\s\S]{20,600}?)(?=\n\s*(?:experiencia|experience|work\s+experience|educaci[oó]n|education|habilidades|skills|highlights|idiomas|languages|certificaciones|certifications|referencias)|$)/i
  );
  if (labeledSummaryMatch) {
    summary = labeledSummaryMatch[1].trim().replace(/\s+/g, ' ');
  } else {
    // Si no hay etiqueta explicita, buscar un parrafo descriptivo en las primeras 15 lineas
    for (let i = 1; i < Math.min(15, lines.length); i++) {
      const line = lines[i].trim();
      if (
        line !== headline &&
        line.length >= 50 &&
        line.length <= 600 &&
        !line.includes('@') &&
        !line.includes('http') &&
        !/^(?:c:|p:|phone|tel|cel|cc|cedula|ciudad|email)/i.test(line) &&
        !/^(?:•|-|\*)/.test(line) &&
        !/\b(19\d\d|20\d\d)\s*(?:[-–—a]|to)\s*(?:19\d\d|20\d\d|presente|actualidad)/i.test(line) &&
        /\b(?:experiencia|profesional|años|trayectoria|especialista|especializad[oa]|liderando|enfocado|conocimientos|habilidades|capacidad|gestión|desarrollo|sector|responsable|orientado|apasionado|diseñador|creativo|experto|experta|productor|desarrollador|administrador|ingeniero|técnico|tecnólogo|experienced|professional|years|skilled)\b/i.test(
          line
        )
      ) {
        summary = line.replace(/\s+/g, ' ');
        break;
      }
    }
  }

  // 13. Extracción de Educación
  const education = extractEducationUniversal(text);

  // 14. Extracción de Experiencia Laboral
  const experience = extractExperienceUniversal(text);

  // 15. Extracción de Habilidades (Taxonomía)
  const skillsData = extractSkillsFromText(text);
  const skills = skillsData.map((s) => ({
    category: s.category,
    skillName: s.skillName,
    level: 'Intermedio',
  }));

  // 16. Extracción de Idiomas
  const languages = extractLanguageCircleIcon(text);

  // 17. Extracción de Certificaciones y Cursos
  const certifications = extractCertifications(text);

  // 18. Extracción de Referencias
  const references = extractReferencesUniversal(text);

  return {
    firstNames,
    lastNames,
    documentType,
    documentNumber,
    birthDate,
    birthPlace,
    nationality,
    cityResidence,
    maritalStatus,
    gender,
    phone,
    email,
    headline,
    summary,
    salaryExpectation,
    availability,
    driverLicense,
    militaryCard,
    professionalCard,
    socialLinks: socialLinks.length > 0 ? socialLinks : undefined,
    status: 'nuevo',
    education,
    experience,
    skills,
    languages: languages.length > 0 ? languages : undefined,
    certifications: certifications.length > 0 ? certifications : undefined,
    references,
  };
}

function extractLocation(text: string): string {
  // 1. Si hay etiqueta explicita de ciudad o direccion (excluyendo "direccion de arte/general/financiera")
  const labeledCityMatch = text.match(
    /\b(?:ciudad|city|location|ubicaci[oó]n|address|direcci[oó]n(?!\s+de\s+(?:arte|cine|fotograf[ií]a|proyectos|ventas|comercial|general|financiera|administraci[oó]n))|domicilio|residencia)\b\s*[:#.-]?\s*([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s,.-]+?)(?=\n|[|•*+]|$)/i
  );
  if (labeledCityMatch && labeledCityMatch[1].trim().length > 3) {
    return labeledCityMatch[1].trim();
  }

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 15);

  const cityOrStatePattern =
    /\b(Bogot[aá]|Medell[ií]n|Cali|Barranquilla|Bucaramanga|Cartagena|Pamplona|C[uú]cuta|Pereira|Manizales|Chennai|Mumbai|Delhi|London|Madrid|Barcelona|Buenos\s+Aires|Lima|Santiago|Ciudad\s+de\s+M[eé]xico|Honolulu|Pittsburgh|Springfield|Phoenix|Los\s+Angeles|New\s+Cityland|Philadelphia|New\s+York|San\s+Francisco|Chicago|Miami|Austin|Seattle|Boston|Tennessee|California|Texas|Florida|Hawaii|Pennsylvania|Arizona|Michigan|Norte de Santander|Santander|Antioquia|Cundinamarca|Valle|Risaralda)\b/i;

  const stateAbbrPattern = /\b[A-Z][a-zA-Z\s.-]+,\s*[A-Z]{2}(?:\s+\d{5})?\b/;
  const internationalCityStatePattern = /\b[A-Z][a-zA-Z\s.-]+,\s*(?:[A-Z]{2}|[A-Z][a-z]+)\b/;

  for (const line of lines) {
    if (line.includes('@') && !line.includes('Street') && !line.includes('Road') && !line.includes('Ave') && !line.includes('Drive')) {
      const parts = line.split(/[|•*+]/);
      for (const p of parts) {
        if (!p.includes('@') && (cityOrStatePattern.test(p) || stateAbbrPattern.test(p) || internationalCityStatePattern.test(p))) {
          return p.replace(/\s*[+4]\s*(?:Phone|Tel|Mobile|C:|P:).*$/i, '').trim();
        }
      }
      continue;
    }

    if (/^(?:c:|p:|phone|tel|mobile|\(\+\d|\+1|\+57|\b\d{10}\b)/i.test(line)) continue;
    if (/^(?:summary|experience|education|objective|perfil|experiencia|educacion|highlights)/i.test(line)) break;

    if (cityOrStatePattern.test(line) || stateAbbrPattern.test(line) || internationalCityStatePattern.test(line)) {
      const cleaned = line
        .split(/[|•*+]/)[0]
        .replace(/\s*[+4]\s*(?:Phone|Tel|Mobile|C:|P:).*$/i, '')
        .trim();
      if (cleaned.length > 2) {
        return cleaned;
      }
    }
  }

  return '';
}

function extractLanguageCircleIcon(text: string): LanguageItem[] {
  const items: LanguageItem[] = [];
  const langKeywords = [
    'Español',
    'Inglés',
    'Ingles',
    'Francés',
    'Frances',
    'Alemán',
    'Aleman',
    'Portugués',
    'Portugues',
    'Italiano',
    'Mandarín',
    'Mandarin',
    'Ruso',
    'Japonés',
    'Japones',
  ];

  const langSectionMatch = text.match(
    /(?:idiomas|languages)\s*[:#.-]?\s*\n([\s\S]*?)(?=\n\s*(?:experiencia|experience|educaci[oó]n|education|habilidades|skills|certificaciones|referencias)|$)/i
  );

  const scopeText = langSectionMatch ? langSectionMatch[1] : text;
  const levelRegex = /\b(Nativo|Native|Avanzado|Advanced|Intermedio|Intermediate|B[aá]sico|Basic|C2|C1|B2|B1|A2|A1|Bilingüe|Bilingual)\b/i;

  for (const lang of langKeywords) {
    const langRegex = new RegExp(`\\b${lang}\\b\\s*[:#.-]?\\s*(?:-\\s*)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\\s()]+)?`, 'i');
    const match = scopeText.match(langRegex);

    if (match) {
      const canonicalName = lang
        .replace('Ingles', 'Inglés')
        .replace('Frances', 'Francés')
        .replace('Aleman', 'Alemán')
        .replace('Portugues', 'Portugués');
      let level = 'Intermedio';

      if (match[1]) {
        const lvlMatch = match[1].match(levelRegex);
        if (lvlMatch) {
          level = lvlMatch[1].trim();
        }
      }

      if (!items.some((i) => i.language.toLowerCase() === canonicalName.toLowerCase())) {
        items.push({ language: canonicalName, level });
      }
    }
  }

  return items;
}

function extractCertifications(text: string): CertificationItem[] {
  const items: CertificationItem[] = [];
  const certSectionMatch = text.match(
    /(?:certificaciones|certificados|cursos|diplomados|capacitaciones|talleres|certifications|courses)\s*[:#.-]?\s*\n([\s\S]*?)(?=\n\s*(?:experiencia|experience|educaci[oó]n|education|habilidades|skills|idiomas|referencias)|$)/i
  );

  const lines = (certSectionMatch ? certSectionMatch[1] : text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  for (const line of lines) {
    if (line.length < 5 || /^(certificaciones|cursos|diplomados|certificaciones\s+y\s+cursos)$/i.test(line)) continue;

    const isCertLine =
      certSectionMatch ||
      /\b(diplomado|certificaci[oó]n|certificado|curso\s+de|scrum\s+master|aws\s+certified|seminario|taller)\b/i.test(
        line
      );

    if (!isCertLine) continue;

    const yearMatch = line.match(/\b(20\d\d|19\d\d)\b/);
    const cleanedLine = line.replace(/^[•*\s-]+/, '').trim();

    let name = cleanedLine;
    let institution = '';

    if (cleanedLine.includes(' - ')) {
      const parts = cleanedLine.split(' - ');
      name = parts[0].trim();
      institution = parts.slice(1).join(' - ').replace(/\b(20\d\d|19\d\d)\b/g, '').trim();
    } else if (cleanedLine.includes('(')) {
      const parts = cleanedLine.split('(');
      name = parts[0].trim();
      institution = parts[1].replace(/[)]/g, '').replace(/\b(20\d\d|19\d\d)\b/g, '').trim();
    }

    items.push({
      name: name.replace(/\b(20\d\d|19\d\d)\b/g, '').trim(),
      institution: institution || undefined,
      year: yearMatch ? yearMatch[1] : undefined,
    });
  }

  return items;
}

function extractEducationUniversal(text: string): EducationItem[] {
  const items: EducationItem[] = [];
  const eduSectionMatch = text.match(
    /(?:educaci[oó]n|formaci[oó]n\s+acad[eé]mica|educaci[oó]n\s+superior|estudios|education|academic\s+background)\s*[:#.-]?\s*\n([\s\S]*?)(?=\n\s*(?:experiencia|experience|habilidades|skills|referencias|references|languages|idiomas|certificaciones|certifications)|$)/i
  );

  const sectionText = eduSectionMatch ? eduSectionMatch[1] : text;
  const lines = sectionText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  const degreeKeywords =
    /\b(?:ingenier[ií]a|licenciatura|grado|m[aá]ster|maestr[ií]a|tecn[oó]log[oía]|t[eé]cnic[oía]|bachiller|primaria|doctorado|phd|diplomado|curso|bachelor|master|degree|high\s+school|university|college|diploma|bs|ba|ms|mba|especialista|especializaci[oó]n|psicolog[ií]a|administraci[oó]n|contadur[ií]a|derecho|medicina|enfermer[ií]a|arquitectura|comunicaci[oó]n|econom[ií]a|diseñador|diseño|universitari[oa]|posgrado)\b/i;

  const isInstitutionRegex =
    /\b(?:universidad|university|colegio|instituto|institute|sena|escuela|school|academy|college|faculty|departamento|department)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Evitar falsos positivos de líneas de código o habilidades técnicas en educación
    if (/[<>{}]|spring|hibernate|websphere|javascript|python|sql\b/i.test(line)) continue;

    if (degreeKeywords.test(line) || isInstitutionRegex.test(line) || /^•?\s*(?:Posgrado|Universitario|Tecnico|Tecnólogo|Bachiller)\s*:/i.test(line)) {
      const yearMatch = line.match(/\b(19\d\d|20\d\d)\b/);
      let institution = '';
      let degree = '';

      if (isInstitutionRegex.test(line)) {
        if (degreeKeywords.test(line)) {
          // Ambos en la misma línea: "Universidad Santo Tomás - Psicología" o "• Universitario: Psicología - Universidad Nacional"
          const levelPrefixRegex = /^(?:Posgrado|Universitario|Tecnico|Tecn[oó]logo|Bachiller|Pregrado|Doctorado|Maestr[ií]a|Especializaci[oó]n)$/i;
          const parts = line.split(/[-–—|•:]/).map((p) => p.trim()).filter(Boolean);
          const instPart = parts.find((p) => isInstitutionRegex.test(p));
          const degPart =
            parts.find((p) => degreeKeywords.test(p) && !isInstitutionRegex.test(p) && !levelPrefixRegex.test(p)) ||
            parts.find((p) => !isInstitutionRegex.test(p) && !levelPrefixRegex.test(p)) ||
            parts.find((p) => degreeKeywords.test(p) && !isInstitutionRegex.test(p));

          institution = (instPart || line).replace(/^[•*\s-]+/, '').replace(/\b(19\d\d|20\d\d)\b/g, '').trim();
          degree = (degPart || line).replace(/^[•*\s-]+/, '').replace(/\b(19\d\d|20\d\d)\b/g, '').trim();
        } else {
          institution = line.replace(/^[•*\s-]+/, '').replace(/\b(19\d\d|20\d\d)\b/g, '').trim();

          // Buscar el grado en líneas adyacentes si no son instituciones
          if (i > 0 && degreeKeywords.test(lines[i - 1]) && !isInstitutionRegex.test(lines[i - 1])) {
            degree = lines[i - 1].replace(/^[•*\s-]+/, '').replace(/\b(19\d\d|20\d\d)\b/g, '').trim();
          } else if (i + 1 < lines.length && degreeKeywords.test(lines[i + 1]) && !isInstitutionRegex.test(lines[i + 1])) {
            degree = lines[i + 1].replace(/^[•*\s-]+/, '').replace(/\b(19\d\d|20\d\d)\b/g, '').trim();
          } else {
            if (/high\s+school|colegio|bachiller/i.test(line)) degree = 'Bachiller Académico';
            else if (/sena|instituto|institute|technical/i.test(line)) degree = 'Estudios Técnicos / Tecnológicos';
            else if (/universidad|university|college|faculty/i.test(line)) degree = 'Educación Superior';
            else degree = institution;
          }
        }
      } else {
        degree = line.replace(/^[•*\s-]+/, '').replace(/\b(19\d\d|20\d\d)\b/g, '').trim();

        if (i > 0 && isInstitutionRegex.test(lines[i - 1])) {
          institution = lines[i - 1].replace(/^[•*\s-]+/, '').replace(/\b(19\d\d|20\d\d)\b/g, '').trim();
        } else if (i + 1 < lines.length && isInstitutionRegex.test(lines[i + 1])) {
          institution = lines[i + 1].replace(/^[•*\s-]+/, '').replace(/\b(19\d\d|20\d\d)\b/g, '').trim();
        }
      }

      let level = 'Universitario';
      if (/high\s+school|bachiller/i.test(line) || /high\s+school|bachiller/i.test(degree)) level = 'Bachiller';
      else if (/t[eé]cnic|technical/i.test(line) || /t[eé]cnic|technical/i.test(degree)) level = 'Tecnico';
      else if (/tecn[oó]log/i.test(line) || /tecn[oó]log/i.test(degree)) level = 'Tecnologo';
      else if (/posgrado|m[aá]ster|maestr[ií]a|master|mba|doctorado|phd|especializ/i.test(line) || /posgrado|m[aá]ster|maestr[ií]a|master|mba|doctorado|phd|especializ/i.test(degree)) level = 'Posgrado';
      else if (/diplomado|certificate|diploma/i.test(line) || /diplomado|certificate|diploma/i.test(degree)) level = 'Diplomado';

      // Evitar duplicados exactos
      const isDuplicate = items.some(
        (existing) =>
          existing.degree.toLowerCase() === degree.toLowerCase() &&
          existing.institution.toLowerCase() === institution.toLowerCase()
      );

      if (!isDuplicate && (degree.length > 2 || institution.length > 2)) {
        items.push({
          level,
          institution,
          degree: degree || institution,
          endYear: yearMatch ? yearMatch[1] : undefined,
        });
      }
    }
  }

  return items;
}

function extractExperienceUniversal(text: string): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  const expSectionMatch = text.match(
    /(?:experiencia\s+laboral|experiencia\s+profesional|work\s+experience|experience|employment\s+history|trayectoria\s+laboral)\s*[:#.-]?\s*\n([\s\S]*?)(?=\n\s*(?:educaci[oó]n|education|habilidades|skills|referencias|references|languages|idiomas|certificaciones|certifications)|$)/i
  );

  const sectionText = expSectionMatch ? expSectionMatch[1] : text;
  const lines = sectionText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  const monthNames =
    '(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre|Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
  const dateRangeRegex = new RegExp(
    `(?:(?:${monthNames}\\s+)?(\\d{1,2}[/-])?(20\\d\\d|19\\d\\d|\\d{2}))\\s*(?:[-–—a]|to|hasta)\\s*(?:(?:${monthNames}\\s+)?(\\d{1,2}[/-])?(20\\d\\d|19\\d\\d|\\d{2})|presente|actualidad|actual|present|current)`,
    'i'
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(dateRangeRegex);
    if (match) {
      const isCurrent = /presente|actualidad|actual|present|current/i.test(line);
      const startYear = match[2];
      const endYear = match[4] || (isCurrent ? 'Actual' : undefined);

      let company = '';
      let position = '';

      if (i > 0) {
        position = lines[i - 1];
      }
      if (i > 1 && !dateRangeRegex.test(lines[i - 2])) {
        company = lines[i - 2];
      }

      const responsibilitiesList: string[] = [];
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (dateRangeRegex.test(lines[j]) || lines[j].length > 200) break;
        responsibilitiesList.push(lines[j]);
      }

      items.push({
        company,
        position,
        startDate: startYear,
        endDate: endYear,
        isCurrent,
        responsibilities: responsibilitiesList.join(' '),
      });
    }
  }

  if (items.length === 0) {
    if (/(?:sin\s+experiencia|no\s+tengo\s+experiencia|reci[eé]n\s+egresad[oa]|primera\s+oportunidad\s+laboral|pr[aá]ctica\s+(?:empresarial|sena))/i.test(text)) {
      items.push({
        company: 'Sin Experiencia / Perfil Junior',
        position: 'Candidato Junior',
        responsibilities: 'El candidato indica en su hoja de vida no contar con experiencia laboral formal previa o menciona únicamente experiencia de prácticas (SENA/universitarias).'
      });
    } else if (expSectionMatch) {
      // Fallback: Se encontró la sección pero no fechas puras (probablemente ruido OCR)
      // Recogemos todo lo que parezca descriptivo (viñetas)
      const responsibilitiesList: string[] = [];
      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        if (/^[•*\-+]/.test(lines[i])) responsibilitiesList.push(lines[i].replace(/^[•*\-+]\s*/, ''));
      }
      if (responsibilitiesList.length > 0 || lines.length > 0) {
        items.push({
          company: 'Experiencia Registrada',
          position: 'Ver descripción',
          responsibilities: responsibilitiesList.length > 0 ? responsibilitiesList.join('. ') : lines.slice(0, 5).join('. ')
        });
      }
    }
  }

  return items;
}

function extractReferencesUniversal(text: string): ReferenceItem[] {
  const items: ReferenceItem[] = [];
  const refSectionMatch = text.match(
    /(?:referencias|referencias\s+personales|referencias\s+familiares|referencias\s+laborales|references|personal\s+references)\s*[:#.-]?\s*\n([\s\S]*?)$/i
  );

  const sectionText = refSectionMatch ? refSectionMatch[1] : text;
  const lines = sectionText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isRefSection = !!refSectionMatch;
    const isRefLine = isRefSection || /referencia/i.test(line);

    if (!isRefLine) continue;

    const phoneMatch = line.match(
      /(?:phone|tel[eé]fono|celular|cel|tel|tel\.)?\s*[:#.-]?\s*(\+?\d{1,3}[\s-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\b3\d{9}\b|\b\d{7,10}\b)/i
    );
    if (phoneMatch) {
      let name = '';
      if (i > 0 && /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s.-]+$/.test(lines[i - 1])) {
        name = lines[i - 1];
      } else if (line.includes(':')) {
        name = line.split(':')[0].replace(/referencia\s*(?:laboral|personal|familiar)?/i, '').trim();
      }

      let referenceType: 'familiar' | 'personal' | 'laboral' = 'personal';
      if (/familiar/i.test(line) || /familiar/i.test(sectionText)) referenceType = 'familiar';
      if (/laboral|jefe|empresa|supervisor/i.test(line) || /laboral/i.test(sectionText)) referenceType = 'laboral';

      items.push({
        referenceType,
        name: name || 'Referencia',
        phone: phoneMatch[1],
      });
    }
  }

  return items;
}
