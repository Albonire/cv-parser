-- ==============================================================================
-- Migracion Inicial: Sistema de Gestion de Talento Humano - Rosimar S.A.S.
-- ==============================================================================

-- Habilitar extension pgcrypto para generacion de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Tabla de Perfiles de Usuario (Roles y Permisos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'rrhh', 'reclutador', 'consulta')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Configuracion Global del Empleador (Rosimar S.A.S.)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL DEFAULT 'Rosimar S.A.S.',
    nit TEXT NOT NULL,
    legal_representative TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    website TEXT,
    notice_days_default INT DEFAULT 30,
    trial_period_months_default INT DEFAULT 2,
    memo_warning_threshold INT DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Candidatos y Reclutamiento
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_names TEXT NOT NULL,
    last_names TEXT NOT NULL,
    document_type TEXT DEFAULT 'CC' CHECK (document_type IN ('CC', 'CE', 'TI', 'PAS', 'PEP', 'PPT', 'OTRO')),
    document_number TEXT NOT NULL,
    birth_date DATE,
    nationality TEXT DEFAULT 'Colombiana',
    birth_place TEXT,
    city_residence TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    marital_status TEXT,
    gender TEXT,
    photo_url TEXT,
    headline TEXT,
    summary TEXT,
    salary_expectation NUMERIC(12, 2),
    availability TEXT,
    status TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'en_revision', 'preseleccionado', 'en_entrevista', 'descartado', 'contratado', 'archivado')),
    original_document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidate_education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    level TEXT NOT NULL,
    institution TEXT NOT NULL,
    degree TEXT NOT NULL,
    field_of_study TEXT,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    honors TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidate_experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    location TEXT,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    responsibilities TEXT,
    technologies TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidate_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidate_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    reference_type TEXT NOT NULL CHECK (reference_type IN ('familiar', 'personal', 'laboral')),
    name TEXT NOT NULL,
    relationship TEXT,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidate_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    extracted_text TEXT,
    confidence_score NUMERIC(3, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidate_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    note TEXT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. Vacantes y Matching
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vacancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    department TEXT,
    description TEXT,
    requirements TEXT,
    salary_range TEXT,
    status TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'cerrada', 'pausada')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vacancy_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
    skill_or_req TEXT NOT NULL,
    weight INT DEFAULT 1,
    req_type TEXT DEFAULT 'habilidad' CHECK (req_type IN ('habilidad', 'experiencia', 'educacion', 'otro'))
);

CREATE TABLE IF NOT EXISTS public.candidate_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    score NUMERIC(5, 2) NOT NULL,
    manual_rating INT CHECK (manual_rating BETWEEN 1 AND 5),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (vacancy_id, candidate_id)
);

-- ------------------------------------------------------------------------------
-- 5. Empleados y Salud / Prestaciones
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidates(id),
    employee_code TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
    hire_date DATE NOT NULL,
    termination_date DATE,
    termination_reason TEXT CHECK (
        (status = 'inactivo' AND termination_date IS NOT NULL AND termination_reason IS NOT NULL) OR
        (status = 'activo')
    ),
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    eps_name TEXT,
    eps_regime TEXT,
    arl_name TEXT,
    pension_fund TEXT,
    severance_fund TEXT,
    compensation_box TEXT,
    attachments JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. Contratos Laborales y Prorrogas
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    employer_id UUID REFERENCES public.employers(id),
    position TEXT NOT NULL,
    salary NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'COP',
    payment_frequency TEXT DEFAULT 'mensual' CHECK (payment_frequency IN ('quincenal', 'mensual', 'otro')),
    contract_type TEXT NOT NULL CHECK (contract_type IN ('termino_fijo', 'indefinido', 'obra_labor', 'aprendizaje', 'tiempo_parcial', 'otro')),
    duration_months INT,
    start_date DATE NOT NULL,
    end_date DATE,
    trial_period_days INT DEFAULT 60,
    notice_days INT DEFAULT 30,
    execution_place TEXT DEFAULT 'Pamplona, Norte de Santander',
    signed_document_url TEXT,
    status TEXT NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente', 'por_vencer', 'vencido', 'terminado', 'cancelado', 'prorroga')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contract_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    renewal_number INT NOT NULL,
    new_end_date DATE NOT NULL,
    extended_months INT NOT NULL,
    effective_date DATE NOT NULL,
    document_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. Memorandos (Alerta destacada en 3)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memoranda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    memo_type TEXT NOT NULL CHECK (memo_type IN ('llamado_atencion', 'amonestacion_preventiva', 'amonestacion_disciplinaria', 'otro')),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    memo_date DATE NOT NULL DEFAULT CURRENT_DATE,
    responsible_person TEXT NOT NULL,
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'registrado' CHECK (status IN ('registrado', 'en_revision_contrato', 'archivado')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. Alertas del Sistema y Notificaciones
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('vencimiento_contrato', 'contrato_vencido', 'fin_periodo_prueba', 'limite_memorandos', 'cumpleanos', 'otro')),
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'vista', 'resuelta')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. Registro de Auditoria
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. Politicas de Seguridad por Fila (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacancy_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memoranda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Politica permisiva para usuarios autenticados (ampliable segun roles en profiles)
CREATE POLICY "Permitir lectura para usuarios autenticados" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir lectura de empleador" ON public.employers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir gestion completa a administradores y RRHH" ON public.candidates FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acceso a empleados para RRHH" ON public.employees FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acceso a contratos para RRHH" ON public.contracts FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acceso a memorandos para RRHH" ON public.memoranda FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acceso a alertas para usuarios autenticados" ON public.alerts FOR ALL TO authenticated USING (true);
