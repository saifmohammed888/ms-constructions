import { z } from "zod";
import {
  CONTACT_ROLES,
  DOC_CATEGORIES,
  EXPENSE_CATEGORIES,
  PAYMENT_MODES,
  TASK_GROUP_TYPES,
  TASK_STATUSES,
} from "@/lib/constants";

export const loginSchema = z.object({
  password: z.string().min(1),
});

export const contactSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.enum(CONTACT_ROLES),
  phone: z.string().max(30).optional().nullable(),
  altPhone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(40)).optional(),
});

export const expenseSchema = z.object({
  amount: z.coerce.number().positive(),
  category: z.enum(EXPENSE_CATEGORIES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contactId: z.string().uuid().optional().nullable(),
  paymentMode: z.enum(PAYMENT_MODES).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  receiptDocId: z.string().uuid().optional().nullable(),
});

export const taskSchema = z.object({
  title: z.string().min(1).max(200),
  groupType: z.enum(TASK_GROUP_TYPES).optional(),
  goalLabel: z.string().max(80).optional().nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  notes: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().optional(),
  syncCalendar: z.boolean().optional(),
});

export const documentPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.enum(DOC_CATEGORIES).optional(),
  tags: z.array(z.string().max(40)).optional(),
});

export const settingsSchema = z.object({
  projectName: z.string().min(1).max(120).optional(),
  budgetTotal: z.coerce.number().nonnegative().optional().nullable(),
  budgetByCategory: z.record(z.string(), z.number().nonnegative()).optional(),
  setupComplete: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
});
