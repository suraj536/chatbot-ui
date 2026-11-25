import {
  AdCompositionError,
  AdCompositionInput,
  AdCompositionInputSchema,
  AdFormatName,
  AdLayoutError
} from "@/types/adcraft"
import {
  calculateAdLayout,
  calculateBackgroundCover,
  calculateProductPlacement,
  fitWithinBox,
  getFormatSafeMargins
} from "@/lib/adcraft/ad-layout-engine"
import {
  drawRoundedRect,
  fitSingleLineText,
  fitTextToBox,
  wrapText,
  wrapTextLines
} from "@/lib/adcraft/canvas-renderer"

describe("AdCraft Phase A3: Ad Layout Engine & Composition Utilities", () => {
  const baseInput: AdCompositionInput = {
    format: "square",
    backgroundImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    productImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    headline: "Unleash Pure Sound",
    primaryText: "Experience premium active noise cancellation with 40-hour battery life.",
    callToAction: "Shop Now",
    styling: {
      textPlacement: "bottom",
      productPlacement: "center",
      primaryColor: "#000000",
      accentColor: "#FF4500",
      textColor: "light"
    },
    outputFormat: "png",
    quality: 0.92
  }

  describe("1. Safe Margins Calculation", () => {
    it("returns conservative safe margins for story format (top 250px, bottom 320px)", () => {
      const margins = getFormatSafeMargins("story")
      expect(margins.top).toBe(250)
      expect(margins.bottom).toBe(320)
      expect(margins.left).toBe(70)
      expect(margins.right).toBe(70)
    })

    it("returns standard safe margins for square, portrait, and landscape formats", () => {
      const squareMargins = getFormatSafeMargins("square")
      expect(squareMargins.top).toBe(60)
      expect(squareMargins.bottom).toBe(60)

      const portraitMargins = getFormatSafeMargins("portrait")
      expect(portraitMargins.top).toBe(60)
      expect(portraitMargins.bottom).toBe(60)

      const landscapeMargins = getFormatSafeMargins("landscape")
      expect(landscapeMargins.top).toBe(50)
      expect(landscapeMargins.bottom).toBe(50)
    })
  })

  describe("2. Background Cover Calculation", () => {
    it("matches canvas dimensions exactly when aspect ratios are identical", () => {
      const cover = calculateBackgroundCover(1080, 1080, 1080, 1080)
      expect(cover.destX).toBe(0)
      expect(cover.destY).toBe(0)
      expect(cover.destWidth).toBe(1080)
      expect(cover.destHeight).toBe(1080)
    })

    it("crops horizontally when background is wider than canvas", () => {
      // 1920x1080 image onto 1080x1080 canvas
      const cover = calculateBackgroundCover(1080, 1080, 1920, 1080)
      expect(cover.destHeight).toBe(1080)
      expect(cover.destWidth).toBe(1920)
      expect(cover.destX).toBe(-420) // (1080 - 1920) / 2
      expect(cover.destY).toBe(0)
    })

    it("crops vertically when background is taller than canvas", () => {
      // 1080x1920 image onto 1080x1080 canvas
      const cover = calculateBackgroundCover(1080, 1080, 1080, 1920)
      expect(cover.destWidth).toBe(1080)
      expect(cover.destHeight).toBe(1920)
      expect(cover.destX).toBe(0)
      expect(cover.destY).toBe(-420) // (1080 - 1920) / 2
    })

    it("correctly centers landscape 16:9 background (1200x675) onto 1.91:1 banner (1200x628)", () => {
      const cover = calculateBackgroundCover(1200, 628, 1200, 675)
      expect(cover.destWidth).toBe(1200)
      expect(cover.destHeight).toBe(675)
      expect(cover.destX).toBe(0)
      expect(cover.destY).toBe(-23) // Math.round((628 - 675) / 2) = -23
    })

    it("throws AdLayoutError for invalid dimensions", () => {
      expect(() => calculateBackgroundCover(1080, 1080, 0, 500)).toThrow(AdLayoutError)
      expect(() => calculateBackgroundCover(1080, 1080, -100, 500)).toThrow(AdLayoutError)
    })
  })

  describe("3. Aspect Ratio Preservation (fitWithinBox)", () => {
    it("scales wide content to fit bounding box width while preserving aspect ratio", () => {
      const fitted = fitWithinBox(800, 400, 400, 400)
      expect(fitted.width).toBe(400)
      expect(fitted.height).toBe(200)
      expect(fitted.width / fitted.height).toBe(2)
    })

    it("scales tall content to fit bounding box height while preserving aspect ratio", () => {
      const fitted = fitWithinBox(400, 800, 400, 400)
      expect(fitted.width).toBe(200)
      expect(fitted.height).toBe(400)
      expect(fitted.height / fitted.width).toBe(2)
    })

    it("throws AdLayoutError for non-positive dimensions", () => {
      expect(() => fitWithinBox(0, 100, 200, 200)).toThrow(AdLayoutError)
      expect(() => fitWithinBox(100, -50, 200, 200)).toThrow(AdLayoutError)
    })
  })

  describe("4. Layout Generation Across All 4 Formats", () => {
    const formats: AdFormatName[] = ["square", "portrait", "story", "landscape"]

    formats.forEach(format => {
      it(`computes a valid layout for ${format} format`, () => {
        const input: AdCompositionInput = {
          ...baseInput,
          format
        }
        const layout = calculateAdLayout(input, {
          background: { width: 1200, height: 1200 },
          product: { width: 800, height: 800 }
        })

        expect(layout.format).toBe(format)
        expect(layout.dimensions.width).toBeGreaterThan(0)
        expect(layout.dimensions.height).toBeGreaterThan(0)
        expect(layout.elements.background).toBeDefined()
        expect(layout.elements.product).toBeDefined()
        expect(layout.elements.headline).toBeDefined()
        expect(layout.elements.primaryText).toBeDefined()
        expect(layout.elements.ctaButton).toBeDefined()
      })
    })
  })

  describe("5. Story Format Safe Zone Enforcement", () => {
    it("places all critical elements strictly within story safe margins", () => {
      const input: AdCompositionInput = {
        ...baseInput,
        format: "story",
        logoImage: "data:image/png;base64,iVBORw0KGgo=",
        description: "Engineered for pure audiophile clarity.",
        price: "$199",
        offer: "Special Launch Deal"
      }
      const layout = calculateAdLayout(input, {
        background: { width: 1080, height: 1920 },
        product: { width: 800, height: 800 },
        logo: { width: 200, height: 60 }
      })

      const safeTop = 250
      const safeBottom = 1920 - 320 // 1600px

      // 1. Logo must be at or below safeTop
      expect(layout.elements.logo).toBeDefined()
      if (layout.elements.logo) {
        expect(layout.elements.logo.y).toBeGreaterThanOrEqual(safeTop)
      }

      // 2. Headline must be below safeTop
      expect(layout.elements.headline.y).toBeGreaterThanOrEqual(safeTop)

      // 3. CTA button must end at or before safeBottom
      const cta = layout.elements.ctaButton
      expect(cta.y + cta.height).toBeLessThanOrEqual(safeBottom)

      // 4. Badge must end before CTA
      if (layout.elements.badge) {
        expect(layout.elements.badge.y + layout.elements.badge.height).toBeLessThanOrEqual(cta.y)
      }

      // 5. Description must end before badge
      if (layout.elements.description) {
        expect(layout.elements.description.y + layout.elements.description.height).toBeLessThanOrEqual(safeBottom)
      }

      // 6. Primary text must end before description/badge/CTA
      expect(layout.elements.primaryText.y + layout.elements.primaryText.height).toBeLessThanOrEqual(safeBottom)

      // 7. Product must be in safe zone
      const prod = layout.elements.product
      expect(prod.y).toBeGreaterThanOrEqual(safeTop)
      expect(prod.y + prod.height).toBeLessThanOrEqual(safeBottom)
    })
  })

  describe("6. Landscape Format Split-Screen Layout", () => {
    it("places text stack on the left and product on the right", () => {
      const input: AdCompositionInput = {
        ...baseInput,
        format: "landscape",
        description: "Crystal-clear calls anywhere."
      }
      const layout = calculateAdLayout(input, {
        background: { width: 1200, height: 628 },
        product: { width: 600, height: 600 }
      })

      const headline = layout.elements.headline
      const primary = layout.elements.primaryText
      const desc = layout.elements.description
      const cta = layout.elements.ctaButton
      const product = layout.elements.product

      // Copy is aligned on left
      expect(headline.x).toBe(layout.safeMargins.left)
      expect(primary.x).toBe(layout.safeMargins.left)
      expect(desc?.x).toBe(layout.safeMargins.left)
      expect(cta.x).toBe(layout.safeMargins.left)

      // Product is placed to the right of the copy column
      expect(product.x).toBeGreaterThan(headline.x + Math.round(headline.width * 0.9))

      // Scrim is left-to-right gradient
      expect(layout.elements.scrim?.direction).toBe("left-to-right")
    })
  })

  describe("7. Optional Elements (Logo, Price, Offer, Description)", () => {
    it("handles omission of logo cleanly", () => {
      const input: AdCompositionInput = {
        ...baseInput,
        logoImage: undefined
      }
      const layout = calculateAdLayout(input)
      expect(layout.elements.logo).toBeUndefined()
    })

    it("handles inclusion of logo with aspect ratio preserved", () => {
      const input: AdCompositionInput = {
        ...baseInput,
        logoImage: "data:image/png;base64,iVBORw0KGgo="
      }
      const layout = calculateAdLayout(input, {
        logo: { width: 300, height: 100 }
      })
      expect(layout.elements.logo).toBeDefined()
      expect(layout.elements.logo?.aspectRatio).toBe(3)
      expect(layout.elements.logo?.width).toBeLessThanOrEqual(220)
    })

    it("handles price-only badge", () => {
      const input: AdCompositionInput = {
        ...baseInput,
        price: "$49.99"
      }
      const layout = calculateAdLayout(input)
      expect(layout.elements.badge).toBeDefined()
      expect(layout.elements.badge?.text).toBe("$49.99")
    })

    it("handles offer-only badge", () => {
      const input: AdCompositionInput = {
        ...baseInput,
        offer: "Buy 1 Get 1 Free"
      }
      const layout = calculateAdLayout(input)
      expect(layout.elements.badge).toBeDefined()
      expect(layout.elements.badge?.text).toBe("Buy 1 Get 1 Free")
    })

    it("combines price and offer with bullet separator", () => {
      const input: AdCompositionInput = {
        ...baseInput,
        price: "$79",
        offer: "Save 30%"
      }
      const layout = calculateAdLayout(input)
      expect(layout.elements.badge).toBeDefined()
      expect(layout.elements.badge?.text).toBe("$79 • Save 30%")
    })

    it("omits badge when neither price nor offer is provided", () => {
      const input: AdCompositionInput = {
        ...baseInput,
        price: undefined,
        offer: undefined
      }
      const layout = calculateAdLayout(input)
      expect(layout.elements.badge).toBeUndefined()
    })

    it("omits description when not provided", () => {
      const input: AdCompositionInput = {
        ...baseInput,
        description: undefined
      }
      const layout = calculateAdLayout(input)
      expect(layout.elements.description).toBeUndefined()
    })

    it("includes description bounding box across all formats when provided", () => {
      const formats: AdFormatName[] = ["square", "portrait", "story", "landscape"]
      formats.forEach(format => {
        const input: AdCompositionInput = {
          ...baseInput,
          format,
          description: "Exclusive limited-time promotional pricing."
        }
        const layout = calculateAdLayout(input)
        expect(layout.elements.description).toBeDefined()
        expect(layout.elements.description?.width).toBeGreaterThan(0)
        expect(layout.elements.description?.height).toBeGreaterThan(0)
        expect(layout.elements.description?.y).toBeGreaterThanOrEqual(layout.safeMargins.top)
      })
    })
  })

  describe("8. Product Placement Variations (calculateProductPlacement)", () => {
    const availableBox = { x: 60, y: 200, width: 960, height: 600 }
    const fittedProduct = { width: 400, height: 400 }

    it("handles 'center' placement by centering horizontally and vertically", () => {
      const pos = calculateProductPlacement("center", fittedProduct, availableBox, "square")
      expect(pos.x).toBe(60 + Math.round((960 - 400) / 2)) // 340
      expect(pos.y).toBe(200 + Math.round((600 - 400) / 2)) // 300
    })

    it("handles 'bottom' placement by positioning at the lower vertical boundary", () => {
      const pos = calculateProductPlacement("bottom", fittedProduct, availableBox, "square")
      expect(pos.x).toBe(340)
      expect(pos.y).toBe(200 + (600 - 400)) // 400 (lower limit)
    })

    it("handles 'floating' placement by lifting product into upper 25% of slack", () => {
      const pos = calculateProductPlacement("floating", fittedProduct, availableBox, "square")
      expect(pos.x).toBe(340)
      expect(pos.y).toBe(200 + Math.round((600 - 400) * 0.25)) // 250 (elevated)
    })

    it("handles 'right' placement by aligning to the right margin in square format", () => {
      const pos = calculateProductPlacement("right", fittedProduct, availableBox, "square")
      expect(pos.x).toBe(60 + 960 - 400) // 620
      expect(pos.y).toBe(300)
    })

    it("falls back safely to 'center' when placement is undefined", () => {
      const pos = calculateProductPlacement(undefined, fittedProduct, availableBox, "square")
      expect(pos.x).toBe(340)
      expect(pos.y).toBe(300)
    })

    it("preserves safe bounds across all placements in calculateAdLayout", () => {
      const placements: Array<"center" | "right" | "bottom" | "floating"> = [
        "center",
        "right",
        "bottom",
        "floating"
      ]
      placements.forEach(placement => {
        const input: AdCompositionInput = {
          ...baseInput,
          styling: {
            ...baseInput.styling,
            productPlacement: placement
          }
        }
        const layout = calculateAdLayout(input)
        const prod = layout.elements.product
        expect(prod.x).toBeGreaterThanOrEqual(layout.safeMargins.left)
        expect(prod.x + prod.width).toBeLessThanOrEqual(layout.dimensions.width - layout.safeMargins.right)
        expect(prod.y).toBeGreaterThanOrEqual(layout.safeMargins.top)
        expect(prod.y + prod.height).toBeLessThanOrEqual(layout.dimensions.height - layout.safeMargins.bottom)
      })
    })
  })

  describe("9. Canvas Bounds and Collision Avoidance", () => {
    const formats: AdFormatName[] = ["square", "portrait", "story", "landscape"]

    formats.forEach(format => {
      it(`enforces all element bounding boxes remain strictly inside canvas boundaries for ${format}`, () => {
        const input: AdCompositionInput = {
          ...baseInput,
          format,
          logoImage: "data:image/png;base64,iVBORw0KGgo=",
          description: "Detailed product summary text.",
          price: "$99",
          offer: "Limited Edition"
        }
        const layout = calculateAdLayout(input, {
          background: { width: 1200, height: 1200 },
          product: { width: 800, height: 800 },
          logo: { width: 180, height: 50 }
        })

        const { canvas, headline, primaryText, description, ctaButton, product, logo, badge } =
          layout.elements

        const checkBounds = (rect: { x: number; y: number; width: number; height: number }, name: string) => {
          expect(rect.x).toBeGreaterThanOrEqual(0)
          expect(rect.y).toBeGreaterThanOrEqual(0)
          expect(rect.x + rect.width).toBeLessThanOrEqual(canvas.width)
          expect(rect.y + rect.height).toBeLessThanOrEqual(canvas.height)
        }

        checkBounds(headline, "headline")
        checkBounds(primaryText, "primaryText")
        if (description) checkBounds(description, "description")
        checkBounds(ctaButton, "ctaButton")
        checkBounds(product, "product")
        if (logo) checkBounds(logo, "logo")
        if (badge) checkBounds(badge, "badge")
      })
    })
  })

  describe("10. Determinism", () => {
    it("produces identical layouts given identical inputs", () => {
      const input: AdCompositionInput = {
        ...baseInput,
        price: "$120",
        offer: "Cyber Monday Deal",
        description: "Premium warranty included.",
        logoImage: "data:image/png;base64,iVBORw0KGgo="
      }
      const layout1 = calculateAdLayout(input)
      const layout2 = calculateAdLayout(input)

      expect(layout1).toEqual(layout2)
    })
  })

  describe("11. Input Validation with AdCompositionInputSchema", () => {
    it("accepts valid data URLs and blob URLs", () => {
      const valid = AdCompositionInputSchema.safeParse(baseInput)
      expect(valid.success).toBe(true)

      const blobValid = AdCompositionInputSchema.safeParse({
        ...baseInput,
        backgroundImage: "blob:http://localhost:3000/123456",
        productImage: "blob:http://localhost:3000/789012"
      })
      expect(blobValid.success).toBe(true)
    })

    it("rejects non-data/non-blob image sources (e.g. remote HTTP endpoints)", () => {
      const invalid = AdCompositionInputSchema.safeParse({
        ...baseInput,
        backgroundImage: "https://example.com/untrusted.jpg"
      })
      expect(invalid.success).toBe(false)
    })

    it("rejects empty headline or call to action", () => {
      const invalidHeadline = AdCompositionInputSchema.safeParse({
        ...baseInput,
        headline: ""
      })
      expect(invalidHeadline.success).toBe(false)

      const invalidCta = AdCompositionInputSchema.safeParse({
        ...baseInput,
        callToAction: "  "
      })
      expect(invalidCta.success).toBe(false)
    })
  })

  describe("12. Adaptive Text Measurement, Exact Text Preservation & Overflow Prevention", () => {
    // Mock 2D context where text width is calculated based on font size and character length
    const createMockContext = () => {
      const paths: string[] = []
      let currentFont = "normal 16px sans-serif"

      return {
        get font() {
          return currentFont
        },
        set font(f: string) {
          currentFont = f
        },
        measureText: (text: string) => {
          // Parse font size from font string (e.g. "bold 24px sans-serif")
          const match = currentFont.match(/(\d+)px/)
          const size = match ? parseInt(match[1], 10) : 16
          return {
            width: text.length * (size * 0.55)
          } as TextMetrics
        },
        beginPath: () => paths.push("beginPath"),
        roundRect: jest.fn((x, y, w, h, r) => paths.push(`roundRect:${x},${y},${w},${h},${r}`)),
        moveTo: (x: number, y: number) => paths.push(`moveTo:${x},${y}`),
        lineTo: (x: number, y: number) => paths.push(`lineTo:${x},${y}`),
        quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) =>
          paths.push(`quad:${cpx},${cpy},${x},${y}`),
        closePath: () => paths.push("closePath"),
        paths
      }
    }

    it("wraps words into lines without dropping or truncating any text", () => {
      const mockCtx = createMockContext() as unknown as CanvasRenderingContext2D
      mockCtx.font = "bold 20px sans-serif"
      const text = "Experience premium active noise cancellation with 40-hour battery life"
      const lines = wrapTextLines(mockCtx, text, 200)

      expect(lines.length).toBeGreaterThan(1)
      // All words from original text must be preserved
      const reconstructed = lines.join(" ")
      expect(reconstructed).toBe(text)
    })

    it("fits standard headline at preferred font size without reduction", () => {
      const mockCtx = createMockContext() as unknown as CanvasRenderingContext2D
      const headline = "Unleash Pure Sound"
      const fontTemplate = (size: number) => `bold ${size}px sans-serif`

      const fit = fitTextToBox(mockCtx, headline, 600, 150, 2, 48, 28, fontTemplate, "Headline")
      expect(fit.fontSize).toBe(48)
      expect(fit.lines.join(" ")).toBe(headline)
    })

    it("adaptively reduces headline font size when text is longer", () => {
      const mockCtx = createMockContext() as unknown as CanvasRenderingContext2D
      const headline = "Experience Revolutionary Sound Engineered For Everyone"
      const fontTemplate = (size: number) => `bold ${size}px sans-serif`

      // At 48px, this headline is too wide for 2 lines of 500px. It must adapt downwards.
      const fit = fitTextToBox(mockCtx, headline, 500, 120, 2, 48, 26, fontTemplate, "Headline")
      expect(fit.fontSize).toBeLessThan(48)
      expect(fit.fontSize).toBeGreaterThanOrEqual(26)
      // Exact headline text must be 100% preserved
      expect(fit.lines.join(" ")).toBe(headline)
    })

    it("throws a descriptive TEXT_OVERFLOW error when headline cannot fit even at minimum font size", () => {
      const mockCtx = createMockContext() as unknown as CanvasRenderingContext2D
      const impossibleHeadline =
        "This is an absurdly long headline that cannot possibly fit within two lines of small space even at minimum font size"
      const fontTemplate = (size: number) => `bold ${size}px sans-serif`

      expect(() => {
        fitTextToBox(mockCtx, impossibleHeadline, 200, 50, 2, 44, 28, fontTemplate, "Headline")
      }).toThrow(AdCompositionError)

      try {
        fitTextToBox(mockCtx, impossibleHeadline, 200, 50, 2, 44, 28, fontTemplate, "Headline")
      } catch (err: any) {
        expect(err.code).toBe("TEXT_OVERFLOW")
        expect(err.message).toContain("Headline")
        expect(err.message).toContain("cannot fit within allowed space")
      }
    })

    it("adaptively reduces primary text font size to preserve complete copy", () => {
      const mockCtx = createMockContext() as unknown as CanvasRenderingContext2D
      const copy =
        "Our flagship noise cancelling wireless headphones feature ultra-soft memory foam ear cushions, 40-hour playback, and fast USB-C charging."
      const fontTemplate = (size: number) => `500 ${size}px sans-serif`

      const fit = fitTextToBox(mockCtx, copy, 500, 100, 3, 24, 15, fontTemplate, "Primary Text")
      expect(fit.fontSize).toBeLessThanOrEqual(24)
      expect(fit.fontSize).toBeGreaterThanOrEqual(15)
      expect(fit.lines.join(" ")).toBe(copy)
    })

    it("throws a descriptive TEXT_OVERFLOW error when primary text exceeds bounds", () => {
      const mockCtx = createMockContext() as unknown as CanvasRenderingContext2D
      const hugeCopy = "Word ".repeat(150)
      const fontTemplate = (size: number) => `500 ${size}px sans-serif`

      expect(() => {
        fitTextToBox(mockCtx, hugeCopy, 300, 60, 2, 22, 16, fontTemplate, "Primary Text")
      }).toThrow(AdCompositionError)
    })

    it("fits standard CTA at preferred font size", () => {
      const mockCtx = createMockContext() as unknown as CanvasRenderingContext2D
      const fontTemplate = (size: number) => `bold ${size}px sans-serif`
      const size = fitSingleLineText(mockCtx, "Shop Now", 200, 22, 13, fontTemplate, "Call to Action")
      expect(size).toBe(22)
    })

    it("adaptively reduces CTA font size when text is longer", () => {
      const mockCtx = createMockContext() as unknown as CanvasRenderingContext2D
      const fontTemplate = (size: number) => `bold ${size}px sans-serif`
      // "Get Started With Premium Today" is ~30 chars. At 22px it is ~363px. Must step down to fit inside 240px.
      const size = fitSingleLineText(
        mockCtx,
        "Get Started With Premium Today",
        240,
        22,
        13,
        fontTemplate,
        "Call to Action"
      )
      expect(size).toBeLessThan(22)
      expect(size).toBeGreaterThanOrEqual(13)
    })

    it("throws BUTTON_TEXT_OVERFLOW when CTA text cannot fit inside button width", () => {
      const mockCtx = createMockContext() as unknown as CanvasRenderingContext2D
      const fontTemplate = (size: number) => `bold ${size}px sans-serif`
      const absurdCta = "Click Here Immediately To Claim Your Ultra Super Discount Today"

      expect(() => {
        fitSingleLineText(mockCtx, absurdCta, 150, 20, 13, fontTemplate, "Call to Action")
      }).toThrow(AdCompositionError)

      try {
        fitSingleLineText(mockCtx, absurdCta, 150, 20, 13, fontTemplate, "Call to Action")
      } catch (err: any) {
        expect(err.code).toBe("BUTTON_TEXT_OVERFLOW")
        expect(err.message).toContain("Call to Action")
      }
    })

    it("adaptively scales price/offer badge text and throws when it cannot fit", () => {
      const mockCtx = createMockContext() as unknown as CanvasRenderingContext2D
      const fontTemplate = (size: number) => `bold ${size}px sans-serif`
      const badgeText = "$99 • Special Introductory Offer"

      const size = fitSingleLineText(mockCtx, badgeText, 250, 19, 12, fontTemplate, "Badge")
      expect(size).toBeLessThanOrEqual(19)
      expect(size).toBeGreaterThanOrEqual(12)

      const hugeBadge = "$999 • Very Long Promotional Campaign Text That Cannot Fit In Any Pill"
      expect(() => {
        fitSingleLineText(mockCtx, hugeBadge, 120, 19, 12, fontTemplate, "Badge")
      }).toThrow(AdCompositionError)
    })

    it("draws rounded rectangle using native roundRect and quadratic fallback", () => {
      const mockCtx = createMockContext()
      drawRoundedRect(mockCtx as unknown as CanvasRenderingContext2D, 10, 20, 100, 50, 8)
      expect(mockCtx.roundRect).toHaveBeenCalledWith(10, 20, 100, 50, 8)

      ;(mockCtx as any).roundRect = undefined
      drawRoundedRect(mockCtx as unknown as CanvasRenderingContext2D, 10, 20, 100, 50, 8)
      expect(mockCtx.paths).toContain("beginPath")
      expect(mockCtx.paths).toContain("closePath")
      expect(mockCtx.paths.some(p => p.startsWith("quad:"))).toBe(true)
    })
  })
})
