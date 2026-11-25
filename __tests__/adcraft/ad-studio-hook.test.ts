import { renderHook, act, render, fireEvent, createEvent } from "@testing-library/react"
import React from "react"
import {
  useAdStudio,
  validateConfigStep1,
  validateImageFile,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
  initialStudioConfig,
  initialAsset
} from "@/lib/adcraft/use-ad-studio"
import { AdStudioConfigStep } from "@/components/adcraft/ad-studio-config-step"

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

      act(() => {
        allowed = result.current.goToStep(3)
      })
      expect(allowed).toBe(true)
      expect(result.current.currentStep).toBe(3)

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
    })
  })
})
