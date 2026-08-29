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

## Estado del proyecto

- **F0 — Base:** ✅ Documentación y repositorio listos.
- **F1 — Lector (CORE):** 🔄 En curso — prototipo que lee hojas de vida desde foto/PDF/Word.
- F2–F6: Pendientes (ver [roadmap](docs/ARQUITECTURA.md#11-roadmap-de-implementaci%C3%B3n)).