import { describe, expect, it } from "vitest";
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
      rejected: [{ company: candidate({ name: "Rejected Medical" }), reason: "score too low" }]
    };
    const prisma = {
      leadTask: {
        findUnique: async () => task,
        update: async (args: unknown) => {
          updates.push(args);
          return args;
        }
      },
      company: {
        findMany: async () => [],
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
    const result: PipelineResult = {
      marketSummary: { summary: "summary", keywords: ["kinesiology tape"], buyerConcerns: [] },
      searchedCount: 3,
      delivered: [
        deliveredLead(),
        deliveredLead({ name: "Duplicate Medical", normalizedName: "duplicate medical" }),
        deliveredLead({ name: "Fresh Medical Trading", normalizedName: "fresh medical trading" })
      ],
      rejected: []
    };
    const prisma = {
      leadTask: {
        findUnique: async () => task,
        update: async (args: unknown) => {
          updates.push(args);
          return args;
        }
      },
      company: {
        findMany: async () => [],
        create: async (args: unknown) => {
          createAttempts.push(args);
          if (createAttempts.length === 2) {
            throw Object.assign(new Error("duplicate"), { code: "P2002" });
          }
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

  it("does not reject when the task lookup and failed-status update both fail", async () => {
    const prisma = {
      leadTask: {
        findUnique: async () => {
          throw new Error("lookup unavailable");
        },
        update: async () => {
          throw new Error("status unavailable");
        }
      },
      company: {
        findMany: async () => [],
        create: async () => ({})
      }
    };

    await expect(processLeadTask("task_1", { prisma })).resolves.toBeUndefined();
  });

  it("marks the task failed without rejecting when the initial running update fails", async () => {
    const updates: unknown[] = [];
    const prisma = {
      leadTask: {
        findUnique: async () => task,
        update: async (args: unknown) => {
          updates.push(args);
          if (updates.length === 1) {
            throw new Error("running update unavailable");
          }
          return args;
        }
      },
      company: {
        findMany: async () => [],
        create: async () => ({})
      }
    };

    await expect(
      processLeadTask("task_1", { prisma, now: () => new Date("2026-07-12T08:00:00Z") })
    ).resolves.toBeUndefined();

    expect(updates.at(-1)).toMatchObject({ data: { status: "failed" } });
  });
});
