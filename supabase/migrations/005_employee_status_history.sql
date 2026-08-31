-- Linea de tiempo de estados del empleado.
-- Registra cada cambio de estado (contratado / inactivo / reingreso) como un
-- evento inmutable, de modo que Rosimar conserve la historia completa de cada
-- persona dentro de la empresa: cuando fue contratada, cuando termino (y por
-- que) y si volvio a ser contratada. El reingreso NUNCA borra el evento de
-- salida anterior: se acumula para auditaridad.

CREATE TABLE IF NOT EXISTS public.employee_status_history (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('contratado', 'inactivo', 'reingreso')),
  status TEXT NOT NULL CHECK (status IN ('activo', 'inactivo')),
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  termination_reason TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_status_history_employee
  ON public.employee_status_history (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_status_history_date
  ON public.employee_status_history (date);

-- RLS: gestion por admin y RRHH (fiel al resto del esquema).
ALTER TABLE public.employee_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historial estados: gestion por admin y RRHH" ON public.employee_status_history
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'rrhh'))
  WITH CHECK (public.get_user_role() IN ('admin', 'rrhh'));

CREATE POLICY "Historial estados: lectura para autenticados" ON public.employee_status_history
  FOR SELECT TO authenticated
  USING (true);
