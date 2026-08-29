Para procesar hojas de vida escaneadas sin depender de LLMs ni incurrir en sobreingeniería, la mejor estrategia es construir un **pipeline determinista de 2 etapas**:

1. **Reconocimiento Óptico y Ordenamiento Espacial:** Limpiar la imagen y extraer el texto junto con sus coordenadas $(x, y)$ para no perder la lectura por columnas.

2. **Extracción por Reglas y PLN Tradicional:** Aplicar expresiones regulares (Regex) y clasificadores de PLN ligero (spaCy/NER) sobre el texto plano ordenado.

A continuación se detallan los repositorios clave de GitHub que puedes combinar, qué aprovechar de cada uno y cómo integrarlos de forma óptima:

### **Repositorios Recomendados y Links Directos**

#### **1\. Para OCR y Análisis de Estructura de Columnas**

* [**PaddleOCR (PaddlePaddle/PaddleOCR)**](https://github.com/PADDLEPADDLE/PaddleOCR)  
  \[cite: 1\]  
  * **Qué usar:** El módulo PP-StructureV3 o PP-OCRv6. No requiere modelos generativos complejos ni consumo en la nube.

  * **Cómo usarlo:** Procesa el archivo escaneado para detectar los bloques de texto y sus coordenadas (bbox). Permite separar físicamente la columna izquierda (generalmente datos de contacto y habilidades) de la columna derecha (experiencia y educación) mediante un simple filtro por la coordenada $X$ central de la página.

* [**LiteParse (run-llama/liteparse)**](https://github.com/run-llama/liteparse)  
  \[cite: 2\]  
  * **Qué usar:** Su motor local basado en PDFium y Tesseract/EasyOCR. Es ultraligero y libre de dependencias pesadas de IA.

  * **Cómo usarlo:** Llama a su API local para obtener un JSON rápido con la estructura: { "text": "...", "bbox": \[x1, y1, x2, y2\], "confidence": 0.95 }. A partir de los bbox, puedes ordenar las líneas de texto exactamente en el orden en que un humano las leería.

#### **2\. Para Limpieza y Acondicionamiento de la Imagen**

* [**Universal Resume Parser (shyam3raju/Resume-parser)**](https://github.com/shyam3raju/Resume-parser)  
  \[cite: 3\]  
  * **Qué usar:** Sus funciones de preprocesamiento de imágenes basadas en OpenCV (ajuste de contraste, eliminación de fondos de color y detección de bordes de columnas).

  * **Cómo usarlo:** Antes de pasar el archivo escaneado por el motor de OCR, ejecuta las rutinas de limpieza de este repositorio para eliminar ruido óptico y sombras del escáner, lo que incrementa sustancialmente la precisión del OCR.

#### **3\. Para Extracción Estructurada Determinista (Sin LLM)**

* [**PyResume / LeverParser (wespiper/pyresume)**](https://github.com/wespiper/pyresume)  
  \[cite: 4\]  
  * **Qué usar:** Sus módulos deterministas de expresiones regulares (patterns.py, dates.py, phones.py) que replican el comportamiento del sistema ATS Lever.

  * **Cómo usarlo:** Una vez que el OCR te entrega el texto ordenado por columnas, pásalo directamente por pyresume. Extraerá el nombre, correo, teléfono, fechas de empleo en múltiples formatos ("Jan 2020", "01/2020", "Presente") y rangos de experiencia en menos de 2 segundos de forma 100% offline.

* [**Advanced Resume Parser (itsadhil/Advanced-Resume-Parser)**](https://github.com/itsadhil/Advanced-Resume-Parser)  
  \[cite: 5\]  
  * **Qué usar:** Su sistema de extracción de secciones y habilidades basado en la librería de PLN spaCy (PhraseMatcher y reglas de entidades).

  * **Cómo usarlo:** Utilízalo para mapear y clasificar bloques de texto en categorías fijas ("Educación", "Experiencia Laboral", "Proyectos") y comparar las palabras clave encontradas contra su base de datos estandarizada de habilidades y profesiones sin depender de ningún modelo generativo.

### **La Forma MÁS EFICIENTE de Unirlos (Pipeline Arquitectónico)**

Para evitar sobreingeniería y mantener la velocidad, puedes estructurar el flujo de trabajo en 3 pasos sencillos dentro de un script de Python:

\[ PDF Escaneado / Imagen \]  
            │  
            ▼  
 1\. Preprocesamiento de Imagen (Resume-parser / OpenCV)  
            │  (Aumenta contraste y remueve fondo)  
            ▼  
 2\. Layout OCR \+ Spatial Ordering (PaddleOCR / LiteParse)  
            │  (Extrae bloques \[Texto \+ Coordinates\])  
            │  (Agrupa por columnas y ordena de arriba a abajo)  
            ▼  
 3\. Extracción de Datos y Normalización (PyResume \+ spaCy)  
            │  (Regex para Contacto/Fechas \+ Matcher para Habilidades)  
            ▼  
    \[ JSON Estructurado Final \]

### **Ventajas de este enfoque tradicional:**

* **Cero Alucinaciones:** Toda la información en el JSON resultante proviene exactamente de lo que leyó el OCR.

* **Velocidad Extrema:** Procesa cada hoja de vida en 1-2 segundos en una CPU convencional.  
* **Privacidad y Costo Cero:** Funciona 100% de forma local, offline y sin consumo de APIs externas.  
