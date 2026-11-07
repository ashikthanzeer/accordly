# Accordly — Scope-to-Cash Platform

> **From agreement to payment, seamlessly.**  
> An integrated platform for freelancers and digital agencies to turn client agreements into confirmed scope baselines, detect scope creep with AI, generate deterministic change proposals, secure client acceptance, and collect payments via PayPal Sandbox.

---

## 1. Overview

**Accordly** bridges the commercial gap between project contract execution and payment settlement. Instead of juggling disconnected document folders, email change requests, spreadsheet pricing estimators, and external invoicing portals, Accordly brings the entire **Scope-to-Cash** lifecycle into one cohesive workspace.

---

## 2. Problem Statement

Freelancers and digital agencies lose an estimated **15% to 20% of billable revenue** due to:
- **Uncontrolled Scope Creep**: Informal client requests arriving via chat or email that quietly expand deliverables without formal contractual amendments.
- **Pricing Disputes**: Subjective or ungrounded estimates that cause client friction and delayed signoffs.
- **Disconnected Invoicing**: Disjointed invoicing tools where bills are sent weeks after work is done, without direct lineage back to the accepted change request.
- **Payment Reconciliation Friction**: Manual tracking of bank accounts, invoice numbers, and payment receipts across disparate platforms.

---

## 3. Solution

Accordly provides a continuous, auditable commercial engine:
1. **Agreement Ingestion**: Upload signed Master Services Agreements (MSAs) or Statements of Work (SOWs).
2. **AI Scope Baseline Extraction**: Automatically extract deliverables, milestones, assumptions, and contractual exclusions.
3. **Scope Intelligence**: Compare new client communications against the baseline to classify requests as `IN_SCOPE`, `OUT_OF_SCOPE`, or `AMBIGUOUS` with exact contract citations.
4. **Deterministic Pricing Engine**: Price change orders using integer-cents arithmetic with Fixed, Hourly, or Itemized models.
5. **Client Review Portal**: Share tamper-evident, unguessable review links for one-click client acceptance.
6. **PayPal Sandbox Invoicing**: Explicitly generate and send PayPal invoices derived directly from accepted proposal snapshots.
7. **Authoritative Reconciliation**: Process PayPal webhooks and poll authoritative PayPal Invoicing REST APIs to track partial and full settlements.
8. **Executive Dashboard & Activity Timeline**: Real-time multi-currency financial metrics, prioritized action feeds, and chronological project audit logs.

---

## 4. Key Features

- **Document Analysis & PDF Ingestion**: Extracts contractual text directly from signed PDF and text agreements with structure extraction and page references.
- **AI-Powered Scope Classification**: Evaluates client requests against confirmed contractual terms, surfacing verbatim evidence and rationale.
- **Deterministic, Decimal-Safe Pricing**: Zero floating-point drift calculations (`toCents` / `fromCents`), supporting fixed fee, hourly rate, and multi-line itemized structures.
- **Cryptographic Client Review Links**: Unguessable 32-byte tokens hashed with SHA-256 in the database. Clients accept or reject without account registration.
- **Direct PayPal Invoicing v2 Integration**: Generates multi-item draft invoices, sends them via PayPal's global infrastructure, and delivers live hosted payment links.
- **Dual-Layer Payment Reconciliation**: Webhook-driven event ingestion combined with authoritative GET retrieval from PayPal's servers to guarantee payment truth.
- **Multi-Currency Executive Portfolio**: Strict currency isolation (USD, EUR, GBP, etc.) ensuring no cross-currency summation, with draft/cancelled invoice exclusions.
- **Chronological Project Timeline**: Event audit log categorized into `SCOPE`, `REQUEST`, `PROPOSAL`, `INVOICE`, and `PAYMENT` with actor attribution (`PROVIDER`, `CLIENT`, `PAYPAL`, `SYSTEM`).

---

## 5. Core Scope-to-Cash Workflow (27 Steps)

```mermaid
flowchart TD
    A["1. Provider Signs In"] --> B["2. Create Project & Client Info"]
    B --> C["3. Upload Signed Agreement (PDF)"]
    C --> D["4. AI Scope Extraction"]
    D --> E["5. Provider Confirms Baseline v1"]
    E --> F["6. Client Submits Change Request"]
    F --> G["7. AI Scope Intelligence & Citations"]
    G --> H["8. Provider Reviews Classification"]
    H --> I["9. Draft Change Proposal"]
    I --> J["10. Deterministic Pricing Engine"]
    J --> K["11. Provider Approves Proposal"]
    K --> L["12. Generate Secure Review Link"]
    L --> M["13. Client Opens Public Portal"]
    M --> N["14. Client Accepts Proposal"]
    N --> O["15. Persist Accepted Snapshot"]
    O --> P["16. Provider Clicks 'Create Invoice'"]
    P --> Q["17. Review Mapped Line Items"]
    Q --> R["18. Send PayPal Sandbox Invoice"]
    R --> S["19. Persist PayPal Invoice ID & Link"]
    S --> T["20. Client Pays via PayPal Sandbox"]
    T --> U["21. Webhook Signature Verified"]
    U --> V["22. Authoritative State Retrieval"]
    V --> W["23. Local Payment Reconciled (PAID)"]
    W --> X["24. Dashboard Financials Updated"]
    X --> Y["25. Project Activity Timeline Logged"]
```

---

## 6. Technology Stack

- **Framework**: Next.js 15 (App Router, Server Components & Route Handlers)
- **Language**: TypeScript 5.8 (Strict Type Checking)
- **Styling**: Tailwind CSS 3.4
- **Database & ORM**: PostgreSQL & Prisma ORM 6.4
- **PDF Extraction**: `unpdf`
- **Schema Validation**: `zod`
- **AI Engine**: Google Gemini API (`@google/genai` / REST) with deterministic offline fallback
- **Payments & Invoicing**: PayPal Invoicing REST API v2 & PayPal Webhooks (Sandbox)
- **Testing**: Vitest 3.2 (Unit, Integration & Security Tests)

---

## 7. Architecture Overview

```
src/
├── app/
│   ├── api/
│   │   ├── dashboard/overview/        # Executive dashboard API
│   │   ├── projects/[id]/
│   │   │   ├── baseline/              # Baseline extraction & confirmation
│   │   │   ├── change-requests/       # Request intake & AI classification
│   │   │   ├── documents/             # Document upload & storage
│   │   │   ├── proposals/             # Proposal CRUD, approval & invoicing
│   │   │   └── timeline/              # Chronological event stream
│   │   ├── review/[token]/            # Public client review & decision API
│   │   └── webhooks/paypal/           # PayPal webhook signature & ingestion
│   ├── projects/[id]/
│   │   ├── baseline/page.tsx          # Agreement ingestion UI
│   │   ├── requests/page.tsx          # Scope Intelligence UI
│   │   ├── proposals/page.tsx         # Commercial proposals workspace
│   │   └── timeline/page.tsx          # Interactive project activity timeline
│   ├── review/[token]/page.tsx        # Client public proposal review portal
│   └── page.tsx                       # Main provider executive dashboard
├── components/
│   ├── dashboard/                     # KPI cards, financial charts, action lists
│   ├── agreements/                    # Document upload & baseline viewers
│   ├── requests/                      # Request forms & citation badges
│   └── proposals/                     # Proposal builder & invoice preview modal
├── lib/
│   ├── ai/                            # Gemini prompt builder, citation validator
│   ├── dashboard/                     # Financial aggregation & action detector
│   ├── documents/                     # Storage guards, PDF parsing & sanitization
│   ├── paypal/                        # PayPal Invoicing v2, OAuth, webhooks & sync
│   ├── pricing/                       # Decimal-safe pricing arithmetic
│   ├── proposals/                     # State machine & SHA-256 token hashing
│   ├── timeline/                      # Event categorization & formatters
│   └── db.ts                          # Prisma singleton client
prisma/
└── schema.prisma                      # Database models and relations
scripts/
├── test-e2e-workflow.ts               # Complete 27-step automated E2E runner
├── test-paypal-sandbox.ts             # Live PayPal Sandbox OAuth & invoice test
├── test-paypal-proposal-invoice.ts    # Live proposal-to-invoice Sandbox runner
└── test-paypal-webhook-reconciliation.ts # Live webhook & reconciliation runner
```

---

## 8. AI Integration

Accordly uses AI as an objective **contractual adjudicator**, not a generic text generator:
- **Input Grounding**: The AI model is provided with the confirmed baseline deliverables, assumptions, and exclusions extracted from the signed agreement.
- **Structured JSON Schema**: Responses follow strict Zod schemas (`classification`, `rationale`, `citations`, `estimatedHours`).
- **Verbatim Evidence Requirement**: The model must quote existing contract language to substantiate `OUT_OF_SCOPE` or `IN_SCOPE` findings.
- **Deterministic Fallback**: If no AI API key is configured, Accordly defaults to deterministic contract citation analysis, ensuring full offline functionality.

---

## 9. PayPal Integration

Accordly integrates with the official **PayPal Invoicing REST API v2**:
- **OAuth 2.0 Client Credentials**: Server-side token management with automatic cache renewal.
- **Line Item Mapping**: Automatically converts itemized proposal deliverables into PayPal invoice line items, tax, and currency structures.
- **Idempotent Draft Creation**: Employs unique `PayPal-Request-Id` headers to prevent double-billing.
- **Explicit Provider Control**: Invoices are never sent automatically upon client acceptance; the provider inspects the mapped invoice preview and explicitly confirms dispatch.
- **Authoritative Reconciliation**: Webhooks trigger reconciliation, but the application queries PayPal directly for authoritative payment balances before updating local records.

---

## 10. Local Setup Instructions

### Prerequisites
- Node.js 18+ (tested on Node.js 24)
- npm or pnpm
- PostgreSQL database (local or hosted, e.g. Neon, Supabase, Railway)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/accordly.git
   cd accordly
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your PostgreSQL database URL, PayPal Sandbox credentials, and optional Gemini API key.

4. **Initialize database schema:**
   ```bash
   npx prisma db push
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 10. Production Deployment Runbook (Vercel + Render + NeonDB)

Accordly employs a distributed production topology:
- **Frontend Presentation**: Hosted on **Vercel**, serving React 19 UI and transparently proxying `/api/*` requests to Render via Next.js `rewrites()`.
- **Backend Web Service**: Hosted on **Render**, executing Next.js route handlers, AI classification, PayPal invoice operations, and webhook reconciliation.
- **Database**: Hosted on **NeonDB Serverless PostgreSQL**, with connection pooling for runtime queries and direct connections for schema synchronization.
- **Document Storage**: Stored durably on a **Render Persistent Disk** mounted at `/var/data` (`STORAGE_DIR=/var/data/uploads`).
- **Payments**: Directly integrated with **PayPal Sandbox** using REST v2 APIs and webhooks.

```text
                    CLIENTS / USERS
                          |
                          v
                    VERCEL FRONTEND
                  (accordly.vercel.app)
                          |
                     /api/* calls
                   (Vercel Rewrites)
                          |
                          v
                 RENDER WEB SERVICE
             (accordly-api.onrender.com)
                          |
             +------------+------------+
             |                         |
             v                         v
     NEONDB POSTGRESQL         PAYPAL SANDBOX
 (ep-pooler.c-8.neon.tech)  (api-m.sandbox.paypal.com)
```

---

### Step 1: NeonDB PostgreSQL Setup

1. Create a project in [Neon Console](https://console.neon.tech/).
2. Copy the connection strings from your database dashboard:
   - **Pooled connection string** (contains `-pooler`): Use as `DATABASE_URL`.
   - **Direct connection string** (without `-pooler`): Use as `DIRECT_URL`.
3. Bootstrap the database schema (one-time setup):
   ```bash
   DATABASE_URL="<your-pooled-url>" DIRECT_URL="<your-direct-url>" npx prisma db push
   ```
   *(Note: Do not run destructive database resets in production).*

---

### Step 2: Render Backend Web Service Deployment

1. In the [Render Dashboard](https://dashboard.render.com/), click **New > Web Service**.
2. Connect your GitHub repository.
3. Configure service runtime:
   - **Name**: `accordly-api` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Same or nearest region to NeonDB (e.g. `Ohio / us-east-2`)
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build` (runs `prisma generate && next build`)
   - **Start Command**: `npm run start`
   - **Plan**: `Starter` ($7/mo recommended to prevent cold-start webhook dropouts)
4. **Attach a Persistent Disk**:
   - Go to **Disks > Add Disks**.
   - **Name**: `accordly-uploads`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (or as needed)
5. Add the **Environment Variables** in Render:
   - `DATABASE_URL`: Your NeonDB pooled connection URL.
   - `DIRECT_URL`: Your NeonDB direct connection URL.
   - `STORAGE_DIR`: `/var/data/uploads` (points to the attached persistent disk).
   - `NEXT_PUBLIC_APP_URL`: `https://<your-vercel-domain>.vercel.app` (ensures review links target Vercel).
   - `PAYPAL_ENV`: `sandbox`
   - `PAYPAL_BASE_URL`: `https://api-m.sandbox.paypal.com`
   - `PAYPAL_CLIENT_ID`: Your PayPal Sandbox App Client ID.
   - `PAYPAL_CLIENT_SECRET`: Your PayPal Sandbox App Client Secret.
   - `PAYPAL_WEBHOOK_ID`: *(Obtained in Step 4 below)*.
   - `AI_PROVIDER`: `gemini` (or `openai` / `mock`).
   - `GEMINI_API_KEY`: Your Google Gemini API Key.
   - `AI_MODEL`: `gemini-1.5-flash`
   - `NODE_ENV`: `production`
6. Click **Deploy Web Service** and note your Render service URL: `https://accordly-api.onrender.com`.

---

### Step 3: Vercel Frontend Deployment

1. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New > Project** and import the repository.
2. Framework preset: **Next.js**.
3. Configure **Environment Variables** in Vercel:
   - `BACKEND_API_URL`: `https://accordly-api.onrender.com` (Your live Render service URL from Step 2).
   - `NEXT_PUBLIC_APP_URL`: `https://<your-vercel-domain>.vercel.app` (Your public Vercel production domain).
   - `NODE_ENV`: `production`
4. Click **Deploy**.
5. Once deployed, Vercel will serve the Next.js UI and transparently proxy all `/api/*` calls directly to your Render backend via `next.config.ts` rewrites with zero CORS latency.

---

### Step 4: PayPal Webhook Registration

1. Sign in to the [PayPal Developer Dashboard](https://developer.paypal.com/).
2. Navigate to **Apps & Credentials > Sandbox Apps** and select your application.
3. Scroll down to **Webhooks** and click **Add Webhook**.
4. Set **Webhook URL** directly to your Render backend service:
   ```text
   https://accordly-api.onrender.com/api/webhooks/paypal
   ```
   *(Important: Do not route PayPal webhooks through Vercel).*
5. Select event triggers:
   - `Invoicing invoice paid` (`INVOICING.INVOICE.PAID`)
   - `Invoicing invoice updated` (`INVOICING.INVOICE.UPDATED`)
   - `Invoicing invoice cancelled` (`INVOICING.INVOICE.CANCELLED`)
6. Save the webhook and copy the generated **Webhook ID**.
7. Return to the Render Dashboard and paste it as `PAYPAL_WEBHOOK_ID`. Click **Save Changes** to redeploy.

> **Cold-Start Advisory**: If running on Render Free Tier, the container will sleep after 15 minutes of inactivity. An incoming webhook may wake the instance up (30–50s delay), which can exceed PayPal's 5–10s webhook timeout. Using Render's **Starter** tier or pinging `/api/dashboard/overview` avoids webhook retry storms.

---

### Step 5: Verification & Post-Deployment Smoke Test

- [ ] Open `https://<your-vercel-domain>.vercel.app` and verify Executive Dashboard KPIs load cleanly.
- [ ] Upload an agreement PDF; verify document is parsed and saved to `/var/data/uploads`.
- [ ] Confirm baseline v1, submit a change request, and verify AI classification outputs.
- [ ] Create a proposal, approve it, and generate a client review link. Verify link domain matches `https://<your-vercel-domain>.vercel.app/review/<token>`.
- [ ] Open the review link in an Incognito tab, accept the proposal, and verify status updates in the provider workspace.
- [ ] Click "Create PayPal Invoice", dispatch invoice, and open the live PayPal Sandbox payment link.
- [ ] Complete payment in Sandbox; verify webhook signature verification and status update to `PAID`.

---

## 11. Environment Variable Reference Matrix

| Variable | Platform | Required | Purpose | Example |
| :--- | :--- | :--- | :--- | :--- |
| `BACKEND_API_URL` | Vercel | Yes | URL of Render backend for Next.js API rewrites | `https://accordly-api.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | Both | Yes | Canonical public frontend URL for review links | `https://accordly.vercel.app` |
| `DATABASE_URL` | Render | Yes | NeonDB connection pooler URL for runtime queries | `postgresql://user:pass@ep-pooler.c-8.neon.tech/neondb?sslmode=require` |
| `DIRECT_URL` | Render | Yes | NeonDB direct connection URL for schema push | `postgresql://user:pass@ep-direct.c-8.neon.tech/neondb?sslmode=require` |
| `STORAGE_DIR` | Render | Yes | Path to persistent disk for agreement PDFs | `/var/data/uploads` |
| `PAYPAL_ENV` | Render | Yes | PayPal environment mode (`sandbox` or `live`) | `sandbox` |
| `PAYPAL_CLIENT_ID` | Render | Yes | PayPal REST app client ID | `BAA2GzTi...` |
| `PAYPAL_CLIENT_SECRET` | Render | Yes | PayPal REST app secret (Keep Secret!) | `EIjCWmVE...` |
| `PAYPAL_BASE_URL` | Render | Yes | PayPal API base URL | `https://api-m.sandbox.paypal.com` |
| `PAYPAL_WEBHOOK_ID` | Render | Yes | Webhook listener ID issued by PayPal | `4WH12345ABCDE` |
| `AI_PROVIDER` | Render | Yes | AI engine (`gemini`, `openai`, `mock`) | `gemini` |
| `GEMINI_API_KEY` | Render | Optional | Google Gemini API key (Keep Secret!) | `AQ.Ab8RN6...` |
| `AI_MODEL` | Render | Optional | Gemini model identifier | `gemini-1.5-flash` |
| `CORS_ALLOWED_ORIGINS`| Render | Optional | Whitelisted origins if direct browser access is used | `https://accordly.vercel.app` |
| `NODE_ENV` | Both | Yes | Node execution environment | `production` |

---

## 12. Running Tests & Verification

### Automated Unit & Integration Tests (15 Suites, 111 Tests)
```bash
npm test
```

### TypeScript Verification
```bash
npm run typecheck
```

### Production Build
```bash
npm run build
```

### Complete End-to-End Scope-to-Cash Workflow Verification
```bash
npx tsx scripts/test-e2e-workflow.ts
```

### Live PayPal Sandbox Verification Scripts
```bash
# 1. Live Sandbox OAuth, Draft, Send & Retrieval
npm run test:paypal

# 2. Live Proposal-to-Invoice Multi-Item Test
npx tsx scripts/test-paypal-proposal-invoice.ts

# 3. Live Webhook Signature & Authoritative Sync Test
npx tsx scripts/test-paypal-webhook-reconciliation.ts
```

---

## 13. PayPal Sandbox Setup Guide

1. Sign in to the [PayPal Developer Dashboard](https://developer.paypal.com/).
2. Navigate to **Apps & Credentials** and select **Sandbox**.
3. Create a REST API app (or use the default application).
4. Copy the **Client ID** and **Secret** into your `.env` file.
5. In **Sandbox Accounts**, note the generated sandbox buyer account (`accordly-sandbox-buyer@example.com`).
6. To test live incoming webhooks locally:
   - Expose your local port: `npx ngrok http 3000`
   - In PayPal Developer Dashboard, add webhook URL: `https://<your-ngrok-url>/api/webhooks/paypal`
   - Subscribe to `Invoicing` events: `INVOICING.INVOICE.PAID`, `INVOICING.INVOICE.UPDATED`, `INVOICING.INVOICE.CANCELLED`.
   - Copy the generated Webhook ID into `PAYPAL_WEBHOOK_ID` in `.env`.

---

## 14. Demo Instructions (< 3 Minutes)

Follow this storyboard for a concise, compelling demo presentation:

1. **0:00–0:20 (The Problem)**: Show freelance agency reality: client sends an informal request, agency implements it, client refuses to pay the extra invoice due to lack of pre-approval.
2. **0:20–0:45 (Introduction to Accordly)**: Tour the Executive Dashboard (`/`). Show KPIs, multi-currency totals, action-required notifications, and active projects.
3. **0:45–1:15 (Scope Intelligence)**: Navigate to a project. Upload a Master Services Agreement PDF. Show AI extracting the foundational baseline. Submit a client change request ("Add Okta SSO"). Watch Accordly classify it as `OUT_OF_SCOPE` with contract citations.
4. **1:15–1:45 (Change Proposal & Pricing)**: Generate a proposal. Set itemized pricing ($1,000.00). Provider approves proposal. Generate secure client review link. Open the link in an incognito window as the client. Accept proposal.
5. **1:45–2:20 (PayPal Sandbox Invoicing)**: Return to provider workspace. Show proposal status updated to `CLIENT_ACCEPTED`. Click "Create PayPal Invoice". Review mapped line items. Send invoice. Open the real PayPal Sandbox hosted invoice URL.
6. **2:20–2:45 (Reconciliation & Dashboard)**: Show invoice payment recorded, executive dashboard receivables updated, and the full audit trail populated in the Project Activity Timeline.

---

## 15. Known Limitations

- **File Storage**: Uploaded agreements are currently saved to the local `uploads/` directory. For multi-instance cloud deployments (e.g., serverless Vercel), storage should be mapped to an S3-compatible bucket (e.g. AWS S3, Cloudflare R2).
- **Payment Processing**: Accordly is strictly configured for PayPal Sandbox. Live payment processing is intentionally disabled for hackathon submission.
- **E-Signatures**: Client acceptance represents mutual commercial agreement and records timestamp/token state, but does not replace legal wet-ink or qualified digital signature standards.

---

## 16. Hackathon Submission Checklist

- [x] **Project Name**: Accordly
- [x] **Tagline**: From agreement to payment, seamlessly.
- [x] **Open-Source License**: MIT License included (`LICENSE`).
- [x] **Complete Scope-to-Cash Workflow**: All 27 steps tested and passing.
- [x] **PayPal Sandbox Integration**: Live OAuth 2.0, draft creation, dispatch, retrieval, and webhook reconciliation verified.
- [x] **AI Grounding**: Gemini API integration with citation validation against source agreements.
- [x] **Zero Fabricated Financials**: Decimal-safe integer-cents arithmetic with currency isolation.
- [x] **Clean Production Build**: Next.js production build passing with 0 errors.
- [x] **Full Test Suite**: 15 test suites and 111 tests passing.

---

## 17. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

