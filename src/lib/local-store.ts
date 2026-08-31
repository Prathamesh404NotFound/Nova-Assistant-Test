/**
 * Local persistent storage for Nova OS features.
 * All data stays in the browser's localStorage.
 */

// ── Conversations ──────────────────────────────────────────────
export interface LocalConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: LocalMessage[];
}

export interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  source?: "local" | "gemini";
  intent?: string;
  latencyMs?: number;
}

const CONV_KEY = "nova_conversations";

export function getConversations(): LocalConversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveConversations(convs: LocalConversation[]) {
  localStorage.setItem(CONV_KEY, JSON.stringify(convs));
}

export function createConversation(title: string): LocalConversation {
  const conv: LocalConversation = {
    id: "conv_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  const convs = getConversations();
  convs.unshift(conv);
  saveConversations(convs);
  return conv;
}

export function updateConversation(id: string, updates: Partial<LocalConversation>) {
  const convs = getConversations();
  const idx = convs.findIndex((c) => c.id === id);
  if (idx !== -1) {
    convs[idx] = { ...convs[idx], ...updates, updatedAt: Date.now() };
    saveConversations(convs);
  }
}

export function deleteConversation(id: string) {
  const convs = getConversations().filter((c) => c.id !== id);
  saveConversations(convs);
}

export function addMessageToConversation(convId: string, msg: LocalMessage) {
  const convs = getConversations();
  const conv = convs.find((c) => c.id === convId);
  if (conv) {
    conv.messages.push(msg);
    conv.updatedAt = Date.now();
    // Auto-title from first user message
    if (conv.messages.filter((m) => m.role === "user").length === 1) {
      conv.title = msg.content.slice(0, 60);
    }
    saveConversations(convs);
  }
}

// ── Calendar Events ────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  duration: number; // minutes
  color: string;
  createdAt: number;
}

const CAL_KEY = "nova_calendar_events";

export function getEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEvents(events: CalendarEvent[]) {
  localStorage.setItem(CAL_KEY, JSON.stringify(events));
}

export function addEvent(event: Omit<CalendarEvent, "id" | "createdAt">): CalendarEvent {
  const newEvent: CalendarEvent = {
    ...event,
    id: "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    createdAt: Date.now(),
  };
  const events = getEvents();
  events.push(newEvent);
  events.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  saveEvents(events);
  return newEvent;
}

export function deleteEvent(id: string) {
  saveEvents(getEvents().filter((e) => e.id !== id));
}

// ── Email Drafts ───────────────────────────────────────────────
export interface EmailDraft {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "draft" | "sent";
  createdAt: number;
  updatedAt: number;
}

const EMAIL_KEY = "nova_email_drafts";

export function getEmailDrafts(): EmailDraft[] {
  try {
    const raw = localStorage.getItem(EMAIL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEmailDrafts(drafts: EmailDraft[]) {
  localStorage.setItem(EMAIL_KEY, JSON.stringify(drafts));
}

export function addEmailDraft(draft: Omit<EmailDraft, "id" | "createdAt" | "updatedAt">): EmailDraft {
  const newDraft: EmailDraft = {
    ...draft,
    id: "email_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const drafts = getEmailDrafts();
  drafts.unshift(newDraft);
  saveEmailDrafts(drafts);
  return newDraft;
}

export function updateEmailDraft(id: string, updates: Partial<EmailDraft>) {
  const drafts = getEmailDrafts();
  const idx = drafts.findIndex((d) => d.id === id);
  if (idx !== -1) {
    drafts[idx] = { ...drafts[idx], ...updates, updatedAt: Date.now() };
    saveEmailDrafts(drafts);
  }
}

export function deleteEmailDraft(id: string) {
  saveEmailDrafts(getEmailDrafts().filter((d) => d.id !== id));
}

// ── Messages / SMS Drafts ─────────────────────────────────────
export interface MessageDraft {
  id: string;
  to: string;
  body: string;
  status: "draft" | "sent";
  createdAt: number;
  updatedAt: number;
}

const MSG_KEY = "nova_messages";

export function getMessageDrafts(): MessageDraft[] {
  try {
    const raw = localStorage.getItem(MSG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMessageDrafts(msgs: MessageDraft[]) {
  localStorage.setItem(MSG_KEY, JSON.stringify(msgs));
}

export function addMessageDraft(msg: Omit<MessageDraft, "id" | "createdAt" | "updatedAt">): MessageDraft {
  const newMsg: MessageDraft = {
    ...msg,
    id: "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const msgs = getMessageDrafts();
  msgs.unshift(newMsg);
  saveMessageDrafts(msgs);
  return newMsg;
}

export function deleteMessageDraft(id: string) {
  saveMessageDrafts(getMessageDrafts().filter((m) => m.id !== id));
}

// ── Automations ───────────────────────────────────────────────
export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  lastRun?: number;
  runCount: number;
  createdAt: number;
}

const AUTO_KEY = "nova_automations";

export function getAutomations(): Automation[] {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAutomations(autos: Automation[]) {
  localStorage.setItem(AUTO_KEY, JSON.stringify(autos));
}

export function addAutomation(auto: Omit<Automation, "id" | "createdAt" | "runCount" | "enabled">): Automation {
  const newAuto: Automation = {
    ...auto,
    id: "auto_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    enabled: true,
    runCount: 0,
    createdAt: Date.now(),
  };
  const autos = getAutomations();
  autos.unshift(newAuto);
  saveAutomations(autos);
  return newAuto;
}

export function updateAutomation(id: string, updates: Partial<Automation>) {
  const autos = getAutomations();
  const idx = autos.findIndex((a) => a.id === id);
  if (idx !== -1) {
    autos[idx] = { ...autos[idx], ...updates };
    saveAutomations(autos);
  }
}

export function deleteAutomation(id: string) {
  saveAutomations(getAutomations().filter((a) => a.id !== id));
}

// ── Files ──────────────────────────────────────────────────────
export interface LocalFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // base64 or text
  createdAt: number;
}

const FILE_KEY = "nova_files";

export function getFiles(): LocalFile[] {
  try {
    const raw = localStorage.getItem(FILE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFile(file: Omit<LocalFile, "id" | "createdAt">): LocalFile {
  const newFile: LocalFile = {
    ...file,
    id: "file_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    createdAt: Date.now(),
  };
  const files = getFiles();
  files.unshift(newFile);
  localStorage.setItem(FILE_KEY, JSON.stringify(files));
  return newFile;
}

export function deleteFile(id: string) {
  const files = getFiles().filter((f) => f.id !== id);
  localStorage.setItem(FILE_KEY, JSON.stringify(files));
}

// ── Activity Log ──────────────────────────────────────────────
export interface ActivityEntry {
  id: string;
  type: string;
  description: string;
  icon: string;
  createdAt: number;
}

const ACT_KEY = "nova_activity";

export function getActivities(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(ACT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logActivity(type: string, description: string, icon = "zap") {
  const entry: ActivityEntry = {
    id: "act_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type,
    description,
    icon,
    createdAt: Date.now(),
  };
  const activities = getActivities();
  activities.unshift(entry);
  // Keep last 200 entries
  if (activities.length > 200) activities.length = 200;
  localStorage.setItem(ACT_KEY, JSON.stringify(activities));
  return entry;
}

// ── Smart Home Devices ────────────────────────────────────────
export interface SmartDevice {
  id: string;
  name: string;
  type: "light" | "thermostat" | "lock" | "camera" | "speaker" | "sensor";
  room: string;
  isOn: boolean;
  value?: number; // temperature, brightness, etc.
  createdAt: number;
}

const DEVICE_KEY = "nova_smart_devices";

function defaultDevices(): SmartDevice[] {
  return [
    { id: "dev_1", name: "Living Room Light", type: "light", room: "Living Room", isOn: true, value: 80, createdAt: Date.now() },
    { id: "dev_2", name: "Bedroom Light", type: "light", room: "Bedroom", isOn: false, value: 60, createdAt: Date.now() },
    { id: "dev_3", name: "Front Door Lock", type: "lock", room: "Entrance", isOn: true, createdAt: Date.now() },
    { id: "dev_4", name: "Thermostat", type: "thermostat", room: "Hallway", isOn: true, value: 72, createdAt: Date.now() },
    { id: "dev_5", name: "Front Camera", type: "camera", room: "Entrance", isOn: true, createdAt: Date.now() },
    { id: "dev_6", name: "Kitchen Speaker", type: "speaker", room: "Kitchen", isOn: false, createdAt: Date.now() },
  ];
}

export function getSmartDevices(): SmartDevice[] {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (raw) return JSON.parse(raw);
    const defaults = defaultDevices();
    localStorage.setItem(DEVICE_KEY, JSON.stringify(defaults));
    return defaults;
  } catch {
    return defaultDevices();
  }
}

export function updateSmartDevice(id: string, updates: Partial<SmartDevice>) {
  const devices = getSmartDevices();
  const idx = devices.findIndex((d) => d.id === id);
  if (idx !== -1) {
    devices[idx] = { ...devices[idx], ...updates };
    localStorage.setItem(DEVICE_KEY, JSON.stringify(devices));
  }
}

export function addSmartDevice(device: Omit<SmartDevice, "id" | "createdAt">): SmartDevice {
  const newDevice: SmartDevice = {
    ...device,
    id: "dev_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    createdAt: Date.now(),
  };
  const devices = getSmartDevices();
  devices.push(newDevice);
  localStorage.setItem(DEVICE_KEY, JSON.stringify(devices));
  return newDevice;
}

export function deleteSmartDevice(id: string) {
  const devices = getSmartDevices().filter((d) => d.id !== id);
  localStorage.setItem(DEVICE_KEY, JSON.stringify(devices));
}
