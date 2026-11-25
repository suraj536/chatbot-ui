import {
  AD_FORMATS,
  AdGenerationRequest,
  GeneratedAdCopy,
  GeneratedAdCopySchema,
  SUPPORTED_GEMINI_MODELS,
  SupportedGeminiModel
} from "@/types/adcraft"

export class AdCopyGenerationError extends Error {
  status: number
  code: string

  constructor(message: string, status = 500, code = "GENERATION_FAILED") {
    super(message)
    this.name = "AdCopyGenerationError"
    this.status = status
    this.code = code
  }
}

/**
 * Builds the strict advertising system instruction enforcing accuracy and compliance.
 */
export function buildAdCopySystemInstruction(): string {
  return `You are AdCraft AI's Senior Advertising Creative Director & Copywriting Engine.
Your role is to write high-converting, professional advertising copy and visual background direction for product campaigns.

STRICT ACCURACY RULES (CRITICAL):
1. Product Accuracy:
   - Do NOT invent product attributes, materials, dimensions, or technical specifications.
   - Do NOT invent product benefits not supplied or reasonably supported by the product description.
   - Do NOT invent false certifications, customer reviews, testimonials, clinical claims, warranties, or regulatory guarantees.
   - NEVER alter or misspell the provided product name.

2. Pricing & Offers Accuracy:
   - NEVER invent a price, discount percentage, promo code, or promotional offer.
   - ONLY reference the price or offer if explicitly provided in the user request.
   - If no price or offer was provided, do NOT mention any price, discount, or sale in the copy.

3. Platform & Copy Rules:
   - Tailor the headline length, tone, and character density to the specified platform (Instagram, Facebook, Google Ads, LinkedIn, Twitter, TikTok).
   - Match the requested advertising tone (Professional, Urgent, Casual, Luxurious, Playful, Inspirational).
   - Keep the Call-To-Action (CTA) punchy, action-oriented, and aligned with the campaign objective.

4. Visual Background Prompt Rules (FOR STABILITY AI):
   - The "backgroundPrompt" is fed into an image diffusion model to generate an atmospheric aesthetic backdrop.
   - It MUST NEVER instruct the model to render words, letters, text overlays, price tags, logos, or UI elements (diffusion models fail at text).
   - It MUST describe clean studio lighting, realistic textures, cinematic lighting, and negative space where the product photo and text can be composited.
   - Respect the specified creative aspect ratio.

OUTPUT FORMAT:
You MUST respond with a valid, parseable JSON object matching this exact schema:
{
  "headline": "Punchy main hook / headline (10-60 characters)",
  "primaryText": "Compelling primary advertising copy (20-250 characters)",
  "description": "Supporting description or subhead (10-150 characters)",
  "callToAction": "Action-oriented CTA phrase (2-30 characters)",
  "visualDirection": "Art direction notes explaining layout, placement, and visual hierarchy",
  "backgroundPrompt": "A detailed commercial background visual prompt (NO text, NO words, studio lighting, negative space for product)",
  "suggestedLayout": {
    "textPlacement": "top" | "bottom" | "left" | "right" | "center",
    "productPlacement": "center" | "right" | "bottom" | "floating",
    "colorPaletteSuggestion": ["#HEX1", "#HEX2", "#HEX3"]
  },
  "headlineAlternatives": ["Alternative headline 1", "Alternative headline 2"],
  "copyAlternatives": ["Alternative primary copy 1", "Alternative primary copy 2"]
}`
}

/**
 * Builds the user prompt detailing the product, audience, and campaign parameters.
 */
export function buildAdCopyUserPrompt(request: AdGenerationRequest): string {
  const parts: string[] = []

  parts.push("PRODUCT INFORMATION:")
  parts.push(`- Product Name: ${request.productName}`)
  parts.push(`- Product Description: ${request.productDescription}`)

  if (request.brandName) {
    parts.push(`- Brand Name: ${request.brandName}`)
  }
  if (request.productFeatures && request.productFeatures.length > 0) {
    parts.push(`- Key Features:\n  * ${request.productFeatures.join("\n  * ")}`)
  }
  if (request.price) {
    parts.push(`- Exact Price: ${request.price}`)
  }
  if (request.offer) {
    parts.push(`- Exact Promotional Offer: ${request.offer}`)
  }

  parts.push("\nCAMPAIGN PARAMETERS:")
  parts.push(`- Advertising Platform: ${request.platform.toUpperCase()}`)
  parts.push(`- Copywriting Tone: ${request.tone.toUpperCase()}`)
  const formatMeta = AD_FORMATS[request.format || "square"]
  parts.push(
    `- Creative Format: ${formatMeta.label} (${formatMeta.width}x${formatMeta.height}, Aspect Ratio ${formatMeta.aspectRatio})`
  )

  if (request.targetAudience) {
    parts.push(`- Target Audience: ${request.targetAudience}`)
  }
  if (request.campaignObjective) {
    parts.push(`- Campaign Objective: ${request.campaignObjective}`)
  }
  if (request.callToAction) {
    parts.push(`- Preferred Call to Action: ${request.callToAction}`)
  }
  if (request.brandColors && request.brandColors.length > 0) {
    parts.push(`- Brand Colors: ${request.brandColors.join(", ")}`)
  }

  parts.push(
    "\nGenerate the complete, structured advertising copy and visual background prompt now as a JSON object adhering to all accuracy rules."
  )

  return parts.join("\n")
}

/**
 * Safely parses and cleans raw Gemini text output into a valid JSON object.
 */
export function cleanAndParseGeminiJson(rawText: string): any {
  if (!rawText || typeof rawText !== "string") {
    throw new AdCopyGenerationError("Empty response received from Gemini", 502, "EMPTY_RESPONSE")
  }

  let cleaned = rawText.trim()

  // Remove markdown code fences if present (e.g. ```json ... ```)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }

  // Find outermost JSON object if surrounded by extra text
  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }

  try {
    return JSON.parse(cleaned)
  } catch (err: any) {
    throw new AdCopyGenerationError(
      `Malformed JSON returned by Gemini: ${err.message}`,
      502,
      "MALFORMED_AI_RESPONSE"
    )
  }
}

export interface GenerateAdCopyParams {
  request: AdGenerationRequest
  apiKey: string
  modelId?: SupportedGeminiModel | string
  fetchFn?: typeof fetch
}

/**
 * Invokes Google Gemini to generate structured advertising copy.
 */
export async function generateAdvertisingCopy({
  request,
  apiKey,
  modelId = "gemini-2.0-flash",
  fetchFn
}: GenerateAdCopyParams): Promise<GeneratedAdCopy> {
  const activeFetch =
    fetchFn ||
    (typeof fetch !== "undefined" ? fetch : (globalThis as any).fetch)

  if (!apiKey || apiKey.trim() === "") {
    throw new AdCopyGenerationError(
      "Google Gemini API Key not found. Please configure it in your profile settings or environment variables.",
      400,
      "MISSING_API_KEY"
    )
  }

  if (!SUPPORTED_GEMINI_MODELS.includes(modelId as any)) {
    throw new AdCopyGenerationError(
      `Unsupported Gemini model '${modelId}'. Supported models are: ${SUPPORTED_GEMINI_MODELS.join(", ")}`,
      400,
      "INVALID_MODEL"
    )
  }

  const systemInstruction = buildAdCopySystemInstruction()
  const userPrompt = buildAdCopyUserPrompt(request)

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json"
    }
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout

  let response: Response

  try {
    response = await activeFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err?.name === "AbortError") {
      throw new AdCopyGenerationError(
        "Gemini API request timed out after 20 seconds. Please try again.",
        504,
        "TIMEOUT"
      )
    }
    throw new AdCopyGenerationError(
      `Failed to connect to Google Gemini API: ${err.message || "Network error"}`,
      502,
      "UPSTREAM_NETWORK_ERROR"
    )
  } finally {
    clearTimeout(timeoutId)
  }

  let responseText: string
  try {
    responseText = await response.text()
  } catch (err: any) {
    throw new AdCopyGenerationError(
      `Failed to read response body from Google Gemini API: ${err?.message || "Unknown error"}`,
      502,
      "UPSTREAM_NETWORK_ERROR"
    )
  }

  let data: any = null
  try {
    data = JSON.parse(responseText)
  } catch {
    data = null
  }

  if (!response.ok) {
    let status = 502
    let code = "UPSTREAM_API_ERROR"
    let sanitizedMessage =
      "Google Gemini service is temporarily unavailable. Please try again shortly."

    if (response.status === 429) {
      status = 429
      code = "RATE_LIMIT_EXCEEDED"
      sanitizedMessage =
        "Google Gemini rate limit reached or quota exhausted. Please check your account quota or try again later."
    } else if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403
    ) {
      status = 400
      code = "INVALID_API_KEY_OR_REQUEST"
      sanitizedMessage =
        "Invalid or unauthorized Google Gemini API request. Please verify your API key in profile settings."
    } else if (response.status === 500 || response.status === 503) {
      status = 502
      code = "UPSTREAM_SERVICE_UNAVAILABLE"
      sanitizedMessage =
        "Google Gemini service is temporarily unavailable. Please try again shortly."
    }

    console.error("Upstream Gemini API error encountered:", {
      status: response.status,
      statusText: response.statusText,
      code,
      providerMessage: data?.error?.message ? String(data.error.message).slice(0, 150) : "No details"
    })

    throw new AdCopyGenerationError(sanitizedMessage, status, code)
  }

  if (!data) {
    console.error("Gemini returned non-JSON response:", {
      status: response.status,
      snippet: responseText?.slice(0, 150)
    })
    throw new AdCopyGenerationError(
      "Gemini returned an invalid or unparseable response. Please try again.",
      502,
      "MALFORMED_AI_RESPONSE"
    )
  }

  const rawCandidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!rawCandidateText) {
    const blockReason =
      data?.promptFeedback?.blockReason ||
      data?.candidates?.[0]?.finishReason ||
      "UNKNOWN"
    console.error("Gemini returned no content candidate:", { blockReason })
    throw new AdCopyGenerationError(
      `Gemini returned no content. Finish reason: ${blockReason}`,
      502,
      "EMPTY_CANDIDATE"
    )
  }

  const parsed = cleanAndParseGeminiJson(rawCandidateText)

  const validationResult = GeneratedAdCopySchema.safeParse(parsed)

  if (!validationResult.success) {
    const issueSummary = validationResult.error.issues
      .map(i => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
    console.error("Gemini output schema validation failed:", issueSummary)
    throw new AdCopyGenerationError(
      `Gemini response failed ad copy schema validation: ${issueSummary}`,
      502,
      "SCHEMA_VALIDATION_ERROR"
    )
  }

  return validationResult.data
}
