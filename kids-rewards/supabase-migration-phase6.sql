-- Phase 6 Migration: Parent Authentication & Kid-Scoped Dashboard
-- Run this in Supabase SQL Editor on an EXISTING database
-- (supabase-schema.sql already includes these for fresh installs)

-- ============================================================
-- Step 1: Create new tables
-- ============================================================

CREATE TABLE IF NOT EXISTS parents (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parent_kid_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  kid_id UUID REFERENCES kids(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_id, kid_id)
);

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

ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_kid_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_contacts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 2: Drop old permissive policies
-- ============================================================

DROP POLICY IF EXISTS "Allow all for service role" ON households;
DROP POLICY IF EXISTS "Allow all for service role" ON kids;
DROP POLICY IF EXISTS "Allow all for service role" ON submissions;
DROP POLICY IF EXISTS "Allow all for service role" ON approvals;
DROP POLICY IF EXISTS "Allow all for service role" ON points_ledger;

-- ============================================================
-- Step 3: Create scoped RLS policies
-- ============================================================

-- Parents table
CREATE POLICY "Parents can read own record" ON parents
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Service role full access on parents" ON parents
  FOR ALL USING (true);

-- Parent-kid assignments
CREATE POLICY "Parents can read own assignments" ON parent_kid_assignments
  FOR SELECT USING (auth.uid() = parent_id);
CREATE POLICY "Parents can manage own assignments" ON parent_kid_assignments
  FOR ALL USING (auth.uid() = parent_id);
CREATE POLICY "Service role full access on parent_kid_assignments" ON parent_kid_assignments
  FOR ALL USING (true);

-- Parent contacts
CREATE POLICY "Parents can read own contacts" ON parent_contacts
  FOR SELECT USING (auth.uid() = parent_id);
CREATE POLICY "Parents can manage own contacts" ON parent_contacts
  FOR ALL USING (auth.uid() = parent_id);
CREATE POLICY "Service role full access on parent_contacts" ON parent_contacts
  FOR ALL USING (true);

-- Households
CREATE POLICY "Parents can read own household" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM parents WHERE id = auth.uid())
  );
CREATE POLICY "Service role full access on households" ON households
  FOR ALL USING (true);

-- Kids
CREATE POLICY "Parents can read assigned kids" ON kids
  FOR SELECT USING (
    id IN (SELECT kid_id FROM parent_kid_assignments WHERE parent_id = auth.uid())
  );
CREATE POLICY "Service role full access on kids" ON kids
  FOR ALL USING (true);

-- Submissions
CREATE POLICY "Parents can read assigned kids submissions" ON submissions
  FOR SELECT USING (
    kid_id IN (SELECT kid_id FROM parent_kid_assignments WHERE parent_id = auth.uid())
  );
CREATE POLICY "Service role full access on submissions" ON submissions
  FOR ALL USING (true);

-- Approvals
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
CREATE POLICY "Service role full access on approvals" ON approvals
  FOR ALL USING (true);

-- Points ledger
CREATE POLICY "Parents can read assigned kids points" ON points_ledger
  FOR SELECT USING (
    kid_id IN (SELECT kid_id FROM parent_kid_assignments WHERE parent_id = auth.uid())
  );
CREATE POLICY "Service role full access on points_ledger" ON points_ledger
  FOR ALL USING (true);
