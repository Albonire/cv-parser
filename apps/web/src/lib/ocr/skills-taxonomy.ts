import { normalize } from './text-utils';

export interface SkillTaxonomyCategory {
  category: string;
  skills: string[];
}

export const SKILLS_TAXONOMY: SkillTaxonomyCategory[] = [
  {
    category: 'Lenguajes de Programación',
    skills: [
      'Python', 'JavaScript', 'TypeScript', 'Java', 'C#', 'C++', 'C', 'PHP',
      'Ruby', 'Go', 'Golang', 'Rust', 'Kotlin', 'Swift', 'Dart', 'R',
      'Scala', 'Perl', 'Bash', 'Shell', 'PowerShell', 'SQL', 'HTML', 'HTML5', 'CSS', 'CSS3', 'Sass', 'Less'
    ]
  },
  {
    category: 'Frameworks y Librerías Frontend',
    skills: [
      'React', 'React.js', 'Next.js', 'Vue', 'Vue.js', 'Nuxt.js', 'Angular',
      'Svelte', 'Tailwind CSS', 'Tailwind', 'Bootstrap', 'Material-UI', 'MUI',
      'Redux', 'Zustand', 'React Query', 'Webpack', 'Vite', 'jQuery'
    ]
  },
  {
    category: 'Backend y Frameworks',
    skills: [
      'Node.js', 'Express', 'Express.js', 'NestJS', 'FastAPI', 'Django',
      'Flask', 'Spring Boot', 'Spring', '.NET', '.NET Core', 'ASP.NET',
      'Laravel', 'Symfony', 'Ruby on Rails', 'GraphQL', 'REST API', 'gRPC'
    ]
  },
  {
    category: 'Bases de Datos',
    skills: [
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'MariaDB',
      'Oracle', 'SQL Server', 'Microsoft SQL Server', 'Cassandra', 'Elasticsearch',
      'DynamoDB', 'Supabase', 'Firebase', 'Firestore', 'Prisma', 'TypeORM', 'Sequelize'
    ]
  },
  {
    category: 'Cloud, DevOps e Infraestructura',
    skills: [
      'AWS', 'Amazon Web Services', 'Azure', 'Google Cloud', 'GCP', 'Docker',
      'Kubernetes', 'K8s', 'CI/CD', 'GitHub Actions', 'GitLab CI', 'Jenkins',
      'Terraform', 'Ansible', 'Linux', 'Ubuntu', 'Debian', 'Nginx', 'Apache', 'Microservicios'
    ]
  },
  {
    category: 'Ciencia de Datos e Inteligencia Artificial',
    skills: [
      'Pandas', 'NumPy', 'Scikit-Learn', 'TensorFlow', 'PyTorch', 'Keras',
      'OpenCV', 'NLTK', 'spaCy', 'Power BI', 'Tableau', 'Excel Avanzado',
      'Machine Learning', 'Deep Learning', 'Data Mining', 'Big Data', 'Hadoop', 'Spark'
    ]
  },
  {
    category: 'Herramientas y Metodologías',
    skills: [
      'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Trello', 'Confluence',
      'Scrum', 'Agile', 'Kanban', 'Postman', 'Figma', 'Adobe XD', 'Photoshop',
      'Illustrator', 'Testing', 'Jest', 'Cypress', 'Playwright', 'Vitest'
    ]
  },
  {
    category: 'Habilidades Administrativas y Contables',
    skills: [
      'Contabilidad General', 'Facturación Electrónica', 'Nómina', 'Seguridad Social',
      'Liquidación de Prestaciones', 'Atención al Cliente', 'Gestión Documental',
      'Archivo', 'Inventarios', 'Presupuestos', 'Compras', 'Auditoría', 'SIIGO', 'Helisa', 'SAP'
    ]
  },
  {
    category: 'Habilidades Blandas y Competencias',
    skills: [
      'Liderazgo', 'Trabajo en Equipo', 'Comunicación Asertiva', 'Resolución de Conflictos',
      'Pensamiento Crítico', 'Adaptabilidad', 'Gestión del Tiempo', 'Orientación a Resultados',
      'Proactividad', 'Negociación', 'Toma de Decisiones', 'Empatía', 'Puntualidad'
    ]
  }
];

export function extractSkillsFromText(text: string): { category: string; skillName: string }[] {
  const found: { category: string; skillName: string }[] = [];
  const added = new Set<string>();

  // La comparacion va SIN TILDES. La taxonomia las lleva ("Gestión Documental")
  // y el OCR de un escaneo degradado las pierde con toda naturalidad, asi que
  // comparar literalmente hacia depender el campo de que la tilde sobreviviera.
  // Es el mismo `normalize()` con el que el resto del proyecto compara texto.
  const textoNormalizado = normalize(text);

  const hayContextoProgramacion =
    /\b(?:lenguajes?\s+de\s+programaci[oó]n|programaci[oó]n|programming|dev|desarroll[oó]r?|developer|software|c[oó]digo|code|computaci[oó]n|inform[aá]tica|systems?|ingenier[oa]\s+de\s+software)\b/i.test(
      text
    );

  for (const cat of SKILLS_TAXONOMY) {
    for (const skill of cat.skills) {
      // Usar limites de palabra escapados para evitar falsos positivos
      const escaped = normalize(skill).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}(?=[^a-zA-Z0-9]|$)`, 'i');
      if (!regex.test(textoNormalizado)) continue;

      // Lenguajes de una o dos letras ("C", "R", "Go") producen falsos
      // positivos en cualquier documento ("C2", "R&D", "Go"). Solo se aceptan si
      // hay contexto claro de programacion en el texto.
      const esCorto = skill.replace(/\s+/g, '').length <= 2;
      if (esCorto && !hayContextoProgramacion) continue;

      // "Seguridad Social" (y otras habilidades administrativas) suelen colarse
      // desde un encabezado de seccion ("Seguridad Social y Afiliaciones"). Se
      // descarta cuando el texto inmediato anuncia una seccion y no una skill.
      if (/seguridad\s+social/i.test(skill) && /seguridad\s+social\b[^.\n]{0,15}\b(?:y\s+afiliaciones|afiliaciones)\b/i.test(text))
        continue;

      const key = skill.toLowerCase();
      if (!added.has(key)) {
        added.add(key);
        found.push({
          category: cat.category,
          skillName: skill,
        });
      }
    }
  }

  return found;
}
