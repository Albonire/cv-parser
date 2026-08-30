import React, { useState } from 'react';
import { ReaderUploader } from './ReaderUploader';
import { EditableCvForm } from './EditableCvForm';
import { EditableContractForm } from './EditableContractForm';
import { EditableIdForm } from './EditableIdForm';
import { EditableHealthForm } from './EditableHealthForm';
import { processDocument } from '../../lib/ocr';
import { ExtractedDocumentData, BatchItem } from '../../types/reader';
import { CandidateFormData } from '../../types/candidate';
import { ContractFormData } from '../../types/contract';
import { IdCardFormData } from '../../types/id-card';
import { HealthFormData } from '../../types/health';
import { db } from '../../lib/offline/db';
import { queueMutation } from '../../lib/offline/sync';
import { LegalDocument02Icon, CheckmarkCircle01Icon, Alert01Icon } from 'hugeicons-react';

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

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    if (files.length === 1) {
      // Archivo unico directo
      setIsProcessing(true);
      setProgressPercent(0);
      try {
        const result = await processDocument(files[0], (p, msg) => {
          setProgressPercent(p);
          setProgressMessage(msg);
        });
        setCurrentResult(result);
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
      const items: BatchItem[] = files.map((f, i) => ({
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
      }
    }
  };

  const handleSaveCv = async (candidateData: CandidateFormData) => {
    try {
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
              <pre className="p-3 bg-mist rounded-lg text-[11px] font-mono text-ink max-h-80 overflow-y-auto whitespace-pre-wrap">
                {currentResult.extractedText || 'No se reconocieron lineas de texto.'}
              </pre>
            )}
          </div>

          {currentResult.detectedType === 'cv' && currentResult.candidateData && (
            <EditableCvForm
              initialData={currentResult.candidateData}
              confidenceScore={currentResult.confidenceScore}
              onSave={handleSaveCv}
              onCancel={() => setCurrentResult(null)}
            />
          )}

          {currentResult.detectedType === 'contract' && currentResult.contractData && (
            <EditableContractForm
              initialData={currentResult.contractData}
              confidenceScore={currentResult.confidenceScore}
              onSave={handleSaveContract}
              onCancel={() => setCurrentResult(null)}
            />
          )}

          {currentResult.detectedType === 'id_card' && currentResult.idCardData && (
            <EditableIdForm
              initialData={currentResult.idCardData}
              confidenceScore={currentResult.confidenceScore}
              onSave={handleSaveIdCard}
              onCancel={() => setCurrentResult(null)}
            />
          )}

          {currentResult.detectedType === 'health' && currentResult.healthData && (
            <EditableHealthForm
              initialData={currentResult.healthData}
              confidenceScore={currentResult.confidenceScore}
              onSave={handleSaveHealth}
              onCancel={() => setCurrentResult(null)}
            />
          )}

          {!currentResult.candidateData &&
            !currentResult.contractData &&
            !currentResult.idCardData &&
            !currentResult.healthData && (
              <div className="bg-paper p-6 rounded-lg border border-fog space-y-4">
                <h3 className="text-base font-bold text-ink">
                  No se pudo estructurar el documento
                </h3>
                <p className="text-xs text-steel">
                  Tipo detectado: <strong>{currentResult.detectedType.toUpperCase()}</strong>. Revise
                  el texto reconocido para decidir si conviene volver a escanear el documento.
                </p>
                <pre className="p-4 bg-mist rounded-lg text-xs font-mono text-ink max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {currentResult.extractedText || 'No se reconocieron lineas de texto.'}
                </pre>
                <div className="flex justify-end">
                  <button
                    onClick={() => setCurrentResult(null)}
                    className="px-4 py-2 bg-ink hover:bg-ink text-white text-sm font-semibold rounded-lg"
                  >
                    Volver al lector
                  </button>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};
