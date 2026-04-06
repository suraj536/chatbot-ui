import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"

export const runtime = "edge"

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

    const lastMessage = messages[messages.length - 1]
    const userMessage =
      lastMessage?.content ||
      lastMessage?.parts?.[0]?.text ||
      ""

    const modelId = chatSettings?.model || "gemini-2.0-flash"

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: userMessage }]
            }
          ],
          generationConfig: {
            temperature: chatSettings?.temperature || 0.7
          }
        })
      }
    )

    const data = await response.json()
    console.log("Gemini RAW:", JSON.stringify(data))

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