import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { ReadableStream } from "node:stream/web"
import { jsonResponseHeaders } from "../../lib/auth"
import { createProblemDetails, errorTypes } from "../../lib/errors"
import { NotFoundError, getGenerateStatus } from "../../lib/api/generate-status"

const encoder = new TextEncoder()

function toEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
}

/**
 * Streams real-time status updates for a generation job using Server-Sent Events (SSE).
 *
 * @param event - The API Gateway event containing the 'jobId' in path parameters.
 * @returns An SSE stream response containing status updates.
 */
export const generateStreamHandler = async (event: APIGatewayProxyEventV2) => {
  const jobId = event.pathParameters?.jobId

  if (!jobId) {
    return {
      statusCode: 400,
      headers: jsonResponseHeaders(event, true),
      body: JSON.stringify(
        createProblemDetails({
          type: errorTypes.badRequest,
          status: 400,
          title: "Missing jobId",
          detail: "Path parameter 'jobId' is required",
        })
      ),
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(toEvent(payload)))

      try {
        let finished = false
        while (!finished) {
          const status = await getGenerateStatus(jobId)
          send(status)

          if (status.status === "succeeded" || status.status === "failed") {
            finished = true
            break
          }

          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        const message =
          error instanceof NotFoundError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unknown error"
        send({ error: message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGINS?.split(",")[0] ?? "*",
      "Access-Control-Allow-Credentials": "true",
    },
  }) as unknown as APIGatewayProxyStructuredResultV2
}
