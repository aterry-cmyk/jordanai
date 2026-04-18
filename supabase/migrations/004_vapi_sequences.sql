-- Migration 004: Vapi calling + sequences (additive only — never drops anything)
CREATE TABLE IF NOT EXISTS vapi_assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL DEFAULT 'en',
  vapi_assistant_id TEXT,
  voice_id TEXT NOT NULL DEFAULT 'zl7szWVBXnpgrJmAalgz',
  company_name TEXT NOT NULL DEFAULT 'Dream Key Lending Group',
  lo_name TEXT NOT NULL DEFAULT 'Juan',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(language)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='vapi_call_id') THEN ALTER TABLE calls ADD COLUMN vapi_call_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='recording_url') THEN ALTER TABLE calls ADD COLUMN recording_url TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='transcript') THEN ALTER TABLE calls ADD COLUMN transcript TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='disposition') THEN ALTER TABLE calls ADD COLUMN disposition TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='duration_seconds') THEN ALTER TABLE calls ADD COLUMN duration_seconds INTEGER; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='ended_reason') THEN ALTER TABLE calls ADD COLUMN ended_reason TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='qualification_data') THEN ALTER TABLE calls ADD COLUMN qualification_data JSONB DEFAULT '{}'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='call_type') THEN ALTER TABLE calls ADD COLUMN call_type TEXT DEFAULT 'outbound'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='attempt_number') THEN ALTER TABLE calls ADD COLUMN attempt_number INTEGER DEFAULT 1; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='has_ssn') THEN ALTER TABLE leads ADD COLUMN has_ssn BOOLEAN; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='has_itin') THEN ALTER TABLE leads ADD COLUMN has_itin BOOLEAN; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='reported_income') THEN ALTER TABLE leads ADD COLUMN reported_income INTEGER; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='current_rent') THEN ALTER TABLE leads ADD COLUMN current_rent INTEGER; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='credit_score_range') THEN ALTER TABLE leads ADD COLUMN credit_score_range TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='down_payment_available') THEN ALTER TABLE leads ADD COLUMN down_payment_available INTEGER; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='co_buyer') THEN ALTER TABLE leads ADD COLUMN co_buyer BOOLEAN DEFAULT FALSE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='employment_type') THEN ALTER TABLE leads ADD COLUMN employment_type TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='target_area') THEN ALTER TABLE leads ADD COLUMN target_area TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='call_attempts') THEN ALTER TABLE leads ADD COLUMN call_attempts INTEGER DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='last_called_at') THEN ALTER TABLE leads ADD COLUMN last_called_at TIMESTAMPTZ; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='next_contact_at') THEN ALTER TABLE leads ADD COLUMN next_contact_at TIMESTAMPTZ; END IF;
END$$;
CREATE TABLE IF NOT EXISTS sequences (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, trigger TEXT NOT NULL DEFAULT 'manual', is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS sequence_steps (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE, step_number INTEGER NOT NULL, action_type TEXT NOT NULL, delay_minutes INTEGER NOT NULL DEFAULT 0, content TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(sequence_id, step_number));
CREATE TABLE IF NOT EXISTS sequence_enrollments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lead_id UUID NOT NULL, sequence_id UUID NOT NULL REFERENCES sequences(id), current_step INTEGER DEFAULT 0, status TEXT DEFAULT 'active', enrolled_at TIMESTAMPTZ DEFAULT NOW(), next_step_at TIMESTAMPTZ, UNIQUE(lead_id, sequence_id));
CREATE TABLE IF NOT EXISTS sequence_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id UUID NOT NULL REFERENCES sequence_enrollments(id), lead_id UUID NOT NULL, step_number INTEGER, action_type TEXT, status TEXT, fired_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_calls_vapi ON calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_leads_next_contact ON leads(next_contact_at);
