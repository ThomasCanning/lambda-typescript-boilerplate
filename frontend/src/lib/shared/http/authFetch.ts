export async function authFetch(path: string, options?: RequestInit): Promise<Response> {
  const serverUrl = import.meta.env.DEV
    ? ""
    : import.meta.env.VITE_API_URL || "https://api.oneclickwebsite.ai"
  const url = `${serverUrl}${path.startsWith("/") ? path : `/${path}`}`

  const headers = new Headers(options?.headers)

  // Always set Accept header for JSON responses
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }

  // Automatically set Content-Type for requests with body (unless already set)
  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include", // Always include cookies for authentication
  })
}
