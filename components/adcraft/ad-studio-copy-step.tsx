"use client"

import React, { FC, useState } from "react"
import { GeneratedAdCopy, AD_FORMATS } from "@/types/adcraft"
import {
  AdStudioConfig,
  EditableAdCopy
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
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconInfoCircle,
  IconLoader2,
  IconRefresh,
  IconSparkles,
  IconWand
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

export interface AdStudioCopyStepProps {
  workspaceId: string
  config: AdStudioConfig
  generatedCopy: GeneratedAdCopy | null
  editableCopy: EditableAdCopy
  isGeneratingCopy: boolean
  copyGenerationError: string | null
  isCopyStale: boolean
  onCopyFieldChange: (field: keyof EditableAdCopy, value: string) => void
  onSelectHeadlineAlternative: (headline: string) => void
  onSelectCopyAlternative: (primaryText: string) => void
  onGenerateCopy: () => Promise<boolean>
  onPrevStep: () => void
  onNextStep: () => void
}

export const AdStudioCopyStep: FC<AdStudioCopyStepProps> = ({
  workspaceId,
  config,
  generatedCopy,
  editableCopy,
  isGeneratingCopy,
  copyGenerationError,
  isCopyStale,
  onCopyFieldChange,
  onSelectHeadlineAlternative,
  onSelectCopyAlternative,
  onGenerateCopy,
  onPrevStep,
  onNextStep
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const currentFormat = AD_FORMATS[config.format]

  const handleCopyText = (fieldName: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => {
      setCopiedField(null)
    }, 2000)
  }

  // ---------------------------------------------------------------------------
  // STATE A: Currently Generating (Loading State)
  // ---------------------------------------------------------------------------
  if (isGeneratingCopy) {
    return (
      <Card className="border-primary/20 shadow-xs">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconLoader2 className="size-7 animate-spin" />
          </div>
          <CardTitle className="text-xl">Crafting Advertising Copy with Gemini</CardTitle>
          <CardDescription>
            Analyzing your product details, target audience, and platform tone to write high-converting copy and visual prompts...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="bg-muted/40 rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconSparkles className="size-4 text-amber-500 shrink-0" />
              <span>Applying {config.tone} tone for {config.platform} ({currentFormat.label})</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconWand className="size-4 text-blue-500 shrink-0" />
              <span>Synthesizing headline, body, CTA and visual diffusion prompt</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconCheck className="size-4 text-green-500 shrink-0" />
              <span>Validating schema length constraints and text integrity</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground italic">
              This usually takes 2–5 seconds depending on connection speed.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // STATE B: Copy Not Yet Generated
  // ---------------------------------------------------------------------------
  if (!generatedCopy) {
    return (
      <Card className="border-border shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              Step 2 of 4
            </Badge>
            <Button variant="ghost" size="sm" onClick={onPrevStep}>
              <IconArrowLeft className="mr-1.5 size-3.5" />
              Back to Configuration
            </Button>
          </div>
          <CardTitle className="mt-2 text-xl">
            Generate AI Advertising Copy
          </CardTitle>
          <CardDescription>
            AdCraft AI connects to Google Gemini to transform your Step 1 product configuration into multi-channel ad copy, headline variations, and Stability AI diffusion prompts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Error Banner if Previous Generation Failed */}
          {copyGenerationError && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
              <IconAlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Copy Generation Error</p>
                <p className="mt-0.5 text-muted-foreground">{copyGenerationError}</p>
              </div>
            </div>
          )}

          {/* Configuration Summary Card */}
          <div className="bg-muted/30 rounded-lg border p-4">
            <p className="text-xs font-semibold text-foreground">
              Parameters Configured in Step 1:
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-muted-foreground">Product Name: </span>
                <span className="font-medium text-foreground">{config.productName || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Platform: </span>
                <span className="font-medium text-foreground capitalize">{config.platform}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tone: </span>
                <span className="font-medium text-foreground capitalize">{config.tone}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Format: </span>
                <span className="font-medium text-foreground">{currentFormat.label} ({currentFormat.aspectRatio})</span>
              </div>
              {config.brandName && (
                <div>
                  <span className="text-muted-foreground">Brand: </span>
                  <span className="font-medium text-foreground">{config.brandName}</span>
                </div>
              )}
              {config.targetAudience && (
                <div>
                  <span className="text-muted-foreground">Target Audience: </span>
                  <span className="font-medium text-foreground">{config.targetAudience}</span>
                </div>
              )}
              {config.price && (
                <div>
                  <span className="text-muted-foreground">Price: </span>
                  <span className="font-medium text-foreground">{config.price}</span>
                </div>
              )}
              {config.offer && (
                <div>
                  <span className="text-muted-foreground">Offer: </span>
                  <span className="font-medium text-foreground">{config.offer}</span>
                </div>
              )}
              {config.productFeatures && config.productFeatures.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Key Features: </span>
                  <span className="font-medium text-foreground">{config.productFeatures.join(", ")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Trigger Card */}
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <IconSparkles className="size-6 text-amber-500" />
            </div>
            <h3 className="text-base font-semibold">Ready to Generate Advertising Copy</h3>
            <p className="text-muted-foreground mt-1 max-w-md text-xs">
              Gemini will generate an engaging headline, body copy, description, call to action, and background generation prompt optimized for {config.platform}.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={onPrevStep}>
                <IconArrowLeft className="mr-1.5 size-3.5" />
                Edit Settings
              </Button>
              <Button
                size="sm"
                onClick={onGenerateCopy}
                className="gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <IconSparkles className="size-4 text-amber-400" />
                Generate Ad Copy with Gemini
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // STATE C: Copy Generated & Editable
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Stale Warning Banner if Step 1 Config Changed */}
      {isCopyStale && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <IconAlertTriangle className="size-4 shrink-0" />
            <span>
              Configuration parameters were modified in Step 1. Your generated copy may not reflect recent changes.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerateCopy}
            className="h-7 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <IconRefresh className="mr-1.5 size-3" />
            Regenerate
          </Button>
        </div>
      )}

      {/* Error Banner if Step 2 Validation / Action Failed */}
      {copyGenerationError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
          <IconAlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Notice</p>
            <p className="mt-0.5 text-muted-foreground">{copyGenerationError}</p>
          </div>
        </div>
      )}

      {/* Main Copy Review & Editing Card */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Step 2 of 4
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs font-normal">
                <IconCheck className="size-3 text-green-500" />
                Generated with Gemini
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onGenerateCopy}
                className="h-8 text-xs gap-1.5"
              >
                <IconRefresh className="size-3.5" />
                Regenerate Copy
              </Button>
            </div>
          </div>
          <CardTitle className="mt-2 text-xl">Review & Refine Advertising Copy</CardTitle>
          <CardDescription>
            Fine-tune the AI-generated copy and visual direction. All fields update the creative preview frame in real time.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Field 1: Headline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="copy-headline" className="text-xs font-semibold">
                Headline <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px]",
                  editableCopy.headline.length > 150 ? "text-destructive font-semibold" : "text-muted-foreground"
                )}>
                  {editableCopy.headline.length}/150
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={() => handleCopyText("headline", editableCopy.headline)}
                  title="Copy headline"
                >
                  {copiedField === "headline" ? (
                    <IconCheck className="size-3 text-green-500" />
                  ) : (
                    <IconCopy className="size-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <Input
              id="copy-headline"
              value={editableCopy.headline}
              onChange={(e) => onCopyFieldChange("headline", e.target.value)}
              placeholder="Catchy advertising headline..."
              maxLength={150}
              className="text-sm font-medium"
            />

            {/* Headline Alternatives Chips */}
            {generatedCopy.headlineAlternatives && generatedCopy.headlineAlternatives.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Alternative Headlines (click to apply):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {generatedCopy.headlineAlternatives.map((alt, idx) => {
                    const isSelected = editableCopy.headline === alt
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onSelectHeadlineAlternative(alt)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-left text-xs transition-colors",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        {isSelected && <IconCheck className="mr-1 inline size-3" />}
                        {alt}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Field 2: Primary Text (Body) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="copy-primaryText" className="text-xs font-semibold">
                Primary Text (Body Copy) <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px]",
                  editableCopy.primaryText.length > 600 ? "text-destructive font-semibold" : "text-muted-foreground"
                )}>
                  {editableCopy.primaryText.length}/600
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={() => handleCopyText("primaryText", editableCopy.primaryText)}
                  title="Copy primary text"
                >
                  {copiedField === "primaryText" ? (
                    <IconCheck className="size-3 text-green-500" />
                  ) : (
                    <IconCopy className="size-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <TextareaAutosize
              value={editableCopy.primaryText}
              onValueChange={(val) => onCopyFieldChange("primaryText", val)}
              placeholder="Persuasive advertising body text..."
              minRows={3}
              maxRows={6}
              maxLength={600}
              className="text-sm"
            />

            {/* Copy Alternatives Chips */}
            {generatedCopy.copyAlternatives && generatedCopy.copyAlternatives.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Alternative Copy Variations (click to apply):
                </p>
                <div className="space-y-1.5">
                  {generatedCopy.copyAlternatives.map((alt, idx) => {
                    const isSelected = editableCopy.primaryText === alt
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onSelectCopyAlternative(alt)}
                        className={cn(
                          "w-full rounded-md border p-2 text-left text-xs transition-colors",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        {isSelected && <IconCheck className="mr-1.5 inline size-3" />}
                        {alt}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Field 3: Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="copy-description" className="text-xs font-semibold">
                Description (Subtext / Feature Hook) <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px]",
                  editableCopy.description.length > 350 ? "text-destructive font-semibold" : "text-muted-foreground"
                )}>
                  {editableCopy.description.length}/350
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={() => handleCopyText("description", editableCopy.description)}
                  title="Copy description"
                >
                  {copiedField === "description" ? (
                    <IconCheck className="size-3 text-green-500" />
                  ) : (
                    <IconCopy className="size-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <TextareaAutosize
              value={editableCopy.description}
              onValueChange={(val) => onCopyFieldChange("description", val)}
              placeholder="Short supporting description or product hook..."
              minRows={2}
              maxRows={4}
              maxLength={350}
              className="text-sm"
            />
          </div>

          {/* Field 4: Call to Action (CTA) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="copy-callToAction" className="text-xs font-semibold">
                Call to Action (Button Text) <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px]",
                  editableCopy.callToAction.length > 60 ? "text-destructive font-semibold" : "text-muted-foreground"
                )}>
                  {editableCopy.callToAction.length}/60
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={() => handleCopyText("callToAction", editableCopy.callToAction)}
                  title="Copy CTA"
                >
                  {copiedField === "callToAction" ? (
                    <IconCheck className="size-3 text-green-500" />
                  ) : (
                    <IconCopy className="size-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <Input
              id="copy-callToAction"
              value={editableCopy.callToAction}
              onChange={(e) => onCopyFieldChange("callToAction", e.target.value)}
              placeholder="e.g. Shop Now, Claim Offer, Discover More..."
              maxLength={60}
              className="text-sm"
            />
          </div>

          {/* Field 5: Background Generation Prompt (Stability AI Handoff) */}
          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconWand className="size-4 text-primary" />
                <Label htmlFor="copy-backgroundPrompt" className="text-xs font-semibold text-foreground">
                  AI Background Prompt (Stability AI Diffusion) <span className="text-destructive">*</span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px]",
                  editableCopy.backgroundPrompt.length > 700 ? "text-destructive font-semibold" : "text-muted-foreground"
                )}>
                  {editableCopy.backgroundPrompt.length}/700
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={() => handleCopyText("backgroundPrompt", editableCopy.backgroundPrompt)}
                  title="Copy background prompt"
                >
                  {copiedField === "backgroundPrompt" ? (
                    <IconCheck className="size-3 text-green-500" />
                  ) : (
                    <IconCopy className="size-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <TextareaAutosize
              value={editableCopy.backgroundPrompt}
              onValueChange={(val) => onCopyFieldChange("backgroundPrompt", val)}
              placeholder="Detailed visual prompt describing the scene, lighting, texture, and aesthetic for background generation..."
              minRows={3}
              maxRows={6}
              maxLength={700}
              className="text-sm bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              This prompt will be fed to Stability AI in Step 3 to generate the commercial background image. You can adjust lighting, composition environment, or textures here.
            </p>
          </div>

          {/* Visual Direction & Layout Guidance (Read-Only) */}
          <div className="bg-muted/30 rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <IconInfoCircle className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground">
                AI Creative Guidance & Suggestions
              </p>
            </div>
            {generatedCopy.visualDirection && (
              <div>
                <span className="text-[11px] font-medium text-muted-foreground">Visual Direction: </span>
                <p className="mt-0.5 text-xs text-foreground/90">{generatedCopy.visualDirection}</p>
              </div>
            )}
            {generatedCopy.suggestedLayout && (
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                {generatedCopy.suggestedLayout.textPlacement && (
                  <div>
                    <span className="text-muted-foreground">Text Placement: </span>
                    <span className="font-medium capitalize text-foreground">
                      {generatedCopy.suggestedLayout.textPlacement}
                    </span>
                  </div>
                )}
                {generatedCopy.suggestedLayout.productPlacement && (
                  <div>
                    <span className="text-muted-foreground">Product Placement: </span>
                    <span className="font-medium capitalize text-foreground">
                      {generatedCopy.suggestedLayout.productPlacement}
                    </span>
                  </div>
                )}
                {generatedCopy.suggestedLayout.colorPaletteSuggestion && generatedCopy.suggestedLayout.colorPaletteSuggestion.length > 0 && (
                  <div className="col-span-2 mt-1">
                    <span className="text-muted-foreground">Suggested Palette: </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {generatedCopy.suggestedLayout.colorPaletteSuggestion.map((color: string, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono shadow-2xs"
                        >
                          <span
                            className="size-2.5 rounded-full border border-black/10"
                            style={{ backgroundColor: color }}
                          />
                          <span>{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="ghost" size="sm" onClick={onPrevStep}>
              <IconArrowLeft className="mr-1.5 size-3.5" />
              Back to Configuration
            </Button>
            <Button
              size="sm"
              onClick={onNextStep}
              className="gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Continue to Background Generation
              <IconArrowRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
