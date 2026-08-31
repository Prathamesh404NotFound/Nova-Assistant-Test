export function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "")
    .replace(/\s+/g, " ");
}

const STATIC_RESPONSES: Record<string, string[]> = {
  "hello": ["Hey! How can I help?", "Hello! Ready when you are.", "Hey there!"],
  "hi": ["Hey! What can I do for you?", "Hi! What are we working on?", "Hello!"],
  "hey": ["Hey! I'm here.", "Hey! How can I assist you?", "Hey!"],
  "hey nova": ["Hey! I'm listening.", "Ready! What do you need?", "Nova online. How can I help?"],
  "hello nova": ["Hello! How can I assist you today?", "Hey! Nova here."],
  "hi nova": ["Hi! What can I do for you?", "Hey Nova here."],
  "how are you": ["I'm running perfectly. What are we working on?", "All systems operational! How are you?"],
  "how are you doing": ["Doing great! Ready for your commands.", "Running smoothly. What's on your mind?"],
  "who are you": ["I'm Nova, your local-first AI Personal Operating System.", "I'm Nova, your AI Personal OS."],
  "what is your name": ["My name is Nova.", "I am Nova, your AI Personal Operating System."],
  "thank you": ["Anytime!", "Glad to help!", "You're very welcome."],
  "thanks": ["You got it!", "Anytime!", "Happy to help!"],
  "good morning": ["Good morning. Ready when you are.", "Morning! How can I help start your day?"],
  "good night": ["Good night! Sleep well.", "Rest well! I'll be here whenever you need me."],
  "bye": ["Goodbye! Have a great day.", "Catch you later!", "Bye for now!"],
  "goodbye": ["Goodbye! Let me know if you need anything later.", "Bye for now!"],
  "are you there": ["Always.", "Right here!", "Online and ready."],
  "stop": ["Stopped.", "Standing by."],
  "cancel": ["Cancelled.", "Operation cancelled."],
  "nice": ["Glad you think so!", "Awesome!"],
  "cool": ["Glad you like it!", "Sweet!"],
};

export class ResponseCache {
  static getResponse(input: string): string | null {
    const normalized = normalizeInput(input);
    const matches = STATIC_RESPONSES[normalized];
    if (matches && matches.length > 0) {
      const idx = Math.floor(Math.random() * matches.length);
      return matches[idx];
    }
    return null;
  }
}
