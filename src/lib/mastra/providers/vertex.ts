import { createVertex } from "@ai-sdk/google-vertex"

let vertexInstance: ReturnType<typeof createVertex> | null = null

function getVertex() {
  if (vertexInstance) {
    return vertexInstance
  }

  const project = process.env.GOOGLE_VERTEX_PROJECT
  const location = process.env.GOOGLE_VERTEX_LOCATION
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON

  if (!project) {
    throw new Error("GOOGLE_VERTEX_PROJECT environment variable is required")
  }

  if (!location) {
    throw new Error("GOOGLE_VERTEX_LOCATION environment variable is required")
  }

  if (!credentialsJson) {
    throw new Error("GOOGLE_CREDENTIALS_JSON environment variable is required")
  }

  let credentials
  try {
    // Check if it looks like raw JSON (starts with '{')
    // If not, assume it's Base64 encoded (which is how we pass it from Makefile/CI)
    const toParse = credentialsJson.trim().startsWith("{")
      ? credentialsJson
      : Buffer.from(credentialsJson, "base64").toString("utf-8")

    credentials = JSON.parse(toParse)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error(`Credential parsing failed. Input length: ${credentialsJson?.length}`)
    console.error(`Input starts with: ${credentialsJson?.substring(0, 5)}...`)
    throw new Error(`Failed to parse Google credentials: ${errorMsg}`)
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
