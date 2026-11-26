import { renderHook, act, render, fireEvent, createEvent } from "@testing-library/react"
import React from "react"
import {
  useAdStudio,
  validateConfigStep1,
  validateConfigStep2,
  validateImageFile,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
  initialStudioConfig,
  initialAsset,
  initialEditableCopy,
  CORE_CONFIG_FIELDS
} from "@/lib/adcraft/use-ad-studio"
import { AdStudioConfigStep } from "@/components/adcraft/ad-studio-config-step"
import { AdStudioCopyStep } from "@/components/adcraft/ad-studio-copy-step"
import { GeneratedAdCopy } from "@/types/adcraft"

describe("useAdStudio Hook & Validation Utilities", () => {
  const originalFileReader = global.FileReader

  beforeEach(() => {
    class MockFileReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL(blob: Blob) {
        this.result = `data:${blob.type};base64,mockBase64String`
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    }
    global.FileReader = MockFileReader as any
  })

  afterEach(() => {
    global.FileReader = originalFileReader
  })

  describe("Initial State", () => {
    it("initializes with default step 1, clean config, and empty assets", () => {
      const { result } = renderHook(() => useAdStudio())

      expect(result.current.currentStep).toBe(1)
      expect(result.current.config).toEqual(initialStudioConfig)
      expect(result.current.productImage).toEqual(initialAsset)
      expect(result.current.logoImage).toEqual(initialAsset)
      expect(result.current.validationErrors).toEqual({})
    })

    it("respects custom initial state when provided", () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 2,
          config: {
            ...initialStudioConfig,
            productName: "Initial Product"
          }
        })
      )

      expect(result.current.currentStep).toBe(2)
      expect(result.current.config.productName).toBe("Initial Product")
    })
  })

  describe("Configuration Field Updates", () => {
    it("updates field values cleanly via handleConfigChange", () => {
      const { result } = renderHook(() => useAdStudio())

      act(() => {
        result.current.handleConfigChange("productName", "Ultra Headphone")
        result.current.handleConfigChange("format", "portrait")
        result.current.handleConfigChange("platform", "linkedin")
        result.current.handleConfigChange("tone", "luxurious")
        result.current.handleConfigChange("price", "$299")
        result.current.handleConfigChange("offer", "15% OFF")
        result.current.handleConfigChange("callToAction", "Order Now")
        result.current.handleConfigChange("brandName", "AuraSound")
      })

      expect(result.current.config.productName).toBe("Ultra Headphone")
      expect(result.current.config.format).toBe("portrait")
      expect(result.current.config.platform).toBe("linkedin")
      expect(result.current.config.tone).toBe("luxurious")
      expect(result.current.config.price).toBe("$299")
      expect(result.current.config.offer).toBe("15% OFF")
      expect(result.current.config.callToAction).toBe("Order Now")
      expect(result.current.config.brandName).toBe("AuraSound")
    })

    it("clears validation error for a field when user modifies that field", () => {
      const { result } = renderHook(() => useAdStudio())

      // Trigger validation to generate errors
      act(() => {
        result.current.validateStep1()
      })
      expect(result.current.validationErrors.productName).toBeDefined()

      // Modify the field
      act(() => {
        result.current.handleConfigChange("productName", "Valid Product Name")
      })
      expect(result.current.validationErrors.productName).toBeUndefined()
    })
  })

  describe("Step 1 Validation Rules (validateConfigStep1)", () => {
    it("fails when productName is empty or only whitespace", () => {
      const res1 = validateConfigStep1({ ...initialStudioConfig, productName: "" })
      expect(res1.valid).toBe(false)
      expect(res1.errors.productName).toBe("Product name is required")

      const res2 = validateConfigStep1({ ...initialStudioConfig, productName: "   " })
      expect(res2.valid).toBe(false)
      expect(res2.errors.productName).toBe("Product name is required")
    })

    it("fails when productName exceeds 120 characters", () => {
      const longName = "A".repeat(121)
      const res = validateConfigStep1({ ...initialStudioConfig, productName: longName })
      expect(res.valid).toBe(false)
      expect(res.errors.productName).toBe("Product name cannot exceed 120 characters")
    })

    it("fails when productDescription is empty or < 5 characters", () => {
      const res1 = validateConfigStep1({
        ...initialStudioConfig,
        productName: "Headphones",
        productDescription: ""
      })
      expect(res1.valid).toBe(false)
      expect(res1.errors.productDescription).toBe("Product description is required")

      const res2 = validateConfigStep1({
        ...initialStudioConfig,
        productName: "Headphones",
        productDescription: "Good"
      })
      expect(res2.valid).toBe(false)
      expect(res2.errors.productDescription).toBe("Product description must be at least 5 characters")
    })

    it("fails when productDescription exceeds 2000 characters", () => {
      const longDesc = "B".repeat(2001)
      const res = validateConfigStep1({
        ...initialStudioConfig,
        productName: "Headphones",
        productDescription: longDesc
      })
      expect(res.valid).toBe(false)
      expect(res.errors.productDescription).toBe("Product description cannot exceed 2000 characters")
    })

    it("validates optional fields string lengths", () => {
      const res = validateConfigStep1({
        ...initialStudioConfig,
        productName: "Headphones",
        productDescription: "Valid product description text",
        targetAudience: "A".repeat(301),
        price: "A".repeat(51),
        offer: "A".repeat(101),
        campaignObjective: "A".repeat(81),
        callToAction: "A".repeat(61),
        brandName: "A".repeat(101)
      })

      expect(res.valid).toBe(false)
      expect(res.errors.targetAudience).toBe("Target audience cannot exceed 300 characters")
      expect(res.errors.price).toBe("Price cannot exceed 50 characters")
      expect(res.errors.offer).toBe("Offer cannot exceed 100 characters")
      expect(res.errors.campaignObjective).toBe("Campaign objective cannot exceed 80 characters")
      expect(res.errors.callToAction).toBe("Call to action cannot exceed 60 characters")
      expect(res.errors.brandName).toBe("Brand name cannot exceed 100 characters")
    })

    it("validates productFeatures correctly (max 10 items, max 200 chars each)", () => {
      // Exceeding 10 features fails
      const tooManyFeatures = Array.from({ length: 11 }, (_, i) => `Feature ${i + 1}`)
      const res1 = validateConfigStep1({
        ...initialStudioConfig,
        productName: "Headphones",
        productDescription: "Valid description text",
        productFeatures: tooManyFeatures
      })
      expect(res1.valid).toBe(false)
      expect(res1.errors.productFeatures).toBe("Maximum 10 product features allowed")

      // Exceeding 200 characters in any feature fails
      const longFeature = "F".repeat(201)
      const res2 = validateConfigStep1({
        ...initialStudioConfig,
        productName: "Headphones",
        productDescription: "Valid description text",
        productFeatures: ["Valid feature 1", longFeature]
      })
      expect(res2.valid).toBe(false)
      expect(res2.errors.productFeatures).toBe("Product features cannot exceed 200 characters each")

      // Valid features pass
      const res3 = validateConfigStep1({
        ...initialStudioConfig,
        productName: "Headphones",
        productDescription: "Valid description text",
        productFeatures: ["Active Noise Cancellation", "40-hour Battery Life", "Bluetooth 5.3"]
      })
      expect(res3.valid).toBe(true)
      expect(res3.errors.productFeatures).toBeUndefined()
    })

    it("succeeds when required fields are valid and optional fields are within limits", () => {
      const res = validateConfigStep1({
        ...initialStudioConfig,
        productName: "Aura Noise-Cancelling Headphones",
        productDescription: "Studio-grade wireless headphones with 40-hour battery life and adaptive ANC.",
        price: "$199",
        offer: "20% OFF",
        callToAction: "Shop Now",
        brandName: "Aura Audio",
        platform: "instagram",
        tone: "professional",
        format: "square"
      })

      expect(res.valid).toBe(true)
      expect(Object.keys(res.errors)).toHaveLength(0)
    })
  })

  describe("Stepper Navigation", () => {
    it("blocks advancing from Step 1 when inputs are invalid", () => {
      const { result } = renderHook(() => useAdStudio())

      let advanced = false
      act(() => {
        advanced = result.current.handleNextStep()
      })

      expect(advanced).toBe(false)
      expect(result.current.currentStep).toBe(1)
      expect(result.current.validationErrors.productName).toBeDefined()
      expect(result.current.validationErrors.productDescription).toBeDefined()
    })

    it("allows advancing to Step 2 when Step 1 is valid", () => {
      const { result } = renderHook(() => useAdStudio())

      act(() => {
        result.current.handleConfigChange("productName", "Valid Product Name")
        result.current.handleConfigChange("productDescription", "High quality valid description of product")
      })

      let advanced = false
      act(() => {
        advanced = result.current.handleNextStep()
      })

      expect(advanced).toBe(true)
      expect(result.current.currentStep).toBe(2)
      expect(result.current.validationErrors).toEqual({})
    })

    it("navigates backward via handlePrevStep", () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 2,
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "Valid description for the product"
          }
        })
      )

      act(() => {
        result.current.handlePrevStep()
      })

      expect(result.current.currentStep).toBe(1)

      // Will not go below step 1
      act(() => {
        result.current.handlePrevStep()
      })
      expect(result.current.currentStep).toBe(1)
    })

    it("goToStep permits jumping to step 1 anytime and higher steps if valid", () => {
      const { result } = renderHook(() => useAdStudio())

      // Fails when invalid
      let allowed = false
      act(() => {
        allowed = result.current.goToStep(2)
      })
      expect(allowed).toBe(false)
      expect(result.current.currentStep).toBe(1)

      // Populate valid fields
      act(() => {
        result.current.handleConfigChange("productName", "Awesome Product")
        result.current.handleConfigChange("productDescription", "Comprehensive product description text")
      })

      // Allowed to go to step 2 when step 1 is valid
      act(() => {
        allowed = result.current.goToStep(2)
      })
      expect(allowed).toBe(true)
      expect(result.current.currentStep).toBe(2)

      // Step 3 requires valid copy to be generated
      act(() => {
        allowed = result.current.goToStep(3)
      })
      expect(allowed).toBe(false)
      expect(result.current.currentStep).toBe(2)

      // Jump back to step 1
      act(() => {
        result.current.goToStep(1)
      })
      expect(result.current.currentStep).toBe(1)
    })
  })

  describe("File Validation & Uploading", () => {
    it("validateImageFile rejects unsupported MIME types", () => {
      const badFiles = [
        new File(["dummy"], "file.gif", { type: "image/gif" }),
        new File(["dummy"], "file.pdf", { type: "application/pdf" }),
        new File(["dummy"], "file.txt", { type: "text/plain" }),
        new File(["dummy"], "file.svg", { type: "image/svg+xml" })
      ]

      for (const file of badFiles) {
        const res = validateImageFile(file)
        expect(res.valid).toBe(false)
        expect(res.error).toContain("Unsupported image format")
      }
    })

    it("validateImageFile rejects files exceeding 10MB limit", () => {
      const oversizedFile = new File(["data"], "large.png", { type: "image/png" })
      Object.defineProperty(oversizedFile, "size", {
        value: MAX_FILE_SIZE_BYTES + 1
      })

      const res = validateImageFile(oversizedFile)
      expect(res.valid).toBe(false)
      expect(res.error).toContain("File size exceeds the 10MB limit")
    })

    it("validateImageFile accepts valid PNG, JPEG, and WebP files <= 10MB", () => {
      for (const mimeType of ALLOWED_IMAGE_TYPES) {
        const validFile = new File(["valid content"], "test-image", { type: mimeType })
        Object.defineProperty(validFile, "size", { value: 1024 * 500 }) // 500 KB
        const res = validateImageFile(validFile)
        expect(res.valid).toBe(true)
        expect(res.error).toBeUndefined()
      }
    })

    it("handleProductImageSelect processes valid image and updates state", async () => {
      const { result } = renderHook(() => useAdStudio())

      const validFile = new File(["image-bytes"], "product.png", { type: "image/png" })
      Object.defineProperty(validFile, "size", { value: 2048 })

      let success = false
      await act(async () => {
        success = await result.current.handleProductImageSelect(validFile)
      })

      expect(success).toBe(true)
      expect(result.current.productImage.file).toBe(validFile)
      expect(result.current.productImage.name).toBe("product.png")
      expect(result.current.productImage.size).toBe(2048)
      expect(result.current.productImage.dataUrl).toContain("data:image/png;base64,")
      expect(result.current.validationErrors.productImage).toBeUndefined()
    })

    it("handleProductImageSelect sets error when file is invalid", async () => {
      const { result } = renderHook(() => useAdStudio())

      const badFile = new File(["bytes"], "doc.pdf", { type: "application/pdf" })

      let success = true
      await act(async () => {
        success = await result.current.handleProductImageSelect(badFile)
      })

      expect(success).toBe(false)
      expect(result.current.productImage.file).toBeNull()
      expect(result.current.validationErrors.productImage).toContain("Unsupported image format")
    })

    it("handleProductImageRemove cleans up product image state", async () => {
      const { result } = renderHook(() => useAdStudio())

      const validFile = new File(["image-bytes"], "product.jpg", { type: "image/jpeg" })
      await act(async () => {
        await result.current.handleProductImageSelect(validFile)
      })

      expect(result.current.productImage.file).not.toBeNull()

      act(() => {
        result.current.handleProductImageRemove()
      })

      expect(result.current.productImage).toEqual(initialAsset)
      expect(result.current.validationErrors.productImage).toBeUndefined()
    })

    it("handleLogoImageSelect and handleLogoImageRemove manage logo asset symmetrically", async () => {
      const { result } = renderHook(() => useAdStudio())

      const validLogo = new File(["logo-bytes"], "logo.webp", { type: "image/webp" })
      Object.defineProperty(validLogo, "size", { value: 1024 })

      let success = false
      await act(async () => {
        success = await result.current.handleLogoImageSelect(validLogo)
      })

      expect(success).toBe(true)
      expect(result.current.logoImage.file).toBe(validLogo)
      expect(result.current.logoImage.name).toBe("logo.webp")
      expect(result.current.logoImage.dataUrl).toContain("data:image/webp;base64,")

      act(() => {
        result.current.handleLogoImageRemove()
      })

      expect(result.current.logoImage).toEqual(initialAsset)
    })

    it("prevents out-of-order FileReader results from overwriting newer product image selection (Fix A4.1-002)", async () => {
      const { result } = renderHook(() => useAdStudio())

      const file1 = new File(["file-1"], "first.png", { type: "image/png" })
      const file2 = new File(["file-2"], "second.png", { type: "image/png" })

      let triggerFirstResolve: (() => void) | null = null
      let triggerSecondResolve: (() => void) | null = null

      let callCount = 0
      class ControlledFileReader {
        result: string | null = null
        onload: (() => void) | null = null
        readAsDataURL(blob: Blob) {
          callCount++
          const currentCall = callCount
          this.result = `data:${blob.type};base64,data-for-call-${currentCall}`
          if (currentCall === 1) {
            triggerFirstResolve = () => {
              if (this.onload) this.onload()
            }
          } else {
            triggerSecondResolve = () => {
              if (this.onload) this.onload()
            }
          }
        }
      }
      global.FileReader = ControlledFileReader as any

      // Initiate first read (slow)
      let p1: Promise<boolean>
      act(() => {
        p1 = result.current.handleProductImageSelect(file1)
      })

      // Initiate second read (fast)
      let p2: Promise<boolean>
      act(() => {
        p2 = result.current.handleProductImageSelect(file2)
      })

      // Resolve second read first
      await act(async () => {
        if (triggerSecondResolve) triggerSecondResolve()
        await p2
      })

      expect(result.current.productImage.name).toBe("second.png")

      // Now resolve the older first read
      await act(async () => {
        if (triggerFirstResolve) triggerFirstResolve()
        await p1
      })

      // State MUST NOT be overwritten by the stale first read
      expect(result.current.productImage.name).toBe("second.png")
      expect(result.current.productImage.file).toBe(file2)
    })

    it("prevents out-of-order FileReader results from overwriting newer logo selection (Fix A4.1-002)", async () => {
      const { result } = renderHook(() => useAdStudio())

      const logo1 = new File(["logo-1"], "first-logo.png", { type: "image/png" })
      const logo2 = new File(["logo-2"], "second-logo.png", { type: "image/png" })

      let triggerFirstResolve: (() => void) | null = null
      let triggerSecondResolve: (() => void) | null = null

      let callCount = 0
      class ControlledFileReader {
        result: string | null = null
        onload: (() => void) | null = null
        readAsDataURL(blob: Blob) {
          callCount++
          const currentCall = callCount
          this.result = `data:${blob.type};base64,logo-data-${currentCall}`
          if (currentCall === 1) {
            triggerFirstResolve = () => {
              if (this.onload) this.onload()
            }
          } else {
            triggerSecondResolve = () => {
              if (this.onload) this.onload()
            }
          }
        }
      }
      global.FileReader = ControlledFileReader as any

      let p1: Promise<boolean>
      act(() => {
        p1 = result.current.handleLogoImageSelect(logo1)
      })

      let p2: Promise<boolean>
      act(() => {
        p2 = result.current.handleLogoImageSelect(logo2)
      })

      await act(async () => {
        if (triggerSecondResolve) triggerSecondResolve()
        await p2
      })

      expect(result.current.logoImage.name).toBe("second-logo.png")

      await act(async () => {
        if (triggerFirstResolve) triggerFirstResolve()
        await p1
      })

      expect(result.current.logoImage.name).toBe("second-logo.png")
      expect(result.current.logoImage.file).toBe(logo2)
    })

    it("invalidates pending file read when handleProductImageRemove is called (Fix A4.1-002)", async () => {
      const { result } = renderHook(() => useAdStudio())

      const file1 = new File(["file-1"], "product.png", { type: "image/png" })
      let triggerResolve: (() => void) | null = null

      class ControlledFileReader {
        result: string | null = null
        onload: (() => void) | null = null
        readAsDataURL(blob: Blob) {
          this.result = `data:${blob.type};base64,data`
          triggerResolve = () => {
            if (this.onload) this.onload()
          }
        }
      }
      global.FileReader = ControlledFileReader as any

      let p1: Promise<boolean>
      act(() => {
        p1 = result.current.handleProductImageSelect(file1)
      })

      // User clicks remove while reading
      act(() => {
        result.current.handleProductImageRemove()
      })

      // Resolve in-flight read
      await act(async () => {
        if (triggerResolve) triggerResolve()
        await p1
      })

      expect(result.current.productImage).toEqual(initialAsset)
    })

    it("invalidates pending file reads when reset is called (Fix A4.1-002)", async () => {
      const { result } = renderHook(() => useAdStudio())

      const file1 = new File(["file-1"], "product.png", { type: "image/png" })
      let triggerResolve: (() => void) | null = null

      class ControlledFileReader {
        result: string | null = null
        onload: (() => void) | null = null
        readAsDataURL(blob: Blob) {
          this.result = `data:${blob.type};base64,data`
          triggerResolve = () => {
            if (this.onload) this.onload()
          }
        }
      }
      global.FileReader = ControlledFileReader as any

      let p1: Promise<boolean>
      act(() => {
        p1 = result.current.handleProductImageSelect(file1)
      })

      // User calls reset
      act(() => {
        result.current.reset()
      })

      await act(async () => {
        if (triggerResolve) triggerResolve()
        await p1
      })

      expect(result.current.productImage).toEqual(initialAsset)
    })
  })

  describe("Dropzone Event Propagation (Fix A4.1-001)", () => {
    it("calls e.stopPropagation() and e.preventDefault() on product drop", async () => {
      const onProductImageSelect = jest.fn().mockResolvedValue(true)
      const { container } = render(
        React.createElement(AdStudioConfigStep, {
          config: initialStudioConfig,
          productImage: initialAsset,
          logoImage: initialAsset,
          validationErrors: {},
          onConfigChange: jest.fn(),
          onProductImageSelect,
          onProductImageRemove: jest.fn(),
          onLogoImageSelect: jest.fn(),
          onLogoImageRemove: jest.fn(),
          onContinue: jest.fn()
        })
      )

      const dropzones = container.querySelectorAll('[class*="border-dashed"]')
      expect(dropzones.length).toBeGreaterThanOrEqual(1)
      const productDropzone = dropzones[0]

      const file = new File(["test"], "test.png", { type: "image/png" })
      const dropEvent = createEvent.drop(productDropzone, {
        dataTransfer: { files: [file] }
      })
      const preventDefaultSpy = jest.spyOn(dropEvent, "preventDefault")
      const stopPropagationSpy = jest.spyOn(dropEvent, "stopPropagation")

      fireEvent(productDropzone, dropEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(stopPropagationSpy).toHaveBeenCalled()
      expect(onProductImageSelect).toHaveBeenCalledWith(file)
    })

    it("calls e.stopPropagation() and e.preventDefault() on dragOver and dragLeave", () => {
      const { container } = render(
        React.createElement(AdStudioConfigStep, {
          config: initialStudioConfig,
          productImage: initialAsset,
          logoImage: initialAsset,
          validationErrors: {},
          onConfigChange: jest.fn(),
          onProductImageSelect: jest.fn(),
          onProductImageRemove: jest.fn(),
          onLogoImageSelect: jest.fn(),
          onLogoImageRemove: jest.fn(),
          onContinue: jest.fn()
        })
      )

      const dropzones = container.querySelectorAll('[class*="border-dashed"]')
      const productDropzone = dropzones[0]

      const dragOverEvent = createEvent.dragOver(productDropzone)
      const preventDefaultOver = jest.spyOn(dragOverEvent, "preventDefault")
      const stopPropagationOver = jest.spyOn(dragOverEvent, "stopPropagation")
      fireEvent(productDropzone, dragOverEvent)

      expect(preventDefaultOver).toHaveBeenCalled()
      expect(stopPropagationOver).toHaveBeenCalled()

      const dragLeaveEvent = createEvent.dragLeave(productDropzone)
      const preventDefaultLeave = jest.spyOn(dragLeaveEvent, "preventDefault")
      const stopPropagationLeave = jest.spyOn(dragLeaveEvent, "stopPropagation")
      fireEvent(productDropzone, dragLeaveEvent)

      expect(preventDefaultLeave).toHaveBeenCalled()
      expect(stopPropagationLeave).toHaveBeenCalled()
    })
  })

  describe("Product Features UI & Deduplication (AdStudioConfigStep)", () => {
    it("rejects empty, duplicate (case-insensitive) features and preserves existing features", () => {
      const onConfigChange = jest.fn()
      const existingFeatures = ["Active Noise Cancellation", "40-hour Battery"]

      const { container, getByText } = render(
        React.createElement(AdStudioConfigStep, {
          config: {
            ...initialStudioConfig,
            productFeatures: existingFeatures
          },
          productImage: initialAsset,
          logoImage: initialAsset,
          validationErrors: {},
          onConfigChange,
          onProductImageSelect: jest.fn(),
          onProductImageRemove: jest.fn(),
          onLogoImageSelect: jest.fn(),
          onLogoImageRemove: jest.fn(),
          onContinue: jest.fn()
        })
      )

      // Open Commercial Details & Campaign Settings accordion
      fireEvent.click(getByText("Commercial Details & Campaign Settings"))

      const featureInput = container.querySelector("#featureInput") as HTMLInputElement
      expect(featureInput).toBeTruthy()

      // 1. Trying to add empty or whitespace-only feature
      fireEvent.change(featureInput, { target: { value: "   " } })
      fireEvent.keyDown(featureInput, { key: "Enter" })
      expect(onConfigChange).not.toHaveBeenCalled()

      // 2. Trying to add exact duplicate feature
      fireEvent.change(featureInput, { target: { value: "Active Noise Cancellation" } })
      fireEvent.keyDown(featureInput, { key: "Enter" })
      expect(onConfigChange).not.toHaveBeenCalled()

      // 3. Trying to add case-insensitive duplicate feature
      fireEvent.change(featureInput, { target: { value: "  active noise cancellation  " } })
      fireEvent.keyDown(featureInput, { key: "Enter" })
      expect(onConfigChange).not.toHaveBeenCalled()

      // 4. Adding a valid new feature
      fireEvent.change(featureInput, { target: { value: "  Bluetooth 5.3  " } })
      fireEvent.keyDown(featureInput, { key: "Enter" })
      expect(onConfigChange).toHaveBeenCalledWith("productFeatures", [
        ...existingFeatures,
        "Bluetooth 5.3"
      ])
    })

    it("disables feature addition when 10 features constraint is reached", () => {
      const tenFeatures = Array.from({ length: 10 }, (_, i) => `Feature ${i + 1}`)
      const { container, getByText } = render(
        React.createElement(AdStudioConfigStep, {
          config: {
            ...initialStudioConfig,
            productFeatures: tenFeatures
          },
          productImage: initialAsset,
          logoImage: initialAsset,
          validationErrors: {},
          onConfigChange: jest.fn(),
          onProductImageSelect: jest.fn(),
          onProductImageRemove: jest.fn(),
          onLogoImageSelect: jest.fn(),
          onLogoImageRemove: jest.fn(),
          onContinue: jest.fn()
        })
      )
      fireEvent.click(getByText("Commercial Details & Campaign Settings"))
      const input = container.querySelector("#featureInput") as HTMLInputElement
      expect(input.disabled).toBe(true)
    })
  })

  describe("Reset Handler", () => {
    it("resets all state back to initial defaults", async () => {
      const { result } = renderHook(() => useAdStudio())

      act(() => {
        result.current.handleConfigChange("productName", "Modified Product")
        result.current.handleConfigChange("format", "landscape")
      })

      const file = new File(["content"], "img.png", { type: "image/png" })
      await act(async () => {
        await result.current.handleProductImageSelect(file)
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.currentStep).toBe(1)
      expect(result.current.config).toEqual(initialStudioConfig)
      expect(result.current.productImage).toEqual(initialAsset)
      expect(result.current.logoImage).toEqual(initialAsset)
      expect(result.current.validationErrors).toEqual({})
      expect(result.current.generatedCopy).toBeNull()
      expect(result.current.editableCopy).toEqual(initialEditableCopy)
      expect(result.current.isGeneratingCopy).toBe(false)
      expect(result.current.copyGenerationError).toBeNull()
      expect(result.current.isCopyStale).toBe(false)
    })
  })

  describe("Step 2 Validation Rules (validateConfigStep2)", () => {
    const validCopy = {
      headline: "Experience Studio Sound Anywhere",
      primaryText: "Immerse yourself in acoustic precision with active noise cancellation and 40-hour battery life.",
      description: "Crafted for audiophiles who demand flawless acoustic fidelity and lasting comfort.",
      callToAction: "Shop Now",
      backgroundPrompt: "Commercial studio product photography, clean minimalist pedestal with soft gradient lighting"
    }

    it("succeeds when all copy fields are valid", () => {
      const res = validateConfigStep2(validCopy)
      expect(res.valid).toBe(true)
      expect(Object.keys(res.errors)).toHaveLength(0)
    })

    it("fails when headline is missing, too short (<3) or too long (>150)", () => {
      expect(validateConfigStep2({ ...validCopy, headline: "" }).valid).toBe(false)
      expect(validateConfigStep2({ ...validCopy, headline: "Hi" }).valid).toBe(false)
      expect(validateConfigStep2({ ...validCopy, headline: "A".repeat(151) }).valid).toBe(false)
    })

    it("fails when primaryText is missing, too short (<10) or too long (>600)", () => {
      expect(validateConfigStep2({ ...validCopy, primaryText: "" }).valid).toBe(false)
      expect(validateConfigStep2({ ...validCopy, primaryText: "Short" }).valid).toBe(false)
      expect(validateConfigStep2({ ...validCopy, primaryText: "A".repeat(601) }).valid).toBe(false)
    })

    it("fails when description is missing, too short (<5) or too long (>350)", () => {
      expect(validateConfigStep2({ ...validCopy, description: "" }).valid).toBe(false)
      expect(validateConfigStep2({ ...validCopy, description: "Desc" }).valid).toBe(false)
      expect(validateConfigStep2({ ...validCopy, description: "A".repeat(351) }).valid).toBe(false)
    })

    it("fails when callToAction is missing, too short (<2) or too long (>60)", () => {
      expect(validateConfigStep2({ ...validCopy, callToAction: "" }).valid).toBe(false)
      expect(validateConfigStep2({ ...validCopy, callToAction: "A" }).valid).toBe(false)
      expect(validateConfigStep2({ ...validCopy, callToAction: "A".repeat(61) }).valid).toBe(false)
    })

    it("fails when backgroundPrompt is missing, too short (<10) or too long (>700)", () => {
      expect(validateConfigStep2({ ...validCopy, backgroundPrompt: "" }).valid).toBe(false)
      expect(validateConfigStep2({ ...validCopy, backgroundPrompt: "Studio" }).valid).toBe(false)
      expect(validateConfigStep2({ ...validCopy, backgroundPrompt: "A".repeat(701) }).valid).toBe(false)
    })
  })

  describe("Step 2 Copy Generation & API Call (handleGenerateCopy)", () => {
    const originalFetch = global.fetch
    const mockCopy: GeneratedAdCopy = {
      headline: "Experience Studio Sound Anywhere",
      primaryText: "Immerse yourself in acoustic precision with active noise cancellation and 40-hour battery life.",
      description: "Crafted for audiophiles who demand flawless acoustic fidelity and lasting comfort.",
      callToAction: "Shop Now",
      visualDirection: "Sleek matte black headphones floating on clean minimalist acoustic wave pedestal",
      backgroundPrompt: "Commercial studio product photography, clean minimalist pedestal with soft gradient lighting",
      suggestedLayout: {
        productPlacement: "center",
        textPlacement: "center",
        colorPaletteSuggestion: ["#0F172A", "#38BDF8"]
      },
      headlineAlternatives: ["Hear the Difference with Studio Sound", "Pure Audio Fidelity. Zero Distractions."],
      copyAlternatives: ["Uncompromising sound performance meets 40-hour wireless convenience."]
    }

    afterEach(() => {
      global.fetch = originalFetch
    })

    it("aborts early if Step 1 is invalid", async () => {
      const { result } = renderHook(() => useAdStudio())
      const fetchSpy = jest.fn()
      global.fetch = fetchSpy as any

      let success = true
      await act(async () => {
        success = await result.current.handleGenerateCopy("ws-123")
      })

      expect(success).toBe(false)
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(result.current.validationErrors.productName).toBeDefined()
    })

    it("successfully calls /api/adcraft/generate-copy and populates editable copy", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          config: {
            ...initialStudioConfig,
            productName: "Aura Noise-Cancelling Headphones",
            productDescription: "Studio-grade wireless headphones with adaptive ANC.",
            productFeatures: ["Active ANC", "40h battery"],
            platform: "instagram",
            tone: "professional",
            format: "square"
          }
        })
      )

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            copy: mockCopy,
            platform: "instagram",
            format: { name: "square", label: "Square", width: 1080, height: 1080, aspectRatio: "1:1" },
            metadata: { model: "gemini-1.5-pro", generatedAt: "2026-11-25T12:00:00Z", productName: "Aura" }
          }
        })
      }) as any

      let success = false
      await act(async () => {
        success = await result.current.handleGenerateCopy("ws-123")
      })

      expect(success).toBe(true)
      expect(result.current.currentStep).toBe(2)
      expect(result.current.generatedCopy).toEqual(mockCopy)
      expect(result.current.editableCopy.headline).toBe(mockCopy.headline)
      expect(result.current.editableCopy.primaryText).toBe(mockCopy.primaryText)
      expect(result.current.editableCopy.description).toBe(mockCopy.description)
      expect(result.current.editableCopy.callToAction).toBe(mockCopy.callToAction)
      expect(result.current.editableCopy.backgroundPrompt).toBe(mockCopy.backgroundPrompt)
      expect(result.current.isGeneratingCopy).toBe(false)
      expect(result.current.copyGenerationError).toBeNull()
      expect(result.current.isCopyStale).toBe(false)

      // Verify payload sent
      expect(global.fetch).toHaveBeenCalledWith("/api/adcraft/generate-copy", expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"productName":"Aura Noise-Cancelling Headphones"')
      }))
    })

    it("handles API error response prioritizing data.message", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "High-end wireless headphones with active ANC."
          }
        })
      )

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          code: "VALIDATION_FAILED",
          message: "Product name cannot exceed 120 characters"
        })
      }) as any

      let success = true
      await act(async () => {
        success = await result.current.handleGenerateCopy("ws-123")
      })

      expect(success).toBe(false)
      expect(result.current.copyGenerationError).toBe("Product name cannot exceed 120 characters")
      expect(result.current.isGeneratingCopy).toBe(false)
      expect(result.current.generatedCopy).toBeNull()
    })

    it("handles backward-compatible data.error fallback when data.message is absent", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "High-end wireless headphones with active ANC."
          }
        })
      )

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: "Legacy backend error format"
        })
      }) as any

      let success = true
      await act(async () => {
        success = await result.current.handleGenerateCopy("ws-123")
      })

      expect(success).toBe(false)
      expect(result.current.copyGenerationError).toBe("Legacy backend error format")
      expect(result.current.isGeneratingCopy).toBe(false)
    })

    it("handles generic status fallback when response has no usable message or error field", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "High-end wireless headphones with active ANC."
          }
        })
      )

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({})
      }) as any

      let success = true
      await act(async () => {
        success = await result.current.handleGenerateCopy("ws-123")
      })

      expect(success).toBe(false)
      expect(result.current.copyGenerationError).toBe("Copy generation failed (502)")
      expect(result.current.isGeneratingCopy).toBe(false)
    })

    it("handles malformed non-JSON error response gracefully without crashing", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "High-end wireless headphones with active ANC."
          }
        })
      )

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 504,
        json: async () => {
          throw new Error("Unexpected token < in JSON at position 0")
        }
      }) as any

      let success = true
      await act(async () => {
        success = await result.current.handleGenerateCopy("ws-123")
      })

      expect(success).toBe(false)
      expect(result.current.copyGenerationError).toBe("Copy generation failed (504)")
      expect(result.current.isGeneratingCopy).toBe(false)
    })

    it("handles network failure exception cleanly and resets guard", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          config: {
            ...initialStudioConfig,
            productName: "Headphones",
            productDescription: "High-end wireless headphones with active ANC."
          }
        })
      )

      global.fetch = jest.fn().mockRejectedValue(new Error("Network connection dropped")) as any

      let success = true
      await act(async () => {
        success = await result.current.handleGenerateCopy("ws-123")
      })

      expect(success).toBe(false)
      expect(result.current.copyGenerationError).toBe("Network connection dropped")
      expect(result.current.isGeneratingCopy).toBe(false)

      // Verify guard was reset: subsequent call can execute
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            copy: mockCopy,
            platform: "instagram",
            format: { name: "square", label: "Square", width: 1080, height: 1080, aspectRatio: "1:1" },
            metadata: { model: "gemini-1.5-pro", generatedAt: "2026-11-25T12:00:00Z", productName: "Aura" }
          }
        })
      }) as any

      await act(async () => {
        success = await result.current.handleGenerateCopy("ws-123")
      })
      expect(success).toBe(true)
      expect(result.current.isGeneratingCopy).toBe(false)
    })

    it("prevents duplicate concurrent API requests while generation is in progress", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          config: {
            ...initialStudioConfig,
            productName: "Aura Noise-Cancelling Headphones",
            productDescription: "Studio-grade wireless headphones with adaptive ANC."
          }
        })
      )

      let resolveFetch: any
      const controlledPromise = new Promise(resolve => {
        resolveFetch = resolve
      })
      const fetchSpy = jest.fn().mockReturnValue(controlledPromise)
      global.fetch = fetchSpy as any

      let p1: Promise<boolean> | null = null
      let p2: Promise<boolean> | null = null

      act(() => {
        p1 = result.current.handleGenerateCopy("ws-123")
        // Second call while p1 is active
        p2 = result.current.handleGenerateCopy("ws-123")
      })

      // The second call must immediately return false without dispatching a second fetch
      const res2 = await p2!
      expect(res2).toBe(false)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(result.current.isGeneratingCopy).toBe(true)

      // Resolve the first call
      await act(async () => {
        resolveFetch({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              copy: mockCopy,
              platform: "instagram",
              format: { name: "square", label: "Square", width: 1080, height: 1080, aspectRatio: "1:1" },
              metadata: { model: "gemini-1.5-pro", generatedAt: "2026-11-25T12:00:00Z", productName: "Aura" }
            }
          })
        })
        await p1
      })

      expect(result.current.isGeneratingCopy).toBe(false)
      expect(result.current.currentStep).toBe(2)

      // Guard is reset after completion: subsequent call can execute
      act(() => {
        result.current.handleGenerateCopy("ws-123")
      })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it("prevents superseded requests from committing stale data to state", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          config: {
            ...initialStudioConfig,
            productName: "Aura Headphones",
            productDescription: "Studio-grade headphones description."
          }
        })
      )

      let resolveSlowFetch: any
      const slowPromise = new Promise(resolve => {
        resolveSlowFetch = resolve
      })
      global.fetch = jest.fn().mockReturnValueOnce(slowPromise)

      let p1: Promise<boolean> | null = null
      act(() => {
        p1 = result.current.handleGenerateCopy("ws-123")
      })
      expect(result.current.isGeneratingCopy).toBe(true)

      // User resets before slow request finishes
      act(() => {
        result.current.reset()
      })
      expect(result.current.currentStep).toBe(1)
      expect(result.current.generatedCopy).toBeNull()

      // Slow response resolves late
      await act(async () => {
        resolveSlowFetch({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { copy: mockCopy }
          })
        })
        await p1
      })

      // State remains reset; stale response did not overwrite
      expect(result.current.generatedCopy).toBeNull()
      expect(result.current.currentStep).toBe(1)
      expect(result.current.isGeneratingCopy).toBe(false)
    })

    it("ensures an invalidated Request A resolving does not clear Request B's loading state or in-flight lock", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          config: {
            ...initialStudioConfig,
            productName: "Aura Headphones",
            productDescription: "Studio-grade headphones description."
          }
        })
      )

      let resolveRequestA: ((value: any) => void) | undefined
      const promiseA = new Promise(resolve => {
        resolveRequestA = resolve
      })

      let resolveRequestB: ((value: any) => void) | undefined
      const promiseB = new Promise(resolve => {
        resolveRequestB = resolve
      })

      const fetchMock = jest
        .fn()
        .mockReturnValueOnce(promiseA) // Call 1 (Request A)
        .mockReturnValueOnce(promiseB) // Call 2 (Request B)
      global.fetch = fetchMock as any

      // 1. Request A starts and remains pending
      let pA: Promise<boolean> | null = null
      act(() => {
        pA = result.current.handleGenerateCopy("ws-123")
      })
      expect(result.current.isGeneratingCopy).toBe(true)

      // 2. Call reset() while Request A is pending
      act(() => {
        result.current.reset()
      })

      // 3. Confirm reset state and that generation loading has been released
      expect(result.current.isGeneratingCopy).toBe(false)
      expect(result.current.generatedCopy).toBeNull()
      expect(result.current.currentStep).toBe(1)

      // 4. Start Request B after the reset
      act(() => {
        result.current.handleConfigChange("productName", "Aura Headphones")
        result.current.handleConfigChange("productDescription", "Studio-grade headphones description.")
      })
      let pB: Promise<boolean> | null = null
      act(() => {
        pB = result.current.handleGenerateCopy("ws-123")
      })

      // 5. Confirm Request B starts successfully and loading becomes active
      expect(result.current.isGeneratingCopy).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // 6. Resolve Request A while Request B is still pending
      await act(async () => {
        resolveRequestA!({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              copy: { ...mockCopy, headline: "Stale Copy From Request A" },
              platform: "instagram",
              format: { name: "square", label: "Square", width: 1080, height: 1080, aspectRatio: "1:1" },
              metadata: { model: "gemini-1.5-pro", generatedAt: "2026-11-25T12:00:00Z", productName: "Aura" }
            }
          })
        })
        await pA
      })

      // 7. Verify Request A cannot:
      // - Clear Request B's loading state
      expect(result.current.isGeneratingCopy).toBe(true)
      // - Commit stale generated copy
      expect(result.current.generatedCopy).toBeNull()
      // - Modify Request B's editable copy
      expect(result.current.editableCopy).toEqual(initialEditableCopy)
      // - Change the active Studio step
      expect(result.current.currentStep).toBe(1)
      // - Set a stale generation error
      expect(result.current.copyGenerationError).toBeNull()

      // Verify in-flight lock: duplicate call while Request B is active is rejected
      let pDuplicate: Promise<boolean> | null = null
      act(() => {
        pDuplicate = result.current.handleGenerateCopy("ws-123")
      })
      let duplicateResult: boolean | undefined
      await act(async () => {
        duplicateResult = await pDuplicate!
      })
      expect(duplicateResult).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(2) // No third call dispatched

      // 8. Resolve Request B
      await act(async () => {
        resolveRequestB!({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              copy: { ...mockCopy, headline: "Fresh Copy From Request B" },
              platform: "instagram",
              format: { name: "square", label: "Square", width: 1080, height: 1080, aspectRatio: "1:1" },
              metadata: { model: "gemini-1.5-pro", generatedAt: "2026-11-25T12:00:00Z", productName: "Aura" }
            }
          })
        })
        await pB
      })

      // 9 & 10. Verify Request B completes successfully, commits its copy, and releases loading state
      expect(result.current.isGeneratingCopy).toBe(false)
      expect(result.current.currentStep).toBe(2)
      expect(result.current.generatedCopy?.headline).toBe("Fresh Copy From Request B")
      expect(result.current.editableCopy.headline).toBe("Fresh Copy From Request B")
      expect(result.current.copyGenerationError).toBeNull()
    })
  })

  describe("Step 2 Copy Field Editing & Alternatives Selection", () => {
    const mockCopy: GeneratedAdCopy = {
      headline: "Experience Studio Sound Anywhere",
      primaryText: "Immerse yourself in acoustic precision with active noise cancellation.",
      description: "Crafted for audiophiles who demand flawless acoustic fidelity.",
      callToAction: "Shop Now",
      visualDirection: "Sleek matte black headphones on minimalist pedestal",
      backgroundPrompt: "Commercial studio product photography, clean minimalist pedestal",
      suggestedLayout: { productPlacement: "center", textPlacement: "center" },
      headlineAlternatives: ["Hear the Difference with Studio Sound", "Pure Audio Fidelity. Zero Distractions."],
      copyAlternatives: ["Uncompromising sound performance meets wireless convenience."]
    }

    it("allows manual editing of individual copy fields via handleCopyFieldChange", () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 2,
          generatedCopy: mockCopy,
          editableCopy: {
            headline: mockCopy.headline,
            primaryText: mockCopy.primaryText,
            description: mockCopy.description,
            callToAction: mockCopy.callToAction,
            backgroundPrompt: mockCopy.backgroundPrompt
          }
        })
      )

      act(() => {
        result.current.handleCopyFieldChange("headline", "Custom Edited Headline")
        result.current.handleCopyFieldChange("callToAction", "Claim Your Deal")
        result.current.handleCopyFieldChange("backgroundPrompt", "Updated commercial background prompt")
      })

      expect(result.current.editableCopy.headline).toBe("Custom Edited Headline")
      expect(result.current.editableCopy.callToAction).toBe("Claim Your Deal")
      expect(result.current.editableCopy.backgroundPrompt).toBe("Updated commercial background prompt")
      // Unedited fields remain intact
      expect(result.current.editableCopy.primaryText).toBe(mockCopy.primaryText)
    })

    it("swaps alternative headline when selected via handleSelectHeadlineAlternative", () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 2,
          generatedCopy: mockCopy,
          editableCopy: {
            headline: mockCopy.headline,
            primaryText: mockCopy.primaryText,
            description: mockCopy.description,
            callToAction: mockCopy.callToAction,
            backgroundPrompt: mockCopy.backgroundPrompt
          }
        })
      )

      act(() => {
        result.current.handleSelectHeadlineAlternative(mockCopy.headlineAlternatives![0])
      })

      expect(result.current.editableCopy.headline).toBe("Hear the Difference with Studio Sound")
    })

    it("swaps alternative primary text when selected via handleSelectCopyAlternative", () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 2,
          generatedCopy: mockCopy,
          editableCopy: {
            headline: mockCopy.headline,
            primaryText: mockCopy.primaryText,
            description: mockCopy.description,
            callToAction: mockCopy.callToAction,
            backgroundPrompt: mockCopy.backgroundPrompt
          }
        })
      )

      act(() => {
        result.current.handleSelectCopyAlternative(mockCopy.copyAlternatives![0])
      })

      expect(result.current.editableCopy.primaryText).toBe(
        "Uncompromising sound performance meets wireless convenience."
      )
    })
  })

  describe("Stale Copy State Management", () => {
    const mockCopy: GeneratedAdCopy = {
      headline: "Experience Studio Sound Anywhere",
      primaryText: "Immerse yourself in acoustic precision with active noise cancellation.",
      description: "Crafted for audiophiles who demand flawless acoustic fidelity.",
      callToAction: "Shop Now",
      visualDirection: "Sleek matte black headphones on minimalist pedestal",
      backgroundPrompt: "Commercial studio product photography, clean minimalist pedestal",
      suggestedLayout: { productPlacement: "center", textPlacement: "center" }
    }

    it("does not flag copy as stale when no copy has been generated yet", () => {
      const { result } = renderHook(() => useAdStudio())

      act(() => {
        result.current.handleConfigChange("productName", "New Brand Product")
      })

      expect(result.current.isCopyStale).toBe(false)
    })

    it("flags copy as stale when a core configuration field is changed after generation", () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 1,
          config: {
            ...initialStudioConfig,
            productName: "Aura Noise-Cancelling Headphones",
            productDescription: "Studio-grade wireless headphones with adaptive ANC."
          },
          generatedCopy: mockCopy,
          editableCopy: {
            headline: mockCopy.headline,
            primaryText: mockCopy.primaryText,
            description: mockCopy.description,
            callToAction: mockCopy.callToAction,
            backgroundPrompt: mockCopy.backgroundPrompt
          },
          isCopyStale: false
        })
      )

      expect(result.current.isCopyStale).toBe(false)

      // Changing core config field marks stale
      act(() => {
        result.current.handleConfigChange("platform", "linkedin")
      })
      expect(result.current.isCopyStale).toBe(true)
    })

    it("verifies all CORE_CONFIG_FIELDS trigger stale flag when copy exists", () => {
      for (const field of CORE_CONFIG_FIELDS) {
        const { result } = renderHook(() =>
          useAdStudio({
            currentStep: 1,
            config: {
              ...initialStudioConfig,
              productName: "Initial Product",
              productDescription: "Initial description"
            },
            generatedCopy: mockCopy,
            editableCopy: {
              headline: mockCopy.headline,
              primaryText: mockCopy.primaryText,
              description: mockCopy.description,
              callToAction: mockCopy.callToAction,
              backgroundPrompt: mockCopy.backgroundPrompt
            },
            isCopyStale: false
          })
        )

        act(() => {
          result.current.handleConfigChange(field, field === "productFeatures" ? ["New Feature"] : "New Value" as any)
        })

        expect(result.current.isCopyStale).toBe(true)
      }
    })

    it("resets isCopyStale to false when copy is successfully regenerated", async () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 2,
          config: {
            ...initialStudioConfig,
            productName: "Initial Product",
            productDescription: "Initial description text"
          },
          generatedCopy: mockCopy,
          editableCopy: {
            headline: mockCopy.headline,
            primaryText: mockCopy.primaryText,
            description: mockCopy.description,
            callToAction: mockCopy.callToAction,
            backgroundPrompt: mockCopy.backgroundPrompt
          },
          isCopyStale: true
        })
      )

      expect(result.current.isCopyStale).toBe(true)

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            copy: {
              ...mockCopy,
              headline: "Regenerated Headline After Stale"
            },
            platform: "instagram",
            format: { name: "square", label: "Square", width: 1080, height: 1080, aspectRatio: "1:1" },
            metadata: { model: "gemini-1.5-pro", generatedAt: "2026-11-25T12:00:00Z", productName: "Product" }
          }
        })
      }) as any

      let success = false
      await act(async () => {
        success = await result.current.handleGenerateCopy("ws-123")
      })

      expect(success).toBe(true)
      expect(result.current.isCopyStale).toBe(false)
      expect(result.current.editableCopy.headline).toBe("Regenerated Headline After Stale")
    })
  })

  describe("Step 2 Stepper Navigation & Guarding", () => {
    const mockCopy: GeneratedAdCopy = {
      headline: "Experience Studio Sound Anywhere",
      primaryText: "Immerse yourself in acoustic precision with active noise cancellation.",
      description: "Crafted for audiophiles who demand flawless acoustic fidelity.",
      callToAction: "Shop Now",
      visualDirection: "Sleek matte black headphones on minimalist pedestal",
      backgroundPrompt: "Commercial studio product photography, clean minimalist pedestal",
      suggestedLayout: { productPlacement: "center", textPlacement: "center" }
    }

    it("blocks handleNextStep on Step 2 if copy has not been generated", () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 2,
          config: {
            ...initialStudioConfig,
            productName: "Valid Product",
            productDescription: "Valid description text"
          },
          generatedCopy: null
        })
      )

      let advanced = true
      act(() => {
        advanced = result.current.handleNextStep()
      })

      expect(advanced).toBe(false)
      expect(result.current.currentStep).toBe(2)
      expect(result.current.copyGenerationError).toContain("generate ad copy before proceeding")
    })

    it("blocks handleNextStep on Step 2 if editableCopy violates validation constraints", () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 2,
          config: {
            ...initialStudioConfig,
            productName: "Valid Product",
            productDescription: "Valid description text"
          },
          generatedCopy: mockCopy,
          editableCopy: {
            headline: "", // Invalid empty headline
            primaryText: mockCopy.primaryText,
            description: mockCopy.description,
            callToAction: mockCopy.callToAction,
            backgroundPrompt: mockCopy.backgroundPrompt
          }
        })
      )

      let advanced = true
      act(() => {
        advanced = result.current.handleNextStep()
      })

      expect(advanced).toBe(false)
      expect(result.current.currentStep).toBe(2)
      expect(result.current.copyGenerationError).toBe("Headline is required")
    })

    it("allows handleNextStep to Step 3 when generated copy is present and valid", () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 2,
          config: {
            ...initialStudioConfig,
            productName: "Valid Product",
            productDescription: "Valid description text"
          },
          generatedCopy: mockCopy,
          editableCopy: {
            headline: mockCopy.headline,
            primaryText: mockCopy.primaryText,
            description: mockCopy.description,
            callToAction: mockCopy.callToAction,
            backgroundPrompt: mockCopy.backgroundPrompt
          }
        })
      )

      let advanced = false
      act(() => {
        advanced = result.current.handleNextStep()
      })

      expect(advanced).toBe(true)
      expect(result.current.currentStep).toBe(3)
    })

    it("preserves generated copy and user edits when navigating backward to Step 1", () => {
      const { result } = renderHook(() =>
        useAdStudio({
          currentStep: 2,
          config: {
            ...initialStudioConfig,
            productName: "Aura Headphones",
            productDescription: "High-end wireless noise-cancelling headphones."
          },
          generatedCopy: mockCopy,
          editableCopy: {
            headline: "User Hand-Crafted Headline",
            primaryText: mockCopy.primaryText,
            description: mockCopy.description,
            callToAction: "Get Yours",
            backgroundPrompt: mockCopy.backgroundPrompt
          }
        })
      )

      act(() => {
        result.current.handlePrevStep()
      })

      expect(result.current.currentStep).toBe(1)
      expect(result.current.generatedCopy).toEqual(mockCopy)
      expect(result.current.editableCopy.headline).toBe("User Hand-Crafted Headline")
      expect(result.current.editableCopy.callToAction).toBe("Get Yours")
    })
  })

  describe("AdStudioCopyStep Component UI Integration", () => {
    const mockCopy: GeneratedAdCopy = {
      headline: "Experience Studio Sound Anywhere",
      primaryText: "Immerse yourself in acoustic precision with active noise cancellation and 40-hour battery life.",
      description: "Crafted for audiophiles who demand flawless acoustic fidelity and lasting comfort.",
      callToAction: "Shop Now",
      visualDirection: "Sleek matte black headphones floating on clean minimalist acoustic wave pedestal",
      backgroundPrompt: "Commercial studio product photography, clean minimalist pedestal with soft gradient lighting",
      suggestedLayout: {
        productPlacement: "center",
        textPlacement: "center",
        colorPaletteSuggestion: ["#0F172A", "#38BDF8"]
      },
      headlineAlternatives: ["Hear the Difference with Studio Sound", "Pure Audio Fidelity. Zero Distractions."],
      copyAlternatives: ["Uncompromising sound performance meets 40-hour wireless convenience."]
    }

    const defaultProps = {
      workspaceId: "ws-123",
      config: {
        ...initialStudioConfig,
        productName: "Aura Noise-Cancelling Headphones",
        productDescription: "Studio-grade wireless headphones with adaptive ANC.",
        platform: "instagram" as const,
        tone: "professional" as const,
        format: "square" as const
      },
      generatedCopy: null,
      editableCopy: initialEditableCopy,
      isGeneratingCopy: false,
      copyGenerationError: null,
      isCopyStale: false,
      onCopyFieldChange: jest.fn(),
      onSelectHeadlineAlternative: jest.fn(),
      onSelectCopyAlternative: jest.fn(),
      onGenerateCopy: jest.fn().mockResolvedValue(true),
      onPrevStep: jest.fn(),
      onNextStep: jest.fn()
    }

    it("renders 'Ready to Generate' state with parameter summary and trigger button", () => {
      const { getByText } = render(React.createElement(AdStudioCopyStep, defaultProps))

      expect(getByText("Generate AI Advertising Copy")).toBeTruthy()
      expect(getByText("Aura Noise-Cancelling Headphones")).toBeTruthy()
      expect(getByText("Generate Ad Copy with Gemini")).toBeTruthy()
    })

    it("renders loading spinner card when isGeneratingCopy is true", () => {
      const { getByText } = render(
        React.createElement(AdStudioCopyStep, {
          ...defaultProps,
          isGeneratingCopy: true
        })
      )

      expect(getByText("Crafting Advertising Copy with Gemini")).toBeTruthy()
      expect(getByText(/This usually takes 2–5 seconds/)).toBeTruthy()
    })

    it("renders review & refine card with editable inputs and alternative chips when copy is generated", () => {
      const onSelectHeadline = jest.fn()
      const onSelectCopy = jest.fn()

      const { getByDisplayValue, getByText } = render(
        React.createElement(AdStudioCopyStep, {
          ...defaultProps,
          generatedCopy: mockCopy,
          editableCopy: {
            headline: mockCopy.headline,
            primaryText: mockCopy.primaryText,
            description: mockCopy.description,
            callToAction: mockCopy.callToAction,
            backgroundPrompt: mockCopy.backgroundPrompt
          },
          onSelectHeadlineAlternative: onSelectHeadline,
          onSelectCopyAlternative: onSelectCopy
        })
      )

      expect(getByText("Review & Refine Advertising Copy")).toBeTruthy()
      expect(getByDisplayValue(mockCopy.headline)).toBeTruthy()
      expect(getByDisplayValue(mockCopy.primaryText)).toBeTruthy()
      expect(getByDisplayValue(mockCopy.callToAction)).toBeTruthy()
      expect(getByDisplayValue(mockCopy.backgroundPrompt)).toBeTruthy()

      // Alternative chips rendered
      expect(getByText("Hear the Difference with Studio Sound")).toBeTruthy()
      fireEvent.click(getByText("Hear the Difference with Studio Sound"))
      expect(onSelectHeadline).toHaveBeenCalledWith("Hear the Difference with Studio Sound")

      expect(getByText("Uncompromising sound performance meets 40-hour wireless convenience.")).toBeTruthy()
      fireEvent.click(getByText("Uncompromising sound performance meets 40-hour wireless convenience."))
      expect(onSelectCopy).toHaveBeenCalledWith(
        "Uncompromising sound performance meets 40-hour wireless convenience."
      )
    })

    it("renders stale warning banner with regenerate button when isCopyStale is true", () => {
      const onGenerate = jest.fn().mockResolvedValue(true)
      const { getByText } = render(
        React.createElement(AdStudioCopyStep, {
          ...defaultProps,
          generatedCopy: mockCopy,
          editableCopy: {
            headline: mockCopy.headline,
            primaryText: mockCopy.primaryText,
            description: mockCopy.description,
            callToAction: mockCopy.callToAction,
            backgroundPrompt: mockCopy.backgroundPrompt
          },
          isCopyStale: true,
          onGenerateCopy: onGenerate
        })
      )

      expect(
        getByText(/Configuration parameters were modified in Step 1/)
      ).toBeTruthy()
      const regenBtn = getByText("Regenerate")
      fireEvent.click(regenBtn)
      expect(onGenerate).toHaveBeenCalled()
    })

    it("renders error message banner when copyGenerationError is set", () => {
      const { getByText } = render(
        React.createElement(AdStudioCopyStep, {
          ...defaultProps,
          copyGenerationError: "Gemini API quota exceeded"
        })
      )

      expect(getByText("Copy Generation Error")).toBeTruthy()
      expect(getByText("Gemini API quota exceeded")).toBeTruthy()
    })
  })
})
