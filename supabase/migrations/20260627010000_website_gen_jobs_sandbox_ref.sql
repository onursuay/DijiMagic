-- Additive migration: sandbox tracking columns for website_gen_jobs
-- Safe to run multiple times (IF NOT EXISTS guards).

ALTER TABLE website_gen_jobs ADD COLUMN IF NOT EXISTS sandbox_id  text;
ALTER TABLE website_gen_jobs ADD COLUMN IF NOT EXISTS session_id  text;
ALTER TABLE website_gen_jobs ADD COLUMN IF NOT EXISTS cmd_id      text;
