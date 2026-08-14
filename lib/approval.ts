export type ApprovalStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED";

export const APPROVAL_WINDOW_MINUTES = 30;

type ApprovalFields = { approvalStatus: string; approvalDeadline: Date | null };

/**
 * Folds the grace period into the stored flag: once the deadline passes with
 * no explicit customer response, treat the bouquet as approved. Nothing is
 * written back to the DB for this — every caller re-derives it from "now",
 * so there's no cron job to keep running and no risk of a missed transition.
 */
export function effectiveApproval(order: ApprovalFields): ApprovalStatus {
  if (
    order.approvalStatus === "PENDING" &&
    order.approvalDeadline &&
    order.approvalDeadline.getTime() <= Date.now()
  ) {
    return "APPROVED";
  }
  return order.approvalStatus as ApprovalStatus;
}

export function approvalDeadlineFromNow() {
  return new Date(Date.now() + APPROVAL_WINDOW_MINUTES * 60 * 1000);
}
