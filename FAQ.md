# Interview FAQ - FeedMe Order Management System

## Table of Contents

1. [Architecture & System Design](#architecture--system-design)
2. [Database & Data Modeling](#database--data-modeling)
3. [Concurrency & Race Conditions](#concurrency--race-conditions)
4. [Queue & Priority System](#queue--priority-system)
5. [Bot Management & Processing](#bot-management--processing)
6. [Resilience & Recovery](#resilience--recovery)
7. [Frontend & State Management](#frontend--state-management)
8. [Security & Validation](#security--validation)
9. [Scaling & Production Readiness](#scaling--production-readiness)
10. [Trade-offs & Decision Making](#trade-offs--decision-making)

---

## Architecture & System Design

### Q1. Walk me through the high-level architecture of this system.

**Answer:** The system is a three-tier McDonald's order management platform:

1. **Frontend** - React (TanStack Start) with polling-based data fetching every 2 seconds via TanStack Query. Three-column dashboard (PENDING, PROCESSING, COMPLETE) with a bot fleet panel.
2. **Backend** - Nitro API server handling CRUD for orders/bots, bot-to-order assignment via atomic transactions, and QStash-based delayed completion callbacks.
3. **Database** - Turso (LibSQL/SQLite) with Drizzle ORM. Five tables: `users`, `orders`, `bots`, `orderNumbers`, `resumeLocks`.

Orders flow through three states: PENDING -> PROCESSING -> COMPLETE. The frontend auto-assigns idle bots to the highest-priority pending order, the server schedules a 10-second QStash callback, and the callback marks the order complete and frees the bot.

**Why they ask:** Tests whether you can communicate system design clearly and understand how all layers connect. Shows you built this intentionally, not just hacking pieces together.

---

### Q2. Why did you choose TanStack Start + Nitro instead of Next.js or a separate backend?

**Answer:** TanStack Start provides file-based routing with Nitro as the server layer, giving us full-stack TypeScript with Vercel deployment support. Nitro offers server plugins (used for startup recovery), API routes with native Web Request/Response APIs, and a lightweight footprint. Unlike Next.js, it doesn't impose React Server Components complexity for what is fundamentally a client-heavy real-time dashboard. The API routes are thin REST handlers - the framework stays out of the way.

**Why they ask:** Interviewers want to see that you evaluated options and chose tools for specific reasons, not just familiarity. Shows pragmatism over hype-driven development.

---

### Q3. Why polling instead of WebSockets for real-time updates?

**Answer:** Polling at 2-second intervals was chosen because:
- **Simplicity** - No WebSocket server management, connection lifecycle, or reconnection logic.
- **PWA compatibility** - Works with service workers and offline-first patterns without WebSocket state complications.
- **Sufficient for the use case** - A 2-second delay is acceptable for a POS display board. WebSockets would add complexity for marginal latency improvement.
- **Stateless server** - Polling keeps the server stateless, which simplifies Vercel serverless deployment.

The trade-off is slightly higher server load from repeated requests, but for a single-restaurant POS system this is negligible.

**Why they ask:** This is a classic real-time architecture decision. They want to see you weigh trade-offs rather than defaulting to the "fancier" solution.

---

### Q4. Explain the data flow from when a user clicks "New Order" to when it appears on screen.

**Answer:**
1. User clicks "Normal Order" or "VIP Order" button in `Dashboard.tsx`.
2. `createOrder()` calls `POST /api/orders` with `{ type: 'NORMAL' | 'VIP', userId }`.
3. Server opens a transaction: inserts into `orderNumbers` to get the next auto-increment ID, then inserts into `orders` with that `orderNumber`, status `PENDING`, and the given type.
4. Server returns the created order with status 201.
5. On next poll cycle (within 2 seconds), `GET /api/orders` returns the updated list.
6. The query result triggers a re-render. The priority-sorted SQL places VIP PENDING orders first, then NORMAL PENDING, then PROCESSING, then COMPLETE.
7. The Dashboard component filters orders into three columns and renders `OrderCard` components.
8. Meanwhile, the auto-assignment loop detects an idle bot and pending order, calling `POST /api/bots/:id/claim` to start processing.

**Why they ask:** Tests your understanding of the full request lifecycle across frontend and backend. Reveals whether you know your own code deeply.

---

### Q5. Why did you use a monorepo structure with a `pos/` subdirectory?

**Answer:** The `pos/` directory isolates the application code (components, API, database) from the root which holds documentation, planning files, and workspace-level configuration. The root `package.json` uses npm workspaces to reference `pos/`. This separation keeps deployment concerns (Vercel config) at the app level while project documentation lives at the root. It also makes it easy to add other services (e.g., a kitchen display or admin panel) as sibling directories later.

**Why they ask:** Shows awareness of project organization and forward-thinking structure.

---

## Database & Data Modeling

### Q6. Walk me through your database schema and why each table exists.

**Answer:**
- **`users`** - Stores user accounts with roles (NORMAL, VIP, MANAGER, BOT). Roles determine order type and UI permissions.
- **`orders`** - Core entity. Tracks order lifecycle via `status` (PENDING/PROCESSING/COMPLETE), links to `userId` (who placed it) and `botId` (who's cooking it). `orderNumber` is the human-readable display number.
- **`bots`** - Cooking bots with `status` (IDLE/PROCESSING) and `currentOrderId` pointer. The `currentOrderId` creates a bidirectional link with orders for consistency checks.
- **`orderNumbers`** - Auto-increment sequence table. Each insert returns the next sequential order number. Guarantees gap-free, sequential numbering.
- **`resumeLocks`** - Distributed lock for crash recovery. Prevents thundering herd when multiple clients trigger recovery simultaneously.

**Why they ask:** Schema design reveals your data modeling skills. They're checking normalization, relationship choices, and whether each table has a clear purpose.

---

### Q7. Why use soft deletes (`deletedAt`) instead of hard deletes?

**Answer:** Soft deletes were chosen because:
- **Audit trail** - Deleted orders/bots remain queryable for debugging and analytics.
- **Cascading safety** - Hard-deleting a bot wouldn't properly handle its in-flight order. With soft deletes, the bot's delete handler can reset the order to PENDING before marking the bot deleted.
- **Recovery** - Accidental deletions are reversible.
- **Referential integrity** - Foreign keys use `onDelete: 'set null'` rather than cascading deletes, so references don't break.

Every query includes `WHERE deletedAt IS NULL` to exclude deleted records from normal operations.

**Why they ask:** Data lifecycle management is a real production concern. Shows you think about data integrity and operational safety.

---

### Q8. Why a separate `orderNumbers` table instead of using the `orders` table's auto-increment?

**Answer:** The `orders` table uses UUID7 as its primary key (for time-ordering and distributed-friendliness). UUIDs can't provide sequential, human-readable numbers. The `orderNumbers` table is a dedicated sequence generator - each INSERT returns the next auto-increment integer. This is done in the same transaction as the order creation, ensuring atomicity. It guarantees gap-free, strictly increasing order numbers regardless of concurrent requests.

**Why they ask:** Tests understanding of ID strategies and the trade-off between UUIDs (distributed-safe) and sequential integers (human-readable).

---

### Q9. Explain your choice of UUID7 over other ID strategies.

**Answer:** UUID7 embeds a Unix timestamp in the first 48 bits, making IDs:
- **Time-ordered** - Database range scans on recent records are efficient. B-tree index inserts are sequential rather than random (unlike UUIDv4).
- **Globally unique** - No coordination needed between instances, unlike auto-increment.
- **Sortable** - Natural chronological ordering without a separate timestamp column.
- **Database-agnostic** - Works identically across SQLite, PostgreSQL, MySQL.

The `uuid7.ts` utility generates these client-side, avoiding a database round-trip for ID generation.

**Why they ask:** ID strategy is a fundamental design decision that affects performance, scalability, and debugging. Shows you understand the implications.

---

### Q10. What unique constraints exist and why?

**Answer:** Two critical unique constraints in the schema:

1. **`orders_order_number_active`** - Ensures `orderNumber` is unique among non-deleted orders. Uses a partial unique index: `UNIQUE(orderNumber) WHERE deletedAt IS NULL`. Prevents duplicate order numbers in the active set while allowing deleted orders to have overlapping numbers.

2. **`orders_processing_bot_active`** - Ensures one bot can only process one order at a time: `UNIQUE(botId, status) WHERE status = 'PROCESSING' AND deletedAt IS NULL`. This is a database-level guarantee that prevents double-assignment even if application logic has a bug.

**Why they ask:** Constraint design shows you use the database as a safety net, not just a data store. Defense-in-depth thinking.

---

### Q11. How does the Drizzle ORM migration system work in this project?

**Answer:** Drizzle uses a snapshot-based migration system. The `drizzle/` directory contains:
- Numbered SQL migration files (`0000_silent_silver_surfer.sql`, etc.) containing raw DDL statements.
- `meta/` directory with JSON snapshots of the schema at each migration point.
- `_journal.json` tracking which migrations have been applied.

Schema changes are made in `schema.ts`, then `drizzle-kit generate` diffs against the latest snapshot to produce a new migration file. `drizzle-kit push` applies pending migrations to the database. This gives us version-controlled, reproducible schema evolution.

**Why they ask:** Migration strategy is critical for production systems. Shows you handle schema evolution properly.

---

## Concurrency & Race Conditions

### Q12. How do you prevent two bots from claiming the same order?

**Answer:** The bot claim endpoint (`POST /api/bots/:id/claim`) uses a database transaction with optimistic checks:

1. Inside the transaction, verify the bot is IDLE.
2. Query for the highest-priority PENDING order (VIP first, then by orderNumber).
3. Update the order's status to PROCESSING and set its `botId`.
4. Update the bot's status to PROCESSING and set its `currentOrderId`.
5. If any step fails (e.g., order was claimed between steps 2 and 3), the transaction rolls back.

Additionally, the `orders_processing_bot_active` unique constraint prevents a bot from being assigned to multiple PROCESSING orders at the database level - even if the application logic fails.

**Why they ask:** Race conditions are the #1 source of bugs in concurrent systems. This question tests whether you've actually thought about and solved the problem, not just ignored it.

---

### Q13. What happens if two clients try to assign bots simultaneously?

**Answer:** SQLite serializes write transactions, so two concurrent `claim` transactions execute sequentially. The first transaction claims the order successfully. The second transaction reads the updated state (order is now PROCESSING), finds no matching PENDING order (or the bot is no longer IDLE), and returns `null` or a 409 Conflict. The client handles this gracefully - on the next poll cycle, it sees the updated state and doesn't retry.

**Why they ask:** Tests understanding of database transaction isolation and how the system behaves under concurrent load without distributed locking.

---

### Q14. How does the `botId` act as an ownership token to prevent stale callbacks?

**Answer:** When a bot claims an order, the order's `botId` is set to that bot's ID, and the QStash callback is scheduled with that same `botId`. If the bot is deleted mid-processing:

1. The bot delete handler sets the order's `botId` to `null` and status back to PENDING.
2. The QStash callback cannot be cancelled, so it fires 10 seconds later with the original `botId`.
3. The completion endpoint checks: order must be PROCESSING AND `order.botId` must match the callback's `botId`.
4. Since `botId` is now `null` (or the order was reclaimed by a different bot), the validation fails and the callback is silently rejected.

This prevents stale callbacks from incorrectly completing orders that have been reassigned.

**Why they ask:** This is a subtle distributed systems problem. Shows understanding of eventual consistency and how to handle "fire-and-forget" callbacks safely.

---

### Q15. What is the thundering herd problem and how does `resumeLocks` solve it?

**Answer:** The thundering herd occurs when multiple clients poll `GET /api/orders` simultaneously after a server restart - each one would trigger the crash recovery logic, creating duplicate QStash callbacks or double-completing orders.

The `resumeLocks` table implements a simple distributed lock:
1. Try to UPDATE the existing lock row where `expiresAt < now` (lock expired).
2. If no rows updated, check if the lock exists - if yes, another process holds it, skip recovery.
3. If no lock exists, INSERT a new one.
4. Lock TTL is 30 seconds, preventing stale locks from blocking recovery permanently.

Only the first client to acquire the lock runs recovery. Others skip it and return the order list normally.

**Why they ask:** Shows awareness of real distributed systems failure modes, not just happy-path thinking.

---

### Q16. Why use database transactions instead of application-level locking?

**Answer:** Database transactions provide ACID guarantees that application-level locks cannot:
- **Atomicity** - All changes commit or all roll back. No partial state.
- **Isolation** - SQLite serializes writes, preventing interleaving of concurrent claims.
- **Durability** - Committed state survives crashes.
- **No lock management** - No need to handle lock expiry, deadlocks, or cleanup.

Application-level locks (e.g., in-memory mutexes) would be lost on server restart and don't work across serverless function instances. The database is the single source of truth and the natural serialization point.

**Why they ask:** Tests understanding of where to put consistency guarantees. A common mistake is implementing locks in application code when the database already provides them.

---

## Queue & Priority System

### Q17. How does the priority queue work?

**Answer:** The priority queue is implemented entirely in SQL via the `ORDER BY` clause in `getAllOrders()`:

```sql
ORDER BY
  CASE
    WHEN status='PENDING' AND type='VIP' THEN 0    -- Highest priority
    WHEN status='PENDING' AND type='NORMAL' THEN 1
    WHEN status='PROCESSING' THEN 2
    ELSE 3                                          -- COMPLETE
  END,
  CASE WHEN status='PENDING' THEN orderNumber END,  -- FIFO within priority
  createdAt DESC
```

VIP PENDING orders sort before NORMAL PENDING. Within each tier, orders are sorted by `orderNumber` (FIFO). The bot claim endpoint uses `getPendingOrders()` which returns VIP first, then NORMAL, both ordered by `orderNumber`.

**Why they ask:** Priority queues are a fundamental data structure. They want to see if you implemented it cleanly or over-engineered it (e.g., a separate queue service for this scale).

---

### Q18. How are VIP orders prioritized without starving normal orders?

**Answer:** Currently, VIP orders always process before normal orders - there's no starvation prevention. This is by design per the requirements: "VIP orders are prioritized before normal orders."

In a production system, you might add:
- **Aging** - Boost normal order priority after N seconds of waiting.
- **Ratio-based scheduling** - Process 2 VIP orders for every 1 normal order.
- **Deadline-based** - Assign deadlines based on order type and prioritize by nearest deadline.

For a restaurant POS, simple VIP-first is appropriate because VIP volume is typically low relative to normal orders.

**Why they ask:** Tests awareness of queue fairness and starvation, a classic computer science concept. Also tests ability to distinguish "good enough for requirements" from "production-grade."

---

### Q19. What guarantees sequential, gap-free order numbers under concurrency?

**Answer:** The `orderNumbers` table uses SQLite's auto-increment primary key. Each `POST /api/orders` request:
1. Opens a transaction.
2. INSERTs into `orderNumbers` (getting the next sequential ID).
3. Uses that ID as the `orderNumber` for the new order.
4. Commits the transaction.

SQLite serializes write transactions, so concurrent order creations queue up. Each gets the next integer without gaps. The transaction ensures the number allocation and order creation are atomic - if the order INSERT fails, the number allocation rolls back too.

**Why they ask:** Sequential numbering under concurrency is harder than it sounds. Tests understanding of transaction isolation and auto-increment guarantees.

---

### Q20. If an order is deleted, can its order number be reused?

**Answer:** No, and this is intentional. The `orderNumbers` auto-increment never decreases. The unique constraint `orders_order_number_active` only applies to non-deleted orders, so a deleted order's number won't conflict with new orders, but the sequence generator won't reuse that number either. In a POS system, reusing order numbers would cause confusion - "Order #42 was already called, but now there's a new #42?"

**Why they ask:** Tests edge-case thinking about data lifecycle and user experience implications.

---

## Bot Management & Processing

### Q21. Explain the bot lifecycle from creation to processing to idle.

**Answer:**
1. **Created** - Manager clicks "+Bot". `POST /api/bots` creates a bot with `status: IDLE`, `currentOrderId: null`.
2. **Idle** - The auto-assignment loop in Dashboard detects idle bots and pending orders. Calls `POST /api/bots/:id/claim`.
3. **Claimed** - The claim transaction atomically sets bot to PROCESSING, links it to the order, and schedules a 10-second QStash callback.
4. **Processing** - Bot is cooking. Client-side timer counts down from 10 seconds for UI feedback.
5. **Complete** - QStash callback fires `POST /api/orders/complete`. Sets order to COMPLETE, bot back to IDLE, `currentOrderId` to null.
6. **Idle again** - On next poll, the auto-assignment loop detects the idle bot and assigns the next pending order.

**Why they ask:** Lifecycle questions reveal whether you understand state machines and transitions, not just individual endpoints.

---

### Q22. What happens when a bot is deleted while processing an order?

**Answer:** The `DELETE /api/bots/:id` handler:
1. Checks if the bot has a `currentOrderId`.
2. If yes, updates the order: `status` back to PENDING, `botId` to null, `processingStartedAt` to null.
3. Soft-deletes the bot (`deletedAt = now`).

The order returns to the pending queue and will be picked up by another idle bot. The orphaned QStash callback will fire later but fail validation (order is no longer PROCESSING, `botId` doesn't match) and be silently discarded.

**Why they ask:** Edge-case handling during resource removal is a classic distributed systems question. Shows you handle cleanup properly.

---

### Q23. Why is bot assignment driven from the frontend rather than the backend?

**Answer:** The frontend auto-assignment loop was a pragmatic choice:
- **Serverless constraints** - Vercel functions are stateless and short-lived. There's no persistent process to run a backend assignment loop.
- **Simplicity** - The poll-then-assign pattern reuses existing infrastructure (polling + API calls). No need for a background job system.
- **Visibility** - Assignment decisions are visible in the browser's network tab for debugging.

The server-side claim endpoint still enforces all constraints via transactions - the frontend just orchestrates *when* to call it. The server is the authority; the client is the scheduler.

**Why they ask:** Tests architectural decision-making in the context of serverless constraints. Shows pragmatism over architectural purity.

---

### Q24. What is the dual completion mechanism and why does it exist?

**Answer:** Orders are completed through two independent mechanisms:

1. **QStash (Server-Authoritative)** - A delayed HTTP callback fires after 10 seconds, calling `POST /api/orders/complete`. This is persistent, survives tab closes, and is the source of truth.
2. **Client-Side Timer** - `BotProcessorService` counts down 10 seconds locally for instant UI feedback. When it hits zero, it triggers a UI update.

Both mechanisms exist because:
- QStash alone would cause a ~2 second UI delay (waiting for next poll after callback fires).
- Client timer alone wouldn't persist if the tab closes.
- Together, users see instant feedback while the server guarantees completion.

**Why they ask:** Distributed systems often need redundant mechanisms for reliability. Tests understanding of why a single approach isn't sufficient.

---

### Q25. How does the single-writer pattern work for multi-tab support?

**Answer:** `BotProcessorService` implements leader election via localStorage:

1. Each tab instance generates a unique `leaderId`.
2. Every 2 seconds, tabs check `localStorage('feedme-leader-lease')`.
3. If the lease is expired (older than 2 heartbeats) or owned by the current tab, claim leadership.
4. Only the leader tab runs `tickAllBots()` (the 100ms timer interval).
5. When a bot completes, the leader broadcasts via `BroadcastChannel` to other tabs.
6. If the leader tab closes, the lease expires and another tab takes over.

This prevents multiple tabs from ticking timers independently, which would cause duplicate completion events and UI desynchronization.

**Why they ask:** Multi-tab coordination is a real frontend challenge. Shows awareness of browser concurrency issues that most developers overlook.

---

## Resilience & Recovery

### Q26. What happens if the server crashes while an order is being processed?

**Answer:** When the server restarts, the recovery mechanism in `GET /api/orders` activates:

1. Acquires the `resumeLocks` distributed lock.
2. **Stuck bots** - Finds bots with `status=PROCESSING` but `currentOrderId=null` (meaning the order was completed but bot update failed). Resets them to IDLE.
3. **Orphaned orders** - Finds orders with `status=PROCESSING`:
   - If `processingStartedAt + 10s <= now`: Completes the order immediately and frees the bot.
   - If `processingStartedAt + 10s > now`: Reschedules a QStash callback for the remaining time with a new deduplication ID.

This ensures no order gets stuck in PROCESSING forever.

**Why they ask:** Crash recovery is what separates hobby projects from production systems. Tests your understanding of failure modes and self-healing.

---

### Q27. How do you prevent duplicate QStash callbacks from double-completing an order?

**Answer:** Three layers of protection:

1. **Deduplication ID** - Each QStash publish includes a deduplication ID (`${orderId}-${timestamp}`). QStash deduplicates within a window, preventing exact duplicates.
2. **Status check in WHERE** - The completion query uses `WHERE status = 'PROCESSING'`. If the order is already COMPLETE, the UPDATE affects 0 rows and the handler returns early.
3. **BotId validation** - The callback includes `botId`. The completion handler verifies `order.botId === callback.botId`. If the order was reclaimed by a different bot, the stale callback is rejected.

These layers make the completion endpoint **idempotent** - calling it multiple times with the same data produces the same result.

**Why they ask:** Idempotency is critical for any system with at-least-once delivery semantics. Tests understanding of distributed messaging guarantees.

---

### Q28. What if QStash itself goes down?

**Answer:** The recovery mechanism handles QStash failures:

1. If QStash is down when scheduling, the claim transaction still succeeds (order is PROCESSING).
2. On the next `GET /api/orders` poll, recovery detects the PROCESSING order.
3. If 10+ seconds have elapsed, it completes the order directly in the database.
4. If <10 seconds, it attempts to reschedule via QStash. If QStash is still down, the next recovery cycle will catch it after 10 seconds elapsed.

The client-side timer also provides a fallback - when it hits zero, the UI reflects completion even if QStash never fires.

**Why they ask:** Tests resilience thinking - what happens when your dependencies fail? Shows you don't have single points of failure.

---

### Q29. Explain the distributed lock implementation in `tryAcquireResumeLock`.

**Answer:** It's a three-step lock acquisition:

1. **Try UPDATE** - `UPDATE resume_locks SET lockedAt=now, expiresAt=now+30s WHERE id='resume_processing' AND expiresAt < now`. This atomically claims an expired lock. If 1 row updated, lock acquired.
2. **Check existence** - If 0 rows updated, SELECT the lock. If it exists and isn't expired, another process holds it. Return false.
3. **Try INSERT** - If no lock row exists, INSERT one. If this fails (race condition with another INSERT), return false.

The 30-second TTL prevents a crashed process from holding the lock forever. This pattern works for single-instance deployment where SQLite serializes writes.

**Why they ask:** Lock implementation details reveal deep understanding of concurrency primitives. The three-step approach handles edge cases that simpler approaches miss.

---

### Q30. What is the Nitro server startup recovery plugin and when does it run?

**Answer:** The `server/plugins/startup-recovery.ts` plugin hooks into Nitro's server initialization lifecycle. It runs once when the server process starts, before handling any requests. It performs the same recovery logic as the poll-based recovery:
- Finds stuck bots and resets them.
- Finds orphaned PROCESSING orders and completes or reschedules them.

This ensures that even before the first client polls, any state corruption from a previous crash is resolved. The poll-based recovery is a backup for cases where the startup plugin fails or new issues arise during operation.

**Why they ask:** Shows you think about initialization order and don't rely solely on runtime checks.

---

## Frontend & State Management

### Q31. Why TanStack Store over Redux, Zustand, or Context API?

**Answer:** TanStack Store was chosen because:
- **Framework alignment** - Already using TanStack Start and TanStack Query. Same ecosystem, consistent patterns.
- **Minimal boilerplate** - No reducers, actions types, or providers. Just a store object with state and actions.
- **Selective subscriptions** - `useStore(store, selector)` only re-renders when selected state changes.
- **localStorage persistence** - Simple to add without middleware.

Redux would be overkill for three stores. Context would cause excessive re-renders. Zustand would be fine but adds another dependency outside the TanStack ecosystem.

**Why they ask:** State management choice reveals understanding of trade-offs between simplicity and power. Tests whether you choose tools deliberately.

---

### Q32. How does the frontend handle optimistic updates?

**Answer:** The order store has `addOrder()` and `updateOrder()` methods for optimistic UI updates. When creating an order:
1. The API call fires.
2. On success, `queryClient.invalidateQueries(['orders'])` triggers a refetch.
3. The poll cycle (every 2 seconds) will also eventually catch up.

For the most part, the system relies on **poll-driven consistency** rather than optimistic updates. The 2-second poll interval is fast enough that users perceive near-instant updates. True optimistic updates (updating UI before server response) are used sparingly because the server does non-trivial work (order number allocation, priority sorting) that the client shouldn't duplicate.

**Why they ask:** Optimistic updates are a common frontend performance technique. Tests understanding of when they're appropriate vs. when they add unnecessary complexity.

---

### Q33. Explain the role-based UI behavior.

**Answer:** The `user.role` field controls what users see:

- **NORMAL** - Can create normal orders only. Cannot manage bots or clear orders.
- **VIP** - Can create VIP orders. Same restrictions as NORMAL otherwise.
- **MANAGER** - Full access: create both order types, add/remove bots, clear all orders. Sees bot management controls (+/- buttons).

Role checking is done client-side for UI display and server-side for authorization. The login endpoint returns the user's role, which the auth store persists. Components conditionally render controls based on `user.role`.

**Why they ask:** Role-based access control is a universal pattern. Tests whether authorization is enforced at both layers, not just UI hiding.

---

### Q34. How does TanStack Query's polling work and what are the retry semantics?

**Answer:** TanStack Query's `refetchInterval: 2000` creates a 2-second polling loop:
- A new fetch fires every 2 seconds regardless of whether the previous one completed.
- `staleTime` controls when cached data is considered outdated.
- On failure, TanStack Query retries 3 times with exponential backoff by default.
- While retrying, the UI shows the last successful data (no loading spinner for refetch failures).
- The `OfflineIndicator` component monitors connectivity and shows offline status.

This provides a resilient polling mechanism with graceful degradation - users always see the last known state, even during temporary network issues.

**Why they ask:** Tests understanding of the data fetching library's behavior, not just that you used it. Shows you know what happens during failure modes.

---

### Q35. How does the cooking progress animation work?

**Answer:** Each processing order has a `processingStartedAt` timestamp. The `OrderCard` component:
1. Calculates elapsed time: `Date.now() - processingStartedAt`.
2. Remaining time: `10000 - elapsed` (10 seconds total).
3. Progress percentage: `elapsed / 10000 * 100`.
4. Displays a countdown timer and progress bar.
5. Cycles cooking emojis every 800ms: fire -> frying pan -> chef -> hourglass.

The `BotDisplay` component shows the same progress from the bot's perspective using the bot store's `remainingMs` state. Both are driven by client-side timers for smooth animation, independent of the 2-second poll cycle.

**Why they ask:** Tests understanding of time-based UI rendering and the difference between server state (polling) and client state (animation).

---

## Security & Validation

### Q36. How is the QStash webhook endpoint secured?

**Answer:** The `POST /api/orders/complete` endpoint uses QStash's signature verification:

```typescript
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY
})
const isValid = await receiver.verify({
  signature: request.headers.get('upstash-signature'),
  body: rawBody
})
```

Two signing keys enable key rotation without downtime. The `Receiver` checks the `upstash-signature` header against the request body using HMAC. Invalid signatures return 403. This prevents anyone from calling the endpoint directly to complete orders.

**Why they ask:** Webhook security is a real-world concern. Unsigned webhooks are a common vulnerability. Tests whether you validate inbound requests from third-party services.

---

### Q37. What are the security weaknesses in the current authentication system?

**Answer:** The auth system has intentional simplifications for this demo:

1. **Base64 passwords** - `passwordHash` is just base64-encoded, not bcrypt/argon2. Trivially reversible.
2. **No JWT/sessions** - Auth state is stored in localStorage only. No server-side session validation on API calls.
3. **No CSRF protection** - API endpoints don't validate CSRF tokens.
4. **No rate limiting** - Login endpoint has no brute-force protection.
5. **Client-side auth only** - API routes don't verify the caller's identity. Any HTTP client can call any endpoint.

For production: bcrypt for passwords, HTTP-only session cookies, server-side session validation middleware, CSRF tokens, and rate limiting.

**Why they ask:** Self-awareness about security shortcuts shows maturity. Nobody expects production auth in a take-home, but you should know what's missing.

---

### Q38. How do you handle constraint violations at the API level?

**Answer:** A shared utility `isConstraintError()` detects SQLite constraint violations:

```typescript
const isConstraintError = (error: unknown) =>
  error instanceof Error &&
  /SQLITE_CONSTRAINT|UNIQUE constraint failed/i.test(error.message)
```

API routes wrap database operations in try/catch. On constraint violation, they return 409 Conflict with an error message. This handles cases like:
- Trying to assign a bot that's already processing.
- Duplicate order number (theoretically impossible but guarded).
- Any other unique constraint violation.

The client handles 409 gracefully - typically by refetching on the next poll cycle to get the true state.

**Why they ask:** Error handling at system boundaries is a real-world skill. Tests whether you return appropriate HTTP status codes and handle database errors gracefully.

---

### Q39. Why `onDelete: 'set null'` for foreign keys instead of cascade?

**Answer:** `SET NULL` was chosen because:
- **Preserving history** - When a user is deleted, their orders remain with `userId: null`. This preserves order history for reporting.
- **Safe bot removal** - When a bot is deleted, orders with that `botId` get `null`. The application logic then handles returning the order to PENDING.
- **No orphan cascades** - CASCADE would delete all orders when a user is deleted, which is never the correct behavior for a POS system.

The application layer handles the semantic meaning of `null` foreign keys (e.g., "this order's bot was removed") rather than relying on database-level cascading.

**Why they ask:** Foreign key strategy has real implications for data integrity. Tests understanding of referential integrity options.

---

## Scaling & Production Readiness

### Q40. What would break if you deployed this to multiple server instances?

**Answer:** Several things would fail:

1. **Resume lock** - SQLite-based locking only works within a single instance. Multiple instances would all acquire locks on their own databases (or race on a shared database without proper distributed locking).
2. **Transaction isolation** - SQLite serializes writes per-process. Multiple processes hitting the same Turso instance could have different isolation guarantees.
3. **QStash callback routing** - Callbacks hit a single URL. If load-balanced, the instance handling the callback might not have the latest state.
4. **Auto-increment sequence** - Concurrent instances could generate duplicate order numbers if not properly serialized.

**Why they ask:** Understanding scaling limits shows you know the difference between "works on my machine" and "works in production." Not every system needs to scale, but you should know where the boundaries are.

---

### Q41. How would you modify this system for horizontal scaling?

**Answer:**
1. **Database** - Move from SQLite to PostgreSQL for proper concurrent access with row-level locking.
2. **Distributed locks** - Replace `resumeLocks` table with Redis-based locks (Redlock algorithm).
3. **Message queue** - Replace QStash with a proper message queue (SQS, RabbitMQ) with consumer groups for load balancing.
4. **Bot assignment** - Use `SELECT ... FOR UPDATE SKIP LOCKED` in PostgreSQL to prevent multiple instances from claiming the same order.
5. **WebSocket gateway** - Replace polling with a WebSocket server (or use a service like Pusher/Ably) for real-time updates.
6. **Session store** - Move auth to Redis-backed sessions or JWTs for stateless auth across instances.

**Why they ask:** Shows you can think beyond the current implementation. Tests knowledge of distributed systems patterns.

---

### Q42. What monitoring and observability would you add for production?

**Answer:**
1. **Metrics** - Order throughput, bot utilization rate, average wait time per order, QStash callback latency, recovery frequency.
2. **Alerting** - Orders stuck in PROCESSING > 30 seconds, recovery lock held > 60 seconds, QStash failure rate spike.
3. **Logging** - Structured JSON logs with correlation IDs (orderId, botId) for tracing order lifecycle.
4. **Health check** - `/api/health` endpoint checking database connectivity, QStash reachability, and stuck order count.
5. **Distributed tracing** - OpenTelemetry spans across order creation -> claim -> QStash -> completion.
6. **Dashboard** - Grafana dashboard showing real-time order funnel, bot status distribution, and error rates.

**Why they ask:** Observability is what makes systems debuggable in production. Tests operational maturity.

---

### Q43. What would you change if order volume was 1000x higher?

**Answer:**
1. **Database** - PostgreSQL with read replicas. Partition orders table by date.
2. **Caching** - Redis cache for active orders. Only hit the database for writes and cache misses.
3. **Queue** - Dedicated message broker (Kafka or SQS) instead of database-as-queue.
4. **Bot assignment** - Push-based instead of poll-based. Bots subscribe to a topic; orders are published as messages.
5. **Batch operations** - Bulk status updates instead of individual queries.
6. **Frontend** - WebSocket for push updates. Virtual scrolling for large order lists. Pagination for completed orders.
7. **Order numbers** - Switch to a Redis INCR-based sequence for higher throughput than database auto-increment.

**Why they ask:** Scaling questions test whether you understand performance bottlenecks and can identify which components fail first under load.

---

## Trade-offs & Decision Making

### Q44. What's the most important trade-off you made in this system?

**Answer:** **Polling vs. real-time push.** Polling at 2-second intervals means users see updates with up to 2 seconds of delay, and the server handles many redundant requests. The trade-off was worthwhile because:

- Eliminated WebSocket complexity (connection management, reconnection, state sync).
- Enabled Vercel serverless deployment (no persistent connections needed).
- PWA offline support is simpler with polling than WebSocket reconnection.
- For a POS display, 2-second latency is imperceptible.

The alternative would have been WebSockets for instant updates, but that would require a persistent server (not serverless), connection management, and more complex error handling - all for marginal UX improvement in this context.

**Why they ask:** Every system has trade-offs. The ability to articulate them clearly and justify your choices is more valuable than the choices themselves.

---

### Q45. Why QStash instead of a simple `setTimeout` on the server?

**Answer:** `setTimeout` in a serverless environment (Vercel) doesn't work because:
- Functions have a max execution time (typically 10-60 seconds on Vercel).
- Function instances are recycled between requests.
- A `setTimeout` would be killed when the function returns.

QStash provides **persistent delayed execution**: it stores the callback externally and fires it as a new HTTP request after the delay. Even if the original server instance is gone, QStash delivers the callback to whatever instance handles it. This is essential for serverless architectures where you can't hold state between requests.

**Why they ask:** Tests understanding of serverless constraints. A common mistake is assuming serverless functions behave like long-running processes.

---

### Q46. If you could start over, what would you do differently?

**Answer:**
1. **Add tests from the start** - The system lacks automated tests. Adding Jest/Vitest tests for the claim transaction, recovery logic, and priority ordering would catch regressions.
2. **Stronger auth** - Even for a demo, using better-auth or a simple JWT system would be more representative.
3. **Server-side assignment** - Instead of client-driven bot assignment, use a Nitro cron job or QStash periodic trigger to run assignment logic server-side, removing the dependency on a browser tab being open.
4. **Type-safe API layer** - Use tRPC or a shared schema (Zod) between frontend and backend to eliminate API contract drift.
5. **Simpler state management** - The three stores (auth, order, bot) plus TanStack Query caching creates redundancy. Would consolidate to TanStack Query as the sole data layer with local-only stores for UI state.

**Why they ask:** Self-reflection and ability to improve are more valuable than perfection. Shows humility and growth mindset.

---

### Q47. Why Turso/LibSQL instead of PostgreSQL or a simpler in-memory store?

**Answer:** The assignment said "no data persistence needed," but Turso was chosen because:
- **Free tier** - Turso offers a generous free tier, making it cost-free for a demo.
- **SQLite semantics** - Familiar, simple, no connection pool management.
- **Edge deployment** - Turso supports edge replicas, aligning with Vercel's edge functions.
- **Drizzle ORM support** - First-class integration with Drizzle.

An in-memory store would lose all data on each serverless function cold start. PostgreSQL (e.g., Neon, Supabase) would also work but adds connection pooling complexity and more setup for equivalent functionality.

**Why they ask:** Database selection reveals understanding of deployment constraints and operational trade-offs.

---

### Q48. How does this system handle the "exactly once" problem for order completion?

**Answer:** It doesn't guarantee exactly-once - it implements **at-least-once delivery with idempotent processing**:

1. QStash provides at-least-once delivery (retries on failure).
2. The completion endpoint is idempotent: `UPDATE orders SET status='COMPLETE' WHERE id=? AND status='PROCESSING'`. If the order is already COMPLETE, the UPDATE affects 0 rows and returns success.
3. Recovery logic may also trigger completion for the same order. The same idempotent UPDATE prevents double-completion.

True exactly-once is impossible in distributed systems (per the Two Generals' Problem). The practical solution is always at-least-once + idempotency.

**Why they ask:** This is a fundamental distributed systems concept. Claiming "exactly once" is a red flag; understanding why it's impossible and how to work around it shows real depth.

---

### Q49. What happens if someone opens the dashboard without any bots?

**Answer:** Orders accumulate in the PENDING column. The auto-assignment loop runs but finds no idle bots, so it does nothing. When a manager later adds a bot, on the next poll cycle:
1. The bot appears in the bot fleet panel as IDLE.
2. The auto-assignment loop finds an idle bot and pending orders.
3. It calls `POST /api/bots/:id/claim` for the highest-priority order (VIP first, then oldest by order number).
4. The bot starts processing and the order moves to the PROCESSING column.

The system gracefully handles the zero-bot state without errors. Pending orders just wait.

**Why they ask:** Edge cases and empty states reveal robustness. A system that crashes with no bots is poorly designed.

---

### Q50. How would you explain this entire system to a non-technical stakeholder?

**Answer:** "This is a digital kitchen management board for McDonald's. When a customer places an order, it goes into a queue. VIP customers get priority - their orders jump ahead of regular ones. Virtual cooking bots pick up orders one at a time, cook for 10 seconds, then move to the next. Managers can add more bots during busy periods or remove them during slow times. If a bot is removed while cooking, the order goes back in the queue automatically. The board updates every 2 seconds so staff always see the current state. Everything is saved to a database, so if the system restarts, no orders are lost."

**Why they ask:** Communication with non-technical stakeholders is a critical engineering skill. If you can't explain your system simply, you may not understand it deeply enough.

---

## Bonus: Meta-Questions

These questions are about your process, not the code:

### How long did this take you?

Be honest. Interviewers appreciate transparency. If you spent extra time on polish (PWA, animations, recovery), acknowledge it and explain why.

### What would you prioritize if you only had 2 hours?

Core requirements: order CRUD, bot assignment, priority queue, 10-second timer, and the three-column UI. Skip: recovery logic, PWA, animations, soft deletes, role-based auth.

### Did you use AI assistance?

If you did, be upfront. Explain what you used it for (boilerplate, debugging, documentation) vs. what you designed yourself (architecture, recovery logic, concurrency handling). The ability to leverage AI effectively is itself a skill.
