import {
  AD_FORMATS,
  AdCompositionInput,
  AdComputedLayout,
  AdFormatName,
  AdLayoutBoundingBoxes,
  AdLayoutError,
  AdSafeMargins,
  Rect,
  TextRegionLayout
} from "@/types/adcraft"

export interface AssetDimensions {
  background?: { width: number; height: number }
  product?: { width: number; height: number }
  logo?: { width: number; height: number }
}

/**
 * Returns conservative safe margins for each advertising format.
 * In Story format (9:16), conservative safe zones reserve:
 * - 250px at top (avoids user profile, story bars)
 * - 320px at bottom (avoids reply bar, like buttons, attribution)
 */
export function getFormatSafeMargins(format: AdFormatName): AdSafeMargins {
  switch (format) {
    case "story":
      return {
        top: 250,
        right: 70,
        bottom: 320,
        left: 70
      }
    case "landscape":
      return {
        top: 50,
        right: 60,
        bottom: 50,
        left: 60
      }
    case "portrait":
      return {
        top: 60,
        right: 60,
        bottom: 60,
        left: 60
      }
    case "square":
    default:
      return {
        top: 60,
        right: 60,
        bottom: 60,
        left: 60
      }
  }
}

/**
 * Calculates mathematical cover cropping for background image.
 * Ensures the background covers the canvas entirely without stretching.
 */
export function calculateBackgroundCover(
  canvasWidth: number,
  canvasHeight: number,
  bgWidth = canvasWidth,
  bgHeight = canvasHeight
) {
  if (bgWidth <= 0 || bgHeight <= 0) {
    throw new AdLayoutError("Invalid background image dimensions (must be > 0)")
  }

  const scale = Math.max(canvasWidth / bgWidth, canvasHeight / bgHeight)
  const destWidth = Math.round(bgWidth * scale)
  const destHeight = Math.round(bgHeight * scale)
  const destX = Math.round((canvasWidth - destWidth) / 2)
  const destY = Math.round((canvasHeight - destHeight) / 2)

  return {
    sourceWidth: bgWidth,
    sourceHeight: bgHeight,
    destX,
    destY,
    destWidth,
    destHeight
  }
}

/**
 * Fits a rectangle inside a bounding box while strictly preserving aspect ratio.
 */
export function fitWithinBox(
  targetWidth: number,
  targetHeight: number,
  boxWidth: number,
  boxHeight: number
): { width: number; height: number } {
  if (targetWidth <= 0 || targetHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    throw new AdLayoutError("Dimensions must be positive numbers")
  }

  const scale = Math.min(boxWidth / targetWidth, boxHeight / targetHeight)
  return {
    width: Math.round(targetWidth * scale),
    height: Math.round(targetHeight * scale)
  }
}

/**
 * Calculates deterministic product placement within available bounds.
 * Supports "center", "right", "bottom", and "floating".
 */
export function calculateProductPlacement(
  placement: "center" | "right" | "bottom" | "floating" | undefined,
  fittedProduct: { width: number; height: number },
  availableBox: { x: number; y: number; width: number; height: number },
  format: AdFormatName
): { x: number; y: number } {
  // Horizontal placement
  let x: number
  if (placement === "right" && format !== "landscape") {
    x = availableBox.x + availableBox.width - fittedProduct.width
  } else {
    x = availableBox.x + Math.round((availableBox.width - fittedProduct.width) / 2)
  }

  // Vertical placement
  const verticalSlack = Math.max(0, availableBox.height - fittedProduct.height)
  let y: number

  switch (placement) {
    case "bottom":
      y = availableBox.y + verticalSlack
      break
    case "floating":
      // Lifted towards upper 25% of available vertical slack for an elevated floating feel
      y = availableBox.y + Math.round(verticalSlack * 0.25)
      break
    case "right":
    case "center":
    default:
      y = availableBox.y + Math.round(verticalSlack / 2)
      break
  }

  return { x, y }
}

/**
 * Pure layout calculation engine for AdCraft AI.
 * Computes deterministic bounding boxes, safe margins, and typography layout.
 */
export function calculateAdLayout(
  input: AdCompositionInput,
  assetDimensions?: AssetDimensions
): AdComputedLayout {
  const formatConfig = AD_FORMATS[input.format]
  if (!formatConfig) {
    throw new AdLayoutError(`Unsupported format '${input.format}'`)
  }

  const canvasWidth = formatConfig.width
  const canvasHeight = formatConfig.height
  const safeMargins = getFormatSafeMargins(input.format)

  const contentWidth = canvasWidth - safeMargins.left - safeMargins.right
  const contentHeight = canvasHeight - safeMargins.top - safeMargins.bottom

  if (contentWidth <= 0 || contentHeight <= 0) {
    throw new AdLayoutError("Safe margin constraints exceed canvas dimensions")
  }

  // 1. Background Cover Calculation
  const bgDimensions = assetDimensions?.background || {
    width: canvasWidth,
    height: canvasHeight
  }
  const bgLayout = calculateBackgroundCover(
    canvasWidth,
    canvasHeight,
    bgDimensions.width,
    bgDimensions.height
  )

  // 2. Logo Placement (Optional)
  let logoRect: (Rect & { aspectRatio: number }) | undefined
  let logoBottomY = safeMargins.top

  if (input.logoImage) {
    const rawLogoWidth = assetDimensions?.logo?.width || 200
    const rawLogoHeight = assetDimensions?.logo?.height || 60
    const logoAspect = rawLogoWidth / rawLogoHeight

    const maxLogoWidth = Math.min(220, Math.round(contentWidth * 0.3))
    const maxLogoHeight = 70
    const fittedLogo = fitWithinBox(rawLogoWidth, rawLogoHeight, maxLogoWidth, maxLogoHeight)

    logoRect = {
      x: safeMargins.left,
      y: safeMargins.top,
      width: fittedLogo.width,
      height: fittedLogo.height,
      aspectRatio: logoAspect
    }
    logoBottomY = logoRect.y + logoRect.height + 24
  }

  // 3. Typography & Badges Styling Hints
  const textColorHex = input.styling?.textColor === "dark" ? "#1A1A1A" : "#FFFFFF"
  const secondaryTextColorHex =
    input.styling?.textColor === "dark" ? "#4A4A4A" : "rgba(255, 255, 255, 0.88)"
  const accentColorHex = input.styling?.accentColor || "#FF4500"

  // Compute Layout by Format
  let elements: AdLayoutBoundingBoxes

  switch (input.format) {
    case "landscape": {
      // Landscape: Split Screen (Left side copy, Right side product)
      const leftColWidth = Math.round(contentWidth * 0.52)
      const rightColWidth = contentWidth - leftColWidth - 30
      const rightColX = safeMargins.left + leftColWidth + 30

      // Product in Right Column
      const rawProductW = assetDimensions?.product?.width || 800
      const rawProductH = assetDimensions?.product?.height || 800
      const productAspect = rawProductW / rawProductH
      const rightColBox = {
        x: rightColX,
        y: safeMargins.top,
        width: rightColWidth,
        height: contentHeight - 20
      }
      const fittedProduct = fitWithinBox(
        rawProductW,
        rawProductH,
        rightColBox.width,
        rightColBox.height
      )

      const productPos = calculateProductPlacement(
        input.styling?.productPlacement,
        fittedProduct,
        rightColBox,
        "landscape"
      )

      const productRect = {
        x: productPos.x,
        y: productPos.y,
        width: fittedProduct.width,
        height: fittedProduct.height,
        aspectRatio: productAspect
      }

      // Left Column Text Stack
      let currentY = logoRect ? logoBottomY : safeMargins.top + 10

      const headlineLayout: TextRegionLayout = {
        x: safeMargins.left,
        y: currentY,
        width: leftColWidth,
        height: 105,
        fontSize: 44,
        lineHeight: 1.2,
        maxLines: 2,
        align: "left",
        color: textColorHex
      }
      currentY += headlineLayout.height + 12

      const primaryTextLayout: TextRegionLayout = {
        x: safeMargins.left,
        y: currentY,
        width: leftColWidth,
        height: 75,
        fontSize: 22,
        lineHeight: 1.35,
        maxLines: 3,
        align: "left",
        color: secondaryTextColorHex
      }
      currentY += primaryTextLayout.height + 12

      // Optional Description
      let descriptionLayout: TextRegionLayout | undefined
      if (input.description) {
        descriptionLayout = {
          x: safeMargins.left,
          y: currentY,
          width: leftColWidth,
          height: 52,
          fontSize: 18,
          lineHeight: 1.3,
          maxLines: 2,
          align: "left",
          color: secondaryTextColorHex
        }
        currentY += descriptionLayout.height + 14
      }

      // Optional Badge
      let badgeRect: AdLayoutBoundingBoxes["badge"]
      if (input.price || input.offer) {
        const badgeText = [input.price, input.offer].filter(Boolean).join(" • ")
        const badgeWidth = Math.min(leftColWidth, Math.max(160, badgeText.length * 12 + 32))
        badgeRect = {
          x: safeMargins.left,
          y: currentY,
          width: badgeWidth,
          height: 38,
          text: badgeText,
          fontSize: 18,
          backgroundColor: accentColorHex,
          textColor: "#FFFFFF",
          borderRadius: 8
        }
        currentY += badgeRect.height + 16
      }

      // CTA Button
      const ctaWidth = Math.min(260, leftColWidth)
      const ctaButtonRect = {
        x: safeMargins.left,
        y: Math.max(currentY, canvasHeight - safeMargins.bottom - 54),
        width: ctaWidth,
        height: 50,
        text: input.callToAction,
        fontSize: 20,
        backgroundColor: accentColorHex,
        textColor: "#FFFFFF",
        borderRadius: 25
      }

      elements = {
        canvas: { width: canvasWidth, height: canvasHeight },
        safeMargins,
        background: bgLayout,
        scrim: {
          x: 0,
          y: 0,
          width: Math.round(canvasWidth * 0.65),
          height: canvasHeight,
          direction: "left-to-right"
        },
        product: productRect,
        logo: logoRect,
        headline: headlineLayout,
        primaryText: primaryTextLayout,
        description: descriptionLayout,
        badge: badgeRect,
        ctaButton: ctaButtonRect
      }
      break
    }

    case "story": {
      // Story: Vertical Stack with strict Top/Bottom Safe Zones
      let currentTopY = safeMargins.top
      if (logoRect) {
        logoRect.x = safeMargins.left + Math.round((contentWidth - logoRect.width) / 2)
        logoRect.y = safeMargins.top
        currentTopY = logoRect.y + logoRect.height + 20
      }

      // Headline at top
      const headlineLayout: TextRegionLayout = {
        x: safeMargins.left,
        y: currentTopY,
        width: contentWidth,
        height: 140,
        fontSize: 54,
        lineHeight: 1.25,
        maxLines: 3,
        align: "center",
        color: textColorHex
      }

      // Bottom Section: CTA, Badge, Description, Primary Copy
      const ctaHeight = 64
      const ctaY = canvasHeight - safeMargins.bottom - ctaHeight
      const ctaWidth = Math.min(340, contentWidth)
      const ctaButtonRect = {
        x: safeMargins.left + Math.round((contentWidth - ctaWidth) / 2),
        y: ctaY,
        width: ctaWidth,
        height: ctaHeight,
        text: input.callToAction,
        fontSize: 24,
        backgroundColor: accentColorHex,
        textColor: "#FFFFFF",
        borderRadius: 32
      }

      let bottomAnchorY = ctaY - 20
      let badgeRect: AdLayoutBoundingBoxes["badge"]
      if (input.price || input.offer) {
        const badgeText = [input.price, input.offer].filter(Boolean).join(" • ")
        const badgeWidth = Math.min(contentWidth, Math.max(200, badgeText.length * 14 + 40))
        badgeRect = {
          x: safeMargins.left + Math.round((contentWidth - badgeWidth) / 2),
          y: bottomAnchorY - 44,
          width: badgeWidth,
          height: 44,
          text: badgeText,
          fontSize: 20,
          backgroundColor: accentColorHex,
          textColor: "#FFFFFF",
          borderRadius: 10
        }
        bottomAnchorY = badgeRect.y - 18
      }

      // Optional Description
      let descriptionLayout: TextRegionLayout | undefined
      if (input.description) {
        const descHeight = 65
        descriptionLayout = {
          x: safeMargins.left,
          y: bottomAnchorY - descHeight,
          width: contentWidth,
          height: descHeight,
          fontSize: 20,
          lineHeight: 1.3,
          maxLines: 2,
          align: "center",
          color: secondaryTextColorHex
        }
        bottomAnchorY = descriptionLayout.y - 16
      }

      const primaryTextHeight = 85
      const primaryTextLayout: TextRegionLayout = {
        x: safeMargins.left,
        y: bottomAnchorY - primaryTextHeight,
        width: contentWidth,
        height: primaryTextHeight,
        fontSize: 26,
        lineHeight: 1.35,
        maxLines: 3,
        align: "center",
        color: secondaryTextColorHex
      }

      // Product in Middle
      const availableProductTop = headlineLayout.y + headlineLayout.height + 25
      const availableProductBottom = primaryTextLayout.y - 25
      const availableProductHeight = Math.max(200, availableProductBottom - availableProductTop)

      const rawProductW = assetDimensions?.product?.width || 800
      const rawProductH = assetDimensions?.product?.height || 800
      const productAspect = rawProductW / rawProductH
      const storyProductBox = {
        x: safeMargins.left,
        y: availableProductTop,
        width: contentWidth,
        height: availableProductHeight
      }
      const fittedProduct = fitWithinBox(
        rawProductW,
        rawProductH,
        storyProductBox.width,
        storyProductBox.height
      )

      const productPos = calculateProductPlacement(
        input.styling?.productPlacement,
        fittedProduct,
        storyProductBox,
        "story"
      )

      const productRect = {
        x: productPos.x,
        y: productPos.y,
        width: fittedProduct.width,
        height: fittedProduct.height,
        aspectRatio: productAspect
      }

      elements = {
        canvas: { width: canvasWidth, height: canvasHeight },
        safeMargins,
        background: bgLayout,
        scrim: {
          x: 0,
          y: Math.round(canvasHeight * 0.45),
          width: canvasWidth,
          height: Math.round(canvasHeight * 0.55),
          direction: "bottom-to-top"
        },
        product: productRect,
        logo: logoRect,
        headline: headlineLayout,
        primaryText: primaryTextLayout,
        description: descriptionLayout,
        badge: badgeRect,
        ctaButton: ctaButtonRect
      }
      break
    }

    case "portrait":
    case "square":
    default: {
      // Square (1080x1080) and Portrait (1080x1350): Stacked Layout
      let currentTopY = safeMargins.top
      if (logoRect) {
        logoRect.x = safeMargins.left
        logoRect.y = safeMargins.top
        currentTopY = logoBottomY
      }

      const headlineFontSize = input.format === "portrait" ? 52 : 48
      const headlineLayout: TextRegionLayout = {
        x: safeMargins.left,
        y: currentTopY,
        width: contentWidth,
        height: input.format === "portrait" ? 130 : 120,
        fontSize: headlineFontSize,
        lineHeight: 1.25,
        maxLines: 2,
        align: "left",
        color: textColorHex
      }

      // Bottom Area: CTA & Badge
      const ctaHeight = 58
      const ctaWidth = Math.min(300, Math.round(contentWidth * 0.5))
      const ctaY = canvasHeight - safeMargins.bottom - ctaHeight
      const ctaButtonRect = {
        x: canvasWidth - safeMargins.right - ctaWidth,
        y: ctaY,
        width: ctaWidth,
        height: ctaHeight,
        text: input.callToAction,
        fontSize: 22,
        backgroundColor: accentColorHex,
        textColor: "#FFFFFF",
        borderRadius: 29
      }

      let badgeRect: AdLayoutBoundingBoxes["badge"]
      if (input.price || input.offer) {
        const badgeText = [input.price, input.offer].filter(Boolean).join(" • ")
        const badgeWidth = Math.min(
          contentWidth - ctaWidth - 20,
          Math.max(160, badgeText.length * 12 + 32)
        )
        badgeRect = {
          x: safeMargins.left,
          y: ctaY + 8,
          width: badgeWidth,
          height: 42,
          text: badgeText,
          fontSize: 19,
          backgroundColor: accentColorHex,
          textColor: "#FFFFFF",
          borderRadius: 8
        }
      }

      // Bottom copy stack
      let bottomStackTopY = ctaY - 16
      let descriptionLayout: TextRegionLayout | undefined
      if (input.description) {
        const descHeight = input.format === "portrait" ? 52 : 46
        descriptionLayout = {
          x: safeMargins.left,
          y: bottomStackTopY - descHeight,
          width: contentWidth,
          height: descHeight,
          fontSize: input.format === "portrait" ? 18 : 17,
          lineHeight: 1.3,
          maxLines: 2,
          align: "left",
          color: secondaryTextColorHex
        }
        bottomStackTopY = descriptionLayout.y - 12
      }

      const primaryTextHeight = input.format === "portrait" ? 76 : 72
      const primaryTextLayout: TextRegionLayout = {
        x: safeMargins.left,
        y: bottomStackTopY - primaryTextHeight,
        width: contentWidth,
        height: primaryTextHeight,
        fontSize: 24,
        lineHeight: 1.35,
        maxLines: 2,
        align: "left",
        color: secondaryTextColorHex
      }

      // Product in Middle
      const availableProductTop = headlineLayout.y + headlineLayout.height + 20
      const availableProductBottom = primaryTextLayout.y - 20
      const availableProductHeight = Math.max(200, availableProductBottom - availableProductTop)

      const rawProductW = assetDimensions?.product?.width || 800
      const rawProductH = assetDimensions?.product?.height || 800
      const productAspect = rawProductW / rawProductH
      const middleProductBox = {
        x: safeMargins.left,
        y: availableProductTop,
        width: contentWidth,
        height: availableProductHeight
      }
      const fittedProduct = fitWithinBox(
        rawProductW,
        rawProductH,
        middleProductBox.width,
        middleProductBox.height
      )

      const productPos = calculateProductPlacement(
        input.styling?.productPlacement,
        fittedProduct,
        middleProductBox,
        input.format
      )

      const productRect = {
        x: productPos.x,
        y: productPos.y,
        width: fittedProduct.width,
        height: fittedProduct.height,
        aspectRatio: productAspect
      }

      elements = {
        canvas: { width: canvasWidth, height: canvasHeight },
        safeMargins,
        background: bgLayout,
        scrim: {
          x: 0,
          y: Math.round(canvasHeight * 0.5),
          width: canvasWidth,
          height: Math.round(canvasHeight * 0.5),
          direction: "bottom-to-top"
        },
        product: productRect,
        logo: logoRect,
        headline: headlineLayout,
        primaryText: primaryTextLayout,
        description: descriptionLayout,
        badge: badgeRect,
        ctaButton: ctaButtonRect
      }
      break
    }
  }

  // Layer rendering sequence strictly controlled by engine
  const layerOrder: AdComputedLayout["layerOrder"] = [
    "background",
    "scrim",
    "product",
    "logo",
    "headline",
    "primaryText",
    "description",
    "badge",
    "ctaButton"
  ]

  return {
    format: input.format,
    dimensions: { width: canvasWidth, height: canvasHeight },
    safeMargins,
    elements,
    layerOrder
  }
}
