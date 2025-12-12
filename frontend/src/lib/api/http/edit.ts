import { authFetch } from "../../shared/http/authFetch"
import type { ProblemDetails } from "../../shared/utils/error-handling"

export type FetchSiteResponse = {
  html?: string
  source?: "generate" | "user"
  error?: ProblemDetails
}

export type SaveSiteResponse = {
  success: boolean
  error?: ProblemDetails
}

export async function fetchSite(jobId?: string): Promise<FetchSiteResponse> {
  const path = jobId ? `/api/edit/${jobId}` : `/api/edit`
  const response = await authFetch(path)

  const data: unknown = await response.json()

  if (!response.ok) {
    return { error: data as ProblemDetails }
  }

  return data as FetchSiteResponse
}

export async function saveSite(prompt: string, jobId?: string): Promise<SaveSiteResponse> {
  const path = jobId ? `/api/edit/${jobId}` : `/api/edit`
  const response = await authFetch(path, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  })

  const data: unknown = await response.json()

  if (!response.ok) {
    return { success: false, error: data as ProblemDetails }
  }

  return data as SaveSiteResponse
}
