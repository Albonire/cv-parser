# cv-parser — Hojas de Vida y Talento Humano · Rosimar S.A.S.

Sistema de control, optimización y análisis de hojas de vida + gestión laboral de empleados (contratos, memorandos, alertas, reportes) para **Rosimar S.A.S.**

- Funciona en la **nube** y **local/offline** (PWA).
- **Lector de documentos** (OCR) en el navegador: extrae los datos desde **fotos, escaneos, PDF y Word** a formularios editables.
- Costo mensual de **$0** en servidores (hospedaje estático + Supabase Free + OCR local).

## Documentación

| Documento | Contenido |
|---|---|
| [docs/REQUERIMIENTOS.md](docs/REQUERIMIENTOS.md) | Alcance funcional, formularios de datos capturados por OCR, reglas de negocio, requisitos no funcionales |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Stack técnico, diagramas, modelo de datos, estrategia offline, hosting gratis, roadmap |

## Módulos principales

1. Autenticación y roles (admin, RRHH, reclutador, consulta)
2. Configuración de la empresa (Rosimar S.A.S.)
3. Lector de documentos (OCR) — hoja de vida, contrato, cédula, EPS
4. Candidatos y reclutamiento (fichas, vacantes, matching)
5. Empleados (activos/inactivos, ingreso/salida y razón de salida)
6. Contratos laborales (todos los campos, prórrogas)
7. Memorandos (contador destacado en 3, revisión manual)
8. Alertas automáticas (sistema + correo)
9. Dashboard y estadísticas
10. Reportes exportables (PDF y Excel)
11. Cloud + Local/offline (PWA)
12. Carga masiva (batch)
13. Seguridad y respaldos

## El lector

El motor de lectura es un **pipeline determinista de cuatro etapas**, sin ningún modelo de lenguaje
y sin costo por documento:

1. **Extracción** — pdf.js (PDF con capa de texto), Tesseract.js WASM (fotos y escaneos) o
   mammoth.js (Word). Los tres producen lo mismo: palabras con su caja delimitadora.
2. **Maquetación** (`lib/ocr/layout.ts`) — reconstruye renglones y detecta columnas por canal
   vertical vacío. Es lo que evita mezclar la barra lateral de un CV a dos columnas con su contenido,
   y lo que evita partir un formulario oficial que lleva etiqueta y valor en el mismo renglón.
3. **Segmentación** (`lib/ocr/sections.ts`) — reconoce los encabezados con un léxico español/inglés
   tolerante a errores de OCR, apoyado en negrita, mayúsculas y tamaño de fuente. Si el CV no trae
   títulos, clasifica los bloques por su contenido.
4. **Extractores por campo** (`lib/ocr/fields/`) — nombres, contacto, documento, ubicación, fechas,
   experiencia, educación, idiomas, certificaciones y referencias, apoyados en el gazetteer de
   municipios DANE y en el diccionario configurable de cargos.

### Precisión medida

`npm run test` incluye un banco que corre el **pipeline real** sobre los 10 PDF de prueba y compara
165 campos contra una verdad de referencia versionada:

```
CV_01_DobleColumna_Ingeniero.pdf            18/18   100.0%  columnas=[2]
CV_02_Ejecutivo_Administrativo.pdf          20/20   100.0%  columnas=[1]
...
GLOBAL                                     165/165  100.0%
```

El informe queda en `apps/web/eval-report.json`. El umbral se ajusta con `CV_EVAL_THRESHOLD`.

### Sin conexión

El worker de Tesseract, su núcleo WebAssembly y los modelos `spa`/`eng` se sirven desde la propia
aplicación (`public/tesseract` y `public/tessdata`), no desde un CDN. `npm run dev` y `npm run build`
copian esos archivos automáticamente (`scripts/copy-ocr-assets.mjs`).

## Estado del proyecto

- **F0 — Base:** Documentación y repositorio listos.
- **F1 — Lector (CORE):** Motor de maquetación, segmentador, extractores por campo, detección de
  cargos, filtros por facetas y banco de precisión. En curso el refinamiento sobre hojas de vida
  manuscritas y formatos Minerva.
- F2–F6: Pendientes (ver [roadmap](docs/ARQUITECTURA.md#11-roadmap-de-implementaci%C3%B3n)).