import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"

export const runtime = "edge"

interface GeminiPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
  [key: string]: any
}

interface GeminiContent {
  role: "user" | "model"
  parts: GeminiPart[]
}

function extractParts(message: any): GeminiPart[] {
  if (Array.isArray(message.parts) && message.parts.length > 0) {
    return message.parts
  }

  const parts: GeminiPart[] = []

  if (typeof message.content === "string") {
    if (message.content.length > 0) {
      parts.push({ text: message.content })
    }
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (typeof part === "string") {
        parts.push({ text: part })
      } else if (part?.type === "text" && part.text) {
        parts.push({ text: part.text })
      } else if (part?.type === "image_url") {
        const url = part.image_url?.url || ""
        const match = url.match(/^data:(.*?);base64,(.*)$/)
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          })
        }
      } else if (part?.inlineData || part?.text) {
        parts.push(part)
      }
    }
  }

  if (parts.length === 0) {
    parts.push({ text: "" })
  }

  return parts
}

export async function POST(request: Request) {
  const json = await request.json()

  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const profile = await getServerProfile()
    const apiKey = profile.google_gemini_api_key

    if (!apiKey) {
      throw new Error("Missing Gemini API Key")
    }

    checkApiKey(apiKey, "Google")

    const modelId = chatSettings?.model || "gemini-2.0-flash"

    // 1. Separate system messages from conversational messages
    const systemParts: GeminiPart[] = []
    const conversationalMessages: any[] = []

    for (const message of messages || []) {
      if (message.role === "system") {
        const parts = extractParts(message)
        systemParts.push(...parts)
      } else {
        conversationalMessages.push(message)
      }
    }

    // 2. Map conversational messages to Gemini format (user | model)
    const rawContents: GeminiContent[] = conversationalMessages.map(msg => {
      let role: "user" | "model" = "user"
      if (msg.role === "assistant" || msg.role === "model") {
        role = "model"
      } else {
        role = "user"
      }

      return {
        role,
        parts: extractParts(msg)
      }
    })

    // 3. Alternate roles and merge consecutive same-role turns
    const contents: GeminiContent[] = []

    for (const content of rawContents) {
      if (contents.length === 0) {
        // Gemini contents MUST start with a "user" turn
        if (content.role === "user") {
          contents.push({ role: "user", parts: [...content.parts] })
        }
        // Discard leading "model" messages
      } else {
        const lastContent = contents[contents.length - 1]
        if (lastContent.role === content.role) {
          // Merge parts into the same turn
          lastContent.parts.push(...content.parts)
        } else {
          contents.push({ role: content.role, parts: [...content.parts] })
        }
      }
    }

    // Ensure contents has at least one valid user message
    if (contents.length === 0) {
      contents.push({
        role: "user",
        parts: [{ text: "" }]
      })
    }

    // 4. Build request payload
    const requestBody: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: chatSettings?.temperature ?? 0.7
      }
    }

    if (systemParts.length > 0) {
      requestBody.systemInstruction = {
        parts: systemParts
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(requestBody)
      }
    )

    const data = await response.json()

    if (!response.ok) {
      const errorMsg =
        data?.error?.message ||
        `Google Gemini API error: ${response.status} ${response.statusText}`
      throw new Error(errorMsg)
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from Gemini"

    return new Response(text, {
      headers: { "Content-Type": "text/plain" }
    })
  } catch (error: any) {
    console.error("Gemini Error:", error)
    return new Response(
      JSON.stringify({ message: error.message || "Something went wrong" }),
      { status: 500 }
    )
  }
}
