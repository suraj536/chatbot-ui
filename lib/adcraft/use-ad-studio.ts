import { useState, useCallback, useRef, useEffect } from "react"
import {
  AD_FORMATS,
  AD_PLATFORMS,
  AD_TONES,
  AdFormatName,
  AdPlatform,
  AdTone,
  GeneratedAdCopy,
  GeneratedAdVisual,
  SUPPORTED_STABILITY_MODELS,
  SupportedStabilityModel
} from "@/types/adcraft"

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]
export const MIN_BACKGROUND_PROMPT_LENGTH = 10
export const MAX_BACKGROUND_PROMPT_LENGTH = 700
export const DEFAULT_VISUAL_MODEL: SupportedStabilityModel = "stability-image-ultra"
export const MAX_BACKGROUND_HISTORY = 6
export const MAX_STABILITY_SEED = 4294967295
export const RASTER_IMAGE_DATA_URL_REGEX =
  /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/i

/**
 * Validates that a generated visual data URL is a non-empty base64-encoded raster image (webp, png, or jpeg).
 */
export function isValidRasterImageDataUrl(dataUrl: unknown): dataUrl is string {
  if (typeof dataUrl !== "string") return false
  return RASTER_IMAGE_DATA_URL_REGEX.test(dataUrl.trim())
}

export const CORE_CONFIG_FIELDS: (keyof AdStudioConfig)[] = [
  "productName",
  "productDescription",
  "productFeatures",
  "platform",
  "format",
  "tone",
  "targetAudience",
  "brandName",
  "price",
  "offer",
  "campaignObjective",
  "callToAction"
]

export interface AdStudioAsset {
  file: File | null
  dataUrl: string | null
  name: string | null
  size: number | null
}

export interface AdStudioConfig {
  productName: string
  productDescription: string
  targetAudience: string
  productFeatures: string[]
  price: string
  offer: string
  campaignObjective: string
  platform: AdPlatform
  tone: AdTone
  format: AdFormatName
  callToAction: string
  brandName: string
}

export interface EditableAdCopy {
  headline: string
  primaryText: string
  description: string
  callToAction: string
  backgroundPrompt: string
}

export interface GeneratedBackgroundItem {
  id: string
  visual: GeneratedAdVisual
  promptUsed: string
  negativePromptUsed: string
  formatUsed: AdFormatName
  modelUsed: SupportedStabilityModel
  width: number
  height: number
  aspectRatio: string
  stabilityAspectRatio: string
  generatedAt: string
}

export interface AdStudioState {
  currentStep: number
  config: AdStudioConfig
  productImage: AdStudioAsset
  logoImage: AdStudioAsset
  validationErrors: Record<string, string>
  navigationError: string | null
  generatedCopy: GeneratedAdCopy | null
  editableCopy: EditableAdCopy
  isGeneratingCopy: boolean
  copyGenerationError: string | null
  isCopyStale: boolean
  visualModel: SupportedStabilityModel
  negativePrompt: string
  visualSeed: string
  generatedBackgrounds: GeneratedBackgroundItem[]
  selectedBackgroundId: string | null
  isGeneratingVisual: boolean
  visualGenerationError: string | null
  staleVisualAcknowledged: boolean
}

export const initialStudioConfig: AdStudioConfig = {
  productName: "",
  productDescription: "",
  targetAudience: "",
  productFeatures: [],
  price: "",
  offer: "",
  campaignObjective: "",
  platform: "instagram",
  tone: "professional",
  format: "square",
  callToAction: "",
  brandName: ""
}

export const initialAsset: AdStudioAsset = {
  file: null,
  dataUrl: null,
  name: null,
  size: null
}

export const initialEditableCopy: EditableAdCopy = {
  headline: "",
  primaryText: "",
  description: "",
  callToAction: "",
  backgroundPrompt: ""
}

/**
 * Validates whether an uploaded image file conforms to allowed MIME types and size limit.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported image format (${file.type || "unknown"}). Only PNG, JPEG, and WebP are supported.`
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File size exceeds the 10MB limit (${sizeMb}MB). Please choose a smaller image.`
    }
  }

  return { valid: true }
}

/**
 * Reads a browser File object as a Base64 data URL.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("Failed to read file as data URL"))
      }
    }
    reader.onerror = () => {
      reject(reader.error || new Error("Failed to read file"))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Validates Step 1 configuration inputs according to the AdGenerationRequestSchema rules.
 */
export function validateConfigStep1(config: AdStudioConfig): {
  valid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}

  const trimmedName = config.productName.trim()
  if (!trimmedName) {
    errors.productName = "Product name is required"
  } else if (trimmedName.length > 120) {
    errors.productName = "Product name cannot exceed 120 characters"
  }

  const trimmedDesc = config.productDescription.trim()
  if (!trimmedDesc) {
    errors.productDescription = "Product description is required"
  } else if (trimmedDesc.length < 5) {
    errors.productDescription = "Product description must be at least 5 characters"
  } else if (trimmedDesc.length > 2000) {
    errors.productDescription = "Product description cannot exceed 2000 characters"
  }

  if (config.productFeatures && config.productFeatures.length > 0) {
    if (config.productFeatures.length > 10) {
      errors.productFeatures = "Maximum 10 product features allowed"
    } else {
      const invalidFeature = config.productFeatures.find((f) => f.trim().length > 200)
      if (invalidFeature) {
        errors.productFeatures = "Product features cannot exceed 200 characters each"
      }
    }
  }

  if (config.targetAudience && config.targetAudience.trim().length > 300) {
    errors.targetAudience = "Target audience cannot exceed 300 characters"
  }

  if (config.price && config.price.trim().length > 50) {
    errors.price = "Price cannot exceed 50 characters"
  }

  if (config.offer && config.offer.trim().length > 100) {
    errors.offer = "Offer cannot exceed 100 characters"
  }

  if (config.campaignObjective && config.campaignObjective.trim().length > 80) {
    errors.campaignObjective = "Campaign objective cannot exceed 80 characters"
  }

  if (config.callToAction && config.callToAction.trim().length > 60) {
    errors.callToAction = "Call to action cannot exceed 60 characters"
  }

  if (config.brandName && config.brandName.trim().length > 100) {
    errors.brandName = "Brand name cannot exceed 100 characters"
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Validates Step 2 editable copy according to GeneratedAdCopy length constraints.
 */
export function validateConfigStep2(copy: EditableAdCopy): {
  valid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}

  const headline = copy.headline.trim()
  if (!headline) {
    errors.headline = "Headline is required"
  } else if (headline.length < 3) {
    errors.headline = "Headline must be at least 3 characters"
  } else if (headline.length > 150) {
    errors.headline = "Headline cannot exceed 150 characters"
  }

  const primaryText = copy.primaryText.trim()
  if (!primaryText) {
    errors.primaryText = "Primary text is required"
  } else if (primaryText.length < 10) {
    errors.primaryText = "Primary text must be at least 10 characters"
  } else if (primaryText.length > 600) {
    errors.primaryText = "Primary text cannot exceed 600 characters"
  }

  const description = copy.description.trim()
  if (!description) {
    errors.description = "Description is required"
  } else if (description.length < 5) {
    errors.description = "Description must be at least 5 characters"
  } else if (description.length > 350) {
    errors.description = "Description cannot exceed 350 characters"
  }

  const cta = copy.callToAction.trim()
  if (!cta) {
    errors.callToAction = "Call to action is required"
  } else if (cta.length < 2) {
    errors.callToAction = "Call to action must be at least 2 characters"
  } else if (cta.length > 60) {
    errors.callToAction = "Call to action cannot exceed 60 characters"
  }

  const bgPrompt = copy.backgroundPrompt.trim()
  if (!bgPrompt) {
    errors.backgroundPrompt = "Background prompt is required"
  } else if (bgPrompt.length < MIN_BACKGROUND_PROMPT_LENGTH) {
    errors.backgroundPrompt = `Background prompt must be at least ${MIN_BACKGROUND_PROMPT_LENGTH} characters`
  } else if (bgPrompt.length > MAX_BACKGROUND_PROMPT_LENGTH) {
    errors.backgroundPrompt = `Background prompt cannot exceed ${MAX_BACKGROUND_PROMPT_LENGTH} characters`
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}

export interface VisualStepValidationInput {
  backgroundPrompt: string
  visualModel?: SupportedStabilityModel | string
  negativePrompt?: string
  visualSeed?: string
}

/**
 * Validates Step 3 Stability AI visual generation parameters.
 * Uses the unified 10-700 background prompt bounds shared with Step 2 (within API schema 5-1000).
 */
export function validateConfigStep3(input: VisualStepValidationInput): {
  valid: boolean
  errors: Record<string, string>
  parsedSeed?: number
} {
  const errors: Record<string, string> = {}

  const bgPrompt = (input.backgroundPrompt ?? "").trim()
  if (!bgPrompt) {
    errors.backgroundPrompt = "Background prompt is required"
  } else if (bgPrompt.length < MIN_BACKGROUND_PROMPT_LENGTH) {
    errors.backgroundPrompt = `Background prompt must be at least ${MIN_BACKGROUND_PROMPT_LENGTH} characters`
  } else if (bgPrompt.length > MAX_BACKGROUND_PROMPT_LENGTH) {
    errors.backgroundPrompt = `Background prompt cannot exceed ${MAX_BACKGROUND_PROMPT_LENGTH} characters`
  }

  if (
    input.visualModel !== undefined &&
    !SUPPORTED_STABILITY_MODELS.includes(input.visualModel as SupportedStabilityModel)
  ) {
    errors.visualModel = `Model must be one of: ${SUPPORTED_STABILITY_MODELS.join(", ")}`
  }

  const negPrompt = (input.negativePrompt ?? "").trim()
  if (negPrompt.length > 500) {
    errors.negativePrompt = "Negative prompt cannot exceed 500 characters"
  }

  let parsedSeed: number | undefined
  const rawSeed = (input.visualSeed ?? "").trim()
  if (rawSeed !== "") {
    if (!/^\d+$/.test(rawSeed)) {
      errors.visualSeed = "Seed must be a non-negative whole integer"
    } else {
      const numericSeed = Number(rawSeed)
      if (!Number.isSafeInteger(numericSeed) || numericSeed < 0 || numericSeed > MAX_STABILITY_SEED) {
        errors.visualSeed = `Seed must be an integer between 0 and ${MAX_STABILITY_SEED}`
      } else {
        parsedSeed = numericSeed
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    parsedSeed
  }
}

/**
 * Custom hook to manage the AdCraft Studio configuration, assets, validation,
 * AI copy generation, copy editing, and multi-step workflow state.
 */
export function useAdStudio(initialState?: Partial<AdStudioState>) {
  const [currentStep, setCurrentStep] = useState<number>(initialState?.currentStep ?? 1)
  const [config, setConfig] = useState<AdStudioConfig>({
    ...initialStudioConfig,
    ...initialState?.config
  })
  const [productImage, setProductImage] = useState<AdStudioAsset>(
    initialState?.productImage ?? initialAsset
  )
  const [logoImage, setLogoImage] = useState<AdStudioAsset>(
    initialState?.logoImage ?? initialAsset
  )
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>(
    initialState?.validationErrors ?? {}
  )
  const [navigationError, setNavigationError] = useState<string | null>(
    initialState?.navigationError ?? null
  )

  // Step 2 Copy Generation & Editing state
  const [generatedCopy, setGeneratedCopy] = useState<GeneratedAdCopy | null>(
    initialState?.generatedCopy ?? null
  )
  const [editableCopy, setEditableCopy] = useState<EditableAdCopy>(
    initialState?.editableCopy ?? initialEditableCopy
  )
  const [isGeneratingCopy, setIsGeneratingCopy] = useState<boolean>(
    initialState?.isGeneratingCopy ?? false
  )
  const [copyGenerationError, setCopyGenerationError] = useState<string | null>(
    initialState?.copyGenerationError ?? null
  )
  const [isCopyStale, setIsCopyStale] = useState<boolean>(
    initialState?.isCopyStale ?? false
  )

  // Step 3 Visual Generation & Background Selection state
  const [visualModel, setVisualModel] = useState<SupportedStabilityModel>(
    initialState?.visualModel ?? DEFAULT_VISUAL_MODEL
  )
  const [negativePrompt, setNegativePrompt] = useState<string>(
    initialState?.negativePrompt ?? ""
  )
  const [visualSeed, setVisualSeed] = useState<string>(
    initialState?.visualSeed ?? ""
  )
  const [generatedBackgrounds, setGeneratedBackgrounds] = useState<GeneratedBackgroundItem[]>(
    initialState?.generatedBackgrounds ?? []
  )
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(
    initialState?.selectedBackgroundId ??
      (initialState?.generatedBackgrounds?.[0]?.id ?? null)
  )
  const [isGeneratingVisual, setIsGeneratingVisual] = useState<boolean>(
    initialState?.isGeneratingVisual ?? false
  )
  const [visualGenerationError, setVisualGenerationError] = useState<string | null>(
    initialState?.visualGenerationError ?? null
  )
  const [visualFieldErrors, setVisualFieldErrors] = useState<Record<string, string>>({})
  const [staleVisualAcknowledged, setStaleVisualAcknowledged] = useState<boolean>(
    initialState?.staleVisualAcknowledged ?? false
  )

  // Monotonic sequence counters for race condition prevention
  const productSelectionSeqRef = useRef<number>(0)
  const logoSelectionSeqRef = useRef<number>(0)
  const copyGenerationSeqRef = useRef<number>(0)
  const isGeneratingCopyRef = useRef<boolean>(false)
  const generatedCopyRef = useRef<GeneratedAdCopy | null>(
    initialState?.generatedCopy ?? null
  )
  const visualGenerationSeqRef = useRef<number>(0)
  const isGeneratingVisualRef = useRef<boolean>(false)
  const visualAbortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef<boolean>(true)

  const abortAndInvalidatePendingRequests = useCallback(() => {
    productSelectionSeqRef.current++
    logoSelectionSeqRef.current++
    copyGenerationSeqRef.current++
    visualGenerationSeqRef.current++
    isGeneratingCopyRef.current = false
    isGeneratingVisualRef.current = false
    if (visualAbortControllerRef.current) {
      visualAbortControllerRef.current.abort()
      visualAbortControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      abortAndInvalidatePendingRequests()
    }
  }, [abortAndInvalidatePendingRequests])

  // Derived Step 3 selection & staleness states
  const selectedBackground =
    generatedBackgrounds.find(bg => bg.id === selectedBackgroundId) ?? null
  const generatedVisual = selectedBackground?.visual ?? null
  const isVisualPromptStale = Boolean(
    selectedBackground &&
      selectedBackground.promptUsed.trim() !== editableCopy.backgroundPrompt.trim()
  )
  const isVisualFormatStale = Boolean(
    selectedBackground && selectedBackground.formatUsed !== config.format
  )
  const isVisualStale = isVisualPromptStale || isVisualFormatStale

  const clearNavigationError = useCallback(() => {
    setNavigationError(null)
  }, [])

  const handleConfigChange = useCallback(
    (field: keyof AdStudioConfig, value: any) => {
      setConfig(prev => ({
        ...prev,
        [field]: value
      }))
      setNavigationError(null)

      // Clear validation error for this field if one was set
      setValidationErrors(prev => {
        if (!prev[field]) return prev
        const next = { ...prev }
        delete next[field]
        return next
      })

      // If copy was already generated and a core field is modified, mark copy as stale
      if (CORE_CONFIG_FIELDS.includes(field) && generatedCopyRef.current) {
        setIsCopyStale(true)
      }

      if (field === "format") {
        setStaleVisualAcknowledged(false)
      }
    },
    []
  )

  const handleProductImageSelect = useCallback(async (file: File): Promise<boolean> => {
    const seq = ++productSelectionSeqRef.current

    const validation = validateImageFile(file)
    if (!validation.valid) {
      if (seq === productSelectionSeqRef.current) {
        setValidationErrors(prev => ({
          ...prev,
          productImage: validation.error || "Invalid product image"
        }))
      }
      return false
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      // Only commit if this operation is still the latest initiated selection
      if (seq !== productSelectionSeqRef.current) {
        return false
      }

      setProductImage({
        file,
        dataUrl,
        name: file.name,
        size: file.size
      })
      setValidationErrors(prev => {
        const next = { ...prev }
        delete next.productImage
        return next
      })
      return true
    } catch (err: any) {
      if (seq === productSelectionSeqRef.current) {
        setValidationErrors(prev => ({
          ...prev,
          productImage: "Failed to read product image file"
        }))
      }
      return false
    }
  }, [])

  const handleProductImageRemove = useCallback(() => {
    productSelectionSeqRef.current++
    setProductImage(initialAsset)
    setValidationErrors(prev => {
      const next = { ...prev }
      delete next.productImage
      return next
    })
  }, [])

  const handleLogoImageSelect = useCallback(async (file: File): Promise<boolean> => {
    const seq = ++logoSelectionSeqRef.current

    const validation = validateImageFile(file)
    if (!validation.valid) {
      if (seq === logoSelectionSeqRef.current) {
        setValidationErrors(prev => ({
          ...prev,
          logoImage: validation.error || "Invalid logo image"
        }))
      }
      return false
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      // Only commit if this operation is still the latest initiated selection
      if (seq !== logoSelectionSeqRef.current) {
        return false
      }

      setLogoImage({
        file,
        dataUrl,
        name: file.name,
        size: file.size
      })
      setValidationErrors(prev => {
        const next = { ...prev }
        delete next.logoImage
        return next
      })
      return true
    } catch (err: any) {
      if (seq === logoSelectionSeqRef.current) {
        setValidationErrors(prev => ({
          ...prev,
          logoImage: "Failed to read logo image file"
        }))
      }
      return false
    }
  }, [])

  const handleLogoImageRemove = useCallback(() => {
    logoSelectionSeqRef.current++
    setLogoImage(initialAsset)
    setValidationErrors(prev => {
      const next = { ...prev }
      delete next.logoImage
      return next
    })
  }, [])

  const validateStep1 = useCallback((): boolean => {
    const { valid, errors } = validateConfigStep1(config)
    setValidationErrors(prev => ({
      ...prev,
      ...errors
    }))
    return valid
  }, [config])

  const validateStep2 = useCallback((): boolean => {
    const { valid, errors } = validateConfigStep2(editableCopy)
    if (!valid) {
      const firstError = Object.values(errors)[0]
      setCopyGenerationError(firstError)
      return false
    }
    setCopyGenerationError(null)
    return true
  }, [editableCopy])

  const handleGenerateCopy = useCallback(
    async (workspaceId?: string): Promise<boolean> => {
      // Prevent duplicate generation requests if one is already in-flight
      if (isGeneratingCopyRef.current) {
        return false
      }

      const isStep1Valid = validateStep1()
      if (!isStep1Valid) {
        return false
      }

      const seq = ++copyGenerationSeqRef.current
      isGeneratingCopyRef.current = true
      setIsGeneratingCopy(true)
      setCopyGenerationError(null)
      setNavigationError(null)

      try {
        const payload: Record<string, any> = {
          productName: config.productName.trim(),
          productDescription: config.productDescription.trim(),
          platform: config.platform,
          tone: config.tone,
          format: config.format
        }

        if (config.productFeatures && config.productFeatures.length > 0) {
          payload.productFeatures = config.productFeatures
        }
        if (config.targetAudience?.trim()) {
          payload.targetAudience = config.targetAudience.trim()
        }
        if (config.brandName?.trim()) {
          payload.brandName = config.brandName.trim()
        }
        if (config.price?.trim()) {
          payload.price = config.price.trim()
        }
        if (config.offer?.trim()) {
          payload.offer = config.offer.trim()
        }
        if (config.campaignObjective?.trim()) {
          payload.campaignObjective = config.campaignObjective.trim()
        }
        if (config.callToAction?.trim()) {
          payload.callToAction = config.callToAction.trim()
        }
        if (workspaceId) {
          payload.workspaceId = workspaceId
        }

        const res = await fetch("/api/adcraft/generate-copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })

        // Guard against superseded requests
        if (seq !== copyGenerationSeqRef.current) {
          return false
        }

        let data: any = null
        try {
          data = await res.json()
        } catch {
          data = null
        }

        if (!res.ok || !data?.success) {
          const errMsg =
            (typeof data?.message === "string" && data.message.trim()) ||
            (typeof data?.error === "string" && data.error.trim()) ||
            `Copy generation failed (${res.status})`
          setCopyGenerationError(errMsg)
          return false
        }

        const copy: GeneratedAdCopy = data.data.copy
        generatedCopyRef.current = copy
        setGeneratedCopy(copy)
        setEditableCopy({
          headline: copy.headline,
          primaryText: copy.primaryText,
          description: copy.description,
          callToAction: copy.callToAction,
          backgroundPrompt: copy.backgroundPrompt
        })
        setIsCopyStale(false)
        setStaleVisualAcknowledged(false)
        setCurrentStep(2)
        return true
      } catch (err: any) {
        if (seq !== copyGenerationSeqRef.current) {
          return false
        }
        const msg = err.message || "Network error while generating ad copy"
        setCopyGenerationError(msg)
        return false
      } finally {
        if (seq === copyGenerationSeqRef.current) {
          isGeneratingCopyRef.current = false
          setIsGeneratingCopy(false)
        }
      }
    },
    [config, validateStep1]
  )

  const handleCopyFieldChange = useCallback(
    (field: keyof EditableAdCopy, value: string) => {
      setEditableCopy(prev => ({
        ...prev,
        [field]: value
      }))
      setNavigationError(null)
      if (copyGenerationError) {
        setCopyGenerationError(null)
      }
      if (field === "backgroundPrompt") {
        setStaleVisualAcknowledged(false)
        if (visualGenerationError) {
          setVisualGenerationError(null)
        }
        setVisualFieldErrors(prev => {
          if (!prev.backgroundPrompt) return prev
          const next = { ...prev }
          delete next.backgroundPrompt
          return next
        })
      }
    },
    [copyGenerationError, visualGenerationError]
  )

  const handleSelectHeadlineAlternative = useCallback((headline: string) => {
    setEditableCopy(prev => ({
      ...prev,
      headline
    }))
  }, [])

  const handleSelectCopyAlternative = useCallback((primaryText: string) => {
    setEditableCopy(prev => ({
      ...prev,
      primaryText
    }))
  }, [])

  // Step 3 handlers
  const validateStep3 = useCallback((): boolean => {
    const { valid, errors } = validateConfigStep3({
      backgroundPrompt: editableCopy.backgroundPrompt,
      visualModel,
      negativePrompt,
      visualSeed
    })
    setVisualFieldErrors(errors)
    if (!valid) {
      const firstError = Object.values(errors)[0]
      setVisualGenerationError(firstError)
      return false
    }
    setVisualGenerationError(null)
    return true
  }, [editableCopy.backgroundPrompt, negativePrompt, visualModel, visualSeed])

  const handleBackgroundPromptChange = useCallback(
    (value: string) => {
      setEditableCopy(prev => ({
        ...prev,
        backgroundPrompt: value
      }))
      setStaleVisualAcknowledged(false)
      setNavigationError(null)
      if (visualGenerationError) {
        setVisualGenerationError(null)
      }
      if (copyGenerationError) {
        setCopyGenerationError(null)
      }
      setVisualFieldErrors(prev => {
        if (!prev.backgroundPrompt) return prev
        const next = { ...prev }
        delete next.backgroundPrompt
        return next
      })
    },
    [copyGenerationError, visualGenerationError]
  )

  const handleVisualModelChange = useCallback(
    (model: SupportedStabilityModel) => {
      setVisualModel(model)
      if (visualGenerationError) {
        setVisualGenerationError(null)
      }
      setVisualFieldErrors(prev => {
        if (!prev.visualModel) return prev
        const next = { ...prev }
        delete next.visualModel
        return next
      })
    },
    [visualGenerationError]
  )

  const handleNegativePromptChange = useCallback(
    (value: string) => {
      setNegativePrompt(value)
      if (visualGenerationError) {
        setVisualGenerationError(null)
      }
      setVisualFieldErrors(prev => {
        if (!prev.negativePrompt) return prev
        const next = { ...prev }
        delete next.negativePrompt
        return next
      })
    },
    [visualGenerationError]
  )

  const handleVisualSeedChange = useCallback(
    (value: string) => {
      setVisualSeed(value)
      if (visualGenerationError) {
        setVisualGenerationError(null)
      }
      setVisualFieldErrors(prev => {
        if (!prev.visualSeed) return prev
        const next = { ...prev }
        delete next.visualSeed
        return next
      })
    },
    [visualGenerationError]
  )

  const handleSelectBackground = useCallback(
    (id: string) => {
      const exists = generatedBackgrounds.some(bg => bg.id === id)
      if (!exists) return
      setSelectedBackgroundId(id)
      setStaleVisualAcknowledged(false)
      setNavigationError(null)
      if (visualGenerationError) {
        setVisualGenerationError(null)
      }
    },
    [generatedBackgrounds, visualGenerationError]
  )

  const handleRevertPromptToSelected = useCallback(() => {
    if (!selectedBackground) return
    setEditableCopy(prev => ({
      ...prev,
      backgroundPrompt: selectedBackground.promptUsed
    }))
    setStaleVisualAcknowledged(false)
    setNavigationError(null)
    setVisualGenerationError(null)
    setVisualFieldErrors(prev => {
      if (!prev.backgroundPrompt) return prev
      const next = { ...prev }
      delete next.backgroundPrompt
      return next
    })
  }, [selectedBackground])

  const handleAcknowledgeStaleVisual = useCallback(
    (acknowledged: boolean) => {
      setStaleVisualAcknowledged(acknowledged)
      setNavigationError(null)
      if (acknowledged && visualGenerationError) {
        setVisualGenerationError(null)
      }
    },
    [visualGenerationError]
  )

  const handleGenerateVisual = useCallback(
    async (workspaceId?: string): Promise<boolean> => {
      if (isGeneratingVisualRef.current) {
        return false
      }

      const validation = validateConfigStep3({
        backgroundPrompt: editableCopy.backgroundPrompt,
        visualModel,
        negativePrompt,
        visualSeed
      })
      setVisualFieldErrors(validation.errors)
      if (!validation.valid) {
        const firstError = Object.values(validation.errors)[0]
        setVisualGenerationError(firstError)
        return false
      }

      const promptSnapshot = editableCopy.backgroundPrompt.trim()
      const negativePromptSnapshot = negativePrompt.trim()
      const formatSnapshot = config.format
      const modelSnapshot = visualModel
      const seedSnapshot = validation.parsedSeed

      const seq = ++visualGenerationSeqRef.current
      isGeneratingVisualRef.current = true
      setIsGeneratingVisual(true)
      setVisualGenerationError(null)
      setNavigationError(null)

      const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null
      visualAbortControllerRef.current = controller

      try {
        const payload: Record<string, any> = {
          backgroundPrompt: promptSnapshot,
          format: formatSnapshot,
          model: modelSnapshot
        }

        if (negativePromptSnapshot) {
          payload.negativePrompt = negativePromptSnapshot
        }
        if (typeof seedSnapshot === "number") {
          payload.seed = seedSnapshot
        }
        if (workspaceId) {
          payload.workspaceId = workspaceId
        }

        const res = await fetch("/api/adcraft/generate-visual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          ...(controller ? { signal: controller.signal } : {})
        })

        if (seq !== visualGenerationSeqRef.current) {
          return false
        }

        let data: any = null
        try {
          data = await res.json()
        } catch {
          data = null
        }

        if (seq !== visualGenerationSeqRef.current) {
          return false
        }

        if (!res.ok || !data?.success) {
          const errMsg =
            (typeof data?.message === "string" && data.message.trim()) ||
            (typeof data?.error === "string" && data.error.trim()) ||
            `Visual generation failed (${res.status})`
          setVisualGenerationError(errMsg)
          return false
        }

        const image: GeneratedAdVisual | undefined = data?.data?.image
        if (
          !image ||
          typeof image.base64 !== "string" ||
          !image.base64.trim() ||
          !isValidRasterImageDataUrl(image.dataUrl)
        ) {
          setVisualGenerationError(
            "Received an unexpected image response from the visual generation service. Please try again."
          )
          return false
        }

        const formatInfo = data?.data?.format
        const metadataInfo = data?.data?.metadata
        const formatFallback = AD_FORMATS[formatSnapshot]

        const newItem: GeneratedBackgroundItem = {
          id: `bg-${Date.now()}-${seq}`,
          visual: image,
          promptUsed: promptSnapshot,
          negativePromptUsed: negativePromptSnapshot,
          formatUsed: formatSnapshot,
          modelUsed: (metadataInfo?.model as SupportedStabilityModel) || modelSnapshot,
          width:
            typeof formatInfo?.width === "number"
              ? formatInfo.width
              : formatFallback.width,
          height:
            typeof formatInfo?.height === "number"
              ? formatInfo.height
              : formatFallback.height,
          aspectRatio:
            typeof formatInfo?.aspectRatio === "string"
              ? formatInfo.aspectRatio
              : formatFallback.aspectRatio,
          stabilityAspectRatio:
            typeof formatInfo?.stabilityAspectRatio === "string"
              ? formatInfo.stabilityAspectRatio
              : image.aspectRatio,
          generatedAt:
            typeof metadataInfo?.generatedAt === "string"
              ? metadataInfo.generatedAt
              : new Date().toISOString()
        }

        setGeneratedBackgrounds(prev =>
          [newItem, ...prev].slice(0, MAX_BACKGROUND_HISTORY)
        )
        setSelectedBackgroundId(newItem.id)
        setStaleVisualAcknowledged(false)
        setVisualGenerationError(null)
        return true
      } catch (err: any) {
        if (seq !== visualGenerationSeqRef.current) {
          return false
        }
        if (err?.name === "AbortError") {
          setVisualGenerationError("Background generation was cancelled.")
          return false
        }
        const msg =
          typeof err?.message === "string" && err.message.trim()
            ? err.message
            : "Network error while generating background visual"
        setVisualGenerationError(msg)
        return false
      } finally {
        if (seq === visualGenerationSeqRef.current) {
          isGeneratingVisualRef.current = false
          visualAbortControllerRef.current = null
          setIsGeneratingVisual(false)
        }
      }
    },
    [
      config.format,
      editableCopy.backgroundPrompt,
      negativePrompt,
      visualModel,
      visualSeed
    ]
  )

  const handleNextStep = useCallback((): boolean => {
    if (currentStep === 1) {
      const res1 = validateConfigStep1(config)
      setValidationErrors(prev => ({
        ...prev,
        ...res1.errors
      }))
      if (!res1.valid) {
        const msg = Object.values(res1.errors)[0] || "Please fix required Step 1 fields."
        setNavigationError(msg)
        return false
      }
      setNavigationError(null)
      setCurrentStep(2)
      return true
    }

    if (currentStep === 2) {
      // Must have generated copy and pass validation to advance to Step 3
      if (!generatedCopy) {
        const msg = "Please generate ad copy before proceeding to background generation."
        setCopyGenerationError(msg)
        setNavigationError(msg)
        return false
      }
      const res1 = validateConfigStep1(config)
      setValidationErrors(prev => ({
        ...prev,
        ...res1.errors
      }))
      if (!res1.valid) {
        const msg = Object.values(res1.errors)[0] || "Please fix required Step 1 fields."
        setNavigationError(msg)
        return false
      }
      const res2 = validateConfigStep2(editableCopy)
      if (!res2.valid) {
        const msg = Object.values(res2.errors)[0]
        setCopyGenerationError(msg)
        setNavigationError(msg)
        return false
      }
      setCopyGenerationError(null)
      setNavigationError(null)
      setCurrentStep(3)
      return true
    }

    if (currentStep === 3) {
      if (isGeneratingVisualRef.current) {
        setNavigationError("Please wait for background generation to finish before continuing.")
        return false
      }
      const res1 = validateConfigStep1(config)
      setValidationErrors(prev => ({
        ...prev,
        ...res1.errors
      }))
      if (!res1.valid) {
        const msg = Object.values(res1.errors)[0] || "Please fix required Step 1 fields."
        setVisualGenerationError(msg)
        setNavigationError(msg)
        return false
      }
      if (!generatedCopy) {
        const msg = "Please generate ad copy before proceeding to composition."
        setCopyGenerationError(msg)
        setVisualGenerationError(msg)
        setNavigationError(msg)
        return false
      }
      const res3 = validateConfigStep3({
        backgroundPrompt: editableCopy.backgroundPrompt,
        visualModel,
        negativePrompt,
        visualSeed
      })
      setVisualFieldErrors(res3.errors)
      if (!res3.valid) {
        const msg = Object.values(res3.errors)[0]
        setVisualGenerationError(msg)
        setNavigationError(msg)
        return false
      }
      const res2 = validateConfigStep2(editableCopy)
      if (!res2.valid) {
        const msg = Object.values(res2.errors)[0]
        setCopyGenerationError(msg)
        setVisualGenerationError(msg)
        setNavigationError(msg)
        return false
      }
      if (!selectedBackground) {
        const msg = "Please generate a background image before proceeding to composition."
        setVisualGenerationError(msg)
        setNavigationError(msg)
        return false
      }
      if ((isVisualPromptStale || isVisualFormatStale) && !staleVisualAcknowledged) {
        const reasons: string[] = []
        if (isVisualPromptStale) reasons.push("background prompt")
        if (isVisualFormatStale) reasons.push("creative format")
        const msg = `The ${reasons.join(" and ")} changed since this background was generated. Regenerate the background, revert the prompt, or confirm keeping the selected background.`
        setVisualGenerationError(msg)
        setNavigationError(msg)
        return false
      }
      setCopyGenerationError(null)
      setVisualGenerationError(null)
      setNavigationError(null)
      setCurrentStep(4)
      return true
    }

    if (currentStep < 4) {
      setNavigationError(null)
      setCurrentStep(prev => prev + 1)
      return true
    }

    return true
  }, [
    config,
    currentStep,
    editableCopy,
    generatedCopy,
    isVisualFormatStale,
    isVisualPromptStale,
    negativePrompt,
    selectedBackground,
    staleVisualAcknowledged,
    visualModel,
    visualSeed
  ])

  const handlePrevStep = useCallback(() => {
    setNavigationError(null)
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const goToStep = useCallback(
    (step: number): boolean => {
      if (step === 1) {
        setNavigationError(null)
        setCurrentStep(1)
        return true
      }

      if (step === 2) {
        const res1 = validateConfigStep1(config)
        setValidationErrors(prev => ({
          ...prev,
          ...res1.errors
        }))
        if (!res1.valid) {
          const msg = Object.values(res1.errors)[0] || "Please fix required Step 1 fields."
          setNavigationError(msg)
          return false
        }
        setNavigationError(null)
        setCurrentStep(2)
        return true
      }

      if (step === 3) {
        const res1 = validateConfigStep1(config)
        setValidationErrors(prev => ({
          ...prev,
          ...res1.errors
        }))
        if (!res1.valid) {
          const msg = Object.values(res1.errors)[0] || "Please fix required Step 1 fields."
          setNavigationError(msg)
          return false
        }
        if (!generatedCopy) {
          const msg = "Please generate ad copy before proceeding."
          setCopyGenerationError(msg)
          setNavigationError(msg)
          return false
        }
        const res2 = validateConfigStep2(editableCopy)
        if (!res2.valid) {
          const msg = Object.values(res2.errors)[0]
          setCopyGenerationError(msg)
          if (res2.errors.backgroundPrompt) {
            setVisualFieldErrors(prev => ({
              ...prev,
              backgroundPrompt: res2.errors.backgroundPrompt
            }))
          }
          setNavigationError(msg)
          return false
        }
        setCopyGenerationError(null)
        setNavigationError(null)
        setCurrentStep(3)
        return true
      }

      if (step === 4) {
        if (isGeneratingVisualRef.current) {
          setNavigationError("Please wait for background generation to finish before continuing.")
          return false
        }
        const res1 = validateConfigStep1(config)
        setValidationErrors(prev => ({
          ...prev,
          ...res1.errors
        }))
        if (!res1.valid) {
          const msg = Object.values(res1.errors)[0] || "Please fix required Step 1 fields."
          setNavigationError(msg)
          return false
        }
        if (!generatedCopy) {
          const msg = "Please generate ad copy before proceeding."
          setCopyGenerationError(msg)
          setNavigationError(msg)
          return false
        }
        const res3 = validateConfigStep3({
          backgroundPrompt: editableCopy.backgroundPrompt,
          visualModel,
          negativePrompt,
          visualSeed
        })
        setVisualFieldErrors(res3.errors)
        if (!res3.valid) {
          const msg = Object.values(res3.errors)[0]
          setVisualGenerationError(msg)
          setNavigationError(msg)
          return false
        }
        const res2 = validateConfigStep2(editableCopy)
        if (!res2.valid) {
          const msg = Object.values(res2.errors)[0]
          setCopyGenerationError(msg)
          setNavigationError(msg)
          return false
        }
        if (!selectedBackground) {
          const msg = "Please generate a background image before proceeding to composition."
          setVisualGenerationError(msg)
          setNavigationError(msg)
          return false
        }
        if ((isVisualPromptStale || isVisualFormatStale) && !staleVisualAcknowledged) {
          const msg =
            "The background prompt or creative format changed since this background was generated. Regenerate, revert, or confirm keeping the selected background."
          setVisualGenerationError(msg)
          setNavigationError(msg)
          return false
        }
        setCopyGenerationError(null)
        setVisualGenerationError(null)
        setNavigationError(null)
        setCurrentStep(4)
        return true
      }

      return false
    },
    [
      config,
      editableCopy,
      generatedCopy,
      isVisualFormatStale,
      isVisualPromptStale,
      negativePrompt,
      selectedBackground,
      staleVisualAcknowledged,
      visualModel,
      visualSeed
    ]
  )

  const reset = useCallback(() => {
    abortAndInvalidatePendingRequests()
    generatedCopyRef.current = null
    setCurrentStep(1)
    setConfig(initialStudioConfig)
    setProductImage(initialAsset)
    setLogoImage(initialAsset)
    setValidationErrors({})
    setNavigationError(null)
    setGeneratedCopy(null)
    setEditableCopy(initialEditableCopy)
    setIsGeneratingCopy(false)
    setCopyGenerationError(null)
    setIsCopyStale(false)
    setVisualModel(DEFAULT_VISUAL_MODEL)
    setNegativePrompt("")
    setVisualSeed("")
    setGeneratedBackgrounds([])
    setSelectedBackgroundId(null)
    setIsGeneratingVisual(false)
    setVisualGenerationError(null)
    setVisualFieldErrors({})
    setStaleVisualAcknowledged(false)
  }, [abortAndInvalidatePendingRequests])

  return {
    currentStep,
    config,
    productImage,
    logoImage,
    validationErrors,
    navigationError,
    // Step 2 copy generation state
    generatedCopy,
    editableCopy,
    isGeneratingCopy,
    copyGenerationError,
    isCopyStale,
    // Step 3 visual generation state
    visualModel,
    negativePrompt,
    visualSeed,
    generatedBackgrounds,
    selectedBackgroundId,
    selectedBackground,
    generatedVisual,
    isGeneratingVisual,
    visualGenerationError,
    visualFieldErrors,
    isVisualPromptStale,
    isVisualFormatStale,
    isVisualStale,
    staleVisualAcknowledged,
    // Step 1 handlers
    handleConfigChange,
    handleProductImageSelect,
    handleProductImageRemove,
    handleLogoImageSelect,
    handleLogoImageRemove,
    validateStep1,
    // Step 2 handlers
    handleGenerateCopy,
    handleCopyFieldChange,
    handleSelectHeadlineAlternative,
    handleSelectCopyAlternative,
    validateStep2,
    // Step 3 handlers
    handleGenerateVisual,
    handleBackgroundPromptChange,
    handleVisualModelChange,
    handleNegativePromptChange,
    handleVisualSeedChange,
    handleSelectBackground,
    handleRevertPromptToSelected,
    handleAcknowledgeStaleVisual,
    validateStep3,
    // Navigation & lifecycle
    handleNextStep,
    handlePrevStep,
    goToStep,
    clearNavigationError,
    reset
  }
}
