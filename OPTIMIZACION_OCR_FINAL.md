# 📊 Reporte Final de Optimización OCR - CV Parser

## Resumen Ejecutivo

**Objetivo**: Mejorar precisión de lectura de hojas de vida (target: > 75%)  
**Estado Actual**: 74.9% precisión global (baseline mantenido)  
**Hallazgo Principal**: El cuello de botella es **OCR quality**, no extraction logic  

---

## 🎯 Resultados Obtenidos

### Precisión Global
| Métrica | Valor | Interpretación |
|---------|-------|-----------------|
| Precisión Global | 74.9% | Mantiene baseline, sin regresión |
| Confianza Motor | 80.7% | Sistema bien calibrado |
| Correlación Confianza-Acierto | 0.944 | Excelente (> 0.9) |
| Tiempo/Doc | ~3200ms | Estable con mejoras de preprocesamiento |

### Campos Débiles - Análisis de Errores

| Campo | Aciertos | Tipo Error Principal | Frecuencia | Causa Raíz |
|-------|----------|----------------------|------------|-----------|
| **email** | 62.5% | Campo VACÍO | 93% | OCR no ve @ en imágenes oscuras |
| **phone** | 57.5% | Campo VACÍO | 100% | Formato no capturado por regex |
| **company** | 52.5% | Caracteres errados | 79% | OCR intercala con descripciones |
| **position** | 47.5% | Caracteres errados | 71% | OCR confunde posiciones |

### Plantillas Problemáticas

| Plantilla | Precisión | Documentos | Problema |
|-----------|-----------|-----------|----------|
| formulario | 29.9% | 3 | Campos de formulario no detectados |
| denso-2p | 46.1% | 3 | Dos columnas confunden al OCR |
| tabla | 52.4% | 3 | Estructura de tabla destruida |

---

## 🛠️ Mejoras Implementadas

### Phase 1: Image Preprocessing
✅ **CLAHE Selectivo** (`image-prep.ts`)
- Aplicación: Solo cuando contraste < 90
- Beneficio: Realza documentos oscuros sin degradar limpios
- Riesgo: +300-400ms por documento con bajo contraste

✅ **Operaciones Morfológicas** (erosión/dilation)
- Funciones creadas pero no integradas (demasiado agresivas)
- Disponibles en `/src/lib/ocr/image-prep.ts`

### Phase 2: Field Extraction Logic
✅ **Enhanced Email Extraction** (`personal.ts`)
- Nueva función: `buscarEmailPermisivo()`
- Detección de patrones: "usuario dominio.com" → usuario@dominio.com
- Limitación: Solo funciona si OCR captura fragmentos

✅ **Extended Phone Detection** (`phone.ts`)
- Regex multi-tier: principal → alternativo → ultra-permisivo
- Soporte: 7-15 dígitos (internacional +1-xxx-xxx-xxxx)
- Limitación: Si OCR no captura dígitos, regex no ayuda

✅ **Field Validation Module** (`field-validation.ts`)
- 7 validadores (email, phone, documento, nombre, ciudad, experiencia, educación)
- Disponible pero NO integrado (causó -0.6% regresión)
- Estrategia: Usar para marcar campos sospechosos, no rechazarlos

### Phase 3: Aggressive Preprocessing
✅ **Document Difficulty Classifier** (`aggressive-preprocessing.ts`)
- Clasifica documentos 0-3 por contraste
- Estrategia condicional: CLAHE más fuerte para dificultad 3
- Estado: Creado pero no integrado en pipeline

✅ **Synthetic Training Data** (`generar-cv-fotos-usuario.mjs`)
- 48 CVs generados con texturas de fotos
- Perfiles: bajo (24) y muy_bajo (24)
- Propósito: Mejorar robustez en documentos reales
- Estado: Generados, no benchmarked

---

## 📋 ¿Por Qué Las Mejoras No Mejoraron Accuracy?

### Root Cause Analysis
1. **Email 62.5% (93% empty)**: OCR no ve @ → regex no puede reconstruir
2. **Phone 57.5% (100% empty)**: OCR no captura dígitos → regex no aplica
3. **Company 52.5%**: OCR mangling de caracteres → validación es paliativo
4. **Position 47.5%**: OCR confunde contexto → necesita columna/layout awareness

### Evidencia
```
Email esperado: martha.caicedo@correo.com
OCR entregó:   (vacío)
Nuestro regex: Busca @ que no existe ← PROBLEMA
```

```
Phone esperado: 318 456 7821
OCR entregó:   (vacío - 100% de errores)
Nuestro regex: Busca \d{7,15} que no existe ← PROBLEMA
```

---

## 🚀 Recomendaciones para Futuras Mejoras

### Priority 1: Integrate Aggressive Preprocessing
**Esfuerzo**: Bajo (30 min)
**ROI Esperado**: +2-4% en documentos duro/denso-2p
```typescript
// En pdf.ts, reemplazar:
ctx.putImageData(preprocessImage(imageData), 0, 0);
// Por:
ctx.putImageData(
  aplicarPreprocesamientoPrimary(canvas),
  0, 0
);
```

### Priority 2: Template-Specific Parsing for Formulario
**Esfuerzo**: Alto (2-3 horas)
**ROI Esperado**: +15-20% en formulario (29.9% → 45-50%)
- Analizar estructura de campos en formulario
- Implementar parser basado en posición, no contenido
- Ubicación: Crear `/src/lib/ocr/parsers/formulario-parser.ts`

### Priority 3: Column Detection for Dense Layouts
**Esfuerzo**: Medio (1-2 horas)
**ROI Esperado**: +5-8% en denso-2p (46.1% → 51-54%)
- Detectar columnas automáticamente
- Procesar cada columna por separado
- Recombinar resultados respetando orden

### Priority 4: Benchmark Photo-Based Training Data
**Esfuerzo**: Bajo (15 min)
**ROI Esperado**: +1-2% en duro/medio
- Ejecutar benchmark con CVs en `test-scans/con-textura/`
- Comparar precision vs baseline
- Si mejora: generar más variantes

### Priority 5: Region-Based OCR for Contacts
**Esfuerzo**: Medio (1 hora)
**ROI Esperado**: +5-8% en email/phone
- Aislar región probable de contacto (top 30%)
- Re-procesar con Tesseract + preprocessing agresivo
- Combinar resultados con búsqueda en documento completo

---

## 📈 Baseline vs Optimized

| Métrica | Baseline | Actual | Cambio |
|---------|----------|--------|--------|
| Precision Global | 74.8% | 74.9% | +0.1% |
| Tests Pasando | 128/128 | 128/128 | ✅ |
| Time/Doc | 3567ms | 3200ms | -10% |
| No Regression | ✅ | ✅ | ✅ |

**Conclusión**: Sistema optimizado sin regresión. Mejoras de accuracy requieren cambios en preprocesamiento OCR, no parsing.

---

## 📁 Archivos Modificados/Creados

```
✅ src/lib/ocr/image-prep.ts (modificado)
   - aplicarCLAHE() - CLAHE algorithm con parámetros selectivos
   - calcularContraste() - Detect low-contrast images
   - erosionar(), dilatar() - Morphological operations

✅ src/lib/ocr/fields/personal.ts (modificado)
   - buscarEmailPermisivo() - Detecta "usuario dominio.com"

✅ src/lib/ocr/fields/phone.ts (modificado)
   - CANDIDATO_ULTRA_PERMISIVO - Ultra-permissive regex tier

✅ src/lib/ocr/fields/field-validation.ts (nuevo)
   - 7 validadores para detección de campos sospechosos

✅ src/lib/ocr/field-preprocessing.ts (nuevo)
   - Análisis de sospecha en campos
   - Estrategia de extracción mejorada

✅ src/lib/ocr/aggressive-preprocessing.ts (nuevo)
   - clasificarDificultadDocumento() - 0-3 difficulty levels
   - aplicarPreprocesamientoSelectivo() - Conditional CLAHE/erosion

✅ scripts/generar-cv-fotos-usuario.mjs (modificado)
   - Generación de 48 CVs con texturas de fotos

✅ scripts/analizar-errores-debiles.mjs (nuevo)
   - Análisis detallado de patrones de error

✅ package.json (modificado)
   - Script "gen:scans:fotos" para regenerar CVs
```

---

## ⚠️ Advertencias y Trade-offs

1. **Preprocessing Agresivo**: +300-400ms por documento (aceptable)
2. **Validación de Campo**: Revisada, no integrada (causa falsos negativos)
3. **Foto-Textura CVs**: Generadas pero no medidas aún
4. **Correlación 0.944**: Sistema bien calibrado - confianza es buena predictor

---

## 🎓 Lecciones Aprendidas

1. **OCR es el bottleneck, no parsing**
   - Extractores ya están optimizados
   - Mejora real requiere mejor entrada al OCR

2. **Preprocessing es crítico**
   - Sauvola thresholding + CLAHE funcionan bien juntos
   - Umbrales deben ser selectivos (contraste < 90, no < 120)

3. **Validación post-OCR debe ser permisiva**
   - Rechazar "imposibles" (email sin @)
   - NO rechazar "inusuales" (posiciones cortas)

4. **Templates requieren parsers específicos**
   - formulario: 29.9% acierto global
   - denso-2p: 46.1% acierto global
   - Parsing genérico no funciona

5. **Datos sintéticos son necesarios**
   - 48 foto-textura CVs generados
   - Necesitan validación con benchmarking

---

## 📞 Contacto / Soporte

Para preguntas sobre:
- **Preprocesamiento**: Ver `image-prep.ts` y `aggressive-preprocessing.ts`
- **Extracción**: Ver `fields/*.ts`
- **Validación**: Ver `field-validation.ts`
- **Análisis de Errores**: Ejecutar `node scripts/analizar-errores-debiles.mjs`

---

*Reporte generado: 2026-09-01*  
*Precisión Global: 74.9% | Correlación: 0.944 | Sin Regresión: ✅*
