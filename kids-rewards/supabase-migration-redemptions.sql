-- Migration: Points Redemption System & Period Reset
-- Creates rewards catalog, redemptions tracking, and points reset audit tables

-- Rewards catalog (parent-defined per household)
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  star_cost INTEGER NOT NULL CHECK (star_cost > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rewards_household ON rewards(household_id);
CREATE INDEX idx_rewards_active ON rewards(household_id, is_active);

-- Redemption requests with approval flow
CREATE TABLE IF NOT EXISTS redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES rewards(id) ON DELETE SET NULL,
  reward_name TEXT NOT NULL,
  star_cost INTEGER NOT NULL CHECK (star_cost > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  parent_user_id TEXT,
  platform_chat_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_redemptions_kid ON redemptions(kid_id);
CREATE INDEX idx_redemptions_household ON redemptions(household_id);
CREATE INDEX idx_redemptions_status ON redemptions(household_id, status);

-- Points reset audit log
CREATE TABLE IF NOT EXISTS points_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('manual', 'auto_monthly', 'auto_yearly')),
  kid_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_points_resets_household ON points_resets(household_id);

-- RLS Policies for rewards
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view rewards in their household" ON rewards
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM parents WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parents can manage rewards in their household" ON rewards
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM parents WHERE id = auth.uid()
    )
  );

-- RLS Policies for redemptions
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view redemptions in their household" ON redemptions
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM parents WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parents can manage redemptions in their household" ON redemptions
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM parents WHERE id = auth.uid()
    )
  );

-- RLS Policies for points_resets
ALTER TABLE points_resets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view resets in their household" ON points_resets
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM parents WHERE id = auth.uid()
    )
  );
