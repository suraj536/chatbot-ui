import { LLM } from "@/types/llms"

const GOOGLE_PLATORM_LINK = "https://ai.google.dev/"

// Gemini 2.0 Flash
const GEMINI_2_0_FLASH: LLM = {
  modelId: "gemini-2.0-flash",
  modelName: "Gemini 2.0 Flash",
  provider: "google",
  hostedId: "gemini-2.0-flash",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true
}

// Gemini 2.5 Flash
const GEMINI_2_5_FLASH: LLM = {
  modelId: "gemini-2.5-flash",
  modelName: "Gemini 2.5 Flash",
  provider: "google",
  hostedId: "gemini-2.5-flash",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true
}

// Gemini 2.5 Pro
const GEMINI_2_5_PRO: LLM = {
  modelId: "gemini-2.5-pro",
  modelName: "Gemini 2.5 Pro",
  provider: "google",
  hostedId: "gemini-2.5-pro",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true
}

// Gemini 2.0 Flash Lite
const GEMINI_2_0_FLASH_LITE: LLM = {
  modelId: "gemini-2.0-flash-lite",
  modelName: "Gemini 2.0 Flash Lite",
  provider: "google",
  hostedId: "gemini-2.0-flash-lite",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true
}

export const GOOGLE_LLM_LIST: LLM[] = [
  GEMINI_2_0_FLASH,
  GEMINI_2_5_FLASH,
  GEMINI_2_5_PRO,
  GEMINI_2_0_FLASH_LITE
]