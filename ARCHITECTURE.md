# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WhatsApp Cloud API                        │
│                  (Facebook/Meta Platform)                    │
└───────────────────────────┬─────────────────────────────────┘
                            │ Webhook POST
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              AWS Lightsail Instance ($5-10/mo)               │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Next.js Application                    │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  API Routes                                   │  │    │
│  │  │  • /api/webhooks/whatsapp (receive messages) │  │    │
│  │  │  • /api/stats                                │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  Web Dashboard (App Router)                  │  │    │
│  │  │  • Feed view                                 │  │    │
│  │  │  • Kid stats                                 │  │    │
│  │  │  • Approval interface                        │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │           Redis (BullMQ Queue)                      │    │
│  └────────────────────────────────────────────────────┘    │
│                            ↕                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │          Background Workers (PM2)                   │    │
│  │  • Submission processor (Gemini LLM)               │    │
│  │  • Parent notification sender                      │    │
│  │  • Kid confirmation sender                         │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                     │                      │
        ─────────────┴──────────   ─────────┴────────────
        │                      │   │                     │
        ↓                      ↓   ↓                     ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   AWS S3         │  │   Supabase       │  │  Gemini API      │
│   (Images)       │  │   (PostgreSQL)   │  │  (Google)        │
│   Private Bucket │  │   Free Tier      │  │  Free/Paid       │
│   $1-2/mo        │  │   $0/mo          │  │  $0-10/mo        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Data Flow

### 1. Kid Submits Achievement

```
Kid sends message "@Alice Read 20 pages"
         ↓
WhatsApp Cloud API receives
         ↓
Webhook POST to /api/webhooks/whatsapp
         ↓
Parse @Alice → kid_id lookup (Supabase)
         ↓
Store submission (status: pending_review)
         ↓
Add job to BullMQ queue
         ↓
Return 200 OK (< 2 seconds) ✓
         ↓
Bot replies: "Got it ✅ Submitting for review"
```

### 2. Background Processing

```
Worker picks up job from queue
         ↓
Fetch submission from Supabase
         ↓
If image exists:
  - Download from WhatsApp
  - Upload to S3
  - Get signed URL
         ↓
Call Gemini API with:
  - Image (if present)
  - Kid's text
         ↓
Gemini returns JSON:
  {
    "summary": "...",
    "category": "Reading",
    "tags": ["book"],
    "suggested_stars": 2,
    "confidence": 0.85,
    "needs_parent_review": false
  }
         ↓
Update submission in Supabase
         ↓
Queue parent notification job
```

### 3. Parent Approval

```
Worker sends WhatsApp to parent:
  "🎯 New achievement from Alice!"
  [Image thumbnail]
  "Read 20 pages of Dog Man"
  📖 Category: Reading

  [⭐ 1] [⭐⭐ 2] [⭐⭐⭐ 3] [❌ Reject]
         ↓
Parent taps ⭐⭐ (2 stars)
         ↓
Webhook receives callback
         ↓
Store approval record
         ↓
Write to points_ledger:
  kid_id: Alice
  delta_points: +2
  reason: "approved submission"
  submission_id: xxx
         ↓
Update submission status: approved
         ↓
Send confirmation to Alice:
  "Approved 🎉 You earned ⭐⭐!"
```

### 4. Stats Request

```
Kid sends: "stats"
         ↓
Webhook receives
         ↓
Query points_ledger:
  SUM(delta_points) WHERE kid_id = Alice
         ↓
Group by category
         ↓
Format and send reply:
  "⭐ Total: 47 stars
   📖 Reading: 18
   🧹 Chores: 15
   🏃 Exercise: 14

   This week: +12 stars 🔥"
```

## Key Components

### Next.js Application (Port 3000)

**API Routes**:
- `POST /api/webhooks/whatsapp` - Main webhook handler (idempotent)
- `GET /api/webhooks/whatsapp` - Webhook verification
- `GET /api/submissions` - Dashboard data
- `GET /api/kids/:id/stats` - Kid statistics

**Web Dashboard**:
- `/dashboard` - Submission feed
- `/dashboard/stats` - Kid statistics
- `/login` - Authentication (Supabase Auth)

### Background Workers (PM2)

**workers/submission-processor.ts**:
- Listens to `submission-processing` queue
- Processes submissions with Gemini
- Handles retries on failure

**workers/notification-sender.ts** (optional):
- Listens to `notification` queue
- Sends WhatsApp messages
- Handles rate limiting

### BullMQ Queues

**submission-processing**:
- Priority: High
- Concurrency: 3 workers
- Retry: 3 attempts with exponential backoff

**notifications**:
- Priority: Medium
- Concurrency: 5 workers
- Retry: 5 attempts

## Process Management (PM2)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'kids-rewards-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { PORT: 3000, NODE_ENV: 'production' }
    },
    {
      name: 'kids-rewards-worker',
      script: 'workers/index.ts',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production' }
    }
  ]
};
```

Commands:
- `pm2 start ecosystem.config.js` - Start all processes
- `pm2 logs` - View logs
- `pm2 restart all` - Restart after deployment
- `pm2 monit` - Monitor CPU/memory

## Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Considerations

### WhatsApp Webhook Security
- Verify webhook signature using `WHATSAPP_WEBHOOK_SECRET`
- Validate `WHATSAPP_VERIFY_TOKEN` on webhook setup
- Use HTTPS in production (Let's Encrypt SSL)

### S3 Security
- Private bucket (no public access)
- Signed URLs with 1-hour expiration
- IAM user with minimal permissions (PutObject, GetObject only)

### Database Security
- Supabase Row Level Security (RLS) enabled
- Service role key only on server side
- Anon key for client-side (limited access)

### Environment Variables
- Never commit `.env.local` to git
- Use `.env.example` as template
- Secure secrets in Lightsail environment

## Monitoring & Debugging

### View Application Logs
```bash
pm2 logs kids-rewards-web
pm2 logs kids-rewards-worker
```

### View Queue Status
```bash
# Install BullMQ CLI
npm install -g bull-monitor

# View queue dashboard
bull-monitor --redis redis://localhost:6379
```

### Check Redis
```bash
redis-cli
> INFO
> KEYS *
> LLEN bull:submission-processing:waiting
```

### Database Queries (Supabase)
```sql
-- Pending submissions
SELECT * FROM submissions WHERE status = 'pending_review';

-- Total points per kid
SELECT kid_id, SUM(delta_points) as total_points
FROM points_ledger
GROUP BY kid_id;

-- Recent approvals
SELECT * FROM approvals ORDER BY created_at DESC LIMIT 10;
```

## Cost Breakdown

| Service | Usage | Cost |
|---------|-------|------|
| AWS Lightsail | 1GB instance, 1TB transfer | $5-10/mo |
| AWS S3 | ~10GB storage, 1000 requests/day | $1-2/mo |
| Supabase | 500MB database (free tier) | $0/mo |
| Redis | Local on Lightsail | $0/mo |
| Gemini API | ~500 requests/day | $0-5/mo |
| WhatsApp API | Test number (free tier) | $0/mo |
| Domain (optional) | Route53 or external | $1-12/mo |
| SSL Certificate | Let's Encrypt | $0/mo |

**Total: $6-29/month**

## Scaling Considerations

### When to Scale

**Upgrade Lightsail Instance** ($10 → $20/mo) when:
- CPU usage consistently > 70%
- Memory usage > 80%
- Queue backlog grows

**Upgrade Supabase** (Free → $25/mo) when:
- Database size > 500MB
- Need more than 2 concurrent connections
- Need daily backups

**Add Redis Cluster** when:
- Queue depth > 10,000 jobs
- Multiple Lightsail instances needed

### Horizontal Scaling

To scale beyond single Lightsail instance:
1. Set up load balancer (AWS ALB)
2. Run multiple Lightsail instances
3. Use managed Redis (AWS ElastiCache or Upstash)
4. Each instance runs same code but separate worker processes

## Backup Strategy

**Database (Supabase)**:
- Automatic daily backups (Supabase feature)
- Manual backup: Use Supabase dashboard

**S3 Images**:
- Enable S3 versioning
- Set lifecycle policy (delete old versions after 90 days)

**Code**:
- Git repository (GitHub/GitLab)
- Tag releases for rollback capability

**Environment Variables**:
- Store securely in password manager
- Document in team wiki (without actual values)
