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

  // Limpiar bloques de identificación documental (C.C., C.C, CC, C. C., NIT, Cédula)
  // para que la letra 'C' de 'C.C.' no se interprete erróneamente como lenguaje de programación.
  const textoSinDocIds = text
    .replace(/(?:\bcc\b|c(?:\s*\.)?\s*c(?:\s*\.)?|c\s*\/\s*c|cedula|documento(?:\s+de\s+(?:identidad|identificacion))?|identificacion|nit)\s*[:.-]?\s*(?:no\.?|n[ºo])?\s*[:.-]?\s*[\d.\s-]{5,}/gi, ' ')
    .replace(/c\s*\.\s*c(?:\s*\.)?/gi, ' ')
    .replace(/\b(?:cc|c\.c\.|c\.c)\b/gi, ' ');

  for (const cat of SKILLS_TAXONOMY) {
    for (const skill of cat.skills) {
      if (skill === 'C') {
        // 'C' como lenguaje de programación debe ser mayúscula, no venir de C.C./CC ni de bloques de ID,
        // ni estar pegado a puntos o caracteres de numeración/abreviatura
        const regexC = /(?:^|[^a-zA-Z0-9.#+])C(?=[^a-zA-Z0-9.#+]|$)/;
        if (regexC.test(textoSinDocIds)) {
          const key = skill.toLowerCase();
          if (!added.has(key)) {
            added.add(key);
            found.push({ category: cat.category, skillName: skill });
          }
        }
        continue;
      }

      // Usar limites de palabra escapados para evitar falsos positivos
      const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}(?=[^a-zA-Z0-9]|$)`, 'i');
      if (regex.test(text)) {
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
  }

  return found;
}
