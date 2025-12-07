/**
 * Checks if an error is a CORS (Cross-Origin Resource Sharing) error.
 * Distinguishes CORS errors from DNS/network errors.
 */
export function isCorsError(error: unknown): boolean {
  if (!(error instanceof TypeError || error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  const errorString = String(error).toLowerCase()

  const dnsNetworkErrors = [
    "err_name_not_resolved",
    "err_connection_refused",
    "err_network_changed",
    "err_internet_disconnected",
    "err_timed_out",
    "err_address_unreachable",
    "name_not_resolved",
    "connection_refused",
    "network_error",
    "net::err_name_not_resolved",
    "net::err_connection_refused",
  ]

  const fullErrorText = `${message} ${errorString}`
  for (const dnsError of dnsNetworkErrors) {
    if (fullErrorText.includes(dnsError)) {
      return false
    }
  }

  return message.includes("cors") || message.includes("cross-origin")
}

/**
 * Parses an HTTP error response into a user-friendly error message.
 * Attempts to extract error details from JSON response body, falls back to status text or raw text.
 */
export async function parseHttpError(response: Response): Promise<string> {
  const errorText = await response.text()
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`
  try {
    const errorJson = JSON.parse(errorText) as { error?: string }
    errorMessage = errorJson.error || errorMessage
  } catch {
    errorMessage = errorText || errorMessage
  }
  return errorMessage
}
