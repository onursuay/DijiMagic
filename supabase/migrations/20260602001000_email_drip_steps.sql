-- supabase/migrations/20260602001000_email_drip_steps.sql
-- Mevcut otomasyonlar geri uyumlu çalışmaya devam eder (adım yoksa eski davranış).

CREATE TABLE IF NOT EXISTS public.email_automation_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  step_order    int NOT NULL DEFAULT 0,
  subject       text NOT NULL DEFAULT '',
  html          text NOT NULL DEFAULT '',
  delay_days    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, step_order)
);
CREATE INDEX IF NOT EXISTS idx_automation_steps_automation ON public.email_automation_steps(automation_id);

CREATE TABLE IF NOT EXISTS public.email_drip_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  step_id       uuid NOT NULL REFERENCES public.email_automation_steps(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  contact_id    uuid REFERENCES public.email_contacts(id) ON DELETE SET NULL,
  email         text NOT NULL,
  scheduled_at  timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drip_queue_due ON public.email_drip_queue(scheduled_at, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_drip_queue_user ON public.email_drip_queue(user_id);

-- RLS
ALTER TABLE public.email_automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_drip_queue       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_automation_steps_own" ON public.email_automation_steps
  FOR SELECT USING (
    automation_id IN (SELECT id FROM public.email_automations WHERE user_id = auth.uid())
  );
CREATE POLICY "email_drip_queue_own" ON public.email_drip_queue
  FOR SELECT USING (user_id = auth.uid());
