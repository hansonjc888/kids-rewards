# Phase 4 Setup: Story Generation & Image Support

## New Features

1. **Story Generation**: LLM now generates engaging 2-4 sentence stories about each achievement
2. **Image Support**: Kids can upload photos as evidence, parents see them during approval
3. **Enhanced Parent View**: Parents see both the story and the evidence image

## Setup Steps

### 1. Run Database Migration

Go to your Supabase SQL Editor and run:
```sql
-- Add new columns to submissions table
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS llm_story TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_s3_key TEXT;
```

Or upload the file: `supabase-migration-story-images.sql`

### 2. Create Supabase Storage Bucket (Required for Image Uploads)

**No new credentials needed!** Uses your existing Supabase connection.

#### Steps:

1. Go to your Supabase Dashboard: https://cyscplapwlmuumzxxypn.supabase.co
2. Click **Storage** in the left sidebar
3. Click **New Bucket**
4. Settings:
   - **Name**: `submission-images`
   - **Public**: ✅ Yes (so parents can view images)
   - **File size limit**: 5 MB (optional)
   - **Allowed MIME types**: `image/*` (optional)
5. Click **Create Bucket**

**That's it!** No environment variables to add, it uses your existing Supabase credentials.

**Note**: If you don't create the bucket, the bot will still work but image uploads will be disabled.

### 3. Stop Previous Bot

If Phase 3 bot is still running:
```bash
# Find the process
ps aux | grep test-bot

# Kill it (replace PID with actual process ID)
kill <PID>
```

Or if running in background task:
```bash
# Stop the background task
# (The task ID is shown in the output, e.g., b10ac77)
```

### 4. Start Phase 4 Bot

```bash
./run-bot-with-env.sh
```

Or manually:
```bash
npm run test-bot-phase4
```

## Testing

### Test Story Generation (No Image)

Send to bot:
```
@alice I read 30 pages of Harry Potter and the Sorcerer's Stone
```

Expected:
- Bot analyzes and creates a story
- Parent receives notification with story
- Kid receives confirmation with story

### Test with Image

1. Take a photo on your phone
2. Send to bot with caption:
```
@jojo I cleaned my entire room and organized my closet
```

Expected:
- Bot uploads image to S3
- Parent sees the photo as evidence
- Parent sees the story and can approve

## What Changed

### LLM Output (lib/llm.ts)
```typescript
{
  summary: "Read 30 pages of Harry Potter",  // Short (max 100 chars)
  story: "Today, Alice dove into the magical world of Harry Potter, reading 30 pages of the Sorcerer's Stone. Her dedication to reading shows real commitment to learning!",  // Story (max 300 chars)
  category: "Reading",
  tags: ["reading", "books", "harry-potter"],
  suggested_stars: 2,
  confidence: 0.95,
  needs_parent_review: false
}
```

### Parent Notification
Now shows:
- 📖 Story (the engaging narrative)
- 📝 Summary (the short version)
- 📷 Image (if attached)
- All metadata (category, tags, confidence)

### Kid Confirmation
Now includes the story in both:
- Initial confirmation message
- Final approval notification

## Troubleshooting

### Images not uploading
- Check that `submission-images` bucket exists in Supabase Storage
- Verify bucket is set to **Public**
- Check bot logs for specific errors
- Test bucket access in Supabase Dashboard → Storage

### LLM not generating stories
- Verify `GEMINI_API_KEY` is still valid
- Check console output for LLM errors
- Stories fall back to generic format if LLM fails

### Database errors
- Make sure you ran the migration SQL
- Check Supabase logs for column errors
