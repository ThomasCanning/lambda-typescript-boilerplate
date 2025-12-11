import { createVertex } from "@ai-sdk/google-vertex"
import fs from "node:fs"
import path from "node:path"

let vertexInstance: ReturnType<typeof createVertex> | null = null

function getVertex(): ReturnType<typeof createVertex> {
  if (vertexInstance) {
    return vertexInstance
  }

  let credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON
  const project = process.env.GOOGLE_VERTEX_PROJECT
  const location = process.env.GOOGLE_VERTEX_LOCATION

  // Fallback to local file in development/local environment
  if (!credentialsJson) {
    try {
      const sensitivePath = path.join(process.cwd(), "google-credentials.json")
      if (fs.existsSync(sensitivePath)) {
        credentialsJson = fs.readFileSync(sensitivePath, "utf-8")
      }
    } catch (err) {
      console.warn("Failed to read google-credentials.json from disk", err)
    }
  }

  if (!project) {
    throw new Error("GOOGLE_VERTEX_PROJECT environment variable is required")
  }

  if (!location) {
    throw new Error("GOOGLE_VERTEX_LOCATION environment variable is required")
  }

  if (!credentialsJson) {
    throw new Error(
      "GOOGLE_CREDENTIALS_JSON environment variable or google-credentials.json file is required"
    )
  }

  let credentials
  try {
    // Check if it looks like raw JSON (starts with '{')
    // If not, assume it's Base64 encoded (which is how we pass it from Makefile/CI)
    const toParse = credentialsJson.trim().startsWith("{")
      ? credentialsJson
      : Buffer.from(credentialsJson, "base64").toString("utf-8")

    credentials = JSON.parse(toParse)

    // Fix for common issue where newlines in private_key are escaped literally as '\n'
    // or missing when loading from certain env var formats or copy-pastes
    if (credentials.private_key && typeof credentials.private_key === "string") {
      const pk = credentials.private_key
      // If the key doesn't contain actual newlines but contains literal "\n", replace them
      if (!pk.includes("\n") && pk.includes("\\n")) {
        credentials.private_key = pk.replace(/\\n/g, "\n")
      }
    }
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

  return vertexInstance!
}

// Export as a function that returns the model provider function
// This allows lazy initialization - the vertex client is only created when actually called
export function vertex(modelName: string) {
  const instance = getVertex()
  return instance(modelName)
}
