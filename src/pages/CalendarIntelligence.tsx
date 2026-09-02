/**
 * Nova AI OS — Calendar Intelligence
 * Event extraction from chat, availability checks, conflict detection,
 * recurring events, and confirmation before sending invitations.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Repeat,
  Plus,
  Trash2,
  Edit3,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
  MapPin,
} from "lucide-react";

export interface CalEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  location?: string;
  attendees: string[];
  recurrence: "none" | "daily" | "weekly" | "monthly";
  reminder: number; // minutes before
  confirmed: boolean;
  createdAt: number;
}

const STORAGE_KEY = "nova_events";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadEvents(): CalEvent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEvents(events: CalEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function checkConflict(
  events: CalEvent[],
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: string
): CalEvent | null {
  return events.find(
    (e) =>
      e.id !== excludeId &&
      e.date === date &&
      e.startTime < endTime &&
      e.endTime > startTime
  );
}

export function CalendarIntelligence() {
  const [events, setEvents] = useState<CalEvent[]>(loadEvents);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStart, setFormStart] = useState("09:00");
  const [formEnd, setFormEnd] = useState("10:00");
  const [formLocation, setFormLocation] = useState("");
  const [formAttendees, setFormAttendees] = useState("");
  const [formRecurrence, setFormRecurrence] = useState<CalEvent["recurrence"]>("none");
  const [formReminder, setFormReminder] = useState(15);

  // Invitation confirmation
  const [pendingInvite, setPendingInvite] = useState<CalEvent | null>(null);

  useEffect(() => {
    saveEvents(events);
  }, [events]);

  const selectedDateEvents = useMemo(
    () => events.filter((e) => e.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, selectedDate]
  );

  const monthEvents = useMemo(
    () =>
      events.filter((e) => {
        const d = new Date(e.date + "T00:00:00");
        return d.getFullYear() === currentMonth.year && d.getMonth() === currentMonth.month;
      }),
    [events, currentMonth]
  );

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentMonth.year, currentMonth.month);
    const firstDay = getFirstDayOfMonth(currentMonth.year, currentMonth.month);
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentMonth]);

  const createEvent = useCallback(() => {
    if (!formTitle.trim() || !formDate) return;

    const conflict = checkConflict(events, formDate, formStart, formEnd);
    if (conflict) {
      alert(`Conflict detected with "${conflict.title}" (${conflict.startTime}-${conflict.endTime})`);
      return;
    }

    const event: CalEvent = {
      id: generateId(),
      title: formTitle.trim(),
      description: formDesc.trim(),
      date: formDate,
      startTime: formStart,
      endTime: formEnd,
      location: formLocation.trim() || undefined,
      attendees: formAttendees
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      recurrence: formRecurrence,
      reminder: formReminder,
      confirmed: true,
      createdAt: Date.now(),
    };

    if (event.attendees.length > 0) {
      setPendingInvite(event);
    } else {
      setEvents((prev) => [...prev, event]);
      resetForm();
    }
  }, [formTitle, formDesc, formDate, formStart, formEnd, formLocation, formAttendees, formRecurrence, formReminder, events]);

  const confirmInvite = useCallback(() => {
    if (pendingInvite) {
      setEvents((prev) => [...prev, pendingInvite]);
      resetForm();
      setPendingInvite(null);
    }
  }, [pendingInvite]);

  const resetForm = useCallback(() => {
    setFormTitle("");
    setFormDesc("");
    setFormDate(selectedDate);
    setFormStart("09:00");
    setFormEnd("10:00");
    setFormLocation("");
    setFormAttendees("");
    setFormRecurrence("none");
    setFormReminder(15);
    setShowCreate(false);
    setEditingId(null);
  }, [selectedDate]);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const prevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  }, []);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Calendar Intelligence</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {events.length} events ·{" "}
            {events.filter((e) => e.attendees.length > 0).length} with attendees
          </p>
        </div>
        <button
          onClick={() => {
            setFormDate(selectedDate);
            setShowCreate(!showCreate);
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Event
        </button>
      </div>

      {/* Invitation confirmation modal */}
      {pendingInvite && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-amber-400">Confirm Invitation</h3>
          </div>
          <p className="text-xs text-slate-300">
            This event has {pendingInvite.attendees.length} attendee(s):{" "}
            <span className="font-mono text-amber-400">
              {pendingInvite.attendees.join(", ")}
            </span>
          </p>
          <p className="text-[10px] text-slate-500">
            Are you sure you want to send invitations for "{pendingInvite.title}"?
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmInvite}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirm & Send
            </button>
            <button
              onClick={() => setPendingInvite(null)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-semibold text-slate-200">
              {MONTHS[currentMonth.month]} {currentMonth.year}
            </h3>
            <button onClick={nextMonth} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-mono text-slate-600 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents = events.filter((e) => e.date === dateStr);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;

              return (
                <button
                  key={dateStr}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setFormDate(dateStr);
                  }}
                  className={`relative p-1.5 rounded-md text-xs transition-colors ${
                    isSelected
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : isToday
                      ? "bg-[#0f2137] text-slate-200 border border-[#1a2f4a]"
                      : "text-slate-400 hover:bg-[#0f2137] border border-transparent"
                  }`}
                >
                  <span className={isToday && !isSelected ? "font-bold" : ""}>{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex justify-center gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className={`w-1 h-1 rounded-full ${
                            e.attendees.length > 0 ? "bg-amber-400" : "bg-cyan-400"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Events sidebar */}
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-200">
              {formatDate(selectedDate)}
            </h3>
            <span className="text-[10px] font-mono text-slate-500">
              {selectedDateEvents.length} events
            </span>
          </div>

          {selectedDateEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-6 w-6 text-slate-600 mx-auto mb-2" />
              <p className="text-[10px] text-slate-500">No events on this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDateEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-[#0f2137] border border-[#1a2f4a] rounded-md p-2.5 space-y-1.5"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium text-slate-200">{event.title}</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="p-0.5 text-slate-600 hover:text-red-400 transition-colors"
                        aria-label="Delete event"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Clock className="h-3 w-3" />
                    {event.startTime} – {event.endTime}
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </div>
                  )}
                  {event.attendees.length > 0 && (
                    <div className="flex items-center gap-2 text-[10px] text-amber-400">
                      <Users className="h-3 w-3" />
                      {event.attendees.join(", ")}
                    </div>
                  )}
                  {event.recurrence !== "none" && (
                    <div className="flex items-center gap-2 text-[10px] text-cyan-400">
                      <Repeat className="h-3 w-3" />
                      {event.recurrence}
                    </div>
                  )}
                  {event.reminder > 0 && (
                    <div className="flex items-center gap-2 text-[10px] text-purple-400">
                      <Bell className="h-3 w-3" />
                      Reminder {event.reminder}min before
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-200">New Event</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Event title..."
              className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
            />
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Description..."
              className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
            />
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
            />
            <div className="flex gap-2">
              <input
                type="time"
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
                className="flex-1 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
              />
              <span className="text-slate-600 self-center text-xs">to</span>
              <input
                type="time"
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
                className="flex-1 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
              />
            </div>
            <input
              type="text"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="Location (optional)"
              className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 outline-none"
            />
            <select
              value={formRecurrence}
              onChange={(e) => setFormRecurrence(e.target.value as CalEvent["recurrence"])}
              className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
            >
              <option value="none">No repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <input
              type="text"
              value={formAttendees}
              onChange={(e) => setFormAttendees(e.target.value)}
              placeholder="Attendees (comma-separated emails)"
              className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 outline-none"
            />
            <select
              value={formReminder}
              onChange={(e) => setFormReminder(Number(e.target.value))}
              className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
            >
              <option value={0}>No reminder</option>
              <option value={5}>5 minutes before</option>
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={1440}>1 day before</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={createEvent}
              disabled={!formTitle.trim() || !formDate}
              className="px-3 py-1.5 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:opacity-40 transition-colors"
            >
              {formAttendees.trim() ? "Preview & Send" : "Create"}
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarIntelligence;
