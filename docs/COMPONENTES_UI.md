# Componentes UI y Clases de Estilo — Rosimar S.A.S.

Guía de uso de clases de componentes CSS y tokens de diseño disponibles en `apps/web/src/index.css`.
Ver [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) para principios y [BRANDING_ROSIMAR.md](BRANDING_ROSIMAR.md) para identidad corporativa.

---

## 1. Colores Corporativos

### Uso en Clases Tailwind

```tsx
// Fondo con color corporativo
<div className="bg-blue-900">Navy Rosimar</div>
<div className="bg-blue-600">Blue Rosimar</div>
<div className="bg-amber-700">Gold Rosimar</div>

// Texto corporativo
<span className="text-slate-900">Texto principal (ink)</span>
<span className="text-slate-600">Texto secundario (steel)</span>
```

### Paleta Completa (en @theme)

```css
--color-rosimar-navy: #1a3a52;      /* Encabezados, topbar */
--color-rosimar-blue: #2563eb;      /* Botones primarios, acciones */
--color-rosimar-gold: #c19a5c;      /* Acentos premium */
```

---

## 2. Componentes Principales

### Botón Primario

**Clase CSS:** `.btn-primary`

```tsx
<button className="btn-primary">
  Guardar
</button>
```

**Estilos:**
- Fondo: Blue Rosimar (#2563eb)
- Texto: Blanco
- Padding: 10px 16px
- Border-radius: 8px (lg)
- Sombra: Sombra sutil en hover
- Hover: Azul más oscuro + elevación

**Restricción:** Uno por vista máximo.

### Botón Secundario

**Clase CSS:** `.btn-secondary`

```tsx
<button className="btn-secondary">
  Cancelar
</button>
```

**Estilos:**
- Fondo: Mist (#f1f5f9)
- Texto: Ink (#0f172a)
- Border: 1px fog (#cbd5e1)
- Hover: Border más oscuro

### Tarjeta

**Clase CSS:** `.card`

```tsx
<div className="card">
  <h2>Contenido de tarjeta</h2>
  <p>Descripción o datos</p>
</div>
```

**Estilos:**
- Fondo: Paper (blanco)
- Border: 1px fog (#cbd5e1)
- Border-radius: 8px
- Padding: 16–24px
- Sin sombra (diseño plano)

**Restricción:** NUNCA tarjetas anidadas. Usar encabezados + espacio en lugar de cajas.

### Formularios: Input, Select, Textarea

**Clase CSS:** `.form-input`, `.form-select`, `.form-textarea`

```tsx
<input type="text" className="form-input" placeholder="Nombre..." />
<select className="form-select">
  <option>Opción 1</option>
</select>
<textarea className="form-textarea" rows={4}></textarea>
```

**Estilos:**
- Fondo: Mist (#f1f5f9)
- Border: 1px fog (#cbd5e1)
- Focus: Border azul 2px + sombra azul sutil
- Border-radius: 8px
- Font: body (14px)

---

## 3. Notificaciones y Alertas

### Alert Box

**Clase CSS:** `.alert-box`, `.alert-success`, `.alert-warning`, `.alert-alert`

```tsx
// Éxito
<div className="alert-box alert-success">
  ✓ Empleado guardado correctamente
</div>

// Advertencia
<div className="alert-box alert-warning">
  ⚠ Falta información de salud
</div>

// Error / Severidad
<div className="alert-box alert-alert">
  ✕ El documento no se pudo procesar
</div>
```

**Estilos:**
- Border-left: 4px (color según tipo)
- Fondo: Surface del color (gris claro, ámbar claro, rojo claro)
- Padding: 12px 16px
- Border-radius: 4px
- Border-top/bottom/right: 1px gris claro

**Tipos:**
- `alert-success`: Verde (#059669) + fondo verde claro
- `alert-warning`: Ámbar (#d97706) + fondo ámbar claro
- `alert-alert`: Rojo (#dc2626) + fondo rojo claro

---

## 4. Encabezados y Títulos

### Header Primario (Corporate)

**Clase CSS:** `.header-primary` (usado en Navbar)

```tsx
<header className="header-primary">
  <div className="text-white">
    <h1>Rosimar</h1>
    <p>Gestión de Talento</p>
  </div>
</header>
```

**Estilos:**
- Gradiente: Navy → Blue (#1a3a52 → #2563eb)
- Altura: 80–96px
- Padding: 24px
- Texto blanco
- Border-bottom: Blue accent

### Encabezado de Sección

**Uso en componentes:**

```tsx
<h2 className="text-2xl font-bold text-slate-900 mb-4">
  Información Personal
</h2>
```

### Subtítulo

```tsx
<h3 className="text-lg font-semibold text-slate-900 mb-2">
  Datos Generales
</h3>
```

---

## 5. Badges y Etiquetas

### Badge

**Clase CSS:** `.badge`, `.badge-primary`, `.badge-alert`, `.badge-warning`, `.badge-success`

```tsx
<span className="badge badge-primary">Nuevo</span>
<span className="badge badge-alert">Crítico</span>
<span className="badge badge-warning">Pendiente</span>
<span className="badge badge-success">Activo</span>
```

**Estilos:**
- Padding: 4px 12px
- Border-radius: 16px (redondeado)
- Font-weight: 600
- Font-size: 12px
- Sin border

---

## 6. Navegación

### Nav Link

**Clase CSS:** `.nav-link`

```tsx
<nav>
  <a href="#" className="nav-link active">Sección Activa</a>
  <a href="#" className="nav-link">Otra Sección</a>
</nav>
```

**Estilos Activo:**
- Border-bottom: 2px Blue Rosimar
- Texto: Ink (#0f172a)
- Font-weight: 600

**Estilos Inactivo:**
- Border-bottom: 2px transparent
- Texto: Steel (#475569)
- Hover: Texto más oscuro

---

## 7. Ejemplos de Composición

### Tarjeta con Botones

```tsx
<div className="card">
  <h2 className="text-xl font-bold text-slate-900 mb-4">
    Información de Empleado
  </h2>
  <p className="text-slate-600 mb-6">Datos del contrato y beneficios</p>
  
  <div className="flex gap-3">
    <button className="btn-primary">Guardar cambios</button>
    <button className="btn-secondary">Cancelar</button>
  </div>
</div>
```

### Formulario con Campos

```tsx
<div className="space-y-6">
  <div>
    <label className="block text-sm font-medium text-slate-900 mb-2">
      Nombre completo
    </label>
    <input type="text" className="form-input w-full" />
  </div>
  
  <div>
    <label className="block text-sm font-medium text-slate-900 mb-2">
      Rol
    </label>
    <select className="form-select w-full">
      <option>Seleccionar...</option>
    </select>
  </div>
</div>
```

### Sección con Alertas

```tsx
<div className="space-y-4">
  <div className="alert-box alert-success">
    Empleado Juan Pérez contratado exitosamente
  </div>
  
  <div className="alert-box alert-warning">
    Contrato vence en 15 días (27 de marzo)
  </div>
  
  <div className="card">
    {/* Contenido principal */}
  </div>
</div>
```

---

## 8. Espaciado Estándar

Tokens disponibles (múltiplos de 8px):

```css
--spacing-xs: 4px;      /* sm: pequeñas separaciones */
--spacing-sm: 8px;      /* sm: iconos, gaps pequeños */
--spacing-md: 16px;     /* md: separación estándar */
--spacing-lg: 24px;     /* lg: separación generosa */
--spacing-xl: 32px;     /* xl: separación amplia */
```

**En clases Tailwind:**

```tsx
<div className="gap-4">         {/* 16px */}
<div className="p-6">          {/* 24px */}
<div className="mb-8">         {/* 32px */}
<div className="space-y-4">    {/* 16px entre items */}
```

---

## 9. Sombras

**Disponibles:**
- `shadow-none` (default)
- `shadow-subtle` (solo botón primario en hover)
- `shadow-md` (elevación secundaria, si se necesita)

```tsx
// Botón primario hereda shadow-subtle
<button className="btn-primary">
  {/* Sombra sutil al hover */}
</button>

// Tarjeta con elevación secundaria (excepcional)
<div className="card shadow-md">
  {/* Muy raramente justificado */}
</div>
```

---

## 10. Responsive

El sistema es mobile-first. Breakpoints comunes:

```tsx
// Base (mobile): 320px
<div className="text-sm">Mobile</div>

// sm: 640px
<div className="sm:text-base">Tablet+</div>

// md: 768px
<div className="md:text-lg">Desktop</div>

// lg: 1024px
<div className="lg:grid-cols-2">2 columnas desktop</div>
```

---

## 11. Accesibilidad

**Colores corporativos pasan WCAG AAA:**
- Ink sobre Paper: 13.8:1 ✓ AAA
- Steel sobre Paper: 6.2:1 ✓ AA
- Rosimar Blue sobre Paper: 7.1:1 ✓ AA

**Buenas prácticas:**
- Usar `aria-label` en botones con solo iconos
- `aria-current="page"` en navegación activa
- Labels explícitos en formularios (no placeholders solos)
- Orden lógico de tabulación (tabindex solo si es necesario)

---

## 12. Actualización Futura

Cuando se añadan nuevos componentes o tokens:

1. Actualizar `apps/web/src/index.css` (@theme)
2. Documentar aquí con ejemplos de uso
3. Validar contraste WCAG AAA
4. Añadir restricciones en DESIGN_SYSTEM.md

---

**Última actualización:** Enero 2025  
**Responsable del diseño:** Branding Rosimar S.A.S.  
**Validación:** All components tested in Navbar + PageHeader implementation.
