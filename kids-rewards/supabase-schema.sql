-- Kids Rewards System Database Schema
-- Run this in Supabase SQL Editor

-- Households table
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kids table
CREATE TABLE IF NOT EXISTS kids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, username)
);

-- Create index for case-insensitive username lookup
CREATE INDEX IF NOT EXISTS idx_kids_username_lower ON kids (household_id, LOWER(username));

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID REFERENCES kids(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,

  -- Platform info
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'whatsapp')),
  platform_message_id TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,

  -- Message content
  original_text TEXT,
  media_url TEXT,

  -- LLM processing results
  llm_summary TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  confidence DECIMAL,

  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending_identity', 'pending_review', 'approved', 'rejected')),
  identity_source TEXT CHECK (identity_source IN ('explicit_at', 'button', 'parent_override')),

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint for idempotency
  UNIQUE(platform, platform_message_id)
);

-- Approvals table
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  parent_user_id TEXT,
  stars INTEGER CHECK (stars BETWEEN 1 AND 3),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Points ledger (append-only)
CREATE TABLE IF NOT EXISTS points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID REFERENCES kids(id) ON DELETE CASCADE,
  delta_points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  submission_id UUID REFERENCES submissions(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_kid ON submissions(kid_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_household ON submissions(household_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_kid ON points_ledger(kid_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_created ON points_ledger(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Phase 6: Parent Authentication & Kid-Scoped Dashboard
-- ============================================================

-- Parents table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS parents (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Parent-kid assignments (which kids a parent can see)
CREATE TABLE IF NOT EXISTS parent_kid_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  kid_id UUID REFERENCES kids(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_id, kid_id)
);

-- Parent contacts (Telegram/WhatsApp IDs for notifications)
CREATE TABLE IF NOT EXISTS parent_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'whatsapp')),
  platform_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_id, platform, platform_user_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_kid_assignments_parent ON parent_kid_assignments(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_kid_assignments_kid ON parent_kid_assignments(kid_id);
CREATE INDEX IF NOT EXISTS idx_parent_contacts_parent ON parent_contacts(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_contacts_platform ON parent_contacts(platform, platform_user_id);

-- Enable RLS on new tables
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_kid_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_contacts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- NOTE: Service role key bypasses RLS entirely, so no "service role" policies needed.
-- Only define policies for authenticated parent users here.

-- Parents: can read own record
CREATE POLICY "Parents can read own record" ON parents
  FOR SELECT USING (auth.uid() = id);

-- Parent-kid assignments: parents can read their own
CREATE POLICY "Parents can read own assignments" ON parent_kid_assignments
  FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY "Parents can manage own assignments" ON parent_kid_assignments
  FOR ALL USING (auth.uid() = parent_id);

-- Parent contacts: parents can manage their own
CREATE POLICY "Parents can read own contacts" ON parent_contacts
  FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY "Parents can manage own contacts" ON parent_contacts
  FOR ALL USING (auth.uid() = parent_id);

-- Households: parents can read their household
CREATE POLICY "Parents can read own household" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM parents WHERE id = auth.uid())
  );

-- Kids: parents can read kids assigned to them
CREATE POLICY "Parents can read assigned kids" ON kids
  FOR SELECT USING (
    id IN (SELECT kid_id FROM parent_kid_assignments WHERE parent_id = auth.uid())
  );

-- Submissions: parents can read submissions from assigned kids
CREATE POLICY "Parents can read assigned kids submissions" ON submissions
  FOR SELECT USING (
    kid_id IN (SELECT kid_id FROM parent_kid_assignments WHERE parent_id = auth.uid())
  );

-- Approvals: parents can read/create for assigned kids' submissions
CREATE POLICY "Parents can read assigned kids approvals" ON approvals
  FOR SELECT USING (
    submission_id IN (
      SELECT s.id FROM submissions s
      JOIN parent_kid_assignments pka ON s.kid_id = pka.kid_id
      WHERE pka.parent_id = auth.uid()
    )
  );

CREATE POLICY "Parents can create approvals" ON approvals
  FOR INSERT WITH CHECK (
    submission_id IN (
      SELECT s.id FROM submissions s
      JOIN parent_kid_assignments pka ON s.kid_id = pka.kid_id
      WHERE pka.parent_id = auth.uid()
    )
  );

-- Points ledger: parents can read for assigned kids
CREATE POLICY "Parents can read assigned kids points" ON points_ledger
  FOR SELECT USING (
    kid_id IN (SELECT kid_id FROM parent_kid_assignments WHERE parent_id = auth.uid())
  );

-- Chat links (maps platform chats to households via /join command)
CREATE TABLE IF NOT EXISTS chat_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'whatsapp')),
  platform_chat_id TEXT NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, platform_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_links_platform ON chat_links(platform, platform_chat_id);

ALTER TABLE chat_links ENABLE ROW LEVEL SECURITY;

-- Chat links: parents can read chat links for their household
CREATE POLICY "Parents can read own household chat links" ON chat_links
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM parents WHERE id = auth.uid())
  );

-- Insert test household and kids
INSERT INTO households (name, settings)
VALUES ('Test Family', '{"timezone": "UTC"}')
ON CONFLICT DO NOTHING
RETURNING id;

-- Get the household ID and insert test kids
-- You'll need to replace <household_id> with the actual UUID returned above
-- For now, we'll create a function to do this automatically

-- Create test data insertion function
CREATE OR REPLACE FUNCTION setup_test_data()
RETURNS void AS $$
DECLARE
  v_household_id UUID;
BEGIN
  -- Get or create test household
  INSERT INTO households (name, settings)
  VALUES ('Test Family', '{"timezone": "UTC"}')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_household_id FROM households WHERE name = 'Test Family' LIMIT 1;

  -- Insert test kids
  INSERT INTO kids (household_id, display_name, username)
  VALUES
    (v_household_id, 'Alice', 'alice'),
    (v_household_id, 'Bob', 'bob'),
    (v_household_id, 'JoJo', 'jojo'),
    (v_household_id, 'Jasper', 'jasper')
  ON CONFLICT (household_id, username) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Run the setup
SELECT setup_test_data();

-- Verify setup
SELECT
  h.name as household,
  k.username,
  k.display_name
FROM kids k
JOIN households h ON k.household_id = h.id
ORDER BY k.username;
