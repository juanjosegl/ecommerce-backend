# AM Shop — E-Commerce Backend API

A production-grade REST API for an enterprise e-commerce platform, built to demonstrate real backend architecture: transactional business logic, role-based access control, caching, background jobs, and third-party integrations — not just CRUD.

**Live API:** https://am-shop-backend.onrender.com
**Interactive API docs (Swagger):** https://am-shop-backend.onrender.com/api-docs
**Frontend repo:** [ecommerce-frontend](https://github.com/juanjosegl/ecommerce-frontend)
**Live storefront:** https://ecommerce-frontend-ivory-nu.vercel.app

> ⚠️ This runs on free-tier hosting (Render). The API may take 30–50 seconds to respond on the first request after a period of inactivity while the instance wakes up.

---

## Why this project

Most portfolio e-commerce projects stop at "list products, place an order." This one goes further, modeling the parts of a real online store that are easy to get wrong:

- **Variants, not flat products.** A product like "Basic T-Shirt" has independent variants (size × color), each with its own SKU, price, and stock — the same model Shopify and Amazon use internally.
- **Stock is never edited directly.** Every change to inventory happens through an auditable `InventoryMovement` (IN/OUT with a reason), so at any point you can answer "why is stock at this number?"
- **Orders are transactional.** Creating an order validates stock for every line item, decrements stock, records inventory movements, and calculates totals — all inside a single Prisma `$transaction`. If any step fails, nothing is committed.
- **Prices are frozen at purchase time.** An `OrderItem` stores `priceAtSale`, so a later price change never rewrites order history.
- **Hybrid authentication.** Email/password and Google OAuth coexist. If a user registers with email and later signs in with Google using the same address, the accounts are merged automatically instead of creating a duplicate.
- **No public endpoint can create an admin.** `role` is never accepted from a public registration payload. The only way to create an admin is via a seed script or an existing admin using a protected endpoint.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [NestJS 11](https://nestjs.com) (TypeScript) |
| Database | PostgreSQL ([Neon](https://neon.tech) in production) |
| ORM | [Prisma 6](https://www.prisma.io) |
| Cache | Redis ([Upstash](https://upstash.com) in production) via `@nestjs/cache-manager` + `@keyv/redis` |
| Auth | JWT (`@nestjs/jwt`) + Passport (Local, JWT, Google OAuth2 strategies) |
| File storage | [Cloudinary](https://cloudinary.com) (product images) |
| Email | [Resend](https://resend.com) (transactional emails) |
| Scheduling | `@nestjs/schedule` (cron jobs) |
| Rate limiting | `@nestjs/throttler` |
| API docs | `@nestjs/swagger` (OpenAPI) |
| Validation | `class-validator` / `class-transformer` |
| Hosting | [Render](https://render.com) (free tier) |

---

## Architecture highlights

### Domain modules

```
src/
├── auth/          JWT + Google OAuth, password reset, self-service profile
├── users/          Admin-only user management (create staff, assign roles)
├── categories/      Self-referencing hierarchy (unlimited nesting)
├── products/         Products, variants, images (Cloudinary uploads)
├── inventory/        Stock movements, low-stock reporting
├── orders/           Transactional order creation, status lifecycle
├── upload/            Cloudinary integration
├── email/              Transactional emails (welcome, order confirmation, password reset)
├── scheduled-tasks/     Cron jobs (abandoned order cleanup, low-stock alerts)
├── redis/               Global cache module
├── health/               Health check endpoint for uptime monitoring
└── prisma/                Global Prisma service
```

### Role-based access control

A reusable `RolesGuard` + `@Roles('ADMIN')` decorator is layered on top of `JwtAuthGuard` across every module. Public read endpoints (product catalog, categories) stay open; every write operation and all of Inventory/Users is `ADMIN`-only. The pattern is applied consistently instead of ad-hoc checks scattered through controllers.

### Caching with correct invalidation

The product catalog is cached in Redis with a short TTL. The hard part of caching isn't reading from it — it's knowing when to throw it away. Every write to products (create, update, delete) explicitly invalidates the relevant cache keys, so the storefront never serves stale data after an admin makes a change.

### Background jobs

- **Abandoned order cleanup** (every 30 min): orders left in `PENDING` for 24+ hours are automatically cancelled, and their reserved stock is returned via a proper `InventoryMovement`, not a silent field update.
- **Low stock check** (daily): scans for variants below a threshold and logs them (hook point for the email alert already wired in the `EmailService`).

### Security

- Passwords hashed with `bcrypt`.
- JWTs signed with a 128-character cryptographically random secret.
- Rate limiting on `/auth/login` and `/auth/register` (5 requests/min) against brute force, plus a global limiter (30 req/min).
- CORS restricted to the deployed frontend origin.
- IDOR protection on order lookups — a customer can only fetch their own orders unless they're an admin.

---

## Getting started locally

### Prerequisites

- Node.js 20+, [pnpm](https://pnpm.io)
- Docker Desktop (for local PostgreSQL + Redis)

### Setup

```bash
git clone https://github.com/juanjosegl/ecommerce-backend.git
cd ecommerce-backend
pnpm install

# Start PostgreSQL + Redis locally
docker compose up -d

# Copy and fill in your environment variables
cp .env.example .env

# Apply the database schema
pnpm exec prisma migrate dev

# Seed an admin user + demo catalog
pnpm exec prisma db seed

# Start the dev server
pnpm run start:dev
```

The API will be running at `http://localhost:3000`, with interactive docs at `http://localhost:3000/api-docs`.

### Environment variables

See `.env.example` for the full list. You'll need free accounts for:

| Service | Used for |
|---|---|
| [Neon](https://neon.tech) or local Docker Postgres | Database |
| [Upstash](https://upstash.com) or local Docker Redis | Caching |
| [Google Cloud Console](https://console.cloud.google.com) | OAuth credentials |
| [Cloudinary](https://cloudinary.com) | Image uploads |
| [Resend](https://resend.com) | Transactional email |

---

## Default seeded credentials (demo data)

```
Admin:  admin@ecommerce.com / CambiaEstaClave123!
```

Change this before using the seed script against any environment you care about.

---

## Deployment

- **Database:** Neon (serverless Postgres, free tier, no expiration)
- **Cache:** Upstash (serverless Redis, free tier)
- **API:** Render (free tier — build command runs `prisma generate` + `nest build`; start command runs `prisma migrate deploy` before booting, so pending migrations apply automatically on every deploy)
- **Images:** Cloudinary (free tier)
- **Email:** Resend (free tier — 100 emails/day)

---

## What I'd add with more time

- Pagination on `/users` and `/orders` (already implemented on `/products` as a demonstration of the pattern)
- Refresh tokens (currently a single long-lived access token)
- Integration tests with a test database
- Webhook-based payment provider integration (Stripe/MercadoPago) instead of a manual "place order" flow

---

## License

MIT — built as a portfolio project by [Juan Jose Gutierrez](https://github.com/juanjosegl).
