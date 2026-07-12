import { NextResponse } from "next/server";
import { UpdateCustomerSchema } from "@/lib/api-contracts";
import { prisma } from "@/lib/db";
import { getSessionFromRequest, ownershipDecision } from "@/lib/session";

export async function PATCH(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const user = getSessionFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { customerId } = await context.params;
  const existingCustomer = await prisma.company.findUnique({
    where: { id: customerId },
    select: { ownerId: true }
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

  const customer = await prisma.company.update({
    where: { id: customerId },
    data: parsed.data
  });

  return NextResponse.json({ customer });
}
