-- Newsletter bulk send queue: one run (shared JSON payload) + per-recipient jobs.
-- Service role (Edge Functions) bypasses RLS; no policies for anon/authenticated.

CREATE TABLE IF NOT EXISTS public.newsletter_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  app_url text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'enqueued'
    CHECK (status IN ('enqueued', 'processing', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.newsletter_runs (id) ON DELETE CASCADE,
  email text NOT NULL,
  recipient_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_jobs_run_email_unique UNIQUE (run_id, email)
);

CREATE INDEX IF NOT EXISTS email_jobs_pending_idx
  ON public.email_jobs (created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS email_jobs_run_status_idx
  ON public.email_jobs (run_id, status);

COMMENT ON TABLE public.newsletter_runs IS
  'One row per weekly (or manual) newsletter send; payload mirrors get-newsletter-insights JSON.';
COMMENT ON TABLE public.email_jobs IS
  'Per-recipient sends for a newsletter run; processed by process-newsletter-jobs.';

ALTER TABLE public.newsletter_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;

-- Reclaim jobs stuck in processing (worker crash / timeout).
CREATE OR REPLACE FUNCTION public.reset_stale_newsletter_jobs(
  stale_after interval DEFAULT interval '45 minutes'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.email_jobs
  SET
    status = 'pending',
    updated_at = now()
  WHERE status = 'processing'
    AND updated_at < now() - stale_after;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Atomically claim pending jobs for sending (Skip locked for concurrency).
CREATE OR REPLACE FUNCTION public.claim_newsletter_jobs(p_limit integer DEFAULT 12)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.email_jobs j
  SET
    status = 'processing',
    updated_at = now()
  FROM (
    SELECT ej.id
    FROM public.email_jobs ej
    WHERE ej.status = 'pending'
      AND ej.attempts < 30
    ORDER BY ej.created_at ASC
    LIMIT p_limit
    FOR UPDATE OF ej SKIP LOCKED
  ) picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

-- Mark runs completed when no pending/processing jobs remain.
CREATE OR REPLACE FUNCTION public.finalize_completed_newsletter_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer default 0;
BEGIN
  UPDATE public.newsletter_runs nr
  SET
    status = 'completed',
    completed_at = coalesce(nr.completed_at, now())
  WHERE nr.status IN ('enqueued', 'processing')
    AND EXISTS (SELECT 1 FROM public.email_jobs ej WHERE ej.run_id = nr.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.email_jobs ej
      WHERE ej.run_id = nr.id
        AND ej.status IN ('pending', 'processing')
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_stale_newsletter_jobs(interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_newsletter_jobs(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_completed_newsletter_runs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_stale_newsletter_jobs(interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_newsletter_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_completed_newsletter_runs() TO service_role;
