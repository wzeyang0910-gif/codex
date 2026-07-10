import type { UserRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export function requireRole(userRole: UserRole, allowed: UserRole[]): void {
  if (!allowed.includes(userRole)) {
    throw new Error("权限不足");
  }
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "admin";
}
