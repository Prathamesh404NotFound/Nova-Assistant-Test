import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  getEvents,
  addEvent,
  deleteEvent,
  type CalendarEvent,
} from "@/lib/local-store";
import { getCalendarEvents, saveCalendarEvent, deleteCalendarEvent } from "@/lib/rtdb";
import { logActivity } from "@/lib/local-store";
import {
  Calendar,
  Plus,
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

const eventColors = [
  { value: "#00d4ff", label: "Cyan" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#10b981", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#f43f5e", label: "Rose" },
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newTime, setNewTime] = useState("09:00");
  const [newDuration, setNewDuration] = useState(60);
  const [newColor, setNewColor] = useState("#00d4ff");
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const userId = user?.uid ?? "";

  useEffect(() => {
    let active = true;
    const load = async () => {
      const local = getEvents();
      const remote = userId ? await getCalendarEvents(userId) : [];
      if (active) setEvents(remote.length > 0 ? remote : local);
    };
    void load();
    return () => { active = false; };
  }, [userId]);

  const refresh = useCallback(() => {
    setEvents(getEvents());
  }, []);

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    const event = addEvent({
      title: newTitle.trim(),
      description: newDesc.trim(),
      date: newDate,
      time: newTime,
      duration: newDuration,
      color: newColor,
    });
    if (userId) await saveCalendarEvent(userId, event);
    logActivity("calendar", `Created event: ${newTitle.trim()}`, "calendar");
    setNewTitle("");
    setNewDesc("");
    setShowNew(false);
    refresh();
  }, [newTitle, newDesc, newDate, newTime, newDuration, newColor, userId, refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      const evt = events.find((e) => e.id === id);
      deleteEvent(id);
      if (userId) await deleteCalendarEvent(userId, id);
      if (evt) logActivity("calendar", `Deleted event: ${evt.title}`, "calendar");
      refresh();
    },
    [events, userId, refresh]
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDay(null);
  };

  const selectedDateStr =
    selectedDay !== null ? formatDateStr(viewYear, viewMonth, selectedDay) : null;

  const dayEvents = selectedDateStr
    ? events.filter((e) => e.date === selectedDateStr)
    : [];

  // Upcoming events (next 7 days)
  const today = new Date().toISOString().split("T")[0];
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
              <p className="text-sm text-[#6e6e8a] mt-1">{events.length} events</p>
            </div>
            <Button onClick={() => setShowNew(!showNew)} className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/80">
              {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-1" />}
              {showNew ? "Cancel" : "New Event"}
            </Button>
          </div>
        </motion.div>

        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="nova-glass p-4 space-y-3">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Event title..."
                autoFocus
                className="bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)..."
                rows={2}
                className="w-full bg-[#16162a] border border-[#252540] rounded-lg px-3 py-2 text-sm text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:outline-none focus:border-[#00d4ff]/40 resize-none"
              />
              <div className="flex flex-wrap gap-3">
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="bg-[#16162a] border-[#252540] text-[#e8e8f8] focus:border-[#00d4ff]/40"
                />
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="bg-[#16162a] border-[#252540] text-[#e8e8f8] focus:border-[#00d4ff]/40"
                />
                <select
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="bg-[#16162a] border border-[#252540] rounded-lg px-3 py-2 text-sm text-[#e8e8f8] focus:outline-none"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6e6e8a]">Color:</span>
                {eventColors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setNewColor(c.value)}
                    className={`w-6 h-6 rounded-full transition-all ${newColor === c.value ? "ring-2 ring-white scale-110" : "opacity-60 hover:opacity-100"}`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
              <Button onClick={handleAdd} className="bg-[#00d4ff] text-[#06060c] w-full">
                Add Event
              </Button>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="lg:col-span-2">
            <Card className="nova-glass p-4">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-2 hover:bg-[#1e1e38] rounded-lg transition-colors">
                  <ChevronLeft className="h-4 w-4 text-[#6e6e8a]" />
                </button>
                <h3 className="text-sm font-semibold text-[#e8e8f8]">
                  {monthNames[viewMonth]} {viewYear}
                </h3>
                <button onClick={nextMonth} className="p-2 hover:bg-[#1e1e38] rounded-lg transition-colors">
                  <ChevronRight className="h-4 w-4 text-[#6e6e8a]" />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-[#6e6e8a] py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = formatDateStr(viewYear, viewMonth, day);
                  const hasEvents = events.some((e) => e.date === dateStr);
                  const isSelected = selectedDay === day;
                  const isToday = dateStr === today;

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-all ${
                        isSelected
                          ? "bg-[#00d4ff]/20 text-[#00d4ff] font-semibold"
                          : isToday
                          ? "bg-[#8b5cf6]/10 text-[#8b5cf6]"
                          : "text-[#e8e8f8] hover:bg-[#1e1e38]"
                      }`}
                    >
                      {day}
                      {hasEvents && (
                        <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[#00d4ff]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          {/* Sidebar: Day events + Upcoming */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} className="space-y-4">
            <Card className="nova-glass p-4">
              <h3 className="text-sm font-medium text-[#6e6e8a] uppercase tracking-wider mb-3">
                {selectedDateStr
                  ? new Date(selectedDateStr + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })
                  : "Select a day"}
              </h3>
              {dayEvents.length === 0 ? (
                <p className="text-xs text-[#6e6e8a]">No events this day</p>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map((evt) => (
                    <div key={evt.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#16162a]/50">
                      <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: evt.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#e8e8f8] truncate">{evt.title}</p>
                        <p className="text-xs text-[#6e6e8a] flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {evt.time} · {evt.duration}min
                        </p>
                      </div>
                      <button onClick={() => handleDelete(evt.id)} className="text-[#6e6e8a] hover:text-[#f43f5e]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="nova-glass p-4">
              <h3 className="text-sm font-medium text-[#6e6e8a] uppercase tracking-wider mb-3">
                Upcoming
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-xs text-[#6e6e8a]">No upcoming events</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((evt) => (
                    <div key={evt.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#16162a]/50">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: evt.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#e8e8f8] truncate">{evt.title}</p>
                        <p className="text-[10px] text-[#6e6e8a]">
                          {new Date(evt.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} at {evt.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
