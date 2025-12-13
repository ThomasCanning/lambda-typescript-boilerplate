import { authFetch } from "../../shared/http/authFetch"
import type { ProblemDetails } from "../../shared/utils/error-handling"

export type FetchSiteResponse = {
  html?: string
  source?: "generate" | "user"
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

export type EditResponse = {
  jobId?: string
  message?: string
  error?: ProblemDetails
}

export async function submitEdit(data: {
  screenshot?: string
  prompt?: string
  jobId?: string
}): Promise<EditResponse> {
  const path = data.jobId ? `/api/edit/${data.jobId}` : `/api/edit`
  const response = await authFetch(path, {
    method: "POST",
    body: JSON.stringify(data),
  })

  const resData: unknown = await response.json()

  if (!response.ok) {
    return { error: resData as ProblemDetails }
  }

  return resData as EditResponse
}
