import { renderHook, act, render, fireEvent } from "@testing-library/react"
import React from "react"
import {
  useAdStudio,
  validateConfigStep3,
  isValidRasterImageDataUrl,
  MIN_BACKGROUND_PROMPT_LENGTH,
  MAX_BACKGROUND_PROMPT_LENGTH,
  DEFAULT_VISUAL_MODEL,
  MAX_BACKGROUND_HISTORY,
  MAX_STABILITY_SEED,
  initialStudioConfig,
  initialEditableCopy,
  GeneratedBackgroundItem
} from "@/lib/adcraft/use-ad-studio"
import { AdStudioVisualStep } from "@/components/adcraft/ad-studio-visual-step"
import { AdStudio } from "@/components/adcraft/ad-studio"
import { GeneratedAdCopy, GeneratedAdVisual } from "@/types/adcraft"

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn()
  })
}))

describe("Phase A4.3 — Stability AI Background Generation Integration", () => {
  const originalFetch = global.fetch

  const mockCopy: GeneratedAdCopy = {
    headline: "Experience Studio Sound Anywhere",
    primaryText: "Immerse yourself in acoustic precision with active noise cancellation.",
    description: "Crafted for audiophiles who demand flawless acoustic fidelity.",
    callToAction: "Shop Now",
    visualDirection: "Sleek matte black headphones floating on minimalist studio pedestal",
    backgroundPrompt: "Commercial studio product backdrop with soft rim lighting and clean stone pedestal",
    suggestedLayout: {
      productPlacement: "center",
      textPlacement: "bottom",
      colorPaletteSuggestion: ["#0F172A", "#38BDF8"]
    },
    headlineAlternatives: ["Pure Audio Fidelity"],
    copyAlternatives: ["Uncompromising wireless sound performance."]
  }

  const validEditableCopy = {
    headline: mockCopy.headline,
    primaryText: mockCopy.primaryText,
    description: mockCopy.description,
    callToAction: mockCopy.callToAction,
    backgroundPrompt: mockCopy.backgroundPrompt
  }

  const mockBase64 =
    "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA="

  const mockVisual: GeneratedAdVisual = {
    base64: mockBase64,
    dataUrl: `data:image/webp;base64,${mockBase64}`,
    format: "webp",
    aspectRatio: "1:1",
    finishReason: "SUCCESS",
    seed: 987654321
  }

  const createVisualSuccessResponse = (
    overrides: Partial<{
      dataUrl: string
      aspectRatio: string
      seed: number
      model: string
      formatName: string
    }> = {}
  ) => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: {
        image: {
          ...mockVisual,
          dataUrl: overrides.dataUrl ?? mockVisual.dataUrl,
          aspectRatio: overrides.aspectRatio ?? "1:1",
          seed: overrides.seed ?? mockVisual.seed
        },
        format: {
          name: overrides.formatName ?? "square",
          label: "Square (1:1)",
          width: 1080,
          height: 1080,
          aspectRatio: "1:1",
          stabilityAspectRatio: overrides.aspectRatio ?? "1:1"
        },
        metadata: {
          model: overrides.model ?? "stability-image-ultra",
          generatedAt: "2026-11-26T10:50:00Z",
          promptLength: 88
        }
      }
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  // ==========================================================================
  // 1. VALIDATION RULES (validateConfigStep3)
  // ==========================================================================
  describe("Step 3 Validation Rules (validateConfigStep3)", () => {
    it("accepts valid prompt, model, optional negativePrompt, and numeric seed", () => {
      const res = validateConfigStep3({
        backgroundPrompt: "Minimalist studio marble pedestal with soft daylight",
        visualModel: "stability-image-core",
        negativePrompt: "clutter, dark shadows",
        visualSeed: "42"
      })

      expect(res.valid).toBe(true)
      expect(res.errors).toEqual({})
      expect(res.parsedSeed).toBe(42)
    })

    it("rejects empty, too short (<10), or too long (>700) background prompts and accepts boundaries (10 and 700)", () => {
      expect(
        validateConfigStep3({ backgroundPrompt: "   " }).errors.backgroundPrompt
      ).toBe("Background prompt is required")

      expect(
        validateConfigStep3({ backgroundPrompt: "123456789" }).errors
          .backgroundPrompt
      ).toBe(
        `Background prompt must be at least ${MIN_BACKGROUND_PROMPT_LENGTH} characters`
      )

      expect(
        validateConfigStep3({ backgroundPrompt: "1234567890" }).valid
      ).toBe(true)

      expect(
        validateConfigStep3({
          backgroundPrompt: "A".repeat(MAX_BACKGROUND_PROMPT_LENGTH)
        }).valid
      ).toBe(true)

      expect(
        validateConfigStep3({
          backgroundPrompt: "A".repeat(MAX_BACKGROUND_PROMPT_LENGTH + 1)
        }).errors.backgroundPrompt
      ).toBe(
        `Background prompt cannot exceed ${MAX_BACKGROUND_PROMPT_LENGTH} characters`
      )
    })

    it("rejects unsupported model, oversized negativePrompt (>500), and invalid seeds", () => {
      expect(
        validateConfigStep3({
          backgroundPrompt: "Valid scenic backdrop prompt",
          visualModel: "dall-e-3"
        }).errors.visualModel
      ).toContain("Model must be one of")

      expect(
        validateConfigStep3({
          backgroundPrompt: "Valid scenic backdrop prompt",
          negativePrompt: "X".repeat(501)
        }).errors.negativePrompt
      ).toBe("Negative prompt cannot exceed 500 characters")

      expect(
        validateConfigStep3({
          backgroundPrompt: "Valid scenic backdrop prompt",
          visualSeed: "abc"
        }).errors.visualSeed
      ).toBe("Seed must be a non-negative whole integer")

      expect(
        validateConfigStep3({
          backgroundPrompt: "Valid scenic backdrop prompt",
          visualSeed: String(MAX_STABILITY_SEED + 1)
        }).errors.visualSeed
      ).toContain("Seed must be an integer between 0")
    })
  })

  // ==========================================================================
  // 2. API REQUEST CONSTRUCTION & SUCCESSFUL GENERATION
  // ==========================================================================
  describe("Background Generation API Call (handleGenerateVisual)", () => {
    it("aborts early without fetching if prompt validation fails", async () => {
      const fetchMock = jest.fn()
      global.fetch = fetchMock as any

      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 3,
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "Valid description"
          },
          generatedCopy: mockCopy,
          editableCopy: {
            ...validEditableCopy,
            backgroundPrompt: "Bad"
          }
        })
      )

      let ok = true
      await act(async () => {
        ok = await result.current.handleGenerateVisual("ws-123")
      })

      expect(ok).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(result.current.visualGenerationError).toBe(
        "Background prompt must be at least 10 characters"
      )
      expect(result.current.visualFieldErrors.backgroundPrompt).toBeDefined()
    })

    it("posts validated JSON payload to /api/adcraft/generate-visual and stores generated background", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          createVisualSuccessResponse({
            model: "stability-image-core",
            aspectRatio: "16:9",
            formatName: "landscape",
            seed: 555777
          })
        )
      global.fetch = fetchMock as any

      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 3,
          config: {
            ...initialStudioConfig,
            productName: "Aura Headphones",
            productDescription: "High-end wireless headphones with ANC.",
            format: "landscape"
          },
          generatedCopy: mockCopy,
          editableCopy: validEditableCopy,
          visualModel: "stability-image-core",
          negativePrompt: "busy tabletop, extra cables",
          visualSeed: "12345"
        })
      )

      let ok = false
      await act(async () => {
        ok = await result.current.handleGenerateVisual(
          "11111111-2222-4333-8444-555555555555"
        )
      })

      expect(ok).toBe(true)
      expect(result.current.isGeneratingVisual).toBe(false)
      expect(result.current.currentStep).toBe(3) // Remains on Step 3 so user can inspect preview
      expect(result.current.visualGenerationError).toBeNull()
      expect(result.current.selectedBackground).toBeTruthy()
      expect(result.current.generatedVisual?.dataUrl).toBe(mockVisual.dataUrl)
      expect(result.current.selectedBackground?.promptUsed).toBe(
        validEditableCopy.backgroundPrompt
      )
      expect(result.current.selectedBackground?.formatUsed).toBe("landscape")
      expect(result.current.isVisualStale).toBe(false)

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/adcraft/generate-visual",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" }
        })
      )

      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(sentBody).toEqual({
        backgroundPrompt: validEditableCopy.backgroundPrompt,
        format: "landscape",
        model: "stability-image-core",
        negativePrompt: "busy tabletop, extra cables",
        seed: 12345,
        workspaceId: "11111111-2222-4333-8444-555555555555"
      })
    })

    it("handles API errors prioritizing data.message, falling back to data.error or status code, and rejects invalid payloads", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 3,
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "Valid description"
          },
          generatedCopy: mockCopy,
          editableCopy: validEditableCopy
        })
      )

      // Case 1: Standardized message field
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          message: "Stability AI credits exhausted.",
          error: "Should not prioritize error"
        })
      }) as any

      await act(async () => {
        await result.current.handleGenerateVisual()
      })
      expect(result.current.visualGenerationError).toBe(
        "Stability AI credits exhausted."
      )

      // Case 2: Backward-compatible error field
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: "Missing Stability API key"
        })
      }) as any

      await act(async () => {
        await result.current.handleGenerateVisual()
      })
      expect(result.current.visualGenerationError).toBe("Missing Stability API key")

      // Case 3: Malformed non-JSON error
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected <")
        }
      }) as any

      await act(async () => {
        await result.current.handleGenerateVisual()
      })
      expect(result.current.visualGenerationError).toBe("Visual generation failed (502)")

      // Case 4: Malformed success payload missing valid dataUrl
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { image: { base64: "abc", dataUrl: "https://evil.example/img.png" } }
        })
      }) as any

      let success = true
      await act(async () => {
        success = await result.current.handleGenerateVisual()
      })
      expect(success).toBe(false)
      expect(result.current.visualGenerationError).toContain("unexpected image response")
    })
  })

  // ==========================================================================
  // 3. CONCURRENCY, DUPLICATE GUARD & STALE-RESPONSE PROTECTION
  // ==========================================================================
  describe("Visual Concurrency Guards & Lifecycle Interleaving", () => {
    it("prevents duplicate concurrent visual generation requests while in-flight", async () => {
      let resolveFetch: ((val: any) => void) | undefined
      const controlledPromise = new Promise(resolve => {
        resolveFetch = resolve
      })
      const fetchMock = jest.fn().mockReturnValue(controlledPromise)
      global.fetch = fetchMock as any

      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 3,
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "Valid description"
          },
          generatedCopy: mockCopy,
          editableCopy: validEditableCopy
        })
      )

      let p1: Promise<boolean> | null = null
      let p2: Promise<boolean> | null = null
      act(() => {
        p1 = result.current.handleGenerateVisual("ws-1")
        p2 = result.current.handleGenerateVisual("ws-1")
      })

      let secondRes = true
      await act(async () => {
        secondRes = await p2!
      })

      expect(secondRes).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.current.isGeneratingVisual).toBe(true)

      await act(async () => {
        resolveFetch!(createVisualSuccessResponse())
        await p1
      })

      expect(result.current.isGeneratingVisual).toBe(false)
      expect(result.current.selectedBackground).toBeTruthy()
    })

    it("protects Request B when an invalidated Request A (via reset) resolves late", async () => {
      let resolveA: ((val: any) => void) | undefined
      const promiseA = new Promise(resolve => {
        resolveA = resolve
      })
      let resolveB: ((val: any) => void) | undefined
      const promiseB = new Promise(resolve => {
        resolveB = resolve
      })

      const fetchMock = jest
        .fn()
        .mockReturnValueOnce(promiseA)
        .mockReturnValueOnce(promiseB)
      global.fetch = fetchMock as any

      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 3,
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "Valid description"
          },
          generatedCopy: mockCopy,
          editableCopy: validEditableCopy
        })
      )

      // 1. Start Request A
      let pA: Promise<boolean> | null = null
      act(() => {
        pA = result.current.handleGenerateVisual()
      })
      expect(result.current.isGeneratingVisual).toBe(true)

      // 2. Call reset() while Request A is pending
      act(() => {
        result.current.reset()
      })
      expect(result.current.isGeneratingVisual).toBe(false)
      expect(result.current.selectedBackground).toBeNull()

      // 3. Re-enter valid prompt & start Request B
      act(() => {
        result.current.handleBackgroundPromptChange(
          "Clean walnut desk bathed in soft sunlight"
        )
      })
      let pB: Promise<boolean> | null = null
      act(() => {
        pB = result.current.handleGenerateVisual()
      })
      expect(result.current.isGeneratingVisual).toBe(true)

      // 4. Resolve stale Request A while Request B is still pending
      await act(async () => {
        resolveA!(
          createVisualSuccessResponse({
            dataUrl: `data:image/webp;base64,U1RBTEVJQUdFQQ==`,
            seed: 111
          })
        )
        await pA
      })

      // Request A must NOT clear Request B loading, commit stale image, or break lock
      expect(result.current.isGeneratingVisual).toBe(true)
      expect(result.current.generatedBackgrounds).toHaveLength(0)
      expect(result.current.selectedBackground).toBeNull()
      expect(result.current.visualGenerationError).toBeNull()

      // Duplicate call during Request B is still blocked by Request B's lock
      let pDup: Promise<boolean> | null = null
      act(() => {
        pDup = result.current.handleGenerateVisual()
      })
      let dupRes = true
      await act(async () => {
        dupRes = await pDup!
      })
      expect(dupRes).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // 5. Resolve Request B
      await act(async () => {
        resolveB!(
          createVisualSuccessResponse({
            dataUrl: `data:image/webp;base64,RlJFU0hJTUFHRUI=`,
            seed: 222
          })
        )
        await pB
      })

      expect(result.current.isGeneratingVisual).toBe(false)
      expect(result.current.generatedBackgrounds).toHaveLength(1)
      expect(result.current.selectedBackground?.visual.seed).toBe(222)
      expect(result.current.selectedBackground?.promptUsed).toBe(
        "Clean walnut desk bathed in soft sunlight"
      )
    })
  })

  // ==========================================================================
  // 4. PROMPT EDITING, STALE SYNC, VARIATION SELECTION & STEP NAVIGATION
  // ==========================================================================
  describe("Prompt Editing, Selection History, Navigation & Reset", () => {
    it("tracks prompt and format staleness accurately and prevents unknowing progression to Step 4", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          createVisualSuccessResponse({ dataUrl: `data:image/webp;base64,FIRST`, seed: 101 })
        )
        .mockResolvedValueOnce(
          createVisualSuccessResponse({ dataUrl: `data:image/webp;base64,SECOND`, seed: 202 })
        ) as any

      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 3,
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "Studio wireless ANC headphones"
          },
          generatedCopy: mockCopy,
          editableCopy: validEditableCopy
        })
      )

      // Blocking Step 4 before generating background
      let advanced = true
      act(() => {
        advanced = result.current.handleNextStep()
      })
      expect(advanced).toBe(false)
      expect(result.current.currentStep).toBe(3)
      expect(result.current.visualGenerationError).toContain("generate a background image")

      // Generate first background
      await act(async () => {
        await result.current.handleGenerateVisual()
      })
      expect(result.current.isVisualStale).toBe(false)
      expect(result.current.selectedBackground?.visual.seed).toBe(101)

      // Edit prompt after generation -> marks prompt stale
      act(() => {
        result.current.handleBackgroundPromptChange(
          "Moody dark slate studio lighting with subtle blue rim glow"
        )
      })
      expect(result.current.isVisualPromptStale).toBe(true)
      expect(result.current.isVisualStale).toBe(true)

      // Attempting to advance without regenerating, reverting, or confirming is blocked
      act(() => {
        advanced = result.current.handleNextStep()
      })
      expect(advanced).toBe(false)
      expect(result.current.currentStep).toBe(3)
      expect(result.current.visualGenerationError).toContain("background prompt changed")

      // Option 1: Explicitly acknowledge stale background allows proceeding consciously
      act(() => {
        result.current.handleAcknowledgeStaleVisual(true)
      })
      act(() => {
        advanced = result.current.handleNextStep()
      })
      expect(advanced).toBe(true)
      expect(result.current.currentStep).toBe(4)

      // Going back to Step 1 and changing format resets acknowledgment and flags format stale
      act(() => {
        result.current.goToStep(1)
        result.current.handleConfigChange("format", "portrait")
      })
      expect(result.current.isVisualFormatStale).toBe(true)
      expect(result.current.staleVisualAcknowledged).toBe(false)

      // Selected background stays preserved when navigating across steps 1 -> 2 -> 3
      act(() => {
        result.current.goToStep(3)
      })
      expect(result.current.currentStep).toBe(3)
      expect(result.current.selectedBackground?.visual.seed).toBe(101)

      // Reverting prompt clears prompt staleness cleanly
      act(() => {
        result.current.handleRevertPromptToSelected()
      })
      expect(result.current.editableCopy.backgroundPrompt).toBe(
        validEditableCopy.backgroundPrompt
      )
      expect(result.current.isVisualPromptStale).toBe(false)

      // Regenerate for new portrait format -> clears staleness completely & adds to history
      await act(async () => {
        await result.current.handleGenerateVisual()
      })
      expect(result.current.generatedBackgrounds).toHaveLength(2)
      expect(result.current.selectedBackground?.visual.seed).toBe(202)
      expect(result.current.isVisualStale).toBe(false)

      // Can re-select earlier variation cleanly
      const firstId = result.current.generatedBackgrounds[1].id
      act(() => {
        result.current.handleSelectBackground(firstId)
      })
      expect(result.current.selectedBackground?.visual.seed).toBe(101)
      expect(result.current.isVisualFormatStale).toBe(true)
    })

    it("caps in-session history at MAX_BACKGROUND_HISTORY and clears everything cleanly on reset", async () => {
      const fetchMock = jest.fn().mockImplementation(async () =>
        createVisualSuccessResponse({ seed: Math.floor(Math.random() * 10000) })
      )
      global.fetch = fetchMock as any

      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 3,
          config: {
            ...initialStudioConfig,
            productName: "Product",
            productDescription: "Valid description"
          },
          generatedCopy: mockCopy,
          editableCopy: validEditableCopy
        })
      )

      for (let i = 0; i < MAX_BACKGROUND_HISTORY + 2; i++) {
        await act(async () => {
          await result.current.handleGenerateVisual()
        })
      }

      expect(result.current.generatedBackgrounds).toHaveLength(
        MAX_BACKGROUND_HISTORY
      )

      act(() => {
        result.current.reset()
      })

      expect(result.current.currentStep).toBe(1)
      expect(result.current.visualModel).toBe(DEFAULT_VISUAL_MODEL)
      expect(result.current.negativePrompt).toBe("")
      expect(result.current.visualSeed).toBe("")
      expect(result.current.generatedBackgrounds).toEqual([])
      expect(result.current.selectedBackgroundId).toBeNull()
      expect(result.current.selectedBackground).toBeNull()
      expect(result.current.generatedVisual).toBeNull()
      expect(result.current.isGeneratingVisual).toBe(false)
      expect(result.current.visualGenerationError).toBeNull()
      expect(result.current.staleVisualAcknowledged).toBe(false)
    })
  })

  // ==========================================================================
  // 5. COMPONENT UI INTEGRATION (AdStudioVisualStep & AdStudio Preview)
  // ==========================================================================
  describe("AdStudioVisualStep UI Component Integration", () => {
    const sampleItem: GeneratedBackgroundItem = {
      id: "bg-1",
      visual: mockVisual,
      promptUsed: validEditableCopy.backgroundPrompt,
      negativePromptUsed: "",
      formatUsed: "square",
      modelUsed: "stability-image-ultra",
      width: 1080,
      height: 1080,
      aspectRatio: "1:1",
      stabilityAspectRatio: "1:1",
      generatedAt: "2026-11-26T10:55:00Z"
    }

    const baseProps = {
      workspaceId: "ws-123",
      config: {
        ...initialStudioConfig,
        productName: "Aura Headphones",
        productDescription: "Studio headphones with active ANC",
        format: "square" as const
      },
      backgroundPrompt: validEditableCopy.backgroundPrompt,
      visualModel: DEFAULT_VISUAL_MODEL,
      negativePrompt: "",
      visualSeed: "",
      generatedBackgrounds: [] as GeneratedBackgroundItem[],
      selectedBackground: null as GeneratedBackgroundItem | null,
      isGeneratingVisual: false,
      visualGenerationError: null as string | null,
      visualFieldErrors: {} as Record<string, string>,
      isVisualPromptStale: false,
      isVisualFormatStale: false,
      isVisualStale: false,
      staleVisualAcknowledged: false,
      onBackgroundPromptChange: jest.fn(),
      onVisualModelChange: jest.fn(),
      onNegativePromptChange: jest.fn(),
      onVisualSeedChange: jest.fn(),
      onGenerateVisual: jest.fn().mockResolvedValue(true),
      onSelectBackground: jest.fn(),
      onRevertPromptToSelected: jest.fn(),
      onAcknowledgeStaleVisual: jest.fn(),
      onPrevStep: jest.fn(),
      onNextStep: jest.fn()
    }

    it("renders initial visual configuration, prompt textarea, model selector, and generate CTA", () => {
      const onGenerate = jest.fn().mockResolvedValue(true)
      const onModelChange = jest.fn()
      const onPromptChange = jest.fn()

      const { getByLabelText, getByText, getByRole } = render(
        React.createElement(AdStudioVisualStep, {
          ...baseProps,
          onGenerateVisual: onGenerate,
          onVisualModelChange: onModelChange,
          onBackgroundPromptChange: onPromptChange
        })
      )

      expect(getByText("Background Visual Generation")).toBeTruthy()
      const promptInput = getByLabelText(/Background Generation Prompt/i) as HTMLTextAreaElement
      expect(promptInput.value).toBe(validEditableCopy.backgroundPrompt)

      fireEvent.change(promptInput, { target: { value: "New vibrant studio backdrop" } })
      expect(onPromptChange).toHaveBeenCalledWith("New vibrant studio backdrop")

      const coreRadio = getByRole("radio", { name: /Stability Image Core/i })
      fireEvent.click(coreRadio)
      expect(onModelChange).toHaveBeenCalledWith("stability-image-core")

      const genBtn = getByRole("button", { name: /Generate Background with Stability AI/i })
      fireEvent.click(genBtn)
      expect(onGenerate).toHaveBeenCalled()
    })

    it("disables controls and renders accessible progress indicator while generating", () => {
      const { getByRole, getByLabelText, getByText } = render(
        React.createElement(AdStudioVisualStep, {
          ...baseProps,
          isGeneratingVisual: true
        })
      )

      expect(getByRole("progressbar")).toBeTruthy()
      expect(getByText(/Rendering Background with Stability Ultra/i)).toBeTruthy()

      const promptInput = getByLabelText(/Background Generation Prompt/i) as HTMLTextAreaElement
      expect(promptInput.disabled).toBe(true)

      const loadingBtn = getByRole("button", { name: /Generating Background/i }) as HTMLButtonElement
      expect(loadingBtn.disabled).toBe(true)
    })

    it("renders generated image preview, metadata, variation selector, and stale warning banner", () => {
      const secondItem: GeneratedBackgroundItem = {
        ...sampleItem,
        id: "bg-2",
        visual: { ...mockVisual, seed: 777 }
      }
      const onRevert = jest.fn()
      const onSelectBg = jest.fn()
      const onAcknowledge = jest.fn()

      const { getByAltText, getByText, getByRole, getByLabelText } = render(
        React.createElement(AdStudioVisualStep, {
          ...baseProps,
          backgroundPrompt: "Updated studio backdrop prompt",
          generatedBackgrounds: [secondItem, sampleItem],
          selectedBackground: sampleItem,
          isVisualPromptStale: true,
          isVisualStale: true,
          onRevertPromptToSelected: onRevert,
          onSelectBackground: onSelectBg,
          onAcknowledgeStaleVisual: onAcknowledge
        })
      )

      const previewImg = getByAltText(/Generated ad background for Aura Headphones/i) as HTMLImageElement
      expect(previewImg.src).toContain(mockVisual.dataUrl)
      expect(getByText(/Seed: 987654321/)).toBeTruthy()

      expect(getByText("Selected Background Out of Sync")).toBeTruthy()
      fireEvent.click(getByRole("button", { name: "Revert Prompt" }))
      expect(onRevert).toHaveBeenCalled()

      fireEvent.click(
        getByRole("button", { name: "Select generated background variation 1" })
      )
      expect(onSelectBg).toHaveBeenCalledWith("bg-2")

      const keepCheckbox = getByLabelText(/Keep selected background anyway/i)
      fireEvent.click(keepCheckbox)
      expect(onAcknowledge).toHaveBeenCalledWith(true)
    })

    it("renders AdStudio workflow end-to-end placeholder state cleanly without breaking A4.1/A4.2", () => {
      const { getByText, getByRole } = render(
        React.createElement(AdStudio, {
          workspaceId: "ws-123"
        })
      )

      expect(getByText("AdCraft Advertisement Studio")).toBeTruthy()
      expect(getByText("Background Generation")).toBeTruthy()
      expect(getByText("Stability AI visual rendering")).toBeTruthy()
      expect(getByRole("navigation", { name: /Advertisement Studio progress/i })).toBeTruthy()
    })

    // ========================================================================
    // 6. TARGETED REGRESSION TESTS (A4.3-001 through A4.3-005)
    // ========================================================================
    describe("A4.3 Audit Regression Tests", () => {
      it("[A4.3-001] enforces consistent 10-700 prompt bounds across navigation, prevents stale ack from bypassing invalid prompt, and keeps stepper navigation accessible", async () => {
        global.fetch = jest.fn().mockResolvedValue(createVisualSuccessResponse()) as any

        const { result } = renderHook(() =>
          useAdStudio({
            currentStep: 2,
            config: {
              ...initialStudioConfig,
              productName: "Aura Headphones",
              productDescription: "High fidelity wireless ANC headphones"
            },
            generatedCopy: mockCopy,
            editableCopy: validEditableCopy
          })
        )

        // Step 2 -> Step 3 via handleNextStep
        let advanced = false
        act(() => {
          advanced = result.current.handleNextStep()
        })
        expect(advanced).toBe(true)
        expect(result.current.currentStep).toBe(3)

        // Generate valid background
        await act(async () => {
          await result.current.handleGenerateVisual()
        })
        expect(result.current.selectedBackground).toBeTruthy()

        // Edit prompt within 10-700, navigate back to Step 2, then back to Step 3 and Step 4 via stepper
        act(() => {
          result.current.handleBackgroundPromptChange("A".repeat(700))
          result.current.handlePrevStep()
        })
        expect(result.current.currentStep).toBe(2)

        act(() => {
          advanced = result.current.goToStep(3)
        })
        expect(advanced).toBe(true)
        expect(result.current.currentStep).toBe(3)

        // Acknowledge stale prompt while prompt is valid at 10 chars minimum -> Step 4 succeeds
        act(() => {
          result.current.handleBackgroundPromptChange("1234567890")
        })
        act(() => {
          result.current.handleAcknowledgeStaleVisual(true)
        })
        act(() => {
          advanced = result.current.goToStep(4)
        })
        expect(advanced).toBe(true)
        expect(result.current.currentStep).toBe(4)

        // Return to Step 3 and shorten prompt below 10 chars (9 chars = invalid) + keep acknowledgment
        act(() => {
          result.current.handlePrevStep()
          result.current.handleBackgroundPromptChange("123456789")
        })
        act(() => {
          result.current.handleAcknowledgeStaleVisual(true)
        })

        // Stale acknowledgment must NOT bypass invalid prompt validation on handleNextStep or goToStep(4)
        act(() => {
          advanced = result.current.handleNextStep()
        })
        expect(advanced).toBe(false)
        expect(result.current.currentStep).toBe(3)
        expect(result.current.visualGenerationError).toBe(
          "Background prompt must be at least 10 characters"
        )
        expect(result.current.visualFieldErrors.backgroundPrompt).toBe(
          "Background prompt must be at least 10 characters"
        )

        act(() => {
          advanced = result.current.goToStep(4)
        })
        expect(advanced).toBe(false)
        expect(result.current.currentStep).toBe(3)

        // Even from Step 1, failed stepper navigation populates navigationError visibly
        act(() => {
          result.current.goToStep(1)
        })
        expect(result.current.currentStep).toBe(1)
        expect(result.current.navigationError).toBeNull()

        act(() => {
          result.current.goToStep(3)
        })
        expect(result.current.currentStep).toBe(1)
        expect(result.current.navigationError).toBe(
          "Background prompt must be at least 10 characters"
        )

        // Dismiss navigationError cleanly
        act(() => {
          result.current.clearNavigationError()
        })
        expect(result.current.navigationError).toBeNull()
      })

      it("[A4.3-001/004] surfaces failed stepper navigation alerts visually on Step 1 & provides accessible keyboard stepper buttons", () => {
        const { getByRole, getByText, queryByText } = render(
          React.createElement(AdStudio, {
            workspaceId: "ws-123"
          })
        )

        const step1Btn = getByRole("button", {
          name: /Step 1: Configuration & Assets/i
        }) as HTMLButtonElement
        const step3Btn = getByRole("button", {
          name: /Step 3: Background Generation/i
        }) as HTMLButtonElement
        const step4Btn = getByRole("button", {
          name: /Step 4: Composition & Export/i
        }) as HTMLButtonElement

        expect(step1Btn.type).toBe("button")
        expect(step1Btn.getAttribute("aria-current")).toBe("step")
        expect(step3Btn.disabled).toBe(true)
        expect(step4Btn.disabled).toBe(true)

        // Step 2 button is disabled until completed or navigated; clicking Step 1 Continue with empty fields triggers error alert
        const continueBtn = getByRole("button", {
          name: /Continue to Copy Generation/i
        })
        fireEvent.click(continueBtn)

        expect(getByText("Cannot Change Studio Step")).toBeTruthy()
        const dismissBtn = getByRole("button", {
          name: "Dismiss navigation error"
        })
        fireEvent.click(dismissBtn)
        expect(queryByText("Cannot Change Studio Step")).toBeNull()
      })

      it("[A4.3-002] aborts pending background fetch on hook unmount and suppresses late post-unmount state updates", async () => {
        let capturedSignal: AbortSignal | null | undefined
        let resolveFetch: ((val: any) => void) | undefined
        const pendingPromise = new Promise(resolve => {
          resolveFetch = resolve
        })

        global.fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
          capturedSignal = init?.signal
          return pendingPromise
        }) as any

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

        const { result, unmount } = renderHook(() =>
          useAdStudio({
            currentStep: 3,
            config: {
              ...initialStudioConfig,
              productName: "Headphones",
              productDescription: "Valid description"
            },
            generatedCopy: mockCopy,
            editableCopy: validEditableCopy
          })
        )

        let fetchPromise: Promise<boolean> | null = null
        act(() => {
          fetchPromise = result.current.handleGenerateVisual()
        })

        expect(capturedSignal).toBeDefined()
        expect(capturedSignal?.aborted).toBe(false)

        // Unmount before response settles -> aborts controller and bumps seq
        unmount()
        expect(capturedSignal?.aborted).toBe(true)

        // Resolve fetch after unmount -> no uncaught rejection or post-unmount state errors
        let settledVal = true
        await act(async () => {
          resolveFetch!(createVisualSuccessResponse())
          settledVal = await fetchPromise!
        })

        expect(settledVal).toBe(false)
        expect(consoleErrorSpy).not.toHaveBeenCalled()
        consoleErrorSpy.mockRestore()
      })

      it("[A4.3-002] handles clipboard write success, rejection, and cleans up feedback timeout on unmount", async () => {
        jest.useFakeTimers()
        const clearTimeoutSpy = jest.spyOn(global, "clearTimeout")
        const writeTextMock = jest
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error("Clipboard denied"))

        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: writeTextMock }
        })

        const { getByRole, unmount } = render(
          React.createElement(AdStudioVisualStep, {
            ...baseProps
          })
        )

        const copyBtn = getByRole("button", { name: "Copy background prompt" })

        // Case 1: Clipboard succeeds -> schedules 2000ms timeout, cleared on unmount
        await act(async () => {
          fireEvent.click(copyBtn)
          await Promise.resolve()
        })
        expect(writeTextMock).toHaveBeenCalledWith(validEditableCopy.backgroundPrompt)

        // Trigger second rejected clipboard write safely without unhandled rejection
        await act(async () => {
          fireEvent.click(copyBtn)
          await Promise.resolve()
        })
        expect(writeTextMock).toHaveBeenCalledTimes(2)

        unmount()
        expect(clearTimeoutSpy).toHaveBeenCalled()
        clearTimeoutSpy.mockRestore()
        jest.useRealTimers()
      })

      it("[A4.3-005] strictly enforces raster base64 data URLs (webp, png, jpeg) and rejects svg, missing base64, empty, or malformed payloads", async () => {
        expect(isValidRasterImageDataUrl(`data:image/webp;base64,${mockBase64}`)).toBe(true)
        expect(isValidRasterImageDataUrl(`data:image/png;base64,${mockBase64}`)).toBe(true)
        expect(isValidRasterImageDataUrl(`data:image/jpeg;base64,${mockBase64}`)).toBe(true)

        expect(isValidRasterImageDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(false)
        expect(isValidRasterImageDataUrl("data:image/gif;base64,R0lGODlh")).toBe(false)
        expect(isValidRasterImageDataUrl("data:image/png,rawdata")).toBe(false)
        expect(isValidRasterImageDataUrl("data:image/webp;base64,")).toBe(false)
        expect(isValidRasterImageDataUrl("data:image/webp;base64,not valid!")).toBe(false)
        expect(isValidRasterImageDataUrl("https://evil.example/a.png")).toBe(false)

        const { result } = renderHook(() =>
          useAdStudio({
            currentStep: 3,
            config: {
              ...initialStudioConfig,
              productName: "Headphones",
              productDescription: "Valid description"
            },
            generatedCopy: mockCopy,
            editableCopy: validEditableCopy
          })
        )

        const rejectedPayloads = [
          "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
          "data:image/gif;base64,R0lGODlh",
          "data:image/png,abc",
          "data:image/webp;base64,",
          "data:image/jpeg;base64,bad payload!"
        ]

        for (const badDataUrl of rejectedPayloads) {
          global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                image: {
                  base64: "abc",
                  dataUrl: badDataUrl,
                  format: "webp",
                  aspectRatio: "1:1",
                  finishReason: "SUCCESS"
                }
              }
            })
          }) as any

          let ok = true
          await act(async () => {
            ok = await result.current.handleGenerateVisual()
          })
          expect(ok).toBe(false)
          expect(result.current.visualGenerationError).toContain("unexpected image response")
          expect(result.current.selectedBackground).toBeNull()
        }

        // Valid PNG and JPEG responses succeed
        for (const format of ["png", "jpeg"] as const) {
          global.fetch = jest.fn().mockResolvedValue(
            createVisualSuccessResponse({
              dataUrl: `data:image/${format};base64,${mockBase64}`
            })
          ) as any

          let ok = false
          await act(async () => {
            ok = await result.current.handleGenerateVisual()
          })
          expect(ok).toBe(true)
          expect(result.current.generatedVisual?.dataUrl).toBe(
            `data:image/${format};base64,${mockBase64}`
          )
        }
      })

      it("[A4.3-003] auto-expands Advanced Options when visualSeed or negativePrompt errors exist and restores toggle after error clears", () => {
        const { getByRole, getByLabelText, getByText, rerender } = render(
          React.createElement(AdStudioVisualStep, {
            ...baseProps,
            visualSeed: "bad-seed",
            visualFieldErrors: {
              visualSeed: "Seed must be a non-negative whole integer"
            }
          })
        )

        const toggleBtn = getByRole("button", {
          name: /Advanced Generation Options/i
        })
        expect(toggleBtn.getAttribute("aria-expanded")).toBe("true")
        expect(getByLabelText(/Generation Seed/i)).toBeTruthy()
        expect(getByText("Seed must be a non-negative whole integer")).toBeTruthy()

        // Cannot manually collapse while advanced field error remains
        fireEvent.click(toggleBtn)
        expect(toggleBtn.getAttribute("aria-expanded")).toBe("true")

        // Also test negativePrompt error auto-opening
        rerender(
          React.createElement(AdStudioVisualStep, {
            ...baseProps,
            negativePrompt: "X".repeat(501),
            visualFieldErrors: {
              negativePrompt: "Negative prompt cannot exceed 500 characters"
            }
          })
        )
        expect(toggleBtn.getAttribute("aria-expanded")).toBe("true")
        expect(getByText("Negative prompt cannot exceed 500 characters")).toBeTruthy()

        // When error clears, accordion becomes collapsible cleanly
        rerender(
          React.createElement(AdStudioVisualStep, {
            ...baseProps,
            visualSeed: "42",
            visualFieldErrors: {}
          })
        )
        expect(toggleBtn.getAttribute("aria-expanded")).toBe("false")
        fireEvent.click(toggleBtn)
        expect(toggleBtn.getAttribute("aria-expanded")).toBe("true")
        fireEvent.click(toggleBtn)
        expect(toggleBtn.getAttribute("aria-expanded")).toBe("false")
      })

      it("[A4.3-004] uses native radio controls for model selection and keeps interactive controls outside role='status'", () => {
        const onModelChange = jest.fn()
        const { getByRole, getAllByRole, getByLabelText } = render(
          React.createElement(AdStudioVisualStep, {
            ...baseProps,
            backgroundPrompt: "Updated studio backdrop prompt",
            generatedBackgrounds: [sampleItem],
            selectedBackground: sampleItem,
            isVisualPromptStale: true,
            isVisualStale: true,
            onVisualModelChange: onModelChange
          })
        )

        const ultraRadio = getByRole("radio", {
          name: /Stability Image Ultra/i
        }) as HTMLInputElement
        const coreRadio = getByRole("radio", {
          name: /Stability Image Core/i
        }) as HTMLInputElement

        expect(ultraRadio.tagName).toBe("INPUT")
        expect(ultraRadio.type).toBe("radio")
        expect(ultraRadio.name).toBe("stabilityModel")
        expect(ultraRadio.checked).toBe(true)
        expect(coreRadio.checked).toBe(false)

        fireEvent.click(coreRadio)
        expect(onModelChange).toHaveBeenCalledWith("stability-image-core")

        // Status live region should contain only non-interactive status message text, not buttons or checkbox
        const statusRegion = getByRole("status")
        const revertBtn = getByRole("button", { name: "Revert Prompt" })
        const regenBtns = getAllByRole("button", { name: "Regenerate Background" })
        const ackCheckbox = getByLabelText(/Keep selected background anyway/i)

        expect(statusRegion.contains(revertBtn)).toBe(false)
        expect(regenBtns.length).toBeGreaterThanOrEqual(1)
        regenBtns.forEach(btn => expect(statusRegion.contains(btn)).toBe(false))
        expect(statusRegion.contains(ackCheckbox)).toBe(false)
      })
    })
  })
})
