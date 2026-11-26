"use client"

import React, { FC, useEffect, useRef, useState } from "react"
import {
  AD_FORMATS,
  AD_FORMAT_STABILITY_MAP,
  SupportedStabilityModel
} from "@/types/adcraft"
import {
  AdStudioConfig,
  GeneratedBackgroundItem,
  MAX_BACKGROUND_PROMPT_LENGTH
} from "@/lib/adcraft/use-ad-studio"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconLoader2,
  IconPhoto,
  IconRefresh,
  IconSparkles,
  IconWand
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

const STABILITY_MODEL_OPTIONS: Array<{
  id: SupportedStabilityModel
  name: string
  description: string
}> = [
  {
    id: "stability-image-ultra",
    name: "Stability Image Ultra",
    description: "Highest commercial detail, lighting realism & coherence"
  },
  {
    id: "stability-image-core",
    name: "Stability Image Core",
    description: "Faster turnaround & lower credit usage"
  }
]

function getAspectClass(format: AdStudioConfig["format"]): string {
  switch (format) {
    case "portrait":
      return "aspect-[4/5] max-w-[340px]"
    case "story":
      return "aspect-[9/16] max-w-[260px]"
    case "landscape":
      return "aspect-[1.91/1] max-w-[460px]"
    case "square":
    default:
      return "aspect-square max-w-[380px]"
  }
}

function getModelDisplayName(model: SupportedStabilityModel): string {
  switch (model) {
    case "stability-image-core":
      return "Stability Core"
    case "stability-image-ultra":
    case "stability-video":
    default:
      return "Stability Ultra"
  }
}

export interface AdStudioVisualStepProps {
  workspaceId: string
  config: AdStudioConfig
  backgroundPrompt: string
  visualModel: SupportedStabilityModel
  negativePrompt: string
  visualSeed: string
  generatedBackgrounds: GeneratedBackgroundItem[]
  selectedBackground: GeneratedBackgroundItem | null
  isGeneratingVisual: boolean
  visualGenerationError: string | null
  visualFieldErrors: Record<string, string>
  isVisualPromptStale: boolean
  isVisualFormatStale: boolean
  isVisualStale: boolean
  staleVisualAcknowledged: boolean
  onBackgroundPromptChange: (value: string) => void
  onVisualModelChange: (model: SupportedStabilityModel) => void
  onNegativePromptChange: (value: string) => void
  onVisualSeedChange: (value: string) => void
  onGenerateVisual: () => Promise<boolean>
  onSelectBackground: (id: string) => void
  onRevertPromptToSelected: () => void
  onAcknowledgeStaleVisual: (acknowledged: boolean) => void
  onPrevStep: () => void
  onNextStep: () => void
}

export const AdStudioVisualStep: FC<AdStudioVisualStepProps> = ({
  config,
  backgroundPrompt,
  visualModel,
  negativePrompt,
  visualSeed,
  generatedBackgrounds,
  selectedBackground,
  isGeneratingVisual,
  visualGenerationError,
  visualFieldErrors,
  isVisualPromptStale,
  isVisualFormatStale,
  isVisualStale,
  staleVisualAcknowledged,
  onBackgroundPromptChange,
  onVisualModelChange,
  onNegativePromptChange,
  onVisualSeedChange,
  onGenerateVisual,
  onSelectBackground,
  onRevertPromptToSelected,
  onAcknowledgeStaleVisual,
  onPrevStep,
  onNextStep
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const isMountedRef = useRef(true)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = null
      }
    }
  }, [])

  const currentFormat = AD_FORMATS[config.format]
  const stabilityAspectRatio = AD_FORMAT_STABILITY_MAP[config.format]

  const handleCopyPrompt = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return
    }
    try {
      await navigator.clipboard.writeText(backgroundPrompt)
      if (!isMountedRef.current) return
      setCopiedPrompt(true)
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = setTimeout(() => {
        copyTimeoutRef.current = null
        if (isMountedRef.current) {
          setCopiedPrompt(false)
        }
      }, 2000)
    } catch {
      // Clipboard write unavailable or permission denied; ignore safely without unhandled rejection
    }
  }

  const promptError = visualFieldErrors.backgroundPrompt
  const negPromptError = visualFieldErrors.negativePrompt
  const seedError = visualFieldErrors.visualSeed
  const hasAdvancedErrors = Boolean(negPromptError || seedError)
  const isAdvancedExpanded = showAdvanced || hasAdvancedErrors

  return (
    <div className="space-y-6">
      {/* Main Visual Generation Configuration & Preview Card */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Step 3 of 4
              </Badge>
              {selectedBackground && (
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  <IconCheck className="size-3 text-green-500" />
                  Generated with Stability AI
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPrevStep}
              disabled={isGeneratingVisual}
            >
              <IconArrowLeft className="mr-1.5 size-3.5" />
              Back to Ad Copy
            </Button>
          </div>
          <CardTitle className="mt-2 text-xl">
            Background Visual Generation
          </CardTitle>
          <CardDescription>
            Refine your visual diffusion prompt and generate a commercial background tailored to your selected format using Stability AI.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Format Summary Bar */}
          <div className="bg-muted/30 grid grid-cols-1 gap-3 rounded-lg border p-3.5 text-xs sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Advertisement Format
              </span>
              <span className="text-foreground font-semibold">
                {currentFormat.label}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Target Dimensions
              </span>
              <span className="text-foreground font-mono font-medium">
                {currentFormat.width} × {currentFormat.height} px
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Stability AI Aspect Ratio
              </span>
              <span className="text-foreground font-medium">
                {stabilityAspectRatio}
                {config.format === "landscape" ? " (fitted to 1.91:1)" : ""}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {visualGenerationError && (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-3 rounded-lg border p-3.5 text-xs"
            >
              <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Visual Generation Error</p>
                <p className="text-muted-foreground mt-0.5">{visualGenerationError}</p>
              </div>
            </div>
          )}

          {/* Stale Background Warning (Prompt or Format Changed After Generation) */}
          {selectedBackground && isVisualStale && (
            <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div role="status">
                    <p className="font-semibold">
                      Selected Background Out of Sync
                    </p>
                    <p className="mt-0.5 leading-relaxed">
                      {isVisualPromptStale && isVisualFormatStale
                        ? `Both the background prompt and creative format (${AD_FORMATS[selectedBackground.formatUsed].label} → ${currentFormat.label}) have changed since this image was generated.`
                        : isVisualFormatStale
                          ? `The selected background was generated for ${AD_FORMATS[selectedBackground.formatUsed].label}, but your current format is ${currentFormat.label}.`
                          : "Your background prompt has been edited since the selected background image was generated."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isVisualPromptStale && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isGeneratingVisual}
                      onClick={onRevertPromptToSelected}
                      className="bg-background/70 hover:bg-background h-7 border-amber-500/30 text-xs"
                    >
                      Revert Prompt
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isGeneratingVisual}
                    onClick={onGenerateVisual}
                    className="bg-background/70 hover:bg-background h-7 border-amber-500/40 text-xs font-medium"
                  >
                    <IconRefresh className="mr-1.5 size-3" />
                    Regenerate Background
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-amber-500/20 pt-2.5">
                <Checkbox
                  id="acknowledge-stale-visual"
                  checked={staleVisualAcknowledged}
                  disabled={isGeneratingVisual}
                  onCheckedChange={checked =>
                    onAcknowledgeStaleVisual(checked === true)
                  }
                />
                <Label
                  htmlFor="acknowledge-stale-visual"
                  className="cursor-pointer text-xs font-normal text-amber-800 dark:text-amber-200"
                >
                  Keep selected background anyway for the composition stage
                </Label>
              </div>
            </div>
          )}

          {/* Editable Background Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="visual-bg-prompt"
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                <IconWand className="text-primary size-3.5" />
                Background Generation Prompt{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[10px]",
                    backgroundPrompt.length > MAX_BACKGROUND_PROMPT_LENGTH
                      ? "text-destructive font-semibold"
                      : "text-muted-foreground"
                  )}
                >
                  {backgroundPrompt.length}/{MAX_BACKGROUND_PROMPT_LENGTH}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={handleCopyPrompt}
                  title="Copy background prompt"
                  aria-label="Copy background prompt"
                >
                  {copiedPrompt ? (
                    <IconCheck className="size-3 text-green-500" />
                  ) : (
                    <IconCopy className="text-muted-foreground size-3" />
                  )}
                </Button>
              </div>
            </div>
            <p
              id="visual-bg-prompt-help"
              className="text-muted-foreground text-[11px]"
            >
              Describe the scene, lighting, surface texture, and mood. Built-in safeguards keep the canvas free of embedded text or watermarks.
            </p>
            <Textarea
              id="visual-bg-prompt"
              name="backgroundPrompt"
              value={backgroundPrompt}
              onChange={e => onBackgroundPromptChange(e.target.value)}
              placeholder="Describe the commercial studio background, lighting, textures, and composition..."
              rows={4}
              maxLength={MAX_BACKGROUND_PROMPT_LENGTH}
              required
              disabled={isGeneratingVisual}
              aria-invalid={Boolean(promptError)}
              aria-describedby={
                promptError
                  ? "visual-bg-prompt-help visual-bg-prompt-error"
                  : "visual-bg-prompt-help"
              }
              className={cn(
                "text-sm",
                promptError && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {promptError && (
              <p
                id="visual-bg-prompt-error"
                role="alert"
                className="text-destructive flex items-center gap-1 text-xs"
              >
                <IconAlertCircle className="size-3.5 shrink-0" />
                {promptError}
              </p>
            )}
            {selectedBackground && isVisualPromptStale && (
              <p className="bg-muted/40 text-muted-foreground rounded px-2.5 py-1.5 text-[11px]">
                <span className="text-foreground font-medium">
                  Prompt used for selected image:{" "}
                </span>
                {selectedBackground.promptUsed}
              </p>
            )}
          </div>

          {/* Model Selection */}
          <fieldset className="space-y-2">
            <legend className="text-foreground text-xs font-semibold">
              Stability AI Model
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {STABILITY_MODEL_OPTIONS.map(option => {
                const isSelected = visualModel === option.id
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "focus-within:ring-ring focus-within:ring-offset-background relative flex cursor-pointer flex-col items-start rounded-lg border-2 p-3 text-left transition-all focus-within:ring-2 focus-within:ring-offset-2",
                      isGeneratingVisual && "cursor-not-allowed opacity-50",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <input
                      type="radio"
                      name="stabilityModel"
                      value={option.id}
                      checked={isSelected}
                      disabled={isGeneratingVisual}
                      onChange={() => onVisualModelChange(option.id)}
                      className="sr-only"
                    />
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-foreground text-xs font-semibold">
                        {option.name}
                      </span>
                      {isSelected && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                          Selected
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground mt-1 text-[11px]">
                      {option.description}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* Optional Advanced Visual Controls */}
          <div className="bg-muted/20 rounded-lg border">
            <button
              type="button"
              aria-expanded={isAdvancedExpanded}
              aria-controls="visual-advanced-options"
              onClick={() => {
                if (!hasAdvancedErrors) {
                  setShowAdvanced(prev => !prev)
                }
              }}
              className="text-foreground hover:bg-muted/30 flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium"
            >
              <span>Advanced Generation Options (Negative Prompt & Seed)</span>
              {isAdvancedExpanded ? (
                <IconChevronUp className="text-muted-foreground size-4" />
              ) : (
                <IconChevronDown className="text-muted-foreground size-4" />
              )}
            </button>

            {isAdvancedExpanded && (
              <div
                id="visual-advanced-options"
                className="grid grid-cols-1 gap-4 border-t p-4 sm:grid-cols-2"
              >
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="visual-negative-prompt"
                      className="text-xs font-medium"
                    >
                      Additional Exclusions (Optional)
                    </Label>
                    <span className="text-muted-foreground text-[10px]">
                      {negativePrompt.length}/500
                    </span>
                  </div>
                  <Input
                    id="visual-negative-prompt"
                    name="negativePrompt"
                    value={negativePrompt}
                    onChange={e => onNegativePromptChange(e.target.value)}
                    placeholder="e.g., cluttered objects, neon colors, people, dark shadows"
                    maxLength={500}
                    disabled={isGeneratingVisual}
                    aria-invalid={Boolean(negPromptError)}
                    aria-describedby={
                      negPromptError
                        ? "visual-negative-prompt-error"
                        : "visual-negative-prompt-help"
                    }
                  />
                  <p
                    id="visual-negative-prompt-help"
                    className="text-muted-foreground text-[11px]"
                  >
                    Appended to default typography, watermark, and logo suppression rules.
                  </p>
                  {negPromptError && (
                    <p
                      id="visual-negative-prompt-error"
                      role="alert"
                      className="text-destructive text-xs"
                    >
                      {negPromptError}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="visual-seed-input"
                    className="text-xs font-medium"
                  >
                    Generation Seed (Optional)
                  </Label>
                  <Input
                    id="visual-seed-input"
                    name="visualSeed"
                    type="text"
                    inputMode="numeric"
                    value={visualSeed}
                    onChange={e => onVisualSeedChange(e.target.value)}
                    placeholder="Random if left blank (0 – 4294967295)"
                    disabled={isGeneratingVisual}
                    aria-invalid={Boolean(seedError)}
                    aria-describedby={
                      seedError ? "visual-seed-error" : "visual-seed-help"
                    }
                  />
                  <p
                    id="visual-seed-help"
                    className="text-muted-foreground text-[11px]"
                  >
                    Reuse a seed to iterate consistently on prompt variations.
                  </p>
                  {seedError && (
                    <p
                      id="visual-seed-error"
                      role="alert"
                      className="text-destructive text-xs"
                    >
                      {seedError}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview / Loading / Trigger Area */}
          {isGeneratingVisual ? (
            <div
              role="progressbar"
              aria-label="Generating background image with Stability AI"
              className="border-primary/20 bg-muted/20 flex flex-col items-center justify-center rounded-lg border p-6 text-center"
            >
              <div
                className={cn(
                  "border-primary/30 bg-background/80 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-6",
                  getAspectClass(config.format)
                )}
              >
                <div className="bg-primary/10 text-primary mb-3 flex size-12 items-center justify-center rounded-full">
                  <IconLoader2 className="size-6 animate-spin" />
                </div>
                <p className="text-foreground text-sm font-semibold">
                  Rendering Background with {getModelDisplayName(visualModel)}
                </p>
                <p className="text-muted-foreground mt-1 max-w-xs text-xs">
                  Generating {currentFormat.label} composition backdrop at{" "}
                  {stabilityAspectRatio} ratio. This usually takes 5–15 seconds.
                </p>
              </div>
              <Button
                type="button"
                disabled
                className="mt-4 gap-2"
              >
                <IconLoader2 className="size-4 animate-spin" />
                Generating Background...
              </Button>
            </div>
          ) : selectedBackground ? (
            <div className="bg-muted/20 space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-foreground text-sm font-semibold">
                    Generated Background Preview
                  </h3>
                  <p className="text-muted-foreground text-[11px]">
                    Selected background is synced to the creative preview and reserved for Step 4 composition.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onGenerateVisual}
                  disabled={isGeneratingVisual}
                  className="gap-1.5 text-xs"
                >
                  <IconRefresh className="size-3.5" />
                  Regenerate Background
                </Button>
              </div>

              {/* Aspect-Ratio Respecting Preview Frame (no crop/distortion) */}
              <div className="bg-muted/40 flex w-full items-center justify-center rounded-lg border p-4">
                <div
                  className={cn(
                    "bg-background relative w-full overflow-hidden rounded-md border shadow-sm",
                    getAspectClass(selectedBackground.formatUsed)
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedBackground.visual.dataUrl}
                    alt={`Generated ad background for ${config.productName || "campaign"} (${AD_FORMATS[selectedBackground.formatUsed].label})`}
                    className="size-full object-contain"
                  />
                </div>
              </div>

              {/* Technical Asset Metadata */}
              <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {getModelDisplayName(selectedBackground.modelUsed)}
                  </Badge>
                  <Badge variant="outline" className="font-normal uppercase">
                    {selectedBackground.visual.format}
                  </Badge>
                  <Badge variant="outline" className="font-normal">
                    Ratio: {selectedBackground.stabilityAspectRatio}
                  </Badge>
                  {typeof selectedBackground.visual.seed === "number" && (
                    <Badge variant="outline" className="font-mono font-normal">
                      Seed: {selectedBackground.visual.seed}
                    </Badge>
                  )}
                </div>

                {typeof selectedBackground.visual.seed === "number" && (
                  <button
                    type="button"
                    onClick={() =>
                      onVisualSeedChange(String(selectedBackground.visual.seed))
                    }
                    className="text-primary hover:underline"
                  >
                    Reuse seed for variations
                  </button>
                )}
              </div>

              {/* Session Generated Variations Selector */}
              {generatedBackgrounds.length > 1 && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground mb-2 text-[11px] font-medium">
                    Session Variations ({generatedBackgrounds.length}) — click to select background:
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {generatedBackgrounds.map((item, idx) => {
                      const isCurrent = item.id === selectedBackground.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={isCurrent}
                          aria-label={`Select generated background variation ${idx + 1}`}
                          onClick={() => onSelectBackground(item.id)}
                          className={cn(
                            "bg-background group relative size-16 overflow-hidden rounded-md border-2 transition-all",
                            isCurrent
                              ? "border-primary ring-primary/20 ring-2"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.visual.dataUrl}
                            alt={`Background variation ${idx + 1}`}
                            className="size-full object-cover"
                          />
                          {isCurrent && (
                            <span className="bg-primary text-primary-foreground shadow-xs absolute right-1 top-1 flex size-4 items-center justify-center rounded-full">
                              <IconCheck className="size-2.5" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
              <div className="bg-primary/10 text-primary mb-3 flex size-12 items-center justify-center rounded-full">
                <IconPhoto className="size-6" />
              </div>
              <h3 className="text-base font-semibold">
                Ready to Generate Background Visual
              </h3>
              <p className="text-muted-foreground mt-1 max-w-md text-xs">
                Stability AI will generate a text-free background scene at{" "}
                <span className="text-foreground font-medium">
                  {stabilityAspectRatio}
                </span>{" "}
                aspect ratio matching your prompt above.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={onGenerateVisual}
                disabled={isGeneratingVisual}
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 gap-2 shadow-sm"
              >
                <IconSparkles className="size-4 text-amber-400" />
                Generate Background with Stability AI
              </Button>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPrevStep}
              disabled={isGeneratingVisual}
            >
              <IconArrowLeft className="mr-1.5 size-3.5" />
              Back to Ad Copy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onNextStep}
              disabled={isGeneratingVisual}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-sm"
            >
              Continue to Composition & Export
              <IconArrowRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
