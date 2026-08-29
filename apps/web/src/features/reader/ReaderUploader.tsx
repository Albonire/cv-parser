import React, { useRef, useState } from 'react';
import { CloudUploadIcon, LegalDocument02Icon, CheckmarkCircle01Icon, Alert01Icon, Loading03Icon } from 'hugeicons-react';

interface ReaderUploaderProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
  progressMessage?: string;
  progressPercent?: number;
}

export const ReaderUploader: React.FC<ReaderUploaderProps> = ({
  onFilesSelected,
  isProcessing,
  progressMessage,
  progressPercent = 0,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-navy-200 p-6 shadow-sm">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-brand-500 bg-brand-50/50 scale-[0.99]'
            : 'border-navy-300 hover:border-brand-400 bg-navy-50/30'
        } ${isProcessing ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.bmp"
          onChange={handleFileChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loading03Icon className="h-12 w-12 text-brand-600 animate-spin mb-4" />
            <h3 className="text-base font-semibold text-navy-800">
              {progressMessage || 'Procesando documento...'}
            </h3>
            <p className="text-xs text-navy-500 mt-1">
              Ejecutando analisis y OCR local en WebAssembly (100% en tu navegador)
            </p>

            {/* Barra de progreso */}
            <div className="w-full max-w-md bg-navy-100 rounded-full h-3 mt-4 overflow-hidden">
              <div
                className="bg-brand-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-brand-700 mt-1">
              {progressPercent}%
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="p-3 bg-brand-100 text-brand-700 rounded-full mb-3">
              <CloudUploadIcon className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold text-navy-900">
              Arrastra y suelta tus hojas de vida o documentos aqui
            </h3>
            <p className="text-sm text-navy-600 mt-1">
              O haz clic para seleccionar archivos desde tu equipo
            </p>
            <p className="text-xs text-navy-400 mt-2">
              Formatos soportados: <strong>PDF (digital y escaneado), Word (.docx), JPG, PNG, WEBP</strong>
            </p>
            <div className="mt-4 flex items-center space-x-3 text-xs text-navy-600 bg-navy-100/70 px-3 py-1.5 rounded-md">
              <span className="flex items-center">
                <CheckmarkCircle01Icon className="h-3.5 w-3.5 text-brand-600 mr-1" />
                Costo $0
              </span>
              <span className="flex items-center">
                <CheckmarkCircle01Icon className="h-3.5 w-3.5 text-brand-600 mr-1" />
                100% Privado (en tu CPU)
              </span>
              <span className="flex items-center">
                <CheckmarkCircle01Icon className="h-3.5 w-3.5 text-brand-600 mr-1" />
                Revision humana antes de guardar
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
