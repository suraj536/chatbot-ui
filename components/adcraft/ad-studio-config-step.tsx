"use client"

import React, { FC, useRef, useState } from "react"
import {
  AD_FORMATS,
  AD_PLATFORMS,
  AD_TONES,
  AdFormatName,
  AdPlatform,
  AdTone
} from "@/types/adcraft"
import {
  AdStudioAsset,
  AdStudioConfig,
  ALLOWED_IMAGE_TYPES
} from "@/lib/adcraft/use-ad-studio"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TextareaAutosize } from "@/components/ui/textarea-autosize"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  IconAlertCircle,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconPhoto,
  IconTrash,
  IconUpload
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

export interface AdStudioConfigStepProps {
  config: AdStudioConfig
  productImage: AdStudioAsset
  logoImage: AdStudioAsset
  validationErrors: Record<string, string>
  onConfigChange: (field: keyof AdStudioConfig, value: any) => void
  onProductImageSelect: (file: File) => Promise<boolean>
  onProductImageRemove: () => void
  onLogoImageSelect: (file: File) => Promise<boolean>
  onLogoImageRemove: () => void
  onContinue: () => void
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "0 B"
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const AdStudioConfigStep: FC<AdStudioConfigStepProps> = ({
  config,
  productImage,
  logoImage,
  validationErrors,
  onConfigChange,
  onProductImageSelect,
  onProductImageRemove,
  onLogoImageSelect,
  onLogoImageRemove,
  onContinue
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isDraggingProduct, setIsDraggingProduct] = useState(false)
  const [isDraggingLogo, setIsDraggingLogo] = useState(false)

  const productFileInputRef = useRef<HTMLInputElement>(null)
  const logoFileInputRef = useRef<HTMLInputElement>(null)

  // Product drag and drop handlers
  const handleProductDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingProduct(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onProductImageSelect(e.dataTransfer.files[0])
    }
  }

  // Logo drag and drop handlers
  const handleLogoDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingLogo(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onLogoImageSelect(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Core Product Info */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">
            Product Information
          </CardTitle>
          <CardDescription>
            Specify your product details. AdCraft uses these to generate targeted advertising copy and visual concepts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Name */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="productName" className="flex items-center gap-1">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <span className="text-muted-foreground text-xs">
                {config.productName.length}/120
              </span>
            </div>
            <Input
              id="productName"
              placeholder="e.g., Lumina Pro ANC Wireless Headphones"
              value={config.productName}
              maxLength={120}
              onChange={e => onConfigChange("productName", e.target.value)}
              className={cn(
                validationErrors.productName && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {validationErrors.productName && (
              <p className="text-destructive flex items-center gap-1 text-xs">
                <IconAlertCircle className="size-3.5" />
                {validationErrors.productName}
              </p>
            )}
          </div>

          {/* Product Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="productDescription" className="flex items-center gap-1">
                Product Description <span className="text-destructive">*</span>
              </Label>
              <span className="text-muted-foreground text-xs">
                {config.productDescription.length}/2000
              </span>
            </div>
            <TextareaAutosize
              value={config.productDescription}
              onValueChange={val => onConfigChange("productDescription", val)}
              minRows={3}
              maxRows={8}
              maxLength={2000}
              placeholder="Describe your product's key benefits, unique features, and the primary problem it solves for customers..."
              className={cn(
                validationErrors.productDescription && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {validationErrors.productDescription && (
              <p className="text-destructive flex items-center gap-1 text-xs">
                <IconAlertCircle className="size-3.5" />
                {validationErrors.productDescription}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Format & Strategy */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">
            Creative Format & Strategy
          </CardTitle>
          <CardDescription>
            Choose the target canvas aspect ratio, publishing platform, and tone of voice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Format Selection Cards */}
          <div className="space-y-2">
            <Label>Creative Format</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(AD_FORMATS) as AdFormatName[]).map(formatKey => {
                const format = AD_FORMATS[formatKey]
                const isSelected = config.format === formatKey

                return (
                  <button
                    key={formatKey}
                    type="button"
                    onClick={() => onConfigChange("format", formatKey)}
                    className={cn(
                      "hover:border-primary/50 flex flex-col items-center justify-between rounded-lg border-2 p-3 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card"
                    )}
                  >
                    <div className="mb-2 flex h-14 w-full items-center justify-center">
                      <div
                        className={cn(
                          "rounded border-2 transition-all",
                          isSelected
                            ? "border-primary bg-primary/20"
                            : "border-muted-foreground/30 bg-muted/40",
                          formatKey === "square" && "size-10",
                          formatKey === "portrait" && "h-12 w-9",
                          formatKey === "story" && "h-14 w-8",
                          formatKey === "landscape" && "h-7 w-14"
                        )}
                      />
                    </div>
                    <div className="w-full text-center">
                      <p className="text-xs font-semibold leading-tight">{format.label}</p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {format.width}×{format.height}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Platform & Tone Selectors */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Platform */}
            <div className="space-y-2">
              <Label htmlFor="platformSelect">Target Platform</Label>
              <select
                id="platformSelect"
                value={config.platform}
                onChange={e => onConfigChange("platform", e.target.value as AdPlatform)}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {AD_PLATFORMS.map(p => (
                  <option key={p} value={p} className="capitalize">
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <Label htmlFor="toneSelect">Brand Tone</Label>
              <select
                id="toneSelect"
                value={config.tone}
                onChange={e => onConfigChange("tone", e.target.value as AdTone)}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {AD_TONES.map(t => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Visual Assets (Product Image & Logo) */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">
            Visual Assets
          </CardTitle>
          <CardDescription>
            Upload your isolated product photography and optional brand logo. Images are stored securely in browser memory only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Image Uploader */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Product Image</span>
              <span className="text-muted-foreground text-xs">PNG, JPEG, WebP (Max 10MB)</span>
            </Label>

            <input
              ref={productFileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  onProductImageSelect(e.target.files[0])
                  e.target.value = ""
                }
              }}
            />

            {productImage.dataUrl ? (
              <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="bg-background relative size-14 shrink-0 overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={productImage.dataUrl}
                      alt="Product preview"
                      className="size-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {productImage.name || "Product image"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatFileSize(productImage.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onProductImageRemove}
                  className="text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <IconTrash className="mr-1 size-4" />
                  Remove
                </Button>
              </div>
            ) : (
              <div
                onDragOver={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDraggingProduct(true)
                }}
                onDragLeave={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDraggingProduct(false)
                }}
                onDrop={handleProductDrop}
                onClick={() => productFileInputRef.current?.click()}
                className={cn(
                  "hover:bg-muted/30 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                  isDraggingProduct ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                  validationErrors.productImage && "border-destructive bg-destructive/5"
                )}
              >
                <div className="bg-muted mb-2 flex size-10 items-center justify-center rounded-full">
                  <IconUpload className="text-muted-foreground size-5" />
                </div>
                <p className="text-sm font-medium">
                  Click to upload product image or drag and drop
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Transparent PNG or isolated product photography recommended
                </p>
              </div>
            )}

            {validationErrors.productImage && (
              <p className="text-destructive flex items-center gap-1 text-xs">
                <IconAlertCircle className="size-3.5" />
                {validationErrors.productImage}
              </p>
            )}
          </div>

          {/* Brand Logo Uploader (Optional) */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Brand Logo (Optional)</span>
              <span className="text-muted-foreground text-xs">PNG, JPEG, WebP (Max 10MB)</span>
            </Label>

            <input
              ref={logoFileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  onLogoImageSelect(e.target.files[0])
                  e.target.value = ""
                }
              }}
            />

            {logoImage.dataUrl ? (
              <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="bg-background relative size-12 shrink-0 overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoImage.dataUrl}
                      alt="Brand logo preview"
                      className="size-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {logoImage.name || "Brand logo"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatFileSize(logoImage.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onLogoImageRemove}
                  className="text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <IconTrash className="mr-1 size-4" />
                  Remove
                </Button>
              </div>
            ) : (
              <div
                onDragOver={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDraggingLogo(true)
                }}
                onDragLeave={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDraggingLogo(false)
                }}
                onDrop={handleLogoDrop}
                onClick={() => logoFileInputRef.current?.click()}
                className={cn(
                  "hover:bg-muted/30 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors",
                  isDraggingLogo ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                  validationErrors.logoImage && "border-destructive bg-destructive/5"
                )}
              >
                <div className="bg-muted mb-1 flex size-8 items-center justify-center rounded-full">
                  <IconPhoto className="text-muted-foreground size-4" />
                </div>
                <p className="text-xs font-medium">Upload brand logo (Optional)</p>
                <p className="text-muted-foreground text-[11px]">Transparent PNG works best</p>
              </div>
            )}

            {validationErrors.logoImage && (
              <p className="text-destructive flex items-center gap-1 text-xs">
                <IconAlertCircle className="size-3.5" />
                {validationErrors.logoImage}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Optional Campaign & Commercial Details */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none pb-4"
          onClick={() => setShowAdvanced(prev => !prev)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                Commercial Details & Campaign Settings
              </CardTitle>
              <CardDescription>
                Optional promotional offers, pricing, brand name, and custom call to action.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" type="button" className="shrink-0">
              {showAdvanced ? (
                <IconChevronUp className="size-5" />
              ) : (
                <IconChevronDown className="size-5" />
              )}
            </Button>
          </div>
        </CardHeader>
        {showAdvanced && (
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Brand Name */}
              <div className="space-y-1.5">
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
                  placeholder="e.g., Lumina Audio"
                  value={config.brandName}
                  maxLength={100}
                  onChange={e => onConfigChange("brandName", e.target.value)}
                />
              </div>

              {/* Call to Action */}
              <div className="space-y-1.5">
                <Label htmlFor="callToAction">Call to Action (CTA)</Label>
                <Input
                  id="callToAction"
                  placeholder="e.g., Shop Now, Claim 20% Off"
                  value={config.callToAction}
                  maxLength={60}
                  onChange={e => onConfigChange("callToAction", e.target.value)}
                />
              </div>

              {/* Price */}
              <div className="space-y-1.5">
                <Label htmlFor="price">Price Display</Label>
                <Input
                  id="price"
                  placeholder="e.g., $199 or ₹4,999"
                  value={config.price}
                  maxLength={50}
                  onChange={e => onConfigChange("price", e.target.value)}
                />
              </div>

              {/* Offer */}
              <div className="space-y-1.5">
                <Label htmlFor="offer">Promotional Offer</Label>
                <Input
                  id="offer"
                  placeholder="e.g., 20% OFF Limited Time"
                  value={config.offer}
                  maxLength={100}
                  onChange={e => onConfigChange("offer", e.target.value)}
                />
              </div>

              {/* Target Audience */}
              <div className="space-y-1.5">
                <Label htmlFor="targetAudience">Target Audience</Label>
                <Input
                  id="targetAudience"
                  placeholder="e.g., Remote professionals and audiophiles"
                  value={config.targetAudience}
                  maxLength={300}
                  onChange={e => onConfigChange("targetAudience", e.target.value)}
                />
              </div>

              {/* Campaign Objective */}
              <div className="space-y-1.5">
                <Label htmlFor="campaignObjective">Campaign Objective</Label>
                <Input
                  id="campaignObjective"
                  placeholder="e.g., Product launch awareness"
                  value={config.campaignObjective}
                  maxLength={80}
                  onChange={e => onConfigChange("campaignObjective", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 5. Advance Step Action */}
      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-muted-foreground text-xs">
          Step 1 of 4: Setup parameters before generating AI advertising copy.
        </p>
        <Button type="button" onClick={onContinue} className="gap-2">
          <span>Continue to Copy Generation</span>
          <IconArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
