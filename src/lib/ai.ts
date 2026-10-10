import "server-only";
import OpenAI from "openai";

// DeepSeek speaks the OpenAI API.
export const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
});

export const CHAT_MODEL = "deepseek-chat";
