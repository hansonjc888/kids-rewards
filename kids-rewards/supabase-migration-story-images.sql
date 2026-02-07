-- Migration: Add story and image support to submissions
-- Run this in Supabase SQL editor

-- Add new columns to submissions table
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS llm_story TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_s3_key TEXT;

-- Add comments
COMMENT ON COLUMN submissions.llm_story IS 'LLM-generated story about the achievement (2-4 sentences)';
COMMENT ON COLUMN submissions.image_url IS 'Presigned S3 URL for viewing the image';
COMMENT ON COLUMN submissions.image_s3_key IS 'S3 key for the uploaded image';
