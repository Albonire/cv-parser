# Requerimientos — Sistema de Gestión de Talento Humano y Análisis de Hojas de Vida

**Empresa:** Rosimar S.A.S.
**Proyecto:** Control, optimización y análisis de hojas de vida + gestión laboral de empleados
**Versión del documento:** 1.0
**Fecha:** 29/08/2026
**Estado:** Aprobado para desarrollo (Fase 1 en curso)

---

## 1. Introducción y objetivo

Rosimar S.A.S. necesita un sistema integral para:

1. **Centralizar y analizar más de 1.000 hojas de vida** (actualmente almacenadas en físico y en formato digital), leídas automáticamente desde fotos, escaneos, PDF y Word.
2. **Gestionar la vida laboral de los empleados**: contratos, ingresos/salidas, razones de salida, memorandos y alertas.
3. **Generar informes** (reportes) individuales y generales, exportables a PDF y Excel, con estadísticas.
4. **Funcionar en la nube y de manera local/offline** (PWA), con costo mensual de **$0** en servidores.

El sistema opera con un único empleador: **Rosimar S.A.S.** (configuración global).

---

## 2. Alcance

El sistema cubre 13 módulos funcionales:

| # | Módulo | Descripción corta |
|---|--------|--------------------|
| M1 | Autenticación y roles | Login, permisos por rol, auditoría |
| M2 | Configuración de la empresa | Datos globales de Rosimar S.A.S. |
| M3 | Lector de documentos (OCR/parser) | Lectura automática de CV, contrato, cédula y afiliaciones EPS desde imagen/PDF/Word |
| M4 | Candidatos / Reclutamiento | Fichas, búsqueda, vacantes, matching y ranking |
| M5 | Empleados | Altas, estado activo/inactivo, ingreso/salida y razón de salida |
| M6 | Contratos laborales | Todos los campos contractuales, prórrogas, estados |
| M7 | Memorandos | Registro, contador destacado en 3, flujo manual de revisión/cancelación |
| M8 | Alertas automáticas | Sistema + correo electrónico (vencimientos, preavisos, periodos de prueba) |
| M9 | Dashboard y estadísticas | Gráficos de reclutamiento y talento humano |
| M10 | Reportes exportables | PDF y Excel, con logo institucional |
| M11 | Cloud + Local/offline | PWA instalable con sincronización |
| M12 | Carga masiva (batch) | Importación por lotes con bandeja de revisión |
| M13 | Seguridad y respaldos | Encriptación, permisos, backups programados |

---

## 3. Usuarios y roles

| Rol | Permisos |
|-----|----------|
| **Administrador** | Acceso total: configuración de la empresa, usuarios, backups, borrado, auditoría |
| **Recursos Humanos** | Candidatos, empleados, contratos, memorandos, vacantes, alertas, reportes |
| **Reclutador** | Solo candidatos, hojas de vida, vacantes, matching |
| **Consulta** | Solo lectura de fichas y reportes |

Reglas de acceso:
- Sesión con token JWT (Supabase Auth), expiración y renovación.
- Los datos personales (hojas de vida, contratos, salud) solo se muestran según el rol.
- Registro de auditoría de toda acción de creación, modificación o eliminación (quién, cuándo, qué).

---

## 4. Módulos funcionales

### M1. Autenticación y roles
- Login seguro (correo + contraseña).
- Roles definidos en la tabla `profiles` con políticas de acceso por fila (RLS).
- Recuperación de contraseña.
- Registro del historial de acciones (auditoría).

### M2. Configuración de la empresa (Empleador)
- Razón social, NIT, representante legal, domicilio, teléfono, correo electrónico, logo, sitio web.
- Parámetros por defecto para contratos: días de preaviso (por defecto 30), duración del periodo de prueba legal (2 meses), días de aviso para memorandos.
- Usuarios destinatarios de alertas por correo.

### M3. Lector de documentos (OCR/parser) — CORE
Permite **subir** una hoja de vida, contrato, documento de identidad o afiliación de EPS en:
- Imagen: JPG, PNG, WEBP, BMP (fotos de documentos físicos).
- PDF: textual **y** escaneado (se OCR-ea página por página).
- Word: `.docx` (`.doc` antiguo no soportado; se recomienda convertir).

El sistema extrae automáticamente los campos del **Formulario de Datos** (ver sección 5) y los **presenta en pantalla siempre editables** antes de guardar. El usuario revisa, corrige y confirma; nada se guarda sin revisión.

Controles de calidad de extracción:
- Indicador de confianza compuesto por documento (30% claridad del OCR, 70% campos efectivamente
  reconocidos).
- Resaltado de campos vacíos o dudosos para revisión, con distintivo por campo.
- Panel de **texto reconocido** siempre disponible junto al formulario, para contrastar contra el
  documento original.
- Guardar el documento original en el almacenamiento (histórico). *Pendiente: requiere Supabase
  Storage (F2).*

**Estado de implementación (F1):** el pipeline se documenta en
[ARQUITECTURA.md §3](ARQUITECTURA.md#3-pipeline-del-lector-core--m3) y su precisión se mide de forma
automática sobre el banco de pruebas del repositorio.

**Detección de cargos (F1):**
- El lector identifica los **cargos** a partir de la experiencia laboral extraída y los contrasta con un **diccionario configurable** de cargos (normalización de sinónimos y agrupación por familia).
- Entrega el **cargo principal** (el de la experiencia más reciente, normalizado a su familia) y la **lista de todos los cargos** detectados.
- El diccionario es configurable por entorno de la empresa (carga inicial orientada a servicios administrativos/operativos), de modo que adaptar el vocabulario no requiera reescribir el parser.

**Filtros de búsqueda en sesión (F1):**
- Los CV extraídos y **confirmados** por el usuario se acumulan en una **bandeja de sesión** (en memoria, aún sin persistencia).
- Un **panel de filtros** permite buscar y depurar en esa bandeja por: cargo detectado (familia/término del diccionario), ciudad, habilidad, idioma, nivel educativo y estado civil.

### M4. Candidatos / Reclutamiento
- Registro manual, por lectura de documento o carga masiva.
- Ficha completa del candidato (sección 5).
- Estados del candidato: Nuevo, En revisión, Preseleccionado, En entrevista, Descartado, Contratado, Archivo.
- Notas internas y evaluación del entrevistador.
- Búsqueda y filtros: nombre, cargo, ciudad, habilidades, experiencia, estudios, estado.
- **Vacantes**: creación de vacantes con requisitos y pesos.
- **Matching**: ranking automático de candidatos vs. vacante (coincidencia de habilidades, experiencia, estudios) + calificación humana opcional del reclutador.
  - En **F1** se entrega una **vista previa** de esto: filtros de búsqueda en sesión (por cargo detectado, ciudad, habilidades, idioma, nivel educativo, estado civil) sobre los CV extraídos y confirmados, y el **cargo principal** normalizado se usa como base para el matching posterior.

### M5. Empleados
- Alta de empleado desde un candidato (`Contratado`) o registro directo.
- Hoja de vida laboral completa del empleado + foto.
- **Estado: Activo / Inactivo**.
- Historial de **ingreso** y **salida**: fecha de ingreso, fecha de salida y **razón de la salida** (renuncia, terminación unilateral por el empleador, mutuo acuerdo, finalización de obra, jubilación, despido justificado/no justificado, fallecimiento, otra).
- Datos de salud y prestaciones (ver sección 5, campo EPS).

### M6. Contratos laborales
- Contratos vigentes e históricos por empleado (posibilidad de prórroga y renovación con historial).
- Campos completos (ver sección 5, Formulario de Contrato).
- Estados del contrato: Vigente, Por vencer, Vencido, Terminado, Cancelado, Prórroga.
- Adjuntar el documento firmado (PDF/imagen) y el escaneo original.

### M7. Memorandos
- Registro por empleado: tipo (llamado de atención, amonestación preventiva, amonestación disciplinaria, otro), asunto, descripción, fecha, responsable, adjunto.
- **Contador de memorandos por empleado**, visible y **destacado al llegar a 3** (regla de negocio RN-2).
- **Flujo de revisión de contrato manual**: el sistema orienta paso a paso (iniciar revisión → registrar decisión → cancelar contrato o archivar), pero la decisión la toma el personal; el sistema **no** cancela nada automáticamente.

### M8. Alertas automáticas (sistema + correo)
Motor diario programado que detecta y notifica:
1. Contratos por vencer dentro del **preaviso** configurado (p. ej., 30 días).
2. Contratos **vencidos** sin renovar (crítica).
3. Finalización del **periodo de prueba** próxima.
4. Empleado que alcanza **3 memorandos** (informativa → invita a revisión manual).
5. Cumpleaños de empleados (opcional).

Canal: **Centro de alertas** dentro del sistema (badge y listado) + **correo electrónico** a los destinatarios configurados (M2).

### M9. Dashboard y estadísticas
- **Reclutamiento:** candidatos por cargo, ciudad, estudios, experiencia, evolución temporal, pipeline de vacantes.
- **Talento humano:** plantilla activa/inactiva, razones de salida, contratos por tipo y por vencer, memorandos por empleado, rotación, EPS más frecuentes.
- Gráficos interactivos y responsive.

### M10. Reportes exportables
- **PDF** (con logo de Rosimar S.A.S.):
  - Ficha de candidato.
  - Ficha de empleado.
  - Informe de contrato.
  - Informe de memorandos (por empleado o por periodo).
  - Informe general (resumen ejecutivo).
- **Excel:**
  - Listados: candidatos, empleados, contratos, memorandos, alertas.
  - Análisis exportables con los mismos filtros del módulo de búsqueda.

### M11. Cloud + Local/offline
- **PWA instalable** en PC, tablet y celular (Android/iOS), responsive.
- Funciona **sin internet**: la app y los datos de trabajo recientes quedan en IndexedDB local y **se sincronizan** al reconectarse (cola de cambios pendientes).
- La nube es la fuente de verdad; el modo local es de continuidad operativa.

### M12. Carga masiva (batch)
- Subir varios archivos a la vez (PDF/Word/fotos de los CV en físico ya digitalizados).
- Procesamiento con OCR en cola y **bandeja de revisión**: cada archivo extraído se revisa/edita/confirma o se descarta antes del alta.
- Barra de progreso, pausa/reanudación, reporte de archivos fallidos.
- Válida para las +1.000 hojas de vida existentes o para tandas futuras.

### M13. Seguridad y respaldos
- Tratamiento de datos personales conforme a la **Ley 1581 de 2012 (Colombia)** y habeas data: consentimiento para archivar hojas de vida, registro de autorizaciones.
- HTTPS obligatorio, cifrado en tránsito y en reposo (transporte manejado por la plataforma; datos sensibles cifrados en BD).
- Políticas RLS (seguridad por fila) para que cada rol solo vea lo permitido.
- **Backups automáticos** de la base de datos (exportación SQL) y de los archivos, programados, con retención configurable.
- Registro de auditoría (M1).

---

## 5. Datos capturados por el lector (OCR) — Formularios maestros

### 5.1 Formulario de Hoja de Vida / Candidato
- Nombre(s) y apellido(s).
- Tipo y número de identificación, fecha de nacimiento.
- Nacionalidad, lugar de nacimiento, ciudad de residencia, domicilio.
- Teléfono(s), correo electrónico.
- Estado civil, sexo/género.
- Foto del aspirante (imagen adjunta).
- **Formación educativa:** nivel, institución, título, año (primaria, bachiller, técnico, tecnólogo, universitario, posgrado).
- **Experiencia laboral:** empresa, cargo, fechas, funciones.
- **Cargo(s) detectado(s):** **cargo principal** (el de la experiencia más reciente) y **lista de todos los cargos** del historial, normalizados según el diccionario configurable (ver M3).
- Habilidades y competencias, idiomas.
- **Referencias familiares:** nombre, parentesco, teléfono.
- **Referencias personales:** nombre, relación, teléfono.
- Disponibilidad, expectativa salarial (opcional).
- Documento original adjunto.

### 5.2 Formulario de Contrato de Trabajo (Colombia)
- **Empleador:** razón social, identificación (NIT), domicilio, correo electrónico.
- **Trabajador:** nombre, fecha de nacimiento, identificación, domicilio.
- **Cargo** del trabajador.
- **Salario** (monto) y moneda.
- **Forma de pago** (quincenal, mensual, otro).
- **Tipo de contrato** (a término fijo, indefinido, obra o labor, aprendizaje, tiempo parcial, otro).
- **Duración** (meses o indefinida).
- **Fecha de iniciación** del contrato.
- **Período de prueba** (días/meses).
- **Fecha de vencimiento** del contrato.
- **Preaviso de terminación / vencimiento** (días, p. ej., 30).
- **Lugar de ejecución** del contrato (ciudad/sitio de trabajo).
- Foto/imagen del empleado (cuando se adjunta).

### 5.3 Formulario de Identidad (cédula / documento)
- Número de identificación, nombres, apellidos, fecha de nacimiento, lugar de expedición, domicilio.

### 5.4 Formulario de Salud y Prestaciones
- **EPS** (Entidad Promotora de Salud) y régimen.
- **ARL** (ARL a la que está afiliado).
- **Fondo de pensiones** (fondo al que cotiza).
- **Caja de compensación**.
- Adjuntos: carné de EPS, certificados de afiliación, exámenes (opcional).

---

## 6. Requisitos no funcionales

| ID | Requisito |
|----|-----------|
| RNF-1 | **Idioma:** interfaz 100% en español. |
| RNF-2 | **Responsive:** funciona en celular, tablet, laptop y escritorio (diseño adaptativo). |
| RNF-3 | **Offline:** PWA instalable con modo sin conexión y sincronización posterior. |
| RNF-4 | **Rendimiento:** listados con más de 1.000 registros con paginación; búsqueda < 2 s. |
| RNF-5 | **Disponibilidad:** app estática sin costo operativo; BD en servicio gratuito (Supabase). Alerta y reactivación automática ante pausa por inactividad. |
| RNF-6 | **Seguridad:** HTTPS, autenticación por token, políticas RLS, no exponer claves ni secretos. |
| RNF-7 | **Privacidad:** cumplimiento Ley 1581/2012 (habeas data). |
| RNF-8 | **Auditabilidad:** registro de acciones (auditoría). |
| RNF-9 | **Escalabilidad:** la arquitectura permite migrar a planes pagos pequeños (~US$25/mes) sin cambios de código si los límites gratuitos se agotan. |
| RNF-10 | **Compatibilidad de archivos:** JPG, PNG, WEBP, BMP, PDF (texto y escaneado), DOCX. |
| RNF-11 | **Manuales:** guía de instalación (IT) y manual de uso (RRHH) en español. |

---

## 7. Reglas de negocio

| ID | Regla |
|----|-------|
| RN-1 | Un candidato puede convertirse en empleado solo desde el estado `Contratado`. |
| RN-2 | **3 memorandos** acumulados a un empleado → el contador se destaca en rojo y se genera alerta informativa de revisión de contrato; el flujo de revisión/cancelación es **manual** (lo decide personal autorizado). |
| RN-3 | **Preaviso de terminación:** los contratos a término fijo mayores a 1 año requieren aviso de al menos 30 días antes del vencimiento; el sistema alerta dentro del número de días configurado (por defecto 30). |
| RN-4 | **Periodo de prueba legal (Colombia):** máximo 2 meses para contratos a término fijo > 1 año (y por regla general). El sistema lo precarga y alerta su finalización. |
| RN-5 | **Razón de salida obligatoria:** un empleado no puede marcarse `Inactivo` sin registrar fecha de salida y razón de salida. |
| RN-6 | No se permite eliminar definitivamente registros con actividad laboral (se usan estados y archivado); el borrado real está restringido al administrador. |
| RN-7 | Toda extracción por OCR debe pasar por revisión/edición humana antes del guardado definitivo. |
| RN-8 | El empleador es único: Rosimar S.A.S. (configuración global). |

---

## 8. Criterios de aceptación (alto nivel)

1. Subir un CV en **foto, PDF y Word** y que el sistema prellene el formulario de la sección 5.1 con campos editables.
2. Cargar **100 CVs en un lote** y procesarlos con bandeja de revisión y progreso.
3. Crear un candidato, **convertirlo en empleado**, registrar contrato con sus campos y adjuntos.
4. Registrar 3 memorandos a un empleado → se destaca el contador (rojo) y se genera alerta.
5. Crear una vacante y obtener **ranking de candidatos** por coincidencia.
6. Generar **informe PDF de empleado y listado Excel** con filtros.
7. Usar la app **sin internet** (offline) y ver la sincronización al reconectarse.
8. Verificar el **envío de correos** de alerta (vencimiento de contrato).
9. La app responde bien en **celular** y cumple tiempos de listados (>1.000 registros).
10. Configurar los datos de **Rosimar S.A.S.** y que aparezcan por defecto en los contratos y reportes.

---

## 9. Fuera de alcance (fases futuras)

- Lectura de expedientes de **nomina y pagos** (calculadora de salarios/prestaciones).
- Nómina integrada (pagos, liquidaciones).
- Firma electrónica de contratos.
- Parseo con IA (LLM) opcional para mejorar OCR (costo por documento) — se evaluará después.
- Múltiples empresas empleadoras (por ahora solo Rosimar S.A.S.).

---

## 10. Glosario

| Término | Definición |
|---------|------------|
| **ATS** | Applicant Tracking System — sistema de seguimiento de candidatos. |
| **CV / Hoja de vida** | Documento con datos personales, formación y experiencia del aspirante. |
| **OCR** | Reconocimiento óptico de caracteres — conversión de imagen/escaneo a texto. |
| **Parser/extractor** | Proceso que convierte texto en campos estructurados. |
| **PWA** | Progressive Web App — aplicación web instalable con modo offline. |
| **EPS** | Entidad Promotora de Salud (afiliación en salud en Colombia). |
| **ARL** | Administradora de Riesgos Laborales. |
| **RLS** | Row Level Security — seguridad por fila en PostgreSQL/Supabase. |
| **Matching** | Comparación de candidatos contra requisitos de una vacante. |
| **Preaviso** | Aviso previo de terminación/vencimiento del contrato. |
| **Habeas data** | Derecho a conocer, actualizar y rectificar los datos personales (Ley 1581/2012). |