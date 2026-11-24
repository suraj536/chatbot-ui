import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import OpenAI from "openai"

export const runtime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { input, model } = json as {
    input: string
    model?: string
  }

  try {
    const profile = await getServerProfile()

    const isGoogleModel =
      model?.startsWith("gemini") ||
      (!model &&
        Boolean(
          profile.google_gemini_api_key || process.env.GOOGLE_GEMINI_API_KEY
        ) &&
        !profile.openai_api_key &&
        !process.env.OPENAI_API_KEY)

    if (isGoogleModel) {
      const apiKey =
        profile.google_gemini_api_key ||
        process.env.GOOGLE_GEMINI_API_KEY ||
        ""

      checkApiKey(apiKey, "Google")

      const modelId = model || "gemini-2.0-flash"

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
                role: "user",
                parts: [{ text: input }]
              }
            ],
            systemInstruction: {
              parts: [{ text: "Respond to the user." }]
            },
            generationConfig: {
              temperature: 0
            }
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
            `Google Gemini API error: ${response.status} ${response.statusText}`
        )
      }

      const content =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || ""

      return new Response(JSON.stringify({ content }), {
        status: 200
      })
    }

    // Default to OpenAI
    const openaiApiKey =
      profile.openai_api_key || process.env.OPENAI_API_KEY || ""

    checkApiKey(openaiApiKey, "OpenAI")

    const openai = new OpenAI({
      apiKey: openaiApiKey,
      organization: profile.openai_organization_id
    })

    const response = await openai.chat.completions.create({
      model: model || "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: "Respond to the user."
        },
        {
          role: "user",
          content: input
        }
      ],
      temperature: 0,
      max_tokens:
        CHAT_SETTING_LIMITS["gpt-4-turbo-preview"]?.MAX_TOKEN_OUTPUT_LENGTH || 4096
    })

    const content = response.choices[0].message.content

    return new Response(JSON.stringify({ content }), {
      status: 200
    })
  } catch (error: any) {
    const errorMessage =
      error?.message || error?.error?.message || "An unexpected error occurred"
    const errorCode = error?.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
