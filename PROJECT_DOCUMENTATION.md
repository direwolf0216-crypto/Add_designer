# Project Documentation: Add Designer / Kanakkupulla

Welcome to the technical documentation for **Add Designer** (also known as *Kanakkupulla*), a modern full-stack web application tailored for studio management, print shop operations, job tracking, transaction management, and financial analytics.

---

## 1. Executive Summary

**Add Designer** is an enterprise-grade studio and print shop management SaaS built on top of **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS**, and **Prisma ORM** backed by **Neon PostgreSQL**. 

The system automates:
- **Client & Job Lifecycle Management**: Tracking bookings, print jobs, album design statuses, delivery deadlines, and inclusions.
- **Financial Analytics & Transactions**: Recording income and expenses, tracking multi-installment packages, generating PDF invoices, and visualizing revenue breakdowns.
- **Smart Alerts & Reminders**: Notifying staff about overdue jobs, pending album retouching, hot dates, and stale orders.
- **Dynamic Form Builders**: Customizable layout schemas for forms (`JOB_FORM`, `TRANSACTION_FORM`) to adjust fields dynamically without code changes.
- **Integrations**: Google Drive OAuth2 integration for cloud attachments and automated backup.

---

## 2. Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | Next.js 16.2.9 (Turbopack) | App Router, React Server Components (RSC), API Routes |
| **UI Library** | React 19.2.4 | Client & Server Components, Context API |
| **Styling** | Vanilla CSS + Tailwind CSS 3.4 | Custom CSS design tokens, Glassmorphism, Responsive design |
| **Database** | Neon PostgreSQL (Serverless) | Cloud-hosted serverless PostgreSQL |
| **ORM** | Prisma 7.8.0 | Driver Adapter: `@prisma/adapter-neon` (`PrismaNeonHttp` over HTTPS) |
| **Authentication** | NextAuth.js 4.24 | JWT Sessions, Credentials Provider, OAuth2 (Google, Google Drive) |
| **State & Fetching** | SWR 2.4 | Stale-While-Revalidate caching, optimistic updates, request deduplication |
| **Forms & Validation** | React Hook Form + Zod | Schema validation, type safety |
| **PDF Generation** | React PDF / jsPDF | Client & server-side PDF invoice generation |
| **Icons & Fonts** | Phosphor Icons / Lucide React | Modern vector icon suites |
| **UI Inspiration & MCP** | `inspo-mcp` | Model Context Protocol server providing web design inspiration, design systems, and component references for AI coding context |

---

## 3. Architecture & System Flow

```mermaid
flowchart TD
    subgraph Client Layer
        Browser[User Browser]
        SWR[SWR Data Layer & Cache]
        UI[React 19 Components / Lucide / Phosphor]
    end

    subgraph Application Server (Next.js 16)
        AppRouter[Next.js App Router]
        AuthModule[NextAuth.js Session & JWT]
        APIRoutes[RESTful API Routes /api/*]
        ServerCache[In-Memory Server Cache]
    end

    subgraph Data & Cloud Services
        Prisma[Prisma Client + PrismaNeonHttp]
        NeonDB[(Neon Cloud PostgreSQL)]
        GDrive[Google Drive API v3]
    end

    Browser -->|HTTP Requests| AppRouter
    UI <--> SWR
    SWR <-->|REST API Calls| APIRoutes
    APIRoutes --> AuthModule
    APIRoutes <--> ServerCache
    APIRoutes --> Prisma
    Prisma <-->|HTTPS / Port 443| NeonDB
    APIRoutes <-->|OAuth2 Uploads| GDrive
```

---

## 4. Directory & File Hierarchy Breakdown

```
Add designer/
├── .env                        # Environment variables (DATABASE_URL, NEXTAUTH_SECRET)
├── AGENTS.md                   # Custom agent guidelines and version compatibility rules
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind styling rules and extended theme colors
├── postcss.config.js           # PostCSS configuration
├── tsconfig.json               # TypeScript compiler configurations
├── package.json                # Project dependencies and script declarations
├── PROJECT_DOCUMENTATION.md    # Project summary, architecture, and developer guide
├── prisma/
│   ├── schema.prisma           # Prisma database schema definition (Models & Enums)
│   └── migrations/             # Database migration SQL files
├── public/                     # Static public assets (images, logos, fonts)
│   └── assets/
└── src/
    ├── app/                    # Next.js App Router directory
    │   ├── (auth)/             # Authentication route group
    │   │   ├── login/          # Login page component
    │   │   └── register/       # User registration page component
    │   ├── (main)/             # Main application route group (Protected Layout)
    │   │   ├── layout.tsx      # Main layout wrapper (Providers, Sidebar, Modals)
    │   │   ├── page.tsx        # Home redirect route (/dashboard/overview)
    │   │   ├── loading.tsx     # Suspense fallbacks and skeleton loaders
    │   │   ├── dashboard/      # Dashboard route module
    │   │   │   └── overview/   # Analytics overview page
    │   │   ├── jobs/           # Job management module
    │   │   │   ├── allJobs/    # Paginated job listing and filter view
    │   │   │   └── job-status/ # Kanban & status-based job view
    │   │   ├── transactions/   # Financial management module
    │   │   │   └── overview/   # Income & expense ledger
    │   │   ├── settings/       # System and profile settings
    │   │   └── invoice/        # Invoice view & PDF generator
    │   ├── actions.ts          # Next.js Server Actions
    │   ├── globals.css         # Main stylesheet & typography rules
    │   └── api/                # Backend API Routes
    │       ├── auth/           # NextAuth handler routes [...nextauth]
    │       ├── dashboard/      # Analytics APIs (/overview, /category-stats, /alerts)
    │       ├── jobs/           # Job CRUD APIs & status patch handlers
    │       ├── transactions/   # Financial transaction APIs & ledger aggregates
    │       ├── clients/        # Client directory APIs
    │       ├── products/       # Inventory & product order endpoints
    │       ├── users/          # Team user directory & permission management
    │       ├── banner/         # Smart notification banner endpoint
    │       ├── notifications/  # User notification and snooze handlers
    │       ├── permissions/    # Dynamic role-permission mapping
    │       ├── settings/       # System settings & layout schema builders
    │       ├── search/         # Global search API
    │       └── integrations/   # Google Drive integration endpoints
    ├── components/             # Reusable UI & Feature components
    │   ├── dashboard/          # Dashboard components (StatCards, TaskAlerts, RevenueChart)
    │   ├── jobs/               # Job components (OverdueJobBanners, JobDetailsModal)
    │   ├── layout/             # Layout components (Sidebar, TopNavigation, PageTransition)
    │   ├── providers/          # React Context Providers (SystemProvider, GlobalFormProvider)
    │   └── ui/                 # Reusable atomic UI components (Dropdowns, Pickers, Modals)
    ├── hooks/                  # Custom React Hooks (usePermissions, useMobileNav)
    └── lib/                    # Shared core utilities
        ├── auth.ts             # NextAuth.js authentication options & providers
        ├── prisma.ts           # Singleton PrismaClient initialization (PrismaNeonHttp)
        ├── uploadHelper.ts     # Client/Server file upload utilities
        ├── validations/        # Zod validation schemas (job, transaction, client)
        └── defaultLayouts.ts   # Default form layout schemas fallback
```

---

## 5. Database Schema & Data Models

The application database is structured across several key entity relationships:

```mermaid
erDiagram
    Client ||--o{ Job : "has"
    User ||--o{ Job : "creates/updates"
    Job ||--o| Order : "has"
    Job ||--o| Invoice : "generates"
    Job ||--o{ Transaction : "records"
    Invoice ||--o{ InvoiceLineItem : "contains"
    User ||--o{ Transaction : "authorizes"
    User ||--o{ Notification : "receives"
    User ||--o{ UserIntegration : "connects"
    Product ||--o{ ProductOrder : "ordered in"
    ProductOrder ||--o{ Transaction : "settled via"
```

### Core Entities Summary
1. **User**: Team members and studio owners (`ADMIN`, `STAFF`, `PHOTOGRAPHER`).
2. **Client**: Contact directory containing names, phone numbers, and job histories.
3. **Job**: Core job entity with date, location, category, status (`Confirmed`, `Pending`, `Shoot Completed`, `Delivered`, etc.), inclusions, custom data fields, and album status.
4. **Order**: Package pricing, advance paid, due balance, and multi-installment breakdowns.
5. **Transaction**: Financial ledger items (`INCOME` or `EXPENSE`), linked to Jobs or Product Orders.
6. **FormLayout**: Dynamic JSON schemas defining configurable UI form structures (`JOB_FORM`, `TRANSACTION_FORM`).
7. **Notification**: Smart system alerts, payment reminders, and stale job warnings.

---

## 6. API Layer & Caching Architecture

To achieve optimal performance across high-latency database connections, the backend utilizes a multi-tiered caching approach:

### 1. Database Connection Adapter (`PrismaNeonHttp`)
- Utilizes `@prisma/adapter-neon`'s `PrismaNeonHttp` over **HTTPS (Port 443)**.
- Avoids TCP socket pool exhaustion and connection timeouts on serverless compute endpoints.

### 2. In-Memory TTL Server Caching
- **Form Layout Schemas** (`/api/settings/layouts/[formKey]`): Cached for **5 minutes**.
- **User Directory Picklists** (`/api/users`): Cached for **30 seconds**.
- **System Settings** (`/api/settings/system`): Cached in API routes with automatic invalidation on updates.

### 3. Client-Side SWR Optimizations
- **Modal Lazy-Loading**: `JobFormModal` and `TransactionModal` SWR requests are gated (`isOpen ? url : null`) so closed modals do not trigger background queries.
- **Deduplication**: `revalidateOnFocus: false` and `dedupingInterval: 30000` applied to avoid redundant refetches during tab switching.

---

## 7. Setup & Local Development

### Prerequisites
- Node.js 20+
- npm / pnpm / yarn

### Initial Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"
   NEXTAUTH_SECRET="your-super-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. Run database migrations / push:
   ```bash
   npx prisma db push
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

---

*Documentation maintained automatically by Antigravity AI.*
