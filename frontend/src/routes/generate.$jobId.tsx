import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { getGenerateStatus, postGenerateChoices } from "@/lib/api/http/generate"
import type { GenerateStatusResponse } from "@/lib/api/http/generate"

export const Route = createFileRoute("/generate/$jobId")({
  component: GeneratePage,
})

type PaletteOption = {
  id: string
  label: string
  primary: string
  secondary: string
  background: string
  text: string
  accent: string
}

type CopyOption = {
  id: string
  label: string
  headline: string
  bio: string
}

type StyleOption = {
  id: string
  label: string
  layout_description?: string
  html_preview_snippet?: string
  css_variables?: Record<string, string>
}

function GeneratePage() {
  const { jobId } = Route.useParams()
  const [jobStatus, setJobStatus] = useState<GenerateStatusResponse | null>(null)
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null)
  const [selectedCopyId, setSelectedCopyId] = useState<string | null>(null)
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)

  // Delay skeleton appearance by 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(true), 4000)
    return () => clearTimeout(timer)
  }, [])

  // Poll for status updates
  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const status = await getGenerateStatus(jobId)
        setJobStatus(status)

        // Stop polling if complete or failed
        if (status.status === "succeeded" || status.status === "failed") {
          return
        }
      } catch (error) {
        console.error("Failed to poll status", error)
      }
    }

    void poll()
    const interval = setInterval(() => void poll(), 1500)

    return () => clearInterval(interval)
  }, [jobId])

  const partials = jobStatus?.partials ?? {}
  const draftHtml = typeof partials.draftHtml === "string" ? partials.draftHtml : undefined
  const finalHtml = typeof partials.finalHtml === "string" ? partials.finalHtml : undefined

  const getOptions = <T extends { id: string }>(value: unknown): T[] | undefined => {
    if (!value) return undefined
    if (Array.isArray(value)) {
      const filtered = value.filter(
        (opt): opt is T => typeof opt === "object" && opt !== null && "id" in opt
      )
      return filtered.length > 0 ? filtered : undefined
    }
    if (typeof value === "object" && value !== null) {
      const maybe = (value as { options?: unknown }).options
      if (Array.isArray(maybe)) {
        const filtered = maybe.filter(
          (opt): opt is T => typeof opt === "object" && opt !== null && "id" in opt
        )
        return filtered.length > 0 ? filtered : undefined
      }
    }
    return undefined
  }

  const colorOptions = getOptions<PaletteOption>(partials.colorOptions)
  const copyOptions = getOptions<CopyOption>(partials.copyOptions)
  const styleOptions = getOptions<StyleOption>(partials.styleOptions)

  const awaitingStyle = jobStatus?.status === "awaiting_style"
  const isComplete = jobStatus?.status === "succeeded"
  const isFailed = jobStatus?.status === "failed"

  // Get stored choices to determine what's already been selected
  const storedChoices = jobStatus?.choices || jobStatus?.partials?.choices || {}
  const hasStoredPalette = !!storedChoices.selectedPaletteId
  const hasStoredCopy = !!storedChoices.selectedCopyId
  const hasStoredStyle = !!storedChoices.selectedStyleId

  // Use stored choices or local state
  const effectivePaletteId = selectedPaletteId || storedChoices.selectedPaletteId || undefined

  const handlePaletteSubmit = async () => {
    if (!selectedPaletteId || !jobId || isSubmitting) return
    setIsSubmitting(true)
    try {
      // Artifical delay for "injection" feeling
      await new Promise((resolve) => setTimeout(resolve, 1000))

      await postGenerateChoices(jobId, {
        selectedPaletteId,
      })
      // Clear local state after successful submission
      setSelectedPaletteId(null)
    } catch (error) {
      console.error("Failed to submit palette", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopySubmit = async () => {
    console.log("[handleCopySubmit] Called", { selectedCopyId, jobId, isSubmitting })
    if (!selectedCopyId || !jobId || isSubmitting) {
      console.log("[handleCopySubmit] Early return", { selectedCopyId, jobId, isSubmitting })
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        selectedPaletteId: effectivePaletteId,
        selectedCopyId,
      }
      console.log("[handleCopySubmit] Submitting", payload)
      await postGenerateChoices(jobId, payload)
      // Clear local state after successful submission
      setSelectedCopyId(null)
    } catch (error) {
      console.error("[handleCopySubmit] Failed to submit choices", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStyleSubmit = async () => {
    console.log("[handleStyleSubmit] Called", { selectedStyleId, jobId, isSubmitting })
    if (!selectedStyleId || !jobId || isSubmitting) {
      console.log("[handleStyleSubmit] Early return", { selectedStyleId, jobId, isSubmitting })
      return
    }
    setIsSubmitting(true)
    try {
      const currentStatus = jobStatus || (await getGenerateStatus(jobId))
      const storedChoices = currentStatus.choices || currentStatus.partials?.choices || {}
      const payload = {
        selectedPaletteId: storedChoices.selectedPaletteId || effectivePaletteId,
        selectedCopyId: storedChoices.selectedCopyId || selectedCopyId || undefined,
        selectedStyleId,
      }
      console.log("[handleStyleSubmit] Submitting", payload)
      await postGenerateChoices(jobId, payload)
      // Clear local state after successful submission
      setSelectedStyleId(null)
    } catch (error) {
      console.error("[handleStyleSubmit] Failed to submit style", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Final result page
  if (isComplete && finalHtml) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 bg-background/70 backdrop-blur-xs border-b">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold">Your Website</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([finalHtml], { type: "text/html" })
                  const url = URL.createObjectURL(blob)
                  window.open(url, "_blank")
                }}
              >
                Open in New Tab
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([finalHtml], { type: "text/html" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = "index.html"
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                }}
              >
                Download HTML
              </Button>
            </div>
          </div>
        </div>
        <iframe
          srcDoc={finalHtml}
          className="w-full"
          style={{ height: "calc(100vh - 4rem)" }}
          title="Generated Website"
        />
      </div>
    )
  }

  // Show error state
  if (isFailed) {
    return (
      <DecisionLayout
        title="Generation Failed"
        backgroundHtml={draftHtml || (showSkeleton ? getSkeletonHtml() : undefined)}
      >
        <div className="text-center">
          <p className="text-destructive mb-4">{jobStatus?.error || "An error occurred"}</p>
          <Button onClick={() => (window.location.href = "/")}>Go Back</Button>
        </div>
      </DecisionLayout>
    )
  }

  // Color palette decision (first decision, one at a time)
  // Only show if status is "awaiting_choices" and palette is not yet stored
  if (
    jobStatus?.status === "awaiting_choices" &&
    colorOptions &&
    colorOptions.length > 0 &&
    !hasStoredPalette
  ) {
    return (
      <DecisionLayout
        title="Choose Your Color Palette"
        backgroundHtml={draftHtml || (showSkeleton ? getSkeletonHtml() : undefined)}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {colorOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedPaletteId(option.id)}
              className={`rounded-xl border-2 p-6 transition-all hover:scale-105 ${
                selectedPaletteId === option.id
                  ? "border-primary ring-4 ring-primary ring-offset-2"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="text-lg font-semibold mb-4">{option.label}</div>
              <div className="flex gap-2 h-24 rounded-lg overflow-hidden shadow-lg">
                <div
                  className="flex-1"
                  style={{ backgroundColor: option.primary }}
                  title="Primary"
                />
                <div
                  className="flex-1"
                  style={{ backgroundColor: option.secondary }}
                  title="Secondary"
                />
                <div
                  className="flex-1"
                  style={{ backgroundColor: option.background }}
                  title="Background"
                />
                <div className="flex-1" style={{ backgroundColor: option.text }} title="Text" />
                <div className="flex-1" style={{ backgroundColor: option.accent }} title="Accent" />
              </div>
            </button>
          ))}
        </div>
        <div className="mt-8">
          <Button
            onClick={() => void handlePaletteSubmit()}
            disabled={isSubmitting || !selectedPaletteId}
            size="lg"
          >
            {isSubmitting ? "Continuing..." : "Continue"}
          </Button>
        </div>
      </DecisionLayout>
    )
  }

  // Copy decision (second decision, one at a time)
  // Only show if:
  // 1. Status is "awaiting_choices" (not "running" or "awaiting_style")
  // 2. Copy options are available
  // 3. Palette is stored but copy is not
  // 4. Style is not stored (if style is stored, we're past this step)
  if (
    (jobStatus?.status === "awaiting_choices" ||
      jobStatus?.status === "running" ||
      jobStatus?.status === "awaiting_style") &&
    copyOptions &&
    copyOptions.length > 0 &&
    hasStoredPalette &&
    !hasStoredCopy
  ) {
    return (
      <DecisionLayout
        title="Choose Your Copy Tone"
        backgroundHtml={
          draftHtml ||
          (showSkeleton
            ? getSkeletonHtml(
                effectivePaletteId && colorOptions
                  ? colorOptions.find((c) => c.id === effectivePaletteId)
                  : undefined
              )
            : undefined)
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {copyOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedCopyId(option.id)}
              className={`rounded-xl border-2 p-6 text-left transition-all hover:scale-[1.02] ${
                selectedCopyId === option.id
                  ? "border-primary ring-4 ring-primary ring-offset-2"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-semibold text-lg mb-2">{option.label}</div>
              <div className="text-sm text-muted-foreground mb-3 font-medium">
                {option.headline}
              </div>
              <div className="text-sm leading-relaxed">{option.bio}</div>
            </button>
          ))}
        </div>
        <div className="mt-8">
          <Button
            onClick={() => void handleCopySubmit()}
            disabled={isSubmitting || !selectedCopyId}
            size="lg"
          >
            {isSubmitting ? "Continuing..." : "Continue"}
          </Button>
        </div>
      </DecisionLayout>
    )
  }

  // Style decision (third decision)
  // Show style selection if:
  // 1. Status is "awaiting_style" (explicitly waiting for style selection)
  // 2. Style is NOT already stored (to prevent showing it again after submission)
  // 3. Style options are available
  // Note: If status is "running" and style is stored, we're in final build phase - show loading instead
  const shouldShowStyle =
    !hasStoredStyle && awaitingStyle && styleOptions && styleOptions.length > 0

  // Debug logging
  if (jobStatus) {
    console.log("[GeneratePage] Render state", {
      status: jobStatus.status,
      awaitingStyle,
      hasStoredPalette,
      hasStoredCopy,
      hasStoredStyle,
      styleOptionsLength: styleOptions?.length,
      shouldShowStyle,
      selectedStyleId,
    })
  }

  if (shouldShowStyle) {
    return (
      <DecisionLayout
        title="Choose Your Style"
        backgroundHtml={
          draftHtml ||
          (showSkeleton
            ? getSkeletonHtml(
                effectivePaletteId && colorOptions
                  ? colorOptions.find((c) => c.id === effectivePaletteId)
                  : undefined
              )
            : undefined)
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {styleOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedStyleId(option.id)}
              className={`rounded-xl border-2 p-6 text-left transition-all hover:scale-[1.02] ${
                selectedStyleId === option.id
                  ? "border-primary ring-4 ring-primary ring-offset-2"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-semibold text-lg mb-2">{option.label}</div>
              {option.layout_description && (
                <div className="text-sm text-muted-foreground mb-4">
                  {option.layout_description}
                </div>
              )}
              {option.html_preview_snippet && (
                <div className="border rounded-lg overflow-hidden shadow-sm">
                  <iframe
                    srcDoc={option.html_preview_snippet}
                    className="w-full h-40 border-0"
                    title={`${option.label} preview`}
                  />
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="mt-8">
          <Button
            onClick={() => void handleStyleSubmit()}
            disabled={isSubmitting || !selectedStyleId}
            size="lg"
          >
            {isSubmitting ? "Finalizing..." : "Continue"}
          </Button>
        </div>
      </DecisionLayout>
    )
  }

  // Loading state
  return (
    <DecisionLayout
      title={jobStatus?.progressMessage || "Generating your website..."}
      backgroundHtml={
        draftHtml ||
        finalHtml ||
        (showSkeleton
          ? getSkeletonHtml(
              effectivePaletteId && colorOptions
                ? colorOptions.find((c) => c.id === effectivePaletteId)
                : undefined
            )
          : undefined)
      }
    >
      <div className="flex flex-col items-center gap-6">
        <Spinner size="lg" />
        <p className="text-muted-foreground text-lg">
          {jobStatus?.currentStep || "Initializing..."}
        </p>
      </div>
    </DecisionLayout>
  )
}

function DecisionLayout({
  children,
  title,
  backgroundHtml,
}: {
  children: React.ReactNode
  title: string
  backgroundHtml?: string
}) {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background website preview (blurred) */}
      {backgroundHtml && (
        <div className="absolute inset-0 opacity-50 blur-xs pointer-events-none overflow-hidden">
          <iframe
            srcDoc={backgroundHtml}
            className="w-full h-full border-0 scale-150"
            title="Background preview"
          />
        </div>
      )}

      {/* Decision overlay */}
      <div className="relative z-10 bg-background/40 backdrop-blur-xl rounded-2xl border shadow-2xl p-8 md:p-12 max-w-6xl w-full">
        <h2 className="text-3xl font-bold text-center mb-12">{title}</h2>
        <div className="flex flex-col items-center">{children}</div>
      </div>
    </div>
  )
}

const getSkeletonHtml = (colors?: { primary: string; secondary: string; background: string }) => {
  const bgClass = colors ? "" : "bg-gray-50"
  const primaryStyle = colors ? `background-color: ${colors.primary};` : ""
  const secondaryStyle = colors ? `background-color: ${colors.secondary};` : ""
  // If colors are provided, we use the palette background. Otherwise default gray.
  const bodyStyle = colors ? `background-color: ${colors.background};` : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skeleton</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="${bgClass} min-h-screen flex flex-col items-center justify-center p-8 font-sans" style="${bodyStyle}">
    <div class="max-w-4xl w-full space-y-8 animate-pulse">
        <div class="flex flex-col items-center space-y-4">
             <div class="h-32 w-32 rounded-full bg-gray-200" style="${secondaryStyle}"></div>
             <div class="h-8 w-48 bg-gray-200 rounded" style="${primaryStyle}"></div>
             <div class="h-4 w-64 bg-gray-200 rounded" style="${secondaryStyle}"></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <div class="h-64 bg-gray-200 rounded-xl" style="${secondaryStyle}"></div>
            <div class="h-64 bg-gray-200 rounded-xl" style="${secondaryStyle}"></div>
            <div class="h-64 bg-gray-200 rounded-xl" style="${secondaryStyle}"></div>
            <div class="h-64 bg-gray-200 rounded-xl" style="${secondaryStyle}"></div>
        </div>
    </div>
</body>
</html>`
}
