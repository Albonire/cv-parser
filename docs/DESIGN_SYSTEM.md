# Sistema de diseño — Rosimar S.A.S.

**Referencia:** Monotype — museo tipográfico editorial sobre papel blanco.
**Tema:** claro. **Implementación:** `apps/web/src/index.css`, bloque `@theme`.

Este documento es el estándar de diseño del proyecto. Cualquier persona o agente que
toque la interfaz debe ajustarse a él. Los valores viven en `@theme`, no en un archivo
de configuración de Tailwind: ver la advertencia al final.

---

## 1. Principio

La tipografía es el artefacto; el chrome desaparece. Superficies blancas, filetes de
1px en lugar de sombras, mucho aire, y un único azul reservado a la acción principal.
La interfaz no compite con el contenido: en esta aplicación el contenido son los datos
de una persona que alguien de RRHH debe leer y verificar.

De ahí se derivan tres reglas que se aplican sin excepción:

1. **Plano.** Un filete de 1px separa; una sombra no. La única sombra del sistema es la
   del botón primario.
2. **Monocromo.** El color es información, no decoración. Ver §3.
3. **Sin iconos decorativos.** Un icono identifica o indica una acción. Si el texto que
   tiene al lado ya dice lo mismo, el icono sobra.

---

## 2. Color

| Token | Valor | Uso |
|---|---|---|
| `ink` | `#1e242c` | Texto principal, filete activo, superficie invertida |
| `steel` | `#576579` | Texto secundario, etiquetas, iconos |
| `paper` | `#ffffff` | Lienzo y superficie de tarjetas |
| `mist` | `#e7eaee` | Divisores y separadores sutiles |
| `fog` | `#dbdfe5` | Bordes de tarjeta y bloques de contenido |
| `ash` | `#cfd5dd` | Realimentación de interacción |
| `signal-blue` | `#1a73e8` | **Solo** superficie del botón primario y foco |

En Tailwind: `text-ink`, `bg-paper`, `border-fog`, `bg-signal-blue`.

### Extensión funcional aprobada

El sistema de referencia prohíbe el color en estados y etiquetas. Este proyecto añade
una excepción **acotada y justificada**: RN-2 exige que el contador de tres memorandos
se destaque en rojo, y RN-3 define preavisos de vencimiento con severidad. Suprimir el
color ahí eliminaría una señal que la regla de negocio pide explícitamente.

| Token | Valor | Uso permitido |
|---|---|---|
| `alert` | `#b3261e` | Severidad crítica y RN-2 (tres memorandos) |
| `alert-surface` | `#fdf0ee` | Fondo de esos mismos avisos |
| `warning` | `#8a6116` | Severidad media, preavisos, confianza de extracción baja |
| `warning-surface` | `#fdf7e9` | Fondo de esos mismos avisos |

**Los límites de la excepción, que no se amplían:**

- Solo severidad y reglas de negocio. Nunca categorías, etiquetas ni decoración.
- Los estados de un candidato o un contrato (`Nuevo`, `Contratado`, `Vigente`) son
  categorías: van en escala de grises, diferenciados por peso y filete.
- Las confirmaciones de éxito son monocromas. Un "guardado correctamente" no necesita
  verde: el mensaje ya lo dice.
- Las acciones destructivas (borrar) tampoco son severidad: el icono va en `steel` y
  solo pasa a `alert` al apuntarlo, que es cuando la advertencia sirve de algo. Una
  columna de papeleras rojas en reposo es ruido, no aviso.

---

## 3. Tipografía

`Inter` para texto e `Inter Tight` para titulares, empaquetadas con la aplicación desde
`@fontsource`. Son los sustitutos que el propio sistema de referencia indica para
HelveticaNow, que es comercial. **No se cargan desde un CDN**: eso rompería el
funcionamiento sin conexión, que es un requisito del proyecto (RNF-3).

| Escala | Tamaño | Interlineado | Uso |
|---|---|---|---|
| `text-micro` | 11px | 1.45 | Metadatos, anotaciones |
| `text-caption` | 13px | 1.23 | Etiquetas, datos de tabla, recuentos |
| `text-body` | 16px | 1.5 | Cuerpo, navegación, botones |
| `text-subheading` | 26px | 1.2 | Título de formulario |
| `text-display` | 40–57px | 1.12 | Título de sección (cabecera de página) |

El interletrado de `-0.02em` en negritas es la firma tipográfica del sistema y se aplica
globalmente en `index.css`. La familia display nunca baja de 40px: por eso el token usa
`clamp(40px, 4.5vw, 57px)` en lugar de encoger sin límite en móvil.

---

## 4. Espacio y forma

- **Unidad base:** 8px. Toda medida es múltiplo.
- **Radio:** binario. `rounded-lg` (8px) para interfaz, `rounded-2xl` (16px) para
  imágenes. No se añaden valores intermedios.
- **Ancho de página:** 1280px.
- **Sombras:** solo `shadow-subtle`, y solo en el botón primario.

---

## 5. Componentes

**Botón primario.** Superficie `signal-blue`, texto `paper`, `rounded-lg`,
`shadow-subtle`. Es el único control relleno de la interfaz. Uno por vista.

**Botón secundario.** Sin relleno o con `bg-mist`, texto `ink`, filete `fog`.

**Tarjeta.** `rounded-lg border border-fog bg-paper`, relleno de 16 a 24px. Sin sombra.
**Nunca una tarjeta dentro de otra tarjeta** (ver §7).

**Navegación por secciones.** Puramente tipográfica: la sección activa se marca con
peso, color `ink` y filete inferior. Sin fondo y sin icono — las ocho pestañas con
icono a 16px necesitan 1282px y el lienzo del sistema tiene 1184px útiles.

**Cabecera de página.** Titular display alineado a la izquierda con una descripción
breve debajo, separada por un filete. Es la que da la jerarquía: las vistas **no**
repiten su propio título dentro de una tarjeta.

**Campo de formulario.** Etiqueta `text-caption` en `ink`, control con filete `fog` y
`rounded-lg`. El foco lo da `:focus-visible` global; no se definen anillos por campo.

---

## 6. Iconos

Se usan de `hugeicons-react`, a `h-4 w-4` en línea de texto y `h-5 w-5` en bloques,
siempre en `steel` salvo que comuniquen severidad.

**Sí:** acciones (`PlusSign`, `Delete`, `Download`, `Search`), estado y progreso
(`Loading`, `Alert`, `Checkmark`), y afordancias como la zona de arrastre.

**No:** junto a un encabezado que ya nombra la sección, ni junto a un botón cuyo texto
ya dice lo mismo. Se eliminaron 12 de 36 por esta razón.

---

## 7. Contenedores: cuándo una caja está justificada

Anidar contenedores no es malo por sí mismo. El criterio es si la capa **hace** algo:

**Justificado**
- Un `div` sin clases que agrupa etiqueta y control: es una celda de la rejilla.
- Un contenedor con `grid`, `flex`, `space-y` o relleno: aporta estructura.
- Una tarjeta que agrupa contenido que de verdad se lee como una unidad.

**No justificado**
- Una tarjeta dentro de otra con **el mismo fondo y el mismo filete**: el marco interior
  no separa nada, solo dibuja una caja. Se sustituye por encabezado y espacio.
- Una caja con borde cuyo único contenido es un recuento o una insignia.
- Un envoltorio que solo repite el estilo de su hijo.

Verificación rápida del anidamiento de tarjetas:

```bash
grep -c 'rounded-lg border border-fog' src/features/**/*.tsx
```

Objetivo: **cero** tarjetas dentro de tarjetas.

---

## 8. Advertencia sobre Tailwind v4

Los tokens van en `@theme`, dentro de `apps/web/src/index.css`.

**Tailwind v4 ignora `tailwind.config.js`** salvo que se cargue explícitamente con
`@config`. Este proyecto tenía la paleta definida en ese archivo, con lo que 631 clases
de color no generaban ningún CSS: la barra de navegación y el botón de guardar quedaban
con texto blanco sobre fondo transparente, es decir, invisibles. El archivo se eliminó
para que no vuelva a inducir a error.

Al añadir un color, un tamaño o un radio, se declara en `@theme` y se documenta aquí.
