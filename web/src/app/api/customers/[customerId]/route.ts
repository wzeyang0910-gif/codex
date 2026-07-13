import { NextResponse } from "next/server";
import { UpdateCustomerSchema } from "@/lib/api-contracts";
import { prisma } from "@/lib/db";
import { normalizeCompanyName } from "@/lib/dedupe";
import { getSessionFromRequest, ownershipDecision } from "@/lib/session";

function isPrismaP2002(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

class CustomerRenameConflictError extends Error {}

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

  try {
    const customer = await prisma.$transaction(async (tx) => {
      if (parsed.data.name === undefined) {
        return tx.company.update({
          where: { id: customerId },
          data: parsed.data
        });
      }

      const currentCustomer = await tx.company.findUnique({
        where: { id: customerId },
        select: { name: true, normalizedName: true }
      });

      if (!currentCustomer) {
        throw new CustomerRenameConflictError();
      }

      if (parsed.data.name === currentCustomer.name) {
        return tx.company.update({
          where: { id: customerId },
          data: parsed.data
        });
      }

      const rename = {
        name: parsed.data.name,
        normalizedName: normalizeCompanyName(parsed.data.name)
      };
      const companyUpdate = await tx.company.updateMany({
        where: {
          id: customerId,
          name: currentCustomer.name,
          normalizedName: currentCustomer.normalizedName
        },
        data: { ...parsed.data, normalizedName: rename.normalizedName }
      });

      if (companyUpdate.count !== 1) {
        throw new CustomerRenameConflictError();
      }

      const identityUpdate = await tx.companyBrand.updateMany({
        where: {
          companyId: customerId,
          name: currentCustomer.name,
          normalizedName: currentCustomer.normalizedName
        },
        data: rename
      });

      if (identityUpdate.count !== 1) {
        throw new CustomerRenameConflictError();
      }

      const updatedCustomer = await tx.company.findUnique({ where: { id: customerId } });
      if (!updatedCustomer) {
        throw new CustomerRenameConflictError();
      }

      return updatedCustomer;
    });

    return NextResponse.json({ customer });
  } catch (error) {
    if (isPrismaP2002(error) || error instanceof CustomerRenameConflictError) {
      return NextResponse.json({ error: "客户名称已存在" }, { status: 409 });
    }

    throw error;
  }
}
