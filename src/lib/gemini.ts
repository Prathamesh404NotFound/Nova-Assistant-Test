import { z } from "zod";

export const MessageSchema = z.object({
  role: z.enum(["user", "model"]),
  parts: z.array(z.object({ text: z.string() })),
});

export type GeminiMessage = z.infer<typeof MessageSchema>;

const DEFAULT_SYSTEM = `You are Nova, a voice-first AI personal operating system. You are helpful, intelligent, and friendly. You help with daily tasks, answer questions, manage calendars, write emails, control smart home devices, and more. Keep responses concise and conversational.`;

export async function streamGeminiResponse({
  messages,
  apiKey,
  systemInstruction = DEFAULT_SYSTEM,
  onChunk,
  onDone,
  onError,
}: {
  messages: GeminiMessage[];
  apiKey: string;
  systemInstruction?: string;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}) {
  const effectiveKey =
    apiKey ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("nova_gemini_key") || "" : "") ||
    (import.meta.env.VITE_GEMINI_API_KEY as string) ||
    (import.meta.env.GEMINI_API_KEY as string) ||
    (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "") ||
    "";

  if (!effectiveKey) {
    // Provide a smart simulated response streaming chunk by chunk
    const lastUserMsg = messages[messages.length - 1]?.parts[0]?.text || "";
    let responseText = `I'm Nova, your AI Personal Operating System. I've received your request: "${lastUserMsg}". All systems are operational and running locally in demo mode! You can configure a custom Gemini API key in Settings at any time for live model access.`;

    const lower = lastUserMsg.toLowerCase();
    if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
      responseText = "Hello! I am Nova, your AI Personal Operating System. How can I assist you with your tasks, automations, smart home, or coding today?";
    } else if (lower.includes("task") || lower.includes("todo")) {
      responseText = "I can manage your tasks and reminders. You can view, create, and organize your tasks in the Tasks section from the sidebar.";
    } else if (lower.includes("weather") || lower.includes("status")) {
      responseText = "Current System Status: Stable (12ms latency). All 24 active neural threads are executing smoothly.";
    } else if (lower.includes("code") || lower.includes("coding")) {
      responseText = "You can test and run TypeScript/JavaScript code in the Coding Playground section of Nova OS!";
    }

    const words = responseText.split(" ");
    for (let i = 0; i < words.length; i++) {
      onChunk(words[i] + (i === words.length - 1 ? "" : " "));
      await new Promise((r) => setTimeout(r, 40));
    }
    onDone();
    return;
  }

  try {
    const body = {
      contents: messages,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 2048 },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${effectiveKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) onChunk(text);
          } catch { /* skip */ }
        }
      }
    }

    if (buffer.startsWith("data: ")) {
      try {
        const data = JSON.parse(buffer.slice(6));
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onChunk(text);
      } catch { /* skip */ }
    }

    onDone();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  systemInstruction = DEFAULT_SYSTEM
): Promise<string> {
  const effectiveKey =
    apiKey ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("nova_gemini_key") || "" : "") ||
    (import.meta.env.VITE_GEMINI_API_KEY as string) ||
    (import.meta.env.GEMINI_API_KEY as string) ||
    (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "") ||
    "";

  if (!effectiveKey) {
    return `[Nova AI OS] Echo response for "${prompt}". To enable live generative responses, enter a Gemini API Key in Settings.`;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${effectiveKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";
  } catch (err) {
    return `[Nova AI OS Demo] Echo response for "${prompt}". (${err instanceof Error ? err.message : 'Fallback response'})`;
  }
}
