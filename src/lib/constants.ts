export const EXPENSE_CATEGORIES = [
  "land",
  "approvals",
  "foundation",
  "structure",
  "electrical",
  "plumbing",
  "finishing",
  "labour",
  "misc",
] as const;

export const PAYMENT_MODES = ["cash", "upi", "bank", "cheque"] as const;

export const CONTACT_ROLES = [
  "architect",
  "contractor",
  "labour",
  "vendor",
  "govt",
  "other",
] as const;

export const DOC_CATEGORIES = [
  "legal",
  "drawings",
  "approvals",
  "receipts",
  "photos",
  "contracts",
  "misc",
] as const;

export const TASK_GROUP_TYPES = ["week", "month", "goal"] as const;
export const TASK_STATUSES = ["todo", "done"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type ContactRole = (typeof CONTACT_ROLES)[number];
export type DocCategory = (typeof DOC_CATEGORIES)[number];
export type TaskGroupType = (typeof TASK_GROUP_TYPES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  land: "Land",
  approvals: "Approvals",
  foundation: "Foundation",
  structure: "Structure",
  electrical: "Electrical",
  plumbing: "Plumbing",
  finishing: "Finishing",
  labour: "Labour",
  misc: "Misc",
};

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank transfer",
  cheque: "Cheque",
};

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  architect: "Architect",
  contractor: "Contractor",
  labour: "Labour",
  vendor: "Vendor",
  govt: "Govt",
  other: "Other",
};

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  legal: "Legal",
  drawings: "Drawings",
  approvals: "Approvals",
  receipts: "Receipts",
  photos: "Photos",
  contracts: "Contracts",
  misc: "Misc",
};

export const TZ = "Asia/Kolkata";
