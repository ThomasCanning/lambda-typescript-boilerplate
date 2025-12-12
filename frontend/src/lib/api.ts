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

export async function streamChat(
  jobId: string,
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  // Cast to unknown first to avoid "unsafe assignment" of any, then to specific shape
  const env = import.meta.env as unknown as { VITE_CHAT_FUNCTION_URL?: string }
  const chatUrl = env.VITE_CHAT_FUNCTION_URL
  if (!chatUrl) {
    console.warn("VITE_CHAT_FUNCTION_URL not set, falling back to mock stream")
    // Mock stream for dev
    const mockResponse =
      "This is a mock response because the function URL is not set. I would usually update the website now."
    for (const char of mockResponse) {
      onChunk(char)
      await new Promise((r) => setTimeout(r, 20))
    }
    return
  }

  const response = await fetch(`${chatUrl}/${jobId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  })

  if (!response.ok) {
    // try to read error text
    const text = await response.text()
    throw new Error(`Chat error: ${response.status} ${text}`)
  }

  if (!response.body) return

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    onChunk(chunk)
  }
}
