import { z } from "zod";

export const CreateTaskSchema = z
  .object({
    targetRegion: z.string().min(1),
    targetCountries: z.array(z.string()).default([]),
    productKeys: z.array(z.string()).min(1),
    customerTypes: z.array(z.string()).min(1),
    language: z.string().default("English"),
    extraKeywords: z.array(z.string()).default([])
  })
  .strict();

export const UpdateCustomerSchema = z
  .object({
    name: z.string().min(1).optional(),
    businessSummary: z.string().min(1).optional(),
    notes: z.string().optional(),
    status: z.enum(["not_contacted", "sent", "replied", "quoted", "won", "not_interested"]).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "至少需要一个可更新字段");

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
