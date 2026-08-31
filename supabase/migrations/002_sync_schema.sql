-- ==============================================================================
-- Migracion 002: Columnas JSONB para sync y tablas faltantes
-- ==============================================================================

-- 1. Tabla de cedulas / documentos de identidad
CREATE TABLE IF NOT EXISTS public.id_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number TEXT NOT NULL,
    document_type TEXT DEFAULT 'CC',
    first_names TEXT NOT NULL,
    last_names TEXT NOT NULL,
    birth_date DATE,
    expedition_place TEXT,
    address TEXT,
    gender TEXT,
    raw_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de afiliaciones de salud y prestaciones
CREATE TABLE IF NOT EXISTS public.health_affiliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id),
    worker_name TEXT,
    document_number TEXT,
    eps_name TEXT,
    eps_regime TEXT,
    arl_name TEXT,
    pension_fund TEXT,
    severance_fund TEXT,
    compensation_box TEXT,
    affiliation_date DATE,
    certificate_url TEXT,
    raw_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Columnas JSONB para snapshot de datos en candidatos (para sync via upsert)
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS education_json JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS experience_json JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS skills_json JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS languages_json JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS certifications_json JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS references_json JSONB DEFAULT '[]'::JSONB;

-- 4. Columnas en empleados para snapshot offline
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS candidate_data JSONB;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS health_data JSONB;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS memo_count INT DEFAULT 0;

-- 5. Columnas en contratos para campos del formulario no cubiertos en SQL
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS worker_name TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS worker_document_number TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS employer_name TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS employer_nit TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS renewals_json JSONB DEFAULT '[]'::JSONB;

-- 6. Columnas en vacantes para requisitos y rankings
ALTER TABLE public.vacancies ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.vacancies ADD COLUMN IF NOT EXISTS rankings JSONB DEFAULT '[]'::JSONB;

-- 7. Nombre del empleado en memoranda y alertas (conveniencia)
ALTER TABLE public.memoranda ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS employee_name TEXT;

-- 8. RLS: politicas seguras por rol
-- Helper function: obtiene el rol del usuario actual desde profiles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Candidatos: admin y rrhh gestionan, reclutador ve, consulta ve
DROP POLICY IF EXISTS "Permitir gestion completa a administradores y RRHH" ON public.candidates;
CREATE POLICY "Candidatos: gestion por admin y RRHH" ON public.candidates
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'rrhh'));

CREATE POLICY "Candidatos: lectura por reclutador y consulta" ON public.candidates
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('reclutador', 'consulta'));

-- Empleados: admin y rrhh gestionan
DROP POLICY IF EXISTS "Permitir acceso a empleados para RRHH" ON public.employees;
CREATE POLICY "Empleados: gestion por admin y RRHH" ON public.employees
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'rrhh'));

-- Contratos: admin y rrhh gestionan
DROP POLICY IF EXISTS "Permitir acceso a contratos para RRHH" ON public.contracts;
CREATE POLICY "Contratos: gestion por admin y RRHH" ON public.contracts
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'rrhh'));

-- Memorandos: admin y rrhh gestionan
DROP POLICY IF EXISTS "Permitir acceso a memorandos para RRHH" ON public.memoranda;
CREATE POLICY "Memorandos: gestion por admin y RRHH" ON public.memoranda
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'rrhh'));

-- Alertas: todos los autenticados leen; admin y rrhh gestionan
DROP POLICY IF EXISTS "Permitir acceso a alertas para usuarios autenticados" ON public.alerts;
CREATE POLICY "Alertas: gestion por admin y RRHH" ON public.alerts
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'rrhh'));

CREATE POLICY "Alertas: lectura por todos" ON public.alerts
  FOR SELECT TO authenticated
  USING (true);

-- Empleador: admin actualiza, todos leen
CREATE POLICY "Empleador: gestion por admin" ON public.employers
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Empleador: lectura" ON public.employers
  FOR SELECT TO authenticated
  USING (true);

-- Vacantes: admin, rrhh y reclutador gestionan
CREATE POLICY "Vacantes: gestion por admin, RRHH y reclutador" ON public.vacancies
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'rrhh', 'reclutador'));

-- Auditoria: admin ve todo; solo el sistema inserta
CREATE POLICY "Auditoria: gestion por admin" ON public.audit_log
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

-- Perfiles: el propio usuario ve su perfil
DROP POLICY IF EXISTS "Permitir lectura para usuarios autenticados" ON public.profiles;
CREATE POLICY "Perfiles: ver propio" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Perfiles: admin gestiona" ON public.profiles
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

-- cedulas y salud: admin y rrhh
CREATE POLICY "Cedulas: gestion por admin y RRHH" ON public.id_cards
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'rrhh'));

CREATE POLICY "Salud: gestion por admin y RRHH" ON public.health_affiliations
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'rrhh'));