import type { FoundContact } from "@/server/adapters/types";

const GENERIC_MAILBOXES = new Set([
  "info",
  "sales",
  "contact",
  "office",
  "admin",
  "support",
  "hello",
  "service"
]);

type ContactTitleRank = 1 | 2 | 3 | null;

function titleRank(title: string): ContactTitleRank {
  const normalized = title.trim().toLowerCase();

  if (/\b(owner|founder|ceo|enterprise head)\b/.test(normalized)) return 1;
  if (/\b(general manager|managing director)\b/.test(normalized)) return 2;
  if (/\b(procurement|purchasing|sourcing|product manager|category manager)\b/.test(normalized)) return 3;

  return null;
}

function hasPersonalWorkEmail(contact: FoundContact): boolean {
  const email = contact.email.trim().toLowerCase();
  const [localPart, domain] = email.split("@");

  return Boolean(localPart && domain && domain.includes(".") && !GENERIC_MAILBOXES.has(localPart));
}

function hasAuditableSource(contact: FoundContact): boolean {
  return Boolean(contact.source.trim() && contact.sourceUrl.trim());
}

export function selectBestEmailStatus(contacts: FoundContact[]) {
  if (contacts.some((contact) => contact.emailStatus === "valid")) return "valid";
  if (contacts.some((contact) => contact.emailStatus === "accept_all")) return "accept_all";
  if (contacts.some((contact) => contact.emailStatus === "risky")) return "risky";
  if (contacts.some((contact) => contact.emailStatus === "unknown")) return "unknown";
  return "invalid";
}

export function hasKeyPerson(contacts: FoundContact[]) {
  return contacts.some((contact) => titleRank(contact.title) !== null);
}

export function selectQualifyingContacts(contacts: FoundContact[]): FoundContact[] {
  return contacts
    .filter(
      (contact) =>
        titleRank(contact.title) !== null &&
        hasPersonalWorkEmail(contact) &&
        hasAuditableSource(contact) &&
        (contact.emailStatus === "valid" || contact.emailStatus === "accept_all")
    )
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
      return (titleRank(left.title) ?? Number.MAX_SAFE_INTEGER) - (titleRank(right.title) ?? Number.MAX_SAFE_INTEGER);
    });
}
