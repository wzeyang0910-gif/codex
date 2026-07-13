import { NextResponse } from "next/server";
import { UpdateCustomerSchema } from "@/lib/api-contracts";
import { prisma } from "@/lib/db";
import { normalizeCompanyName } from "@/lib/dedupe";
import { getSessionFromRequest, ownershipDecision } from "@/lib/session";

function isPrismaP2002(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function PATCH(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const user = getSessionFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { customerId } = await context.params;
  const existingCustomer = await prisma.company.findUnique({
    where: { id: customerId },
    select: { ownerId: true, name: true, normalizedName: true }
  });

  if (!existingCustomer) {
    return NextResponse.json({ error: "客户不存在" }, { status: 404 });
  }

  const decision = ownershipDecision(user, existingCustomer.ownerId);
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.status === 401 ? "请先登录" : "无权更新该客户" }, { status: decision.status });
  }

  const payload = await request.json().catch(() => null);
  const parsed = UpdateCustomerSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "客户更新内容不正确" }, { status: 400 });
  }

  const rename =
    parsed.data.name !== undefined && parsed.data.name !== existingCustomer.name
      ? { name: parsed.data.name, normalizedName: normalizeCompanyName(parsed.data.name) }
      : null;

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.company.update({
        where: { id: customerId },
        data: rename ? { ...parsed.data, normalizedName: rename.normalizedName } : parsed.data
      });

      if (rename) {
        await tx.companyBrand.updateMany({
          where: { companyId: customerId, normalizedName: existingCustomer.normalizedName },
          data: rename
        });
      }

      return updatedCustomer;
    });

    return NextResponse.json({ customer });
  } catch (error) {
    if (isPrismaP2002(error)) {
      return NextResponse.json({ error: "客户名称已存在" }, { status: 409 });
    }

    throw error;
  }
}
