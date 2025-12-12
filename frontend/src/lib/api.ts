export interface GenerateJobStatus {
  jobId: string
  status: "pending" | "running" | "awaiting_choices" | "awating_style" | "succeeded" | "failed"
  currentStep?: string
  progressMessage?: string
  updatedAt: string
  result?: {
    text?: string
  }
  partials?: {
    finalHtml?: string
  }
  agentStates?: {
    color?: string
    copy?: string
    senior?: string
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL

export async function getJobStatus(jobId: string): Promise<GenerateJobStatus> {
  const response = await fetch(`${API_BASE_URL}/api/generate/status/${jobId}`)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json() as Promise<GenerateJobStatus>
}

export async function sendEditCommand(jobId: string, prompt: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/generate/edit/${jobId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
}
