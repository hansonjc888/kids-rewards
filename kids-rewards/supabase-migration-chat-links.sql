-- Migration: Add chat_links table and invite codes
-- Run this on existing databases to add /join command support

-- Chat links table (maps platform chats to households)
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

CREATE POLICY "Parents can read own household chat links" ON chat_links
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM parents WHERE id = auth.uid())
  );

-- Generate invite codes for existing households that don't have one
UPDATE households
SET settings = settings || jsonb_build_object(
  'invite_code',
  upper(substr(md5(random()::text), 1, 6))
)
WHERE NOT (settings ? 'invite_code');
