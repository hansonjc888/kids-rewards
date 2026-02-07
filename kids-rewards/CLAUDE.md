# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A WhatsApp-first parenting reward system where kids submit achievements with evidence, parents approve and assign stars, and both can view progress via WhatsApp and a web dashboard.

**Architecture**: WhatsApp as primary input → Async LLM processing → Parent approval → Points ledger

## Critical Design Constraints

### 1. Identity Resolution (STRICT RULES)

**Multiple kids may share the same WhatsApp number.**

Identity MUST be explicit and deterministic:

- All submissions MUST start with `@<name>` (e.g., `@Alice Read 20 pages`)
- If no `@` prefix → DO NOT GUESS → Prompt: "Who is this? Please reply with `@Alice` or `@Bob`."
- LLMs **never infer identity** from content, style, or context
- Photos without captions → store as `pending_identity` → request clarification
- Every submission records `identity_source`: `explicit_at | button | parent_override`

**Implementation rule**: Parse `@<name>` → map to `kid_id` → strip prefix before LLM processing.

### 2. LLM Usage Boundaries

LLMs are used **only for**:
- Summarization of kid's text + image
- Category suggestion
- Tag extraction
- Confidence scoring

LLMs **never**:
- Determine identity
- Auto-approve submissions
- Make points decisions
- Invent facts not in image/text

**Output must be strict JSON**:
```json
{
  "summary": "Short sentence describing achievement",
  "category": "Reading",
  "tags": ["book", "bedtime"],
  "suggested_stars": 2,
  "confidence": 0.82,
  "needs_parent_review": false
}
```

If image contradicts text → set `needs_parent_review=true`.

### 3. WhatsApp as Source of Truth

- WhatsApp webhooks are the **only** submission entry point for kids
- Web dashboard is for viewing and management, not primary input
- All webhook handlers must be **idempotent** (duplicate messages must not create duplicate submissions)
- Acknowledge receipt within 2 seconds: "Got it ✅ Submitting for review."
- LLM processing runs **asynchronously** after acknowledgment

### 4. Points Ledger Model

- Points are **append-only** in `points_ledger` table
- Never store point totals directly on kid records
- Calculate totals by summing ledger entries
- Every point change must reference a `submission_id` or have explicit `reason`

### 5. Queue Architecture (BullMQ)

**Why BullMQ**: Running on Lightsail allows proper background job processing without serverless timeouts.

**Queue flow**:
```
Webhook receives message
    ↓
Store submission in DB (sync)
    ↓
Add job to queue (non-blocking)
    ↓
Return 200 to WhatsApp (< 2s)
    ↓
Worker picks up job (separate process)
    ↓
Process with Gemini (can take 10-30s)
    ↓
Update submission + notify parent
```

**Implementation pattern**:
- Webhook handler: Fast, synchronous operations only (store + queue)
- Worker process: Slow operations (LLM, external APIs)
- Workers run as separate PM2 processes on Lightsail
- Redis provides reliable queue with automatic retries

**Job types**:
- `process-submission`: LLM analysis of new submission
- `notify-parent`: Send WhatsApp notification (can be queued if rate-limited)
- `send-kid-confirmation`: Notify kid after approval

## Data Model Overview

### Core Tables

**households**
- `id`, `name`, `settings` (JSON)

**kids**
- `id`, `household_id`, `display_name`, `username` (e.g., "Alice", "Bob")

**submissions**
- `id`, `kid_id`, `household_id`, `original_text`, `media_url`
- `llm_summary`, `category`, `tags[]`, `confidence`
- `status`: `pending_identity | pending_review | approved | rejected`
- `identity_source`: tracks how identity was determined
- `created_at`

**approvals**
- `id`, `submission_id`, `parent_user_id`, `stars`, `comment`, `created_at`

**points_ledger** (append-only)
- `id`, `kid_id`, `delta_points`, `reason`, `submission_id`, `created_at`

## Key Technical Flows

### Submission Pipeline

1. **WhatsApp message arrives** → Webhook handler
2. **Parse identity**: Check for `@<name>` prefix
   - If found → map name to `kid_id` → proceed
   - If missing → store as `pending_identity` → request clarification
3. **Immediate acknowledgment** to WhatsApp (< 2s)
4. **Queue for LLM processing** (async worker)
5. **LLM generates summary** (strict JSON output)
6. **Notify parent** via WhatsApp with approval buttons
7. **Parent approves** → Write to ledger → Notify kid

### Identity Clarification Flow

```
Kid: [photo without caption]
Bot: "Who is this? Please reply with @Alice or @Bob."
Kid: "@Alice"
Bot: "Got it ✅ Submitting for review."
→ Link response to pending submission → continue pipeline
```

### Stats Calculation

When kid requests stats:
- Query `points_ledger` WHERE `kid_id` = X
- SUM(`delta_points`) for totals
- Group by `category` for breakdown
- Return formatted WhatsApp message (keep short and readable)

## Privacy & Storage

- Images stored in **private object storage** (not public URLs)
- Access via **signed URLs only** (time-limited)
- No public feed or sharing features

## Webhook Idempotency

- Use message ID from WhatsApp as idempotency key
- Check if `submission` with same `whatsapp_message_id` exists
- If exists → return success without creating duplicate

## Testing Key Scenarios

When implementing features, ensure these work correctly:

1. **Shared phone scenario**: Two kids, same WhatsApp number, different `@` names
2. **Missing identity**: Photo arrives with no caption → clarification flow
3. **Duplicate webhook**: Same message arrives twice → only one submission created
4. **Image-text mismatch**: Photo shows reading, text says "cleaned room" → `needs_parent_review=true`
5. **Points calculation**: Ledger-based sums match expected totals

## Explicit Non-Goals (Do Not Implement)

- AI-based identity detection from writing style, image content, or history
- Auto-approval without parent confirmation
- Public sharing or social features
- Stored point totals (always calculate from ledger)
- Session-based "remembering" who last texted

## Technology Stack

**Selected Stack**: Lightsail + S3 + Supabase

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Database**: Supabase (PostgreSQL) - Free tier
- **Storage**: AWS S3 (private bucket)
- **Queue**: BullMQ + Redis
- **Deployment**: AWS Lightsail instance
- **WhatsApp**: WhatsApp Business Cloud API (webhook-based)
- **LLM**: Google Gemini API

**Architecture Benefits**:
- No serverless timeout issues (can process LLM requests properly)
- Proper background job queue with BullMQ
- Cost-effective (~$6-11/month for MVP)
- Full control over infrastructure

**Development Approach**: WhatsApp-first (get messaging working before web dashboard)

Refer to GETTING_STARTED.md for setup instructions and PROJECT.md for full specification.
