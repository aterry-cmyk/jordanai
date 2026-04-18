-- JordanAI Database Schema
-- Run this entire file in Supabase SQL Editor once

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT,
  email         TEXT,
  zip_code      TEXT,
  loan_amount   TEXT,
  source        TEXT DEFAULT 'Manual',
  language      TEXT DEFAULT 'en',
  notes         TEXT DEFAULT '',
  -- Qualifying (filled by AI during calls)
  credit_score  TEXT DEFAULT '',
  income        TEXT DEFAULT '',
  down_payment  TEXT DEFAULT '',
  looking_to_buy TEXT DEFAULT '',
  timeline      TEXT DEFAULT '',
  interest_level TEXT DEFAULT '',
  lead_rating   INT DEFAULT 0,
  -- Pipeline
  stage         TEXT DEFAULT 'new_lead',
  temperature   TEXT DEFAULT 'cold',
  ai_analysis   TEXT DEFAULT '',
  next_action   TEXT DEFAULT '',
  called_count  INT DEFAULT 0,
  last_called   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Calls table
CREATE TABLE IF NOT EXISTS calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES leads(id) ON DELETE CASCADE,
  twilio_sid      TEXT,
  voice_id        TEXT,
  script_id       UUID,
  status          TEXT DEFAULT 'initiating',
  duration        INT DEFAULT 0,
  recording_url   TEXT,
  recording_sid   TEXT,
  transcript      TEXT,
  ai_summary      TEXT,
  ai_rating       INT DEFAULT 0,
  temperature     TEXT,
  next_action     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

-- Call conversations (persisted so server restarts don't break calls)
CREATE TABLE IF NOT EXISTS call_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id     UUID REFERENCES calls(id) ON DELETE CASCADE,
  history     JSONB DEFAULT '[]',
  extracted   JSONB DEFAULT '{}',
  voice       TEXT,
  language    TEXT DEFAULT 'en',
  script_theme TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Scripts
CREATE TABLE IF NOT EXISTS scripts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  script      TEXT NOT NULL,
  lead_type   TEXT DEFAULT 'general',
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Training notes
CREATE TABLE IF NOT EXISTS training_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  category    TEXT DEFAULT 'general',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Agent chat history
CREATE TABLE IF NOT EXISTS agent_chats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent       TEXT NOT NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- App config (API keys stored here)
CREATE TABLE IF NOT EXISTS app_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_stage    ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_temp     ON leads(temperature);
CREATE INDEX IF NOT EXISTS idx_calls_lead     ON calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_sid      ON calls(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_conv_call      ON call_conversations(call_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER conv_updated_at
  BEFORE UPDATE ON call_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
