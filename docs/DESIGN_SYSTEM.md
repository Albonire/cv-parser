# Sistema de diseño — Rosimar S.A.S.

**Referencia:** Monotype — museo tipográfico editorial sobre papel blanco, adaptado a la identidad corporativa profesional de Rosimar S.A.S.  
**Tema:** Claro. **Implementación:** `apps/web/src/index.css`, bloque `@theme`.  
**Branding:** Ver [BRANDING_ROSIMAR.md](BRANDING_ROSIMAR.md) para paleta completa e identidad visual.

Este documento es el estándar de diseño del proyecto. Cualquier persona o agente que
toque la interfaz debe ajustarse a él. Los valores viven en `@theme`, no en un archivo
de configuración de Tailwind.

---

## 1. Principio

La interfaz de Rosimar combina **tipografía limpia** con **identidad corporativa fuerte**:
colores oliva/maíz en headers, monocromo en contenido, con acción primaria en verde oliva.
Superficies en arena, filetes de 1px en lugar de sombras, mucho aire, y un único color de acción reservado 
a la acción principal. El contenido (datos de personas) no compite con chrome decorativo.

De ahí se derivan tres reglas que se aplican sin excepción:

1. **Plano con identidad.** Un filete de 1px separa; una sombra no. La única sombra del sistema 
   es la del botón primario. Headers con gradiente oliva→verde de Rosimar.
2. **Monocromo funcional.** El color es información, no decoración. Azul corporativo y grises 
   neutrales, con rojo solo para severidad (RN-2, RN-3).
3. **Sin iconos decorativos.** Un icono identifica o indica una acción. Si el texto que
   tiene al lado ya dice lo mismo, el icono sobra.

---

## 2. Color Corporativo

### Paleta Primaria (Identidad Rosimar)

| Token | Hex | RGB | Uso |
|-------|-----|-----|-----|
| `rosimar-navy` | `#2a5234` | 42, 82, 52 | Encabezados, topbar, elementos principales (oliva) |
| `rosimar-blue` | `#3b7a54` | 59, 122, 84 | Botones primarios, acciones, enlaces activos (verde oliva) |
| `rosimar-gold` | `#e5a93c` | 229, 169, 60 | Acentos premium, detalles, logotipo (maíz) |

### Paleta Neutra (Tipografía e Interfaz)

| Token | Hex | Uso |
|-------|-----|-----|
| `ink` | `#2d312e` | Texto principal (máximo contraste, carbón) |
| `steel` | `#5b645c` | Texto secundario, leyendas |
| `paper` | `#f9f8f6` | Fondo principal (arena) |
| `mist` | `#f0ede6` | Fondos secundarios, separadores sutiles |
| `fog` | `#dcd8cd` | Bordes, líneas divisoras |
| `ash` | `#a8a49b` | Bordes inactivos, elementos deshabilitados |

### Paleta Funcional (Estados Permitidos)

Solo para severidad y reglas de negocio (RN-2, RN-3). Nunca para categorías ni decoración.

| Token | Hex | Uso |
|-------|-----|-----|
| `alert` | `#dc2626` | Errores críticos, RN-2 (3+ memorandos) |
| `alert-surface` | `#fee2e2` | Fondo de alertas |
| `warning` | `#d97706` | Advertencias, preavisos, confianza media |
| `warning-surface` | `#fef3c7` | Fondo de advertencias |
| `success` | `#059669` | Confirmaciones de operaciones |
| `success-surface` | `#d1fae5` | Fondo de confirmaciones |

**Límites de la extensión:** Solo severidad y reglas de negocio. Nunca categorías.
Los estados de un candidato (`Nuevo`, `Contratado`) son categorías: van en escala de grises.

---

## 3. Tipografía

`Inter` para texto e `Inter Tight` para titulares, empaquetadas con la aplicación 
desde `@fontsource`. Son los sustitutos indicados para HelveticaNow (comercial). 
**No se cargan desde un CDN**: eso rompería el funcionamiento offline (RNF-3).

| Escala | Tamaño | Peso | Uso |
|--------|--------|------|-----|
| `micro` | 11px | 400 | Metadatos, anotaciones |
| `caption` | 12px | 500 | Etiquetas, contadores, leyendas |
| `body` | 14px | 400 | Párrafos, contenido, navegación |
| `body-strong` | 14px | 600 | Énfasis en texto |
| `subheading` | 18px | 600 | Subtítulos, encabezados de sección |
| `heading` | 24px | 700 | Títulos de formularios |
| `display` | 32–48px | 700 | Título de página (responsive) |

El interletrado de `-0.02em` en negritas es la firma tipográfica del sistema.

---

## 4. Espacio y Forma

- **Unidad base:** 8px. Toda medida es múltiplo.
- **Espacio compacto:** 8px  (sm)
- **Espacio estándar:** 16px (md)
- **Espacio generoso:** 24px (lg)
- **Espacio amplio:**  32px (xl)
- **Radio:** binario. `rounded-lg` (8px) para interfaz, `rounded-2xl` (16px) para imágenes.
- **Sombras:** solo `shadow-subtle` en botón primario.

---

## 5. Componentes

### Header Corporativo
- Fondo: Gradiente oliva→verde (`#2a5234` → `#3b7a54`)
- Logo: Marca "R" en recuadro translúcido
- Titulo: `display` weight-700, color blanco, Inter Tight
- Subtítulo: "Gestión de Talento" en texto secundario claro
- Altura: 80–96px
- Indicadores: Rol, Estado (En línea/Sin conexión), Cola de sincronización

### Navegación Primaria
- Ubicación: Bajo header corporativo
- Fondo: Blanco (`paper`)
- Activo: Border-bottom 2px verde oliva, peso 600
- Hover: Border-bottom 2px gris, texto oscuro
- Inactivo: Texto gris, sin borde
- Alertas: Badge rojo con contador (RN-2)

### Botón Primario
- Fondo: `rosimar-blue` (#3b7a54)
- Texto: Blanco (`paper`)
- Padding: 0.5rem vert, 1rem horiz
- Border-radius: `lg` (8px)
- Sombra: `shadow-subtle`
- Hover: Azul más oscuro + sombra elevada
- Uno por vista

### Botón Secundario
- Fondo: `mist` o transparente
- Texto: `ink`
- Border: 1px `fog`
- Radius: `lg`
- Hover: Border `ash`

### Tarjeta
- Fondo: `paper`
- Border: 1px `fog`
- Radius: `lg`
- Padding: 16–24px
- Sombra: **ninguna** (diseño plano)

### Campo de Formulario
- Fondo: `mist`
- Border: 1px `fog`
- Focus: Border `rosimar-blue` 2px, sombra verde sutil
- Radius: `lg`

### Notificación/Alerta
- Alerta: Border-left 4px + fondo surface
- Tipos: `success` (verde), `warning` (ámbar), `alert` (rojo), `info` (neutral)
- Icono + Mensaje + Botón cerrar
- Sin sombra

---

## 6. Iconos

Se usan de `hugeicons-react`, a `h-4 w-4` en línea y `h-5 w-5` en bloques, 
siempre en `steel` salvo que comuniquen severidad.

**Sí:** Acciones (`PlusSign`, `Delete`, `Download`), estado/progreso (`Alert`, `Checkmark`).  
**No:** Junto a encabezados que ya nombran la sección, ni junto a botones cuyo texto ya dice lo mismo.

---

## 7. Restricciones de Composición

- **Máximo 2 botones por sección** (1 primario, 1 secundario)
- **Tarjetas anidadas: cero** (usar encabezados + espacio)
- **Color funcional:** solo severidad, nunca categorías ni decoración
- **Ancho máximo:** 1280px
- **Padding horizontal:** 24–48px

---

## 8. Verificación de Calidad

```bash
# Sin errores de tipo
npm run typecheck

# Sin violaciones de linting
npm run lint

# Tests en verde
npm run test

# Contraste visual (WCAG AA mínimo)
ink sobre paper:     13.8:1 ✓ AAA
steel sobre paper:    6.2:1 ✓ AA
rosimar-blue sobre paper: 4.6:1 ✓ AA
```

---

## Conclusión

Este sistema refleja los valores de Rosimar: **confianza, claridad y profesionalismo**.
Identidad corporativa fuerte (oliva/maíz), interfaz limpia (monocromo cálido), sin decoración.
Todo tiene propósito.

