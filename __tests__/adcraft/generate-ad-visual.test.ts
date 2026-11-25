import {
  AdVisualGenerationError,
  DEFAULT_AD_NEGATIVE_PROMPT,
  generateAdvertisingVisual,
  mapAdFormatToStabilityAspectRatio,
  resolveStabilityEndpoint
} from "@/lib/server/adcraft/generate-ad-visual"
import {
  AD_FORMAT_STABILITY_MAP,
  AD_FORMATS,
  AdVisualGenerationRequest,
  AdVisualGenerationRequestSchema,
  AdVisualResponseSchema,
  GeneratedAdVisualSchema,
  SUPPORTED_STABILITY_MODELS
} from "@/types/adcraft"

describe("AdCraft AI — Phase A2 Visual Generation Unit Tests", () => {
  const validVisualRequest: AdVisualGenerationRequest = {
    backgroundPrompt:
      "Cinematic photography of a pristine running track tarmac at golden hour dawn, soft morning mist, dramatic sun flare, clean minimalist asphalt texture, expansive empty center composition, commercial athletic studio lighting, no text, no words, no footwear, no people",
    format: "square",
    model: "stability-image-ultra"
  }

  // Sample 1x1 transparent PNG base64 for mocking realistic image responses
  const mockBase64Image =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

  const validStabilityOutput = {
    image: mockBase64Image,
    finish_reason: "SUCCESS",
    seed: 12345678
  }

  // ==========================================================================
  // 1. REQUEST SCHEMA VALIDATION TESTS
  // ==========================================================================
  describe("AdVisualGenerationRequestSchema Validation", () => {
    it("successfully validates a valid visual generation request", () => {
      const parsed = AdVisualGenerationRequestSchema.safeParse(validVisualRequest)
      expect(parsed.success).toBe(true)
    })

    it("successfully validates a minimal request with default format (square)", () => {
      const minimal = {
        backgroundPrompt: "Clean studio backdrop with natural soft light and negative space"
      }
      const parsed = AdVisualGenerationRequestSchema.safeParse(minimal)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.format).toBe("square")
      }
    })

    it("fails when backgroundPrompt is missing or too short (< 5 chars)", () => {
      const tooShort = { backgroundPrompt: "Sun" }
      const parsed = AdVisualGenerationRequestSchema.safeParse(tooShort)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("at least 5 characters")
      }
    })

    it("fails when backgroundPrompt exceeds maximum length (> 1000 chars)", () => {
      const tooLong = { backgroundPrompt: "A".repeat(1001) }
      const parsed = AdVisualGenerationRequestSchema.safeParse(tooLong)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("cannot exceed 1000 characters")
      }
    })

    it("fails when format is unsupported", () => {
      const invalidFormat = { ...validVisualRequest, format: "billboard" as any }
      const parsed = AdVisualGenerationRequestSchema.safeParse(invalidFormat)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("Format must be one of")
      }
    })

    it("fails when model is unsupported", () => {
      const invalidModel = { ...validVisualRequest, model: "dall-e-3" as any }
      const parsed = AdVisualGenerationRequestSchema.safeParse(invalidModel)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("Model must be one of")
      }
    })

    it("validates all supported Stability models", () => {
      for (const model of SUPPORTED_STABILITY_MODELS) {
        const parsed = AdVisualGenerationRequestSchema.safeParse({
          ...validVisualRequest,
          model
        })
        expect(parsed.success).toBe(true)
      }
    })

    it("validates seed boundaries (0 to 4294967295)", () => {
      const validSeed = { ...validVisualRequest, seed: 42 }
      expect(AdVisualGenerationRequestSchema.safeParse(validSeed).success).toBe(true)

      const negativeSeed = { ...validVisualRequest, seed: -1 }
      expect(AdVisualGenerationRequestSchema.safeParse(negativeSeed).success).toBe(false)

      const overflowSeed = { ...validVisualRequest, seed: 5000000000 }
      expect(AdVisualGenerationRequestSchema.safeParse(overflowSeed).success).toBe(false)
    })
  })

  // ==========================================================================
  // 2. ASPECT RATIO & MODEL MAPPING TESTS
  // ==========================================================================
  describe("Aspect Ratio & Model Mapping", () => {
    it("maps square (1:1) to Stability 1:1", () => {
      expect(mapAdFormatToStabilityAspectRatio("square")).toBe("1:1")
      expect(AD_FORMAT_STABILITY_MAP.square).toBe("1:1")
    })

    it("maps portrait (4:5) to Stability 4:5", () => {
      expect(mapAdFormatToStabilityAspectRatio("portrait")).toBe("4:5")
      expect(AD_FORMAT_STABILITY_MAP.portrait).toBe("4:5")
    })

    it("maps story (9:16) to Stability 9:16", () => {
      expect(mapAdFormatToStabilityAspectRatio("story")).toBe("9:16")
      expect(AD_FORMAT_STABILITY_MAP.story).toBe("9:16")
    })

    it("maps landscape (1.91:1) safely to Stability 16:9", () => {
      expect(mapAdFormatToStabilityAspectRatio("landscape")).toBe("16:9")
      expect(AD_FORMAT_STABILITY_MAP.landscape).toBe("16:9")
    })

    it("resolves correct endpoint for stability-image-ultra", () => {
      expect(resolveStabilityEndpoint("stability-image-ultra")).toBe(
        "https://api.stability.ai/v2beta/stable-image/generate/ultra"
      )
    })

    it("resolves correct endpoint for stability-image-core", () => {
      expect(resolveStabilityEndpoint("stability-image-core")).toBe(
        "https://api.stability.ai/v2beta/stable-image/generate/core"
      )
    })

    it("resolves correct endpoint for stability-video legacy alias", () => {
      expect(resolveStabilityEndpoint("stability-video")).toBe(
        "https://api.stability.ai/v2beta/stable-image/generate/ultra"
      )
    })

    it("includes standard negative prompt rules prohibiting text, typography and logos", () => {
      expect(DEFAULT_AD_NEGATIVE_PROMPT).toContain("text")
      expect(DEFAULT_AD_NEGATIVE_PROMPT).toContain("typography")
      expect(DEFAULT_AD_NEGATIVE_PROMPT).toContain("watermark")
      expect(DEFAULT_AD_NEGATIVE_PROMPT).toContain("logo")
      expect(DEFAULT_AD_NEGATIVE_PROMPT).toContain("price tag")
    })
  })

  // ==========================================================================
  // 3. SERVICE EXECUTION & STABILITY AI MOCK TESTS
  // ==========================================================================
  describe("generateAdvertisingVisual Service", () => {
    it("throws 400 MISSING_API_KEY if Stability API key is missing", async () => {
      await expect(
        generateAdvertisingVisual({
          request: validVisualRequest,
          apiKey: ""
        })
      ).rejects.toThrow("Stability AI API Key not found")
    })

    it("throws 400 INVALID_MODEL if an unsupported model is passed directly", async () => {
      await expect(
        generateAdvertisingVisual({
          request: validVisualRequest,
          apiKey: "test-stability-key",
          modelId: "unsupported-model-xyz"
        })
      ).rejects.toThrow("Unsupported Stability model")
    })

    it("successfully generates and returns validated image data on valid response using multipart FormData", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(validStabilityOutput),
        json: async () => validStabilityOutput
      })

      const result = await generateAdvertisingVisual({
        request: {
          ...validVisualRequest,
          seed: 42
        },
        apiKey: "test-stability-key",
        fetchFn: mockFetch as any
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Verify request payload sent to Stability AI is Web FormData (not JSON string)
      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[0]).toBe("https://api.stability.ai/v2beta/stable-image/generate/ultra")

      const sentBody = callArgs[1].body
      expect(sentBody).toBeInstanceOf(FormData)
      expect(typeof sentBody).not.toBe("string")

      const formData = sentBody as FormData
      expect(formData.get("prompt")).toBe(validVisualRequest.backgroundPrompt)
      expect(formData.get("aspect_ratio")).toBe("1:1")
      expect(formData.get("output_format")).toBe("webp")
      expect(formData.get("negative_prompt")).toContain("text, typography")
      expect(formData.get("seed")).toBe("42")

      // Verify headers: Authorization and Accept are set, Content-Type is NOT manually set
      const headers = callArgs[1].headers
      expect(headers["Authorization"]).toBe("Bearer test-stability-key")
      expect(headers["Accept"]).toBe("application/json")
      expect(headers["Content-Type"]).toBeUndefined()

      // Verify returned result matches contract
      expect(result.base64).toBe(mockBase64Image)
      expect(result.dataUrl).toBe(`data:image/webp;base64,${mockBase64Image}`)
      expect(result.format).toBe("webp")
      expect(result.aspectRatio).toBe("1:1")
      expect(result.finishReason).toBe("SUCCESS")
      expect(result.seed).toBe(12345678)

      // Verify validation schema
      const validated = GeneratedAdVisualSchema.safeParse(result)
      expect(validated.success).toBe(true)
    })

    it("omits seed from FormData when seed is not supplied", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(validStabilityOutput),
        json: async () => validStabilityOutput
      })

      await generateAdvertisingVisual({
        request: validVisualRequest, // has no seed
        apiKey: "test-stability-key",
        fetchFn: mockFetch as any
      })

      const sentBody = mockFetch.mock.calls[0][1].body as FormData
      expect(sentBody.get("seed")).toBeNull()
    })

    it("appends user negative prompt to standard negative prompt in FormData", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(validStabilityOutput),
        json: async () => validStabilityOutput
      })

      await generateAdvertisingVisual({
        request: {
          ...validVisualRequest,
          negativePrompt: "no cars, no buildings"
        },
        apiKey: "test-stability-key",
        fetchFn: mockFetch as any
      })

      const sentBody = mockFetch.mock.calls[0][1].body as FormData
      const negativePrompt = sentBody.get("negative_prompt") as string
      expect(negativePrompt).toContain(DEFAULT_AD_NEGATIVE_PROMPT)
      expect(negativePrompt).toContain("no cars, no buildings")
    })

    it("handles landscape format mapping to 16:9 aspect ratio in FormData", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(validStabilityOutput),
        json: async () => validStabilityOutput
      })

      const result = await generateAdvertisingVisual({
        request: {
          ...validVisualRequest,
          format: "landscape"
        },
        apiKey: "test-stability-key",
        fetchFn: mockFetch as any
      })

      const sentBody = mockFetch.mock.calls[0][1].body as FormData
      expect(sentBody.get("aspect_ratio")).toBe("16:9")
      expect(result.aspectRatio).toBe("16:9")
    })

    it("routes requests to Stability Core endpoint with FormData when model is stability-image-core", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(validStabilityOutput),
        json: async () => validStabilityOutput
      })

      await generateAdvertisingVisual({
        request: {
          ...validVisualRequest,
          model: "stability-image-core"
        },
        apiKey: "test-stability-key",
        modelId: "stability-image-core",
        fetchFn: mockFetch as any
      })

      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[0]).toBe("https://api.stability.ai/v2beta/stable-image/generate/core")
      const sentBody = callArgs[1].body as FormData
      expect(sentBody).toBeInstanceOf(FormData)
      expect(sentBody.get("prompt")).toBe(validVisualRequest.backgroundPrompt)
    })

    it("handles 429 rate limit / 402 insufficient credits with sanitized client error", async () => {
      const mockErrorPayload = {
        name: "insufficient_credits",
        errors: ["Your organization does not have enough credits to complete this generation."]
      }
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 402,
        statusText: "Payment Required",
        text: async () => JSON.stringify(mockErrorPayload),
        json: async () => mockErrorPayload
      })

      try {
        await generateAdvertisingVisual({
          request: validVisualRequest,
          apiKey: "test-stability-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdVisualGenerationError)
        expect(err.status).toBe(429)
        expect(err.code).toBe("RATE_LIMIT_OR_CREDITS_EXHAUSTED")
        expect(err.message).toBe(
          "Stability AI rate limit reached or credits exhausted. Please verify your Stability account balance or try again later."
        )
      }
    })

    it("handles 400/401/403 invalid key or request with sanitized client error", async () => {
      const mockErrorPayload = {
        name: "unauthorized",
        errors: ["Invalid authorization token provided."]
      }
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => JSON.stringify(mockErrorPayload),
        json: async () => mockErrorPayload
      })

      try {
        await generateAdvertisingVisual({
          request: validVisualRequest,
          apiKey: "test-stability-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdVisualGenerationError)
        expect(err.status).toBe(400)
        expect(err.code).toBe("INVALID_API_KEY_OR_REQUEST")
        expect(err.message).toBe(
          "Invalid or unauthorized Stability AI request. Please verify your API key in profile settings."
        )
      }
    })

    it("handles 500/503 upstream failures with sanitized service unavailable message", async () => {
      const mockErrorPayload = {
        errors: ["Internal server error while scheduling diffusion worker."]
      }
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => JSON.stringify(mockErrorPayload),
        json: async () => mockErrorPayload
      })

      try {
        await generateAdvertisingVisual({
          request: validVisualRequest,
          apiKey: "test-stability-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdVisualGenerationError)
        expect(err.status).toBe(502)
        expect(err.code).toBe("UPSTREAM_SERVICE_UNAVAILABLE")
        expect(err.message).toBe(
          "Stability AI service is temporarily unavailable. Please try again shortly."
        )
      }
    })

    it("handles malformed non-JSON upstream HTTP response with 502 MALFORMED_AI_RESPONSE", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "<html><body>502 Bad Gateway</body></html>",
        json: async () => {
          throw new SyntaxError("Unexpected token <")
        }
      })

      try {
        await generateAdvertisingVisual({
          request: validVisualRequest,
          apiKey: "test-stability-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdVisualGenerationError)
        expect(err.status).toBe(502)
        expect(err.code).toBe("MALFORMED_AI_RESPONSE")
      }
    })

    it("handles payload rejection when Stability returns errors array with 200 OK", async () => {
      const mockErrorPayload = {
        errors: ["Content moderation flag triggered by background prompt."]
      }
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockErrorPayload),
        json: async () => mockErrorPayload
      })

      try {
        await generateAdvertisingVisual({
          request: validVisualRequest,
          apiKey: "test-stability-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdVisualGenerationError)
        expect(err.status).toBe(502)
        expect(err.code).toBe("GENERATION_REJECTED")
        expect(err.message).toContain("unable to generate the image")
      }
    })

    it("handles empty image response from Stability AI", async () => {
      const emptyImagePayload = {
        image: "",
        finish_reason: "SUCCESS"
      }
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(emptyImagePayload),
        json: async () => emptyImagePayload
      })

      try {
        await generateAdvertisingVisual({
          request: validVisualRequest,
          apiKey: "test-stability-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdVisualGenerationError)
        expect(err.status).toBe(502)
        expect(err.code).toBe("EMPTY_IMAGE_RESPONSE")
      }
    })

    it("handles network connection failure with 502 UPSTREAM_NETWORK_ERROR", async () => {
      const mockFetch = jest
        .fn()
        .mockRejectedValue(new Error("connect ECONNREFUSED api.stability.ai:443"))

      try {
        await generateAdvertisingVisual({
          request: validVisualRequest,
          apiKey: "test-stability-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdVisualGenerationError)
        expect(err.status).toBe(502)
        expect(err.code).toBe("UPSTREAM_NETWORK_ERROR")
      }
    })

    it("handles 30-second timeout with 504 TIMEOUT status", async () => {
      const timeoutError = new Error("The user aborted a request.")
      timeoutError.name = "AbortError"
      const mockFetch = jest.fn().mockRejectedValue(timeoutError)

      try {
        await generateAdvertisingVisual({
          request: validVisualRequest,
          apiKey: "test-stability-key",
          fetchFn: mockFetch as any
        })
        fail("Should have thrown")
      } catch (err: any) {
        expect(err).toBeInstanceOf(AdVisualGenerationError)
        expect(err.status).toBe(504)
        expect(err.code).toBe("TIMEOUT")
        expect(err.message).toContain("timed out after 30 seconds")
      }
    })
  })

  // ==========================================================================
  // 4. API RESPONSE CONTRACT VALIDATION
  // ==========================================================================
  describe("AdVisualResponseSchema Contract", () => {
    it("validates the complete standardized HTTP response contract", () => {
      const formatMeta = AD_FORMATS.square
      const fullResponse = {
        success: true,
        data: {
          image: {
            base64: mockBase64Image,
            dataUrl: `data:image/webp;base64,${mockBase64Image}`,
            format: "webp",
            aspectRatio: "1:1",
            finishReason: "SUCCESS",
            seed: 12345
          },
          format: {
            name: formatMeta.name,
            label: formatMeta.label,
            width: formatMeta.width,
            height: formatMeta.height,
            aspectRatio: formatMeta.aspectRatio,
            stabilityAspectRatio: "1:1"
          },
          metadata: {
            model: "stability-image-ultra",
            generatedAt: new Date().toISOString(),
            promptLength: validVisualRequest.backgroundPrompt.length
          }
        }
      }

      const validated = AdVisualResponseSchema.safeParse(fullResponse)
      expect(validated.success).toBe(true)
    })
  })
})
