-- Expediente documental por empleado.
-- Guarda una ficha de cada documento leido (contrato, memorando, llamado de
-- atencion, salud, renuncia, funciones...) con su texto OCR y los datos de
-- identidad, vinculada al empleado por su numero de documento. No se sube el
-- archivo binario: operacion 100% en navegador (costo $0).

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  worker_name TEXT,
  worker_document_number TEXT,
  matched_employee_id TEXT,
  extracted_text TEXT,
  source_file_name TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence_score DOUBLE PRECISION,
  method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee
  ON public.employee_documents (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_worker_doc
  ON public.employee_documents (worker_document_number);

-- RLS: gestion por admin y RRHH (fiel al resto del esquema).
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expediente: gestion por admin y RRHH" ON public.employee_documents
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'rrhh'))
  WITH CHECK (public.get_user_role() IN ('admin', 'rrhh'));

CREATE POLICY "Expediente: lectura para autenticados" ON public.employee_documents
  FOR SELECT TO authenticated
  USING (true);
