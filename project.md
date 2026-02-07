Perfect — below is a **revised, clean project document** written **specifically to be handed to Claude Code** as a grounding spec.

This is not marketing fluff.
It’s an **execution document** Claude can reliably code against without inventing behavior.

You can paste this directly into a repo as:

> `PROJECT.md` or `SPEC.md`
> (and pair it with a `CLAUDE.md` later)

---

# Parenting Reward System — Project Specification

## 1. Project Overview

**Goal**
Build a WhatsApp-first parenting reward system where kids submit achievements (with image evidence + short text), parents approve and assign stars, and both parents and kids can view progress and stats via WhatsApp and a web dashboard.

**Design principles**

* WhatsApp is the **primary input channel**
* Web app is a **read + manage dashboard**
* Identity must be **explicit and deterministic**
* LLMs assist with summarization and categorization only — **never identity or approval**
* System must be auditable and low-friction for kids

---

## 2. Core User Roles

### Kids

* Submit achievements via WhatsApp
* Upload photos as evidence
* View stats (points, stars, streaks) via WhatsApp or web

### Parents

* Receive WhatsApp notifications
* Approve submissions and assign stars
* View feed, stats, and manage rewards via web
* Override or reassign submissions if needed

---

## 3. Identity Model (Critical Design Decision)

### Shared WhatsApp Number Support

Multiple kids may use the **same WhatsApp number**.

### Explicit Identity Rule (MVP)

* **All submissions must start with `@` followed by a numeric identifier**
* Example:

  ```
  @1 Read 20 pages of Dog Man
  @2 Cleaned my desk
  ```

### Identity Resolution Policy

1. If message starts with `@<number>`:

   * Parse identity deterministically
   * Map number → `kid_id`
2. If message has **no `@`**:

   * Do NOT guess
   * Prompt user to clarify:

     > “Who is this? Please reply with `@1` or `@2`.”
3. LLM **must never infer identity**

### Photo Uploads

* If image arrives without caption or without `@`:

  * Store submission as `pending_identity`
  * Ask for `@1` / `@2`
  * Attach response to the pending submission

### Identity Source Tracking

Each submission records:

* `identity_source`: `explicit_at | button | parent_override`

---

## 4. User Flows

### 4.1 Kid Submission (WhatsApp)

1. Kid sends:

   * Photo + caption OR text-only message
   * Must include `@<number>`
2. System immediately replies:

   > “Got it ✅ Submitting for review.”
3. Submission stored with status:

   * `pending_review`
4. LLM processing runs asynchronously

---

### 4.2 LLM Processing (Async Worker)

**Inputs**

* Image (if any)
* Kid’s raw text (with `@` stripped)
* `kid_id`
* Household category rules

**Outputs (STRICT JSON)**

```json
{
  "summary": "Read 20 pages of Dog Man before bedtime.",
  "category": "Reading",
  "tags": ["book", "bedtime"],
  "suggested_stars": 2,
  "confidence": 0.82,
  "needs_parent_review": false
}
```

**Rules**

* Never invent facts not visible or stated
* If mismatch between image and text → `needs_parent_review=true`
* Output must be deterministic and short

---

### 4.3 Parent Notification (WhatsApp)

Parent receives:

* Kid name
* Summary
* Image thumbnail (if available)
* Quick actions:

  * ⭐ 1
  * ⭐⭐ 2
  * ⭐⭐⭐ 3
  * Reject
  * Reassign kid (optional)

---

### 4.4 Parent Approval

1. Parent taps star amount
2. System:

   * Records approval
   * Writes to points ledger
   * Updates submission status to `approved`
3. Kid receives confirmation:

   > “Approved 🎉 You earned ⭐⭐!”

---

### 4.5 Web Dashboard

**Features**

* Live feed of submissions
* Pending approvals
* Kid stats:

  * Total points
  * Stars by category
  * Weekly/monthly breakdown
* Reward definitions and redemption history

---

### 4.6 Stats via WhatsApp

Supported commands:

* `stats`
* `my points`
* `this week`
* `categories`

Responses are short and readable.

---

## 5. Data Model (Minimum Required)

### households

```text
id
name
settings (JSON)
```

### kids

```text
id
household_id
display_name
numeric_code   -- "1", "2"
```

### submissions

```text
id
kid_id
household_id
original_text
media_url
llm_summary
category
tags[]
confidence
status                -- pending_identity | pending_review | approved | rejected
identity_source
created_at
```

### approvals

```text
id
submission_id
parent_user_id
stars
comment
created_at
```

### points_ledger (append-only)

```text
id
kid_id
delta_points
reason
submission_id
created_at
```

---

## 6. Non-Functional Requirements

### Reliability

* Webhooks must be idempotent
* Duplicate messages must not create duplicate submissions

### Latency

* WhatsApp acknowledgment within 2 seconds
* LLM runs async

### Privacy

* Images stored in private object storage
* Access via signed URLs only

### Auditability

* Every approval logged
* Identity source recorded
* No silent reassignment

---

## 7. Explicit Non-Goals (MVP)

* No AI-based identity detection
* No auto-approval without parent
* No public sharing or social feed
* No complex gamification (badges, streak ML)

---

## 8. Technology Constraints (Guidance for Claude)

* Identity resolution is **rule-based only**
* LLM output must conform to strict JSON schema
* If identity is missing → **do not call LLM**
* Points are derived from ledger, not stored totals
* WhatsApp is the source of truth for submissions

---

## 9. Future Extensions (Out of Scope for MVP)

* Session-based identity memory
* Alias support (`@Alice`)
* Badges and streaks
* School-term goals
* Multiple caregivers

---

## 10. Success Criteria

MVP is successful if:

* Kids can submit in under 10 seconds
* Parents approve in one tap
* No identity mistakes occur
* Feed is trustworthy and celebratory

---

### End of Specification

---

If you want, next I can:

* generate a **`CLAUDE.md`** (coding rules + commands)
* convert this into **GitHub issues / task breakdown**
* or write the **exact WhatsApp bot message copy** Claude should implement
