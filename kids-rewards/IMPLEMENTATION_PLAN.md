# Implementation Plan: Parenting Reward System

## Tech Stack Options

### Option 1: Node.js + PostgreSQL + Next.js (Recommended)

**Backend**
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js or Fastify
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: BullMQ with Redis
- **Storage**: AWS S3 or Cloudflare R2
- **LLM**: Google Gemini API

**Frontend**
- **Framework**: Next.js 14+ (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: React Query for server state

**WhatsApp Integration**
- WhatsApp Business API (Cloud API or On-Premises)

**Pros**
- Fast development with TypeScript across the stack
- Prisma provides type-safe database access
- BullMQ handles async LLM processing reliably
- Next.js provides both dashboard and API in one codebase
- Large ecosystem and community support

**Cons**
- Requires separate Redis for queue management
- May need process management for background workers

---

### Option 2: Python + FastAPI + PostgreSQL + React

**Backend**
- **Runtime**: Python 3.11+
- **Framework**: FastAPI
- **Database**: PostgreSQL with SQLAlchemy
- **Queue**: Celery with Redis
- **Storage**: AWS S3 or Cloudflare R2
- **LLM**: Google Gemini API with native Python SDKs

**Frontend**
- **Framework**: React with Vite
- **UI**: Tailwind CSS + shadcn/ui
- **State**: React Query

**Pros**
- Excellent LLM SDK support (native Python libraries)
- FastAPI provides automatic API documentation
- Strong data processing capabilities
- Celery is mature for background tasks

**Cons**
- Separate frontend/backend requires CORS configuration
- More complex deployment (two separate services)

---

### Option 3: Serverless (AWS Lambda/Vercel) + Supabase

**Backend**
- **Runtime**: Node.js serverless functions
- **API**: Next.js API routes or tRPC
- **Database**: Supabase (PostgreSQL)
- **Queue**: Supabase Edge Functions or Vercel Cron
- **Storage**: Supabase Storage
- **LLM**: Google Gemini API

**Frontend**
- **Framework**: Next.js 14+
- **Auth & DB**: Supabase client

**Pros**
- Zero infrastructure management
- Fast deployment with Vercel
- Supabase provides database, storage, and auth in one platform
- Auto-scaling

**Cons**
- Cold starts may affect webhook latency
- Queue management less robust than dedicated solutions
- Vendor lock-in
- Cost can be unpredictable at scale

---

## Recommended: Option 1 (Node.js + PostgreSQL + Next.js)

**Reasoning**: Best balance of development speed, reliability, and production readiness for MVP with clear path to scale.

---

## Implementation Phases

### Phase 0: Foundation (1-2 days)

**Goal**: Set up development environment and core infrastructure

- [ ] Initialize monorepo structure
- [ ] Set up PostgreSQL database
- [ ] Configure Prisma schema
- [ ] Set up Redis for queues
- [ ] Create environment configuration
- [ ] Initialize Next.js project
- [ ] Set up TypeScript configs

**Deliverable**: Running local development environment

---

### Phase 1: Core Data Model & Identity (2-3 days)

**Goal**: Implement strict identity resolution and database schema

**Tasks**
- [ ] Define Prisma schema for `households`, `kids`, `submissions`, `approvals`, `points_ledger`
- [ ] Run migrations
- [ ] Create identity parser utility (`parseIdentity(text) → { username, cleanText }`)
- [ ] Write unit tests for identity parsing
  - Test: `@Alice Hello` → `{ username: "Alice", cleanText: "Hello" }`
  - Test: `Hello` → `null`
  - Test: Edge cases (multiple @, special chars)
- [ ] Create kid lookup service (`findKidByUsername(username, householdId)`)
- [ ] Seed test data (household + 2 kids)

**Critical Rules to Implement**
- Identity parsing must be deterministic (no AI)
- Username lookup must be case-insensitive
- Store original text before stripping `@name`

**Deliverable**: Identity resolution works reliably

---

### Phase 2: WhatsApp Webhook Handler (3-4 days)

**Goal**: Receive messages and images from WhatsApp

**Tasks**
- [ ] Set up WhatsApp Business API account (Meta developer portal)
- [ ] Create webhook endpoint (`POST /webhooks/whatsapp`)
- [ ] Implement webhook verification (GET request)
- [ ] Parse incoming messages (text + media)
- [ ] Download and store images to object storage
- [ ] Implement idempotency check (using `whatsapp_message_id`)
- [ ] Create submission record with status `pending_identity` or `pending_review`
- [ ] Send immediate acknowledgment to WhatsApp (< 2s)
- [ ] Add webhook signature validation

**Testing Checklist**
- [ ] Text-only message creates submission
- [ ] Image + caption creates submission
- [ ] Image without caption triggers identity clarification
- [ ] Duplicate webhook doesn't create duplicate submission
- [ ] Response sent within 2 seconds

**Deliverable**: WhatsApp messages flow into database

---

### Phase 3: Async LLM Processing (3-4 days)

**Goal**: Process submissions with LLM asynchronously

**Tasks**
- [ ] Set up BullMQ queue (`submission-processing`)
- [ ] Create LLM worker process
- [ ] Implement LLM prompt with strict JSON schema
  ```typescript
  interface LLMOutput {
    summary: string;
    category: string;
    tags: string[];
    suggested_stars: number;
    confidence: number;
    needs_parent_review: boolean;
  }
  ```
- [ ] Handle image + text inputs (multimodal prompts)
- [ ] Validate LLM output against schema
- [ ] Update submission with LLM results
- [ ] Handle LLM failures (retry logic, fallback)
- [ ] Add queue monitoring dashboard

**LLM Prompt Requirements**
- Never invent facts
- Flag mismatches between image and text
- Return valid JSON only
- Keep summaries under 100 characters

**Deliverable**: Submissions automatically get summaries and categories

---

### Phase 4: Identity Clarification Flow (2 days)

**Goal**: Handle messages without explicit identity

**Tasks**
- [ ] Detect messages without `@name`
- [ ] Create pending submission with status `pending_identity`
- [ ] Send clarification prompt: "Who is this? Please reply with @Alice or @Bob."
- [ ] Handle clarification response
- [ ] Link response to pending submission
- [ ] Trigger LLM processing after identity confirmed
- [ ] Add timeout (24h) for pending identity submissions

**Edge Cases**
- [ ] User sends wrong name → prompt again
- [ ] User sends another submission before clarifying → handle both
- [ ] Multiple pending submissions from same number

**Deliverable**: System gracefully handles ambiguous identity

---

### Phase 5: Parent Notification & Approval (3-4 days)

**Goal**: Send notifications to parents and handle approvals

**Tasks**
- [ ] Create parent user records linked to households
- [ ] Send WhatsApp notification after LLM processing
  - Include kid name, summary, image thumbnail
  - Add interactive buttons: ⭐ 1, ⭐⭐ 2, ⭐⭐⭐ 3, ❌ Reject
- [ ] Create approval webhook handler
- [ ] Record approval in `approvals` table
- [ ] Write to `points_ledger` (append-only)
- [ ] Update submission status to `approved` or `rejected`
- [ ] Send confirmation to kid: "Approved 🎉 You earned ⭐⭐!"
- [ ] Handle edge cases (multiple approvals, overrides)

**Parent Notification Format**
```
🎯 New achievement from Alice!

"Read 20 pages of Dog Man before bedtime"
📖 Category: Reading

[Image thumbnail]

Approve with stars:
⭐ 1 | ⭐⭐ 2 | ⭐⭐⭐ 3 | ❌ Reject
```

**Deliverable**: Complete approval workflow

---

### Phase 6: Web Dashboard - Read-Only Feed (3-4 days)

**Goal**: Parents can view submissions and stats on web

**Tasks**
- [ ] Create Next.js pages structure
- [ ] Implement authentication (simple password or OAuth)
- [ ] Build household selection page
- [ ] Create main feed view
  - Show submissions in reverse chronological order
  - Display images, summaries, categories
  - Show approval status and stars
  - Filter by kid, status, date range
- [ ] Build kid stats page
  - Total points (calculated from ledger)
  - Points by category (pie/bar chart)
  - Recent submissions
  - Weekly/monthly trends
- [ ] Add responsive mobile design
- [ ] Implement real-time updates (polling or WebSockets)

**Deliverable**: Parents can view everything on web

---

### Phase 7: Stats via WhatsApp (2 days)

**Goal**: Kids can check their stats via WhatsApp commands

**Tasks**
- [ ] Detect stat commands (`stats`, `my points`, `this week`)
- [ ] Query points_ledger and aggregate
- [ ] Format response for WhatsApp (plain text, emojis)
- [ ] Support filters (by category, by date range)

**Example Responses**
```
@Alice stats

⭐ Total: 47 stars
📖 Reading: 18
🧹 Chores: 15
🏃 Exercise: 14

This week: +12 stars 🔥
```

**Deliverable**: Kids can self-serve stats

---

### Phase 8: Parent Overrides & Management (2-3 days)

**Goal**: Parents can reassign, edit, or delete submissions via web

**Tasks**
- [ ] Add "Edit" button to submissions
- [ ] Allow changing kid assignment
- [ ] Allow adjusting stars retroactively (creates new ledger entry)
- [ ] Allow deleting submissions (soft delete)
- [ ] Log all overrides with parent user ID
- [ ] Show audit trail on submission detail page

**Deliverable**: Parents have full management control

---

### Phase 9: Polish & Production Readiness (3-4 days)

**Goal**: Make system production-ready

**Tasks**
- [ ] Add comprehensive error logging (Sentry or similar)
- [ ] Set up monitoring (queue depth, webhook latency)
- [ ] Add rate limiting on webhooks
- [ ] Implement database backups
- [ ] Create admin panel for household management
- [ ] Write deployment documentation
- [ ] Set up staging environment
- [ ] Load testing (simulate 100 submissions/min)
- [ ] Security audit (input validation, SQL injection, etc.)
- [ ] Add privacy policy and terms (if needed)

**Deliverable**: Production-ready system

---

## Total Estimated Timeline

**Optimistic**: 4-5 weeks (single developer, full-time)
**Realistic**: 6-8 weeks (accounting for bugs, testing, iterations)
**With QA/Polish**: 8-10 weeks

---

## Critical Path Items

These MUST be done correctly or the system breaks:

1. **Identity resolution** - Must be deterministic and never guess
2. **Webhook idempotency** - Duplicate messages cannot create duplicate submissions
3. **Points ledger integrity** - Append-only, every change must be traceable
4. **WhatsApp response time** - Must acknowledge within 2 seconds
5. **LLM output validation** - Must conform to strict JSON schema

---

## Infrastructure Requirements (MVP)

**Compute**
- 1x API server (2GB RAM, 2 vCPU)
- 1x Worker process (2GB RAM, 2 vCPU)

**Storage**
- PostgreSQL (10GB, automated backups)
- Redis (512MB)
- Object storage (100GB)

**External Services**
- WhatsApp Business API (Cloud API is free tier available)
- LLM API (OpenAI/Anthropic - ~$50-200/month depending on volume)

**Estimated Monthly Cost**: $50-150 (for small household use)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| WhatsApp API changes | Abstract WhatsApp logic into separate service layer |
| LLM API downtime | Implement retry queue, fallback to manual review |
| Database corruption | Daily automated backups, transaction logging |
| Identity confusion | Strict parsing rules, comprehensive testing |
| Cost overrun | Rate limiting, caching, budget alerts |

---

## Next Steps

1. **Choose tech stack** (Recommend Option 1)
2. **Set up development environment** (Phase 0)
3. **Implement identity resolution** (Phase 1) - Most critical foundation
4. **Build incrementally** - Each phase should be fully tested before moving forward
