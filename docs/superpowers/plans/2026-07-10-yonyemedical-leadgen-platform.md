# Yonye Medical Internal Lead Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local internal web app where Yonye sales users create lead-generation tasks, receive 5 verified A/B customers per task, edit customer records, and manage follow-up directly in the website.

**Architecture:** Create a new modular Next.js application in `web/`. The app uses Prisma with PostgreSQL for structured data, a background task service for lead generation stages, and adapter interfaces for search/contact/email-verification APIs. The first working version includes deterministic mock adapters so the UI, scoring, quota, dedupe, customer editing, and follow-up flow can be tested before live API keys are used.

**Tech Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL, Redis/BullMQ-compatible task abstraction, Vitest, React Testing Library, Zod.

## Global Constraints

- Internal use only for Changzhou Yonye Medical Instrument Co., Ltd.
- Do not build public registration, payment, SaaS onboarding, Gmail sending, Outlook sending, Excel export, or Word export in the first version.
- Roles are `admin` and `sales`.
- Each task targets 5 valid customers.
- Each salesperson can receive at most 30 customers per day.
- Only A and B customers are delivered to users.
- A valid customer must have at least one key person with a personal work email.
- `accept-all` emails can only make a customer B-grade and must be visibly marked as risky.
- Customers without a personal work email must be rejected and replaced.
- The website must store source evidence and must not invent facts.
- Users can edit delivered customer information, contacts, notes, and follow-up status inside the website.
- Admin can view all users, tasks, customers, API usage, quality statistics, and rejection reasons.
- Company dedupe is global by normalized company name, website domain, brand name, and country/region.
- Default outreach language is English; users can choose another language.

---

## File Structure

Create a new app under `web/` so historical lead files in the project root remain untouched.

- `web/package.json`: scripts and dependencies.
- `web/tsconfig.json`: TypeScript config.
- `web/next.config.mjs`: Next.js config.
- `web/vitest.config.ts`: test runner config.
- `web/.env.example`: required local environment variables.
- `web/prisma/schema.prisma`: database schema.
- `web/prisma/seed.ts`: seed admin/sales users, Yonye products, company profile.
- `web/src/lib/db.ts`: Prisma client singleton.
- `web/src/lib/auth.ts`: local session helpers and role checks.
- `web/src/lib/quota.ts`: daily quota calculation.
- `web/src/lib/dedupe.ts`: company normalization and global dedupe.
- `web/src/lib/scoring.ts`: A/B/C lead scoring.
- `web/src/lib/outreach.ts`: personalized outreach generation.
- `web/src/lib/products.ts`: Yonye product seed definitions and keyword generation.
- `web/src/lib/evidence.ts`: evidence normalization and confidence helpers.
- `web/src/server/adapters/types.ts`: shared adapter interfaces.
- `web/src/server/adapters/mock.ts`: deterministic mock data provider.
- `web/src/server/adapters/prospeo.ts`: Prospeo adapter shell.
- `web/src/server/adapters/hunter.ts`: Hunter adapter shell.
- `web/src/server/adapters/apify.ts`: Apify adapter shell.
- `web/src/server/adapters/contactout.ts`: ContactOut adapter shell.
- `web/src/server/lead-engine/market.ts`: market research stage.
- `web/src/server/lead-engine/candidates.ts`: candidate recall stage.
- `web/src/server/lead-engine/contacts.ts`: contact enrichment and verification stage.
- `web/src/server/lead-engine/pipeline.ts`: orchestration and replacement rules.
- `web/src/app/api/auth/login/route.ts`: login endpoint.
- `web/src/app/api/tasks/route.ts`: create/list tasks.
- `web/src/app/api/tasks/[taskId]/route.ts`: task detail and progress.
- `web/src/app/api/customers/[customerId]/route.ts`: edit customer records.
- `web/src/app/api/admin/metrics/route.ts`: admin metrics.
- `web/src/app/login/page.tsx`: login UI.
- `web/src/app/tasks/new/page.tsx`: task creation UI.
- `web/src/app/tasks/[taskId]/page.tsx`: task progress and results UI.
- `web/src/app/customers/page.tsx`: customer library UI.
- `web/src/app/customers/[customerId]/page.tsx`: customer detail/edit UI.
- `web/src/app/admin/page.tsx`: admin dashboard UI.
- `web/tests/unit/*.test.ts`: unit tests for scoring, quota, dedupe, outreach, pipeline.
- `web/tests/api/*.test.ts`: route handler tests.

---

### Task 1: Scaffold Local Web App

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.mjs`
- Create: `web/vitest.config.ts`
- Create: `web/.env.example`
- Create: `web/src/app/layout.tsx`
- Create: `web/src/app/page.tsx`
- Create: `web/tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: runnable `npm run dev`, `npm test`, and `npm run typecheck` from `web/`.

- [ ] **Step 1: Create the package definition**

Create `web/package.json`:

```json
{
  "name": "yonye-lead-platform",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev --hostname 127.0.0.1",
    "build": "next build",
    "start": "next start --hostname 127.0.0.1",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "bullmq": "^5.34.2",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.468.0",
    "next": "^15.0.0",
    "prisma": "^5.22.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.1",
    "jsdom": "^25.0.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Add TypeScript and test config**

Create `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `web/next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true
};

export default nextConfig;
```

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

- [ ] **Step 3: Add environment template and smoke UI**

Create `web/.env.example`:

```bash
DATABASE_URL="postgresql://yonye:yonye@127.0.0.1:5432/yonye_leads"
SESSION_SECRET="replace-with-a-long-random-string"
PROSPEO_API_KEY=""
HUNTER_API_KEY=""
APIFY_API_KEY=""
CONTACTOUT_API_KEY=""
USE_MOCK_ADAPTERS="true"
```

Create `web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yonye Lead Platform",
  description: "Internal lead generation platform for Yonye Medical"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Create `web/src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>原研医疗内部获客系统</h1>
      <p>为业务员创建获客任务、验证关键联系人、维护客户跟进。</p>
    </main>
  );
}
```

Create `web/src/app/globals.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, "Microsoft YaHei", sans-serif;
  color: #17202a;
  background: #f6f8fb;
}

main {
  padding: 32px;
}
```

Create `web/tests/unit/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("test runner", () => {
  it("runs a smoke test", () => {
    expect("yonye").toBe("yonye");
  });
});
```

- [ ] **Step 4: Verify scaffold**

Run:

```bash
cd web
npm install
npm test
npm run typecheck
```

Expected:

```text
1 test passed
TypeScript exits with code 0
```

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/tsconfig.json web/next.config.mjs web/vitest.config.ts web/.env.example web/src web/tests
git commit -m "chore: scaffold yonye lead platform"
```

---

### Task 2: Database Schema and Seed Data

**Files:**
- Create: `web/prisma/schema.prisma`
- Create: `web/prisma/seed.ts`
- Create: `web/src/lib/db.ts`
- Create: `web/src/lib/products.ts`
- Test: `web/tests/unit/products.test.ts`

**Interfaces:**
- Produces: `yonyeProducts: ProductSeed[]`
- Produces: `buildKeywordSet(productKeys: string[], extraKeywords: string[]): string[]`
- Produces database models: `User`, `Product`, `LeadTask`, `Company`, `Contact`, `Evidence`, `OutreachLetter`, `FollowUp`, `ApiCallLog`.

- [ ] **Step 1: Write product keyword test**

Create `web/tests/unit/products.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildKeywordSet, yonyeProducts } from "@/lib/products";

describe("Yonye product knowledge", () => {
  it("includes medical, sports, wound, and orthopedic search language", () => {
    const keywords = buildKeywordSet(["kinesiology_tape", "pop_bandage"], ["Saudi importer"]);
    expect(keywords).toContain("kinesiology tape");
    expect(keywords).toContain("sports medicine");
    expect(keywords).toContain("plaster bandage");
    expect(keywords).toContain("orthopedic supplier");
    expect(keywords).toContain("Saudi importer");
  });

  it("seeds the main Yonye product families", () => {
    const keys = yonyeProducts.map((product) => product.key);
    expect(keys).toContain("surgical_tape");
    expect(keys).toContain("cohesive_bandage");
    expect(keys).toContain("wound_plaster");
    expect(keys).toContain("acne_patch");
  });
});
```

- [ ] **Step 2: Implement product knowledge**

Create `web/src/lib/products.ts`:

```ts
export type ProductSeed = {
  key: string;
  zhName: string;
  enName: string;
  family: string;
  keywords: string[];
  scenarios: string[];
};

export const yonyeProducts: ProductSeed[] = [
  {
    key: "surgical_tape",
    zhName: "医用胶带系列",
    enName: "Surgical Tape Series",
    family: "medical_tape",
    keywords: ["surgical tape", "PE tape", "non-woven tape", "silk tape", "cotton tape"],
    scenarios: ["wound care", "hospital supply", "first aid", "medical distributor"]
  },
  {
    key: "kinesiology_tape",
    zhName: "肌内效贴系列",
    enName: "Kinesiology Tape Series",
    family: "sports_medicine",
    keywords: ["kinesiology tape", "sports tape", "precut kinesiology tape", "printed kinesiology tape"],
    scenarios: ["sports medicine", "physiotherapy", "rehabilitation", "fitness recovery"]
  },
  {
    key: "cohesive_bandage",
    zhName: "自粘绷带系列",
    enName: "Cohesive Bandage Series",
    family: "bandage",
    keywords: ["cohesive bandage", "self adhesive bandage", "printed cohesive bandage"],
    scenarios: ["veterinary supply", "first aid", "sports protection", "pharmacy supply"]
  },
  {
    key: "sports_tape",
    zhName: "运动胶带系列",
    enName: "Sports Tape Series",
    family: "sports_medicine",
    keywords: ["sports tape", "athletic tape", "hockey tape", "underwrap"],
    scenarios: ["team sports", "sports medicine", "athletic training", "physical therapy"]
  },
  {
    key: "pop_bandage",
    zhName: "石膏绷带与骨科衬垫",
    enName: "POP Bandage and Orthopedic Padding",
    family: "orthopedic",
    keywords: ["plaster bandage", "POP bandage", "orthopedic padding", "PBT bandage"],
    scenarios: ["orthopedic supplier", "hospital procurement", "clinic supply", "medical wholesaler"]
  },
  {
    key: "wound_plaster",
    zhName: "创口贴系列",
    enName: "Wound Plaster Series",
    family: "wound_care",
    keywords: ["wound plaster", "band aid", "cartoon plaster", "waterproof plaster"],
    scenarios: ["pharmacy chain", "first aid brand", "retail healthcare", "private label"]
  },
  {
    key: "wound_dressing",
    zhName: "敷料贴系列",
    enName: "Wound Dressing Series",
    family: "wound_care",
    keywords: ["wound dressing", "PU dressing", "non-woven dressing", "sterile wound dressing"],
    scenarios: ["wound care", "hospital supply", "medical distributor", "surgical supply"]
  },
  {
    key: "acne_patch",
    zhName: "痘痘贴",
    enName: "Acne Patch",
    family: "personal_care",
    keywords: ["acne patch", "hydrocolloid patch", "pimple patch"],
    scenarios: ["beauty brand", "cosmetic distributor", "pharmacy chain", "e-commerce seller"]
  }
];

export function buildKeywordSet(productKeys: string[], extraKeywords: string[]): string[] {
  const selected = yonyeProducts.filter((product) => productKeys.includes(product.key));
  const values = selected.flatMap((product) => [...product.keywords, ...product.scenarios]);
  return Array.from(new Set([...values, ...extraKeywords].map((item) => item.trim()).filter(Boolean)));
}
```

- [ ] **Step 3: Create Prisma schema**

Create `web/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  admin
  sales
}

enum LeadTaskStatus {
  queued
  running
  partial
  completed
  failed
}

enum LeadGrade {
  A
  B
  C
  rejected
}

enum EmailStatus {
  valid
  accept_all
  risky
  invalid
  unknown
}

enum FollowUpStatus {
  not_contacted
  sent
  replied
  quoted
  won
  not_interested
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  role         UserRole
  createdAt    DateTime @default(now())
  tasks        LeadTask[]
  companies    Company[] @relation("OwnerCompanies")
}

model Product {
  id        String   @id @default(cuid())
  key       String   @unique
  zhName    String
  enName    String
  family    String
  keywords  String[]
  scenarios String[]
  createdAt DateTime @default(now())
}

model LeadTask {
  id              String         @id @default(cuid())
  userId          String
  user            User           @relation(fields: [userId], references: [id])
  status          LeadTaskStatus @default(queued)
  targetRegion    String
  targetCountries String[]
  productKeys     String[]
  customerTypes   String[]
  language        String         @default("English")
  extraKeywords   String[]
  targetCount     Int            @default(5)
  deliveredCount  Int            @default(0)
  searchedCount   Int            @default(0)
  rejectedCount   Int            @default(0)
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime       @default(now())
  companies       Company[]
}

model Company {
  id              String          @id @default(cuid())
  taskId          String?
  task            LeadTask?       @relation(fields: [taskId], references: [id])
  ownerId         String?
  owner           User?           @relation("OwnerCompanies", fields: [ownerId], references: [id])
  name            String
  normalizedName  String
  country         String
  region          String
  city            String?
  website         String?
  domain          String?
  brandNames      String[]
  customerType    String
  businessSummary String
  demandEvidence  String
  recommendedProducts String[]
  grade           LeadGrade
  score           Int
  scoreBreakdown  Json
  status          FollowUpStatus  @default(not_contacted)
  notes           String          @default("")
  isDelivered     Boolean         @default(false)
  rejectionReason String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  contacts        Contact[]
  evidences       Evidence[]
  letters         OutreachLetter[]
  followUps       FollowUp[]

  @@index([normalizedName, country])
  @@index([domain])
}

model Contact {
  id            String      @id @default(cuid())
  companyId     String
  company       Company     @relation(fields: [companyId], references: [id])
  name          String
  title         String
  email         String
  emailStatus   EmailStatus
  source        String
  sourceUrl     String?
  isPrimary     Boolean     @default(false)
  riskNote      String?
  createdAt     DateTime    @default(now())
}

model Evidence {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  type        String
  title       String
  url         String?
  summary     String
  collectedAt DateTime @default(now())
}

model OutreachLetter {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  subject   String
  body      String
  language  String
  createdAt DateTime @default(now())
}

model FollowUp {
  id        String         @id @default(cuid())
  companyId String
  company   Company        @relation(fields: [companyId], references: [id])
  status    FollowUpStatus
  note      String
  createdAt DateTime       @default(now())
}

model ApiCallLog {
  id          String   @id @default(cuid())
  provider    String
  endpoint    String
  status      String
  creditsUsed Int      @default(0)
  durationMs  Int
  error       String?
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 4: Add Prisma client and seed script**

Create `web/src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

Create `web/prisma/seed.ts`:

```ts
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { yonyeProducts } from "../src/lib/products";

async function main() {
  for (const product of yonyeProducts) {
    await prisma.product.upsert({
      where: { key: product.key },
      update: product,
      create: product
    });
  }

  await prisma.user.upsert({
    where: { email: "admin@cnyonye.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@cnyonye.local",
      passwordHash: await bcrypt.hash("123456", 10),
      role: "admin"
    }
  });

  await prisma.user.upsert({
    where: { email: "sales@cnyonye.local" },
    update: {},
    create: {
      name: "Sales",
      email: "sales@cnyonye.local",
      passwordHash: await bcrypt.hash("123456", 10),
      role: "sales"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 5: Verify products and schema**

Run:

```bash
cd web
npm test -- products.test.ts
npm run typecheck
```

Expected:

```text
2 tests passed
TypeScript exits with code 0
```

- [ ] **Step 6: Commit**

```bash
git add web/prisma web/src/lib/db.ts web/src/lib/products.ts web/tests/unit/products.test.ts
git commit -m "feat: add database schema and yonye product knowledge"
```

---

### Task 3: Auth, Roles, and Daily Quota

**Files:**
- Create: `web/src/lib/auth.ts`
- Create: `web/src/lib/quota.ts`
- Create: `web/src/app/api/auth/login/route.ts`
- Create: `web/src/app/login/page.tsx`
- Test: `web/tests/unit/quota.test.ts`
- Test: `web/tests/unit/auth.test.ts`

**Interfaces:**
- Produces: `canCreateTask(deliveredToday: number, requestedCount: number): { allowed: boolean; remaining: number; reason?: string }`
- Produces: `requireRole(userRole: UserRole, allowed: UserRole[]): void`

- [ ] **Step 1: Write quota and role tests**

Create `web/tests/unit/quota.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canCreateTask } from "@/lib/quota";

describe("daily customer quota", () => {
  it("allows a 5-customer task when the user has room", () => {
    expect(canCreateTask(25, 5)).toEqual({ allowed: true, remaining: 5 });
  });

  it("blocks a task above the 30-customer daily limit", () => {
    expect(canCreateTask(30, 5)).toEqual({
      allowed: false,
      remaining: 0,
      reason: "今日额度已用完"
    });
  });
});
```

Create `web/tests/unit/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { requireRole } from "@/lib/auth";

describe("role checks", () => {
  it("allows admin to access admin pages", () => {
    expect(() => requireRole("admin", ["admin"])).not.toThrow();
  });

  it("blocks sales from admin pages", () => {
    expect(() => requireRole("sales", ["admin"])).toThrow("权限不足");
  });
});
```

- [ ] **Step 2: Implement quota and role helpers**

Create `web/src/lib/quota.ts`:

```ts
const DAILY_CUSTOMER_LIMIT = 30;

export function canCreateTask(deliveredToday: number, requestedCount: number) {
  const remaining = Math.max(DAILY_CUSTOMER_LIMIT - deliveredToday, 0);
  if (requestedCount > remaining) {
    return {
      allowed: false,
      remaining,
      reason: remaining === 0 ? "今日额度已用完" : `今日剩余额度不足，仅剩 ${remaining} 家`
    };
  }

  return { allowed: true, remaining: remaining - requestedCount };
}
```

Create `web/src/lib/auth.ts`:

```ts
import type { UserRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export function requireRole(userRole: UserRole, allowed: UserRole[]) {
  if (!allowed.includes(userRole)) {
    throw new Error("权限不足");
  }
}

export function isAdmin(user: SessionUser) {
  return user.role === "admin";
}
```

- [ ] **Step 3: Add login endpoint shell**

Create `web/src/app/api/auth/login/route.ts`:

```ts
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "邮箱或密码格式不正确" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}
```

Create `web/src/app/login/page.tsx`:

```tsx
export default function LoginPage() {
  return (
    <main>
      <h1>登录原研获客系统</h1>
      <form>
        <label>
          邮箱
          <input name="email" type="email" defaultValue="sales@cnyonye.local" />
        </label>
        <label>
          密码
          <input name="password" type="password" defaultValue="123456" />
        </label>
        <button type="submit">登录</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Verify**

Run:

```bash
cd web
npm test -- quota.test.ts auth.test.ts
npm run typecheck
```

Expected:

```text
4 tests passed
TypeScript exits with code 0
```

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/auth.ts web/src/lib/quota.ts web/src/app/api/auth web/src/app/login web/tests/unit/quota.test.ts web/tests/unit/auth.test.ts
git commit -m "feat: add local auth helpers and quota rules"
```

---

### Task 4: Lead Scoring, Dedupe, and Outreach Rules

**Files:**
- Create: `web/src/lib/dedupe.ts`
- Create: `web/src/lib/evidence.ts`
- Create: `web/src/lib/scoring.ts`
- Create: `web/src/lib/outreach.ts`
- Test: `web/tests/unit/dedupe.test.ts`
- Test: `web/tests/unit/evidence.test.ts`
- Test: `web/tests/unit/scoring.test.ts`
- Test: `web/tests/unit/outreach.test.ts`

**Interfaces:**
- Produces: `normalizeCompanyName(name: string): string`
- Produces: `extractDomain(url?: string | null): string | null`
- Produces: `normalizeEvidence(input: EvidenceInput): EvidenceOutput`
- Produces: `scoreLead(input: ScoreLeadInput): ScoreLeadResult`
- Produces: `buildOutreachLetter(input: OutreachInput): { subject: string; body: string }`

- [ ] **Step 1: Write scoring and outreach tests**

Create `web/tests/unit/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scoreLead } from "@/lib/scoring";

describe("lead scoring", () => {
  it("grades a strong importer with verified owner email as A", () => {
    const result = scoreLead({
      productFit: 90,
      demandEvidenceCount: 3,
      hasImportEvidence: true,
      hasKeyPerson: true,
      bestEmailStatus: "valid",
      companySizeFit: 85
    });
    expect(result.grade).toBe("A");
    expect(result.deliverable).toBe(true);
  });

  it("grades accept-all email as B at best", () => {
    const result = scoreLead({
      productFit: 90,
      demandEvidenceCount: 3,
      hasImportEvidence: true,
      hasKeyPerson: true,
      bestEmailStatus: "accept_all",
      companySizeFit: 85
    });
    expect(result.grade).toBe("B");
    expect(result.riskNotes).toContain("邮箱为 accept-all，只能作为 B 类客户");
  });

  it("rejects companies without personal work email", () => {
    const result = scoreLead({
      productFit: 80,
      demandEvidenceCount: 2,
      hasImportEvidence: false,
      hasKeyPerson: true,
      bestEmailStatus: "unknown",
      companySizeFit: 80
    });
    expect(result.deliverable).toBe(false);
    expect(result.grade).toBe("rejected");
  });
});
```

Create `web/tests/unit/dedupe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractDomain, normalizeCompanyName } from "@/lib/dedupe";

describe("company dedupe", () => {
  it("normalizes company suffix and punctuation", () => {
    expect(normalizeCompanyName("Alpha Medical Trading Co., Ltd.")).toBe("alpha medical trading");
  });

  it("extracts comparable website domain", () => {
    expect(extractDomain("https://www.example.com/products")).toBe("example.com");
  });
});
```

Create `web/tests/unit/outreach.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildOutreachLetter } from "@/lib/outreach";

describe("outreach letter generation", () => {
  it("mentions customer-specific business and Yonye factory strengths", () => {
    const letter = buildOutreachLetter({
      companyName: "Alpha Medical",
      businessSummary: "distributes wound care and sports medicine products in Saudi Arabia",
      recommendedProducts: ["kinesiology tape", "cohesive bandage"],
      contactName: "Mr. Ahmed",
      language: "English"
    });
    expect(letter.subject).toContain("Alpha Medical");
    expect(letter.body).toContain("distributes wound care and sports medicine products");
    expect(letter.body).toContain("Changzhou, China");
    expect(letter.body).toContain("ISO13485, CE and FDA");
    expect(letter.body).toContain("factory audit");
  });
});
```

Create `web/tests/unit/evidence.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeEvidence } from "@/lib/evidence";

describe("evidence normalization", () => {
  it("keeps source title, URL, type and summary for auditability", () => {
    const evidence = normalizeEvidence({
      type: "customs",
      title: "China export shipment signal",
      url: "https://example.com/customs",
      summary: "Buyer imported adhesive bandage products from China."
    });

    expect(evidence.type).toBe("customs");
    expect(evidence.url).toBe("https://example.com/customs");
    expect(evidence.summary).toContain("adhesive bandage");
  });
});
```

- [ ] **Step 2: Implement dedupe and evidence helpers**

Create `web/src/lib/dedupe.ts`:

```ts
const suffixPattern = /\b(co|company|ltd|limited|llc|inc|corp|corporation|trading|est|establishment)\b\.?/gi;

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(suffixPattern, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
```

Create `web/src/lib/evidence.ts`:

```ts
export type EvidenceInput = {
  type: string;
  title: string;
  url?: string;
  summary: string;
};

export type EvidenceOutput = EvidenceInput & {
  collectedAt: string;
};

export function normalizeEvidence(input: EvidenceInput): EvidenceOutput {
  return {
    type: input.type.trim(),
    title: input.title.trim(),
    url: input.url?.trim(),
    summary: input.summary.trim(),
    collectedAt: new Date().toISOString()
  };
}
```

- [ ] **Step 3: Implement scoring**

Create `web/src/lib/scoring.ts`:

```ts
import type { EmailStatus, LeadGrade } from "@prisma/client";

export type ScoreLeadInput = {
  productFit: number;
  demandEvidenceCount: number;
  hasImportEvidence: boolean;
  hasKeyPerson: boolean;
  bestEmailStatus: EmailStatus;
  companySizeFit: number;
};

export type ScoreLeadResult = {
  score: number;
  grade: LeadGrade;
  deliverable: boolean;
  riskNotes: string[];
  breakdown: Record<string, number | boolean | string>;
};

export function scoreLead(input: ScoreLeadInput): ScoreLeadResult {
  const riskNotes: string[] = [];
  const emailScore =
    input.bestEmailStatus === "valid" ? 25 : input.bestEmailStatus === "accept_all" ? 12 : 0;
  const demandScore = Math.min(input.demandEvidenceCount * 8, 24) + (input.hasImportEvidence ? 8 : 0);
  const score = Math.round(input.productFit * 0.25 + input.companySizeFit * 0.18 + demandScore + emailScore);

  if (!input.hasKeyPerson || !["valid", "accept_all"].includes(input.bestEmailStatus)) {
    return {
      score,
      grade: "rejected",
      deliverable: false,
      riskNotes: ["缺少关键负责人个人工作邮箱"],
      breakdown: { ...input, emailScore, demandScore }
    };
  }

  if (input.bestEmailStatus === "accept_all") {
    riskNotes.push("邮箱为 accept-all，只能作为 B 类客户");
  }

  const grade: LeadGrade =
    input.bestEmailStatus === "valid" && score >= 80 && input.demandEvidenceCount >= 2 ? "A" : "B";

  return {
    score,
    grade: input.bestEmailStatus === "accept_all" ? "B" : grade,
    deliverable: true,
    riskNotes,
    breakdown: { ...input, emailScore, demandScore }
  };
}
```

- [ ] **Step 4: Implement outreach copy builder**

Create `web/src/lib/outreach.ts`:

```ts
export type OutreachInput = {
  companyName: string;
  businessSummary: string;
  recommendedProducts: string[];
  contactName?: string;
  language: string;
};

export function buildOutreachLetter(input: OutreachInput) {
  const greeting = input.contactName ? `Dear ${input.contactName},` : "Dear Friend,";
  const products = input.recommendedProducts.join(", ");

  return {
    subject: `Possible cooperation with ${input.companyName} on medical and sports tape products`,
    body: `${greeting}

I noticed that ${input.companyName} ${input.businessSummary}. Based on this focus, I thought our ${products} may be relevant to your current product range or future sourcing plans.

We are Yonye Medical Instrument (Changzhou) Co., Ltd., a manufacturer located in Changzhou, China. We produce medical tapes, kinesiology tapes, cohesive bandages, elastic bandages, wound dressings, wound plasters and related adhesive products. Our factory can support OEM/ODM packaging, stable quality control, competitive factory-direct pricing and flexible delivery arrangements.

For quality assurance, we hold ISO13485, CE and FDA-related qualifications. If needed, we would also be glad to arrange a factory audit or show our production process, so your team can evaluate us with confidence before cooperation.

I will attach our PDF catalog for your reference. If any items match your purchasing plan, may I know which product categories, sizes or packaging styles you are currently looking for?

Best regards,
Ark
Yonye Medical Instrument (Changzhou) Co., Ltd.`
  };
}
```

- [ ] **Step 5: Verify**

Run:

```bash
cd web
npm test -- scoring.test.ts dedupe.test.ts evidence.test.ts outreach.test.ts
npm run typecheck
```

Expected:

```text
9 tests passed
TypeScript exits with code 0
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/dedupe.ts web/src/lib/evidence.ts web/src/lib/scoring.ts web/src/lib/outreach.ts web/tests/unit
git commit -m "feat: add lead scoring dedupe and outreach rules"
```

---

### Task 5: Adapter Interfaces and Mock Lead Data

**Files:**
- Create: `web/src/server/adapters/types.ts`
- Create: `web/src/server/adapters/mock.ts`
- Create: `web/src/server/adapters/prospeo.ts`
- Create: `web/src/server/adapters/hunter.ts`
- Create: `web/src/server/adapters/apify.ts`
- Create: `web/src/server/adapters/contactout.ts`
- Test: `web/tests/unit/adapters.test.ts`

**Interfaces:**
- Produces: `LeadDataAdapter`
- Produces: `createAdapterSet(): AdapterSet`

- [ ] **Step 1: Write adapter contract test**

Create `web/tests/unit/adapters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMockAdapterSet } from "@/server/adapters/mock";

describe("mock adapter set", () => {
  it("returns candidates and verified contacts with source evidence", async () => {
    const adapters = createMockAdapterSet();
    const candidates = await adapters.search.searchCompanies({
      region: "Middle East",
      countries: ["Saudi Arabia"],
      keywords: ["kinesiology tape", "medical distributor"],
      customerTypes: ["distributor"]
    });

    expect(candidates.length).toBeGreaterThanOrEqual(5);
    expect(candidates[0].sourceUrl).toContain("https://");

    const contacts = await adapters.contacts.findContacts(candidates[0]);
    expect(contacts[0].emailStatus).toMatch(/valid|accept_all/);
    expect(contacts[0].source).toBeTruthy();
  });
});
```

- [ ] **Step 2: Define adapter types**

Create `web/src/server/adapters/types.ts`:

```ts
import type { EmailStatus } from "@prisma/client";

export type CompanySearchInput = {
  region: string;
  countries: string[];
  keywords: string[];
  customerTypes: string[];
};

export type CandidateCompany = {
  name: string;
  country: string;
  region: string;
  city?: string;
  website?: string;
  customerType: string;
  businessSummary: string;
  source: string;
  sourceUrl: string;
  demandSignals: string[];
};

export type FoundContact = {
  name: string;
  title: string;
  email: string;
  emailStatus: EmailStatus;
  source: string;
  sourceUrl?: string;
  isPrimary: boolean;
  riskNote?: string;
};

export type SearchAdapter = {
  searchCompanies(input: CompanySearchInput): Promise<CandidateCompany[]>;
};

export type ContactAdapter = {
  findContacts(company: CandidateCompany): Promise<FoundContact[]>;
};

export type AdapterSet = {
  search: SearchAdapter;
  contacts: ContactAdapter;
};
```

- [ ] **Step 3: Implement mock adapters**

Create `web/src/server/adapters/mock.ts`:

```ts
import type { AdapterSet, CandidateCompany, CompanySearchInput, FoundContact } from "./types";

const mockCompanies: CandidateCompany[] = [
  {
    name: "Arabian Medical Supplies Co.",
    country: "Saudi Arabia",
    region: "Middle East",
    city: "Riyadh",
    website: "https://arabian-medical.example",
    customerType: "distributor",
    businessSummary: "distributes wound care, orthopedic and rehabilitation supplies in Saudi Arabia",
    source: "Mock industry directory",
    sourceUrl: "https://example.com/arabian-medical",
    demandSignals: ["wound care catalog", "orthopedic supplies", "imports medical consumables"]
  },
  {
    name: "Gulf Sports Medicine Trading",
    country: "Saudi Arabia",
    region: "Middle East",
    city: "Jeddah",
    website: "https://gulf-sports-med.example",
    customerType: "sports medicine distributor",
    businessSummary: "supplies physiotherapy clinics and sports medicine retailers",
    source: "Mock search result",
    sourceUrl: "https://example.com/gulf-sports-med",
    demandSignals: ["kinesiology tape product page", "physiotherapy channel"]
  },
  {
    name: "Riyadh First Aid Wholesale",
    country: "Saudi Arabia",
    region: "Middle East",
    city: "Riyadh",
    website: "https://riyadh-first-aid.example",
    customerType: "wholesaler",
    businessSummary: "wholesales first aid kits, bandages and wound plasters",
    source: "Mock B2B directory",
    sourceUrl: "https://example.com/riyadh-first-aid",
    demandSignals: ["first aid wholesale", "bandage category"]
  },
  {
    name: "Mena Rehab Products",
    country: "United Arab Emirates",
    region: "Middle East",
    city: "Dubai",
    website: "https://mena-rehab.example",
    customerType: "rehabilitation supplier",
    businessSummary: "serves rehabilitation centers with tapes, braces and therapy supplies",
    source: "Mock social page",
    sourceUrl: "https://example.com/mena-rehab",
    demandSignals: ["rehabilitation supplier", "sports tape posts"]
  },
  {
    name: "Jeddah Pharmacy Supply Network",
    country: "Saudi Arabia",
    region: "Middle East",
    city: "Jeddah",
    website: "https://jeddah-pharmacy.example",
    customerType: "pharmacy supplier",
    businessSummary: "supplies pharmacies with wound care and personal care consumables",
    source: "Mock company database",
    sourceUrl: "https://example.com/jeddah-pharmacy",
    demandSignals: ["pharmacy supply", "wound plaster category", "acne patch category"]
  }
];

export function createMockAdapterSet(): AdapterSet {
  return {
    search: {
      async searchCompanies(input: CompanySearchInput) {
        return mockCompanies.filter((company) => {
          const countryOk = input.countries.length === 0 || input.countries.includes(company.country);
          const keywordText = `${company.businessSummary} ${company.demandSignals.join(" ")}`.toLowerCase();
          const keywordOk = input.keywords.some((keyword) => keywordText.includes(keyword.toLowerCase().split(" ")[0]));
          return countryOk || keywordOk;
        });
      }
    },
    contacts: {
      async findContacts(company: CandidateCompany): Promise<FoundContact[]> {
        const domain = company.website?.replace(/^https?:\/\//, "") ?? "example.com";
        return [
          {
            name: company.name.includes("Sports") ? "Omar Hassan" : "Ahmed Saleh",
            title: company.name.includes("Sports") ? "Managing Director" : "General Manager",
            email: company.name.includes("Pharmacy") ? `fatima.almutairi@${domain}` : company.name.includes("Sports") ? `omar.hassan@${domain}` : `ahmed.saleh@${domain}`,
            emailStatus: company.name.includes("Pharmacy") ? "accept_all" : "valid",
            source: "Mock Prospeo + Hunter verification",
            sourceUrl: company.sourceUrl,
            isPrimary: true,
            riskNote: company.name.includes("Pharmacy") ? "accept-all domain, confirm before outreach" : undefined
          }
        ];
      }
    }
  };
}
```

- [ ] **Step 4: Add live adapter shells**

Create `web/src/server/adapters/prospeo.ts`:

```ts
export function getProspeoConfig() {
  return {
    enabled: Boolean(process.env.PROSPEO_API_KEY),
    apiKey: process.env.PROSPEO_API_KEY ?? ""
  };
}
```

Create `web/src/server/adapters/hunter.ts`:

```ts
export function getHunterConfig() {
  return {
    enabled: Boolean(process.env.HUNTER_API_KEY),
    apiKey: process.env.HUNTER_API_KEY ?? ""
  };
}
```

Create `web/src/server/adapters/apify.ts`:

```ts
export function getApifyConfig() {
  return {
    enabled: Boolean(process.env.APIFY_API_KEY),
    apiKey: process.env.APIFY_API_KEY ?? ""
  };
}
```

Create `web/src/server/adapters/contactout.ts`:

```ts
export function getContactOutConfig() {
  return {
    enabled: Boolean(process.env.CONTACTOUT_API_KEY),
    apiKey: process.env.CONTACTOUT_API_KEY ?? ""
  };
}
```

- [ ] **Step 5: Verify**

Run:

```bash
cd web
npm test -- adapters.test.ts
npm run typecheck
```

Expected:

```text
1 test passed
TypeScript exits with code 0
```

- [ ] **Step 6: Commit**

```bash
git add web/src/server/adapters web/tests/unit/adapters.test.ts
git commit -m "feat: add lead data adapter contracts"
```

---

### Task 6: Lead Pipeline and Replacement Rules

**Files:**
- Create: `web/src/server/lead-engine/market.ts`
- Create: `web/src/server/lead-engine/candidates.ts`
- Create: `web/src/server/lead-engine/contacts.ts`
- Create: `web/src/server/lead-engine/pipeline.ts`
- Test: `web/tests/unit/pipeline.test.ts`

**Interfaces:**
- Produces: `runLeadPipeline(input: RunLeadPipelineInput, adapters: AdapterSet): Promise<PipelineResult>`

- [ ] **Step 1: Write pipeline test**

Create `web/tests/unit/pipeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMockAdapterSet } from "@/server/adapters/mock";
import { runLeadPipeline } from "@/server/lead-engine/pipeline";

describe("lead pipeline", () => {
  it("returns 5 deliverable A/B customers with contacts and outreach", async () => {
    const result = await runLeadPipeline(
      {
        region: "Middle East",
        countries: ["Saudi Arabia"],
        productKeys: ["kinesiology_tape", "cohesive_bandage", "wound_plaster"],
        customerTypes: ["distributor", "wholesaler", "sports medicine distributor"],
        language: "English",
        extraKeywords: ["Saudi importer"],
        targetCount: 5
      },
      createMockAdapterSet()
    );

    expect(result.delivered).toHaveLength(5);
    expect(result.delivered.every((lead) => ["A", "B"].includes(lead.grade))).toBe(true);
    expect(result.delivered.every((lead) => lead.contacts.length >= 1)).toBe(true);
    expect(result.delivered.every((lead) => lead.outreach.body.includes("Changzhou, China"))).toBe(true);
    expect(result.rejected.every((lead) => lead.reason.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement market summary**

Create `web/src/server/lead-engine/market.ts`:

```ts
import { buildKeywordSet } from "@/lib/products";

export function buildMarketResearchSummary(input: {
  region: string;
  countries: string[];
  productKeys: string[];
  customerTypes: string[];
  extraKeywords: string[];
}) {
  const keywords = buildKeywordSet(input.productKeys, input.extraKeywords);
  return {
    summary: `${input.region} market research focuses on ${input.customerTypes.join(", ")} using product, scenario, customer type and customs-related keywords.`,
    keywords,
    buyerConcerns: ["certifications", "factory-direct price", "stable delivery", "OEM/ODM packaging", "factory audit"]
  };
}
```

- [ ] **Step 3: Implement contact qualification helper**

Create `web/src/server/lead-engine/contacts.ts`:

```ts
import type { FoundContact } from "@/server/adapters/types";

export function selectBestEmailStatus(contacts: FoundContact[]) {
  if (contacts.some((contact) => contact.emailStatus === "valid")) return "valid";
  if (contacts.some((contact) => contact.emailStatus === "accept_all")) return "accept_all";
  if (contacts.some((contact) => contact.emailStatus === "risky")) return "risky";
  if (contacts.some((contact) => contact.emailStatus === "unknown")) return "unknown";
  return "invalid";
}

export function hasKeyPerson(contacts: FoundContact[]) {
  const pattern = /owner|founder|ceo|general manager|managing director|procurement|purchasing|sourcing|product manager|category manager/i;
  return contacts.some((contact) => pattern.test(contact.title));
}
```

- [ ] **Step 4: Implement pipeline orchestration**

Create `web/src/server/lead-engine/pipeline.ts`:

```ts
import { extractDomain, normalizeCompanyName } from "@/lib/dedupe";
import { buildOutreachLetter } from "@/lib/outreach";
import { scoreLead } from "@/lib/scoring";
import type { AdapterSet, CandidateCompany, FoundContact } from "@/server/adapters/types";
import { buildMarketResearchSummary } from "./market";
import { hasKeyPerson, selectBestEmailStatus } from "./contacts";

export type RunLeadPipelineInput = {
  region: string;
  countries: string[];
  productKeys: string[];
  customerTypes: string[];
  language: string;
  extraKeywords: string[];
  targetCount: number;
};

export type PipelineDeliveredLead = CandidateCompany & {
  normalizedName: string;
  domain: string | null;
  contacts: FoundContact[];
  grade: "A" | "B";
  score: number;
  scoreBreakdown: Record<string, number | boolean | string>;
  riskNotes: string[];
  recommendedProducts: string[];
  outreach: { subject: string; body: string };
};

export type PipelineRejectedLead = {
  company: CandidateCompany;
  reason: string;
};

export type PipelineResult = {
  marketSummary: ReturnType<typeof buildMarketResearchSummary>;
  searchedCount: number;
  delivered: PipelineDeliveredLead[];
  rejected: PipelineRejectedLead[];
};

function estimateProductFit(company: CandidateCompany) {
  const text = `${company.businessSummary} ${company.demandSignals.join(" ")}`.toLowerCase();
  if (/kinesiology|sports|wound|bandage|orthopedic|first aid|pharmacy/.test(text)) return 88;
  return 58;
}

function estimateCompanySizeFit(company: CandidateCompany) {
  return /network|wholesale|trading|supplies|distributor|supplier/i.test(company.name + company.customerType) ? 82 : 65;
}

export async function runLeadPipeline(input: RunLeadPipelineInput, adapters: AdapterSet): Promise<PipelineResult> {
  const marketSummary = buildMarketResearchSummary(input);
  const candidates = await adapters.search.searchCompanies({
    region: input.region,
    countries: input.countries,
    keywords: marketSummary.keywords,
    customerTypes: input.customerTypes
  });

  const delivered: PipelineDeliveredLead[] = [];
  const rejected: PipelineRejectedLead[] = [];
  const seen = new Set<string>();

  for (const company of candidates) {
    if (delivered.length >= input.targetCount) break;

    const normalizedName = normalizeCompanyName(company.name);
    const domain = extractDomain(company.website);
    const dedupeKey = `${normalizedName}:${domain ?? ""}:${company.country}`;
    if (seen.has(dedupeKey)) {
      rejected.push({ company, reason: "重复公司" });
      continue;
    }
    seen.add(dedupeKey);

    const contacts = await adapters.contacts.findContacts(company);
    const score = scoreLead({
      productFit: estimateProductFit(company),
      demandEvidenceCount: company.demandSignals.length,
      hasImportEvidence: company.demandSignals.some((signal) => /import/i.test(signal)),
      hasKeyPerson: hasKeyPerson(contacts),
      bestEmailStatus: selectBestEmailStatus(contacts),
      companySizeFit: estimateCompanySizeFit(company)
    });

    if (!score.deliverable || !["A", "B"].includes(score.grade)) {
      rejected.push({ company, reason: score.riskNotes.join("; ") || "评分不足" });
      continue;
    }

    const recommendedProducts = marketSummary.keywords.slice(0, 3);
    const outreach = buildOutreachLetter({
      companyName: company.name,
      businessSummary: company.businessSummary,
      recommendedProducts,
      contactName: contacts[0]?.name,
      language: input.language
    });

    delivered.push({
      ...company,
      normalizedName,
      domain,
      contacts,
      grade: score.grade as "A" | "B",
      score: score.score,
      scoreBreakdown: score.breakdown,
      riskNotes: score.riskNotes,
      recommendedProducts,
      outreach
    });
  }

  return {
    marketSummary,
    searchedCount: candidates.length,
    delivered,
    rejected
  };
}
```

Create `web/src/server/lead-engine/candidates.ts`:

```ts
export function rejectionReasonForMissingContact() {
  return "未找到关键负责人个人工作邮箱，按规则淘汰并替换";
}
```

- [ ] **Step 5: Verify**

Run:

```bash
cd web
npm test -- pipeline.test.ts
npm run typecheck
```

Expected:

```text
1 test passed
TypeScript exits with code 0
```

- [ ] **Step 6: Commit**

```bash
git add web/src/server/lead-engine web/tests/unit/pipeline.test.ts
git commit -m "feat: add lead generation pipeline"
```

---

### Task 7: Task and Customer API Routes

**Files:**
- Create: `web/src/app/api/tasks/route.ts`
- Create: `web/src/app/api/tasks/[taskId]/route.ts`
- Create: `web/src/app/api/customers/[customerId]/route.ts`
- Test: `web/tests/api/task-contract.test.ts`

**Interfaces:**
- Produces: `POST /api/tasks`
- Produces: `GET /api/tasks/:taskId`
- Produces: `PATCH /api/customers/:customerId`

- [ ] **Step 1: Write route schema test**

Create `web/tests/api/task-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CreateTaskSchema, UpdateCustomerSchema } from "@/app/api/tasks/route";

describe("API contracts", () => {
  it("accepts a valid task payload", () => {
    const parsed = CreateTaskSchema.safeParse({
      userId: "user_1",
      targetRegion: "Middle East",
      targetCountries: ["Saudi Arabia"],
      productKeys: ["kinesiology_tape"],
      customerTypes: ["distributor"],
      language: "English",
      extraKeywords: ["Saudi importer"]
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects customer update without editable fields", () => {
    const parsed = UpdateCustomerSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Implement task route schemas and create endpoint**

Create `web/src/app/api/tasks/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { canCreateTask } from "@/lib/quota";
import { prisma } from "@/lib/db";

export const CreateTaskSchema = z.object({
  userId: z.string().min(1),
  targetRegion: z.string().min(1),
  targetCountries: z.array(z.string()).default([]),
  productKeys: z.array(z.string()).min(1),
  customerTypes: z.array(z.string()).min(1),
  language: z.string().default("English"),
  extraKeywords: z.array(z.string()).default([])
});

export const UpdateCustomerSchema = z
  .object({
    name: z.string().min(1).optional(),
    businessSummary: z.string().min(1).optional(),
    notes: z.string().optional(),
    status: z.enum(["not_contacted", "sent", "replied", "quoted", "won", "not_interested"]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "至少需要一个可更新字段");

export async function POST(request: Request) {
  const parsed = CreateTaskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "任务参数不完整" }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deliveredToday = await prisma.company.count({
    where: {
      ownerId: parsed.data.userId,
      isDelivered: true,
      createdAt: { gte: today }
    }
  });

  const quota = canCreateTask(deliveredToday, 5);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason, remaining: quota.remaining }, { status: 429 });
  }

  const task = await prisma.leadTask.create({
    data: {
      userId: parsed.data.userId,
      targetRegion: parsed.data.targetRegion,
      targetCountries: parsed.data.targetCountries,
      productKeys: parsed.data.productKeys,
      customerTypes: parsed.data.customerTypes,
      language: parsed.data.language,
      extraKeywords: parsed.data.extraKeywords,
      targetCount: 5,
      status: "queued"
    }
  });

  return NextResponse.json({ taskId: task.id, status: task.status, remaining: quota.remaining });
}
```

- [ ] **Step 3: Implement task detail and customer update routes**

Create `web/src/app/api/tasks/[taskId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const task = await prisma.leadTask.findUnique({
    where: { id: taskId },
    include: {
      companies: {
        include: {
          contacts: true,
          evidences: true,
          letters: true
        }
      }
    }
  });

  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  return NextResponse.json({ task });
}
```

Create `web/src/app/api/customers/[customerId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { UpdateCustomerSchema } from "@/app/api/tasks/route";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  const parsed = UpdateCustomerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "客户更新内容不正确" }, { status: 400 });
  }

  const customer = await prisma.company.update({
    where: { id: customerId },
    data: parsed.data
  });

  return NextResponse.json({ customer });
}
```

- [ ] **Step 4: Verify**

Run:

```bash
cd web
npm test -- task-contract.test.ts
npm run typecheck
```

Expected:

```text
2 tests passed
TypeScript exits with code 0
```

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api web/tests/api/task-contract.test.ts
git commit -m "feat: add task and customer API contracts"
```

---

### Task 8: Website UI for Task Creation, Results, and Customer Editing

**Files:**
- Create: `web/src/app/tasks/new/page.tsx`
- Create: `web/src/app/tasks/[taskId]/page.tsx`
- Create: `web/src/app/customers/page.tsx`
- Create: `web/src/app/customers/[customerId]/page.tsx`
- Create: `web/src/components/customer-card.tsx`
- Create: `web/src/components/contact-table.tsx`
- Test: `web/tests/unit/customer-card.test.tsx`

**Interfaces:**
- Produces reusable `CustomerCard` component.
- Produces `ContactTable` component that visibly marks `accept_all` risk.

- [ ] **Step 1: Write customer card test**

Create `web/tests/unit/customer-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CustomerCard } from "@/components/customer-card";

describe("CustomerCard", () => {
  it("shows grade, evidence, contact risk, and edit link", () => {
    render(
      <CustomerCard
        customer={{
          id: "c1",
          name: "Arabian Medical Supplies Co.",
          country: "Saudi Arabia",
          customerType: "distributor",
          grade: "B",
          score: 76,
          demandEvidence: "wound care catalog; import signal",
          recommendedProducts: ["kinesiology tape"],
          contacts: [{ name: "Ahmed Saleh", title: "General Manager", email: "owner@example.com", emailStatus: "accept_all" }]
        }}
      />
    );

    expect(screen.getByText("Arabian Medical Supplies Co.")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText(/accept-all/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "编辑客户" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement customer card**

Create `web/src/components/customer-card.tsx`:

```tsx
import Link from "next/link";

type CardContact = {
  name: string;
  title: string;
  email: string;
  emailStatus: string;
};

type CustomerCardProps = {
  customer: {
    id: string;
    name: string;
    country: string;
    customerType: string;
    grade: string;
    score: number;
    demandEvidence: string;
    recommendedProducts: string[];
    contacts: CardContact[];
  };
};

export function CustomerCard({ customer }: CustomerCardProps) {
  const risky = customer.contacts.some((contact) => contact.emailStatus === "accept_all");
  return (
    <article className="customer-card">
      <header>
        <h2>{customer.name}</h2>
        <strong>{customer.grade}</strong>
      </header>
      <p>{customer.country} · {customer.customerType} · {customer.score}分</p>
      <p>{customer.demandEvidence}</p>
      <p>推荐产品：{customer.recommendedProducts.join(", ")}</p>
      {risky ? <p className="risk">邮箱为 accept-all，请谨慎确认后开发。</p> : null}
      <Link href={`/customers/${customer.id}`}>编辑客户</Link>
    </article>
  );
}
```

Create `web/src/components/contact-table.tsx`:

```tsx
type Contact = {
  name: string;
  title: string;
  email: string;
  emailStatus: string;
  source: string;
};

export function ContactTable({ contacts }: { contacts: Contact[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>联系人</th>
          <th>职位</th>
          <th>邮箱</th>
          <th>验证状态</th>
          <th>来源</th>
        </tr>
      </thead>
      <tbody>
        {contacts.map((contact) => (
          <tr key={`${contact.email}-${contact.name}`}>
            <td>{contact.name}</td>
            <td>{contact.title}</td>
            <td>{contact.email}</td>
            <td>{contact.emailStatus === "accept_all" ? "accept-all 风险" : contact.emailStatus}</td>
            <td>{contact.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Implement page shells**

Create `web/src/app/tasks/new/page.tsx`:

```tsx
import { yonyeProducts } from "@/lib/products";

export default function NewTaskPage() {
  return (
    <main>
      <h1>创建获客任务</h1>
      <form>
        <label>
          目标地区
          <input name="targetRegion" defaultValue="Middle East" />
        </label>
        <label>
          目标国家/地区
          <input name="targetCountries" defaultValue="Saudi Arabia" />
        </label>
        <fieldset>
          <legend>产品</legend>
          {yonyeProducts.map((product) => (
            <label key={product.key}>
              <input type="checkbox" name="productKeys" value={product.key} />
              {product.zhName} / {product.enName}
            </label>
          ))}
        </fieldset>
        <p>每次任务交付 5 家有效客户；每人每天最多 30 家。</p>
        <button type="submit">开始搜索</button>
      </form>
    </main>
  );
}
```

Create `web/src/app/tasks/[taskId]/page.tsx`:

```tsx
export default function TaskResultPage({ params }: { params: { taskId: string } }) {
  return (
    <main>
      <h1>任务结果</h1>
      <p>任务编号：{params.taskId}</p>
      <p>这里展示市场调研、搜索进度、已交付客户、淘汰原因和开发信。</p>
    </main>
  );
}
```

Create `web/src/app/customers/page.tsx`:

```tsx
export default function CustomersPage() {
  return (
    <main>
      <h1>我的客户库</h1>
      <p>这里展示当前业务员已开发客户，可按状态、等级、国家和产品筛选。</p>
    </main>
  );
}
```

Create `web/src/app/customers/[customerId]/page.tsx`:

```tsx
export default function CustomerDetailPage({ params }: { params: { customerId: string } }) {
  return (
    <main>
      <h1>客户详情与编辑</h1>
      <p>客户编号：{params.customerId}</p>
      <p>这里编辑客户信息、联系人、备注和跟进状态，并查看来源证据和开发信。</p>
    </main>
  );
}
```

- [ ] **Step 4: Verify**

Run:

```bash
cd web
npm test -- customer-card.test.tsx
npm run typecheck
```

Expected:

```text
1 test passed
TypeScript exits with code 0
```

- [ ] **Step 5: Commit**

```bash
git add web/src/app/tasks web/src/app/customers web/src/components web/tests/unit/customer-card.test.tsx
git commit -m "feat: add lead task and customer management UI"
```

---

### Task 9: Admin Dashboard and API Usage Logs

**Files:**
- Create: `web/src/app/admin/page.tsx`
- Create: `web/src/app/api/admin/metrics/route.ts`
- Create: `web/src/lib/admin-metrics.ts`
- Test: `web/tests/unit/admin-metrics.test.ts`

**Interfaces:**
- Produces: `buildAdminMetrics(input: AdminMetricInput): AdminMetricOutput`

- [ ] **Step 1: Write admin metrics test**

Create `web/tests/unit/admin-metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAdminMetrics } from "@/lib/admin-metrics";

describe("admin metrics", () => {
  it("summarizes quality and API usage", () => {
    const metrics = buildAdminMetrics({
      taskCount: 4,
      deliveredCount: 20,
      rejectedCount: 11,
      apiCreditsUsed: 87,
      failedApiCalls: 2
    });

    expect(metrics.validCustomerRate).toBe("64.5%");
    expect(metrics.averageCreditsPerDeliveredCustomer).toBe("4.35");
    expect(metrics.alerts).toContain("存在 2 次接口失败，需要检查供应商或余额");
  });
});
```

- [ ] **Step 2: Implement metrics helper and route**

Create `web/src/lib/admin-metrics.ts`:

```ts
export type AdminMetricInput = {
  taskCount: number;
  deliveredCount: number;
  rejectedCount: number;
  apiCreditsUsed: number;
  failedApiCalls: number;
};

export function buildAdminMetrics(input: AdminMetricInput) {
  const totalReviewed = input.deliveredCount + input.rejectedCount;
  const validRate = totalReviewed === 0 ? 0 : (input.deliveredCount / totalReviewed) * 100;
  const creditsPerLead = input.deliveredCount === 0 ? 0 : input.apiCreditsUsed / input.deliveredCount;
  const alerts = input.failedApiCalls > 0 ? [`存在 ${input.failedApiCalls} 次接口失败，需要检查供应商或余额`] : [];

  return {
    taskCount: input.taskCount,
    deliveredCount: input.deliveredCount,
    rejectedCount: input.rejectedCount,
    validCustomerRate: `${validRate.toFixed(1)}%`,
    averageCreditsPerDeliveredCustomer: creditsPerLead.toFixed(2),
    alerts
  };
}
```

Create `web/src/app/api/admin/metrics/route.ts`:

```ts
import { NextResponse } from "next/server";
import { buildAdminMetrics } from "@/lib/admin-metrics";
import { prisma } from "@/lib/db";

export async function GET() {
  const [taskCount, deliveredCount, rejectedCount, apiLogs, failedApiCalls] = await Promise.all([
    prisma.leadTask.count(),
    prisma.company.count({ where: { isDelivered: true } }),
    prisma.company.count({ where: { grade: "rejected" } }),
    prisma.apiCallLog.findMany({ select: { creditsUsed: true } }),
    prisma.apiCallLog.count({ where: { status: "failed" } })
  ]);

  const apiCreditsUsed = apiLogs.reduce((sum, log) => sum + log.creditsUsed, 0);
  return NextResponse.json(buildAdminMetrics({ taskCount, deliveredCount, rejectedCount, apiCreditsUsed, failedApiCalls }));
}
```

Create `web/src/app/admin/page.tsx`:

```tsx
export default function AdminPage() {
  return (
    <main>
      <h1>管理员后台</h1>
      <section>
        <h2>任务与质量统计</h2>
        <p>查看任务数量、交付客户、淘汰客户、接口失败和平均获客成本。</p>
      </section>
      <section>
        <h2>系统设置</h2>
        <p>维护产品库、公司卖点、PDF目录、额度、评分和去重规则。</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run:

```bash
cd web
npm test -- admin-metrics.test.ts
npm run typecheck
```

Expected:

```text
1 test passed
TypeScript exits with code 0
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/admin-metrics.ts web/src/app/api/admin web/src/app/admin web/tests/unit/admin-metrics.test.ts
git commit -m "feat: add admin metrics dashboard"
```

---

### Task 10: End-to-End Local Runbook and Final Verification

**Files:**
- Create: `web/README.md`
- Modify: `web/package.json`
- Test: all existing tests.

**Interfaces:**
- Produces local run instructions for non-technical internal testing.

- [ ] **Step 1: Create local README**

Create `web/README.md`:

```md
# 原研医疗内部获客系统

## 本地启动

1. 复制 `.env.example` 为 `.env`。
2. 设置 `DATABASE_URL`、`SESSION_SECRET` 和需要使用的 API Key。
3. 首次测试可保留 `USE_MOCK_ADAPTERS="true"`，先验证网站流程。
4. 安装依赖：`npm install`
5. 生成数据库客户端：`npm run prisma:generate`
6. 迁移数据库：`npm run prisma:migrate`
7. 写入初始账号和产品：`npm run prisma:seed`
8. 启动网站：`npm run dev`

## 初始账号

- 管理员：`admin@cnyonye.local` / `123456`
- 业务员：`sales@cnyonye.local` / `123456`

## 首版不包含

- 自动发送邮件。
- Excel/Word 导出。
- 对外用户注册和收费。

## 有效客户规则

- 每次任务交付 5 家客户。
- 每名业务员每天最多 30 家客户。
- 只交付 A/B 类客户。
- 必须有关键负责人个人工作邮箱。
- accept-all 邮箱只能作为 B 类并标注风险。
- 没有个人工作邮箱的公司必须淘汰并替换。
```

- [ ] **Step 2: Run full verification**

Run:

```bash
cd web
npm test
npm run typecheck
npm run build
```

Expected:

```text
All tests pass
TypeScript exits with code 0
Next.js build completes successfully
```

- [ ] **Step 3: Manual acceptance test**

Run:

```bash
cd web
npm run dev
```

Expected:

```text
Local: http://127.0.0.1:3000
```

Open the site and verify:

- Login page appears.
- Task creation page shows Yonye product families.
- New task form states 5 customers per task and 30 per day.
- Result page has space for market research, customers, contacts, evidence and outreach.
- Customer page has editable notes and follow-up status.
- Admin page shows quality and API monitoring sections.

- [ ] **Step 4: Commit**

```bash
git add web/README.md web/package.json
git commit -m "docs: add local runbook for lead platform"
```

---

## Self-Review Checklist

- Spec coverage: Tasks cover local website, login/roles, product knowledge, quota, scoring, dedupe, contacts, email verification states, customer editing, follow-up statuses, admin metrics, and no Excel/Word in MVP.
- Scope control: Live Prospeo/Hunter/Apify/ContactOut calls are adapter shells in this plan; full production integration should be a follow-up plan after the local MVP proves the workflow.
- Data integrity: Scoring and pipeline explicitly reject companies without a key person personal work email.
- Risk marking: `accept_all` is forced to B-grade and shown in UI.
- User editing: customer detail page and API route support website-side editing.
- Git note: The current workspace has an empty `.git` directory, so commit steps are written for future execution but may fail until Git is initialized or repaired.
