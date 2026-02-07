# Getting Started: Lightsail + S3 WhatsApp-First Build

## Tech Stack (Selected)

- **Framework**: Next.js 14+ with App Router
- **Database**: Supabase (PostgreSQL) - Free tier
- **Storage**: AWS S3 (your existing bucket)
- **Queue**: BullMQ + Redis
- **Deployment**: AWS Lightsail (your existing instance)
- **LLM**: Google Gemini API
- **WhatsApp**: WhatsApp Business Cloud API

## Architecture Overview

```
                                    ┌─────────────────────────────┐
                                    │   AWS Lightsail Instance    │
                                    │                             │
WhatsApp Cloud API ────────────────>│  Next.js App                │
                                    │  ├─ API Routes (webhooks)   │
                                    │  ├─ Web Dashboard           │
                                    │  └─ Background Workers      │
                                    │     (BullMQ + Redis)        │
                                    └─────────────────────────────┘
                                           │           │
                                           ↓           ↓
                                    ┌──────────┐ ┌──────────┐
                                    │ AWS S3   │ │ Supabase │
                                    │ (Images) │ │ (DB)     │
                                    └──────────┘ └──────────┘
```

**Monthly Cost**: ~$6-11/month

## Revised Phase Plan (WhatsApp-First)

### Phase 1: Setup & WhatsApp Echo Bot (Day 1)

**Goal**: Get WhatsApp webhook working and responding

**Setup**
1. Create Next.js project
2. Set up Supabase project
3. Configure WhatsApp Business API
4. Deploy to Vercel (for public webhook URL)

**Deliverables**
- WhatsApp bot receives messages and echoes back
- Webhook verified and deployed

---

### Phase 2: Identity Resolution & Basic Storage (Day 2)

**Goal**: Parse @name and store submissions in Supabase

**Tasks**
- Create Supabase tables (`kids`, `submissions`)
- Implement `@name` parser
- Store submissions with identity
- Handle missing identity (ask for clarification)

**Test Cases**
- `@Alice Hello` → Stored with kid_id
- `Hello` → Ask "Who is this?"
- `@Alice` (response) → Link to pending submission

**Deliverables**
- Messages stored in database with correct identity
- Identity clarification flow works

---

### Phase 3: Image Upload & Storage (Day 3)

**Goal**: Handle photos from WhatsApp

**Tasks**
- Download images from WhatsApp Media API
- Upload to Supabase Storage (private bucket)
- Generate signed URLs for viewing
- Store media_url with submission

**Deliverables**
- Photos uploaded and accessible via signed URLs

---

### Phase 4: LLM Processing (Day 4-5)

**Goal**: Summarize submissions with LLM

**Approach for Serverless**
- Option A: Vercel serverless function with longer timeout (60s)
- Option B: Supabase Edge Function
- Option C: Webhook triggers external LLM service (Replicate, Modal)

**Tasks**
- Create LLM processing endpoint
- Implement strict JSON schema validation
- Update submissions with LLM output
- Handle failures gracefully

**Deliverables**
- Submissions automatically summarized
- Categories and tags populated

---

### Phase 5: Parent Notification (Day 6)

**Goal**: Send approval requests to parents

**Tasks**
- Create parent WhatsApp notification
- Include interactive buttons (⭐ 1, 2, 3, ❌)
- Handle button callbacks
- Record approvals in database

**Deliverables**
- Parents receive notifications
- Can approve with one tap

---

### Phase 6: Points Ledger & Kid Confirmation (Day 7)

**Goal**: Complete the reward loop

**Tasks**
- Create `points_ledger` table
- Write points on approval
- Send confirmation to kid
- Implement stats calculation

**Deliverables**
- Full loop working: submit → approve → points → confirmation

---

### Phase 7: Web Dashboard - View Only (Day 8-10)

**Goal**: Parents can see everything on web

**Tasks**
- Build feed page with submissions
- Show kid stats and charts
- Add authentication (Supabase Auth)
- Real-time updates via Supabase subscriptions

**Deliverables**
- Functional web dashboard

---

### Phase 8: Stats via WhatsApp (Day 11)

**Goal**: Kids can check stats from WhatsApp

**Tasks**
- Detect stat commands
- Query and aggregate points
- Format for WhatsApp

**Deliverables**
- Kids can self-serve stats

---

## Immediate Next Steps

### 1. Create Supabase Project

```bash
# Create project at supabase.com
# Note your project URL and anon key
```

### 2. Create Next.js Project

```bash
npx create-next-app@latest kids-rewards --typescript --app --tailwind
cd kids-rewards
npm install @supabase/supabase-js
npm install @google/generative-ai
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install bullmq ioredis
npm install axios
```

### 3. Set Up Environment Variables

Create `.env.local`:

```env
# Supabase (Database only)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AWS S3 (Image Storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=your_bucket_name

# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379

# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_VERIFY_TOKEN=random_string_you_choose
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# App Config
NODE_ENV=production
PORT=3000
BASE_URL=https://your-lightsail-ip-or-domain.com
```

### 4. Configure Supabase Auth

In the Supabase Dashboard, go to **Authentication → URL Configuration** and configure:

- **Site URL**: `http://localhost:3000` (for local dev) or your production URL
- **Redirect URLs** — add all of the following:
  - `http://localhost:3000/auth/callback` (local dev)
  - `https://your-domain.com/auth/callback` (production)

These redirect URLs are required for email confirmation to work. When a new user signs up, Supabase sends a confirmation email with a link. That link redirects to `/auth/callback`, which exchanges the auth code for a session and sends the user to `/onboarding`.

Without these entries, Supabase will reject the redirect and users will be unable to verify their email.

### 5. Create Initial Database Schema

Run in Supabase SQL Editor:

```sql
-- Households
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kids
CREATE TABLE kids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  username TEXT NOT NULL, -- "Alice", "Bob"
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, username)
);

-- Submissions
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID REFERENCES kids(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  whatsapp_message_id TEXT UNIQUE, -- for idempotency
  original_text TEXT,
  media_url TEXT,
  llm_summary TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  confidence DECIMAL,
  status TEXT NOT NULL CHECK (status IN ('pending_identity', 'pending_review', 'approved', 'rejected')),
  identity_source TEXT CHECK (identity_source IN ('explicit_at', 'button', 'parent_override')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Approvals
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  parent_user_id UUID, -- link to auth.users later
  stars INTEGER CHECK (stars BETWEEN 1 AND 3),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Points Ledger (append-only)
CREATE TABLE points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID REFERENCES kids(id) ON DELETE CASCADE,
  delta_points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  submission_id UUID REFERENCES submissions(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_submissions_kid ON submissions(kid_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_points_ledger_kid ON points_ledger(kid_id);
CREATE INDEX idx_submissions_whatsapp_msg ON submissions(whatsapp_message_id);

-- Enable Row Level Security (RLS)
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
```

### 6. Set Up WhatsApp Business API

1. Go to Meta Developer Portal: https://developers.facebook.com/
2. Create app → Select "Business" type
3. Add "WhatsApp" product
4. Get test phone number and access token
5. Configure webhook URL (will be `https://your-vercel-app.vercel.app/api/webhooks/whatsapp`)

### 7. Project Structure

```
kids-rewards/
├── app/
│   ├── api/
│   │   └── webhooks/
│   │       └── whatsapp/
│   │           └── route.ts         # Main webhook handler
│   ├── dashboard/
│   │   ├── page.tsx                 # Main feed
│   │   └── stats/
│   │       └── page.tsx             # Kid stats
│   └── layout.tsx
├── lib/
│   ├── supabase.ts                  # Supabase client
│   ├── s3.ts                        # AWS S3 helpers
│   ├── identity.ts                  # @name parser
│   ├── whatsapp.ts                  # WhatsApp API helpers
│   ├── llm.ts                       # Gemini processing
│   └── queue.ts                     # BullMQ setup
├── workers/
│   ├── submission-processor.ts      # LLM worker
│   └── index.ts                     # Worker startup
├── types/
│   └── database.ts                  # TypeScript types
├── ecosystem.config.js              # PM2 config for deployment
└── .env.local
```

---

## Gemini API Implementation Notes

### Using Gemini for Multimodal Analysis

**Model Recommendation**: Use `gemini-2.0-flash-exp` (or `gemini-1.5-flash`) for cost-effective multimodal processing.

**Basic Setup**:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
```

**Processing Images + Text**:
```typescript
async function analyzeSubmission(imageUrl: string, text: string) {
  // Download image as base64 or Buffer
  const imageData = await fetchImageAsBase64(imageUrl);

  const prompt = `Analyze this achievement submission.

Image: [attached]
Kid's description: "${text}"

Return ONLY valid JSON with this exact structure:
{
  "summary": "Short one-sentence description of achievement",
  "category": "One of: Reading, Chores, Exercise, Learning, Creative, Other",
  "tags": ["tag1", "tag2"],
  "suggested_stars": 2,
  "confidence": 0.85,
  "needs_parent_review": false
}

Rules:
- Keep summary under 100 characters
- suggested_stars: 1-3 based on effort/achievement
- Set needs_parent_review=true if image doesn't match description
- Never invent facts not visible or stated`;

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        data: imageData,
        mimeType: 'image/jpeg'
      }
    }
  ]);

  const response = result.response.text();
  return JSON.parse(response);
}
```

**JSON Mode**: Gemini supports JSON mode for structured outputs:
```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        suggested_stars: { type: 'number' },
        confidence: { type: 'number' },
        needs_parent_review: { type: 'boolean' }
      },
      required: ['summary', 'category', 'tags', 'suggested_stars', 'confidence', 'needs_parent_review']
    }
  }
});
```

**Cost**: Gemini Flash is extremely cheap (~$0.075 per 1M input tokens, images count as ~258 tokens)

---

## Critical Implementation Notes for Lightsail

### 1. Webhook Response Time

Must respond to WhatsApp within 2s. With BullMQ, pattern is clean:

```typescript
// app/api/webhooks/whatsapp/route.ts
import { submissionQueue } from '@/lib/queue';

export async function POST(req: Request) {
  const data = await req.json();

  // Store submission immediately
  const submission = await createSubmission(data);

  // Queue for async processing (non-blocking)
  await submissionQueue.add('process-submission', {
    submissionId: submission.id
  });

  // Immediate acknowledgment
  return new Response('EVENT_RECEIVED', { status: 200 });
}
```

### 2. Background Worker Architecture

Run BullMQ workers as separate processes on Lightsail:

**lib/queue.ts**:
```typescript
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!);

export const submissionQueue = new Queue('submission-processing', {
  connection
});
```

**workers/submission-processor.ts**:
```typescript
import { Worker } from 'bullmq';
import { processWithGemini } from '@/lib/llm';

const worker = new Worker(
  'submission-processing',
  async (job) => {
    const { submissionId } = job.data;

    // Fetch submission from Supabase
    const submission = await getSubmission(submissionId);

    // Process with Gemini (no timeout issues!)
    const result = await processWithGemini(
      submission.media_url,
      submission.original_text
    );

    // Update submission with results
    await updateSubmission(submissionId, result);

    // Notify parent
    await notifyParent(submission);
  },
  { connection: new Redis(process.env.REDIS_URL!) }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});
```

### 3. AWS S3 Image Handling

**lib/s3.ts**:
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

export async function uploadImageToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // Private bucket - no public access
  }));

  return key;
}

export async function getSignedImageUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key
  });

  // URL valid for 1 hour
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

// Download WhatsApp image and upload to S3
export async function downloadAndStoreWhatsAppImage(
  whatsappMediaId: string,
  whatsappToken: string
): Promise<string> {
  // 1. Get media URL from WhatsApp
  const mediaUrl = await getWhatsAppMediaUrl(whatsappMediaId, whatsappToken);

  // 2. Download image
  const response = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${whatsappToken}` }
  });
  const buffer = Buffer.from(await response.arrayBuffer());

  // 3. Upload to S3
  const key = `submissions/${Date.now()}-${whatsappMediaId}.jpg`;
  await uploadImageToS3(buffer, key, response.headers.get('content-type') || 'image/jpeg');

  return key;
}
```

### 4. Idempotency

Store `whatsapp_message_id` with unique constraint:

```typescript
const { data, error } = await supabase
  .from('submissions')
  .insert({ whatsapp_message_id, ... })
  .select()
  .single();

if (error?.code === '23505') {
  // Duplicate, already processed
  return new Response('EVENT_RECEIVED', { status: 200 });
}
```

---

## Local Development Setup

### 1. Install Redis

**macOS**:
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian**:
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

### 2. Run Development Servers

Terminal 1 - Next.js app:
```bash
npm run dev
```

Terminal 2 - Background worker:
```bash
npm run worker
# or: npx tsx workers/index.ts
```

Terminal 3 - Expose webhook with ngrok:
```bash
ngrok http 3000
# Use ngrok URL in WhatsApp webhook config:
# https://abc123.ngrok.io/api/webhooks/whatsapp
```

### 3. Configure package.json scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "worker": "tsx watch workers/index.ts"
  }
}
```

---

## Estimated Timeline

- **Phase 1-3** (WhatsApp working): 3-4 days
- **Phase 4-6** (Full loop): 4-5 days
- **Phase 7-8** (Polish): 4-5 days

**Total**: ~2 weeks for working MVP

---

## Cost Estimate (Your Setup)

- **AWS Lightsail**: $5-10/month (512MB-1GB instance sufficient for MVP)
- **AWS S3**: ~$0.50-2/month (storage + requests)
- **Supabase**: Free tier (500MB database, plenty for MVP)
- **WhatsApp**: Free (Cloud API test number)
- **Gemini**: Free tier (1500 requests/day) or ~$5-10/month

**Total**: $5.50-22/month for MVP

**Scaling costs**: If you outgrow free Supabase tier (500MB), either:
- Upgrade Supabase to $25/mo
- Or migrate to PostgreSQL on Lightsail (upgrade to $20/mo instance)

---

## Deployment to AWS Lightsail

### Prerequisites on Lightsail Instance

1. **SSH into your Lightsail instance**
2. **Install Node.js 18+**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Install Redis**:
   ```bash
   sudo apt-get install redis-server
   sudo systemctl enable redis-server
   sudo systemctl start redis-server
   ```

4. **Install PM2** (process manager):
   ```bash
   sudo npm install -g pm2
   ```

5. **Install Nginx** (reverse proxy):
   ```bash
   sudo apt-get install nginx
   ```

### Deployment Steps

1. **Clone/Upload your code** to Lightsail:
   ```bash
   git clone your-repo-url /home/ubuntu/kids-rewards
   cd /home/ubuntu/kids-rewards
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create production .env**:
   ```bash
   nano .env.local
   # Add all your production environment variables
   ```

4. **Build Next.js**:
   ```bash
   npm run build
   ```

5. **Create PM2 ecosystem file** (`ecosystem.config.js`):
   ```javascript
   module.exports = {
     apps: [
       {
         name: 'kids-rewards-web',
         script: 'node_modules/next/dist/bin/next',
         args: 'start',
         env: {
           PORT: 3000,
           NODE_ENV: 'production'
         }
       },
       {
         name: 'kids-rewards-worker',
         script: 'workers/index.ts',
         interpreter: 'node',
         interpreter_args: '--loader ts-node/esm',
         env: {
           NODE_ENV: 'production'
         }
       }
     ]
   };
   ```

6. **Start with PM2**:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # Follow instructions to enable auto-start
   ```

7. **Configure Nginx** (`/etc/nginx/sites-available/kids-rewards`):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;  # or Lightsail IP

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```

8. **Enable Nginx site**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/kids-rewards /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

9. **Configure Lightsail Firewall**:
   - Open port 80 (HTTP)
   - Open port 443 (HTTPS) if using SSL

10. **Optional: Set up SSL with Let's Encrypt**:
    ```bash
    sudo apt-get install certbot python3-certbot-nginx
    sudo certbot --nginx -d your-domain.com
    ```

### Configure WhatsApp Webhook

Update your WhatsApp webhook URL to:
```
https://your-domain.com/api/webhooks/whatsapp
```

Or if using IP directly:
```
http://your-lightsail-ip/api/webhooks/whatsapp
```

### Deployment Commands

**Deploy updates**:
```bash
cd /home/ubuntu/kids-rewards
git pull
npm install
npm run build
pm2 restart all
```

**View logs**:
```bash
pm2 logs
pm2 logs kids-rewards-web
pm2 logs kids-rewards-worker
```

**Monitor**:
```bash
pm2 monit
```

### S3 Bucket Configuration

1. **Create S3 bucket** (if not exists):
   - Private bucket (no public access)
   - Enable versioning (optional)

2. **Create IAM user** with S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::your-bucket-name/*"
       }
     ]
   }
   ```

3. **Get access keys** and add to `.env.local`

---

## Ready to Start?

Next command to run:

```bash
npx create-next-app@latest kids-rewards --typescript --app --tailwind
```

Then I'll help you build Phase 1: WhatsApp Echo Bot! 🚀
