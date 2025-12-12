import { parseProblemDetails } from "../../shared/utils/error-handling"
import { authFetch } from "../../shared/http/authFetch"

export interface User {
  userId: string
  subdomain?: string
  email?: string
  websiteData?: {
    indexHtml?: string
  }
}

export interface SignupRequest {
  username: string
  password: string
  jobId?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export async function getMe(): Promise<User | null> {
  try {
    const response = await authFetch("/api/authed", {
      method: "POST", // Matching handler definition
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as { user: User }
    return data.user
  } catch (err) {
    console.error("Failed to fetch user", err)
    return null
  }
}

export async function login(
  credentials: LoginRequest
): Promise<{ success: boolean; error?: string }> {
  const response = await authFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    const problem = await parseProblemDetails(response)
    return { success: false, error: problem.detail }
  }

  return { success: true }
}

export async function signup(pk: SignupRequest): Promise<{ success: boolean; error?: string }> {
  const response = await authFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify(pk),
  })

  if (!response.ok) {
    const problem = await parseProblemDetails(response)
    return { success: false, error: problem.detail }
  }

  return { success: true }
}
