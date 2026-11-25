import { useState, useCallback, useRef } from "react"
import {
  AD_FORMATS,
  AD_PLATFORMS,
  AD_TONES,
  AdFormatName,
  AdPlatform,
  AdTone
} from "@/types/adcraft"

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]

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

export interface AdStudioState {
  currentStep: number
  config: AdStudioConfig
  productImage: AdStudioAsset
  logoImage: AdStudioAsset
  validationErrors: Record<string, string>
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
 * Custom hook to manage the AdCraft Studio configuration, assets, validation, and workflow state.
 */
export function useAdStudio(initialState?: Partial<AdStudioState>) {
  const [currentStep, setCurrentStep] = useState<number>(initialState?.currentStep ?? 1)
  const [config, setConfig] = useState<AdStudioConfig>({
    ...initialStudioConfig,
    ...(initialState?.config ?? {})
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

  const productSelectionSeqRef = useRef<number>(0)
  const logoSelectionSeqRef = useRef<number>(0)

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

  const handleNextStep = useCallback((): boolean => {
    if (currentStep === 1) {
      const isValid = validateStep1()
      if (!isValid) return false
      setCurrentStep(2)
      return true
    }

    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1)
      return true
    }

    return true
  }, [currentStep, validateStep1])

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

      if (step > 1) {
        const isValid = validateStep1()
        if (!isValid) return false
        setCurrentStep(Math.min(4, Math.max(1, step)))
        return true
      }

      return false
    },
    [validateStep1]
  )

  const reset = useCallback(() => {
    productSelectionSeqRef.current++
    logoSelectionSeqRef.current++
    setCurrentStep(1)
    setConfig(initialStudioConfig)
    setProductImage(initialAsset)
    setLogoImage(initialAsset)
    setValidationErrors({})
  }, [])

  return {
    currentStep,
    config,
    productImage,
    logoImage,
    validationErrors,
    handleConfigChange,
    handleProductImageSelect,
    handleProductImageRemove,
    handleLogoImageSelect,
    handleLogoImageRemove,
    validateStep1,
    handleNextStep,
    handlePrevStep,
    goToStep,
    reset
  }
}
