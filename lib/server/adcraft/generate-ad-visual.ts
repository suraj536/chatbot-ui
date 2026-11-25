import {
  AD_FORMAT_STABILITY_MAP,
  AdFormatName,
  AdVisualGenerationRequest,
  GeneratedAdVisual,
  GeneratedAdVisualSchema,
  SUPPORTED_STABILITY_MODELS,
  SupportedStabilityModel
} from "@/types/adcraft"

export class AdVisualGenerationError extends Error {
  status: number
  code: string

  constructor(message: string, status = 500, code = "VISUAL_GENERATION_FAILED") {
    super(message)
    this.name = "AdVisualGenerationError"
    this.status = status
    this.code = code
  }
}

/**
 * Standard negative prompt enforcing clean, advertising-ready background aesthetics.
 * Prevents text, watermarks, typography, and logos from being rendered into the background visual.
 */
export const DEFAULT_AD_NEGATIVE_PROMPT =
  "text, typography, words, letters, numbers, watermark, signature, blurry, low quality, distorted, logo, price tag, banner text, UI elements, button, person holding sign, advertisement text"

/**
 * Maps an AdCraft creative format to Stability AI's accepted aspect_ratio string.
 * - square -> "1:1"
 * - portrait -> "4:5"
 * - story -> "9:16"
 * - landscape -> "16:9" (closest supported Stability AI aspect ratio for 1.91:1 banner)
 */
export function mapAdFormatToStabilityAspectRatio(format: AdFormatName): string {
  return AD_FORMAT_STABILITY_MAP[format] || "1:1"
}

/**
 * Resolves the upstream Stability AI API endpoint based on the selected model.
 */
export function resolveStabilityEndpoint(modelId: SupportedStabilityModel): string {
  switch (modelId) {
    case "stability-image-core":
      return "https://api.stability.ai/v2beta/stable-image/generate/core"
    case "stability-image-ultra":
    case "stability-video":
    default:
      return "https://api.stability.ai/v2beta/stable-image/generate/ultra"
  }
}

export interface GenerateAdVisualParams {
  request: AdVisualGenerationRequest
  apiKey: string
  modelId?: SupportedStabilityModel | string
  fetchFn?: typeof fetch
}

/**
 * Invokes Stability AI to generate an advertising background visual.
 */
export async function generateAdvertisingVisual({
  request,
  apiKey,
  modelId = "stability-image-ultra",
  fetchFn
}: GenerateAdVisualParams): Promise<GeneratedAdVisual> {
  const activeFetch =
    fetchFn ||
    (typeof fetch !== "undefined" ? fetch : (globalThis as any).fetch)

  if (!apiKey || apiKey.trim() === "") {
    throw new AdVisualGenerationError(
      "Stability AI API Key not found. Please configure it in your profile settings or environment variables.",
      400,
      "MISSING_API_KEY"
    )
  }

  if (!SUPPORTED_STABILITY_MODELS.includes(modelId as any)) {
    throw new AdVisualGenerationError(
      `Unsupported Stability model '${modelId}'. Supported models are: ${SUPPORTED_STABILITY_MODELS.join(", ")}`,
      400,
      "INVALID_MODEL"
    )
  }

  const endpoint = resolveStabilityEndpoint(modelId as SupportedStabilityModel)
  const stabilityAspectRatio = mapAdFormatToStabilityAspectRatio(request.format || "square")

  const negativePrompt = request.negativePrompt
    ? `${DEFAULT_AD_NEGATIVE_PROMPT}, ${request.negativePrompt.trim()}`
    : DEFAULT_AD_NEGATIVE_PROMPT

  const formData = new FormData()
  formData.append("prompt", request.backgroundPrompt)
  formData.append("aspect_ratio", stabilityAspectRatio)
  formData.append("negative_prompt", negativePrompt)
  formData.append("output_format", "webp")

  if (typeof request.seed === "number") {
    formData.append("seed", String(request.seed))
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout for image diffusion

  let response: Response

  try {
    response = await activeFetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      },
      body: formData,
      signal: controller.signal
    })
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err?.name === "AbortError") {
      throw new AdVisualGenerationError(
        "Stability AI request timed out after 30 seconds. Please try again.",
        504,
        "TIMEOUT"
      )
    }
    throw new AdVisualGenerationError(
      `Failed to connect to Stability AI API: ${err.message || "Network error"}`,
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
    throw new AdVisualGenerationError(
      `Failed to read response body from Stability AI: ${err?.message || "Unknown error"}`,
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
      "Stability AI service is temporarily unavailable. Please try again shortly."

    if (response.status === 429 || response.status === 402) {
      status = 429
      code = "RATE_LIMIT_OR_CREDITS_EXHAUSTED"
      sanitizedMessage =
        "Stability AI rate limit reached or credits exhausted. Please verify your Stability account balance or try again later."
    } else if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403
    ) {
      status = 400
      code = "INVALID_API_KEY_OR_REQUEST"
      sanitizedMessage =
        "Invalid or unauthorized Stability AI request. Please verify your API key in profile settings."
    } else if (response.status === 500 || response.status === 503) {
      status = 502
      code = "UPSTREAM_SERVICE_UNAVAILABLE"
      sanitizedMessage =
        "Stability AI service is temporarily unavailable. Please try again shortly."
    }

    const errorDetails = data?.errors || data?.error?.message || response.statusText
    console.error("Upstream Stability API error encountered:", {
      status: response.status,
      statusText: response.statusText,
      code,
      detailsSnippet:
        typeof errorDetails === "string"
          ? errorDetails.slice(0, 150)
          : Array.isArray(errorDetails)
            ? String(errorDetails[0]).slice(0, 150)
            : "No details"
    })

    throw new AdVisualGenerationError(sanitizedMessage, status, code)
  }

  if (!data) {
    console.error("Stability returned non-JSON response:", {
      status: response.status,
      responseLength: responseText?.length || 0
    })
    throw new AdVisualGenerationError(
      "Stability AI returned an invalid or unparseable response. Please try again.",
      502,
      "MALFORMED_AI_RESPONSE"
    )
  }

  if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    console.error("Stability returned generation error in payload:", data.errors)
    throw new AdVisualGenerationError(
      "Stability AI was unable to generate the image. Please try a different prompt.",
      502,
      "GENERATION_REJECTED"
    )
  }

  if (!data.image || typeof data.image !== "string" || data.image.trim() === "") {
    throw new AdVisualGenerationError(
      "Stability AI returned an empty image result.",
      502,
      "EMPTY_IMAGE_RESPONSE"
    )
  }

  const base64 = data.image.trim()
  const dataUrl = `data:image/webp;base64,${base64}`

  const generatedVisual: GeneratedAdVisual = {
    base64,
    dataUrl,
    format: "webp",
    aspectRatio: stabilityAspectRatio,
    finishReason: data.finish_reason || "SUCCESS",
    seed: typeof data.seed === "number" ? data.seed : undefined
  }

  const validation = GeneratedAdVisualSchema.safeParse(generatedVisual)
  if (!validation.success) {
    const issues = validation.error.issues.map(i => i.message).join("; ")
    throw new AdVisualGenerationError(
      `Generated image payload failed validation: ${issues}`,
      502,
      "SCHEMA_VALIDATION_ERROR"
    )
  }

  return validation.data
}
