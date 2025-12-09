import fs from "fs"
import { createVertex } from "@ai-sdk/google-vertex"

let vertexInstance: ReturnType<typeof createVertex> | null = null

function getVertex() {
  if (vertexInstance) {
    return vertexInstance
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const project = process.env.GOOGLE_VERTEX_PROJECT
  const location = process.env.GOOGLE_VERTEX_LOCATION

  if (!credentialsPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS environment variable is required")
  }

  if (!project) {
    throw new Error("GOOGLE_VERTEX_PROJECT environment variable is required")
  }

  if (!location) {
    throw new Error("GOOGLE_VERTEX_LOCATION environment variable is required")
  }

  // Read credentials from file
  let credentials
  try {
    // Check if the credentials path is set
    if (credentialsPath) {
      if (!fs.existsSync(credentialsPath) && process.env.GOOGLE_CREDENTIALS_JSON) {
        // If file doesn't exist but we have the JSON in env var, write it to /tmp
        // This handles Lambda environments where we can't easily copy files to /var/task
        const tmpPath = "/tmp/google-credentials.json"
        fs.writeFileSync(tmpPath, process.env.GOOGLE_CREDENTIALS_JSON, "utf8")
        // Update credentials path to use the tmp file
        const credentialsJson = fs.readFileSync(tmpPath, "utf8")
        credentials = JSON.parse(credentialsJson)
      } else {
        const credentialsJson = fs.readFileSync(credentialsPath, "utf8")
        credentials = JSON.parse(credentialsJson)
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to read Google credentials: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
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
