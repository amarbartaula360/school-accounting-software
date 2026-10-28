-- Examination, marksheet and competency-based progress-report module.
-- Safe/idempotent structure migration. Does not delete or recreate students.
-- Run on the SAME PostgreSQL database used by the Render API, after taking a backup.

CREATE TABLE IF NOT EXISTS public.exam_academic_years (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  year_name VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_email VARCHAR(254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_exam_academic_year_dates CHECK (end_date >= start_date),
  CONSTRAINT uq_exam_academic_year_name UNIQUE (organization_id, year_name)
);

CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  grade SMALLINT NOT NULL CHECK (grade BETWEEN 4 AND 10),
  subject_code VARCHAR(50) NOT NULL,
  name_en VARCHAR(160) NOT NULL,
  name_ne VARCHAR(160) NOT NULL,
  is_practical BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_subject_code UNIQUE (organization_id, grade, subject_code)
);

CREATE TABLE IF NOT EXISTS public.exam_competencies (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  grade SMALLINT NOT NULL CHECK (grade BETWEEN 4 AND 10),
  subject_id BIGINT NOT NULL REFERENCES public.exam_subjects(id) ON DELETE RESTRICT,
  competency_code VARCHAR(60) NOT NULL,
  description_en TEXT NOT NULL,
  description_ne TEXT NOT NULL,
  source_guideline VARCHAR(300),
  source_reference TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_email VARCHAR(254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_competency_code UNIQUE (organization_id, grade, subject_id, competency_code)
);

-- School-configured achievement levels. No official categories are seeded.
CREATE TABLE IF NOT EXISTS public.exam_achievement_levels (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  grade SMALLINT NOT NULL CHECK (grade BETWEEN 4 AND 10),
  level_code VARCHAR(40) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ne VARCHAR(100) NOT NULL,
  description_en TEXT,
  description_ne TEXT,
  source_guideline VARCHAR(300),
  is_officially_verified BOOLEAN NOT NULL DEFAULT FALSE,
  display_order SMALLINT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_achievement_level UNIQUE (organization_id, grade, level_code)
);

-- Grade boundaries and grade points must be configured from the applicable official rule.
-- No numeric grading bands or GPA formulas are hardcoded by this migration.
CREATE TABLE IF NOT EXISTS public.exam_grading_rules (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  academic_year_id BIGINT REFERENCES public.exam_academic_years(id) ON DELETE RESTRICT,
  grade SMALLINT NOT NULL CHECK (grade BETWEEN 4 AND 10),
  min_percentage NUMERIC(6,3) NOT NULL CHECK (min_percentage >= 0 AND min_percentage <= 100),
  max_percentage NUMERIC(6,3) NOT NULL CHECK (max_percentage >= 0 AND max_percentage <= 100),
  letter_grade VARCHAR(20) NOT NULL,
  grade_point NUMERIC(5,3),
  description_en TEXT,
  description_ne TEXT,
  source_guideline VARCHAR(300) NOT NULL,
  source_clause VARCHAR(100),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_email VARCHAR(254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_exam_grade_range CHECK (max_percentage >= min_percentage),
  CONSTRAINT uq_exam_grade_rule UNIQUE (organization_id, academic_year_id, grade, letter_grade)
);

CREATE TABLE IF NOT EXISTS public.exam_grading_policies (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  academic_year_id BIGINT REFERENCES public.exam_academic_years(id) ON DELETE RESTRICT,
  grade SMALLINT NOT NULL CHECK (grade BETWEEN 4 AND 10),
  gpa_method VARCHAR(30) NOT NULL DEFAULT 'not_configured'
    CHECK (gpa_method IN ('not_configured','arithmetic_mean','weighted_by_credit','configured_other')),
  gpa_max NUMERIC(5,3),
  overall_pass_rule TEXT,
  promotion_rule TEXT,
  source_guideline VARCHAR(300),
  source_clause VARCHAR(100),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_email VARCHAR(254),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_grading_policy UNIQUE (organization_id, academic_year_id, grade)
);

CREATE TABLE IF NOT EXISTS public.exam_exams (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  academic_year_id BIGINT NOT NULL REFERENCES public.exam_academic_years(id) ON DELETE RESTRICT,
  grade SMALLINT NOT NULL CHECK (grade BETWEEN 4 AND 10),
  class_name VARCHAR(60) NOT NULL,
  section VARCHAR(40),
  exam_name_en VARCHAR(160) NOT NULL,
  exam_name_ne VARCHAR(160) NOT NULL,
  exam_type VARCHAR(40) NOT NULL DEFAULT 'terminal',
  assessment_model VARCHAR(40) NOT NULL CHECK (assessment_model IN ('learning_achievement','subject_assessment','formal_marksheet')),
  exam_date DATE,
  exam_date_bs VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','locked','published')),
  created_by_email VARCHAR(254),
  approved_by_email VARCHAR(254),
  published_by_email VARCHAR(254),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_exams_org_year_grade
  ON public.exam_exams (organization_id, academic_year_id, grade, status);

CREATE TABLE IF NOT EXISTS public.exam_exam_subjects (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  exam_id BIGINT NOT NULL REFERENCES public.exam_exams(id) ON DELETE CASCADE,
  subject_id BIGINT NOT NULL REFERENCES public.exam_subjects(id) ON DELETE RESTRICT,
  full_marks NUMERIC(8,2),
  pass_marks NUMERIC(8,2),
  credit_hours NUMERIC(6,2),
  display_order SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_subject_for_exam UNIQUE (exam_id, subject_id),
  CONSTRAINT ck_exam_subject_marks CHECK (
    (full_marks IS NULL OR full_marks > 0) AND
    (pass_marks IS NULL OR pass_marks >= 0) AND
    (full_marks IS NULL OR pass_marks IS NULL OR pass_marks <= full_marks) AND
    (credit_hours IS NULL OR credit_hours > 0)
  )
);

CREATE TABLE IF NOT EXISTS public.exam_assessment_components (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  exam_subject_id BIGINT NOT NULL REFERENCES public.exam_exam_subjects(id) ON DELETE CASCADE,
  component_code VARCHAR(50) NOT NULL,
  name_en VARCHAR(140) NOT NULL,
  name_ne VARCHAR(140) NOT NULL,
  component_type VARCHAR(30) NOT NULL CHECK (component_type IN ('written','internal','practical','project','continuous','presentation','portfolio','oral','other')),
  max_marks NUMERIC(8,2),
  pass_marks NUMERIC(8,2),
  display_order SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_component_code UNIQUE (exam_subject_id, component_code),
  CONSTRAINT ck_exam_component_max CHECK (max_marks IS NULL OR max_marks > 0),
  CONSTRAINT ck_exam_component_pass CHECK (pass_marks IS NULL OR pass_marks >= 0),
  CONSTRAINT ck_exam_component_pass_max CHECK (pass_marks IS NULL OR max_marks IS NULL OR pass_marks <= max_marks)
);

ALTER TABLE public.exam_assessment_components ADD COLUMN IF NOT EXISTS pass_marks NUMERIC(8,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_exam_component_pass' AND conrelid = 'public.exam_assessment_components'::regclass) THEN
    ALTER TABLE public.exam_assessment_components
      ADD CONSTRAINT ck_exam_component_pass CHECK (pass_marks IS NULL OR pass_marks >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_exam_component_pass_max' AND conrelid = 'public.exam_assessment_components'::regclass) THEN
    ALTER TABLE public.exam_assessment_components
      ADD CONSTRAINT ck_exam_component_pass_max CHECK (pass_marks IS NULL OR max_marks IS NULL OR pass_marks <= max_marks);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.exam_marks (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  component_id BIGINT NOT NULL REFERENCES public.exam_assessment_components(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.fee_students(id) ON DELETE RESTRICT,
  marks_obtained NUMERIC(8,2),
  is_absent BOOLEAN NOT NULL DEFAULT FALSE,
  teacher_note TEXT,
  updated_by_email VARCHAR(254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_mark_per_component_student UNIQUE (component_id, student_id),
  CONSTRAINT ck_exam_marks_nonnegative CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
  CONSTRAINT ck_exam_absence_mark CHECK (NOT is_absent OR marks_obtained IS NULL)
);

CREATE TABLE IF NOT EXISTS public.exam_competency_results (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  exam_id BIGINT NOT NULL REFERENCES public.exam_exams(id) ON DELETE CASCADE,
  subject_id BIGINT NOT NULL REFERENCES public.exam_subjects(id) ON DELETE RESTRICT,
  competency_id BIGINT NOT NULL REFERENCES public.exam_competencies(id) ON DELETE RESTRICT,
  student_id BIGINT NOT NULL REFERENCES public.fee_students(id) ON DELETE RESTRICT,
  achievement_level_id BIGINT REFERENCES public.exam_achievement_levels(id) ON DELETE RESTRICT,
  observation_en TEXT,
  observation_ne TEXT,
  evidence_note TEXT,
  next_steps_en TEXT,
  next_steps_ne TEXT,
  updated_by_email VARCHAR(254),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_competency_result UNIQUE (exam_id, competency_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.exam_progress_reports (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  exam_id BIGINT NOT NULL REFERENCES public.exam_exams(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.fee_students(id) ON DELETE RESTRICT,
  strengths_en TEXT,
  strengths_ne TEXT,
  improvement_areas_en TEXT,
  improvement_areas_ne TEXT,
  teacher_comments_en TEXT,
  teacher_comments_ne TEXT,
  recommendations_en TEXT,
  recommendations_ne TEXT,
  parent_feedback TEXT,
  attendance_present INTEGER CHECK (attendance_present IS NULL OR attendance_present >= 0),
  attendance_total INTEGER CHECK (attendance_total IS NULL OR attendance_total >= 0),
  updated_by_email VARCHAR(254),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_exam_attendance_bounds CHECK (
    attendance_present IS NULL OR attendance_total IS NULL OR attendance_present <= attendance_total
  ),
  CONSTRAINT uq_exam_progress_report UNIQUE (exam_id, student_id)
);

-- Database-backed role assignments used by this module. Existing application login is demo-only;
-- replace with trusted server-side authentication before production use.
CREATE TABLE IF NOT EXISTS public.exam_role_assignments (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_email VARCHAR(254) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin','principal','exam_coordinator','teacher')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by_email VARCHAR(254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_role_email UNIQUE (organization_id, user_email)
);

-- Matches the demo user currently shown by the existing application LoginSystem.
-- Remove/change after integrating a real authentication system.
INSERT INTO public.exam_role_assignments (organization_id, user_email, role, assigned_by_email)
SELECT 1, 'amar@gmail.com', 'admin', 'migration'
WHERE EXISTS (SELECT 1 FROM public.organizations WHERE id = 1)
ON CONFLICT (organization_id, user_email) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.exam_result_history (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  exam_id BIGINT REFERENCES public.exam_exams(id) ON DELETE SET NULL,
  student_id BIGINT REFERENCES public.fee_students(id) ON DELETE SET NULL,
  actor_email VARCHAR(254),
  actor_role VARCHAR(30),
  action VARCHAR(60) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



CREATE TABLE IF NOT EXISTS public.exam_assessment_schedule (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  exam_id BIGINT NOT NULL REFERENCES public.exam_exams(id) ON DELETE CASCADE,
  exam_subject_id BIGINT NOT NULL REFERENCES public.exam_exam_subjects(id) ON DELETE CASCADE,
  exam_date DATE,
  exam_date_bs VARCHAR(20),
  start_time TIME,
  end_time TIME,
  room_or_venue VARCHAR(120),
  invigilator VARCHAR(160),
  updated_by_email VARCHAR(254),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_subject_schedule UNIQUE (exam_id, exam_subject_id),
  CONSTRAINT ck_exam_schedule_times CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)
);

-- Per-organization school identity used on printable reports; values are configured by the school.
-- No sample school name, address, phone or logo is seeded.
CREATE TABLE IF NOT EXISTS public.exam_report_settings (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE RESTRICT,
  school_name_en VARCHAR(200),
  school_name_ne VARCHAR(200),
  address_en TEXT,
  address_ne TEXT,
  contact_phone VARCHAR(60),
  contact_email VARCHAR(254),
  logo_url TEXT,
  updated_by_email VARCHAR(254),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_report_history (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  exam_id BIGINT NOT NULL REFERENCES public.exam_exams(id) ON DELETE CASCADE,
  student_id BIGINT REFERENCES public.fee_students(id) ON DELETE SET NULL,
  report_type VARCHAR(30) NOT NULL CHECK (report_type IN ('standard_marksheet','progress_report','bulk_marksheet','bulk_progress_report')),
  students_count INTEGER NOT NULL DEFAULT 1 CHECK (students_count >= 0),
  exam_status VARCHAR(20),
  generated_by_email VARCHAR(254),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_exam_report_history_exam_time
  ON public.exam_report_history (organization_id, exam_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_marks_student
  ON public.exam_marks (organization_id, student_id);
CREATE INDEX IF NOT EXISTS idx_exam_competency_results_student
  ON public.exam_competency_results (organization_id, exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_exam_progress_reports_student
  ON public.exam_progress_reports (organization_id, exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_exam_history_exam_time
  ON public.exam_result_history (organization_id, exam_id, created_at DESC);

-- Official source references checked for this implementation (no numeric rules are seeded):
-- CDC Letter Grading Directive 2083: https://moecdc.gov.np/content/647/letter-grading-directory--2083/
-- CDC Grade 4-5 Assessment Guide 2083: https://moecdc.gov.np/content/646/guide-to-student-assessment-in-basic-level/
-- CDC Internal Assessment Standards 2080, Grades 9-12: https://moecdc.gov.np/content/21/internal-assessment-standards-for-student-legacy--2080/
-- CDC project/practical assessment guide 2082, Grades 4-8: https://moecdc.gov.np/content/608/facilitation-manual-for-conducting-projects-and-experiments/
-- CEHRD Grade 4-5 mathematics student-assessment resources: https://www.cehrd.gov.np/content/13339/13339-student-assessment_trm_g4-5/
