/**
 * Who can sign in, and how much of Operations they get.
 *
 * OPERATIONS and SUPPORT share the same board — the difference is authority,
 * not information. Customer service and sales need to answer "where is my
 * order" and fix what the customer got wrong (address, phone, card message,
 * delivery date), so they see everything. What they don't get is anything
 * that spends money, commits the shop, or changes what the customer is told:
 * booking a courier, cancelling, overriding status, marking a delivery done,
 * and managing the team itself.
 */
export const ROLES = ["OPERATIONS", "SUPPORT", "FLORIST", "DRIVER"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  OPERATIONS: "Operations",
  SUPPORT: "Service & sales",
  FLORIST: "Florist",
  DRIVER: "Driver",
};

/** Shown next to the role when adding someone, so the choice is obvious. */
export const ROLE_DESCRIPTION: Record<Role, string> = {
  OPERATIONS: "Full access, including the team and dispatch",
  SUPPORT: "Orders and customer details — no dispatch, no team",
  FLORIST: "Their own bouquet queue",
  DRIVER: "Their own deliveries",
};

/** Roles that reach the Operations board at all. */
const OPS_ROLES: Role[] = ["OPERATIONS", "SUPPORT"];

export function hasOpsAccess(role: Role) {
  return OPS_ROLES.includes(role);
}

/**
 * The privileged half of Operations.
 *
 * Deliberately a positive check rather than "not SUPPORT": a role added later
 * is then locked out of the dangerous controls until someone decides
 * otherwise, instead of quietly inheriting them.
 */
export function isFullOperations(role: Role) {
  return role === "OPERATIONS";
}
