import {
  AdCompositionError,
  AdCompositionInput,
  AdCompositionInputSchema,
  AdCompositionOutput,
  AdComputedLayout
} from "@/types/adcraft"
import { calculateAdLayout } from "./ad-layout-engine"

/**
 * Loads an image from a data URL or blob URL.
 * Rejects cleanly on network or format failures.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof Image === "undefined") {
      reject(new AdCompositionError("loadImage can only be executed in a browser environment"))
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      resolve(img)
    }

    img.onerror = () => {
      reject(new AdCompositionError("Failed to load image asset: invalid or unreachable image source"))
    }

    img.src = src
  })
}

/**
 * Word-wrapping algorithm for HTML5 Canvas 2D.
 * Splits text into lines that fit within maxWidth without dropping or truncating words.
 */
export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text || maxWidth <= 0) {
    return []
  }

  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let currentLine = ""

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)

    if (metrics.width <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) {
        lines.push(currentLine)
      }
      currentLine = word
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

/**
 * Backward-compatible wrapText helper.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines?: number
): string[] {
  if (!text || maxWidth <= 0) return []
  const lines = wrapTextLines(ctx, text, maxWidth)
  if (maxLines && lines.length > maxLines) {
    return lines.slice(0, maxLines)
  }
  return lines
}

export interface FitTextResult {
  lines: string[]
  fontSize: number
  lineHeightPx: number
  totalHeight: number
}

/**
 * Fits multiline advertising text within bounding constraints using adaptive font-size reduction.
 * Throws a descriptive AdCompositionError if the exact text cannot fit without truncation.
 */
export function fitTextToBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  maxLines: number,
  preferredFontSize: number,
  minFontSize: number,
  fontTemplate: (size: number) => string,
  elementName: string,
  lineHeightMultiplier = 1.25
): FitTextResult {
  if (!text || maxWidth <= 0 || maxHeight <= 0) {
    return { lines: [], fontSize: preferredFontSize, lineHeightPx: 0, totalHeight: 0 }
  }

  for (let size = preferredFontSize; size >= minFontSize; size -= 1) {
    ctx.font = fontTemplate(size)
    const lines = wrapTextLines(ctx, text, maxWidth)
    const lineHeightPx = Math.round(size * lineHeightMultiplier)
    const totalHeight = lines.length * lineHeightPx

    // Ensure every line fits within maxWidth and line count fits within maxLines and maxHeight
    const allLinesFit = lines.every(line => ctx.measureText(line).width <= maxWidth + 1)

    if (lines.length <= maxLines && totalHeight <= maxHeight && allLinesFit) {
      return {
        lines,
        fontSize: size,
        lineHeightPx,
        totalHeight
      }
    }
  }

  throw new AdCompositionError(
    `Advertising text overflow: '${elementName}' cannot fit within allowed space (${maxWidth}x${maxHeight}px, max ${maxLines} lines) even at minimum font size (${minFontSize}px). Content must be shortened to maintain advertising integrity.`,
    "TEXT_OVERFLOW"
  )
}

/**
 * Fits single-line text (e.g. CTA button, price badge) using adaptive font-size reduction.
 * Throws a descriptive AdCompositionError if the exact text cannot fit.
 */
export function fitSingleLineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  preferredFontSize: number,
  minFontSize: number,
  fontTemplate: (size: number) => string,
  elementName: string
): number {
  for (let size = preferredFontSize; size >= minFontSize; size -= 1) {
    ctx.font = fontTemplate(size)
    if (ctx.measureText(text).width <= maxWidth) {
      return size
    }
  }

  throw new AdCompositionError(
    `Advertising text overflow: '${elementName}' ("${text}") cannot fit within allowed width (${maxWidth}px) even at minimum font size (${minFontSize}px).`,
    "BUTTON_TEXT_OVERFLOW"
  )
}

/**
 * Renders a rounded rectangle path with cross-browser fallback.
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2)
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, r)
  } else {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + width - r, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + r)
    ctx.lineTo(x + width, y + height - r)
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    ctx.lineTo(x + r, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }
}

/**
 * Renders an advertisement composition directly onto an HTML5 Canvas.
 * Returns the populated canvas and the computed layout.
 */
export async function renderAdCompositionToCanvas(
  input: AdCompositionInput,
  targetCanvas?: HTMLCanvasElement
): Promise<{ canvas: HTMLCanvasElement; layout: AdComputedLayout }> {
  // 1. Validate Input
  const parsed = AdCompositionInputSchema.safeParse(input)
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")
    throw new AdCompositionError(`Invalid composition input parameters: ${errorDetails}`)
  }
  const validated = parsed.data

  // 2. Validate Browser Environment
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new AdCompositionError("AdCanvasRenderer requires a browser DOM environment with HTMLCanvasElement support.")
  }

  // 3. Load Image Assets in Parallel
  const [bgImg, productImg, logoImg] = await Promise.all([
    loadImage(validated.backgroundImage),
    loadImage(validated.productImage),
    validated.logoImage ? loadImage(validated.logoImage) : Promise.resolve(undefined)
  ])

  // 4. Calculate Deterministic Layout Geometry
  const layout = calculateAdLayout(validated, {
    background: {
      width: bgImg.naturalWidth || bgImg.width || 1200,
      height: bgImg.naturalHeight || bgImg.height || 1200
    },
    product: {
      width: productImg.naturalWidth || productImg.width || 800,
      height: productImg.naturalHeight || productImg.height || 800
    },
    logo: logoImg
      ? {
          width: logoImg.naturalWidth || logoImg.width || 200,
          height: logoImg.naturalHeight || logoImg.height || 60
        }
      : undefined
  })

  // 5. Initialize Canvas
  const canvas = targetCanvas || document.createElement("canvas")
  canvas.width = layout.dimensions.width
  canvas.height = layout.dimensions.height

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new AdCompositionError("Failed to acquire 2D rendering context from canvas.")
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  // 6. Layer 1: Background Image
  const bg = layout.elements.background
  ctx.drawImage(bgImg, bg.destX, bg.destY, bg.destWidth, bg.destHeight)

  // 7. Layer 2: Readability Scrim (Gradient)
  if (layout.elements.scrim) {
    const scrim = layout.elements.scrim
    ctx.save()
    let gradient: CanvasGradient

    if (scrim.direction === "bottom-to-top") {
      gradient = ctx.createLinearGradient(0, scrim.y + scrim.height, 0, scrim.y)
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.78)")
      gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.45)")
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)")
    } else if (scrim.direction === "left-to-right") {
      gradient = ctx.createLinearGradient(scrim.x, 0, scrim.x + scrim.width, 0)
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.85)")
      gradient.addColorStop(0.6, "rgba(0, 0, 0, 0.55)")
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)")
    } else {
      gradient = ctx.createLinearGradient(0, scrim.y, 0, scrim.y + scrim.height)
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.65)")
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)")
    }

    ctx.fillStyle = gradient
    ctx.fillRect(scrim.x, scrim.y, scrim.width, scrim.height)
    ctx.restore()
  }

  // 8. Layer 3: Product Image (with soft ambient shadow for depth)
  const prod = layout.elements.product
  ctx.save()
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)"
  ctx.shadowBlur = 28
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 14
  ctx.drawImage(productImg, prod.x, prod.y, prod.width, prod.height)
  ctx.restore()

  // 9. Layer 4: Brand Logo (if provided)
  if (logoImg && layout.elements.logo) {
    const logo = layout.elements.logo
    ctx.save()
    ctx.drawImage(logoImg, logo.x, logo.y, logo.width, logo.height)
    ctx.restore()
  }

  // 10. Layer 5: Headline (Exact text, adaptive font sizing, descriptive overflow protection)
  const hl = layout.elements.headline
  ctx.save()
  ctx.fillStyle = hl.color
  ctx.textAlign = hl.align
  ctx.textBaseline = "top"
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)"
  ctx.shadowBlur = 8
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2

  const hlFontTemplate = (size: number) =>
    `bold ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  const minHeadlineFontSize = Math.min(26, Math.round(hl.fontSize * 0.6))

  const hlFit = fitTextToBox(
    ctx,
    validated.headline,
    hl.width,
    hl.height,
    hl.maxLines,
    hl.fontSize,
    minHeadlineFontSize,
    hlFontTemplate,
    "Headline",
    hl.lineHeight
  )

  ctx.font = hlFontTemplate(hlFit.fontSize)
  hlFit.lines.forEach((line, idx) => {
    const lineX = hl.align === "center" ? hl.x + hl.width / 2 : hl.x
    ctx.fillText(line, lineX, hl.y + idx * hlFit.lineHeightPx)
  })
  ctx.restore()

  // 11. Layer 6: Primary Text (Exact text, adaptive font sizing, descriptive overflow protection)
  const pt = layout.elements.primaryText
  ctx.save()
  ctx.fillStyle = pt.color
  ctx.textAlign = pt.align
  ctx.textBaseline = "top"
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)"
  ctx.shadowBlur = 6
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2

  const ptFontTemplate = (size: number) =>
    `500 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  const minPrimaryFontSize = Math.min(15, Math.round(pt.fontSize * 0.65))

  const ptFit = fitTextToBox(
    ctx,
    validated.primaryText,
    pt.width,
    pt.height,
    pt.maxLines,
    pt.fontSize,
    minPrimaryFontSize,
    ptFontTemplate,
    "Primary Text",
    pt.lineHeight
  )

  ctx.font = ptFontTemplate(ptFit.fontSize)
  ptFit.lines.forEach((line, idx) => {
    const lineX = pt.align === "center" ? pt.x + pt.width / 2 : pt.x
    ctx.fillText(line, lineX, pt.y + idx * ptFit.lineHeightPx)
  })
  ctx.restore()

  // 12. Layer 6b: Description (if provided)
  if (layout.elements.description && validated.description) {
    const desc = layout.elements.description
    ctx.save()
    ctx.fillStyle = desc.color
    ctx.textAlign = desc.align
    ctx.textBaseline = "top"
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)"
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 1

    const descFontTemplate = (size: number) =>
      `normal ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
    const minDescFontSize = Math.min(13, Math.round(desc.fontSize * 0.7))

    const descFit = fitTextToBox(
      ctx,
      validated.description,
      desc.width,
      desc.height,
      desc.maxLines,
      desc.fontSize,
      minDescFontSize,
      descFontTemplate,
      "Description",
      desc.lineHeight
    )

    ctx.font = descFontTemplate(descFit.fontSize)
    descFit.lines.forEach((line, idx) => {
      const lineX = desc.align === "center" ? desc.x + desc.width / 2 : desc.x
      ctx.fillText(line, lineX, desc.y + idx * descFit.lineHeightPx)
    })
    ctx.restore()
  }

  // 13. Layer 7: Badge (Price & Offer)
  if (layout.elements.badge) {
    const badge = layout.elements.badge
    ctx.save()

    const badgeFontTemplate = (size: number) =>
      `bold ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
    const maxBadgeTextWidth = badge.width - 20
    const minBadgeFontSize = 12

    const badgeFontSize = fitSingleLineText(
      ctx,
      badge.text,
      maxBadgeTextWidth,
      badge.fontSize,
      minBadgeFontSize,
      badgeFontTemplate,
      "Price/Offer Badge"
    )

    drawRoundedRect(ctx, badge.x, badge.y, badge.width, badge.height, badge.borderRadius)
    ctx.fillStyle = badge.backgroundColor
    ctx.fill()

    ctx.font = badgeFontTemplate(badgeFontSize)
    ctx.fillStyle = badge.textColor
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(badge.text, badge.x + badge.width / 2, badge.y + badge.height / 2)
    ctx.restore()
  }

  // 14. Layer 8: Call To Action Button
  const cta = layout.elements.ctaButton
  ctx.save()
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
  ctx.shadowBlur = 16
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 6
  drawRoundedRect(ctx, cta.x, cta.y, cta.width, cta.height, cta.borderRadius)
  ctx.fillStyle = cta.backgroundColor
  ctx.fill()
  ctx.restore()

  ctx.save()
  const ctaFontTemplate = (size: number) =>
    `bold ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  const maxCtaTextWidth = cta.width - 24
  const minCtaFontSize = 13

  const ctaFontSize = fitSingleLineText(
    ctx,
    cta.text,
    maxCtaTextWidth,
    cta.fontSize,
    minCtaFontSize,
    ctaFontTemplate,
    "Call to Action"
  )

  ctx.font = ctaFontTemplate(ctaFontSize)
  ctx.fillStyle = cta.textColor
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(cta.text, cta.x + cta.width / 2, cta.y + cta.height / 2)
  ctx.restore()

  return { canvas, layout }
}

/**
 * End-to-end composition function: renders advertising creative and exports as a high-quality Blob.
 */
export async function renderAdComposition(
  input: AdCompositionInput,
  customCanvas?: HTMLCanvasElement
): Promise<AdCompositionOutput> {
  const { canvas, layout } = await renderAdCompositionToCanvas(input, customCanvas)

  const mimeType =
    input.outputFormat === "webp"
      ? "image/webp"
      : input.outputFormat === "jpeg"
      ? "image/jpeg"
      : "image/png"

  const quality = input.quality ?? 0.92

  const blob = await new Promise<Blob>((resolve, reject) => {
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob(
        b => {
          if (b) {
            resolve(b)
          } else {
            reject(new AdCompositionError("Failed to generate image blob from canvas"))
          }
        },
        mimeType,
        quality
      )
    } else if (typeof canvas.toDataURL === "function") {
      try {
        const dataUrl = canvas.toDataURL(mimeType, quality)
        const parts = dataUrl.split(",")
        const byteString = atob(parts[1])
        const mime = parts[0].split(":")[1].split(";")[0]
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i)
        }
        resolve(new Blob([ab], { type: mime }))
      } catch (err) {
        reject(new AdCompositionError(`Canvas export fallback failed: ${String(err)}`))
      }
    } else {
      reject(new AdCompositionError("Canvas does not support toBlob or toDataURL"))
    }
  })

  return {
    blob,
    dimensions: layout.dimensions,
    format: layout.format,
    mimeType,
    renderedAt: new Date().toISOString()
  }
}
