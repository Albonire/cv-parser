# Arquitectura Técnica — Sistema de Gestión de Talento Humano y Análisis de Hojas de Vida

**Empresa:** Rosimar S.A.S.
**Decisiones clave:** costo mensual **$0** en servidores, OCR **100% en el navegador**, nube + local/offline, stacked sobre servicios gratuitos con vía de escalado sin cambios de código.

---

## 1. Principio arquitectónico: costo $0

El trabajo pesado (OCR, lectura de documentos, preprocesamiento de imágenes) corre en el **navegador del usuario** (WebAssembly), no en servidores. La nube solo guarda datos y archivos mediante servicios con plan gratuito. Esto elimina el costo de cómputo y hace que un hosting estático gratuito sea suficiente.

```
┌──────────────────────────────────────────────────────────────┐
│                       NAVEGADOR (PWA)                        │
│                                                              │
│   [1] Usuario sube: foto / PDF / Word                        │
│        │                                                     │
│        ├─ Imagen ───────────► preprocesado (canvas/OpenCV.js) │
│        ├─ PDF texto ────────► pdf.js (bytes -> texto)        │
│        ├─ PDF escaneado ────► pdf.js (render pág. -> canvas) │
│        └─ DOCX ─────────────► mammoth.js (-> texto)          │
│                                                              │
│   [2] Tesseract.js (WASM, español) — OCR solo cuando hay      │
│       imágenes/escaneos                                      │
│   [3] Parser JS (reglas) — texto -> campos estructurados     │
│   [4] Formulario EDITABLE para revisión humana               │
│   [5] Guardar -> cola offline (IndexedDB) -> Supabase        │
└──────────────────────────────────────────────────────────────┘
                              │ HTTPS / Realtime
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      SUPABASE (plan Free = $0)                │
│  • PostgreSQL (500 MB)  • Auth (roles y RLS)                  │
│  • Storage (1 GB)       • Edge Functions + pg_cron            │
│  • Realtime             └─► Resend (Free) = correos alertas   │
└──────────────────────────────────────────────────────────────┘
                              ▲
                    Hosting estático (Netlify / Cloudflare Pages) = $0
                    (PWA: app shell + archivos estáticos)
```

## 2. Componentes y stack

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| **Frontend (SPA)** | React + Vite + TailwindCSS | Rápido, responsive, ecosistema PWA maduro |
| **PWA / offline** | Vite PWA + IndexedDB (localForage/Dexie) + librería de sincronización | Funciona sin internet y sincroniza (RNF-3) |
| **Gráficos** | Recharts | Dashboards interactivos (M9) |
| **OCR** | Tesseract.js (WASM, `spa+eng`) | OCR en español, 100% en navegador, $0, offline, privado |
| **PDF** | pdf.js | Extracción de palabras con coordenadas y render de páginas escaneadas |
| **Word** | mammoth.js | Conversión `.docx` → texto |
| **Preprocesamiento imagen** | Canvas API | Reescalado a ~300 DPI, grises, binarización de Otsu, corrección de inclinación |
| **Maquetación** | `lib/ocr/layout.ts` | Renglones y columnas a partir de coordenadas; común a PDF, imagen y Word |
| **Segmentación** | `lib/ocr/sections.ts` | Encabezados por léxico ES/EN + señales de formato, tolerante a ruido de OCR |
| **Parser a campos** | `lib/ocr/fields/` | Un extractor por campo; convierte secciones → formularios de la sección 5 |
| **Gazetteer de lugares** | `lib/contexto/lugares.ts` | Municipios y departamentos DANE, para reconocer cualquier ciudad del país |
| **Diccionario configurable** | `lib/contexto/diccionario.ts` | Cargos (familias + sinónimos); carga inicial orientada a servicios administrativos/operativos |
| **Backend / BD** | Supabase (PostgreSQL + Auth + Storage + Edge Functions + pg_cron) | Todo incluido, plan Free generoso, RLS nativo |
| **API de correo** | Resend (plan Free: 3.000 correos/mes) | Alertas automáticas (M8) |
| **Hosting** | Netlify o Cloudflare Pages (Free) | Uso comercial permitido; Vercel Hobby *no* lo permite |
| **Despliegue** | Conectado a GitHub Actions (CI/CD) | Cada push → deploy automático |

> **Por qué no Vercel:** el plan gratuito (Hobby) restringe el uso a proyectos personales/no comerciales. Para una empresa, se recomienda Netlify o Cloudflare Pages, que permiten uso comercial y sirven estáticos con los mismos límites.

## 3. Pipeline del lector (CORE — M3)

El lector es un **pipeline determinista de cuatro etapas**. La clave está en que los cuatro orígenes
(PDF digital, PDF escaneado, imagen y Word) producen la **misma representación intermedia**: palabras
con su caja delimitadora. Así el orden de lectura se reconstruye una sola vez y de la misma forma
para todos.

```
Entrada (foto / PDF / Word)
   │
   ├─ ¿DOCX?   → mammoth.js ──────────────────────────┐
   ├─ ¿PDF con capa de texto? → pdf.js ───────────────┤
   ├─ ¿PDF escaneado? → pdf.js render (~300 DPI) ─┐   │
   └─ ¿Imagen? ───────────────────────────────────┤   │
                                                  ▼   │
                         preprocesado de imagen (lib/ocr/image-prep.ts)
                         reescalado → grises → Otsu → corrección de inclinación
                                                  │   │
                                                  ▼   │
                         Tesseract.js (spa+eng, WASM, cajas de palabra)
                                                  │   │
   [1] EXTRACCIÓN ────────────────────────────────┴───┘
                         → Word[] { texto, x, y, ancho, alto, fuente, confianza }
   │
   ▼
   [2] MAQUETACIÓN (lib/ocr/layout.ts)
       • renglones por solapamiento vertical real de las cajas
       • columnas por canal vertical vacío (perfil de proyección), no por mitad de página
       • bandas separadas por renglones a todo el ancho
       → DocumentLayout { líneas con columna, tamaño de fuente, negrita, mayúsculas }
   │
   ▼
   [3] SECCIONES (lib/ocr/sections.ts)
       léxico de encabezados ES/EN con tolerancia a ruido de OCR
       + señales de formato (negrita, mayúsculas, tamaño, renglón corto)
       → contacto | perfil | experiencia | educación | habilidades | idiomas |
         certificaciones | referencias
   │
   ▼
   [4] EXTRACTORES POR CAMPO (lib/ocr/fields/)
       personal · experience · education · extras · dates · phone
       apoyados en gazetteers (lib/contexto/lugares.ts) y en el
       diccionario configurable de cargos (lib/contexto/diccionario.ts)
       → campos 5.1 (hoja de vida) / 5.2 (contrato) / 5.3 (cédula) / 5.4 (salud)
   │
   ▼
Formulario editable + confianza por campo → revisión humana (RN-7) → confirmar → persistir
```

### 3.0 Por qué la maquetación va antes que el parser

Un CV a dos columnas y un formulario oficial con etiqueta y valor en el mismo renglón exigen
decisiones opuestas: el primero hay que partirlo verticalmente, el segundo no. Partir la página por
la mitad falla en ambos sentidos —manda los títulos cortos de la columna derecha a la izquierda y
separa cada `Cargo:` de su `Empresa:`—, y ningún ajuste del parser lo compensa, porque para cuando
el parser actúa el texto ya perdió el orden.

Por eso la detección de columnas busca un **canal vertical vacío continuo** (mínimo 3% del ancho de
página, con renglones suficientes a ambos lados). Un formulario de una sola columna no tiene ese
canal, y una columna de fechas alineada a la derecha no aporta renglones suficientes.

### 3.0.1 Banco de precisión

`apps/web/src/lib/ocr/reader-accuracy.test.ts` corre el **pipeline real** sobre los 10 PDF de
`apps/web/test-pdfs/` y compara 165 campos contra la verdad de referencia de
`src/lib/ocr/__fixtures__/ground-truth.json`. Imprime una tabla por documento y guarda
`eval-report.json`. El umbral se ajusta con `CV_EVAL_THRESHOLD`.

Es la salvaguarda contra el error que tenía el proyecto: las pruebas anteriores extraían el texto en
el orden crudo del PDF, un orden que el parser nunca recibe en producción, así que pasaban en verde
mientras el lector fallaba con esos mismos archivos.

Detalles de precisión:
- Las fotos/escaneos limpios e impresos tienen **buena precisión** con Tesseract (`spa`).
- **Letra manuscrita**: precisión menor; el flujo de edición/revisión manual la cubre (RN-7).
- El motor de OCR (worker, núcleo WebAssembly y modelos `spa`/`eng`) se sirve **desde la propia aplicación**, no desde un CDN: el lector funciona sin conexión y en redes que bloqueen CDNs externos. La primera lectura descarga ~10 MB y el service worker los conserva en caché.
- Procesamiento en **Web Worker** (no congela la interfaz); cola de 2–4 workers para lotes.

### 3.1 Detección de cargos (F1)

Tras el parseo, el módulo de **detección de cargos** (`lib/ocr/cargos.ts`) cruza la experiencia extraída con el **diccionario configurable** (`lib/contexto/diccionario.ts`):

- Normaliza sinónimos (p. ej., "asesor comercial" y "agente de ventas" → familia "ventas") mediante el diccionario de familias y sinónimos.
- Entrega el **cargo principal** (el de la experiencia más reciente) y la **lista de todos los cargos** detectados/normalizados.
- El diccionario es editable por entorno de empresa sin reescribir el parser (carga inicial: servicios administrativos/operativos).

### 3.2 Filtros de búsqueda en sesión (F1)

Los CV **extraídos y confirmados** (RN-7) se acumulan en una **bandeja de sesión** en memoria (sin persistencia; la nube llega en F2 con Supabase). Un **panel de filtros** permite depurar esa bandeja por:

- Cargo detectado (familia/término del diccionario).
- Ciudad, habilidad, idioma, nivel educativo y estado civil.

Esta bandeja es la **vista previa** de la búsqueda y el `matching` de M4: el cargo principal normalizado y las habilidades/idiomas extraídos son la base de la coincidencia candidato↔vacante en fases posteriores.

## 4. Modelo de datos (PostgreSQL — Supabase)

Tablas principales y sus relaciones:

```
auth.users (Supabase Auth)
   └─ profiles           (rol: admin | rrhh | reclutador | consulta)

employers                (config global: Rosimar S.A.S., NIT, datos, logo, preaviso, periodo de prueba)

candidates
   ├─ candidate_education
   ├─ candidate_experience
   ├─ candidate_skills
   ├─ candidate_references   (familiares)      ── tipo: familiar | personal
   ├─ candidate_documents    (archivos en Storage)
   └─ candidate_notes

vacancies
   └─ vacancy_requirements   (habilidad, peso por requisito)
   └─ candidate_rankings     (resultado matching + calificación humana)

employees                  (estado: activo | inactivo; fecha_ingreso, fecha_salida, razon_salida)
   ├─ employee_health       (EPS, ARL, fondo de pensiones, caja de compensación, adjuntos)
   └─ employee_photo

contracts                  (todos los campos 5.2; estado; relación con employee)
   └─ contract_renewals    (prórrogas/renovaciones históricas)

memoranda                  (employee_id, tipo, asunto, descripcion, fecha, responsable, adjunto)

alerts                     (tipo, employee_id, severidad, estado: pendiente|vista|resuelta, fecha)

audit_log                  (usuario, tabla, acción, timestamp, detalle)
```

- **RLS (Row Level Security)** en todas las tablas para respetar roles (M1/M13).
- Migraciones SQL versionadas en `supabase/migrations/`.
- BD de 500 MB (plan Free) alcanza con holgura para texto estructurado de 1.000+ personas.

## 5. Estrategia local / offline (RNF-3)

1. La **PWA se instala** y su app shell queda cacheada (funciona sin internet).
2. Los registros recientes y el trabajo intermedio se guardan en **IndexedDB** (Dexie).
3. Toda escritura pasa por una **cola de sincronización**; cuando hay conexión se envía a Supabase (con reintentos y resolución de conflictos básica: última escritura gana para campos simples, bloqueo de concurrencia para lotes).
4. El **OCR siempre corre local**: incluso sin conexión se puede leer y extraer documentos.
5. Al reconectarse, la cola se vacía y el centro de alertas se actualiza vía **Realtime**.

## 6. Alertas automáticas (M8)

```
pg_cron (cada 24 h, dentro de Supabase)
   → query: contratos por vencer (>= preaviso), vencidos, fin periodo de prueba,
            empleados con 3 memorandos, cumpleaños
   → generador de `alerts`
   → Edge Function llama a Resend (SMTP/API) → correo a destinatarios (M2)
   → Realtime actualiza el centro de alertas del sistema en vivo
```

## 7. Hosting gratis: límites y mitigaciones (2026)

| Recurso (Supabase Free) | Límite | Mitigación en el proyecto |
|---|---|---|
| Base de datos | 500 MB | Texto estructurado ocupa pocos MB; no guardar binarios grandes en BD |
| Almacenamiento de archivos | 1 GB | Comprimir escaneos en el navegador (≈200–400 KB c/u → 1.000 CVs ≈ 300–400 MB); opcional conservar originales de forma selectiva |
| Egress | 5 GB/mes | App estática en CDN (Netlify/Cloudflare); los PDFs generados se bajan bajo demanda |
| Usuarios | 50.000 MAU/mes | Sobrado para RRHH interno |
| **Pausa por inactividad** | Tras 1 semana sin uso | Ping automático cada 5 min (monitor gratuito tipo UptimeRobot) a una Edge Function de "wake"; reactivación manual documentada |
| Backups | No incluidos en Free | Exportación SQL periódica vía Edge Function programada a Storage + copia local |

| Recurso (Hosting estático) | Límite | Uso |
|---|---|---|
| Netlify Free | 100 GB transferencia, builds | Sobrado para uso interno |
| Cloudflare Pages Free | builds ilimitados, CDN global | Igual de válido |

| Recurso (Resend Free) | Límite | Uso |
|---|---|---|
| Envíos | 100/día · 3.000/mes | Alertas internas (cubre cientos de correos al mes) |

**Escalado futuro sin tocar código:** si se agotan límites → Supabase Pro (~US$25/mes) sube BD a 8 GB, Storage a 100 GB, backups de 7 días y elimina el auto-pause.

## 8. Seguridad y privacidad

- **HTTPS** en todo el tráfico (CDN/hosting + Supabase).
- **Autenticación** con Supabase Auth (JWT) + roles en `profiles` + políticas **RLS** por tabla.
- **No se suben documentos a servidores para OCR** — los documentos se procesan localmente; a la nube solo llega lo que el usuario confirma (menos exposición de datos personales).
- Cumplimiento **Ley 1581/2012 / habeas data**: consentimiento registrado, auditoría de accesos y borrado lógico.
- **Secretos** (claves de Supabase, clave de Resend) solo en variables de entorno del hosting; `.env*` excluidos de git.

## 9. Backups y recuperación

- **Backups de BD:** Edge Function programada ejecuta exportación (`pg_dump`/SQL) → se almacena en el bucket privado de Storage; retención configurable (mantener últimas N copias). Copia local descargable (manual).
- **Backups de archivos:** los originales ya viven en Storage; se recomienda exportar el bucket a un destino local/corporativo periódicamente.
- **Restauración:** guía documentada (restaurar SQL y re-subir Storage) para el equipo IT.

## 10. Estructura del repositorio (monorepo)

```
cv-parser/
├── README.md                  ← índice del proyecto
├── .gitignore
├── docs/
│   ├── REQUERIMIENTOS.md      ← requerimientos funcionales y de datos
│   └── ARQUITECTURA.md        ← este documento
├── apps/
│   └── web/                   ← aplicación PWA (React + Vite)
│       ├── src/
│       │   ├── app/           (rutas y layout)
│       │   ├── features/      (candidatos, empleados, contratos, memorandos,
│       │   │                   vacantes, alertas, reportes, dashboard)
│       │   ├── lib/ocr/       (pipeline lector: tesseract, pdf, docx, parser, cargos)
│       │   ├── lib/contexto/  (diccionario configurable: cargos, habilidades, secciones)
│       │   ├── lib/sesion/    (bandeja de CVs en memoria + filtros de búsqueda)
│       │   ├── lib/offline/   (IndexedDB, cola de sincronización)
│       │   ├── lib/api/       (cliente Supabase)
│       │   └── components/
│       └── public/
├── supabase/
│   ├── migrations/            (esquema SQL versionado)
│   └── config.toml
├── functions/                 (Edge Functions: alertas, backups, wake)
├── e2e/                       (pruebas: muestras de CV/contrato/escaneo)
└── .github/workflows/         (CI/CD: build + deploy Netlify/Cloudflare)
```

## 11. Roadmap de implementación

| Fase | Entregable | Estado |
|---|---|---|
| **F0 — Base** | Repo en GitHub, docs (requerimientos/arquitectura), git config | ✅ Hecho |
| **F1 — Lector (CORE)** | Prototipo del lector (foto/PDF/Word → formulario editable), **detección de cargos** (cargo principal + lista, diccionario configurable) y **filtros de búsqueda en sesión**; validación con CV reales de Rosimar | **En curso** |
| **F2 — Nube** | Supabase (auth, roles, RLS, storage), persistencia de candidatos, deploy estático, PWA offline/sync | Pendiente |
| **F3 — Empleados y contratos** | Conversión candidato→empleado, ingreso/salida + razón, contratos (todos los campos), EPS/salud | Pendiente |
| **F4 — Memorandos y alertas** | Memorandos + contador 3, flujo manual revisión/cancelación, alertas sistema+correo, cron | Pendiente |
| **F5 — Analítica** | Vacantes/matching, dashboard, reportes PDF/Excel, backups automáticos | Pendiente |
| **F6 — Cierre** | Seguridad y auditoría, pruebas con datos reales, manuales (IT y RRHH), despliegue final | Pendiente |

## 12. Despliegue (pasos de alto nivel)

1. `git push` del repositorio a GitHub (`Albonire/cv-parser`).
2. Crear proyecto Supabase (Free) → aplicar migraciones → configurar Auth (correo) → crear primer admin.
3. Crear proyecto en Netlify o Cloudflare Pages conectado al repo → build `apps/web` → domain + HTTPS.
4. Configurar variables de entorno (URL/anon key de Supabase, clave Resend) en el hosting.
5. Configurar el cron/Edge Functions de alertas y el mecanismo anti-pause.
6. Cargar datos de Rosimar S.A.S. (config global) y los primeros CV en lote.
7. Ensayo con muestras y go-live.

---

### Documentos relacionados
- `docs/REQUERIMIENTOS.md` — alcance funcional, campos OCR, reglas de negocio, no funcionales.
- `README.md` — índice del repositorio.