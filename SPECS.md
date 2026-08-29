# SPECS.md — Especificaciones Tecnicas de `cv-parser` (Rosimar S.A.S.)

## 1. Vision General del Proyecto

`cv-parser` es el Sistema de Gestion de Talento Humano y Analisis de Hojas de Vida desarrollado para **Rosimar S.A.S.**

El sistema permite centralizar y analizar mas de 1.000 hojas de vida desde fotos, escaneos, PDFs y documentos Word, gestionar la vida laboral de los empleados (contratos, memorandos, alertas y reportes) y operar con **costo mensual de $0 en servidores**.

---

## 2. Decision Arquitectonica: Web/PWA con OCR en el Navegador ($0 Costo)

Para garantizar costo cero ($0) y despliegue sin servidores dedicados de computo:
1. **El procesamiento pesado (OCR, lectura y parseo) corre en el navegador del usuario via WebAssembly (WASM):**
   - PDFs digitales: `pdf.js` extrae texto y posiciones espaciales.
   - PDFs escaneados y fotos: `pdf.js` renderiza a Canvas (180 DPI), se aplica preprocesamiento de imagen y `Tesseract.js` (WASM, idioma `spa`) extrae el texto en Web Workers sin congelar la UI.
   - Documentos Word: `mammoth.js` convierte `.docx` directamente a texto.
2. **Parser determinista en TypeScript:**
   - Detecta columnas y flujos de lectura sin mezclar lineas adyacentes.
   - Aplica expresiones regulares y taxonomias para prellenar 4 formularios maestros:
     - 5.1 Hoja de Vida / Candidato (datos personales, formacion, experiencia, habilidades, referencias).
     - 5.2 Contrato de Trabajo (empleador, trabajador, salario, tipo de contrato, periodo de prueba, preaviso).
     - 5.3 Documento de Identidad (cedula).
     - 5.4 Salud y Prestaciones (EPS, ARL, pensiones, caja de compensacion).
3. **Revision humana obligatoria:** Los campos extraidos se presentan siempre en formularios editables para que el personal de RRHH valide o corrija antes de guardar (regla RN-7).
4. **Infraestructura gratuita:**
   - Hosting estatico: Cloudflare Pages o Netlify (permite uso comercial gratuito).
   - Base de datos y Auth: Supabase Free (PostgreSQL 500 MB, Storage 1 GB).
   - Offline: PWA instalable con almacenamiento en IndexedDB (Dexie) y cola de sincronizacion.

---

## 3. Estructura del Proyecto

```
cv-parser/
├── README.md
├── docs/
│   ├── REQUERIMIENTOS.md
│   └── ARQUITECTURA.md
├── SPECS.md
├── AGENTS.md
├── apps/
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── lib/
│       │   │   ├── ocr/            (pdf.js, mammoth, tesseract, segmentador, parsers)
│       │   │   ├── offline/        (IndexedDB y sincronizacion PWA)
│       │   │   └── api/            (Cliente Supabase y tipos de datos)
│       │   └── features/
│       │       ├── reader/         (Lector multiformato con formulario editable)
│       │       ├── candidates/     (Gestion de candidatos, vacantes y matching)
│       │       ├── employees/      (Empleados, estado activo/inactivo, ingresos/salidas)
│       │       ├── contracts/      (Contratos laborales y prorrogas)
│       │       ├── memoranda/      (Memorandos, contador destacado al llegar a 3)
│       │       ├── alerts/         (Alertas de vencimiento de contrato y periodo de prueba)
│       │       ├── dashboard/      (Estadisticas con Recharts)
│       │       └── reports/        (Generador de PDF y Excel con logo institucional)
│       └── public/
└── supabase/
    └── migrations/                 (Esquema PostgreSQL con RLS y politicas de seguridad)
```

---

## 4. Reglas de Negocio Principales

- **RN-1:** Un candidato solo puede pasar a empleado desde el estado `Contratado`.
- **RN-2:** Al acumular 3 memorandos, el contador se destaca en rojo y se genera alerta para revision manual de contrato (la cancelacion es decision humana, no automatica).
- **RN-3:** Alerta automatica de preaviso de vencimiento de contratos a termino fijo (por defecto 30 dias).
- **RN-4:** Periodo de prueba legal (maximo 2 meses en Colombia).
- **RN-5:** No se puede inactivar un empleado sin registrar fecha de salida y razon de salida.
- **RN-7:** Toda extraccion automatica por OCR debe pasar por revision y edicion humana antes de persistirse.
- **RN-8:** Empleador unico configurado globalmente: Rosimar S.A.S.
