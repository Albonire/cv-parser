# **Evaluación de Tecnologías en GitHub para el Procesamiento OCR y Extracción Estructurada de Hojas de Vida Escaneadas**

El procesamiento automatizado de hojas de vida o currículums (CV) en formato de imagen o PDF escaneado representa uno de los retos más complejos dentro del campo del Procesamiento Inteligente de Documentos (IDP)1. La diversidad de diagramaciones tipográficas, la disposición en múltiples columnas visuales, la ausencia de etiquetas estandarizadas y el ruido óptico derivado del proceso de digitalización impiden que los sistemas tradicionales de Reconocimiento Óptico de Caracteres (OCR) extraigan la información de manera precisa mediante una sola etapa de procesamiento1. Lograr una extracción exhaustiva que convierta un documento escaneado en un registro JSON completamente verídico y estructurado exige trascender el simple reconocimiento de caracteres, combinando motores de visión computacional, análisis de maquetación espacial (*layout parsing*) y modelos de lenguaje de gran escala (LLM) guiados por esquemas de datos estrictos5.

## **Complejidad del Procesamiento de Hojas de Vida Escaneadas y Evolución Paradigmática**

El requisito de extraer la totalidad de la información contenida en una hoja de vida escaneada minimizando cualquier margen de error requiere abordar dos fuentes principales de fallo: la imprecisión de detección gráfica y la desalineación de interpretación semántica1. El primer tipo de error ocurre cuando el motor OCR confunde caracteres debido a una baja resolución, inclinación de la página o artefactos de escaneo1. El segundo tipo surge cuando el sistema pierde el orden de lectura natural; por ejemplo, al leer horizontalmente a través de dos columnas independientes, lo que mezcla cargos, fechas y descripciones de empresas distintas1.  
Las soluciones históricas desarrolladas en el ecosistema de código abierto, como la biblioteca pyresparser, utilizaban reglas heurísticas, expresiones regulares y canalizaciones de Procesamiento del Lenguaje Natural (PLN) tradicionales basadas en bibliotecas como spaCy y NLTK3. Aunque estas arquitecturas funcionaban de manera aceptable en textos digitales planos, demostraron una marcada fragilidad estructural frente a documentos gráficos o maquetaciones creativas3. Además, estas bibliotecas heredadas enfrentan serios problemas de obsolescencia en GitHub debido a incompatibilidades estricta de versiones en sus dependencias subyacentes15.  
La evolución tecnológica ha desplazado estas aproximaciones rígidas hacia un paradigma de tres etapas sucesivas5. En la primera etapa, un motor de análisis visual y OCR reconoce la topología de la página y extrae el texto preservando las coordenadas espaciales y la jerarquía de los elementos5. En la segunda etapa, un modelo de visión y lenguaje (VLM) o un LLM especializado procesa la estructura interlineal para reconstruir el flujo de lectura y convertirlo en un formato intermedio formateado, como Markdown5. Finalmente, un motor de inferencia semántica mapea el texto enriquecido hacia un esquema JSON estricto respaldado por tipos de datos validados, lo que garantiza la integridad de los datos extraídos7.

## **Motores de OCR y Analizadores de Maquetación Espacial en GitHub**

Para procesar el escaneo inicial y convertir la hoja de vida en un formato legible por modelos semánticos, el ecosistema de GitHub ofrece diversos proyectos de infraestructura que destacan por su precisión en documentos complejos.

### **PaddleOCR y PaddleOCR-VL (PADDLEPADDLE/PaddleOCR)**

El repositorio oficial de PaddleOCR representa uno de los marcos de trabajo de código abierto más avanzados y de mayor rendimiento para el reconocimiento óptico y el análisis documental5. Dentro de su ecosistema, el modelo PaddleOCR-VL-1.6 destaca como un modelo de visión y lenguaje ligero de 0.9B parámetros diseñado específicamente para la extracción en documentos estructurados5. Este modelo alcanza un 96.3% de precisión en la evaluación OmniDocBench v1.6, liderando el reconocimiento de texto, fórmulas y tablas en documentos desafiantes y exportando los resultados directamente a formatos estructurados en Markdown y JSON5.  
Para resolver el problema de las hojas de vida compuestas por bloques visuales complejos, el módulo PP-StructureV3 analiza la estructura espacial del archivo, proporcionando coordenadas detalladas a nivel de celda en tablas y delimitadores de párrafos5. Complementariamente, la versión PP-OCRv6 unifica el soporte para más de 100 idiomas mediante un único modelo unificado, logrando un incremento del \+4.6% en precisión de detección y \+5.1% en reconocimiento respecto a sus versiones previas, con una aceleración de inferencia en CPU de 5.2 veces5.

### **MinerU (opendatalab/MinerU)**

MinerU es una herramienta de extracción documental orientada a transformar PDFs complejos e imágenes escaneadas en formatos Markdown y JSON preparados para flujos de trabajo con agentes de inteligencia artificial11. MinerU integra una arquitectura de doble motor que combina modelos de visión y lenguaje con OCR tradicional, detectando automáticamente si un documento está escaneado o contiene caracteres corruptos para activar el procesamiento óptico dinámicamente11.  
La actualización MinerU2.5-Pro incorpora soporte nativo para 109 idiomas y utiliza el motor PP-OCRv6, lo que incrementa la precisión de lectura en un 11% global sobre benchmarks de documentos no estructurados11. Esta plataforma destaca por su capacidad para eliminar encabezados y pies de página redundantes, fusionar párrafos divididos entre páginas y convertir tablas complejas con celdas combinadas en código HTML limpio, preservando el orden de lectura humano11.

### **Unstructured (Unstructured-IO/unstructured)**

La biblioteca Unstructured constituye una solución ETL (*Extract, Transform, Load*) diseñada para ingerir y preprocesar documentos no estructurados hacia arquitecturas de IA2. Para hojas de vida escaneadas, la biblioteca ofrece estrategias de particionado adaptativas18:

* **Estrategia hi\_res:** Utiliza modelos de detección de maquetación basados en detectron2\_onnx o YOLO para clasificar las regiones de la imagen en títulos, listas, textos narrativos y tablas antes de invocar el reconocimiento de texto, lo que resulta fundamental para analizar CVs con columnas múltiples18.  
* **Estrategia ocr\_only:** Dirige el documento completo a través del motor Tesseract para extraer el texto cuando no se dispone de modelos de maquetación profunda, reordenando posteriormente las cadenas extraídas18.  
* **Estrategia fast:** Indicada únicamente para PDFs que ya poseen una capa de texto legible, extrayendo los caracteres directamente sin activar procesamiento gráfico18.

### **LiteParse (run-llama/liteparse)**

LiteParse es una herramienta ligera centrada en la extracción rápida de datos espaciales mediante PDFium, diseñada para ejecutarse localmente17. Proporciona una arquitectura de OCR extensible que permite conectar servidores externos basados en EasyOCR, PaddleOCR o Surya a través de una especificación API HTTP estandarizada, retornando las cadenas reconocidas junto con sus cajas delimitadoras (*bounding boxes*) y puntajes de confianza17.

## **Proyectos Especializados en Parsing de Hojas de Vida en GitHub**

Dentro del dominio específico de la extracción de hojas de vida, la comunidad de GitHub ha desarrollado repositorios que combinan técnicas de OCR con procesamiento semántico.

### **Universal Resume Parser (shyam3raju/Resume-parser)**

Este proyecto implementa una canalización diseñada específicamente para acondicionar el texto escaneado de un CV y entregarlo en un formato optimizado para LLMs como Gemini o Claude1. El sistema aplica técnicas de mejoramiento de imagen que incluyen ajuste de contraste y eliminación de fondos de color para maximizar la efectividad del OCR1. Posteriormente, detecta los límites de las columnas y reordena el contenido en un flujo lógico descendente, inyectando marcadores de sección claros (tales como \=== SECTION \===)1. Esta eliminación de formato visual irrelevante previene que los modelos de lenguaje alucinen o dupliquen información durante la conversión a JSON1.

### **PyResume / LeverParser (wespiper/pyresume)**

PyResume es una biblioteca en Python desarrollada para emular el comportamiento del sistema de seguimiento de candidatos (ATS) Lever24. Ejecuta el procesamiento de forma totalmente local, logrando tiempos de extracción inferiores a dos segundos por documento con una precisión superior al 95% en información de contacto y 90% en experiencia laboral sobre PDFs digitales24. No obstante, PyResume carece de un motor OCR nativo integrado en su versión estable actual, dependiendo de una capa de extracción previa cuando se enfrenta a imágenes o archivos escaneados24.

### **Parsers Basados en Esquemas de LLM (orasik/resume-parser, Reverse-ATS, TalentAI)**

Repositorios como orasik/resume-parser o proyectos de reclutamiento como Reverse-ATS y TalentAI han sustituido los algoritmos de extracción por reglas por canalizaciones impulsadas por LLMs locales impulsados por Ollama (tales como Qwen2.5 o Llama 3\)8. En estos proyectos, la estructura del documento se define mediante esquemas YAML o modelos de Pydantic8. La API recibe la hoja de vida, procesa el texto plano u óptico y fuerza al LLM a generar un objeto JSON alineado con la estructura configurada, mapeando secciones complejas como educación, certificaciones, proyectos y experiencia profesional con una tasa de error reducida8.

### **Obsolescencia de las Herramientas Basadas en Reglas**

La evaluación del ecosistema evidencia una clara obsolescencia de los proyectos basados en reglas estáticas3. Herramientas históricas como OmkarPathak/pyresparser han quedado discontinuadas debido a su incapacidad para procesar la flexibilidad tipográfica de las hojas de vida modernas3. El propio repositorio de ResumeParser ha migrado su núcleo funcional hacia modelos de IA generativa de ejecución local como Qwen2.5-1.5B-Instruct en formato GGUF mediante llama-cpp-python, demostrando que la extracción precisa sin errores requiere capacidades de comprensión contextual profunda26.

## **Arquitectura de Referencia para Extracción de Alta Fidelidad**

Para garantizar una extracción de datos de hojas de vida escaneadas libre de fallos, la arquitectura del sistema debe estructurarse en una canalización de tres capas acopladas secuencialmente.  
En la **Capa 1 (Preprocesamiento Gráfico y OCR de Maquetación)**, el archivo escaneado es procesado por un motor especializado como PaddleOCR-VL o MinerU5. En esta fase se realiza la corrección de rotación (*deskew*), la eliminación de ruido gráfico y el análisis de la maquetación para clasificar los bloques de texto según su posición visual1. El resultado de esta etapa es un documento alineado en formato Markdown que refleja la lectura jerárquica real, evitando que el texto de columnas adyacentes se entrelace erróneamente1.  
En la **Capa 2 (Mapeo Semántico Estructurado)**, el documento en Markdown se entrega a un Modelo de Lenguaje de Gran Escala mediante un mecanismo de decodificación restringida (*Structured Outputs*)1. El prompt del sistema incorpora el esquema estricto deseado, definiendo la tipología exacta de los campos que deben extraerse7:

* **Datos de Contacto:** Nombre completo, dirección de correo electrónico, número telefónico con prefijo internacional, enlaces a perfiles profesionales (LinkedIn, GitHub, portafolios) y ubicación geográfica3.  
* **Trayectoria Profesional:** Colección de experiencias ordenadas cronológicamente que incluyen el nombre de la empresa, el cargo desempeñado, la fecha de inicio, la fecha de finalización (o indicación de empleo actual) y la lista de responsabilidades o logros clave3.  
* **Formación Académica:** Registro de títulos obtenidos, instituciones educativas, áreas de estudio, año de titulación y reconocimientos honoríficos3.  
* **Competencias y Certificaciones:** Desglose categorizado de habilidades técnicas (*hard skills*), competencias interpersonales (*soft skills*), dominios lingüísticos con nivel de fluidez y certificaciones acreditadas con sus respectivas entidades emisorasa3.

En la **Capa 3 (Validación Determinista de Guardarraíles)**, los datos extraídos en JSON se procesan a través de validadores basados en Pydantic8. Esta capa aplica reglas de negocio estrictas: verifica la coherencia temporal (asegurando que las fechas de inicio sean anteriores a las de finalización), valida la sintaxis de los correos electrónicos e hipervínculos mediante expresiones regulares y formatea los números telefónicos a estándares internacionales8. Si un campo no supera la validación determinista, el sistema puede solicitar una re-evaluación localizada al LLM o marcar el dato específico para revisión humana, garantizando la total veracidad del resultado final8.

## **Análisis Comparativo de Proyectos y Herramientas en GitHub**

| Proyecto / Repositorio | Tipo de Solución | Engine de OCR / Parsing | Precisión en Escaneos | Formato de Salida | Privacidad / Ejecución Local |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **PADDLEPADDLE/PaddleOCR** \[cite: 5\] | Toolkit OCR / VLM Multilingüe | PaddleOCR-VL-1.6 / PP-StructureV3 | **Excepcional (96.3% en benchmarks)** \[cite: 5\] | Markdown, JSON espacial | 100% Local (CPU / GPU)5 |
| **opendatalab/MinerU** \[cite: 11\] | Extractor de Documentos Complejos | MinerU2.5-Pro \+ PP-OCRv6 | **Alta (Especializado en maquetación y tablas)** \[cite: 11\] | Markdown, JSON en orden de lectura | Local (Soporte Docker y GPU)21 |
| **Unstructured-IO/unstructured** \[cite: 2\] | Marco ETL de Ingesta de Datos | Detectron2 / ONNX \+ Tesseract | **Alta (Mediante estrategia hi\_res)** \[cite: 18\] | JSON Canónico con Metadatos32 | Local, Contenedor o Cloud2 |
| **shyam3raju/Resume-parser** \[cite: 1\] | Preprocesador de CVs para IA | Tesseract / PaddleOCR \+ LLM | **Alta (Optimizado para lectura de LLM)** \[cite: 1\] | Texto Jerárquico, JSON via AI1 | Híbrido (OCR Local \+ API LLM)1 |
| **wespiper/pyresume** \[cite: 24\] | Parser ATS (Compatibilidad Lever) | Extractor de Texto Nativo (pdfplumber) | **Baja en escaneos gráficos directos** \[cite: 24\] | Objetos Python, Archivos JSON24 | 100% Local y Offline24 |
| **orasik/resume-parser** \[cite: 25\] | API de Parsing con LLM | Extracción de Texto \+ OpenRouter LLM | **Depende del motor OCR previo** \[cite: 25\] | JSON Estructurado (config.yml)25 | Requiere API o LLM Local25 |
| **OmkarPathak/pyresparser** \[cite: 12\] | Parser de PLN Tradicional | spaCy v2 / NLTK (Descontinuado) | **Baja / Frágil frente a maquetaciones modernas** \[cite: 3, 14\] | Diccionario Python, JSON | 100% Local (Obsoleto)3 |

## **Conclusiones y Recomendaciones Técnicas**

Para implementar una solución en producción capaz de extraer la totalidad de la información de una hoja de vida escaneada sin cometer errores de interpretación, se recomiendan las siguientes pautas de ingeniería:

1. **Desacoplar la Lectura Visual de la Extracción Semántica:** No se debe confiar la extracción de datos directamente a un OCR convencional de línea de texto1. Es indispensable emplear un analizador de maquetación basado en visión computacional, como PaddleOCR-VL o MinerU, que convierta el PDF escaneado en un documento Markdown estructurado preservando el flujo de lectura real5.  
2. **Utilizar Extracción Guiada por Esquemas Validados:** El texto en Markdown obtenido del OCR debe procesarse utilizando un LLM configurado con salidas estructuradas obligatorias (*JSON Schema*)7. Esto asegura que el modelo no omita secciones del CV ni genere etiquetas inventadas1.  
3. **Implementar Guardarraíles de Validación Determinista:** Integrar una capa final basada en modelos de Pydantic para validar formalmente los tipos de datos, la lógica cronológica y los formatos de contacto8. Cualquier inconsistencia detectada en esta fase debe derivar en un proceso de re-evaluación focalizada, garantizando así la máxima fidelidad en la información extraída8.

#### **Fuentes citadas**

> 1. shyam3raju/Resume-parser \- GitHub, [https://github.com/shyam3raju/Resume-parser](https://github.com/shyam3raju/Resume-parser)  
> 2. Convert documents to structured data effortlessly. Unstructured is, [https://github.com/Unstructured-IO/unstructured](https://github.com/Unstructured-IO/unstructured)  
> 3. AI-Powered Resume Parser Project | PDF | Résumé \- Scribd, [https://www.scribd.com/document/897128079/Documentation-of-the-project-of-artificial-intelligence-resume-analyser](https://www.scribd.com/document/897128079/Documentation-of-the-project-of-artificial-intelligence-resume-analyser)  
> 4. Parse resumes in Python to power your HR tech platform | Affinda, [https://www.affinda.com/blog/parse-resume-python/](https://www.affinda.com/blog/parse-resume-python/)  
> 5. GitHub \- PaddlePaddle/PaddleOCR: Turn any PDF or image, [https://github.com/PADDLEPADDLE/PADDLEOCR](https://github.com/PADDLEPADDLE/PADDLEOCR)  
> 6. Open-Source Unstructured Data ETL 2026: Unstract \+ Ollama \+, [https://unstract.com/blog/open-source-document-data-extraction-with-unstract-deepseek/](https://unstract.com/blog/open-source-document-data-extraction-with-unstract-deepseek/)  
> 7. What is JSON Schema Extraction? \- LlamaIndex, [https://www.llamaindex.ai/glossary/json-schema-extraction](https://www.llamaindex.ai/glossary/json-schema-extraction)  
> 8. TalentAI MVP: AI-Powered Talent Matching Platform \- GitHub, [https://github.com/poshan0126/hacknation-2025-talentai-challenge-10](https://github.com/poshan0126/hacknation-2025-talentai-challenge-10)  
> 9. PaddleOCR vs Tesseract: Which is the best open source OCR?, [https://www.koncile.ai/en/ressources/paddleocr-analyse-avantages-alternatives-open-source](https://www.koncile.ai/en/ressources/paddleocr-analyse-avantages-alternatives-open-source)  
> 10. Claude pdf-to-markdown skill: 10 PDF-to-MD pipelines that just work, [https://mcp.directory/blog/claude-pdf-to-markdown-skill-guide](https://mcp.directory/blog/claude-pdf-to-markdown-skill-guide)  
> 11. GitHub \- opendatalab/MinerU: Transforms complex documents like, [https://github.com/opendatalab/mineru](https://github.com/opendatalab/mineru)  
> 12. GitHub \- OmkarPathak/pyresparser: A simple resume parser used, [https://github.com/OmkarPathak/pyresparser](https://github.com/OmkarPathak/pyresparser)  
> 13. Project \- How to build a Resume Parser using Python \- GeeksforGeeks, [https://www.geeksforgeeks.org/nlp/project-how-to-build-a-resume-parser-using-python/](https://www.geeksforgeeks.org/nlp/project-how-to-build-a-resume-parser-using-python/)  
> 14. Free Resume Parser API Tools & Models (2026) \- Eden AI, [https://www.edenai.co/post/top-free-resume-parser-tools-apis-and-open-source-models](https://www.edenai.co/post/top-free-resume-parser-tools-apis-and-open-source-models)  
> 15. OSError: \[E053\] Could not read config.cfg from .....\\venv\\lib ... \- GitHub, [https://github.com/OmkarPathak/pyresparser/issues/46](https://github.com/OmkarPathak/pyresparser/issues/46)  
> 16. Error Message while installing Spacy 2.3.5 \- "Microsoft Visual C++, [https://stackoverflow.com/questions/77970163/error-message-while-installing-spacy-2-3-5-microsoft-visual-c-14-0-or-great](https://stackoverflow.com/questions/77970163/error-message-while-installing-spacy-2-3-5-microsoft-visual-c-14-0-or-great)  
> 17. run-llama/liteparse: A fast, helpful, and open-source document parser, [https://github.com/run-llama/liteparse](https://github.com/run-llama/liteparse)  
> 18. Partitioning \- Unstructured, [https://docs.unstructured.io/open-source/core-functionality/partitioning](https://docs.unstructured.io/open-source/core-functionality/partitioning)  
> 19. app.py \- MoayadAlshehry/llm-resume-parser \- GitHub, [https://github.com/MoayadAlshehry/llm-resume-parser/blob/main/app.py](https://github.com/MoayadAlshehry/llm-resume-parser/blob/main/app.py)  
> 20. MinerU \- Dify Marketplace, [https://marketplace.dify.ai/plugin/langgenius/mineru](https://marketplace.dify.ai/plugin/langgenius/mineru)  
> 21. MinerU Document Extraction Tools \- a Hugging Face Space by, [https://huggingface.co/spaces/opendatalab/MinerU](https://huggingface.co/spaces/opendatalab/MinerU)  
> 22. Get Started with Unstructured \- Cerebras Inference Docs, [https://inference-docs.cerebras.ai/integrations/unstructured](https://inference-docs.cerebras.ai/integrations/unstructured)  
> 23. research-pdf-parser/ocr/README.md at main \- GitHub, [https://github.com/GlacierAlgo/research-pdf-parser/blob/main/ocr/README.md](https://github.com/GlacierAlgo/research-pdf-parser/blob/main/ocr/README.md)  
> 24. GitHub \- wespiper/pyresume: A simple, accurate resume parser for, [https://github.com/wespiper/pyresume](https://github.com/wespiper/pyresume)  
> 25. orasik/resume-parser \- GitHub, [https://github.com/orasik/resume-parser](https://github.com/orasik/resume-parser)  
> 26. README.md \- OmkarPathak/ResumeParser \- GitHub, [https://github.com/OmkarPathak/ResumeParser/blob/master/README.md](https://github.com/OmkarPathak/ResumeParser/blob/master/README.md)  
> 27. GitHub \- arieslao/reverse-ats: AI-powered reverse ATS: scrapes jobs, [https://github.com/arieslao/reverse-ats](https://github.com/arieslao/reverse-ats)  
> 28. Structured Output \- Tools in Data Science, [https://tds.s-anand.net/2026-02/docs/week-3/structured-output/](https://tds.s-anand.net/2026-02/docs/week-3/structured-output/)  
> 29. How to Build an AI Agent with Pydantic AI: A Beginner's Guide, [https://www.projectpro.io/article/pydantic-ai/1088](https://www.projectpro.io/article/pydantic-ai/1088)  
> 30. Unstructured Evaluation Metrics (SCORE Framework) \- GitHub, [https://github.com/Unstructured-IO/unstructured-eval-metrics](https://github.com/Unstructured-IO/unstructured-eval-metrics)  
> 31. paddleocr-vl · GitHub Topics, [https://github.com/topics/paddleocr-vl](https://github.com/topics/paddleocr-vl)  
> 32. Overview \- Unstructured, [https://docs.unstructured.io/open-source/introduction/overview](https://docs.unstructured.io/open-source/introduction/overview)