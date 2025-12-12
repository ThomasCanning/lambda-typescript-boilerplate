/**
 * RFC 7807 Problem Details for HTTP APIs
 * Standard format for API error responses
 */
export interface ProblemDetails {
  type: string
  status: number
  detail: string
  title?: string
}

export function isProblemDetails(obj: unknown): obj is ProblemDetails {
  if (typeof obj !== "object" || obj === null) return false
  const e = obj as Record<string, unknown>
  return typeof e.type === "string" && typeof e.status === "number" && typeof e.detail === "string"
}

export async function parseProblemDetails(response: Response): Promise<ProblemDetails> {
  const data = (await response.json()) as ProblemDetails
  if (!isProblemDetails(data)) {
    throw new Error(`Expected ProblemDetails but got: ${JSON.stringify(data)}`)
  }
  return data
}
