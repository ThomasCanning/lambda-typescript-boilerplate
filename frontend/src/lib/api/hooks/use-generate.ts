import { useMutation } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import {
  getGenerateStatus,
  postGenerateStart,
  postGenerateChoices,
  type GenerateRequest,
  type GenerateResult,
  type GenerateStatusResponse,
} from "../http/generate"

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 120 // ~3 minutes

async function pollForResult(
  jobId: string,
  onStatus?: (status: GenerateStatusResponse) => void
): Promise<GenerateResult> {
  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    const status = await getGenerateStatus(jobId)

    onStatus?.(status)

    if (status.status === "succeeded" && status.result) {
      return status.result
    }

    if (status.status === "failed") {
      throw new Error(status.error ?? "Generation failed")
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  throw new Error("Generation is taking longer than expected. Please try again.")
}

export function useGenerate() {
  const [jobStatus, setJobStatus] = useState<GenerateStatusResponse | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const pollIntervalRef = useRef<number | undefined>(undefined)

  const startPolling = (jid: string) => {
    // Clear any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    const poll = async () => {
      try {
        const status = await getGenerateStatus(jid)
        setJobStatus(status)

        // Stop polling if job is complete
        if (status.status === "succeeded" || status.status === "failed") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = undefined
          }
        }
      } catch (error) {
        console.error("Failed to poll job status", error)
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = undefined
        }
      }
    }

    void poll()
    pollIntervalRef.current = window.setInterval(() => void poll(), POLL_INTERVAL_MS)
  }

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = undefined
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [])

  const mutation = useMutation<GenerateResult, Error, GenerateRequest>({
    mutationKey: ["generate"],
    mutationFn: async (request: GenerateRequest) => {
      setJobStatus(null)
      setJobId(null)
      stopPolling() // Stop any existing polling
      const { jobId } = await postGenerateStart(request)
      setJobId(jobId)
      startPolling(jobId)
      return { text: "" }
    },
  })

  const submitPaletteCopy = async (choices: {
    selectedPaletteId: string
    selectedCopyId: string
  }) => {
    if (!jobId) throw new Error("No active job")
    await postGenerateChoices(jobId, choices)
    // Polling already running will update status to awaiting_style
  }

  const submitStyle = async (selectedStyleId: string) => {
    if (!jobId) throw new Error("No active job")

    // Get the current job status to retrieve previously selected palette and copy
    const currentStatus = jobStatus || (await getGenerateStatus(jobId))
    // Check both top-level choices and partials.choices (for backwards compatibility)
    const storedChoices = currentStatus.choices || currentStatus.partials?.choices || {}

    // Include previously selected palette and copy along with the new style selection
    await postGenerateChoices(jobId, {
      selectedPaletteId: storedChoices.selectedPaletteId,
      selectedCopyId: storedChoices.selectedCopyId,
      selectedStyleId,
    })

    // Wait for completion using polling
    const result = await pollForResult(jobId, setJobStatus)
    return result
  }

  return {
    ...mutation,
    jobStatus,
    setJobId,
    startPolling,
    jobId,
    submitPaletteCopy,
    submitStyle,
  } as typeof mutation & {
    jobStatus: typeof jobStatus
    jobId: typeof jobId
    setJobId: typeof setJobId
    startPolling: typeof startPolling
    submitPaletteCopy: typeof submitPaletteCopy
    submitStyle: typeof submitStyle
  }
}
