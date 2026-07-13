import { describe, expect, it, vi } from "vitest";
import {
  buildCompanyCreateData,
  filterExistingCompanies,
  processLeadTask,
  taskStatusForDeliveredCount
} from "@/server/tasks/process-task";
import type { AdapterSet, CandidateCompany, FoundContact } from "@/server/adapters/types";
import type { PipelineDeliveredLead, PipelineResult } from "@/server/lead-engine/pipeline";

const task = {
  id: "task_1",
  userId: "user_1",
  targetRegion: "Middle East",
  targetCountries: ["Saudi Arabia"],
  productKeys: ["kinesiology_tape"],
  customerTypes: ["distributor"],
  language: "English",
  extraKeywords: ["Saudi importer"],
  targetCount: 5
};

function candidate(overrides: Partial<CandidateCompany> = {}): CandidateCompany {
  return {
    name: "Arabian Medical Supplies Co.",
    country: "Saudi Arabia",
    region: "Middle East",
    city: "Riyadh",
    website: "https://arabian-medical.example",
    customerType: "medical distributor",
    businessSummary: "medical distributor of wound care and rehabilitation supplies",
    source: "Mock directory",
    sourceUrl: "https://source.example/arabian",
    demandSignals: ["wound care catalog", "imports medical consumables"],
    ...overrides
  };
}

function contact(overrides: Partial<FoundContact> = {}): FoundContact {
  return {
    name: "Amina Rahman",
    title: "Procurement Manager",
    email: "amina@example.com",
    emailStatus: "valid",
    source: "Mock contact source",
    sourceUrl: "https://contacts.example/amina",
    isPrimary: true,
    ...overrides
  };
}

function deliveredLead(overrides: Partial<PipelineDeliveredLead> = {}): PipelineDeliveredLead {
  const base = candidate();

  return {
    ...base,
    normalizedName: "arabian medical supplies",
    domain: "arabian-medical.example",
    contacts: [contact()],
    grade: "A",
    score: 91,
    scoreBreakdown: { productFit: 35, demandEvidence: 16, importEvidence: 12 },
    riskNotes: [],
    recommendedProducts: ["Kinesiology Tape Series"],
    outreach: { subject: "Subject", body: "Body" },
    ...overrides
  };
}

describe("task processing", () => {
  it("filters companies that already exist globally before the pipeline evaluates them", () => {
    const existing = [
      { normalizedName: "arabian medical supplies", domain: null, country: "Saudi Arabia", region: "Middle East" },
      { normalizedName: "other", domain: "matched.example", country: "Saudi Arabia", region: "Middle East" }
    ];
    const candidates = [
      candidate(),
      candidate({ name: "Domain Match Trading", website: "https://matched.example" }),
      candidate({ name: "Fresh Medical Trading", website: "https://fresh.example" })
    ];

    expect(filterExistingCompanies(candidates, existing).map((company) => company.name)).toEqual(["Fresh Medical Trading"]);
  });

  it("maps delivered company, contacts, source evidence, demand signals, and outreach without inventing facts", () => {
    const now = new Date("2026-07-12T08:00:00Z");
    const data = buildCompanyCreateData(task, deliveredLead(), now);

    expect(data).toMatchObject({
      taskId: "task_1",
      ownerId: "user_1",
      name: "Arabian Medical Supplies Co.",
      normalizedName: "arabian medical supplies",
      domain: "arabian-medical.example",
      demandEvidence: "wound care catalog\nimports medical consumables",
      isDelivered: true,
      deliveredAt: now,
      contacts: {
        create: [
          expect.objectContaining({
            name: "Amina Rahman",
            email: "amina@example.com",
            emailStatus: "valid",
            isPrimary: true
          })
        ]
      },
      letters: {
        create: [
          {
            subject: "Subject",
            body: "Body",
            language: "English"
          }
        ]
      }
    });
    expect(data.evidences.create).toEqual([
      {
        type: "source",
        title: "Mock directory",
        url: "https://source.example/arabian",
        summary: "medical distributor of wound care and rehabilitation supplies"
      },
      {
        type: "demand_signal",
        title: "wound care catalog",
        url: "https://source.example/arabian",
        summary: "wound care catalog"
      },
      {
        type: "demand_signal",
        title: "imports medical consumables",
        url: "https://source.example/arabian",
        summary: "imports medical consumables"
      }
    ]);
  });

  it("maps final task status from delivered count against the requested target", () => {
    expect(taskStatusForDeliveredCount(5, 5)).toBe("completed");
    expect(taskStatusForDeliveredCount(4, 5)).toBe("partial");
    expect(taskStatusForDeliveredCount(0, 5)).toBe("partial");
  });

  it("updates task counts and final partial status after processing", async () => {
    const updates: unknown[] = [];
    const createdCompanies: unknown[] = [];
    const result: PipelineResult = {
      marketSummary: { summary: "summary", keywords: ["kinesiology tape"], buyerConcerns: [] },
      searchedCount: 7,
      delivered: [deliveredLead(), deliveredLead({ name: "Fresh Medical Trading", normalizedName: "fresh medical trading" })],
      alternates: [],
      rejected: [{ company: candidate({ name: "Rejected Medical" }), reason: "score too low" }]
    };
    const prisma = {
      leadTask: {
        updateMany: async (args: any) => {
          if (args.data.status !== "running") updates.push(args);
          return { count: 1 };
        },
        findUnique: async () => task,
        update: async (args: unknown) => {
          updates.push(args);
          return args;
        }
      },
      company: {
        findMany: async () => [],
        count: async () => createdCompanies.length,
        create: async (args: unknown) => {
          createdCompanies.push(args);
          return args;
        }
      }
    };
    const adapters: AdapterSet = {
      search: { searchCompanies: async () => [] },
      contacts: { findContacts: async () => [] }
    };

    await processLeadTask("task_1", {
      prisma,
      createAdapters: () => adapters,
      runPipeline: async () => result,
      now: () => new Date("2026-07-12T08:00:00Z")
    });

    expect(createdCompanies).toHaveLength(2);
    expect(updates.at(-1)).toMatchObject({
      where: { id: "task_1" },
      data: {
        status: "partial",
        deliveredCount: 2,
        searchedCount: 7,
        rejectedCount: 1,
        completedAt: new Date("2026-07-12T08:00:00Z")
      }
    });
  });

  it("skips a duplicate company create while preserving earlier and later deliveries", async () => {
    const updates: unknown[] = [];
    const createAttempts: unknown[] = [];
    let persistedCount = 0;
    const result: PipelineResult = {
      marketSummary: { summary: "summary", keywords: ["kinesiology tape"], buyerConcerns: [] },
      searchedCount: 3,
      delivered: [
        deliveredLead(),
        deliveredLead({ name: "Duplicate Medical", normalizedName: "duplicate medical" }),
        deliveredLead({ name: "Fresh Medical Trading", normalizedName: "fresh medical trading" })
      ],
      alternates: [],
      rejected: []
    };
    const prisma = {
      leadTask: {
        updateMany: async (args: any) => {
          if (args.data.status !== "running") updates.push(args);
          return { count: 1 };
        },
        findUnique: async () => task,
        update: async (args: unknown) => {
          updates.push(args);
          return args;
        }
      },
      company: {
        findMany: async () => [],
        count: async () => persistedCount,
        create: async (args: unknown) => {
          createAttempts.push(args);
          if (createAttempts.length === 2) {
            throw Object.assign(new Error("duplicate"), { code: "P2002" });
          }
          persistedCount += 1;
          return args;
        }
      }
    };
    const adapters: AdapterSet = {
      search: { searchCompanies: async () => [] },
      contacts: { findContacts: async () => [] }
    };

    await expect(
      processLeadTask("task_1", {
        prisma,
        createAdapters: () => adapters,
        runPipeline: async () => result,
        now: () => new Date("2026-07-12T08:00:00Z")
      })
    ).resolves.toBeUndefined();

    expect(createAttempts).toHaveLength(3);
    expect(updates.at(-1)).toMatchObject({
      data: { status: "partial", deliveredCount: 2, searchedCount: 3, rejectedCount: 1 }
    });
  });

  it("claims a queued task atomically and ignores a second invocation", async () => {
    let claimed = false;
    let pipelineRuns = 0;
    const prisma = {
      leadTask: {
        updateMany: async () => claimed ? { count: 0 } : (claimed = true, { count: 1 }),
        findUnique: async () => task,
        update: async () => ({}),
      },
      company: { findMany: async () => [], create: async () => ({}), count: async () => 0 }
    };
    const runPipeline = async (): Promise<PipelineResult> => {
      pipelineRuns += 1;
      return { marketSummary: { summary: "", keywords: [], buyerConcerns: [] }, searchedCount: 0, delivered: [], alternates: [], rejected: [] };
    };

    await Promise.all([processLeadTask("task_1", { prisma, runPipeline }), processLeadTask("task_1", { prisma, runPipeline })]);

    expect(pipelineRuns).toBe(1);
  });

  it("uses qualified alternates after P2002 and finishes with five database deliveries", async () => {
    const leads = Array.from({ length: 6 }, (_, index) => deliveredLead({ name: `Medical ${index}`, normalizedName: `medical ${index}` }));
    let attempts = 0;
    let persisted = 0;
    const updates: any[] = [];
    const count = vi.fn(async () => persisted);
    const prisma = {
      leadTask: {
        updateMany: async (args: any) => {
          if (args.data.status !== "running") updates.push(args);
          return { count: 1 };
        },
        findUnique: async () => task,
        update: async (args: any) => args
      },
      company: {
        findMany: async () => [],
        create: async () => { attempts += 1; if (attempts === 2) throw Object.assign(new Error("duplicate"), { code: "P2002" }); persisted += 1; return {}; },
        count
      }
    };
    const result: PipelineResult = { marketSummary: { summary: "", keywords: [], buyerConcerns: [] }, searchedCount: 6, delivered: leads.slice(0, 5), alternates: leads.slice(5), rejected: [] };

    await processLeadTask("task_1", { prisma, runPipeline: async () => result });

    expect(attempts).toBe(6);
    expect(count).toHaveBeenCalledTimes(2);
    expect(updates.at(-1)).toMatchObject({ data: { status: "completed", deliveredCount: 5 } });
  });

  it("only finalizes the task while it still owns the running lease", async () => {
    const claimedAt = new Date("2026-07-12T08:00:00Z");
    const updateManyCalls: any[] = [];
    const prisma = {
      leadTask: {
        updateMany: async (args: any) => {
          updateManyCalls.push(args);
          return { count: 1 };
        },
        findUnique: async () => task,
        update: async () => {
          throw new Error("final status must use the lease-aware updateMany path");
        }
      },
      company: { findMany: async () => [], create: async () => ({}), count: async () => 0 }
    };
    const result: PipelineResult = {
      marketSummary: { summary: "", keywords: [], buyerConcerns: [] },
      searchedCount: 0,
      delivered: [],
      alternates: [],
      rejected: []
    };

    await processLeadTask("task_1", { prisma, runPipeline: async () => result, now: () => claimedAt });

    expect(updateManyCalls.at(-1)).toMatchObject({
      where: { id: "task_1", status: "running", startedAt: claimedAt },
      data: { status: "partial", deliveredCount: 0 }
    });
  });

  it("persists normalized brands and filters candidates matching an existing brand", () => {
    const brandedLead = deliveredLead({ brandNames: [" ACME Care ", "acme care", ""] });
    const data = buildCompanyCreateData(task, brandedLead, new Date());

    expect(data.brandNames).toEqual(["ACME Care"]);
    expect(data.brands.create).toEqual([{ name: "ACME Care", normalizedName: "acme care", country: "Saudi Arabia", region: "Middle East" }]);
    expect(filterExistingCompanies([candidate({ name: "Acme Care" })], [{ normalizedName: "parent", domain: null, country: "Saudi Arabia", region: "Middle East", brands: [{ normalizedName: "acme care" }] }])).toEqual([]);
  });

  it("does not reject when the task lookup and failed-status update both fail", async () => {
    const prisma = {
      leadTask: {
        findUnique: async () => {
          throw new Error("lookup unavailable");
        },
        update: async () => {
          throw new Error("status unavailable");
        },
        updateMany: async () => {
          throw new Error("status unavailable");
        }
      },
      company: {
        findMany: async () => [],
        create: async () => ({}),
        count: async () => 0
      }
    };

    await expect(processLeadTask("task_1", { prisma })).resolves.toBeUndefined();
  });

  it("marks the task failed without rejecting when processing fails after claim", async () => {
    const updates: unknown[] = [];
    const prisma = {
      leadTask: {
        findUnique: async () => {
          throw new Error("lookup unavailable");
        },
        update: async () => ({}),
        updateMany: async (args: unknown) => {
          updates.push(args);
          return { count: 1 };
        }
      },
      company: {
        findMany: async () => [],
        create: async () => ({}),
        count: async () => 0
      }
    };

    await expect(
      processLeadTask("task_1", { prisma, now: () => new Date("2026-07-12T08:00:00Z") })
    ).resolves.toBeUndefined();

    expect(updates.at(-1)).toMatchObject({ data: { status: "failed" } });
  });
});
