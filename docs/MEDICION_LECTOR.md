# Medicion del lector sobre hojas de vida escaneadas

Fecha de la medicion: agosto de 2026. Se reproduce con `npm run gen:scans` y `npm run bench:ocr`
desde `apps/web`.

## Por que se hizo

El banco automatico del lector marcaba **100% (165 de 165 campos)**, pero ese banco son diez PDF
generados con jsPDF, todos con capa de texto perfecta. Esa ruta (`pdf_text`) no es la que va a usar
Rosimar: lo que llega de verdad son escaneos y fotos, y esa ruta nunca se habia medido con material
representativo.

Este documento recoge la primera medicion honesta de la ruta de OCR y los arreglos que salieron
de ella.

## El banco de pruebas

40 hojas de vida colombianas sinteticas, orientadas a los cargos que contrata Rosimar
(administrativos y operativos), convertidas en **escaneos reales**: se maquetan en HTML, se
capturan en Chromium, se degradan en un canvas (ruido, perdida de contraste, iluminacion desigual,
inclinacion, motas, recompresion JPEG) y se empotran como una sola imagen en el PDF.

Ninguno de los 40 tiene capa de texto: `readPdfFile` los clasifica como escaneo y los manda por
Tesseract. Esa comprobacion forma parte de la verificacion.

**13 maquetaciones**: una columna, dos columnas con barra de color, sin ningun encabezado de
seccion, formulario tipo Minerva, denso a 7,5 pt en dos paginas, cuerpo grande muy espaciado,
cabecera oscura a sangre, secciones desordenadas con el contacto al final, tablas con bordes,
contacto en el pie, nombre pequeno con titulos enormes, serif italica inclinada y mecanografiada
monoespaciada.

**5 perfiles de degradado**: `limpio` (escaner de oficina), `medio` (fotocopia), `duro` (foto de
celular con sombra), `girado90` y `girado180`.

Las hojas largas (una columna, tablas y la densa de dos paginas) reciben un registro expandido con
cuatro empleos y tres estudios; el resto quedan cortas. La verdad de referencia se genera del mismo
registro que produce el documento, asi que no puede desincronizarse.

## Lo que aparecio: tres fallos reales

### 1. Los PDF escaneados no se podian leer en Chrome 141 ni anterior

pdfjs-dist 6 usa `Map.prototype.getOrInsertComputed` (proposal "Upsert") sin traer respaldo propio,
ni en el build moderno ni en el legacy. Chromium 141 no lo implementa, de modo que
`PDFPageProxy.render()` lanzaba:

```
TypeError: this[#methodPromises].getOrInsertComputed is not a function
```

Esa llamada esta **solo** en la ruta de los escaneos: un PDF con capa de texto usa `getTextContent()`
y nunca la toca. Por eso el banco de PDF digitales marcaba 100% mientras la lectura de escaneos
fallaba entera. Corregido con un respaldo de doce lineas en `src/lib/ocr/compat-upsert.ts`, importado
antes que pdf.js.

### 2. La binarizacion global destruia los escaneos dificiles

`image-prep.ts` aplicaba el umbral de Otsu, que elige **un solo umbral para toda la pagina**. En un
escaneo con vineta o sombra lateral eso inunda de negro los bordes y borra los bloques de fondo gris.

Medido sobre cuatro documentos del perfil `duro`, comparando el mismo pipeline con Otsu global y con
un umbral local de Sauvola:

| Documento | Otsu global | Sauvola local |
|---|---|---|
| `CV_04_formulario_duro` | 8 caracteres | 2.528 |
| `CV_22_tabla_duro` | 0 | 1.652 |
| `CV_12_italica_duro` | 0 | 454 |
| `CV_26_mecanografiada_duro` | 101 | 593 |

Se reemplazo por un umbral local de Sauvola con imagenes integrales (dos recorridos, el coste no
depende del tamano de la ventana), con **deteccion de polaridad**: cuando la media de la vecindad es
oscura se invierte antes de umbralizar. Sin esa segunda parte, las plantillas con barra lateral de
color o cabecera a sangre perdian entre 20 y 52 puntos, porque Sauvola supone tinta oscura sobre
papel claro y se llevaba por delante la letra clara.

### 3. El OCR no lee la arroba

De los 40 documentos, 20 se quedaban sin correo. En todos los casos revisados la direccion estaba
ahi y lo que fallaba era el glifo `@`:

```
martha.caicedoOQ correo.com     monica.salazarO correo.com
demurilloGhotmail.com           ferando.medinaElogistica.co
```

Se anadio una reconstruccion acotada en `fields/personal.ts`: solo actua cuando la busqueda normal
no encuentra nada, y solo acepta el resultado si el dominio es conocido o el usuario tiene la forma
`nombre.apellido`. Los correos vacios bajaron de 20 a 11.

## Resultado

Precision global (similitud media de todos los campos de los 40 documentos):

| | Precision global |
|---|---|
| Linea base | **63,4%** |
| + umbral local de Sauvola | 68,5% |
| + deteccion de polaridad | 72,5% |
| + reconstruccion del correo | **73,9%** |

20 documentos mejoran, 13 quedan igual y 7 empeoran ligeramente respecto a la linea base.

### Por campo

| Campo | Aciertos | % acierto | Similitud media |
|---|---|---|---|
| firstNames | 32/40 | 80,0% | 83,4% |
| lastNames | 31/40 | 77,5% | 83,5% |
| documentNumber | 31/40 | 77,5% | 79,5% |
| phone | 29/40 | 72,5% | 76,3% |
| cityResidence | 28/40 | 70,0% | 72,8% |
| education (cantidad) | 28/40 | 70,0% | 83,3% |
| headline | 27/40 | 67,5% | 75,1% |
| experience (cantidad) | 24/40 | 60,0% | 75,0% |
| skills | 23/40 | 57,5% | 72,5% |
| education[].institution | 23/40 | 57,5% | 74,7% |
| email | 20/40 | 50,0% | 67,5% |
| education[].degree | 20/40 | 50,0% | 70,2% |
| experience[].company | 20/40 | 50,0% | 60,3% |
| experience[].position | 19/40 | 47,5% | 59,9% |

### Por perfil de degradado

| Perfil | Docs | Precision real | Confianza que reporta el motor |
|---|---|---|---|
| medio | 15 | 88,9% | 87,6% |
| limpio | 13 | 87,3% | 86,9% |
| duro | 9 | 50,0% | 68,2% |
| girado90 | 2 | 16,2% | 66,2% |
| girado180 | 1 | 4,1% | 40,5% |

### Por maquetacion

| Plantilla | Precision real |
|---|---|
| grande | 95,3% |
| sin-encabezados | 92,2% |
| dos-columnas | 91,9% |
| mecanografiada | 88,9% |
| una-columna | 87,3% |
| contacto-pie | 79,1% |
| italica | 75,1% |
| desordenado | 70,6% |
| nombre-pequeno | 69,5% |
| denso-2p | 62,1% |
| cabecera-oscura | 60,7% |
| tabla | 56,4% |
| formulario | 26,6% |

## Comparacion de las tres rutas

| | PDF digital | Escaneo sintetico | Imagenes reales |
|---|---|---|---|
| Documentos | 10 | 40 | 14 |
| Idioma | espanol | espanol | ingles |
| Precision | 100% (165/165 campos) | 73,9% | correo 4/14, nombre ~12/14 |
| Tiempo por documento | menos de 1 s | 4,5 s | 4-10 s |

El 100% de la ruta digital sigue intacto: las 52 pruebas pasan y el banco de PDF digitales se
mantiene en 165 de 165.

## Lo que queda pendiente, por orden de impacto

1. **Orientacion.** Una pagina girada 90 o 180 grados es hoy una perdida casi total (16,2% y 4,1%).
   `image-prep.ts` endereza mas o menos cinco grados, que cubre el papel torcido en el cristal pero
   no la hoja metida al reves. Probar las cuatro rotaciones sobre una muestra reducida y quedarse
   con la de mayor confianza media es barato y convierte un fallo total en una lectura normal.
2. **Formularios de etiqueta y valor (26,6%) y tablas con bordes (56,4%).** Son justo el formato mas
   comun en el archivo fisico colombiano. El agrupador de renglones fusiona la celda de etiqueta con
   la de valor cuando el borde se degrada.
3. **Empresa y cargo de cada empleo (47-50%).** Es el campo estructurado mas debil.
4. **El indicador de confianza es sistematicamente optimista.** Correlaciona bien en conjunto
   (0,87), pero reporta 80,8% de media cuando la precision real es 73,9%, y se equivoca mas
   justo donde importa: `girado90` reporta 66,2% con 16,2% real. Sigue premiando rellenar campos
   en vez de acertarlos (`index.ts`, `evaluarCalidad`).
5. **Ritmo.** 4,5 s por documento son unas **1,26 h para 1.000 hojas de vida**, en serie y con la
   pestana abierta. Un pool de dos a cuatro workers de Tesseract con `createScheduler` lo baja a
   la mitad o menos.

## Como reproducirlo

```bash
cd apps/web
npm run gen:scans     # genera los 40 escaneos y la verdad de referencia
npm run bench:ocr     # los pasa por el motor real e imprime el informe
npm run bench:ocr CV_04   # un solo documento, para depurar
```

`test-scans/` no se versiona: son 22 MB de JPEG que el generador reproduce identicos con un comando.
El detalle campo por campo de la ultima ejecucion queda en `test-scans/resultados-bench.json`.

El banco corre el pipeline **real**: `bench-ocr.html` importa `processDocument`, la misma funcion que
usa la aplicacion. Es la leccion del PR #1, donde unas pruebas que reimplementaban el camino del
motor pasaban en verde mientras el motor estaba roto.
