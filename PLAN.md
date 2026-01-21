# FeedMe Order Controller - TanStack Start + Drizzle + Turso Implementation Plan

## Requirements Analysis

### Original Assignment Requirements (Frontend Track)

1. **New Normal Order Button** - Creates a new order that appears in "PENDING" area
2. **New VIP Order Button** - Creates VIP order that queues before all normal orders but after existing VIP orders
3. **Unique Order Numbers** - Each order has a unique, incrementing number
4. **Bot Management (+ Bot)** - Creates a bot that:
   - Processes orders from PENDING area
   - Takes 10 seconds per order
   - Moves completed orders to "COMPLETE" area
   - Continues processing if more orders exist
5. **Bot Idle State** - Bot becomes IDLE when no orders in PENDING
6. **Bot Removal (- Bot)** - Removes newest bot:
   - If processing, order returns to PENDING
   - Order can be picked up by another bot
7. **User Interface** - Must demonstrate all requirements with interactive UI
8. **Public Deployment** - Must be deployed to publicly accessible URL

### Submission Requirements Coverage (Frontend Track)

1. **Working prototype** - Implement a functioning UI that satisfies all requirements
2. **Public URL** - Deploy to a publicly accessible URL (Vercel)
3. **Documentation** - Provide setup/run notes and the deployed URL in `README.md`
4. **Source code** - Ensure the repository contains the full implementation (not just the plan)
5. **Verification** - Record manual test steps and outcomes in `README.md`
6. **Interview readiness** - Bring the working prototype and codebase to the interview

### Original Assignment Requirements (Backend Track)

1. **CLI Application** - Implement in Go or Node.js
2. **Scripts** - Provide `scripts/test.sh`, `scripts/build.sh`, `scripts/run.sh`
3. **Result Output** - CLI writes output to `scripts/result.txt`
4. **Timestamps** - Output includes `HH:MM:SS` timestamps for order completion
5. **GitHub Flow** - Submit PR and ensure checks pass

### Submission Requirements Coverage (Backend Track)

1. **Working CLI prototype** - Implement required order controller behavior
2. **Scripts & output** - `scripts/*.sh` and `scripts/result.txt` are functional
3. **Documentation** - Update `README.md` with run steps and output notes
4. **Verification** - Manual test checklist in `TEST.md` updated with results
5. **PR readiness** - Repo is ready for PR with passing checks

### User-Specific Requirements

1. **Framework**: TanStack Start (full-stack React framework with SSR)
2. **UI Library**: shadcn/ui for pre-built components
3. **ORM**: Drizzle ORM
4. **Database**: Turso (LibSQL) - credentials already in `.env`
5. **Primary Keys**: UUID7 for all tables (time-ordered, sortable)
6. **Foreign Keys**: Proper FK constraints with cascades
7. **Soft Delete**: `deleted_at` timestamp, cascade rules that preserve orders when user deleted
8. **Unique Constraints**: Consider soft delete (unique only on non-deleted records)
9. **CLI**: Use TanStack CLI to bootstrap project
10. **PWA**: Progressive Web App with offline capabilities
11. **Offline Sync**: Local data processing with sync to Turso when online
12. **Bot Processing**: Client-side (browser-based using React timers)
13. **Deployment**: Vercel
14. **State Management**: TanStack Store (persisted) for auth/shared variables
15. **API Calls**: TanStack Query (React Query) for server state
16. **Forms**: TanStack Form for form handling
17. **Validation**: Zod for schema validation
18. **Auth**: Sample users with roles (NORMAL, VIP, MANAGER, BOT)
19. **Hybrid Mode**: Some features work offline, others require online

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TanStack Start App                       │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React + Tailwind)                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   PENDING   │  │ PROCESSING  │  │  COMPLETE   │            │
│  │   Orders    │  │   Orders    │  │   Orders    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  Controls: [New Normal] [New VIP] [+ Bot] [- Bot]              │
│  Bots Display: [Bot 1: IDLE/PROCESSING] [Bot 2: IDLE...]        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TanStack Start Server Layer                   │
│  - API Routes for CRUD operations                               │
│  - Real-time updates via SSE or polling                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Offline Sync Layer                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  IndexedDB (Dexie.js) - Local First Storage               │ │
│  │  - Orders (pending, processing, complete)                  │ │
│  │  - Bots (status, current order)                           │ │
│  │  - Sync Queue (operations pending sync)                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Sync Manager (BroadcastChannel + Service Worker)               │
│  - Conflict resolution (last-write-wins)                        │
│  - Exponential backoff for retry                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Drizzle ORM                                │
│  - Schema definitions (orders, bots)                            │
│  - Queries with SQLite dialect for Turso                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Turso Database (LibSQL)                       │
│  Remote cloud database (always accessible when online)           │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema (Drizzle)

**Key Design Decisions:**
- **UUID7** for all primary keys (time-ordered, sortable, conflict-resistant)
- **Soft Delete** via `deleted_at` - records are never truly deleted
- **Proper Cascades**: Bot delete → order becomes unassigned; User delete → orders preserved
- **Unique with Soft Delete**: Partial unique index excludes deleted records

```sql
-- Table: users
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- UUID7
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL, -- 'NORMAL', 'VIP', 'MANAGER', 'BOT'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME, -- Soft delete timestamp
  UNIQUE(username, deleted_at) -- Unique only for non-deleted (deleted_at IS NULL)
);

-- Partial unique index for username (excludes soft-deleted)
CREATE UNIQUE INDEX idx_users_username_active ON users(username) WHERE deleted_at IS NULL;

-- Table: orders
CREATE TABLE orders (
  id TEXT PRIMARY KEY, -- UUID7
  order_number INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'NORMAL' or 'VIP'
  status TEXT NOT NULL, -- 'PENDING', 'PROCESSING', 'COMPLETE'
  user_id TEXT, -- Foreign key to user who created order (nullable if user deleted)
  bot_id TEXT, -- Foreign key to bot currently processing (nullable if bot deleted)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME, -- Soft delete timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL, -- Preserve orders if user deleted
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL, -- Unassign if bot deleted
  UNIQUE(order_number, deleted_at) -- Unique only for non-deleted
);

-- Partial unique index for order_number (excludes soft-deleted)
CREATE UNIQUE INDEX idx_orders_order_number_active ON orders(order_number) WHERE deleted_at IS NULL;

-- Index for order queue (VIP first, then by order_number) - excludes deleted
CREATE INDEX idx_order_queue ON orders(status, type DESC, order_number) WHERE deleted_at IS NULL;

-- Table: bots
CREATE TABLE bots (
  id TEXT PRIMARY KEY, -- UUID7
  status TEXT NOT NULL, -- 'IDLE', 'PROCESSING'
  current_order_id TEXT, -- Foreign key to order being processed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME, -- Soft delete timestamp
  FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL -- Unassign if order deleted
);

-- Seed data for sample users (UUID7 formatted)
INSERT INTO users (id, username, password_hash, role) VALUES
  ('01912345678900000000000000000001', 'normal_user', 'hash...', 'NORMAL'),
  ('01912345678900000000000000000002', 'vip_user', 'hash...', 'VIP'),
  ('01912345678900000000000000000003', 'manager', 'hash...', 'MANAGER'),
  ('01912345678900000000000000000004', 'bot', 'hash...', 'BOT');
```

**Cascade Rules Summary:**
| Relationship | On Delete | Behavior |
|--------------|-----------|----------|
| user_id → orders | SET NULL | Orders preserved, user_id set to NULL |
| bot_id → orders | SET NULL | Orders become unassigned, stay in PENDING |
| current_order_id → bots | SET NULL | Bot's current_order_id set to NULL |

**Soft Delete Handling:**
- All `WHERE` clauses must include `deleted_at IS NULL`
- Unique constraints use partial indexes excluding soft-deleted
- "Delete" operations set `deleted_at = NOW()` instead of actual DELETE

## Offline Sync Strategy

### Online vs Offline Capabilities

| Feature | Offline Capable | Notes |
|---------|----------------|-------|
| View orders (PENDING/PROCESSING/COMPLETE) | ✅ Yes | Read from IndexedDB cache |
| Create new orders | ✅ Yes | Queued for sync, appears immediately |
| Add/Remove bots | ✅ Yes | Local state, syncs when online |
| Bot processing (10-sec timer) | ✅ Yes | Runs locally, syncs progress |
| User login | ⚠️ Partial | Cached credentials, but auth requires online |
| Multi-user sync | ❌ No | Requires online for real-time collaboration |

### Local-First Approach with Sync

1. **Write Path**:
   - UI writes to IndexedDB immediately (optimistic update)
   - Operation added to sync queue
   - Background worker processes sync queue when online
   - On success: mark synced, remove from queue
   - On failure: keep in queue for retry with exponential backoff

2. **Read Path**:
   - UI reads from IndexedDB (fast, always available)
   - TanStack Query manages server state with cache
   - Periodic background sync from Turso when online
   - Merge strategy: server wins for conflicts

3. **Sync Queue Entries**:
   ```typescript
   type SyncOperation = {
     id: string;
     type: 'CREATE' | 'UPDATE' | 'DELETE';
     entity: 'user' | 'order' | 'bot';
     payload: any;
     timestamp: number;
     retryCount: number;
   }
   ```

4. **Conflict Resolution**:
   - Orders: Server-side order_number is source of truth
   - Bot processing state: Last write wins based on updated_at
   - User auth: Server always wins

## Implementation Plan

### Phase 1: Project Setup & Infrastructure

1. **Bootstrap TanStack Start project**
   ```bash
   npx create-tanstack-start@latest feedme-order-controller
   ```
   - Select TypeScript, Tailwind CSS, Drizzle ORM options
   - Configure for PWA (Vite PWA plugin)

2. **Install Additional Dependencies**
   - **UI**: `shadcn-ui` (components)
   - **UUID7**: `uuid7` (or `uuid` with custom v7 function)
   - **Forms**: `@tanstack/form-core`, `@tanstack/react-form`
   - **Validation**: `zod`
   - **Storage**: `dexie` (IndexedDB)
   - **PWA**: `vite-plugin-pwa`

3. **Setup shadcn/ui**
   - Initialize: `npx shadcn@latest init`
   - Add components: button, card, input, label, badge, progress
   - Configure with Tailwind CSS (already part of TanStack Start)

4. **Configure Drizzle with Turso**
   - Install: `drizzle-orm`, `@libsql/client`
   - Create `app/db/schema.ts` with users, orders, and bots tables
   - Use UUID7 for all primary keys
   - Add `deleted_at` for soft delete
   - Configure proper FK cascades (SET NULL to preserve orders)
   - Create `app/db/index.ts` for Turso connection
   - Add `.env.local` support for Turso credentials
   - Create seed script for sample users with UUID7 IDs

5. **Setup TanStack Store for Auth**
   - Install: `@tanstack/store`
   - Create `app/store/auth.ts` for user authentication state
   - Create `app/store/order.ts` for shared order state
   - Create `app/store/bot.ts` for shared bot state
   - Configure persistence middleware

6. **Setup PWA**
   - Install `vite-plugin-pwa`
   - Configure service worker for offline caching
   - Add manifest.json for installability

7. **Setup Offline Storage**
   - Install `dexie` (IndexedDB wrapper)
   - Create `app/db/offline.ts` for local storage schema
   - Create sync manager `app/lib/sync-manager.ts`

### Phase 2: Core Data Layer

1. **Create API Routes (TanStack Start file-based routing)**
   - `app/api/auth/login/route.ts` - POST for login
   - `app/api/orders/route.ts` - GET, POST
   - `app/api/orders/[id]/route.ts` - PATCH, DELETE
   - `app/api/bots/route.ts` - GET, POST
   - `app/api/bots/[id]/route.ts` - PATCH, DELETE
   - `app/api/sync/route.ts` - POST for client sync

2. **Implement Drizzle Queries**
   - Create query functions in `app/db/queries.ts`
   - Order queue query: VIP first, then by order_number
   - Bot status queries with joins

3. **Implement TanStack Query Hooks**
   - `app/hooks/api/orders.ts` - useOrders, useCreateOrder, useUpdateOrder
   - `app/hooks/api/bots.ts` - useBots, useCreateBot, useRemoveBot
   - `app/hooks/api/auth.ts` - useLogin, useLogout
   - Configure for offline support with `persistQueryClient`

4. **Implement Client-Side Bot Processing Logic**
   - Create `app/lib/bot-processor.ts` using React hooks (useEffect, useState)
   - Bots run on client that created them using setInterval
   - 10-second timer per order
   - Auto-assign orders from PENDING when bot becomes IDLE
   - Sync progress to server in real-time

### Phase 3: Frontend Components

1. **Login Page (TanStack Form + Zod)**
   - TanStack Form for form state management
   - Zod schemas for validation (username, password)
   - Pre-filled credentials for demo (normal_user, vip_user, manager)
   - Role-based UI after login
   - Validation schemas:
     ```typescript
     // app/lib/schemas/auth.ts
     import { z } from 'zod';

     export const loginSchema = z.object({
       username: z.string().min(1, 'Username required'),
       password: z.string().min(1, 'Password required'),
     });
     ```

2. **Layout Component**
   - Header with title and user info/logout
   - Three-column grid: PENDING | PROCESSING | COMPLETE
   - Control panel at bottom

3. **Order Cards**
   - Display order number, type, status
   - VIP orders visually distinct (gold badge)
   - Animation when moving between areas

4. **Bot Display**
   - Show each bot with status
   - Visual indicator when processing (progress bar/timer)
   - IDLE state clearly shown

5. **Control Buttons**
   - "New Normal Order" - creates normal order
   - "New VIP Order" - creates VIP order (only for VIP users)
   - "+ Bot" - adds new bot (only for MANAGER role)
   - "- Bot" - removes newest bot (only for MANAGER role)
   - Each button triggers optimistic UI update via TanStore Store + TanStack Query

### Phase 4: Offline Sync Implementation

1. **Sync Manager**
   - Detect online/offline status
   - Queue operations when offline
   - Process queue when online
   - Exponential backoff for failed syncs

2. **Background Sync**
   - Service worker sync event
   - Periodic polling for server changes
   - Merge server data with local IndexedDB

3. **UI Indicators**
   - Show "Offline Mode" badge when disconnected
   - Show sync status indicator (syncing/synced/pending)
   - Disable features that require server when offline

### Phase 5: Testing & Deployment

1. **Testing**
   - Manual testing of all user flows
   - Offline mode testing (DevTools Network throttling)
   - Sync conflict scenarios
   - Multiple tab testing (BroadcastChannel)

2. **Deployment**
   - Deploy to Vercel (recommended for TanStack Start)
   - Configure environment variables
   - Test deployed application
   - Verify PWA installability

3. **Documentation & Submission Artifacts**
   - Update `README.md` with:
     - Public deployment URL
     - Local dev setup and run steps
     - Summary of implemented requirements
     - Manual test checklist results
   - Add screenshots or short GIFs if helpful (optional)
   - Ensure repository contains all source code and config

---

## Backend CLI Implementation Plan (Node.js)

### Phase B1: CLI Skeleton & Scripts

1. **Project setup**
   - Initialize Node.js project (TypeScript optional)
   - Add `scripts/test.sh`, `scripts/build.sh`, `scripts/run.sh` (already present but will be wired)
2. **CLI entry**
   - Create `src/index.js` (or `src/index.ts`)
   - Parse CLI args if needed (defaults are fine)
3. **Output target**
   - Write all CLI output to `scripts/result.txt`
   - Use a helper logger that prefixes timestamps in `HH:MM:SS`

### Phase B2: Core Order Controller Logic

1. **Data structures**
   - In-memory queues for VIP and Normal
   - Bots array with status, current order, and timer handle
2. **Order model**
   - Fields: orderNumber, type (VIP/NORMAL), status (PENDING/PROCESSING/COMPLETE)
   - Order numbers increment globally
3. **Queue rules**
   - VIP orders go ahead of all normal orders, behind existing VIP
   - Normal orders append to normal queue
4. **Bot behavior**
   - + Bot: create and immediately attempt to process next pending
   - - Bot: remove newest bot, return its current order to PENDING
   - Each bot processes one order at a time, 10 seconds per order

### Phase B3: Simulation Runner

1. **Scenario setup**
   - Create a deterministic scenario: multiple normal/VIP orders and bot changes
   - Ensure it covers requirements (VIP priority, bot removal, idle state)
2. **Execution**
   - Tick scheduler manages bot timers
   - Write state transitions to `scripts/result.txt` with timestamps
3. **Completion**
   - All orders reach COMPLETE
   - Bots end IDLE

### Phase B4: Scripts & Tests

1. **scripts/build.sh**
   - If TypeScript: compile to `dist/`
   - If plain JS: no-op or lint (keep it simple)
2. **scripts/run.sh**
   - Run CLI and produce `scripts/result.txt`
3. **scripts/test.sh**
   - Minimal unit tests for queue logic and bot removal behavior

### Phase B5: Documentation

1. **README updates**
   - CLI run instructions
   - Describe `scripts/result.txt` content and timestamp format
2. **TEST.md**
   - Mark backend checks as completed when verified

## File Structure

```
feedme-order-controller/
├── app/
│   ├── routes/
│   │   ├── index.tsx              # Main order management UI (requires auth)
│   │   ├── login.tsx              # Login page
│   │   └── api/
│   │       ├── auth/
│   │       │   └── login/
│   │       │       └── route.ts   # POST (login)
│   │       ├── orders/
│   │       │   ├── route.ts       # GET (list), POST (create)
│   │       │   └── [id]/route.ts  # PATCH, DELETE
│   │       ├── bots/
│   │       │   ├── route.ts       # GET (list), POST (create)
│   │       │   └── [id]/route.ts  # PATCH, DELETE
│   │       └── sync/
│   │           └── route.ts       # POST (sync operations)
│   ├── db/
│   │   ├── schema.ts              # Drizzle schema (users, orders, bots)
│   │   ├── index.ts               # Turso connection
│   │   ├── offline.ts             # IndexedDB (Dexie) schema
│   │   ├── queries.ts             # Query functions
│   │   └── seed.ts                # Seed script for sample users
│   ├── store/
│   │   ├── auth.ts                # TanStack Store for auth state (persisted)
│   │   ├── order.ts               # TanStack Store for order state
│   │   └── bot.ts                 # TanStack Store for bot state
│   ├── hooks/
│   │   └── api/
│   │       ├── orders.ts          # TanStack Query hooks for orders
│   │       ├── bots.ts            # TanStack Query hooks for bots
│   │       └── auth.ts            # TanStack Query hooks for auth
│   ├── lib/
│   │   ├── sync-manager.ts        # Offline sync logic
│   │   ├── bot-processor.ts       # Client-side bot order processing
│   │   ├── uuid7.ts               # UUID7 utility function
│   │   └── schemas/
│   │       ├── auth.ts            # Zod validation schemas for auth
│   │       ├── order.ts           # Zod validation schemas for orders
│   │       └── bot.ts             # Zod validation schemas for bots
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── badge.tsx
│   │   │   └── progress.tsx
│   │   ├── OrderCard.tsx          # Order display component
│   │   ├── BotDisplay.tsx         # Bot status component
│   │   ├── ControlPanel.tsx       # Buttons
│   │   ├── OfflineIndicator.tsx   # Connection status
│   │   └── LoginForm.tsx          # Login form (TanStack Form)
│   └── styles/
│       └── globals.css
├── public/
│   ├── manifest.json              # PWA manifest
│   └── icons/                     # PWA icons
├── drizzle.config.ts
├── drizzle.seed.ts                # Seed script entry point
├── vite.config.ts                 # With PWA plugin
├── tailwind.config.ts
├── package.json
├── .env                           # Turso credentials
└── tsconfig.json
```

## Verification Steps

1. **Functional Requirements**
   - [ ] Login works with sample users (normal_user, vip_user, manager)
   - [ ] Normal orders appear in PENDING
   - [ ] VIP orders queue before normal orders
   - [ ] Order numbers are unique and increasing
   - [ ] + Bot creates idle bot (MANAGER only)
   - [ ] Bot picks up order after 10 seconds (client-side timer)
   - [ ] Completed orders move to COMPLETE
   - [ ] - Bot removes bot, returns order to PENDING (MANAGER only)
   - [ ] Idle bot shows IDLE status
   - [ ] Deleting user does NOT delete their orders (orders preserved with NULL user_id)
   - [ ] Deleting bot unassigns orders (orders have NULL bot_id, stay in PENDING)
   - [ ] Soft delete: deleted records not shown in queries
   - [ ] All primary keys are UUID7 format

2. **PWA Requirements**
   - [ ] Service worker registered
   - [ ] App works offline (can view cached data)
   - [ ] App is installable (shows install prompt)
   - [ ] Syncs data when connection restored
   - [ ] TanStack Store persists across page reloads
   - [ ] TanStack Query cache persists with persistQueryClient

3. **Auth & Roles**
   - [ ] Sample users seeded in database
   - [ ] Login page functional
   - [ ] Role-based UI (VIP users see VIP button, MANAGER sees bot controls)
   - [ ] Protected routes redirect to login

4. **Deployment**
   - [ ] Deployed to Vercel publicly accessible URL
   - [ ] Turso database connection works
   - [ ] Environment variables configured correctly in Vercel

## Key Implementation Notes

1. **Client-Side Bot Processing**: Bots are managed by the browser tab that created them. If the tab closes, the bot stops. This is a simplification for the demo.

2. **TanStack Store vs Query**:
   - **Store**: For client-side shared state (auth, UI state)
   - **Query**: For server state (orders, bots from API)
   - Both persist for offline support

3. **UUID7 Primary Keys**: All tables use UUID7 (time-ordered, sortable) which provides:
   - Distributed ID generation without conflicts
   - Natural ordering by creation time
   - Better than auto-increment for offline/sync scenarios

4. **Soft Delete Implementation**:
   - All queries must include `WHERE deleted_at IS NULL`
   - "Delete" operations set `deleted_at = NOW()` instead of DELETE
   - Unique constraints use partial indexes excluding soft-deleted records
   - Allows recovery and audit trail

5. **Foreign Key Cascades**:
   - User delete → orders preserved (user_id set to NULL)
   - Bot delete → orders become unassigned (bot_id set to NULL)
   - Order delete → bot's current_order_id set to NULL

6. **Order Queue Logic**: The database query for "next order" will select VIP orders first, then normal orders, ordered by order_number.

7. **Real-time Updates**: TanStack Query with `refetchInterval` will poll for updates every 1-2 seconds for smooth UI across multiple tabs.

8. **Sync Simplification**: For this prototype, we'll use a simple last-write-wins strategy. Complex conflict resolution can be added later if needed.

9. **shadcn/ui Components**: Pre-built, accessible components that work with Tailwind CSS. Copy-paste approach, fully customizable.

10. **Vercel Deployment**: TanStack Start is optimized for Vercel with edge functions. The `DATABASE_URL` and `DB_PASS` environment variables must be configured in Vercel dashboard.
