import { parseHttpError } from "../../shared/utils/error-handling"
import { authFetch } from "../../shared/http/authFetch"

export interface GenerateRequest {
  prompt: string
}

export interface GenerateResponse {
  text: string
  toolResults?: unknown[]
}

export async function postGenerate(request: GenerateRequest): Promise<GenerateResponse> {
  const response = await authFetch("/api/generate", {
    method: "POST",
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorMessage = await parseHttpError(response)
    throw new Error(errorMessage)
  }

  return response.json() as Promise<GenerateResponse>
}
