/**
 * Análisis de patrones de error en campos débiles
 * Genera un reporte detallado de qué fue lo que el OCR hizo mal
 */
import fs from 'fs';
import path from 'path';

const resultsPath = path.join(process.cwd(), 'test-scans', 'resultados-bench.json');

try {
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  // Analizar campos débiles
  const campos_debiles = ['email', 'phone', 'experience[].company', 'experience[].position'];
  const analisis = {};

  for (const campo of campos_debiles) {
    analisis[campo] = {
      campo,
      total: 0,
      aciertos: 0,
      vacios: 0,
      errores: []
    };
  }

  // Procesar cada documento
  for (const doc of results) {
    if (!doc.campos) continue;

    for (const campo_obj of doc.campos) {
      const campo = campo_obj.campo;
      
      if (!analisis[campo]) continue;

      analisis[campo].total++;

      if (campo_obj.estado === 'acierto') {
        analisis[campo].aciertos++;
        continue;
      }

      if (!campo_obj.obtenido || campo_obj.obtenido.trim() === '') {
        analisis[campo].vacios++;
        analisis[campo].errores.push({
          archivo: doc.archivo,
          esperado: campo_obj.esperado,
          obtenido: '',
          tipo_error: 'VACIO',
          confusion_ocr: 'No se detectó ningún valor'
        });
      } else {
        // Detectar tipo de error
        let tipo_error = 'INCORRECTO';
        let confusion = '';

        if (campo === 'email') {
          if (!campo_obj.obtenido.includes('@')) {
            tipo_error = 'SIN_ARROBA';
            confusion = 'OCR confundió @ con O/C/G/Q';
          } else if (!campo_obj.obtenido.includes('.')) {
            tipo_error = 'SIN_PUNTO_DOMINIO';
            confusion = 'OCR perdió el punto del dominio';
          } else {
            tipo_error = 'CARACTERES_ERRADOS';
          }
        } else if (campo === 'phone') {
          const digitos_esperados = campo_obj.esperado.replace(/\D/g, '').length;
          const digitos_obtenidos = campo_obj.obtenido.replace(/\D/g, '').length;
          
          if (digitos_obtenidos === 0) {
            tipo_error = 'SIN_DIGITOS';
          } else if (Math.abs(digitos_esperados - digitos_obtenidos) > 2) {
            tipo_error = 'DIGITOS_INCOMPLETOS';
          } else {
            tipo_error = 'FORMATO_INCORRECTO';
          }
          confusion = `Esperados ${digitos_esperados} dígitos, obtenidos ${digitos_obtenidos}`;
        } else if (campo === 'experience[].company') {
          if (campo_obj.obtenido.match(/^\d+$/)) {
            tipo_error = 'SOLO_NUMEROS';
            confusion = 'OCR capturó números en lugar de nombre de empresa';
          } else if (campo_obj.obtenido.length < 2) {
            tipo_error = 'DEMASIADO_CORTO';
          } else {
            tipo_error = 'CARACTERES_ERRADOS';
          }
        } else if (campo === 'experience[].position') {
          if (campo_obj.obtenido.match(/^\d+$/)) {
            tipo_error = 'SOLO_NUMEROS';
          } else if (campo_obj.obtenido.length < 2) {
            tipo_error = 'DEMASIADO_CORTO';
          } else {
            tipo_error = 'CARACTERES_ERRADOS';
          }
        }

        analisis[campo].errores.push({
          archivo: doc.archivo,
          esperado: campo_obj.esperado,
          obtenido: campo_obj.obtenido,
          tipo_error,
          confusion_ocr: confusion
        });
      }
    }
  }

  // Generar reporte
  console.log('\n===== ANÁLISIS DE CAMPOS DÉBILES =====\n');

  for (const campo of campos_debiles) {
    const anal = analisis[campo];
    const tasa_acierto = ((anal.aciertos / anal.total) * 100).toFixed(1);
    const tasa_vacio = ((anal.vacios / (anal.total - anal.aciertos)) * 100).toFixed(1);

    console.log(`\n📊 CAMPO: ${campo}`);
    console.log(`   Aciertos: ${anal.aciertos}/${anal.total} (${tasa_acierto}%)`);
    console.log(`   Vacíos: ${anal.vacios}/${anal.total - anal.aciertos} (${tasa_vacio}% de errores)`);

    // Contar tipos de error
    const tipos_error = {};
    for (const error of anal.errores) {
      tipos_error[error.tipo_error] = (tipos_error[error.tipo_error] || 0) + 1;
    }

    console.log(`   Tipos de error:`);
    for (const [tipo, freq] of Object.entries(tipos_error).sort((a, b) => b[1] - a[1])) {
      const pct = ((freq / anal.errores.length) * 100).toFixed(1);
      console.log(`     - ${tipo}: ${freq} (${pct}%)`);
    }

    // Mostrar ejemplos de mayores problemas
    console.log(`   Ejemplos de mayores problemas:`);
    const ejemplos = anal.errores
      .filter(e => e.tipo_error !== 'VACIO')
      .slice(0, 3);
    
    for (const error of ejemplos) {
      console.log(`     ${error.archivo}`);
      console.log(`       Esperado: "${error.esperado}"`);
      console.log(`       Obtenido: "${error.obtenido}"`);
      if (error.confusion_ocr) {
        console.log(`       Problema: ${error.confusion_ocr}`);
      }
    }
  }

  console.log('\n===== FIN ANÁLISIS =====\n');

} catch (error) {
  console.error('Error al procesar resultados:', error);
}
