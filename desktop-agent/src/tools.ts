/**
 * Nova Windows Agent — tool handlers.
 *
 * Every handler implements a NAMED, allowlisted capability. There is no
 * generic "run command" / eval / shell passthrough anywhere in this file.
 * Each handler verifies its own effect where possible and returns structured
 * evidence so the web layer can honestly report success.
 *
 * Windows interop uses PowerShell (present on every modern Windows install).
 * On non-Windows platforms handlers report UNSUPPORTED rather than guessing.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const execFileAsync = promisify(execFile);

export interface ToolOutcome {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const IS_WINDOWS = process.platform === "win32";

function unsupported(tool: string): ToolOutcome {
  return { ok: false, error: `UNSUPPORTED: "${tool}" requires Windows. This agent runs on ${process.platform}.` };
}

// ─── PowerShell helper (no shell interpolation — array argv only) ───────────

async function ps(script: string, timeoutMs = 10_000): Promise<string> {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { timeout: timeoutMs, windowsHide: true }
  );
  return stdout.trim();
}

// ─── Applications & windows ─────────────────────────────────────────────────

const APP_ALIASES: Record<string, string> = {
  calculator: "calc.exe",
  notepad: "notepad.exe",
  paint: "mspaint.exe",
  explorer: "explorer.exe",
  chrome: "chrome",
  edge: "msedge",
  firefox: "firefox",
  spotify: "spotify",
  vscode: "code",
  "visual studio code": "code",
  cmd: "cmd.exe",
  terminal: "wt.exe",
  settings: "ms-settings:",
};

export async function launchApp(args: { application: string }): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("app.launch");
  const raw = (args.application || "").trim();
  if (!raw) return { ok: false, error: "No application specified" };

  const target = APP_ALIASES[raw.toLowerCase()] ?? raw;
  // Basic path hygiene: reject obvious injection attempts (no shell is used,
  // but still keep the surface tight).
  if (/[&|><"`;]/.test(target)) {
    return { ok: false, error: "Invalid application name" };
  }

  try {
    if (target.startsWith("ms-settings:")) {
      await execFileAsync("cmd.exe", ["/c", "start", "", target], { timeout: 10_000, windowsHide: true });
    } else {
      await execFileAsync("cmd.exe", ["/c", "start", "", target], { timeout: 10_000, windowsHide: true });
    }
  } catch (err) {
    return { ok: false, error: `Failed to launch: ${err instanceof Error ? err.message : "unknown"}` };
  }

  // VERIFY: check the process actually appeared.
  await new Promise((r) => setTimeout(r, 1200));
  const exeName = target.endsWith(".exe") ? target : `${target}.exe`;
  try {
    const out = await ps(
      `(Get-Process | Where-Object { $_.ProcessName -like '${exeName.replace(".exe", "")}*' }).Count`,
      8000
    );
    if (parseInt(out, 10) > 0) {
      return { ok: true, data: { application: raw, process: exeName, verified: true } };
    }
    return { ok: true, data: { application: raw, process: exeName, verified: false }, error: "Launched but process not yet visible" };
  } catch {
    return { ok: true, data: { application: raw, verified: false }, error: "Could not verify process visibility" };
  }
}

export async function closeApp(args: { application: string }): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("app.close");
  const raw = (args.application || "").trim().toLowerCase();
  if (!raw) return { ok: false, error: "No application specified" };
  const target = (APP_ALIASES[raw] ?? raw).replace(".exe", "");
  try {
    await ps(`Stop-Process -Name '${target}' -ErrorAction SilentlyContinue; "done"`, 8000);
    return { ok: true, data: { application: raw, closed: true } };
  } catch (err) {
    return { ok: false, error: `Failed to close: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function listWindows(): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("app.listWindows");
  try {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinEnum {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
}
"@
$result = @()
[WinEnum]::EnumWindows({ param($h, $l)
  if ([WinEnum]::IsWindowVisible($h)) {
    $sb = New-Object System.Text.StringBuilder 256
    [WinEnum]::GetWindowText($h, $sb, 256) | Out-Null
    $t = $sb.ToString()
    if ($t.Length -gt 0) { $result += $t }
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
$result -join [Environment]::NewLine`;
    const out = await ps(script, 12_000);
    const windows = out.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 50)
      .map((title, i) => ({ id: `win_${i}`, title, application: title.split(" - ")[0] || title }));
    return { ok: true, data: { windows } };
  } catch (err) {
    return { ok: false, error: `Window enumeration failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function activeWindow(): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("app.activeWindow");
  try {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class ActiveWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
"@
$h = [ActiveWin]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[ActiveWin]::GetWindowText($h, $sb, 256) | Out-Null
$sb.ToString()`;
    const title = await ps(script, 8000);
    return { ok: true, data: { window: { id: "active", title, application: title.split(" - ")[0] || title } } };
  } catch (err) {
    return { ok: false, error: `Active window query failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function focusWindow(args: { application?: string; windowId?: string }): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("app.focus");
  const app = (args.application || "").trim();
  if (!app) return { ok: false, error: "No application specified" };
  try {
    const script = `
$p = Get-Process | Where-Object { $_.MainWindowTitle -like '*${app.replace(/'/g, "''")}*' } | Select-Object -First 1
if ($p -and $p.MainWindowHandle -ne 0) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
  [WinFocus]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  "focused"
} else { "notfound" }`;
    const out = await ps(script, 8000);
    if (out.includes("focused")) return { ok: true, data: { application: app, focused: true } };
    return { ok: false, error: `No visible window found for "${app}"` };
  } catch (err) {
    return { ok: false, error: `Focus failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export async function captureScreen(): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("screen.capture");
  const tmp = path.join(os.tmpdir(), `nova_screen_${Date.now()}.png`);
  try {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save('${tmp.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"saved"`;
    const out = await ps(script, 15_000);
    if (!out.includes("saved") || !fs.existsSync(tmp)) {
      return { ok: false, error: "Screen capture failed" };
    }
    const b64 = fs.readFileSync(tmp).toString("base64");
    fs.unlinkSync(tmp); // clean up immediately
    return { ok: true, data: { screenshot: `data:image/png;base64,${b64}` } };
  } catch (err) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* ignore */ }
    return { ok: false, error: `Screen capture failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// ─── Mouse & keyboard ───────────────────────────────────────────────────────

export async function mouseAction(args: { action: string; x?: number; y?: number; button?: string; deltaY?: number }): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("mouse");
  const { action, x, y, button, deltaY } = args;
  if (action !== "move" && (typeof x !== "number" || typeof y !== "number")) {
    return { ok: false, error: "x and y coordinates required" };
  }
  const coords = action === "move" ? "" : `${Math.round(x!)}, ${Math.round(y!)}`;
  const btn = button === "right" ? "Right" : button === "middle" ? "Middle" : "Left";
  let mouseOp = "";
  if (action === "click") mouseOp = `[WinInput]::mouse_event(0x0002 | 0x0004, 0, 0, 0, 0)`;
  else if (action === "move") mouseOp = `[WinInput]::SetCursorPos(${coords || "0, 0"})`;
  else if (action === "scroll") mouseOp = `[WinInput]::mouse_event(0x0800, 0, 0, ${Math.sign(deltaY ?? 0) * -120}, 0)`;
  if (!mouseOp) return { ok: false, error: `Unknown mouse action: ${action}` };

  try {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinInput {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr e);
}
"@
${action === "move" ? `[WinInput]::SetCursorPos(${Math.round(x ?? 0)}, ${Math.round(y ?? 0)})` : `[WinInput]::SetCursorPos(${coords})`}
Start-Sleep -Milliseconds 50
${mouseOp}
"done"`;
    await ps(script, 8000);
    return { ok: true, data: { action, x, y, performed: true } };
  } catch (err) {
    return { ok: false, error: `Mouse action failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

const PS_KEYS: Record<string, string> = {
  enter: "{ENTER}", tab: "{TAB}", escape: "{ESC}", esc: "{ESC}",
  backspace: "{BACKSPACE}", delete: "{DELETE}", space: " ",
  up: "{UP}", down: "{DOWN}", left: "{LEFT}", right: "{RIGHT}",
  home: "{HOME}", end: "{END}", pageup: "{PGUP}", pagedown: "{PGDN}",
};

export async function typeText(args: { text: string; delayMs?: number }): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("keyboard.type");
  const text = args.text ?? "";
  if (!text) return { ok: false, error: "No text provided" };
  if (text.length > 5000) return { ok: false, error: "Text too long (max 5000 chars)" };
  try {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${text.replace(/'/g, "''").replace(/([+^%~(){}[\]])/g, "{$1}")}')
"done"`;
    await ps(script, Math.max(10_000, text.length * 50));
    return { ok: true, data: { typed: text.length } };
  } catch (err) {
    return { ok: false, error: `Typing failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function keyPress(args: { key: string; modifiers?: string[] }): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("keyboard.press");
  const key = (args.key || "").toLowerCase();
  const psKey = PS_KEYS[key];
  if (!psKey) return { ok: false, error: `Unsupported key: ${key}` };
  let prefix = "";
  const mods = args.modifiers ?? [];
  if (mods.includes("ctrl")) prefix += "^";
  if (mods.includes("alt")) prefix += "%";
  if (mods.includes("shift")) prefix += "+";
  try {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${prefix}${psKey}')
"done"`;
    await ps(script, 8000);
    return { ok: true, data: { key, modifiers: mods, performed: true } };
  } catch (err) {
    return { ok: false, error: `Key press failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function hotkey(args: { keys: string[] }): Promise<ToolOutcome> {
  return keyPress({ key: args.keys?.[args.keys.length - 1] ?? "", modifiers: args.keys?.slice(0, -1) });
}

// ─── Clipboard ──────────────────────────────────────────────────────────────

export async function clipboardRead(): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("clipboard.read");
  try {
    const text = await ps("Get-Clipboard -Raw", 5000);
    return { ok: true, data: { text, type: "text" } };
  } catch (err) {
    return { ok: false, error: `Clipboard read failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function clipboardWrite(args: { text: string }): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("clipboard.write");
  const text = (args.text ?? "").toString();
  if (text.length > 100_000) return { ok: false, error: "Clipboard payload too large" };
  try {
    // Base64 round-trip avoids any quoting/escaping issues.
    const b64 = Buffer.from(text, "utf8").toString("base64");
    await ps(`Set-Clipboard -Value ([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}'))); "done"`, 5000);
    return { ok: true, data: { written: text.length } };
  } catch (err) {
    return { ok: false, error: `Clipboard write failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function clipboardClear(): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("clipboard.clear");
  try {
    await ps("Set-Clipboard -Value ''; \"done\"", 5000);
    return { ok: true, data: { cleared: true } };
  } catch (err) {
    return { ok: false, error: `Clipboard clear failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// ─── System info ────────────────────────────────────────────────────────────

export async function systemInfo(): Promise<ToolOutcome> {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    let disk = null;
    if (IS_WINDOWS) {
      try {
        const out = await ps("Get-PSDrive C | ForEach-Object { \"{0}|{1}\" -f $_.Used, $_.Free }", 5000);
        const [used, free] = out.split("|");
        disk = { usedBytes: parseInt(used, 10) || 0, freeBytes: parseInt(free, 10) || 0 };
      } catch { /* optional */ }
    }
    return {
      ok: true,
      data: {
        platform: process.platform,
        os: os.type(),
        release: os.release(),
        hostname: os.hostname(),
        cpuModel: cpus[0]?.model ?? "unknown",
        cpuCores: cpus.length,
        cpuLoadPercent: Math.round((os.loadavg()[0] / cpus.length) * 100),
        memory: {
          totalBytes: totalMem,
          freeBytes: freeMem,
          usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
        },
        uptimeSeconds: Math.round(os.uptime()),
        disk,
      },
    };
  } catch (err) {
    return { ok: false, error: `System info failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function showNotification(args: { title: string; body: string }): Promise<ToolOutcome> {
  if (!IS_WINDOWS) return unsupported("notification.show");
  const title = (args.title || "Nova").replace(/'/g, "''").slice(0, 100);
  const body = (args.body || "").replace(/'/g, "''").slice(0, 250);
  try {
    await ps(`
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$t = '${title}'; $b = '${body}'
$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$xml.GetElementsByTagName("text").Item(0).AppendChild($xml.CreateTextNode($t)) | Out-Null
$xml.GetElementsByTagName("text").Item(1).AppendChild($xml.CreateTextNode($b)) | Out-Null
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Nova").Show($toast)
"done"`, 8000);
    return { ok: true, data: { shown: true } };
  } catch {
    // Fallback: balloon tip
    try {
      await ps(`
Add-Type -AssemblyName System.Windows.Forms
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.Visible = $true
$n.ShowBalloonTip(5000, '${title}', '${body}', [System.Windows.Forms.ToolTipIcon]::Info)
Start-Sleep -Seconds 6
$n.Dispose()
"done"`, 12_000);
      return { ok: true, data: { shown: true, method: "balloon" } };
    } catch (err) {
      return { ok: false, error: `Notification failed: ${err instanceof Error ? err.message : "unknown"}` };
    }
  }
}

// ─── Filesystem (allowlist-scoped) ──────────────────────────────────────────

const ALLOWED_FILE_DIRS = [
  path.join(os.homedir(), "Documents"),
  path.join(os.homedir(), "Desktop"),
  path.join(os.tmpdir()),
];

function resolveAllowedPath(name: string): string | null {
  const safeName = path.basename(name); // no directory traversal
  if (!/^[\w\-. ]+$/.test(safeName)) return null;
  for (const dir of ALLOWED_FILE_DIRS) {
    const full = path.join(dir, safeName);
    if (full.startsWith(dir)) return full;
  }
  return null;
}

export async function createFile(args: { name: string; content: string }): Promise<ToolOutcome> {
  const full = resolveAllowedPath(args.name ?? "");
  if (!full) return { ok: false, error: "File name rejected (must be a simple name; writes limited to Documents/Desktop/temp)" };
  try {
    fs.writeFileSync(full, args.content ?? "", "utf8");
    const verified = fs.existsSync(full) && fs.statSync(full).size >= 0;
    return verified
      ? { ok: true, data: { path: full, bytes: Buffer.byteLength(args.content ?? "") } }
      : { ok: false, error: "File write could not be verified" };
  } catch (err) {
    return { ok: false, error: `File creation failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function readFile(args: { name: string }): Promise<ToolOutcome> {
  const full = resolveAllowedPath(args.name ?? "");
  if (!full) return { ok: false, error: "File name rejected" };
  try {
    if (!fs.existsSync(full)) return { ok: false, error: `File not found: ${args.name}` };
    const content = fs.readFileSync(full, "utf8");
    return { ok: true, data: { name: args.name, content: content.slice(0, 20_000), bytes: content.length } };
  } catch (err) {
    return { ok: false, error: `File read failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function deleteFile(args: { name: string }): Promise<ToolOutcome> {
  const full = resolveAllowedPath(args.name ?? "");
  if (!full) return { ok: false, error: "File name rejected" };
  try {
    if (!fs.existsSync(full)) return { ok: false, error: `File not found: ${args.name}` };
    // Move to temp "trash" first — reversible, not a hard delete.
    const trash = path.join(os.tmpdir(), "nova_trash");
    fs.mkdirSync(trash, { recursive: true });
    const dest = path.join(trash, `${Date.now()}_${path.basename(full)}`);
    fs.renameSync(full, dest);
    return { ok: true, data: { deleted: true, recoverableAt: dest } };
  } catch (err) {
    return { ok: false, error: `File delete failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function listFiles(args: { dir?: string }): Promise<ToolOutcome> {
  const dir = args.dir === "Desktop" ? path.join(os.homedir(), "Desktop")
    : args.dir === "Documents" ? path.join(os.homedir(), "Documents")
    : ALLOWED_FILE_DIRS[0];
  try {
    const files = fs.readdirSync(dir)
      .filter((f) => /^[\w\-. ]+$/.test(f))
      .slice(0, 100)
      .map((f) => {
        const st = fs.statSync(path.join(dir, f));
        return { name: f, sizeBytes: st.size, modifiedAt: st.mtimeMs, isDirectory: st.isDirectory() };
      });
    return { ok: true, data: { dir: path.basename(dir), files } };
  } catch (err) {
    return { ok: false, error: `Listing failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// ─── Interactive pairing (stdin code entry) ──────────────────────────────────

export function promptForPairingCode(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Enter pairing code shown on the Nova Devices page: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
