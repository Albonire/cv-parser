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

## Lo que aparecio al medir

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

### 4. El clasificador daba por no-hoja-de-vida casi cualquier hoja de vida

La regresion mas grave de todas: el banco cayo de **73,9% a 19,6%** y plantillas
que estaban en 87-95% se quedaron en **0,0%**, con las 115 pruebas unitarias en
verde. `npm test` no incluye el banco de OCR, asi que nada lo delataba.

Tres causas, todas por buscar palabras sueltas:

- `if (lower.includes('funciones')) return 'funciones'`. "Responsable de las
  **funciones** propias del cargo" aparece en la experiencia de practicamente
  cualquier hoja de vida. Ahora se exige un encabezado de verdad ("manual de
  funciones", "funciones del cargo", "descripcion de funciones").
- `lower.includes('prima')` puntuaba 3 hacia liquidacion, y **"Primaria"** es el
  nivel educativo que aparece en casi todas las hojas de vida colombianas. Ahora
  se busca con frontera de palabra, excluyendo "primaria" y "primario".
- El curriculum se evaluaba el ultimo, despues de contrato y liquidacion. Ahora,
  con dos senales fuertes de curriculum, se resuelve antes de mirar el resto.

El resto de claves siguen buscandose por subcadena a proposito: en las fotos de
WhatsApp el OCR pega las palabras ("TERMINOACONTRATO") y exigir frontera alli
rompia el reconocimiento de contratos degradados.

`document-classifier.test.ts` fija ahora las dos direcciones: la hoja de vida no
se pierde, y contrato, liquidacion, memorando y manual de funciones se siguen
reconociendo.

Ademas, una hoja de vida **sin ningun encabezado** no da ninguna palabra clave y
se queda en `desconocido`. En vez de mandarla al aviso de documento no
estructurado, se intenta leerla y se asciende a hoja de vida solo si el
resultado trae datos de una persona (nombre mas contacto o trayectoria). Nunca
se fuerza un formulario vacio.

### 5. La eleccion entre gris y binarizada se decidia por confianza

El motor probaba primero la escala de grises, que es lo correcto para las fotos
de camara, y aceptaba el resultado si tenia texto suficiente con confianza alta.
El problema: **cuando Tesseract no encuentra nada devuelve confianza 95**, porque
no hay nada de lo que dudar. Medido, una pagina del perfil duro daba 43
caracteres con confianza 92 y se aceptaba, cuando la binarizada de la misma
pagina daba 2.197.

Ahora la lectura en grises se da por buena solo con **400 caracteres y confianza
0,80**; si no, se lee tambien la binarizada y gana la que reconocio mas texto,
ponderado por confianza.

### 6. Una pagina girada era una lectura perdida entera

`image-prep` endereza mas o menos cinco grados, que cubre el papel torcido en el
cristal pero no la hoja metida al reves.

La sonda de orientacion es un OCR sobre la pagina reducida a 800 px. La senal que
discrimina es la **confianza**, no la cantidad de texto: girada, Tesseract sigue
emitiendo cientos de caracteres pero baja de 92-95 a 38-51.

Dos decisiones para que no cueste tiempo en el caso corriente:

- **Poda por proporcion.** Una hoja vertical solo puede estar a 0 o 180 grados;
  una apaisada, a 90 o 270. Sin esta poda el sondeo llegaba a girar 90 grados
  paginas verticales que estaban perfectamente derechas, y el perfil `medio`
  perdia 12 puntos.
- **Solo se sondea cuando hace falta.** Una pagina vertical se lee primero; si la
  lectura sale bien no se sondea nada. Una apaisada se sondea antes de leerla,
  porque leerla de lado no cuesta menos y no sirve de nada.

El coste queda concentrado donde hay problema: `limpio` 3,8 s por documento,
`duro` 12,7 s.

### 7. El proyecto no compilaba y `npm run typecheck` no lo veia

`npm run build` fallaba en `main` con 24 errores de tipos. No se habia notado
porque `typecheck` era `tsc --noEmit` sobre el `tsconfig.json` raiz, que tiene
`"files": []` y solo referencias: **no comprobaba ni un archivo**. Ahora es
`tsc -b`, que es lo que comprueba el proyecto de verdad, y hay CI.

## Resultado

Precision global (similitud media de todos los campos de los 40 documentos):

| | Precision global |
|---|---|
| Primera medicion, antes de arreglar nada | **63,4%** |
| + umbral local de Sauvola | 68,5% |
| + deteccion de polaridad | 72,5% |
| + reconstruccion del correo | 73,9% |
| Regresion introducida despues por el clasificador | **19,6%** |
| + clasificador corregido | 64,1% |
| + eleccion de preprocesado por cantidad de texto | 68,4% |
| + telefono por fragmento | 69,1% |
| + deteccion de orientacion | 73,3% |
| + hoja de vida sin encabezados por evidencia | **75,5%** |

La caida a 19,6% no fue un cambio del motor sino del clasificador de documentos:
seis de cada nueve hojas de vida salian como "documento no estructurado" y
llegaban al formulario vacias. Esta documentada mas abajo.

### Por campo

| Campo | Aciertos | % acierto | Similitud media |
|---|---|---|---|
| firstNames | 32/40 | 80,0% | 84,0% |
| lastNames | 31/40 | 77,5% | 82,7% |
| headline | 31/40 | 77,5% | 83,5% |
| education (cantidad) | 31/40 | 77,5% | 90,8% |
| cityResidence | 28/40 | 70,0% | 72,6% |
| experience (cantidad) | 27/40 | 67,5% | 81,3% |
| education[].institution | 27/40 | 67,5% | 82,4% |
| documentNumber | 26/40 | 65,0% | 68,5% |
| email | 24/40 | 60,0% | 68,8% |
| education[].degree | 24/40 | 60,0% | 79,4% |
| skills | 24/40 | 60,0% | 73,8% |
| phone | 23/40 | 57,5% | 59,3% |
| experience[].position | 22/40 | 55,0% | 65,9% |
| experience[].company | 20/40 | 50,0% | 63,5% |

### Por perfil de degradado

| Perfil | Docs | Precision real | Confianza que reporta el motor |
|---|---|---|---|
| limpio | 13 | 88,1% | 87,5% |
| girado180 | 1 | 86,2% | 85,9% |
| medio | 15 | 82,8% | 84,6% |
| girado90 | 2 | 55,5% | 72,3% |
| duro | 9 | 48,1% | 68,0% |

La orientacion era el fallo mas caro del motor: girado 180 grados pasa de **4,1%
a 86,2%** y girado 90 grados de **12,0% a 55,5%**.

### Por maquetacion

| Plantilla | Precision real |
|---|---|
| grande | 95,0% |
| cabecera-oscura | 90,6% |
| mecanografiada | 88,9% |
| sin-encabezados | 88,6% |
| una-columna | 85,9% |
| contacto-pie | 84,4% |
| dos-columnas | 82,6% |
| italica | 76,7% |
| nombre-pequeno | 73,8% |
| desordenado | 70,6% |
| tabla | 56,4% |
| denso-2p | 44,2% |
| formulario | 39,8% |

## Comparacion de las tres rutas

| | PDF digital | Escaneo sintetico | Imagenes reales |
|---|---|---|---|
| Documentos | 10 | 40 | 14 |
| Idioma | espanol | espanol | ingles |
| Precision | 100% (165/165 campos) | 75,5% | correo 4/14, nombre ~12/14 |
| Tiempo por documento | menos de 1 s | 6,9 s | 4-10 s |

El 100% de la ruta digital sigue intacto: las 52 pruebas pasan y el banco de PDF digitales se
mantiene en 165 de 165.

## Lo que queda pendiente, por orden de impacto

1. **Formularios de etiqueta y valor (39,8%) y tablas con bordes (56,4%).** Son
   justo el formato mas comun en el archivo fisico colombiano. El agrupador de
   renglones fusiona la celda de etiqueta con la de valor cuando el borde se
   degrada.
2. **Hojas de vida largas y densas (44,2%).** Dos paginas a 7,5 pt: el OCR lee el
   texto pero los extractores se pierden entre tanta linea.
3. **Empresa y cargo de cada empleo (50-55%).** Es el campo estructurado mas
   debil.
4. **El giro de 90 grados se queda a medias (55,5%).** La orientacion ya se
   detecta y se corrige, pero el resultado sigue por debajo de la misma
   maquetacion derecha: queda ver si es la calidad de la imagen girada o la
   maquetacion reconstruida.
5. **Ritmo.** 6,9 s por documento son unas **1,9 h para 1.000 hojas de vida**, en
   serie y con la pestana abierta. Un pool de dos a cuatro workers de Tesseract
   con `createScheduler` lo baja a la mitad o menos.
6. **El selector de rol de la barra de navegacion** deja que cualquiera se ponga
   `admin` desde el navegador. No es un asunto de interfaz sino de autenticacion,
   y va con la conversacion de roles que quedo pendiente.

## Banco de contratos

El contrato en papel de Rosimar es una tabla de dos columnas con la etiqueta a la
izquierda y el valor a la derecha, titulo centrado a todo el ancho y las celdas de
las dos columnas desfasadas media fila. `npm run gen:contratos` reproduce ese
documento como escaneo y `npm run bench:contratos` lo mide.

Habia una prueba anterior de "tabla de dos columnas" que pasaba, pero su fixture
estaba moldeado al algoritmo: variaba el tamano de fuente 0,001 pt por palabra
para forzar a pdf.js a separar los items, acortaba el titulo para que no cruzara
el canal entre columnas, alineaba las filas perfectamente y era un PDF digital en
vez de un escaneo. Se conserva (cubre la ruta `pdf_text`) y al lado esta ahora la
del documento real.

Primera medicion sobre el formato real:

| | Precision |
|---|---|
| Antes de tocar nada | 16,1% |
| Corrigiendo el emparejamiento etiqueta/valor | **18,1%** |
| Solo la variante que copia el documento real | 26,2% -> **32,9%** |

Dos defectos corregidos, los dos generales:

- **`findLabeledValueOrNextLine` tomaba como valor el renglon siguiente aunque el
  renglon actual YA trajera el valor.** "NIT No. 901.167.955-4" pasaba por ser la
  etiqueta "nit" y el parser se llevaba la etiqueta de la fila de abajo. Ahora el
  renglon tiene que ser exactamente la etiqueta.
- **La geometria manda sobre el heuristico de renglon siguiente.** Cuando se
  detectan dos columnas los renglones vienen ordenados columna por columna, asi
  que "el siguiente" es la etiqueta de la fila de abajo y no el valor.

Ademas, los campos del trabajador se buscan primero en su bloque de la tabla: el
contrato repite "Identificacion:" y "Domicilio:" para la empresa y para la
persona, y sin acotar se tomaba siempre el primero (la cedula salia con el NIT y
el correo con el corporativo). El acotado es una preferencia, no un filtro: si no
encuentra, reintenta en el documento entero.

Lo que queda: **la maquetacion de la tabla**. Cuando las celdas de las dos
columnas estan alineadas, el agrupador de renglones funde la tabla entera en dos
o tres lineas ilegibles; la variante desfasada se lee mejor justamente porque el
desfase separa las filas. Es trabajo sobre `layout.ts` y ahora esta medido.

## Segunda tanda: la regresion de `4ae4dce` y los contratos

Septiembre de 2026. Un commit directo a `main` subio mucho el banco de contratos y a cambio bajo el
de hojas de vida, con el CI en verde: `npm test` no incluye los bancos, asi que las pruebas
unitarias no ven el motor. Todas las cifras de aqui son la precision global que reporta el banco
(media por documento).

| | Hojas de vida | Contratos | Tiempo/doc |
|---|---|---|---|
| Antes de `4ae4dce` | 77,3% | 18,1% | 6,3 s |
| Despues de `4ae4dce` | 69,1% | 66,5% | 8,9 s |
| Tras esta tanda | **76,0%** | **72,5%** | **6,0 s** |

### La altura de referencia del agrupado tiene que ser del renglon

`groupWordsIntoRows` paso a calcular la altura del umbral de solapamiento una sola vez por pagina,
tomada de la primera palabra del orden. En un contrato funciona porque todas las celdas miden igual.
En una hoja de vida la primera palabra es el titulo: con 24 pt el umbral queda en 9,6 px y dos
palabras de la misma linea con cajas distintas ("Telefono:" con ascendentes, "3184567821" sin ellas)
se solapan menos que eso y acaban en renglones separados. Medido en la prueba: el cuerpo de dos
lineas salia partido en cinco renglones, uno por palabra.

### La segunda lectura de OCR solo se paga cuando puede servir

Leer siempre la fuente original ademas de la escala de grises cuesta un OCR entero por pagina y en
una hoja de vida de una columna no aporta nada: las dos lecturas dan el mismo texto exacto (CV_01,
1.526 caracteres las dos).

No se puede decidir con la confianza, porque Tesseract la devuelve alta aunque no haya encontrado
casi nada: en CT_07 la lectura en gris da 319 caracteres con confianza 94 frente a los 2.206 de la
fuente. La señal que si separa los dos casos es cuantos renglones trae la lectura:

  hay que leer la fuente:  CT_09 3, CT_07 6, CT_11 8, CT_05 9 renglones
  se basta el gris:        CT_10 19, CT_06 23, CV_01 31, CV_02 34, CT_01 43

El umbral queda en 15. Precision intacta en los dos bancos y 18% menos de tiempo.

### La arroba es el caracter que peor lee Tesseract

`workerEmail` salia vacio en 10 de los 12 contratos, tambien en los limpios. El OCR no pierde la
arroba: la lee como otro glifo, y de tres formas distintas.

    gerencia Qrosimar.com.co     el glifo pegado al dominio
    jhon.ospinaQ gmail.com       el glifo pegado al usuario
    demurilloGhotmail.com        el glifo dentro de una sola palabra

Lo que permite desambiguar es que el glifo que suplanta a la arroba sale siempre en mayuscula o como
simbolo dentro de una direccion en minusculas, asi que la "g" de "gmail" no se confunde con una
arroba mal leida. `correo-ocr.ts` es comun a las dos rutas. Contratos 66,5% -> 71,2%, `workerEmail`
de 17% a 67%; en hojas de vida los correos exactos pasan de 26/40 a 27/40.

### Vacio antes que inventado

Tres campos devolvian datos falsos en vez de quedarse vacios, y en un lote un hueco se ve pero un
dato equivocado no:

- El **nombre del trabajador** salia como "30 dias. Empleador: 30 dias" en tres documentos. La fila
  de preaviso empieza literalmente por "Trabajador:", asi que la etiqueta casa con ella.
- La **fecha de inicio** salia como "7025-01-02" en CT_04: el OCR leyo el 2 del anio como 7. De las
  dos correcciones posibles del digito de las milesimas solo una puede caer en 1900-2100, porque los
  tramos no se solapan, asi que no hay ambiguedad.
- El **salario** llegaba al formulario como 0 cuando no se encontraba.

Conviene tener presente al leer las cifras que **cambiar un dato falso por un campo vacio BAJA la
medida**: la similitud da credito parcial a una cadena equivocada que comparte caracteres con la
esperada, y cero a la vacia. Solo el descarte del preaviso y del domicilio costaba medio punto. Si
la medida y no inventar entran en conflicto, manda no inventar.

### Lo que no se pudo arreglar, y por que

`position` se queda en 50% y falla incluso en escaneos limpios (CT_03, CT_05). No es un fallo del
analizador: **los rotulos "Cargo" y "Salario" no estan en la salida del OCR**. Comprobado sobre
CT_03 con las tres variantes de preprocesado (fuente, gris y binarizada) y con los cinco modos de
segmentacion de Tesseract:

| Modo | fuente | gris |
|---|---|---|
| AUTO (el actual) | 865 | **1.090** |
| AUTO_OSD | 1 | 1 |
| SPARSE_TEXT | 429 | 435 |
| SINGLE_BLOCK | 293 | 287 |
| SINGLE_COLUMN | 482 | 515 |

AUTO es el mejor con diferencia y ninguno recupera los rotulos. La via del modo de segmentacion
queda cerrada. Recuperar el cargo exigiria suponer el orden de las filas de esta plantilla, que es
justo lo que no se quiere: seria una regla pegada a un documento concreto.

Aviso para quien retome esto: `scripts/experimento-ocr.mjs` prueba modos de segmentacion pasandolos
en el tercer argumento de `worker.recognize`, que en tesseract.js es `OutputFormats` (que salidas
devolver), no parametros. Por eso sus doce variantes daban exactamente el mismo numero de
caracteres. El modo se cambia con `worker.setParameters({ tessedit_pageseg_mode })`.

## CLAHE: por que no esta

Hubo una llamada a CLAHE para las fotos de bajo contraste. Se retiro con el numero
delante: nunca llego a ejecutarse (el limite de recorte se calculaba por bloque
entero, 8.192 sobre bloques de 4.096 pixeles, y la medida de contraste era maximo
menos minimo global, que satura a 255 con una sola mota). Al corregir las dos
cosas resulto que **hunde el perfil duro de 51,0% a 3,9%** y duplica el tiempo por
documento: pese al comentario no interpolaba entre bloques, dejando costuras duras
cada 64 px, y recalculaba la funcion acumulada para cada pixel.

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
