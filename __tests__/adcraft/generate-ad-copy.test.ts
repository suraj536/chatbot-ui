import {
  AdCopyGenerationError,
  buildAdCopySystemInstruction,
  buildAdCopyUserPrompt,
  cleanAndParseGeminiJson,
  generateAdvertisingCopy
} from "@/lib/server/adcraft/generate-ad-copy"
import {
  AD_FORMATS,
  AdCopyResponseSchema,
  AdGenerationRequest,
  AdGenerationRequestSchema,
  GeneratedAdCopySchema
} from "@/types/adcraft"

describe("AdCraft AI — Phase A1 Unit Tests", () => {
  const validRequest: AdGenerationRequest = {
    productName: "AeroGlide Runner X",
    productDescription:
      "Ultra-lightweight high-performance road running shoes featuring carbon fiber bounce plates.",
    targetAudience: "Marathon runners and fitness enthusiasts aged 20-45",
    productFeatures: [
      "Responsive carbon-fiber propulsion plate",
      "Breathable engineered mesh upper",
      "All-weather durable rubber traction"
    ],
    price: "$149.99",
    offer: "Free Shipping + 10% Off First Order",
    campaignObjective: "conversions",
    platform: "instagram",
    tone: "inspirational",
    callToAction: "Shop AeroGlide Now",
    brandName: "AeroSport Gear",
    brandColors: ["#FF4500", "#1A1A1A"],
    format: "square"
  }

  const validGeminiOutput = {
    headline: "Unleash Your True Stride",
    primaryText:
      "Engineered with responsive carbon-fiber propulsion, AeroGlide Runner X turns every road into your personal track. Feel the explosive energy return from mile 1 to 26.2.",
    description: "Ultra-lightweight carbon fiber running shoe for serious runners.",
    callToAction: "Shop AeroGlide Now",
    visualDirection:
      "A dramatic low-angle shot of a sleek running track at sunrise. Soft atmospheric morning mist with glowing natural golden hour rays across the tarmac. Wide open negative space in the center for product placement.",
    backgroundPrompt:
      "Cinematic photography of a pristine running track tarmac at golden hour dawn, soft morning mist, dramatic sun flare, clean minimalist asphalt texture, expansive empty center composition, commercial athletic studio lighting, no text, no words, no footwear, no people",
    suggestedLayout: {
      textPlacement: "top",
      productPlacement: "center",
      colorPaletteSuggestion: ["#FF4500", "#1A1A1A", "#FFFFFF"]
    },
    headlineAlternatives: [
      "Engineered for Explosive Speed",
      "Feel the Carbon Bounce"
    ],
    copyAlternatives: [
      "Take your marathon training to the next level with AeroGlide Runner X. Order today with Free Shipping."
    ]
  }

  // ==========================================================================
  // 1. REQUEST VALIDATION TESTS (Zod Schema)
  // ==========================================================================
  describe("AdGenerationRequestSchema Validation", () => {
    it("successfully validates a complete, valid request", () => {
      const parsed = AdGenerationRequestSchema.safeParse(validRequest)
      expect(parsed.success).toBe(true)
    })

    it("successfully validates a minimal valid request with default fallbacks", () => {
      const minimal = {
        productName: "Simple Mug",
        productDescription: "Ceramic coffee mug that holds 12oz of hot beverages."
      }
      const parsed = AdGenerationRequestSchema.safeParse(minimal)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.platform).toBe("instagram")
        expect(parsed.data.tone).toBe("professional")
        expect(parsed.data.format).toBe("square")
      }
    })

    it("fails when productName is missing or empty", () => {
      const invalid = { ...validRequest, productName: "" }
      const parsed = AdGenerationRequestSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].path).toContain("productName")
      }
    })

    it("fails when productDescription is too short (less than 5 chars)", () => {
      const invalid = { ...validRequest, productDescription: "Shoe" }
      const parsed = AdGenerationRequestSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].path).toContain("productDescription")
      }
    })

    it("fails when platform is unsupported", () => {
      const invalid = { ...validRequest, platform: "myspace" as any }
      const parsed = AdGenerationRequestSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("Platform must be one of")
      }
    })

    it("fails when tone is unsupported", () => {
      const invalid = { ...validRequest, tone: "angry" as any }
      const parsed = AdGenerationRequestSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("Tone must be one of")
      }
    })

    it("fails when format is unsupported", () => {
      const invalid = { ...validRequest, format: "billboard" as any }
      const parsed = AdGenerationRequestSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("Format must be one of")
      }
    })

    it("fails when brandColors contains invalid hex formats", () => {
      const invalid = { ...validRequest, brandColors: ["not-a-color", "#123456"] }
      const parsed = AdGenerationRequestSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].path).toContain("brandColors")
      }
    })

    it("fails when model is unsupported", () => {
      const invalid = { ...validRequest, model: "gpt-4-turbo" as any }
      const parsed = AdGenerationRequestSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("Model must be one of")
      }
    })

    it("successfully validates when a supported Gemini model is specified", () => {
      const withModel = { ...validRequest, model: "gemini-2.5-pro" as const }
      const parsed = AdGenerationRequestSchema.safeParse(withModel)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.model).toBe("gemini-2.5-pro")
      }
    })

    it("fails when oversized input exceeds limits (e.g. description > 2000 chars)", () => {
      const oversized = { ...validRequest, productDescription: "A".repeat(2001) }
      const parsed = AdGenerationRequestSchema.safeParse(oversized)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("2000")
      }
    })
  })

  // ==========================================================================
  // 1B. OUTPUT SCHEMA VALIDATION (Integrity & Hex Codes)
  // ==========================================================================
  describe("GeneratedAdCopySchema Validation", () => {
    it("successfully validates valid generated copy with hex palette", () => {
      const parsed = GeneratedAdCopySchema.safeParse(validGeminiOutput)
      expect(parsed.success).toBe(true)
    })

    it("fails when colorPaletteSuggestion contains invalid hex codes", () => {
      const invalidPalette = {
        ...validGeminiOutput,
        suggestedLayout: {
          ...validGeminiOutput.suggestedLayout,
          colorPaletteSuggestion: ["blue", "#123456"]
        }
      }
      const parsed = GeneratedAdCopySchema.safeParse(invalidPalette)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("valid hex code")
      }
    })

    it("accepts valid 3-digit and 6-digit hex codes in colorPaletteSuggestion", () => {
      const validPalette = {
        ...validGeminiOutput,
        suggestedLayout: {
          ...validGeminiOutput.suggestedLayout,
          colorPaletteSuggestion: ["#FFF", "#FF0000", "#1a1a1a"]
        }
      }
      const parsed = GeneratedAdCopySchema.safeParse(validPalette)
      expect(parsed.success).toBe(true)
    })
  })

  // ==========================================================================
  // 2. PROMPT BUILDING TESTS (Instruction Compliance)
  // ==========================================================================
  describe("Prompt Building & System Instructions", () => {
    it("enforces strict product accuracy rules in system instructions", () => {
      const systemInstruction = buildAdCopySystemInstruction()
      expect(systemInstruction).toContain("STRICT ACCURACY RULES")
      expect(systemInstruction).toContain("Do NOT invent product attributes")
      expect(systemInstruction).toContain("Do NOT invent false certifications")
      expect(systemInstruction).toContain("NEVER alter or misspell the provided product name")
    })

    it("enforces strict pricing and offer rules in system instructions", () => {
      const systemInstruction = buildAdCopySystemInstruction()
      expect(systemInstruction).toContain("NEVER invent a price, discount percentage")
      expect(systemInstruction).toContain("ONLY reference the price or offer if explicitly provided")
    })

    it("enforces visual background prompt rules prohibiting text in image model", () => {
      const systemInstruction = buildAdCopySystemInstruction()
      expect(systemInstruction).toContain("Visual Background Prompt Rules (FOR STABILITY AI)")
      expect(systemInstruction).toContain("MUST NEVER instruct the model to render words, letters, text overlays")
      expect(systemInstruction).toContain("negative space where the product photo and text can be composited")
    })

    it("correctly includes all campaign parameters in user prompt", () => {
      const userPrompt = buildAdCopyUserPrompt(validRequest)
      expect(userPrompt).toContain("Product Name: AeroGlide Runner X")
      expect(userPrompt).toContain("Exact Price: $149.99")
      expect(userPrompt).toContain("Exact Promotional Offer: Free Shipping + 10% Off First Order")
      expect(userPrompt).toContain("Advertising Platform: INSTAGRAM")
      expect(userPrompt).toContain("Copywriting Tone: INSPIRATIONAL")
      expect(userPrompt).toContain("Brand Name: AeroSport Gear")
      expect(userPrompt).toContain("1080x1080, Aspect Ratio 1:1")
    })
  })

  // ==========================================================================
  // 3. JSON PARSING & CLEANING TESTS
  // ==========================================================================
  describe("cleanAndParseGeminiJson", () => {
    it("parses clean JSON directly", () => {
      const parsed = cleanAndParseGeminiJson(JSON.stringify(validGeminiOutput))
      expect(parsed.headline).toBe(validGeminiOutput.headline)
    })

    it("cleans and parses JSON wrapped in markdown code blocks", () => {
      const wrapped = `\`\`\`json\n${JSON.stringify(validGeminiOutput)}\n\`\`\``
      const parsed = cleanAndParseGeminiJson(wrapped)
      expect(parsed.headline).toBe(validGeminiOutput.headline)
    })

    it("extracts JSON when surrounded by conversational prefix and suffix text", () => {
      const withChatter = `Here is your advertising copy:\n\n${JSON.stringify(validGeminiOutput)}\n\nHope this helps!`
      const parsed = cleanAndParseGeminiJson(withChatter)
      expect(parsed.headline).toBe(validGeminiOutput.headline)
    })

    it("throws AdCopyGenerationError on malformed invalid JSON", () => {
      expect(() => cleanAndParseGeminiJson("Not valid JSON at all")).toThrow(
        AdCopyGenerationError
      )
    })

    it("throws AdCopyGenerationError on empty input", () => {
      expect(() => cleanAndParseGeminiJson("")).toThrow(AdCopyGenerationError)
    })
  })

  // ==========================================================================
  // 4. GENERATION SERVICE TESTS (Mocked Gemini Execution)
  // ==========================================================================
  describe("generateAdvertisingCopy Service", () => {
    it("throws AdCopyGenerationError if API key is missing", async () => {
      await expect(
        generateAdvertisingCopy({
          request: validRequest,
          apiKey: ""
        })
      ).rejects.toThrow("Google Gemini API Key not found")
    })

    it("throws 400 INVALID_MODEL if an unsupported modelId is passed directly", async () => {
      await expect(
        generateAdvertisingCopy({
          request: validRequest,
          apiKey: "mock-gemini-key",
          modelId: "unsupported-model-xyz"
        })
      ).rejects.toThrow("Unsupported Gemini model")
    })

    it("successfully calls Gemini and returns validated copy on successful response", async () => {
      const mockPayload = {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(validGeminiOutput) }]
            }
          }
        ]
      }
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockPayload),
        json: async () => mockPayload
      })

      const result = await generateAdvertisingCopy({
        request: validRequest,
        apiKey: "mock-gemini-key",
        fetchFn: mockFetch as any
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result.headline).toBe(validGeminiOutput.headline)
      expect(result.callToAction).toBe(validGeminiOutput.callToAction)
      expect(result.backgroundPrompt).toBe(validGeminiOutput.backgroundPrompt)

      // Verify the output matches the Zod schema
      const outputValidation = GeneratedAdCopySchema.safeParse(result)
      expect(outputValidation.success).toBe(true)
    })

    it("throws 502 SCHEMA_VALIDATION_ERROR if Gemini returns missing required fields", async () => {
      const incompleteOutput = {
        headline: "Short headline"
        // missing primaryText, description, callToAction, backgroundPrompt, etc.
      }
      const mockPayload = {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(incompleteOutput) }]
            }
          }
        ]
      }

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockPayload),
        json: async () => mockPayload
      })

      await expect(
        generateAdvertisingCopy({
          request: validRequest,
          apiKey: "mock-gemini-key",
          fetchFn: mockFetch as any
        })
      ).rejects.toThrow("schema validation")
    })

    it("handles Gemini rate limit 429 with sanitized error message and preserved status code", async () => {
      const mockErrorPayload = {
        error: {
          code: 429,
          message: "Internal quota exceeded for developer API key XYZ123.",
          status: "RESOURCE_EXHAUSTED"
        }
      }
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => JSON.stringify(mockErrorPayload),
        json: async () => mockErrorPayload
      })

      try {
        await generateAdvertisingCopy({
          request: validRequest,
          apiKey: "mock-gemini-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdCopyGenerationError)
        expect(err.status).toBe(429)
        expect(err.code).toBe("RATE_LIMIT_EXCEEDED")
        // Verify raw upstream error is sanitized and not leaked
        expect(err.message).toBe(
          "Google Gemini rate limit reached or quota exhausted. Please check your account quota or try again later."
        )
        expect(err.message).not.toContain("XYZ123")
      }
    })

    it("handles Gemini 400/401/403 with sanitized error message", async () => {
      const mockErrorPayload = {
        error: {
          code: 400,
          message: "API_KEY_INVALID: User key invalid for project 987654.",
          status: "INVALID_ARGUMENT"
        }
      }
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => JSON.stringify(mockErrorPayload),
        json: async () => mockErrorPayload
      })

      try {
        await generateAdvertisingCopy({
          request: validRequest,
          apiKey: "mock-gemini-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdCopyGenerationError)
        expect(err.status).toBe(400)
        expect(err.code).toBe("INVALID_API_KEY_OR_REQUEST")
        expect(err.message).toBe(
          "Invalid or unauthorized Google Gemini API request. Please verify your API key in profile settings."
        )
        expect(err.message).not.toContain("987654")
      }
    })

    it("handles Gemini 500/503 with sanitized service unavailable message", async () => {
      const mockErrorPayload = {
        error: {
          code: 503,
          message: "Backend cluster error in region us-central1.",
          status: "UNAVAILABLE"
        }
      }
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => JSON.stringify(mockErrorPayload),
        json: async () => mockErrorPayload
      })

      try {
        await generateAdvertisingCopy({
          request: validRequest,
          apiKey: "mock-gemini-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdCopyGenerationError)
        expect(err.status).toBe(502)
        expect(err.code).toBe("UPSTREAM_SERVICE_UNAVAILABLE")
        expect(err.message).toBe(
          "Google Gemini service is temporarily unavailable. Please try again shortly."
        )
        expect(err.message).not.toContain("us-central1")
      }
    })

    it("handles malformed non-JSON upstream HTTP response body with 502 MALFORMED_AI_RESPONSE", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "<html><body>502 Bad Gateway</body></html>",
        json: async () => {
          throw new SyntaxError("Unexpected token <")
        }
      })

      try {
        await generateAdvertisingCopy({
          request: validRequest,
          apiKey: "mock-gemini-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdCopyGenerationError)
        expect(err.status).toBe(502)
        expect(err.code).toBe("MALFORMED_AI_RESPONSE")
        expect(err.message).toBe(
          "Gemini returned an invalid or unparseable response. Please try again."
        )
      }
    })

    it("handles network connection failures appropriately with 502 status", async () => {
      const mockFetch = jest
        .fn()
        .mockRejectedValue(new Error("Connection refused to generativelanguage.googleapis.com"))

      try {
        await generateAdvertisingCopy({
          request: validRequest,
          apiKey: "mock-gemini-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdCopyGenerationError)
        expect(err.status).toBe(502)
        expect(err.code).toBe("UPSTREAM_NETWORK_ERROR")
      }
    })

    it("handles upstream request timeout with 504 TIMEOUT status", async () => {
      const abortError = new Error("The user aborted a request.")
      abortError.name = "AbortError"
      const mockFetch = jest.fn().mockRejectedValue(abortError)

      try {
        await generateAdvertisingCopy({
          request: validRequest,
          apiKey: "mock-gemini-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdCopyGenerationError)
        expect(err.status).toBe(504)
        expect(err.code).toBe("TIMEOUT")
        expect(err.message).toContain("timed out after 20 seconds")
      }
    })
  })

  // ==========================================================================
  // 5. API RESPONSE CONTRACT VALIDATION
  // ==========================================================================
  describe("AdCopyResponse Contract", () => {
    it("validates the complete standardized HTTP response contract", () => {
      const formatMeta = AD_FORMATS.square
      const fullResponse = {
        success: true,
        data: {
          copy: validGeminiOutput,
          platform: "instagram",
          format: {
            name: formatMeta.name,
            label: formatMeta.label,
            width: formatMeta.width,
            height: formatMeta.height,
            aspectRatio: formatMeta.aspectRatio
          },
          metadata: {
            model: "gemini-2.0-flash",
            generatedAt: new Date().toISOString(),
            productName: validRequest.productName,
            brandName: validRequest.brandName
          }
        }
      }

      const responseValidation = AdCopyResponseSchema.safeParse(fullResponse)
      expect(responseValidation.success).toBe(true)
    })
  })
})
