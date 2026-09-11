# Fieldwork by Baker

> The premium BCBA fieldwork hours tracking platform. Built for professionals, by professionals.

## Quick Start — Deploy in 10 Minutes

### Prerequisites
- [Node.js 20+](https://nodejs.org)
- [Git](https://git-scm.com)
- [GitHub account](https://github.com)
- [Vercel account](https://vercel.com) (free)

---

## Step 1: Push to GitHub

```bash
# 1. Create a new repository on GitHub (don't initialize with README)
# Go to https://github.com/new and name it "fieldwork-by-baker"

# 2. In your project folder, run:
git init
git add .
git commit -m "Initial commit: Fieldwork by Baker"

# 3. Connect to your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/fieldwork-by-baker.git

# 4. Push to GitHub
git branch -M main
git push -u origin main
```

✅ **Done** — Your code is now on GitHub.

---

## Step 2: Deploy to Vercel (Free)

### Option A: Vercel Dashboard (Easiest)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select `fieldwork-by-baker`
4. Vercel auto-detects the framework — click **Deploy**
5. Wait 1-2 minutes → Your site is live! 🎉

### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login (opens browser)
vercel login

# Deploy
vercel --prod
```

### Option C: Connect GitHub for Auto-Deploy

1. In Vercel Dashboard → Add New Project
2. Import from GitHub
3. Under **Settings**:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Enable **Git Connection** → every push to `main` auto-deploys

✅ **Done** — Your site is live at `your-project.vercel.app`

---

## Step 3: Add Your Custom Domain

1. Buy your domain (e.g., `fieldworkbybaker.com`) from:
   - [Namecheap](https://namecheap.com) (~$12/year)
   - [Google Domains](https://domains.google)
   - [GoDaddy](https://godaddy.com)

2. In Vercel Dashboard:
   - Go to your project → **Settings** → **Domains**
   - Add `fieldworkbybaker.com`
   - Vercel gives you DNS records

3. In your domain registrar:
   - Add the DNS records Vercel provided (A record + CNAME)
   - Wait 5-60 minutes for propagation

4. Vercel auto-provisions **free SSL certificate**

✅ **Done** — Your site is at `https://fieldworkbybaker.com`

---

## Step 4: Connect Stripe for Payments

### 4.1 Create Stripe Account

1. Go to [stripe.com](https://stripe.com) → Sign up (free)
2. Complete activation (business details, bank account)
3. Go to **Developers** → **API Keys**

### 4.2 Create Subscription Products

In Stripe Dashboard:

```
Products → Add Product

Product 1: Individual Plan
  - Price: $12.00 / month
  - Billing: Recurring
  
Product 2: Professional Plan
  - Price: $24.00 / month
  - Billing: Recurring
  
Product 3: Enterprise Plan
  - Price: Custom (contact sales)
```

Copy the **Price IDs** (they look like `price_1ABC...`)

### 4.3 Add Environment Variables to Vercel

In Vercel Dashboard:
- Go to your project → **Settings** → **Environment Variables**
- Add these:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` (from Stripe) | Production |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` (from Stripe) | Preview |
| `STRIPE_SECRET_KEY` | `sk_live_...` (from Stripe) | Production |
| `STRIPE_SECRET_KEY` | `sk_test_...` (from Stripe) | Preview |
| `VITE_STRIPE_PRICE_INDIVIDUAL` | `price_...` (from Stripe) | All |
| `VITE_STRIPE_PRICE_PROFESSIONAL` | `price_...` (from Stripe) | All |
| `VITE_STRIPE_PRICE_ENTERPRISE` | `price_...` (from Stripe) | All |
| `VITE_APP_URL` | `https://fieldworkbybaker.com` | Production |

### 4.4 Enable Apple Pay

1. In Stripe Dashboard → **Settings** → **Payment Methods**
2. Enable **Apple Pay**
3. Add your domain verification file to `/public/.well-known/apple-developer-merchantid-domain-association`
4. Stripe will verify your domain

✅ **Done** — Customers can pay with Apple Pay, cards, and Google Pay

---

## Step 5: Set Up Webhook (For Subscription Management)

### 5.1 Create Webhook Endpoint

1. In Stripe Dashboard → **Developers** → **Webhooks**
2. **Add endpoint**:
   - URL: `https://fieldworkbybaker.com/api/stripe-webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.deleted`

3. Copy the **Webhook Signing Secret** (starts with `whsec_`)

### 5.2 Add Webhook Secret to Vercel

| Variable | Value | Environment |
|----------|-------|-------------|
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production |

✅ **Done** — Stripe will notify your app when payments succeed/fail

---

## Step 6: Add a Backend (Required for Production)

This frontend needs a backend for:
- Creating Stripe checkout sessions
- Handling webhooks
- Storing user data & hours
- Authentication (beyond the demo)

### Recommended Stack:

```
Frontend (this repo): React + Vite + Tailwind
Backend: Node.js + Express + MongoDB/PostgreSQL
Hosting: Vercel (frontend) + Railway/Render (backend)
```

### Quick Backend Setup:

```bash
# Create a new folder for your API
mkdir fieldwork-api
cd fieldwork-api
npm init -y
npm install express stripe cors dotenv
```

Create `api/index.js`:

```javascript
const express = require('express');
const Stripe = require('stripe');
const app = express();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  const { priceId, customerEmail } = req.body;
  
  const session = await stripe.checkout.sessions.create({
    customer_email: customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.APP_URL}/dashboard?success=true`,
    cancel_url: `${process.env.APP_URL}/pricing?canceled=true`,
  });
  
  res.json({ sessionId: session.id });
});

// Webhook handler
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  
  if (event.type === 'checkout.session.completed') {
    // Activate subscription in database
    console.log('Payment successful!', event.data.object);
  }
  
  res.json({ received: true });
});

app.listen(3000, () => console.log('API running on port 3000'));
```

---

## Project Structure

```
fieldwork-by-baker/
├── public/                    # Static assets (images, icons)
├── src/
│   ├── components/            # Shared components (Navbar, Footer, Layout)
│   ├── components/ui/         # shadcn/ui components
│   ├── components/dashboard/  # Dashboard tabs (Overview, LogHours, etc.)
│   ├── pages/                 # All 11 pages (Home, Pricing, Dashboard, etc.)
│   ├── hooks/                 # Custom hooks (useAuth, etc.)
│   ├── types/                 # TypeScript types
│   ├── data/                  # Mock data for demo mode
│   ├── lib/                   # Utilities
│   ├── App.tsx                # Router setup
│   └── main.tsx               # Entry point
├── .github/workflows/         # CI/CD (auto-deploy to Vercel)
├── .env.example               # Environment variables template
├── vercel.json                # Vercel SPA routing config
├── vite.config.ts             # Vite configuration
├── tailwind.config.js         # Design system
└── package.json
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start development server (localhost:5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key (pk_test_ or pk_live_) |
| `VITE_STRIPE_PRICE_INDIVIDUAL` | Yes | Stripe Price ID for Individual plan |
| `VITE_STRIPE_PRICE_PROFESSIONAL` | Yes | Stripe Price ID for Professional plan |
| `VITE_STRIPE_PRICE_ENTERPRISE` | Yes | Stripe Price ID for Enterprise plan |
| `VITE_APP_URL` | Recommended | Your production domain |

---

## Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Landing page with hero, features, pricing preview |
| `/#/features` | Features | Detailed feature showcase |
| `/#/pricing` | Pricing | 3-tier pricing with Stripe checkout |
| `/#/enterprise` | Enterprise | Organization/enterprise sales page |
| `/#/about` | About | Company story, mission, team |
| `/#/blog` | Blog | Resources and articles |
| `/#/faq` | FAQ | Comprehensive FAQ accordion |
| `/#/contact` | Contact | Contact form and support info |
| `/#/signup` | Sign Up | 4-step registration wizard |
| `/#/login` | Login | Owner + demo login |
| `/#/dashboard` | Dashboard | Main app with 6 tabs + admin |

---

## Owner Login

Use these credentials for full admin access:

- **Email**: `Justin@bakerholdings.co`
- **Password**: `Thebakers0116@`

Owner features:
- Admin dashboard tab with platform stats
- User management controls
- Subscription/revenue overview
- Owner badge throughout UI

---

## Demo Mode

Click **"Try Demo Mode"** on the login page to explore with sample data:
- 1,247 hours logged
- 65% unrestricted compliance
- Full dashboard access
- All 6 tabs available
- No admin tab (requires owner login)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 3 |
| Components | shadcn/ui |
| Animations | Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |
| Routing | React Router (HashRouter) |
| State | React Hooks + Context |
| Payments | Stripe (ready to connect) |
| Auth | Local storage (demo) → JWT (production) |
| Hosting | Vercel |
| CI/CD | GitHub Actions |

---

## Support

For questions or issues:
- Email: support@fieldworkbybaker.com
- Dashboard: Log in → Click profile → Support

---

Built with ❤️ for the ABA community.

© 2025 Fieldwork by Baker. All rights reserved.
