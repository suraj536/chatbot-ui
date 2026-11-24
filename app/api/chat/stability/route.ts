import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"

export const runtime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { messages } = json

  try {
    const profile = await getServerProfile()
    const apiKey = profile.stability_api_key || process.env.STABILITY_API_KEY || ""

    checkApiKey(apiKey, "Stability AI")

    const lastMessage = messages[messages.length - 1]
    const prompt = lastMessage?.content || ""

    const response = await fetch(
      "https://api.stability.ai/v2beta/stable-image/generate/ultra",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: prompt,
          output_format: "webp"
        })
      }
    )

    const data = await response.json()
    console.log("Stability RAW:", JSON.stringify(data))

    if (data.errors || !data.image) {
      throw new Error(
        "Stability generation failed: " + JSON.stringify(data.errors || data)
      )
    }

    const imageUrl = `data:image/webp;base64,${data.image}`

    return new Response(
      `Image generated successfully!\n\n![Generated Image](${imageUrl})`,
      { headers: { "Content-Type": "text/plain" } }
    )
  } catch (error: any) {
    console.error("Stability Error:", error)
    return new Response(
      JSON.stringify({ message: error.message || "Something went wrong" }),
      { status: 500 }
    )
  }
}