import { useState, useCallback, useRef } from "react"
import {
  AD_FORMATS,
  AD_PLATFORMS,
  AD_TONES,
  AdFormatName,
  AdPlatform,
  AdTone,
  GeneratedAdCopy
} from "@/types/adcraft"

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]

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

export interface AdStudioState {
  currentStep: number
  config: AdStudioConfig
  productImage: AdStudioAsset
  logoImage: AdStudioAsset
  validationErrors: Record<string, string>
  generatedCopy: GeneratedAdCopy | null
  editableCopy: EditableAdCopy
  isGeneratingCopy: boolean
  copyGenerationError: string | null
  isCopyStale: boolean
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
  } else if (bgPrompt.length < 10) {
    errors.backgroundPrompt = "Background prompt must be at least 10 characters"
  } else if (bgPrompt.length > 700) {
    errors.backgroundPrompt = "Background prompt cannot exceed 700 characters"
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
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

  // Monotonic sequence counters for race condition prevention
  const productSelectionSeqRef = useRef<number>(0)
  const logoSelectionSeqRef = useRef<number>(0)
  const copyGenerationSeqRef = useRef<number>(0)
  const isGeneratingCopyRef = useRef<boolean>(false)
  const generatedCopyRef = useRef<GeneratedAdCopy | null>(
    initialState?.generatedCopy ?? null
  )

  const handleConfigChange = useCallback(
    (field: keyof AdStudioConfig, value: any) => {
      setConfig(prev => ({
        ...prev,
        [field]: value
      }))

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
      if (copyGenerationError) {
        setCopyGenerationError(null)
      }
    },
    [copyGenerationError]
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

  const handleNextStep = useCallback((): boolean => {
    if (currentStep === 1) {
      const isValid = validateStep1()
      if (!isValid) return false
      setCurrentStep(2)
      return true
    }

    if (currentStep === 2) {
      // Must have generated copy and pass validation to advance to Step 3
      if (!generatedCopy) {
        setCopyGenerationError("Please generate ad copy before proceeding to background generation.")
        return false
      }
      const isValid = validateStep2()
      if (!isValid) return false
      setCurrentStep(3)
      return true
    }

    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1)
      return true
    }

    return true
  }, [currentStep, generatedCopy, validateStep1, validateStep2])

  const handlePrevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const goToStep = useCallback(
    (step: number): boolean => {
      if (step === 1) {
        setCurrentStep(1)
        return true
      }

      if (step === 2) {
        const isStep1Valid = validateStep1()
        if (!isStep1Valid) return false
        setCurrentStep(2)
        return true
      }

      if (step > 2) {
        const isStep1Valid = validateStep1()
        if (!isStep1Valid) return false
        if (!generatedCopy) {
          setCopyGenerationError("Please generate ad copy before proceeding.")
          return false
        }
        const isStep2Valid = validateStep2()
        if (!isStep2Valid) return false
        setCurrentStep(Math.min(4, Math.max(1, step)))
        return true
      }

      return false
    },
    [generatedCopy, validateStep1, validateStep2]
  )

  const reset = useCallback(() => {
    productSelectionSeqRef.current++
    logoSelectionSeqRef.current++
    copyGenerationSeqRef.current++
    isGeneratingCopyRef.current = false
    generatedCopyRef.current = null
    setCurrentStep(1)
    setConfig(initialStudioConfig)
    setProductImage(initialAsset)
    setLogoImage(initialAsset)
    setValidationErrors({})
    setGeneratedCopy(null)
    setEditableCopy(initialEditableCopy)
    setIsGeneratingCopy(false)
    setCopyGenerationError(null)
    setIsCopyStale(false)
  }, [])

  return {
    currentStep,
    config,
    productImage,
    logoImage,
    validationErrors,
    // Step 2 copy generation state
    generatedCopy,
    editableCopy,
    isGeneratingCopy,
    copyGenerationError,
    isCopyStale,
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
    // Navigation & lifecycle
    handleNextStep,
    handlePrevStep,
    goToStep,
    reset
  }
}
