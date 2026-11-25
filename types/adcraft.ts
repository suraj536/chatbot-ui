import { z } from "zod"

// Supported advertising platforms
export const AD_PLATFORMS = [
  "instagram",
  "facebook",
  "google",
  "linkedin",
  "twitter",
  "tiktok"
] as const

export type AdPlatform = (typeof AD_PLATFORMS)[number]

// Supported advertising tones
export const AD_TONES = [
  "professional",
  "urgent",
  "casual",
  "luxurious",
  "playful",
  "inspirational"
] as const

export type AdTone = (typeof AD_TONES)[number]

// Supported creative formats and their default standard resolutions
export const AD_FORMATS = {
  square: {
    name: "square",
    label: "Square (1:1)",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    recommendedFor: ["instagram", "facebook", "linkedin"]
  },
  portrait: {
    name: "portrait",
    label: "Portrait (4:5)",
    width: 1080,
    height: 1350,
    aspectRatio: "4:5",
    recommendedFor: ["instagram", "facebook"]
  },
  story: {
    name: "story",
    label: "Story / Reel (9:16)",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    recommendedFor: ["instagram", "tiktok", "facebook"]
  },
  landscape: {
    name: "landscape",
    label: "Landscape Banner (1.91:1)",
    width: 1200,
    height: 628,
    aspectRatio: "1.91:1",
    recommendedFor: ["facebook", "google", "twitter", "linkedin"]
  }
} as const

export type AdFormatName = keyof typeof AD_FORMATS

// Supported Gemini LLM Models (aligned with GOOGLE_LLM_LIST)
export const SUPPORTED_GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash-lite"
] as const

export type SupportedGeminiModel = (typeof SUPPORTED_GEMINI_MODELS)[number]

// ============================================================================
// 1. REQUEST SCHEMA (Validated Input Contract)
// ============================================================================
export const AdGenerationRequestSchema = z.object({
  productName: z
    .string({ required_error: "Product name is required" })
    .trim()
    .min(1, "Product name cannot be empty")
    .max(120, "Product name cannot exceed 120 characters"),

  productDescription: z
    .string({ required_error: "Product description is required" })
    .trim()
    .min(5, "Product description must be at least 5 characters")
    .max(2000, "Product description cannot exceed 2000 characters"),

  targetAudience: z
    .string()
    .trim()
    .max(300, "Target audience cannot exceed 300 characters")
    .optional(),

  productFeatures: z
    .array(z.string().trim().max(200, "Feature item cannot exceed 200 characters"))
    .max(10, "Maximum of 10 feature bullet points allowed")
    .optional(),

  price: z
    .string()
    .trim()
    .max(50, "Price text cannot exceed 50 characters")
    .optional(),

  offer: z
    .string()
    .trim()
    .max(100, "Offer text cannot exceed 100 characters")
    .optional(),

  campaignObjective: z
    .string()
    .trim()
    .max(80, "Campaign objective cannot exceed 80 characters")
    .optional(),

  platform: z
    .enum(AD_PLATFORMS, {
      errorMap: () => ({
        message: `Platform must be one of: ${AD_PLATFORMS.join(", ")}`
      })
    })
    .default("instagram"),

  tone: z
    .enum(AD_TONES, {
      errorMap: () => ({
        message: `Tone must be one of: ${AD_TONES.join(", ")}`
      })
    })
    .default("professional"),

  callToAction: z
    .string()
    .trim()
    .max(60, "Call to action cannot exceed 60 characters")
    .optional(),

  brandName: z
    .string()
    .trim()
    .max(100, "Brand name cannot exceed 100 characters")
    .optional(),

  brandColors: z
    .array(
      z
        .string()
        .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Colors must be valid hex codes (e.g. #FF0000)")
    )
    .max(5, "Maximum of 5 brand colors allowed")
    .optional(),

  format: z
    .enum(["square", "portrait", "story", "landscape"] as const, {
      errorMap: () => ({
        message: "Format must be one of: square, portrait, story, landscape"
      })
    })
    .default("square"),

  model: z
    .enum(SUPPORTED_GEMINI_MODELS, {
      errorMap: () => ({
        message: `Model must be one of: ${SUPPORTED_GEMINI_MODELS.join(", ")}`
      })
    })
    .optional(),

  workspaceId: z.string().uuid("Invalid workspace ID format").optional()
})

export type AdGenerationRequest = z.infer<typeof AdGenerationRequestSchema>

// ============================================================================
// 2. STRUCTURED GEMINI OUTPUT SCHEMA (Validated AI Copy Contract)
// ============================================================================
export const GeneratedAdCopySchema = z.object({
  headline: z
    .string()
    .trim()
    .min(3, "Headline too short")
    .max(150, "Headline too long"),

  primaryText: z
    .string()
    .trim()
    .min(10, "Primary text too short")
    .max(600, "Primary text too long"),

  description: z
    .string()
    .trim()
    .min(5, "Description too short")
    .max(350, "Description too long"),

  callToAction: z
    .string()
    .trim()
    .min(2, "Call to action too short")
    .max(60, "Call to action too long"),

  visualDirection: z
    .string()
    .trim()
    .min(10, "Visual direction description too short")
    .max(600, "Visual direction description too long"),

  backgroundPrompt: z
    .string()
    .trim()
    .min(10, "Background visual prompt too short")
    .max(700, "Background visual prompt too long"),

  suggestedLayout: z.object({
    textPlacement: z.enum(["top", "bottom", "left", "right", "center"]),
    productPlacement: z.enum(["center", "right", "bottom", "floating"]),
    colorPaletteSuggestion: z
      .array(
        z
          .string()
          .regex(
            /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
            "Color palette suggestion must be a valid hex code (e.g. #FF0000)"
          )
      )
      .max(8, "Maximum of 8 color palette suggestions allowed")
      .optional()
  }),

  headlineAlternatives: z.array(z.string().trim()).max(5).optional(),

  copyAlternatives: z.array(z.string().trim()).max(5).optional()
})

export type GeneratedAdCopy = z.infer<typeof GeneratedAdCopySchema>

// ============================================================================
// 3. API RESPONSE SCHEMA (Standardized HTTP Contract)
// ============================================================================
export const AdCopyResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    copy: GeneratedAdCopySchema,
    platform: z.enum(AD_PLATFORMS),
    format: z.object({
      name: z.string(),
      label: z.string(),
      width: z.number(),
      height: z.number(),
      aspectRatio: z.string()
    }),
    metadata: z.object({
      model: z.string(),
      generatedAt: z.string(),
      productName: z.string(),
      brandName: z.string().optional()
    })
  })
})

export type AdCopyResponse = z.infer<typeof AdCopyResponseSchema>

// ============================================================================
// PHASE A2: STABILITY AI BACKGROUND VISUAL GENERATION CONTRACTS
// ============================================================================

// Supported Stability AI Visual Models
export const SUPPORTED_STABILITY_MODELS = [
  "stability-image-ultra",
  "stability-image-core",
  "stability-video"
] as const

export type SupportedStabilityModel = (typeof SUPPORTED_STABILITY_MODELS)[number]

// Map of AdCraft Format to Stability AI Aspect Ratio
export const AD_FORMAT_STABILITY_MAP: Record<AdFormatName, string> = {
  square: "1:1",
  portrait: "4:5",
  story: "9:16",
  landscape: "16:9" // Closest supported Stability aspect ratio to 1.91:1 banner
}

// ============================================================================
// 4. VISUAL GENERATION REQUEST SCHEMA (Phase A2 Validated Input Contract)
// ============================================================================
export const AdVisualGenerationRequestSchema = z.object({
  backgroundPrompt: z
    .string({ required_error: "Background prompt is required" })
    .trim()
    .min(5, "Background prompt must be at least 5 characters")
    .max(1000, "Background prompt cannot exceed 1000 characters"),

  format: z
    .enum(["square", "portrait", "story", "landscape"] as const, {
      errorMap: () => ({
        message: "Format must be one of: square, portrait, story, landscape"
      })
    })
    .default("square"),

  model: z
    .enum(SUPPORTED_STABILITY_MODELS, {
      errorMap: () => ({
        message: `Model must be one of: ${SUPPORTED_STABILITY_MODELS.join(", ")}`
      })
    })
    .optional(),

  negativePrompt: z
    .string()
    .trim()
    .max(500, "Negative prompt cannot exceed 500 characters")
    .optional(),

  seed: z
    .number()
    .int("Seed must be an integer")
    .min(0, "Seed must be at least 0")
    .max(4294967295, "Seed cannot exceed 4294967295")
    .optional(),

  workspaceId: z.string().uuid("Invalid workspace ID format").optional()
})

export type AdVisualGenerationRequest = z.infer<typeof AdVisualGenerationRequestSchema>

// ============================================================================
// 5. STRUCTURED STABILITY OUTPUT SCHEMA (Validated AI Image Result Contract)
// ============================================================================
export const GeneratedAdVisualSchema = z.object({
  base64: z.string().min(1, "Base64 image string cannot be empty"),
  dataUrl: z
    .string()
    .regex(/^data:image\/(webp|png|jpeg);base64,/, "Must be a valid base64 image data URL"),
  format: z.enum(["webp", "png", "jpeg"]).default("webp"),
  aspectRatio: z.string(),
  finishReason: z.string(),
  seed: z.number().optional()
})

export type GeneratedAdVisual = z.infer<typeof GeneratedAdVisualSchema>

// ============================================================================
// 6. VISUAL API RESPONSE SCHEMA (Standardized HTTP Contract for Phase A2)
// ============================================================================
export const AdVisualResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    image: GeneratedAdVisualSchema,
    format: z.object({
      name: z.string(),
      label: z.string(),
      width: z.number(),
      height: z.number(),
      aspectRatio: z.string(),
      stabilityAspectRatio: z.string()
    }),
    metadata: z.object({
      model: z.string(),
      generatedAt: z.string(),
      promptLength: z.number()
    })
  })
})

export type AdVisualResponse = z.infer<typeof AdVisualResponseSchema>
