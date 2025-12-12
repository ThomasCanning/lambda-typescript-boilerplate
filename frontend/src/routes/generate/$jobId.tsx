import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useGenerate } from "@/lib/api"
import { GenerateHeader } from "@/components/generate/header"
import { ScraperCard, BuilderCard, AgentsWorkingCard } from "@/components/generate/status-cards"
import {
  ColorChoiceCard,
  CopyChoiceCard,
  type ColorOptions,
  type CopyOptions,
} from "@/components/generate/choice-cards"

export const Route = createFileRoute("/generate/$jobId")({
  component: GeneratePage,
})

function GeneratePage() {
  const { jobId } = Route.useParams()
  const navigate = useNavigate()
  const { jobStatus, startPolling, setJobId, submitPaletteCopy } = useGenerate()
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null)
  const [selectedCopyId, setSelectedCopyId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (jobId) {
      setJobId(jobId)
      startPolling(jobId)
    }
  }, [jobId])

  useEffect(() => {
    if (jobStatus?.status === "succeeded" && jobStatus?.partials?.finalHtml) {
      void navigate({ to: "/edit/$jobId", params: { jobId } })
    }
  }, [jobStatus, navigate, jobId])

  const partials = jobStatus?.partials ?? {}
  const agentStates = jobStatus?.agentStates ?? {}
  const storedChoices = jobStatus?.choices ?? jobStatus?.partials?.choices ?? {}

  // Resolve choices (local or stored)
  const effectivePaletteId = storedChoices.selectedPaletteId || selectedPaletteId
  const effectiveCopyId = storedChoices.selectedCopyId || selectedCopyId

  const isComplete = jobStatus?.status === "succeeded"

  // -- Agent State Synthesis --
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
    activeCard = "color"
  } else if (isColorWaiting && !isColorDone) {
    activeCard = "color"
  } else if (isCopyWaiting && !isCopyDone) {
    activeCard = "copy"
  } else if (isColorThinking || isCopyThinking) {
    activeCard = "none"
  } else if (isBuilderRunning) {
    activeCard = "builder"
  }

  // Handlers
  const handlePaletteSelect = (id: string) => {
    setSelectedPaletteId(id)
  }

  const handleCopySelect = async (id: string) => {
    const paletteToSend = selectedPaletteId || storedChoices.selectedPaletteId
    if (!paletteToSend) {
      console.error("No palette selected")
      return
    }

    setSelectedCopyId(id)
    if (!jobId || isSubmitting) return
    setIsSubmitting(true)

    try {
      await submitPaletteCopy(paletteToSend, id)
    } catch (error) {
      console.error("Failed to submit choices", error)
      setIsSubmitting(false)
      setSelectedCopyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans flex flex-col">
      <GenerateHeader
        jobStatus={jobStatus}
        scraperStatus={isScraperDone ? "completed" : isScraperRunning ? "thinking" : "idle"}
        colorStatus={
          isColorDone
            ? "completed"
            : isColorWaiting
              ? "waiting"
              : isColorThinking
                ? "thinking"
                : "idle"
        }
        copyStatus={
          isCopyDone
            ? "completed"
            : isCopyWaiting
              ? "waiting"
              : isCopyThinking
                ? "thinking"
                : "idle"
        }
        builderStatus={isBuilderDone ? "completed" : isBuilderThinking ? "thinking" : "idle"}
      />

      <main className="flex-1 p-8 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
        {activeCard === "scraper" && <ScraperCard />}

        {activeCard === "none" && !isComplete && (isColorThinking || isCopyThinking) && (
          <AgentsWorkingCard />
        )}

        {activeCard === "color" && !!partials.colorOptions && (
          <ColorChoiceCard
            options={partials.colorOptions as ColorOptions}
            onSelect={handlePaletteSelect}
          />
        )}

        {activeCard === "copy" && !!partials.copyOptions && (
          <CopyChoiceCard
            options={partials.copyOptions as CopyOptions}
            onSelect={(id) => void handleCopySelect(id)}
          />
        )}

        {activeCard === "builder" && <BuilderCard />}
      </main>
    </div>
  )
}
