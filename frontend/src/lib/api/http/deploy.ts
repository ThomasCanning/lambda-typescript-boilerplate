import { authFetch } from "../../shared/http/authFetch"
import type { ProblemDetails } from "../../shared/utils/error-handling"

export type DeployResponse = {
  success: boolean
  url?: string
  subdomain?: string
  isNewSubdomain?: boolean
  error?: ProblemDetails
}

export async function deploySite(
  htmlContent?: string,
  subdomain?: string
): Promise<DeployResponse> {
  // In dev mode, just open the HTML as a blob
  if (import.meta.env.DEV) {
    if (!htmlContent) {
      return {
        success: false,
        error: { type: "error", status: 400, detail: "HTML content required for dev mode" },
      }
    }

    // Create blob and open in new tab
    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank")

    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    return { success: true, url }
  }

  // Prod mode: deploy to S3 via API
  const response = await authFetch("/api/edit/upload", {
    method: "POST",
    body: JSON.stringify({ subdomain }),
  })

  const data = (await response.json()) as DeployResponse | ProblemDetails

  if (!response.ok) {
    return { success: false, error: data as ProblemDetails }
  }

  return { ...(data as DeployResponse), success: true }
}
