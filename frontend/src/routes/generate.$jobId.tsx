import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { useGenerate } from "@/lib/api/hooks/use-generate"
import { CheckCircle2, Palette, PenTool, Hammer, Search } from "lucide-react"

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

type ColorOptions = {
  options: PaletteOption[]
}

type CopyOptions = {
  options: CopyOption[]
}

function GeneratePage() {
  const navigate = useNavigate()
  const { jobId } = Route.useParams()
  const { jobStatus, startPolling, setJobId, submitPaletteCopy } = useGenerate() // Added submitPaletteCopy to destructure
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null)
  const [selectedCopyId, setSelectedCopyId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false) // Single submitting state

  useEffect(() => {
    if (jobId) {
      setJobId(jobId)
      void startPolling(jobId)
    }
  }, [jobId])

  const partials = jobStatus?.partials ?? {}
  const agentStates = jobStatus?.agentStates ?? {}
  const storedChoices = jobStatus?.choices ?? jobStatus?.partials?.choices ?? {}

  // Resolve choices (local or stored)
  const effectivePaletteId = storedChoices.selectedPaletteId || selectedPaletteId
  const effectiveCopyId = storedChoices.selectedCopyId || selectedCopyId

  const finalHtml = typeof partials.finalHtml === "string" ? partials.finalHtml : undefined
  const isComplete = jobStatus?.status === "succeeded"

  // -- Agent State Synthesis --
  // Scraper is "Running" if job is started but no profile data yet.
  // It is "Done" if profile data exists.
  // Scraper is "Done" if profile data exists OR if any downstream agent has started.
  const hasDownstreamActivity =
    agentStates.color === "thinking" ||
    agentStates.color === "waiting_for_user" ||
    agentStates.color === "completed" ||
    agentStates.copy === "thinking" ||
    agentStates.copy === "waiting_for_user" ||
    agentStates.copy === "completed" ||
    agentStates.senior === "thinking" ||
    agentStates.senior === "completed"

  const isScraperDone = !!partials.profileData || hasDownstreamActivity
  const isScraperRunning =
    !isScraperDone && (jobStatus?.status === "running" || jobStatus?.status === "pending")

  // Color Agent
  const isColorDone = !!effectivePaletteId
  const isColorThinking = agentStates.color === "thinking"
  const isColorWaiting = agentStates.color === "waiting_for_user" && !isColorDone

  // Copy Agent
  const isCopyDone = !!effectiveCopyId
  const isCopyThinking = agentStates.copy === "thinking"
  const isCopyWaiting = agentStates.copy === "waiting_for_user" && !isCopyDone

  // Builder Agent
  const isBuilderDone = isComplete
  const isBuilderThinking = agentStates.senior === "thinking"
  const isBuilderRunning = agentStates.senior === "thinking" || isBuilderDone

  // -- Priority Logic for Main Card --
  let activeCard: "scraper" | "color" | "copy" | "builder" | "none" = "none"

  if (isScraperRunning) {
    activeCard = "scraper"
  } else if (isColorWaiting && !isColorDone && isCopyWaiting && !isCopyDone) {
    // Tie-breaker: Color first
    activeCard = "color"
  } else if (isColorWaiting && !isColorDone) {
    activeCard = "color"
  } else if (isCopyWaiting && !isCopyDone) {
    activeCard = "copy"
  } else if (isColorThinking || isCopyThinking) {
    // If either is thinking, show a generic "Agents working" or specific?
    activeCard = "none"
  } else if (isBuilderRunning) {
    activeCard = "builder"
  }

  // Handlers
  const handlePaletteSelect = (id: string) => {
    setSelectedPaletteId(id)
    // Automatically move to next step? Or just let UI re-render.
    // Logic below handles "activeCard" strictly.
  }

  const handleCopySelect = async (id: string) => {
    // Determine the palette to send
    const paletteToSend = selectedPaletteId || storedChoices.selectedPaletteId

    if (!paletteToSend) {
      // Should not happen if flow works, but fail safe
      console.error("No palette selected")
      return
    }

    // Set local state
    setSelectedCopyId(id)

    // Submit BOTH
    if (!jobId || isSubmitting) return
    setIsSubmitting(true)

    try {
      await submitPaletteCopy(paletteToSend, id)
    } catch (error) {
      console.error("Failed to submit choices", error)
      setIsSubmitting(false)
      setSelectedCopyId(null) // Revert if failed
    }
  }

  // --- Render Logic ---

  if (isComplete && finalHtml) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Website Builder</h1>
            <div className="h-6 w-px bg-gray-200 mx-2" />
            <div className="flex gap-2">
              <AgentAvatar icon={Search} status="completed" label="Scraper" />
              <AgentAvatar icon={Palette} status="completed" label="Designer" />
              <AgentAvatar icon={PenTool} status="completed" label="Copywriter" />
              <AgentAvatar icon={Hammer} status="completed" label="Builder" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={() => {
                void navigate({ to: "/edit/$jobId", params: { jobId } })
              }}
            >
              Edit Website
            </Button>
            <Button
              variant="default"
              onClick={() => {
                const blob = new Blob([finalHtml], { type: "text/html" })
                const url = URL.createObjectURL(blob) // This URL resolves to a temporary, in-memory representation of the generated HTML.
                window.open(url, "_blank")
              }}
            >
              Open Full Site
            </Button>
          </div>
        </header>

        <div className="flex-1 bg-gray-50/50 p-6 overflow-hidden flex flex-col">
          <iframe
            srcDoc={finalHtml}
            className="w-full flex-1 rounded-xl shadow-lg border bg-white"
            title="Generated Website"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold tracking-tight">Website Builder</h1>

          <div className="flex items-center gap-4">
            <AgentAvatar
              icon={Search}
              status={isScraperDone ? "completed" : isScraperRunning ? "thinking" : "idle"}
              label="Scraper"
            />
            <div className="w-8 h-px bg-gray-200" />
            <AgentAvatar
              icon={Palette}
              status={
                isColorDone
                  ? "completed"
                  : isColorWaiting
                    ? "waiting"
                    : isColorThinking
                      ? "thinking"
                      : "idle"
              }
              label="Designer"
            />
            <div className="w-8 h-px bg-gray-200" />
            <AgentAvatar
              icon={PenTool}
              status={
                isCopyDone
                  ? "completed"
                  : isCopyWaiting
                    ? "waiting"
                    : isCopyThinking
                      ? "thinking"
                      : "idle"
              }
              label="Copywriter"
            />
            <div className="w-8 h-px bg-gray-200" />
            <AgentAvatar
              icon={Hammer}
              status={isBuilderDone ? "completed" : isBuilderThinking ? "thinking" : "idle"}
              label="Builder"
            />
          </div>
        </div>

        {/* Status Text */}
        <div className="text-sm text-muted-foreground animate-pulse">
          {jobStatus?.progressMessage || "Initialize..."}
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 p-8 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
        {activeCard === "scraper" && (
          <div className="text-center space-y-4">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center rounded-full bg-blue-50 border-4 border-blue-100 animate-pulse">
              <Search className="w-10 h-10 text-blue-500 animate-bounce" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Scanning Profile</h2>
              <p className="text-muted-foreground mt-2">Gathering insights from LinkedIn...</p>
            </div>
          </div>
        )}

        {activeCard === "none" && !isComplete && (
          <div className="text-center space-y-6">
            {/* If agents are thinking */}
            <div className="flex justify-center gap-8">
              {(isColorThinking || isCopyThinking) && (
                <div className="flex flex-col items-center gap-3">
                  <Spinner size="lg" />
                  <p className="text-lg font-medium text-muted-foreground">Agents are working...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeCard === "color" && !!partials.colorOptions && (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto bg-purple-100 rounded-2xl flex items-center justify-center mb-4 text-purple-600">
                <Palette className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold">Choose a Style</h2>
              <p className="text-lg text-muted-foreground">
                Select a color palette that matches your personal brand.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(partials.colorOptions as ColorOptions).options.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => handlePaletteSelect(opt.id)}
                  className="group p-5 rounded-xl border-2 border-border hover:border-purple-500/50 hover:bg-purple-50/10 cursor-pointer transition-all bg-white shadow-sm hover:shadow-md"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-lg">{opt.label}</span>
                  </div>
                  <div className="flex h-12 rounded-lg overflow-hidden ring-1 ring-black/5">
                    <div className="flex-1" style={{ backgroundColor: opt.primary }} />
                    <div className="flex-1" style={{ backgroundColor: opt.secondary }} />
                    <div className="flex-1" style={{ backgroundColor: opt.background }} />
                    <div className="flex-1" style={{ backgroundColor: opt.text }} />
                    <div className="flex-1" style={{ backgroundColor: opt.accent }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeCard === "copy" && !!partials.copyOptions && (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-2xl flex items-center justify-center mb-4 text-green-600">
                <PenTool className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold">Refine Your Story</h2>
              <p className="text-lg text-muted-foreground">
                Choose the copy that best describes you.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {(partials.copyOptions as CopyOptions).options.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => void handleCopySelect(opt.id)}
                  className="group p-6 rounded-xl border-2 border-border hover:border-green-500/50 hover:bg-green-50/10 cursor-pointer transition-all bg-white shadow-sm hover:shadow-md text-left"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-lg text-foreground group-hover:text-green-700 transition-colors">
                      {opt.label}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <p className="text-base font-medium leading-normal text-foreground/90">
                      {opt.headline}
                    </p>
                    <p className="text-sm text-muted-foreground">{opt.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeCard === "builder" && (
          <div className="text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center rounded-full bg-orange-50 border-4 border-orange-100">
              <Hammer className="w-10 h-10 text-orange-500 animate-pulse" />
              <div className="absolute inset-0 border-t-4 border-orange-500 rounded-full animate-spin"></div>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Assembling Website</h2>
              <p className="text-muted-foreground mt-2">Putting it all together...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function AgentAvatar({
  icon: Icon,
  status,
  label,
}: {
  icon: React.ElementType
  status: "idle" | "thinking" | "waiting" | "completed"
  label: string
}) {
  const getStyles = () => {
    switch (status) {
      case "idle":
        return "bg-gray-100 text-gray-400 border-gray-200"
      case "thinking":
        return "bg-blue-50 text-blue-600 border-blue-200 animate-pulse ring-2 ring-blue-100"
      case "waiting":
        return "bg-amber-50 text-amber-600 border-amber-200 ring-2 ring-amber-100 bg-amber-50/50"
      case "completed":
        return "bg-green-50 text-green-600 border-green-200"
      default:
        return "bg-gray-100 text-gray-400"
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5 group">
      <div
        className={`
                 relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300
                 ${getStyles()}
             `}
      >
        <Icon className="w-5 h-5" />

        {/* Status Badge */}
        {status === "completed" && (
          <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border-2 border-white">
            <CheckCircle2 className="w-3 h-3" />
          </div>
        )}
        {status === "waiting" && (
          <div className="absolute -top-1 -right-1 bg-amber-500 w-3 h-3 rounded-full border-2 border-white animate-pulse" />
        )}
      </div>
      <span
        className={`text-[10px] font-semibold uppercase tracking-wider ${status === "idle" ? "text-gray-300" : "text-gray-600"}`}
      >
        {label}
      </span>
    </div>
  )
}
