# Guia de Desarrollo para Agentes de IA (`AGENTS.md`)

Este repositorio contiene el **Sistema de Gestion de Talento Humano y Analisis de Hojas de Vida** para **Rosimar S.A.S.**

El sistema es una aplicacion web progresiva (PWA) disenada para operar con **costo mensual de $0 en servidores**, ejecutando el procesamiento de documentos y OCR **100% en el navegador del usuario (via WebAssembly)** y persistiendo los datos estructurados en Supabase (plan Free) con soporte offline en IndexedDB.

---

## Stack Tecnologico y Entorno

- **Frontend:** React + Vite + TypeScript + Tailwind CSS (en `apps/web/`)
- **Lector de Documentos en Navegador (WASM / Client-Side):**
  - `pdfjs-dist`: Extraccion de palabras con coordenadas y renderizado de paginas a Canvas
  - `tesseract.js`: Motor OCR en WebAssembly (`spa+eng`) con cajas de palabra, servido en local
  - `mammoth`: Extraccion directa de texto desde archivos `.docx`
  - Canvas API: Preprocesamiento de imagenes (reescalado, grises, Otsu, correccion de inclinacion)

- **Pipeline del lector (`src/lib/ocr/`):** extraccion -> `layout.ts` (renglones y columnas) ->
  `sections.ts` (segmentacion por encabezados) -> `fields/` (un extractor por campo).
  Toda etapa nueva debe trabajar sobre `DocumentLayout`, nunca sobre texto plano: el orden de lectura
  se reconstruye una sola vez y se comparte entre PDF, imagen y Word.

- **Regla de pruebas:** cualquier prueba del lector debe usar el mismo camino que la aplicacion
  (`layoutFromPdfFile` en `src/lib/ocr/__fixtures__/pdf-pipeline.ts`). Construir el texto por fuera
  de ese camino produce pruebas en verde con la aplicacion rota. El banco de precision
  (`reader-accuracy.test.ts`) es la referencia: si un cambio lo baja, el cambio esta mal.
- **Persistencia y Backend:**
  - `Supabase`: PostgreSQL, Auth (roles y RLS), Storage y Edge Functions
  - `Dexie.js` / `localForage`: IndexedDB para almacenamiento local y cola de sincronizacion offline (PWA)
- **Reportes y Graficos:**
  - `Recharts`: Graficos estadisticos del dashboard
  - `jspdf` + `jspdf-autotable`: Generacion de informes en PDF con logo institucional
  - `xlsx`: Exportacion de listados y analisis a Excel
- **Calidad y Testing:** `Vitest`, `Playwright` / `Testing Library`, `ESLint`, `TypeScript strict`

---

## Comandos Clave del Proyecto

```bash
# Instalar dependencias del frontend web
cd apps/web
npm install

# Iniciar servidor de desarrollo
npm run dev

# Ejecutar pruebas unitarias
npm run test

# Comprobar tipos y linters
npm run typecheck
npm run lint

# Generar build de produccion
npm run build
```

---

## Principios de Diseno y Buenas Practicas

1. **Costo Cero ($0) en Infraestructura:**
   - Todo el computo intensivo (OCR, renderizado PDF, parseo) se ejecuta en la CPU del navegador del usuario.
   - El despliegue estatico se realiza en Cloudflare Pages o Netlify (planes gratuitos con uso comercial).
   - Los datos se almacenan en el nivel gratuito de Supabase (PostgreSQL 500 MB, Storage 1 GB).

2. **Evitar Sobreingenieria y AI Slop:**
   - Sin llamadas obligatorias a LLMs comerciales para tareas que se resuelven con expresiones regulares y segmentacion determinista en TypeScript.
   - Sin emojis en documentacion, codigo o salidas del sistema.
   - Todo formulario extraido por OCR debe ser **siempre editable por el usuario** antes de guardarse (regla RN-7).

3. **Idioma y Localizacion:**
   - Toda la interfaz de usuario, formularios, mensajes de error, reportes e informes deben estar **100% en espanol**.
   - El codigo fuente (nombres de variables, funciones, componentes) se escribe en **ingles** para mantener la coherencia con el ecosistema.

4. **Reglas de Negocio Centrales (Rosimar S.A.S.):**
   - **RN-1:** Un candidato solo se convierte en empleado desde el estado `Contratado`.
   - **RN-2:** Acumular 3 memorandos destaca el contador en rojo y genera alerta para revision manual (el sistema no cancela contratos automaticamente).
   - **RN-3:** Alerta de preaviso de vencimiento de contrato (por defecto 30 dias).
   - **RN-4:** Periodo de prueba legal (maximo 2 meses en Colombia).
   - **RN-5:** Un empleado no puede desactivarse sin registrar fecha de salida y razon de salida.
   - **RN-8:** Empleador unico configurado globalmente: Rosimar S.A.S.

---

## Estructura del Repositorio

- `README.md`: Indice y descripcion general del proyecto.
- `docs/REQUERIMIENTOS.md`: Especificacion de modulos (M1 a M13), formularios y reglas de negocio.
- `docs/ARQUITECTURA.md`: Arquitectura tecnica, modelo de base de datos y hosting.
- `SPECS.md`: Resumen tecnico operativo para implementacion.
- `AGENTS.md`: Esta guia de desarrollo para agentes IA.
- `apps/web/`: Aplicacion web PWA en React + Vite.
  - `src/lib/ocr/`: Motor del lector (pdf.js, mammoth.js, Tesseract.js, segmentacion de columnas y parsers).
  - `src/lib/offline/`: Base de datos IndexedDB y sincronizacion.
  - `src/features/`: Modulos funcionales (reader, candidates, employees, contracts, memoranda, alerts, dashboard, reports).
- `supabase/migrations/`: Migraciones SQL con politicas de seguridad RLS.
