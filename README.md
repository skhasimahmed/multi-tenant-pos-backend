# Multi-Tenant POS Sales & Inventory Backend

A multi-tenant backend for retail chains built with NestJS, TypeORM, and PostgreSQL. Supports multi-store merchants with isolated stock, server-calculated checkout pricing, pessimistic row locking to prevent overselling, and idempotency protection against duplicate charges.

---

## Tech Stack

- **Runtime**: Node.js 24
- **Framework**: NestJS 12
- **Language**: TypeScript 6
- **Database**: PostgreSQL 17 (TypeORM 1.1)
- **Cache**: Redis 8 (with automatic in-memory fallback)
- **Testing**: Jest 30 & Supertest

### Store Structure

```
Merchant (Organization)
  ├── Stores (Physical Outlets)
  │     ├── Inventory (Stock per store)
  │     └── Sales (Transactions & receipts)
  ├── Products (Global product catalog per merchant)
  └── Users (Admin, Manager, Cashier)
```

---

## Getting Started

### Prerequisites

- Node.js >= 24 (if running locally)
- PostgreSQL 17 & Redis 8 (local services or Docker)

---

### Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

3. **Start services**:
   ```bash
   # Start Redis (if PostgreSQL is already running locally on port 5432)
   docker compose up -d redis

   # Or start both PostgreSQL and Redis:
   docker compose up -d postgres redis
   ```
   > **Tip**: Docker maps PostgreSQL to host port `5433` (`5433:5432`), keeping your local machine's port `5432` completely free of port collisions.

4. **Initialize database schema and seed data**:
   ```bash
   # All-in-one setup (drop tables, run migrations, seed data)
   npm run db:reset
   ```
   *Or run each step individually:*
   ```bash
   npm run schema:drop      # 1. Drop existing tables
   npm run migration:run    # 2. Run schema migrations
   npm run seed             # 3. Seed sample accounts, stores & stock
   ```

5. **Start the application**:
   ```bash
   npm run start:dev
   ```
   The API will be available at `http://localhost:5000/api`.

---

### Docker Setup

Run the entire application, PostgreSQL, and Redis in Docker containers:

1. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

2. **Build and start containers**:
   ```bash
   docker compose up --build -d
   ```

3. **Initialize database and seed data**:
   ```bash
   # All-in-one setup
   docker compose exec app npm run db:reset
   ```
   *Or run each step individually:*
   ```bash
   docker compose exec app npm run schema:drop
   docker compose exec app npm run migration:run
   docker compose exec app npm run seed
   ```

4. **Run npm scripts inside the container**:
   ```bash
   # Run all 14 E2E integration tests
   docker compose exec app npm run test:e2e

   # Run a specific test suite
   docker compose exec app npm run test:e2e -- test/sales-checkout.e2e-spec.ts

   # Re-seed test data
   docker compose exec app npm run seed

   # Run database migrations
   docker compose exec app npm run migration:run

   # Run ESLint
   docker compose exec app npm run lint

   # Production build check
   docker compose exec app npm run build
   ```

5. **CLI & Shell Access**:
   ```bash
   # Redis CLI
   docker compose exec redis redis-cli

   # PostgreSQL CLI
   docker compose exec postgres psql -U postgres -d pos_db

   # Open a shell inside the API container
   docker compose exec app sh
   ```

6. **Container Management**:
   ```bash
   # Stream application logs
   docker compose logs -f app

   # Check container status
   docker compose ps

   # Stop Redis to test in-memory fallback
   docker compose stop redis

   # Restart Redis
   docker compose start redis

   # Stop all containers
   docker compose down
   ```

---

## Environment Variables

Copy `.env.example` to `.env`. Default configuration values:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port the API listens on |
| `NODE_ENV` | `development` | Runtime mode (`development`, `production`, `test`) |
| `DB_HOST` | `localhost` | Database host (`postgres` inside Docker) |
| `DB_PORT` | `5432` | Local database port |
| `DB_USERNAME` | `postgres` | Database username |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `pos_db` | Database name |
| `JWT_SECRET` | `pos_jwt_access_secret_key_123` | Secret used to sign access tokens |
| `JWT_EXPIRATION` | `900s` | Access token lifetime (15 minutes) |
| `JWT_REFRESH_SECRET` | `pos_jwt_refresh_secret_key_123` | Secret used to sign refresh tokens |
| `JWT_REFRESH_EXPIRATION` | `28800s` | Refresh token lifetime (8 hours / cashier shift) |
| `REDIS_HOST` | `localhost` | Redis host (`redis` inside Docker) |
| `REDIS_PORT` | `6379` | Redis port |

---

## Health & Status

Check API and service connectivity:

* **`GET /api/health`**:
  ```json
  {
    "status": "ok",
    "uptime": 142,
    "checks": {
      "database": "up",
      "redis": "up"
    }
  }
  ```

* **`GET /`**:
  ```json
  {
    "name": "pos-backend",
    "version": "1.0.0",
    "status": "ok"
  }
  ```

---

## Demo Accounts

Run `npm run seed` to load these accounts. Password for all accounts is `Password123!`

| Role | Name | Email | Store / Organization |
| :--- | :--- | :--- | :--- |
| **Merchant Admin** | Hasim Ahmed | `hasim.ahmed@easternretail.in` | All Stores (Eastern Retail Ltd.) |
| **Store Manager** | Rajesh Sharma | `rajesh.sharma@easternretail.in` | Park Street, Kolkata |
| **Cashier** | Arjun Kumar | `arjun.kumar@easternretail.in` | Park Street, Kolkata |
| **Cashier** | Kavita Patel | `kavita.patel@easternretail.in` | Salt Lake, Kolkata |
| **Merchant Admin** | Amit Deshmukh | `amit.deshmukh@sagarprovisions.in` | All Stores (Sagar Provisions) |
| **Cashier** | Rohit Verma | `rohit.verma@sagarprovisions.in` | Bandra West, Mumbai |

---

## Architecture & Design

### Multi-Tenancy & Isolation
- **Two-Tier Isolation**: The system enforces boundary protection at both the Organization (`merchant_id`) and Outlet (`store_id`) tiers.
- Every database query filters by `merchant_id` and, where applicable, `store_id`.
- The JWT payload embeds the user's `merchantId`, `storeId`, and `role`.
- **Staff Store Lock (`CASHIER` / `STORE_MANAGER`)**: Restricted to their designated physical store (`user.storeId`). Attempting to query inventory, execute sales, or view receipts for another store immediately rejects with `403 Forbidden` (`cannot access resources of another store`).
- **Merchant Admin Multi-Store Management (`MERCHANT_ADMIN`)**: Business owners hold operational authority across all branches owned by their organization (e.g. Hasim Ahmed oversees both Store 1 *Park Street* and Store 2 *Salt Lake*). Admins can update inventory and process sales across all company-owned stores.
- **Cross-Merchant Protection**: Attempting to query, update stock, or create sales in a store belonging to another merchant returns `404 Not Found` (`Store not found for this merchant`). Returning `404` instead of `403` prevents tenant enumeration, ensuring competing businesses cannot probe for store UUIDs.

### Concurrency & Oversell Protection
- When processing a sale, the service opens a database transaction.
- Product inventory rows are locked using `SELECT ... FOR UPDATE` before quantities are checked.
- Product IDs are sorted alphabetically before acquiring locks to prevent deadlocks when multiple cashiers process transactions containing the same items in different order.
- If requested quantity exceeds current stock, the transaction rolls back cleanly with a `400 Bad Request` without altering inventory.
- A database-level check constraint `CHECK (quantity >= 0)` ensures stock can never become negative.

### Idempotent Checkouts
- Checkouts accept an `Idempotency-Key` header from POS terminals.
- When a transaction succeeds, the completed response payload is saved in cache keyed by the idempotency token.
- If network interruptions cause a terminal to retry the request with the same key, the backend returns the cached receipt immediately without processing duplicate charges or deducting inventory a second time.

### Payment Processing
- The checkout flow integrates with a modular payment provider interface (`PaymentProvider`).
- Default implementation is `MockPaymentProvider`. Passing a `paymentToken` containing the word `fail` simulates a declined payment.
- If payment fails, the transaction rolls back immediately; inventory remains unchanged.

### Authentication & Sessions
- **Access Tokens**: Short-lived (15 minutes) for active POS terminal requests.
- **Refresh Tokens**: Long-lived (8 hours, matching standard retail shift duration). Stored in Redis.
- **Logout & Invalidation**: Calling `/api/auth/logout` deletes the active refresh token from Redis and blacklists the current access token, revoking the session immediately.

### Cache & Fallback
- Store product catalogs are cached in Redis for 5 minutes to accelerate barcode scans. The cache is automatically invalidated when catalog prices or stock change.
- Redis also stores active refresh tokens and idempotency records.
- If Redis is unavailable or restarts, `RedisService` automatically falls back to an internal in-memory cache so sales checkouts are never blocked.

### Rate Limiting
- Default rate limit: 100 requests per minute per IP.
- Authentication route (`/api/auth/login`): 10 attempts per minute to mitigate brute-force attempts.
- Health check endpoints are excluded from rate limits.

---

## Database Decisions & Trade-offs

- **Shared Database with Discriminator Columns**: Every table includes `merchant_id` (and `store_id` where appropriate) with composite indexes. This supports horizontal scaling across stores without the operational complexity of managing separate PostgreSQL schemas or databases per tenant.
- **UUID Primary Keys**: Prevents sequential ID guessing or enumeration attacks across tenant boundaries.
- **Exact Decimal Precision**: Prices and transaction totals use `numeric(12, 2)` to eliminate floating-point rounding errors.
- **Pessimistic vs. Optimistic Locking**: Retail checkouts cannot drop customer baskets due to version collisions at the register. Pessimistic row locks (`SELECT ... FOR UPDATE`) are held for only a few milliseconds during checkout, providing deterministic, first-come-first-served order processing without retry loops.
- **Deterministic Lock Ordering**: Sorting product IDs prior to transaction locking eliminates deadlocks when concurrent checkouts overlap on inventory items.
- **Synchronous Checkouts**: Inventory validation, stock deduction, and payment capture run within a single ACID transaction so the cashier receives an immediate, definitive receipt. Background job queues are reserved for non-critical downstream operations (such as digital receipt emails or analytics sync).

---

## Running Tests

### Run all E2E tests:
```bash
npm run test:e2e
```

### Run a single test suite:
```bash
npm run test:e2e -- test/sales-checkout.e2e-spec.ts
```

### Test Suites Covered (14 tests total):
1. **Sales Checkout (`test/sales-checkout.e2e-spec.ts`)**: Server-calculated pricing, inventory deductions, and payment failure rollbacks.
2. **Inventory & Concurrency (`test/inventory-concurrency.e2e-spec.ts`)**: Simultaneous checkouts using `Promise.all`, verifying row locking prevents overselling when stock runs low.
3. **Tenant Isolation (`test/tenant-isolation.e2e-spec.ts`)**: Validates that cashiers and managers cannot access data or sell inventory outside their assigned store (`403 Forbidden`), allows merchant admins to manage stock across all branches of their company (`200 OK`), and rejects any cross-merchant tampering attempts (`404 Not Found`).
4. **Idempotency (`test/idempotency.e2e-spec.ts`)**: Confirms duplicate requests with identical idempotency keys return cached receipts without double-deducting stock.
5. **Authentication (`test/auth-refresh.e2e-spec.ts`)**: Verifies token rotation, refresh token lifecycles, and session revocation in Redis.

---

## Postman Collection

Import `postman_collection.json` into Postman. Keep environment set to **No Environment** (the collection manages variables dynamically).

### Folder Structure:
- **Health**: Service root probe (`/`) and health check (`/health`)
- **Auth**: Login (Cashier, Store Manager, Admin), token refresh, and session logout
- **Stores**: Store branch listings and outlet details
- **Products**: Merchant catalog, store availability with stock levels, product lookup, Admin creation, and product updates
- **Inventory**: Store stock levels and stock adjustments
- **Sales**: Server-calculated checkouts, duplicate idempotency key replays (no re-charge), failed payment rollbacks, oversell rejection (`422`), cross-store rejection, sales history, and receipt lookup

> **Tip**: Running `Login (Cashier)` automatically stores the JWT `authToken`, `refreshToken`, and active `storeId` into collection variables. Running `List Products` sets `productId`, and running `Checkout` sets `saleId` so subsequent requests work immediately without manual copying.

> **E2E Test Suite**: For exhaustive edge cases (such as concurrent race conditions, multi-store manager boundaries, and cross-merchant isolation), run the automated test suite with `npm run test:e2e`.

---

### Quick cURL Examples

**1. Login (Cashier):**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"arjun.kumar@easternretail.in","password":"Password123!"}'
```

**2. Store Catalog (with Stock):**
```bash
curl -X GET http://localhost:5000/api/products/store/<STORE_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

**3. Checkout:**
```bash
curl -X POST http://localhost:5000/api/sales \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pos-sale-001" \
  -d '{
    "storeId": "<STORE_ID>",
    "items": [{"productId": "<PRODUCT_ID>", "quantity": 2}],
    "paymentToken": "mock_token_success"
  }'
```

**4. Get Store Inventory:**
```bash
curl -X GET http://localhost:5000/api/inventory/store/<STORE_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

**5. Refresh Token:**
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

**6. Logout:**
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer <TOKEN>"
```
