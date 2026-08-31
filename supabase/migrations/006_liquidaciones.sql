-- v006: Tabla de liquidaciones finales de contrato de empleados de Rosimar.
--
-- Cada registro de liquidacion vincula un empleado (por employeeId o por
-- workerDocumentNumber) con la fecha de retiro y los detalles financieros
-- (cesantias, prima, vacaciones, etc.) parseados desde los documentos.
--
-- RLS: solo admin y rrhh pueden leer/escribir. Los datos son sensibles
-- (salarios, retiros, indemnizaciones).

CREATE TABLE IF NOT EXISTS liquidaciones (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vinculacion con el empleado (puede estar null si se guarda antes de crear el empleado).
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  -- Numero de documento del trabajador (para vincular retrospectivamente).
  worker_document_number TEXT NOT NULL,
  -- Fecha de retiro (YYYY-MM-DD).
  fecha_retiro DATE NOT NULL,
  -- Estructura de datos de la liquidacion (parseada del OCR, revisada por RRHH).
  liquidacion_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Auditoria.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_worker_doc CHECK (worker_document_number ~ '^\d{5,11}$')
);

-- Indices para busquedas comunes.
CREATE INDEX IF NOT EXISTS idx_liquidaciones_employee_id ON liquidaciones(employee_id);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_worker_doc ON liquidaciones(worker_document_number);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_fecha_retiro ON liquidaciones(fecha_retiro);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_created_at ON liquidaciones(created_at);

-- Row-Level Security (RLS).
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;

-- Admin: acceso completo.
CREATE POLICY liquidaciones_admin_select
  ON liquidaciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY liquidaciones_admin_insert
  ON liquidaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY liquidaciones_admin_update
  ON liquidaciones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY liquidaciones_admin_delete
  ON liquidaciones
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- RRHH: lectura y escritura de liquidaciones (pero no borrado, para auditoria).
CREATE POLICY liquidaciones_rrhh_select
  ON liquidaciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'rrhh')
    )
  );

CREATE POLICY liquidaciones_rrhh_insert
  ON liquidaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'rrhh')
    )
  );

CREATE POLICY liquidaciones_rrhh_update
  ON liquidaciones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'rrhh')
    )
  );

-- Trigger para actualizar updated_at.
CREATE OR REPLACE FUNCTION update_liquidaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER liquidaciones_updated_at_trigger
BEFORE UPDATE ON liquidaciones
FOR EACH ROW
EXECUTE FUNCTION update_liquidaciones_updated_at();
