"use client"

import React, { FC, useContext } from "react"
import { useRouter } from "next/navigation"
import { ChatbotUIContext } from "@/context/context"
import { AD_FORMATS } from "@/types/adcraft"
import { useAdStudio } from "@/lib/adcraft/use-ad-studio"
import { AdStudioConfigStep } from "./ad-studio-config-step"
import { AdStudioCopyStep } from "./ad-studio-copy-step"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  IconArrowLeft,
  IconCheck,
  IconFileText,
  IconPhoto,
  IconPalette,
  IconSparkles,
  IconLayersIntersect
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

export interface AdStudioProps {
  workspaceId: string
}

export const AdStudio: FC<AdStudioProps> = ({ workspaceId }) => {
  const router = useRouter()
  const { selectedWorkspace } = useContext(ChatbotUIContext)

  const {
    currentStep,
    config,
    productImage,
    logoImage,
    validationErrors,
    generatedCopy,
    editableCopy,
    isGeneratingCopy,
    copyGenerationError,
    isCopyStale,
    handleConfigChange,
    handleProductImageSelect,
    handleProductImageRemove,
    handleLogoImageSelect,
    handleLogoImageRemove,
    handleGenerateCopy,
    handleCopyFieldChange,
    handleSelectHeadlineAlternative,
    handleSelectCopyAlternative,
    handleNextStep,
    handlePrevStep,
    goToStep
  } = useAdStudio()

  const currentFormat = AD_FORMATS[config.format]
  const isLandscape = config.format === "landscape"

  const steps = [
    {
      number: 1,
      title: "Configuration & Assets",
      description: "Product details, format & assets",
      icon: IconPalette,
      status: currentStep === 1 ? "current" : "completed"
    },
    {
      number: 2,
      title: "Ad Copy Generation",
      description: "Gemini structured copy & prompts",
      icon: IconFileText,
      status: currentStep === 2 ? "current" : generatedCopy ? "completed" : "pending",
      badge: generatedCopy ? (isCopyStale ? "Outdated" : "Generated") : undefined
    },
    {
      number: 3,
      title: "Background Generation",
      description: "Stability AI visual rendering",
      icon: IconPhoto,
      status: currentStep === 3 ? "current" : currentStep > 3 ? "completed" : "pending",
      badge: "Phase A4.3"
    },
    {
      number: 4,
      title: "Composition & Export",
      description: "Canvas rendering & creative export",
      icon: IconLayersIntersect,
      status: currentStep === 4 ? "current" : "pending",
      badge: "Phase A4.4"
    }
  ]

  return (
    <div className="flex size-full flex-col overflow-y-auto p-4 sm:p-6 lg:p-8">
      {/* Studio Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${workspaceId}/chat`)}
              className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
            >
              <IconArrowLeft className="mr-1.5 size-3.5" />
              Back to Chat
            </Button>
            <span className="text-muted-foreground text-xs">•</span>
            <span className="text-muted-foreground text-xs">
              {selectedWorkspace?.name || "Workspace"}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              AdCraft Advertisement Studio
            </h1>
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs font-medium">
              <IconSparkles className="size-3 text-amber-500" />
              AI Powered
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Create high-converting, export-ready advertisements with multi-model AI copy, visual generation, and canvas composition.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Format: {currentFormat.label}
          </Badge>
          <Badge variant="outline" className="text-xs capitalize">
            Platform: {config.platform}
          </Badge>
        </div>
      </div>

      {/* Stepper Header */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(step => {
          const Icon = step.icon
          const isCurrent = step.status === "current"
          const isCompleted = step.status === "completed"

          return (
            <div
              key={step.number}
              onClick={() => {
                if (step.number === 1 || isCompleted) {
                  goToStep(step.number)
                }
              }}
              className={cn(
                "relative flex items-center gap-3 rounded-lg border p-3 transition-colors",
                isCurrent && "border-primary bg-primary/5 shadow-sm",
                isCompleted && "border-border bg-muted/20 hover:border-primary/40 cursor-pointer",
                !isCurrent && !isCompleted && "border-border/60 bg-muted/10 opacity-70"
              )}
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isCurrent && "bg-primary text-primary-foreground",
                  isCompleted && "bg-primary/20 text-primary",
                  !isCurrent && !isCompleted && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <IconCheck className="size-4" /> : <Icon className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-semibold leading-none">{step.title}</p>
                  {step.badge && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
                      {step.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 truncate text-[11px]">
                  {step.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Main Studio Two-Column Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Active Step Content (7 cols) */}
        <div className="lg:col-span-7">
          {currentStep === 1 && (
            <AdStudioConfigStep
              config={config}
              productImage={productImage}
              logoImage={logoImage}
              validationErrors={validationErrors}
              onConfigChange={handleConfigChange}
              onProductImageSelect={handleProductImageSelect}
              onProductImageRemove={handleProductImageRemove}
              onLogoImageSelect={handleLogoImageSelect}
              onLogoImageRemove={handleLogoImageRemove}
              onContinue={handleNextStep}
            />
          )}

          {currentStep === 2 && (
            <AdStudioCopyStep
              workspaceId={workspaceId}
              config={config}
              generatedCopy={generatedCopy}
              editableCopy={editableCopy}
              isGeneratingCopy={isGeneratingCopy}
              copyGenerationError={copyGenerationError}
              isCopyStale={isCopyStale}
              onCopyFieldChange={handleCopyFieldChange}
              onSelectHeadlineAlternative={handleSelectHeadlineAlternative}
              onSelectCopyAlternative={handleSelectCopyAlternative}
              onGenerateCopy={() => handleGenerateCopy(workspaceId)}
              onPrevStep={handlePrevStep}
              onNextStep={handleNextStep}
            />
          )}

          {currentStep === 3 && (
            <Card className="border-dashed">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Upcoming Milestone</Badge>
                  <Button variant="ghost" size="sm" onClick={() => goToStep(1)}>
                    <IconArrowLeft className="mr-1 size-3.5" />
                    Back to Configuration
                  </Button>
                </div>
                <CardTitle className="mt-2 text-xl">
                  Step 3: Background Visual Generation
                </CardTitle>
                <CardDescription>
                  This milestone connects the AI background prompt generated by Gemini to Stability AI Ultra/Core to produce a high-resolution diffusion background visual.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs italic">
                  Note: Integrated visual generation will be wired in Phase A4.3.
                </p>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card className="border-dashed">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Upcoming Milestone</Badge>
                  <Button variant="ghost" size="sm" onClick={() => goToStep(1)}>
                    <IconArrowLeft className="mr-1 size-3.5" />
                    Back to Configuration
                  </Button>
                </div>
                <CardTitle className="mt-2 text-xl">
                  Step 4: Composition Engine & Export
                </CardTitle>
                <CardDescription>
                  This milestone renders the composed creative using the Phase A3 HTML5 Canvas engine, applying text styling, badge placement, and product layering for high-resolution PNG export.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs italic">
                  Note: Composition engine integration will be wired in Phase A4.4.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Live Creative Frame Preview (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-6 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Creative Preview Frame
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {currentFormat.aspectRatio}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {currentFormat.label} — {currentFormat.width} × {currentFormat.height} px
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Visual Canvas Mockup Frame */}
                <div className="bg-muted/40 relative flex w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed p-4">
                  <div
                    className={cn(
                      "bg-background relative flex w-full max-w-[340px] flex-col items-center justify-center overflow-hidden rounded-md border shadow-sm transition-all",
                      config.format === "square" && "aspect-square",
                      config.format === "portrait" && "aspect-[4/5]",
                      config.format === "story" && "aspect-[9/16]",
                      config.format === "landscape" && "aspect-[1.91/1]"
                    )}
                  >
                    {/* Background indicator */}
                    <div className="from-muted/20 via-background to-muted/40 absolute inset-0 bg-gradient-to-b" />

                    {/* Logo thumbnail in corner if present */}
                    {logoImage.dataUrl && (
                      <div className="bg-background/80 shadow-xs backdrop-blur-xs absolute left-3 top-3 z-10 flex size-9 items-center justify-center rounded border p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoImage.dataUrl}
                          alt="Logo"
                          className="size-full object-contain"
                        />
                      </div>
                    )}

                    {/* Offer badge if present */}
                    {config.offer && (
                      <div className="absolute right-3 top-3 z-10">
                        <Badge variant="destructive" className="text-[10px] font-bold">
                          {config.offer}
                        </Badge>
                      </div>
                    )}

                    {/* Product Image or Placeholder & Text Container */}
                    <div
                      className={cn(
                        "z-1 relative flex items-center justify-center text-center",
                        isLandscape
                          ? "w-full flex-row justify-around gap-3 px-4 py-3"
                          : "flex-col p-4"
                      )}
                    >
                      {productImage.dataUrl ? (
                        <div
                          className={cn(
                            "relative shrink-0 overflow-hidden rounded-md",
                            isLandscape ? "max-h-20 max-w-28" : "max-h-36 max-w-44"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={productImage.dataUrl}
                            alt="Product"
                            className="size-full object-contain drop-shadow-md"
                          />
                        </div>
                      ) : (
                        <div className="flex shrink-0 flex-col items-center">
                          <div
                            className={cn(
                              "bg-muted/60 flex items-center justify-center rounded-full",
                              isLandscape ? "mb-1 size-8" : "mb-2 size-12"
                            )}
                          >
                            <IconPhoto
                              className={cn(
                                "text-muted-foreground/60",
                                isLandscape ? "size-4" : "size-6"
                              )}
                            />
                          </div>
                          <p
                            className={cn(
                              "text-muted-foreground font-medium",
                              isLandscape ? "text-[10px]" : "text-xs"
                            )}
                          >
                            Product Image Placeholder
                          </p>
                          {!isLandscape && (
                            <p className="text-muted-foreground/75 mt-0.5 text-[10px]">
                              Upload an asset to preview placement
                            </p>
                          )}
                        </div>
                      )}

                      {/* Text & Badges Stack */}
                      <div
                        className={cn(
                          "flex flex-col",
                          isLandscape
                            ? "min-w-0 flex-1 items-start text-left"
                            : "items-center"
                        )}
                      >
                        {/* Product Name / Generated Headline Display */}
                        <p
                          className={cn(
                            "font-semibold",
                            isLandscape
                              ? "line-clamp-1 max-w-[140px] text-xs"
                              : "mt-3 line-clamp-2 max-w-[220px] text-xs"
                          )}
                        >
                          {editableCopy.headline || config.productName || "Product Title"}
                        </p>

                        {/* Description / Primary Text Snippet if present */}
                        {(editableCopy.description || editableCopy.primaryText) && (
                          <p
                            className={cn(
                              "text-muted-foreground line-clamp-2",
                              isLandscape
                                ? "mt-0.5 max-w-[140px] text-[9px]"
                                : "mt-1 max-w-[220px] text-[10px]"
                            )}
                          >
                            {editableCopy.description || editableCopy.primaryText}
                          </p>
                        )}

                        {/* Price tag if present */}
                        {config.price && (
                          <p
                            className={cn(
                              "text-primary font-bold",
                              isLandscape ? "text-[11px]" : "mt-1 text-xs"
                            )}
                          >
                            {config.price}
                          </p>
                        )}

                        {/* Call to action mockup */}
                        {(editableCopy.callToAction || config.callToAction) && (
                          <div
                            className={cn(
                              "bg-primary text-primary-foreground shadow-xs rounded font-semibold",
                              isLandscape
                                ? "mt-1 px-2 py-0.5 text-[9px]"
                                : "mt-2 px-2.5 py-1 text-[10px]"
                            )}
                          >
                            {editableCopy.callToAction || config.callToAction}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Platform & Tone Watermark */}
                    <div className="bg-background/80 text-muted-foreground backdrop-blur-xs absolute bottom-2 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px]">
                      <span className="capitalize">{config.platform}</span>
                      <span>•</span>
                      <span className="capitalize">{config.tone}</span>
                    </div>
                  </div>
                </div>

                {/* Preview Metadata */}
                <div className="bg-muted/20 mt-4 rounded-md border p-3 text-xs">
                  <div className="text-muted-foreground flex items-center justify-between">
                    <span>Target Resolution</span>
                    <span className="text-foreground font-mono font-medium">
                      {currentFormat.width} × {currentFormat.height} px
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1.5 flex items-center justify-between">
                    <span>Aspect Ratio</span>
                    <span className="text-foreground font-medium">
                      {currentFormat.aspectRatio}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1.5 flex items-center justify-between">
                    <span>Recommended Channels</span>
                    <span className="text-foreground font-medium">
                      {currentFormat.recommendedFor.join(", ")}
                    </span>
                  </div>
                  {generatedCopy && (
                    <div className="text-muted-foreground mt-1.5 flex items-center justify-between">
                      <span>AI Copy Status</span>
                      <span
                        className={cn(
                          "font-medium",
                          isCopyStale ? "text-amber-500" : "text-green-500"
                        )}
                      >
                        {isCopyStale ? "Outdated (Step 1 Modified)" : "Generated & Synced"}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
