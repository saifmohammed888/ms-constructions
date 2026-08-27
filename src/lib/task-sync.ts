import { deleteCalendarEvent, createCalendarEvent, patchCalendarEvent } from "@/lib/google";

export async function applyCalendarSync(opts: {
  syncCalendar?: boolean;
  existingEventId: string | null;
  title: string;
  dueDate: string | null;
  appUrl: string;
}) {
  const { syncCalendar, existingEventId, title, dueDate, appUrl } = opts;
  let gcalEventId = existingEventId;
  let calendarSyncError: string | null = null;

  try {
    if (syncCalendar === false && existingEventId) {
      await deleteCalendarEvent(existingEventId);
      gcalEventId = null;
    } else if (syncCalendar === true) {
      if (!dueDate) {
        calendarSyncError = "Add a due date before syncing to Calendar";
      } else if (existingEventId) {
        await patchCalendarEvent(existingEventId, title, dueDate);
      } else {
        gcalEventId = await createCalendarEvent(title, dueDate, appUrl);
      }
    } else if (existingEventId && dueDate) {
      await patchCalendarEvent(existingEventId, title, dueDate);
    }
  } catch {
    calendarSyncError = "calendar sync failed — retry";
  }

  return { gcalEventId, calendarSyncError };
}
