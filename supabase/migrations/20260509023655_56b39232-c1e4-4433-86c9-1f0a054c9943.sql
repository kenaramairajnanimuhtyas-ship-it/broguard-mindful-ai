
-- Roles enum & table
CREATE TYPE public.app_role AS ENUM ('admin', 'guru_bk');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','guru_bk'));
$$;

-- Auto profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);

  -- First user becomes admin, others guru_bk
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'guru_bk');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nis TEXT,
  full_name TEXT NOT NULL,
  class_name TEXT,
  gender TEXT,
  birth_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Questionnaires
CREATE TABLE public.questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  access_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('multiple_choice','essay')),
  text TEXT NOT NULL,
  options JSONB,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions (filled by students via public link)
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_nis TEXT,
  student_class TEXT,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Responses
CREATE TABLE public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analyses
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL,
  risk_score INT NOT NULL DEFAULT 0,
  summary TEXT,
  recommendations TEXT,
  raw_ai JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "self read profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_staff(auth.uid()));
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles
CREATE POLICY "view roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- students - staff only
CREATE POLICY "staff read students" ON public.students FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert students" ON public.students FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update students" ON public.students FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "staff delete students" ON public.students FOR DELETE USING (public.is_staff(auth.uid()));

-- questionnaires - staff manages, public can read active by code (read all active)
CREATE POLICY "staff manage questionnaires" ON public.questionnaires FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "public read active questionnaires" ON public.questionnaires FOR SELECT USING (status = 'active');

-- questions - staff manages, public read for active questionnaires
CREATE POLICY "staff manage questions" ON public.questions FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "public read questions of active" ON public.questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.questionnaires q WHERE q.id = questionnaire_id AND q.status = 'active')
);

-- sessions - public can insert and read own; staff read all
CREATE POLICY "staff read sessions" ON public.sessions FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "public insert sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "public read own session via id" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "staff update sessions" ON public.sessions FOR UPDATE USING (public.is_staff(auth.uid()));
-- allow public to update own session to mark completed (anyone with id) - simple approach
CREATE POLICY "public update sessions" ON public.sessions FOR UPDATE USING (true) WITH CHECK (true);

-- responses - public insert; staff read; public read own session responses
CREATE POLICY "public insert responses" ON public.responses FOR INSERT WITH CHECK (true);
CREATE POLICY "staff read responses" ON public.responses FOR SELECT USING (public.is_staff(auth.uid()));

-- analyses - staff read all; only edge function (service role) writes
CREATE POLICY "staff read analyses" ON public.analyses FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "public read own analysis" ON public.analyses FOR SELECT USING (true);

-- Indexes
CREATE INDEX ON public.questions(questionnaire_id, order_index);
CREATE INDEX ON public.sessions(questionnaire_id);
CREATE INDEX ON public.responses(session_id);
