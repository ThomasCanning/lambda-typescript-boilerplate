import { createVertex } from "@ai-sdk/google-vertex"

let vertexInstance: ReturnType<typeof createVertex> | null = null

function getVertex() {
  if (vertexInstance) {
    return vertexInstance
  }

  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON
  const project = process.env.GOOGLE_VERTEX_PROJECT
  const location = process.env.GOOGLE_VERTEX_LOCATION

  if (!credentialsJson) {
    throw new Error("GOOGLE_CREDENTIALS_JSON environment variable is required")
  }

  if (!project) {
    throw new Error("GOOGLE_VERTEX_PROJECT environment variable is required")
  }

  if (!location) {
    throw new Error("GOOGLE_VERTEX_LOCATION environment variable is required")
  }

  // Handle base64 encoded JSON (if stored that way to avoid CloudFormation parameter issues)
  let credentials
  try {
    // Try parsing as-is first
    credentials = JSON.parse(credentialsJson)
  } catch (error) {
    // If that fails, try base64 decoding first
    try {
      const decoded = Buffer.from(credentialsJson, "base64").toString("utf-8")
      credentials = JSON.parse(decoded)
    } catch (base64Error) {
      throw new Error(
        `Failed to parse GOOGLE_CREDENTIALS_JSON: ${error instanceof Error ? error.message : "Unknown error"}. Also tried base64 decode: ${base64Error instanceof Error ? base64Error.message : "Unknown error"}`
      )
    }
  }

  vertexInstance = createVertex({
    project,
    location,
    googleAuthOptions: {
      credentials,
    },
  })

  return vertexInstance
}

// Export as a function that returns the model provider function
// This allows lazy initialization - the vertex client is only created when actually called
export function vertex(modelName: string) {
  const instance = getVertex()
  return instance(modelName)
}
