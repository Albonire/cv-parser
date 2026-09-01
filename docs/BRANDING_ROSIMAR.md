# Identidad Visual y Branding — Rosimar S.A.S

## Acerca de Rosimar S.A.S

**Rosimar S.A.S** es una empresa colombiana especializada en **gestión de talento humano**.
Nuestro enfoque es profesional, confiable y orientado a resultados.

### Valores Corporativos
- **Confianza:** Datos seguros, procesos transparentes
- **Profesionalismo:** Interfaz clara, sin ruido visual
- **Eficiencia:** Herramientas rápidas, precisas
- **Inclusión:** Sistema 100% en español, accesible

---

## Paleta de Colores Corporativa

### Colores Primarios (Identidad Rosimar)

| Nombre | Hex | RGB | Uso |
|--------|-----|-----|-----|
| `rosimar-navy` | `#2a5234` | 42, 82, 52 | Encabezados, topbar, elementos principales (oliva) |
| `rosimar-blue` | `#3b7a54` | 59, 122, 84 | Botones primarios, acciones, enlaces activos (verde oliva) |
| `rosimar-gold` | `#e5a93c` | 229, 169, 60 | Acentos, logotipo, detalles premium (maíz) |

### Colores Neutros (Tipografía e Interfaz)

| Nombre | Hex | RGB | Uso |
|--------|-----|-----|-----|
| `ink` | `#2d312e` | 45, 49, 46 | Texto principal (carbón) |
| `steel` | `#5b645c` | 91, 100, 92 | Texto secundario, leyendas |
| `paper` | `#f9f8f6` | 249, 248, 246 | Fondo principal (arena) |
| `mist` | `#f0ede6` | 240, 237, 230 | Fondos secundarios, separadores sutiles |
| `fog` | `#dcd8cd` | 220, 216, 205 | Bordes, líneas divisoras |
| `ash` | `#a8a49b` | 168, 164, 155 | Bordes de campos inactivos |

### Colores Funcionales (Estados)

| Nombre | Hex | Uso |
|--------|-----|-----|
| `alert` | `#b3261e` | Errores críticos, RN-2 (3+ memorandos) |
| `alert-surface` | `#fbe4e2` | Fondo de alertas críticas |
| `warning` | `#a16207` | Advertencias, confianza media, preavisos |
| `warning-surface` | `#fbeed0` | Fondo de advertencias |
| `success` | `#2f7d32` | Confirmaciones, operaciones exitosas |
| `success-surface` | `#e2f1e3` | Fondo de confirmaciones |

---

## Tipografía

### Familias
- **Inter** (cuerpo, navegación, etiquetas)
- **Inter Tight** (titulares, destacados)

### Escala Tipográfica

| Escala | Tamaño | Peso | Uso |
|--------|--------|------|-----|
| `micro` | 11px | 400 | Metadatos, anotaciones, ayudas |
| `caption` | 12px | 500 | Etiquetas, contadores, leyendas |
| `body` | 14px | 400 | Párrafos, navegación, contenido |
| `body-strong` | 14px | 600 | Énfasis en texto |
| `subheading` | 18px | 600 | Subtítulos, encabezados de sección |
| `heading` | 24px | 700 | Títulos de formularios, módulos |
| `display` | 32px | 700 | Título de página (hero) |

---

## Espaciado

| Token | Valor | Uso |
|-------|-------|-----|
| `xs` | 4px | Espaciado ultra-compacto |
| `sm` | 8px | Espaciado compacto (unidad base) |
| `md` | 16px | Espaciado estándar (relleno tarjeta) |
| `lg` | 24px | Espaciado generoso |
| `xl` | 32px | Espaciado amplio (entre secciones) |

---

## Componentes Principales

### Botón Primario (Acción Principal)
- Fondo: `rosimar-blue`
- Texto: `paper` (arena)
- Padding: `md` vertical, `lg` horizontal
- Border-radius: `lg` (8px)
- Sombra: sutil (1px 2px 4px rgba(0,0,0,0.1))
- Hover: `rosimar-blue` más oscuro
- Estado: Solo UNO por pantalla

### Botón Secundario
- Fondo: `mist` o transparente
- Texto: `ink`
- Border: 1px `fog`
- Padding: `sm` vertical, `md` horizontal
- Border-radius: `lg`
- Hover: `fog` border

### Tarjeta
- Fondo: `paper`
- Border: 1px `fog`
- Border-radius: `lg`
- Padding: `md` a `lg`
- Sombra: **ninguna** (diseño plano)

### Campo de Formulario
- Fondo: `mist`
- Border: 1px `fog`
- Border-radius: `lg`
- Focus: border `rosimar-blue` 2px, sombra verde sutil
- Padding: `sm` vertical, `md` horizontal

### Encabezado de Página (Header)
- Fondo: `rosimar-navy` (gradiente sutil a `rosimar-blue`)
- Texto: `paper`
- Altura: 80px
- Logo: alineado a la izquierda (48px)
- Título: `display` weight-700
- Descripción: `body` color `mist`

### Navegación Lateral (Sidebar)
- Ancho: 240px
- Fondo: `rosimar-navy` o `mist`
- Activo: `rosimar-blue` border-left 3px
- Hover: `fog` fondo
- Texto: `steel` o `ink`

---

## Reglas de Composición

### Jerarquía Visual
1. **Encabezado de página** con título display
2. **Secciones de contenido** con heading (24px)
3. **Subsecciones** con subheading (18px)
4. **Contenido** con body (14px)

### Distancia Entre Elementos
- Dentro de una tarjeta: `md` (16px)
- Entre tarjetas: `lg` (24px)
- Entre secciones: `xl` (32px)

### Restricciones
- **Máximo 2 botones por sección** (1 primario, 1 secundario)
- **Tarjetas anidadas: 0** (usar encabezados + espacio)
- **Colores de estado: solo severidad** (no categorías)
- **Iconos: solo si agregan significado** (no decorativos)

---

## Ejemplos de Uso

### Estructura de Página
```
┌─────────────────────────────────────────┐
│  HEADER (navy gradient)                 │
│  Logo | Título Display | Usuario        │
├─────────────────────────────────────────┤
│ SIDEBAR │ CONTENIDO                     │
│ Navega- │  ┌─ Heading ─────────────────┐│
│ ción    │  │ Descripción breve         ││
│         │  ├─ Tarjeta (fog border)    ─┤│
│         │  │ • Campo 1                 ││
│         │  │ • Campo 2                 ││
│         │  │ [Guardar]                 ││
│         │  └───────────────────────────┘│
│         │                               │
└─────────────────────────────────────────┘
```

### Botones en Flujo
```
[  Cancelar  ]  [✓ Guardar Empleado]
   secondary        primary
```

### Notificación
```
┌─ Éxito (success-surface) ──────────────┐
│ ✓ Empleado Juan Pérez guardado exitoso │
│                                    [×] │
└────────────────────────────────────────┘
```

---

## Contrastes y Accesibilidad

| Combinación | Ratio | WCAG |
|------------|-------|------|
| `ink` sobre `paper` | 13.2:1 | AAA |
| `steel` sobre `paper` | 5.1:1 | AA |
| `rosimar-blue` sobre `paper` | 4.6:1 | AA |
| `rosimar-navy` sobre `mist` | 6.4:1 | AAA |

---

## Conclusión

Esta paleta profesional, corporativa y accesible refleja los valores de Rosimar:
**confianza, claridad y eficiencia**. El diseño es plano, monocromo por defecto, 
y usa color solo donde la regla de negocio lo exige. Nada de decoración, todo propósito.
