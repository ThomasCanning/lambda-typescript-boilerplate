import { APIGatewayProxyEventV2 } from "aws-lambda"
import { mastra } from "../../lib/mastra"

declare const awslambda: {
  streamifyResponse: (
    handler: (
      event: APIGatewayProxyEventV2,
      responseStream: NodeJS.WritableStream,
      context: unknown
    ) => Promise<void>
  ) => unknown
}

export const chatHandler = awslambda.streamifyResponse(
  async (
    event: APIGatewayProxyEventV2,
    responseStream: NodeJS.WritableStream,
    _context: unknown
  ) => {
    try {
      // 2. Parse Input (Auth is implicit via jobId knowledge, mirroring generate-edit handler)
      // When using Function URLs directly, pathParameters might not be populated if no route is defined.
      let jobId = event.pathParameters?.jobId
      if (!jobId && event.rawPath) {
        // rawPath example: "/<jobId>"
        const parts = event.rawPath.split("/").filter((p) => p.trim().length > 0)
        if (parts.length > 0) {
          jobId = parts[parts.length - 1]
        }
      }
      const body = JSON.parse(event.body || "{}")
      const message = body.prompt

      if (!jobId || !message) {
        responseStream.write(JSON.stringify({ error: "Missing jobId or prompt" }))
        responseStream.end()
        return
      }

      const { getGenerateStatus } = await import("../../lib/api/generate-status")
      const status = await getGenerateStatus(jobId)
      const currentHtml = status.partials?.finalHtml || ""

      // Construct a prompt that gives the agent the context it needs
      const enrichedPrompt = `
Context:
Job ID: ${jobId}
Current HTML:
\`\`\`html
${currentHtml}
\`\`\`

User Request: "${message}"
`

      // 4. Get Agent
      const editorAgent = mastra.getAgent("editorAgent")

      // 5. Stream Response
      // resourceId maps to the jobId for memory persistence
      const stream = await editorAgent.stream(enrichedPrompt, {
        resourceId: jobId,
      })

      // Forward the Mastra stream to the Lambda response stream
      for await (const chunk of stream.textStream) {
        responseStream.write(chunk)
      }

      responseStream.end()
    } catch (error) {
      const e = error as { message?: string; detail?: unknown }
      console.error("Chat handler error:", error)
      // If we haven't started writing (which we might have), try to write error
      // But for streaming, effectively we just end the stream if it crashes mid-way.
      // If it crashes BEFORE writing, we write JSON error.
      try {
        responseStream.write(
          JSON.stringify({
            error: e.message || "Internal server error",
            details: e.detail, // if ProblemDetails
          })
        )
      } catch (_inner) {
        // ignore if stream closed
      }
      responseStream.end()
    }
  }
)
