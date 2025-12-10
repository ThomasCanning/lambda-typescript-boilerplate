import { parseHttpError } from "../../shared/utils/error-handling"
import { authFetch } from "../../shared/http/authFetch"

export interface GenerateRequest {
  prompt: string
}

export type GenerateJobStatus =
  | "pending"
  | "running"
  | "awaiting_choices"
  | "awaiting_style"
  | "succeeded"
  | "failed"

export interface GenerateStartResponse {
  jobId: string
  status: GenerateJobStatus
}

export interface GenerateResult {
  text: string
  toolResults?: unknown[]
}

export interface GenerateStatusResponse {
  jobId: string
  status: GenerateJobStatus
  currentStep?: string
  progressMessage?: string
  agentStates?: {
    color?: "idle" | "thinking" | "waiting_for_user" | "completed"
    copy?: "idle" | "thinking" | "waiting_for_user" | "completed"
    senior?: "idle" | "thinking" | "completed"
  }
  updatedAt?: string
  result?: GenerateResult
  error?: string
  partials?: {
    profileData?: unknown
    colorOptions?: unknown
    copyOptions?: unknown
    finalHtml?: string
    choices?: {
      selectedPaletteId?: string
      selectedCopyId?: string
    }
  }
  choices?: {
    selectedPaletteId?: string
    selectedCopyId?: string
  }
}

export async function postGenerateStart(request: GenerateRequest): Promise<GenerateStartResponse> {
  const response = await authFetch("/api/generate/start", {
    method: "POST",
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorMessage = await parseHttpError(response)
    throw new Error(errorMessage)
  }

  return response.json() as Promise<GenerateStartResponse>
}

export async function getGenerateStatus(jobId: string): Promise<GenerateStatusResponse> {
  const response = await authFetch(`/api/generate/status/${jobId}`, {
    method: "GET",
  })

  if (!response.ok) {
    const errorMessage = await parseHttpError(response)
    throw new Error(errorMessage)
  }

  return response.json() as Promise<GenerateStatusResponse>
}

export async function postGenerateChoices(
  jobId: string,
  payload: {
    selectedPaletteId?: string
    selectedCopyId?: string
    selectedStyleId?: string
  }
): Promise<{ jobId: string; status: GenerateJobStatus }> {
  const response = await authFetch(`/api/generate/choices/${jobId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorMessage = await parseHttpError(response)
    throw new Error(errorMessage)
  }

  return response.json() as Promise<{ jobId: string; status: GenerateJobStatus }>
}
