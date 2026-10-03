import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { desc } from "drizzle-orm";
import { getDb, getSettingsRow } from "@/lib/db";
import { getSession } from "@/lib/session";
import { contacts, expenses, tasks } from "@/lib/schema";

export const runtime = "nodejs";

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF202B2D" } };
  header.alignment = { vertical: "middle" };
  header.height = 24;
  sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + Math.min(sheet.columnCount, 26))}1` };
  for (const column of sheet.columns) column.width = Math.min(Math.max(column.header?.toString().length ?? 12, 14), 28);
}

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const [settings, taskRows, expenseRows, contactRows] = await Promise.all([
    getSettingsRow(),
    db.select().from(tasks).orderBy(desc(tasks.createdAt)),
    db.select().from(expenses).orderBy(desc(expenses.date), desc(expenses.createdAt)),
    db.select().from(contacts).orderBy(desc(contacts.updatedAt)),
  ]);
  const totalSpent = expenseRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const dueAmount = expenseRows.filter((row) => row.paymentStatus === "due").reduce((sum, row) => sum + Number(row.amount), 0);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MS Construction";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.addRows([
    ["MS Construction company export"],
    ["Project", settings?.projectName ?? "My Construction"],
    ["Exported at", new Date()],
    [],
    ["Metric", "Value"],
    ["Budget", settings?.budgetTotal ? Number(settings.budgetTotal) : null],
    ["Total spent", totalSpent],
    ["Payments due", dueAmount],
    ["Task count", taskRows.length],
    ["Open tasks", taskRows.filter((row) => row.status !== "done").length],
    ["Completed tasks", taskRows.filter((row) => row.status === "done").length],
    ["People count", contactRows.length],
  ]);
  summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF202B2D" } };
  summary.getColumn(1).width = 24;
  summary.getColumn(2).width = 22;
  summary.getCell("B3").numFmt = "dd-mmm-yyyy hh:mm";
  summary.getColumn(2).eachCell((cell, rowNumber) => { if (rowNumber >= 6 && rowNumber <= 8) cell.numFmt = '₹#,##0.00'; });
  summary.getRow(5).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF202B2D" } };

  const work = workbook.addWorksheet("Work");
  work.addRow(["Title", "Group", "Goal", "Due date", "Status", "Notes", "Sort order", "Created at", "Completed at"]);
  for (const row of taskRows) work.addRow([row.title, row.groupType, row.goalLabel, row.dueDate ? new Date(`${row.dueDate}T00:00:00`) : null, row.status, row.notes, row.sortOrder, row.createdAt, row.completedAt]);
  styleSheet(work);
  work.getColumn(4).numFmt = "dd-mmm-yyyy";
  work.getColumn(8).numFmt = "dd-mmm-yyyy hh:mm";
  work.getColumn(9).numFmt = "dd-mmm-yyyy hh:mm";

  const money = workbook.addWorksheet("Money");
  money.addRow(["Date", "Category", "Amount", "Payment mode", "Status", "Due date", "Contact ID", "Notes"]);
  for (const row of expenseRows) money.addRow([new Date(`${row.date}T00:00:00`), row.category, Number(row.amount), row.paymentMode, row.paymentStatus, row.dueDate ? new Date(`${row.dueDate}T00:00:00`) : null, row.contactId, row.notes]);
  styleSheet(money);
  money.getColumn(1).numFmt = "dd-mmm-yyyy";
  money.getColumn(3).numFmt = '₹#,##0.00';
  money.getColumn(6).numFmt = "dd-mmm-yyyy";

  const people = workbook.addWorksheet("People");
  people.addRow(["Name", "Role", "Phone", "Alternate phone", "Email", "Tags", "Notes", "Created at"]);
  for (const row of contactRows) people.addRow([row.name, row.role, row.phone, row.altPhone, row.email, row.tags.join(", "), row.notes, row.createdAt]);
  styleSheet(people);
  people.getColumn(8).numFmt = "dd-mmm-yyyy hh:mm";

  const numeric = workbook.addWorksheet("Numeric Data");
  numeric.addRow(["Metric", "Value", "Unit"]);
  numeric.addRows([["Budget", settings?.budgetTotal ? Number(settings.budgetTotal) : null, "INR"], ["Total spent", totalSpent, "INR"], ["Payments due", dueAmount, "INR"], ["Task count", taskRows.length, "count"], ["Open tasks", taskRows.filter((row) => row.status !== "done").length, "count"], ["Completed tasks", taskRows.filter((row) => row.status === "done").length, "count"], ["People count", contactRows.length, "count"]]);
  styleSheet(numeric);
  numeric.getColumn(2).numFmt = '₹#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="ms-construction-export-${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "private, no-store" } });
}
