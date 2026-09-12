/**
 * Nova Agent Architecture — Calendar Service
 * Unified calendar API for both UI pages and the agent orchestrator.
 * Wraps existing localStorage calendar from local-store.ts.
 */

import {
  getEvents,
  addEvent,
  deleteEvent,
  type CalendarEvent,
} from "@/lib/local-store";
import { saveCalendarEvent, deleteCalendarEvent, getCalendarEvents } from "@/lib/rtdb";

export interface CreateEventInput {
  title: string;
  description?: string;
  date: string;     // YYYY-MM-DD
  time: string;     // HH:mm
  duration?: number; // minutes, default 60
  color?: string;
}

class CalendarService {
  /**
   * Create a new calendar event. Returns the created event.
   */
  create(input: CreateEventInput, userId?: string): CalendarEvent {
    const event = addEvent({
      title: input.title,
      description: input.description || "",
      date: input.date,
      time: input.time,
      duration: input.duration || 60,
      color: input.color || "#00d4ff",
    });
    if (userId) void saveCalendarEvent(userId, event);
    return event;
  }

  async listForUser(userId: string): Promise<CalendarEvent[]> {
    return getCalendarEvents(userId);
  }

  /**
   * List all events, optionally filtered by date range.
   */
  list(options?: { startDate?: string; endDate?: string }): CalendarEvent[] {
    let events = getEvents();
    if (options?.startDate) {
      events = events.filter((e) => e.date >= options.startDate!);
    }
    if (options?.endDate) {
      events = events.filter((e) => e.date <= options.endDate!);
    }
    return events.sort((a, b) => {
      const da = `${a.date}T${a.time}`;
      const db = `${b.date}T${b.time}`;
      return da.localeCompare(db);
    });
  }

  /**
   * Search events by title or description.
   */
  search(query: string): CalendarEvent[] {
    const lower = query.toLowerCase();
    return getEvents().filter(
      (e) =>
        e.title.toLowerCase().includes(lower) ||
        e.description.toLowerCase().includes(lower)
    );
  }

  /**
   * Get events for a specific date.
   */
  getEventsForDate(date: string): CalendarEvent[] {
    return getEvents()
      .filter((e) => e.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  /**
   * Update an event by ID.
   */
  update(id: string, updates: Partial<Omit<CalendarEvent, "id" | "createdAt">>): CalendarEvent | null {
    const events = getEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    events[idx] = { ...events[idx], ...updates };
    // Re-sort and save
    events.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    localStorage.setItem("nova_calendar_events", JSON.stringify(events));
    return events[idx];
  }

  /**
   * Delete an event by ID. Returns true if deleted.
   */
  delete(id: string, userId?: string): boolean {
    const before = getEvents().length;
    deleteEvent(id);
    if (userId) void deleteCalendarEvent(userId, id);
    return getEvents().length < before;
  }

  /**
   * Find the next available time slot on a given date.
   * Returns a time string HH:mm or null if no slot available.
   */
  findAvailableSlot(date: string, durationMinutes: number = 60): string | null {
    const events = this.getEventsForDate(date);
    // Simple slot finder: check from 9 AM to 6 PM in 30-min increments
    for (let hour = 9; hour < 18; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const slotStart = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        const slotEndMinutes = hour * 60 + min + durationMinutes;
        if (slotEndMinutes > 18 * 60) continue; // Don't exceed 6 PM

        const slotEnd = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, "0")}:${String(slotEndMinutes % 60).padStart(2, "0")}`;

        // Check if any event overlaps
        const overlaps = events.some((e) => {
          const eStart = e.time;
          const eEndMinutes =
            parseInt(e.time.split(":")[0]) * 60 +
            parseInt(e.time.split(":")[1]) +
            e.duration;
          const eEnd = `${String(Math.floor(eEndMinutes / 60)).padStart(2, "0")}:${String(eEndMinutes % 60).padStart(2, "0")}`;
          return slotStart < eEnd && slotEnd > eStart;
        });

        if (!overlaps) return slotStart;
      }
    }
    return null;
  }
}

/** Singleton calendar service. */
export const calendarService = new CalendarService();
