import React, { useState, useMemo, useEffect } from 'react';
import { ReaderUploader } from './ReaderUploader';
import { TextoReconocido } from './TextoReconocido';
import { EditableCvForm } from './EditableCvForm';
import { EditableContractForm } from './EditableContractForm';
import { EditableIdForm } from './EditableIdForm';
import { EditableHealthForm } from './EditableHealthForm';
import { EditableLiquidacionForm } from './EditableLiquidacionForm';
import { HistorialEmpleadoPanel, DatosFotos } from './HistorialEmpleadoPanel';
import { processDocument, PreprocesoForzado } from '../../lib/ocr';
import { extraerArchivosDeZip, esZip } from '../../lib/ocr/extraer-zip';
import { ExtractedDocumentData, BatchItem } from '../../types/reader';
import { CandidateFormData } from '../../types/candidate';
import { ContractFormData } from '../../types/contract';
import { IdCardFormData } from '../../types/id-card';
import { HealthFormData } from '../../types/health';
import { LiquidacionFormData } from '../../types/liquidacion';
import { db } from '../../lib/offline/db';
import { queueMutation } from '../../lib/offline/sync';
import { construirExpediente, guardarDocumentoExpediente, buscarCedulaEnTexto } from '../../lib/offline/expediente';
import { clasificarHistorial } from '../../lib/ocr/document-classifier';
import { agruparPorEmpleado, sintetizarResultadoConsolidado, GrupoLote } from '../../lib/ocr/agrupar-lote';
import { obtenerHistorialEmpleado, HistorialEmpleadoConLineaTiempo } from '../../lib/offline/historial';
import { guardarHojaDeVidaEmpleado } from '../../lib/offline/empleado-cv';
import {
  determinarEvidenciaLaboral,
  crearOActualizarEmpleadoDesdeHistorial,
  EstadoEmpleadoPorHistorial,
} from '../../lib/offline/empleado-historial';
import { guardarLoteEmpleado } from '../../lib/offline/guardar-lote';
import { LegalDocument02Icon, CheckmarkCircle01Icon, Alert01Icon, ArchiveIcon } from 'hugeicons-react';

interface ReaderViewProps {
  onCandidateSaved?: (candidate: CandidateFormData) => void;
  onContractSaved?: (contract: ContractFormData) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  onCandidateSaved,
  onContractSaved,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const [currentResult, setCurrentResult] = useState<ExtractedDocumentData | null>(null);
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [historialEmpleado, setHistorialEmpleado] = useState<HistorialEmpleadoConLineaTiempo | null>(null);
  const [fuerzaOcr, setFuerzaOcr] = useState<PreprocesoForzado | undefined>(undefined);

  // Consolida el lote en grupos por empleado (cedula/nombre) para ver las fotos
  // de un mismo empleado en conjunto, en vez de foto por foto.
  const gruposLote = useMemo(
    () =>
      agruparPorEmpleado(
        batchQueue.map((item) => item.result).filter((r): r is ExtractedDocumentData => Boolean(r))
      ),
    [batchQueue]
  );

  // Todos los resultados actuales (lote masivo + documento en revision) para
  // inferir si la persona es empleado de Rosimar por su historial documental.
  const todosLosResultados = useMemo<ExtractedDocumentData[]>(() => {
    const delLote = batchQueue
      .map((item) => item.result)
      .filter((r): r is ExtractedDocumentData => Boolean(r));
    if (!currentResult) return delLote;
    const yaIncluido = delLote.some((r) => r.fileName === currentResult.fileName);
    return yaIncluido ? delLote : [...delLote, currentResult];
  }, [batchQueue, currentResult]);

  const evidenciaLaboral = useMemo<EstadoEmpleadoPorHistorial>(
    () => determinarEvidenciaLaboral(todosLosResultados),
    [todosLosResultados]
  );

  // La persona es empleado si esta registrada en Rosimar o si sus documentos
  // (contrato, liquidacion, renuncia) prueban una relacion laboral.
  const esEmpleadoRegistrado = Boolean(historialEmpleado?.empleado);
  const esEmpleadoPorHistorial = evidenciaLaboral.esEmpleado;

  // Resuelve el historial en Rosimar cuando cambia el resultado actual: si se
  // detecta la cedula de un empleado registrado (activo/inactivo), se carga su
  // historial interno (contratos, memorandos, razon de salida) para mostrarlo
  // junto a los datos leidos de las fotos.
  useEffect(() => {
    const cedula = cedulaDeResultado(currentResult);
    if (!cedula) {
      setHistorialEmpleado(null);
      return;
    }
    let activo = true;
    obtenerHistorialEmpleado(cedula).then((hist) => {
      if (activo) setHistorialEmpleado(hist);
    });
    return () => {
      activo = false;
    };
  }, [currentResult]);

  /** Abre el formulario del empleado con los datos consolidados de su grupo. */
  const handleLlenarFormulario = (grupo: GrupoLote) => {
    setCurrentResult(sintetizarResultadoConsolidado(grupo));
    setCurrentFile(null);
    setShowRawText(false);
  };

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    // Descomprime cualquier ZIP presente y combina con los archivos sueltos.
    let trabajables: File[] = files.filter((f) => !esZip(f));
    const zips = files.filter(esZip);

    if (zips.length > 0) {
      setIsProcessing(true);
      setProgressMessage('Descomprimiendo ZIP y extrayendo fotos...');
      const extraidos: File[] = [];
      for (const zip of zips) {
        try {
          const archivos = await extraerArchivosDeZip(zip);
          extraidos.push(...archivos);
        } catch (err) {
          console.error(err);
          setNotification({
            type: 'error',
            message: `No se pudo leer el ZIP "${zip.name}". Confirme que es un .zip valido.`,
          });
        }
      }
      trabajables = [...extraidos, ...trabajables];
      setProgressMessage('');
    }

    if (trabajables.length === 0) {
      setIsProcessing(false);
      return;
    }

    if (trabajables.length === 1) {
      // Archivo unico directo
      setIsProcessing(true);
      setProgressPercent(0);
      try {
        const result = await processDocument(trabajables[0], (p, msg) => {
          setProgressPercent(p);
          setProgressMessage(msg);
        });
        setCurrentResult(result);
        setCurrentFile(trabajables[0]);
        setShowRawText(true);
        setBatchQueue([]);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido al procesar el documento';
        setNotification({
          type: 'error',
          message: errorMessage,
        });
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Carga masiva por lotes (M12)
      const items: BatchItem[] = trabajables.map((f, i) => ({
        id: `batch-${Date.now()}-${i}`,
        file: f,
        status: 'pending',
        progress: 0,
      }));
      setBatchQueue(items);
      setCurrentBatchIndex(0);
      processBatchQueue(items, 0);
    }
  };

  /**
   * Procesa el lote documento por documento. Cada actualizacion crea objetos
   * nuevos: mutar los elementos del arreglo de estado en sitio hacia que React
   * no siempre volviera a pintar el avance de la bandeja.
   */
  const processBatchQueue = async (items: BatchItem[], index: number) => {
    if (index >= items.length) {
      setIsProcessing(false);

      // Al terminar, mostrar automaticamente el formulario consolidado (hoja corrida).
      const resultados = items
        .filter((it) => it.result)
        .map((it) => it.result as ExtractedDocumentData);

      if (resultados.length > 0) {
        const grupos = agruparPorEmpleado(resultados);
        const grupo = [...grupos].sort((a, b) => b.items.length - a.items.length)[0];
        if (grupo && grupo.items.length > 0) {
          setCurrentBatchIndex(items.length - 1);
          setCurrentResult(sintetizarResultadoConsolidado(grupo));
          setShowRawText(true);
        }
      }

      return;
    }

    setIsProcessing(true);
    const marcar = (cambios: Partial<BatchItem>) =>
      setBatchQueue((previo) =>
        previo.map((item, i) => (i === index ? { ...item, ...cambios } : item))
      );

    marcar({ status: 'processing' });

    try {
      const result = await processDocument(items[index].file, (p, msg) => {
        setProgressPercent(p);
        setProgressMessage(`[${index + 1}/${items.length}] ${msg}`);
      });

      items[index] = { ...items[index], status: 'done', result, progress: 100 };
      marcar({ status: 'done', result, progress: 100 });
      if (index === 0) setCurrentResult(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar archivo';
      marcar({ status: 'error', error: errorMessage });
    } finally {
      if (index + 1 < items.length) {
        await processBatchQueue(items, index + 1);
      } else {
        setIsProcessing(false);

        // Al terminar, mostrar automaticamente el formulario consolidado (hoja corrida).
        const resultados = items
          .filter((it) => it.result)
          .map((it) => it.result as ExtractedDocumentData);

        if (resultados.length > 0) {
          const grupos = agruparPorEmpleado(resultados);
          const grupo = [...grupos].sort((a, b) => b.items.length - a.items.length)[0];
          if (grupo && grupo.items.length > 0) {
            setCurrentBatchIndex(items.length - 1);
            setCurrentResult(sintetizarResultadoConsolidado(grupo));
            setShowRawText(true);
          }
        }
      }
    }
  };

  /** Asegura que una persona con evidencia laboral quede registrada en Empleados
   *  (activa/inactiva segun sus documentos), creandola si aun no existe. */
  const asegurarEmpleadoDesdeHistorial = async () => {
    if (!esEmpleadoPorHistorial) return;
    const cedula = evidenciaLaboral.cedula;
    if (!cedula) return;
    await crearOActualizarEmpleadoDesdeHistorial({
      results: todosLosResultados,
      cedula,
      estado: evidenciaLaboral.estado,
      fechaSalida: evidenciaLaboral.fechaSalida,
      razonSalida: evidenciaLaboral.razonSalida,
    });
  };

  const handleSaveCv = async (
    candidateData: CandidateFormData,
    destino: 'candidato' | 'empleado' = 'candidato'
  ) => {
    try {
      // Escenario clave para Rosimar: muchos CVs no son de candidatos sino de
      // empleados (activos o inactivos) cuya informacion se vuelve a cargar para
      // actualizar su hoja de vida y dejarla en el historial, sin duplicar.
      if (destino === 'empleado') {
        const cedula =
          candidateData.documentNumber ||
          historialEmpleado?.empleado?.candidateData?.documentNumber ||
          evidenciaLaboral.cedula;

        // 1. Crear o actualizar la ficha del empleado con su historial documental.
        if (historialEmpleado?.empleado && currentResult) {
          await guardarHojaDeVidaEmpleado(
            historialEmpleado.empleado,
            candidateData,
            currentResult,
            currentFile ?? undefined
          );
        } else if (cedula) {
          await crearOActualizarEmpleadoDesdeHistorial({
            results: todosLosResultados,
            cedula,
            candidato: candidateData,
            estado: evidenciaLaboral.estado,
            fechaSalida: evidenciaLaboral.fechaSalida,
            razonSalida: evidenciaLaboral.razonSalida,
          });
        }

        // 2. Guardar todos los documentos del lote como historial del empleado.
        await guardarHistorialDeResultados(todosLosResultados, currentFile ?? undefined);

        const nombre = `${candidateData.firstNames} ${candidateData.lastNames}`.trim();
        setNotification({
          type: 'success',
          message: `Hoja de vida e historial de ${nombre} registrados en Rosimar.`,
        });
        handleNextOrClear();
        return;
      }

      const id = candidateData.id || `cand-${Date.now()}`;
      const toSave = {
        ...candidateData,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.candidates.put(toSave);
      await queueMutation("create", "candidates", id, toSave);

      setNotification({
        type: 'success',
        message: `Candidato ${toSave.firstNames} ${toSave.lastNames} guardado exitosamente en el sistema.`,
      });

      if (onCandidateSaved) {
        onCandidateSaved(toSave);
      }

      handleNextOrClear();
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Error al persistir el candidato en la base de datos local.',
      });
    }
  };

  const handleSaveContract = async (contractData: ContractFormData) => {
    try {
      const id = contractData.id || `contract-${Date.now()}`;
      const toSave = {
        ...contractData,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.contracts.put(toSave);
      await queueMutation("create", "contracts", id, toSave);

      // Un contrato es evidencia directa de relacion laboral: se asegura que la
      // persona quede registrada en Empleados (y no como simple candidato).
      await asegurarEmpleadoDesdeHistorial();

      setNotification({
        type: 'success',
        message: `Contrato para ${toSave.workerName} registrado exitosamente.`,
      });

      if (onContractSaved) {
        onContractSaved(toSave);
      }

      handleNextOrClear();
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Error al persistir el contrato en la base de datos local.',
      });
    }
  };

  const handleSaveIdCard = async (idData: IdCardFormData) => {
    try {
      const id = idData.id || `id-${Date.now()}`;
      const toSave = { ...idData, id };
      await db.idCards.put(toSave);
      await queueMutation("create", "id_cards", id, toSave);
      setNotification({
        type: "success",
        message: `Cédula de ${toSave.firstNames} registrada exitosamente.`,
      });
      handleNextOrClear();
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Error guardando la cédula.' });
    }
  };

  const handleSaveHealth = async (healthData: HealthFormData) => {
    try {
      const id = healthData.id || `health-${Date.now()}`;
      const toSave = { ...healthData, id };
      await db.healthAffiliations.put(toSave);
      await queueMutation("create", "health_affiliations", id, toSave);
      setNotification({
        type: "success",
        message: "Afiliaciones de seguridad social registradas exitosamente.",
      });
      handleNextOrClear();
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Error guardando las afiliaciones.' });
    }
  };

  /**
   * Guarda una liquidacion leida por OCR en el expediente del empleado. No
   * existe una tabla propia de liquidaciones: se adjunta como documento de
   * historial (categoria liquidacion) vinculado por cedula.
   */
  const handleSaveLiquidacion = async (data: LiquidacionFormData) => {
    try {
      const base = await construirExpediente(
        currentResult!,
        'liquidacion',
        currentFile ?? undefined
      );
      await guardarDocumentoExpediente({
        ...base,
        workerName: data.workerName || base.workerName,
        workerDocumentNumber: data.workerDocumentNumber || base.workerDocumentNumber,
      });

      // La liquidacion acredita que la persona termino su relacion laboral:
      // se registra la ficha del empleado (inactivo) si aun no existia.
      await asegurarEmpleadoDesdeHistorial();

      setNotification({
        type: 'success',
        message: `Liquidacion guardada en el expediente y vinculada al empleado de Rosimar.`,
      });
      handleNextOrClear();
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Error al guardar la liquidacion en el expediente.' });
    }
  };

  /**
   * Guarda un lote completo de documentos en las tablas del empleado
   * (memoranda, liquidaciones, contracts, etc.) y crea el expediente vinculado.
   * 
   * Este es el flujo principal cuando se suben multiples fotos de un mismo empleado
   * (contrato + liquidacion + memorando + cedula + EPS) para guardarlas todas de una vez
   * (RN-7: revisar primero, luego guardar).
   */
  const handleGuardarEmpleadoYLote = async (candidateData: CandidateFormData) => {
    try {
      setIsProcessing(true);
      setProgressMessage('Creando empleado y guardando lote de documentos...');

      const cedula = candidateData.documentNumber || evidenciaLaboral.cedula;
      if (!cedula) {
        throw new Error('No se encontro numero de documento para vincular el lote.');
      }

      // 1. Crear o actualizar el empleado.
      const empleado = await crearOActualizarEmpleadoDesdeHistorial({
        results: todosLosResultados,
        cedula,
        candidato: candidateData,
        estado: evidenciaLaboral.estado,
        fechaSalida: evidenciaLaboral.fechaSalida,
        razonSalida: evidenciaLaboral.razonSalida,
      });

      // 2. Guardar todos los documentos del lote en sus tablas y expediente.
      const archivos = batchQueue
        .map((item) => item.file)
        .filter(Boolean) as File[];
      
      await guardarLoteEmpleado({
        employee: empleado,
        cedula,
        results: todosLosResultados,
        files: archivos,
      });

      const nombre = `${candidateData.firstNames} ${candidateData.lastNames}`.trim();
      setNotification({
        type: 'success',
        message: `Empleado ${nombre} y lote de ${batchQueue.length} documentos guardados exitosamente en Rosimar.`,
      });

      handleNextOrClear();
      setBatchQueue([]);
      setCurrentBatchIndex(0);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error desconocido al guardar el lote';
      setNotification({
        type: 'error',
        message: `Error guardando el lote: ${msg}`,
      });
    } finally {
      setIsProcessing(false);
      setProgressMessage('');
    }
  };

  /**
   * Guarda el documento procesado en el expediente del empleado. Se vincula al
   * empleado por su numero de documento (cedula); si el empleado no existe aun,
   * la ficha queda con los datos de identidad para vincularla despues.
   */
  const handleSaveExpediente = async (result: ExtractedDocumentData) => {
    try {
      const base = await construirExpediente(
        result,
        clasificarHistorial(result.extractedText),
        currentFile ?? undefined
      );
      const doc = await guardarDocumentoExpediente(base);

      // Si el documento es evidencia laboral (contrato, liquidacion, renuncia,
      // memorando), se asegura que la persona quede registrada en Empleados.
      await asegurarEmpleadoDesdeHistorial();

      const vinculacion =
        doc.employeeId || doc.matchedEmployeeId
          ? ' y vinculado al empleado por su numero de documento'
          : '. El empleado aun no esta registrado: asocie la ficha al empleado desde Empleados';
      setNotification({
        type: 'success',
        message: `Documento guardado en el expediente${vinculacion}.`,
      });

      handleNextOrClear();
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Error al guardar el documento en el expediente.' });
    }
  };

  /**
   * Valvula de escape (RN-7): si la lectura automatica de una imagen no sirve,
   * el usuario fuerza una variante concreta de preprocesado y se relee la misma
   * imagen. No altera .docx/.txt/.pdf: solo se ofrece en rutas de OCR.
   */
  const rehacerOcr = async (variante: PreprocesoForzado) => {
    if (!currentFile) return;
    setIsProcessing(true);
    setProgressPercent(0);
    setFuerzaOcr(variante);
    try {
      const result = await processDocument(
        currentFile,
        (p, msg) => {
          setProgressPercent(p);
          setProgressMessage(msg);
        },
        { fuerzaPreproceso: variante }
      );
      setCurrentResult(result);
      setShowRawText(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al releer la imagen';
      setNotification({ type: 'error', message: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNextOrClear = () => {
    if (batchQueue.length > 0 && currentBatchIndex + 1 < batchQueue.length) {
      const nextIdx = currentBatchIndex + 1;
      setCurrentBatchIndex(nextIdx);
      if (batchQueue[nextIdx].result) {
        setCurrentResult(batchQueue[nextIdx].result || null);
      }
    } else {
      setCurrentResult(null);
      setBatchQueue([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta / Notificacion */}
      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-mist border-fog text-ink'
              : 'bg-alert-surface border-alert text-alert'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <CheckmarkCircle01Icon className="h-5 w-5 text-steel" />
            ) : (
              <Alert01Icon className="h-5 w-5 text-alert" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-semibold text-steel hover:text-ink"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Zona de Carga si no hay resultado activo en revision */}
      {!currentResult && (
        <ReaderUploader
          onFilesSelected={handleFilesSelected}
          isProcessing={isProcessing}
          progressMessage={progressMessage}
          progressPercent={progressPercent}
        />
      )}

      {/* Bandeja de Lote Masivo (M12) */}
      {batchQueue.length > 1 && (
        <div className="bg-paper rounded-lg border border-fog p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-ink flex items-center">
            Bandeja de Revision por Lotes ({batchQueue.length} documentos)
            </h3>
            <span className="text-xs text-steel">
              Documento actual: {currentBatchIndex + 1} de {batchQueue.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {batchQueue.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.result) {
                    setCurrentBatchIndex(idx);
                    setCurrentResult(item.result);
                    setCurrentFile(item.file);
                    setShowRawText(false);
                  }
                }}
                className={`p-2 rounded border text-left text-xs transition-all ${
                  idx === currentBatchIndex
                    ? 'border-signal-blue bg-mist font-bold text-ink'
                    : item.status === 'done'
                    ? 'border-fog bg-paper hover:bg-mist text-ink'
                    : item.status === 'processing'
                    ? 'border-fog bg-mist text-steel animate-pulse'
                    : 'border-fog opacity-60'
                }`}
              >
                <div className="truncate font-medium">{item.file.name}</div>
                <div className="text-[10px] text-steel uppercase mt-0.5">{item.status}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vista general por empleado: consolida las fotos del lote que son del
          mismo empleado (agrupadas por cedula/nombre) y permite llenar el
          formulario con los datos fusionados de todas. */}
      {batchQueue.length > 1 && gruposLote.length > 0 && !currentResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink flex items-center">
              Vista general por empleado ({gruposLote.length} grupo{gruposLote.length > 1 ? 's' : ''})
            </h3>
            <span className="text-xs text-steel">
              {batchQueue.length} fotos · agrupadas por identificacion del empleado
            </span>
          </div>

          {gruposLote.map((grupo) => (
            <div key={grupo.key} className="bg-paper rounded-lg border border-fog p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">
                    {grupo.nombre || (grupo.cedula ? 'Empleado' : 'Sin identificar')}
                  </span>
                  {grupo.cedula && (
                    <span className="font-mono text-[11px] text-steel">CC {grupo.cedula}</span>
                  )}
                  <span className="text-xs text-steel">
                    · {grupo.items.length} documento{grupo.items.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-mist text-xs text-ink">
                    {etiquetaTipo(grupo.tipoPredominante)}
                  </span>
                  <button
                    onClick={() => handleLlenarFormulario(grupo)}
                    className="px-3 py-1.5 bg-signal-blue hover:bg-rosimar-blue-dark text-white rounded text-xs font-semibold transition-colors shadow-subtle"
                  >
                    Llenar formulario
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {grupo.items.map((it) => (
                  <span
                    key={it.fileName}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-mist text-[11px] text-steel"
                  >
                    {it.fileName}
                  </span>
                ))}
              </div>

              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold text-signal-blue hover:underline">
                  Ver texto consolidado de las {grupo.items.length} fotos
                </summary>
                <div className="mt-2">
                  <TextoReconocido
                    texto={grupo.textoConsolidado}
                    alturaMaxima="16rem"
                    vacio="Sin texto reconocido en estas fotos."
                  />
                </div>
              </details>
            </div>
          ))}

          <p className="text-[11px] text-steel">
            Los documentos se agrupan por el numero de documento/nombre detectado en cada
            foto. Use <strong>Llenar formulario</strong> para revisar y guardar al empleado con
            los datos de todas sus fotos en un solo formulario; o siga revisando foto por foto.
          </p>
        </div>
      )}

      {/* Vista de Formulario Editable para Revision Humana (RN-7) */}
      {currentResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-fog bg-paper px-4 py-3">
            <div className="flex items-center space-x-2">
              <LegalDocument02Icon className="h-5 w-5 shrink-0 text-steel" />
              <div>
                <span className="text-caption font-semibold tracking-[-0.02em] text-ink">{currentResult.fileName}</span>
                <span className="ml-2 text-micro text-steel">
                  ({(currentResult.fileSize / 1024).toFixed(1)} KB · Metodo: {currentResult.method} · {currentResult.processingTimeMs} ms)
                </span>
              </div>
            </div>
            <button
              onClick={() => setCurrentResult(null)}
              className="shrink-0 rounded-lg border border-fog px-3 py-1.5 text-caption text-steel transition-colors hover:border-ink hover:text-ink"
            >
              Cargar otro archivo
            </button>
          </div>

          {/* Valvula de escape de OCR (RN-7): releer la imagen con otra
              preparacion si la lectura automatica no convence. Solo aparece en
              rutas que pasaron por OCR (imagen o PDF escaneado). */}
          {(currentResult.method === 'image_ocr' || currentResult.method === 'pdf_ocr') &&
            currentFile && (
              <div className="bg-paper rounded-lg border border-fog p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-ink">
                    Releer la imagen con otro preprocesado
                  </h3>
                  <span className="text-[11px] text-steel">
                    {fuerzaOcr ? `Variante activa: ${etiquetaVariant(fuerzaOcr)}` : 'Lectura automatica'}
                  </span>
                </div>
                <p className="text-xs text-steel">
                  Si el texto no se leyo bien, prueba otra preparacion y vuelve a
                  generar los formularios. No cambia el archivo original.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIANTES_OCR.map((v) => (
                    <button
                      key={v.valor}
                      onClick={() => rehacerOcr(v.valor)}
                      disabled={isProcessing}
                      className={`px-3 py-1.5 rounded border text-xs font-semibold transition-colors disabled:opacity-50 ${
                        fuerzaOcr === v.valor
                          ? 'border-signal-blue bg-mist text-ink'
                          : 'border-fog bg-paper hover:bg-mist text-steel'
                      }`}
                    >
                      {v.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* Calidad de la extraccion: avisos, campos vacios y cargo detectado (RN-7) */}
          <div className="bg-paper rounded-lg border border-fog p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-ink">Calidad de la extraccion</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    currentResult.confidenceScore >= 0.8
                      ? 'bg-mist text-ink'
                      : currentResult.confidenceScore >= 0.55
                      ? 'bg-warning-surface text-warning'
                      : 'bg-alert-surface text-alert'
                  }`}
                >
                  Confianza {(currentResult.confidenceScore * 100).toFixed(0)}%
                </span>
              </div>
              <button
                onClick={() => setShowRawText((v) => !v)}
                className="text-xs font-semibold text-ink hover:text-ink underline"
              >
                {showRawText ? 'Ocultar texto reconocido' : 'Ver texto reconocido'}
              </button>
            </div>

            {currentResult.detectedRoles?.cargoPrincipal && (
              <p className="text-xs text-steel">
                Cargo principal detectado:{' '}
                <strong className="text-ink">{currentResult.detectedRoles.cargoPrincipal}</strong>
                {currentResult.detectedRoles.familiaPrincipal !==
                  currentResult.detectedRoles.cargoPrincipal && (
                  <span className="text-steel">
                    {' '}
                    (familia: {currentResult.detectedRoles.familiaPrincipal})
                  </span>
                )}
              </p>
            )}

            {currentResult.warnings && currentResult.warnings.length > 0 && (
              <ul className="space-y-1">
                {currentResult.warnings.map((warning) => (
                  <li key={warning} className="text-xs text-warning flex items-start">
                    <Alert01Icon className="h-3.5 w-3.5 mr-1.5 mt-0.5 shrink-0 text-warning" />
                    {warning}
                  </li>
                ))}
              </ul>
            )}

            {currentResult.fieldConfidence && currentResult.fieldConfidence.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentResult.fieldConfidence.map((field) => (
                  <span
                    key={field.field}
                    title={
                      field.level === 'vacio'
                        ? 'Sin detectar: complete este campo manualmente'
                        : 'Detectado automaticamente: verifique antes de guardar'
                    }
                    className={`text-[11px] px-2 py-0.5 rounded border ${
                      field.level === 'vacio'
                        ? 'bg-alert-surface border-alert text-alert'
                        : field.level === 'media'
                        ? 'bg-warning-surface border-warning text-warning'
                        : 'bg-mist border-fog text-ink'
                    }`}
                  >
                    {field.label}
                    {field.level === 'vacio' ? ' - vacio' : ''}
                  </span>
                ))}
              </div>
            )}

            {showRawText && (
              <TextoReconocido texto={currentResult.extractedText} alturaMaxima="20rem" />
            )}
          </div>

          <HistorialEmpleadoPanel
            historial={historialEmpleado}
            datosFotos={datosFotosDelResultado(currentResult)}
            porHistorial={
              esEmpleadoPorHistorial && !esEmpleadoRegistrado
                ? {
                    estado: evidenciaLaboral.estado,
                    fechaSalida: evidenciaLaboral.fechaSalida,
                    razonSalida: evidenciaLaboral.razonSalida,
                  }
                : undefined
            }
          />

          {currentResult.candidateData && (
            <>
              <EditableCvForm
                initialData={currentResult.candidateData}
                confidenceScore={currentResult.confidenceScore}
                onSave={handleSaveCv}
                onCancel={() => setCurrentResult(null)}
                esEmpleadoExistente={esEmpleadoRegistrado || esEmpleadoPorHistorial}
                empleadoNombre={
                  esEmpleadoRegistrado
                    ? `${historialEmpleado!.empleado.candidateData?.firstNames ?? ''} ${
                        historialEmpleado!.empleado.candidateData?.lastNames ?? ''
                      }`.trim()
                    : currentResult.candidateData
                    ? `${currentResult.candidateData.firstNames} ${currentResult.candidateData.lastNames}`.trim()
                    : undefined
                }
              />

              {/* Boton "Guardar empleado y lote" cuando hay multiples documentos */}
              {batchQueue.length > 1 && (
                <div className="bg-paper rounded-lg border border-fog p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-ink mb-1">Guardar empleado y lote</h3>
                      <p className="text-xs text-steel">
                        Tienes {batchQueue.length} documentos cargados de este empleado (memorandos, contratos,
                        liquidaciones, cedulas, EPS, funciones). Usa este boton para guardar TODOS los documentos en
                        sus tablas correspondientes y crear el expediente completo del empleado en una operacion.
                        <strong className="block mt-1">RN-7: revisa y corrige los datos arriba antes de guardar.</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setCurrentResult(null)}
                      className="px-4 py-2 bg-mist hover:bg-fog text-ink text-sm font-semibold rounded-lg"
                      disabled={isProcessing}
                    >
                      Revisar otros documentos
                    </button>
                    <button
                      onClick={() => handleGuardarEmpleadoYLote(currentResult.candidateData!)}
                      className="inline-flex items-center px-4 py-2 bg-signal-blue hover:bg-rosimar-blue-dark text-white text-sm font-semibold rounded-lg transition-colors shadow-subtle disabled:opacity-50"
                      disabled={isProcessing}
                    >
                      <CheckmarkCircle01Icon className="h-4 w-4 mr-2" />
                      Guardar empleado y {batchQueue.length} documentos
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {currentResult.contractData && (
            <EditableContractForm
              initialData={currentResult.contractData}
              confidenceScore={currentResult.confidenceScore}
              onSave={handleSaveContract}
              onCancel={() => setCurrentResult(null)}
            />
          )}

          {currentResult.idCardData && (
            <EditableIdForm
              initialData={currentResult.idCardData}
              confidenceScore={currentResult.confidenceScore}
              onSave={handleSaveIdCard}
              onCancel={() => setCurrentResult(null)}
            />
          )}

          {currentResult.healthData && (
            <EditableHealthForm
              initialData={currentResult.healthData}
              confidenceScore={currentResult.confidenceScore}
              onSave={handleSaveHealth}
              onCancel={() => setCurrentResult(null)}
            />
          )}

          {currentResult.liquidacionData && (
            <EditableLiquidacionForm
              initialData={currentResult.liquidacionData}
              confidenceScore={currentResult.confidenceScore}
              onSave={handleSaveLiquidacion}
              onCancel={() => setCurrentResult(null)}
            />
          )}

          {!currentResult.candidateData &&
            !currentResult.contractData &&
            !currentResult.idCardData &&
            !currentResult.healthData &&
            !currentResult.liquidacionData && (() => {
              const categoria = clasificarHistorial(currentResult.extractedText);
              const noVinculado = !currentResult.contractData && !currentResult.candidateData;
              return (
                <div className="bg-paper p-6 rounded-lg border border-fog space-y-4">
                  <h3 className="text-subheading font-bold text-ink">
                    {categoria === 'desconocido'
                      ? 'No se pudo estructurar el documento'
                      : 'Documento reconocido'}
                  </h3>

                  {/* El resumen va primero. Antes el contenido principal de esta
                      pantalla era el volcado crudo del OCR, que con el ruido del
                      reconocimiento es justo lo que menos ayuda a decidir. */}
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    <div>
                      <dt className="text-micro uppercase tracking-wide text-steel">Tipo</dt>
                      <dd className="text-body font-semibold text-ink">
                        {etiquetaTipo(currentResult.detectedType)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-micro uppercase tracking-wide text-steel">Categoría</dt>
                      <dd className="text-body font-semibold text-ink">
                        {categoria === 'desconocido' ? 'Sin clasificar' : etiquetaCategoria(categoria)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-micro uppercase tracking-wide text-steel">Confianza</dt>
                      <dd className="text-body font-semibold text-ink">
                        {Math.round(currentResult.confidenceScore * 100)}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-micro uppercase tracking-wide text-steel">Texto leído</dt>
                      <dd className="text-body font-semibold text-ink">
                        {currentResult.extractedText.trim().length} caracteres
                      </dd>
                    </div>
                  </dl>

                  <p className="text-caption text-steel">
                    Puede guardarlo en el expediente del empleado o revisar el texto reconocido.
                  </p>

                  <details className="group">
                    <summary className="cursor-pointer text-caption font-semibold text-signal-blue hover:underline">
                      Ver el texto reconocido
                    </summary>
                    <div className="mt-2">
                      <TextoReconocido texto={currentResult.extractedText} />
                    </div>
                  </details>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setCurrentResult(null)}
                      className="px-4 py-2 bg-mist hover:bg-fog text-ink text-sm font-semibold rounded-lg"
                    >
                      Volver al lector
                    </button>
                    <button
                      onClick={() => handleSaveExpediente(currentResult)}
                      className="inline-flex items-center px-4 py-2 bg-signal-blue hover:bg-rosimar-blue-dark text-white text-sm font-semibold rounded-lg transition-colors shadow-subtle"
                    >
                      <ArchiveIcon className="h-4 w-4 mr-2" />
                      Guardar en expediente
                    </button>
                  </div>
                  {noVinculado && (
                    <p className="text-[11px] text-steel">
                      El documento se vinculara al empleado por su numero de documento cuando
                      este registrado en Empleados.
                    </p>
                  )}
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
};

/** Guarda todos los documentos de historial laboral del lote en el expediente
 *  del empleado, vinculados por cedula. La hoja de vida (cv) no se guarda como
 *  ficha de expediente: ya quedo consolidada en la ficha del empleado. */
async function guardarHistorialDeResultados(
  results: ExtractedDocumentData[],
  imageFile?: File
): Promise<void> {
  for (const r of results) {
    if (!r || r.detectedType === 'cv') continue;
    const base = await construirExpediente(
      r,
      clasificarHistorial(r.extractedText),
      imageFile
    );
    await guardarDocumentoExpediente(base);
  }
}

function etiquetaCategoria(categoria: string): string {
  const mapa: Record<string, string> = {
    contrato: 'Contrato laboral',
    liquidacion: 'Liquidacion final',
    memorando: 'Memorando',
    llamado_atencion: 'Llamado de atencion',
    renuncia: 'Renuncia',
    funciones: 'Funciones de cargo',
    salud: 'Seguridad social / EPS',
    cedula: 'Cedula de ciudadania',
    hoja_de_vida: 'Hoja de vida',
  };
  return mapa[categoria] ?? categoria;
}

function etiquetaTipo(tipo: string): string {
  const mapa: Record<string, string> = {
    cv: 'Hoja de vida',
    contract: 'Contrato',
    id_card: 'Cedula',
    health: 'Seguridad social / EPS',
    liquidacion: 'Liquidacion final',
    unknown: 'Documento',
  };
  return mapa[tipo] ?? tipo;
}

/** Variantes de preprocesado ofrecidas por la valvula de escape de OCR. */
const VARIANTES_OCR: { valor: PreprocesoForzado; etiqueta: string }[] = [
  { valor: 'gris', etiqueta: 'Gris' },
  { valor: 'plano', etiqueta: 'Sin ajustes' },
  { valor: 'desenfumado', etiqueta: 'Reducir ruido' },
  { valor: 'contraste', etiqueta: 'Más contraste' },
  { valor: 'binarizado', etiqueta: 'Blanco y negro' },
  { valor: 'original', etiqueta: 'Original' },
];

function etiquetaVariant(v: PreprocesoForzado): string {
  return VARIANTES_OCR.find((x) => x.valor === v)?.etiqueta ?? v;
}

/** Devuelve la cedula/nit detectada en un resultado extraido, si la hay. */
function cedulaDeResultado(r: ExtractedDocumentData | null): string | undefined {
  if (!r) return undefined;
  if (r.candidateData?.documentNumber) return r.candidateData.documentNumber;
  if (r.contractData?.workerDocumentNumber) return r.contractData.workerDocumentNumber;
  if (r.idCardData?.documentNumber) return r.idCardData.documentNumber;
  if (r.healthData?.documentNumber) return r.healthData.documentNumber;
  if (r.liquidacionData?.workerDocumentNumber) return r.liquidacionData.workerDocumentNumber;
  // Documentos sin estructura (memorando/renuncia/funciones): se intenta localizar
  // la cedula directamente en el texto OCR para poder enlazar el historial en Rosimar.
  return buscarCedulaEnTexto(r.extractedText);
}

/** Reune los datos de historial leidos de las fotos (rol, contrato, liquidacion). */
function datosFotosDelResultado(r: ExtractedDocumentData | null): DatosFotos | undefined {
  if (!r) return undefined;
  const datos: DatosFotos = {};
  if (r.contractData) datos.contrato = r.contractData;
  if (r.liquidacionData) datos.liquidacion = r.liquidacionData;
  if (r.candidateData?.headline) datos.rol = r.candidateData.headline;
  return datos.contrato || datos.liquidacion || datos.rol ? datos : undefined;
}
