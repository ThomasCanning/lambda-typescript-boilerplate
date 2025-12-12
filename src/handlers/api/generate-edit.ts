import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { jsonResponseHeaders } from "../../lib/auth"
import { createProblemDetails, errorTypes } from "../../lib/errors"
import { startEdit } from "../../lib/api/generate-edit"

/*
 * Initiates a website edit job for an existing website generation.
 *
 * @param event - The API Gateway event containing the JSON body with 'prompt' and pathParameters with 'jobId'.
 * @returns A promise that resolves to the API Gateway response with 202 Accepted.
 */
export const generateEditHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    // Extract jobId from path parameters
    const jobId = event.pathParameters?.jobId
    const body = JSON.parse(event.body || "{}")

    if (!jobId) {
      throw new Error("JobId is required in path parameters")
    }

    // Send message to SQS queue
    // Body parsing is handled by startEdit
    await startEdit(jobId, body.prompt)
    return {
      statusCode: StatusCodes.ACCEPTED,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify({ success: true }),
    }
  } catch (error) {
    console.error("[generate-edit] request failed", error)
    const isError = error instanceof Error
    const detail = isError ? error.message : "Unknown error occurred"
    const statusCode =
      isError && /prompt|body|jobId|invalid/i.test(detail)
        ? StatusCodes.BAD_REQUEST
        : StatusCodes.INTERNAL_SERVER_ERROR

    return {
      statusCode,
      headers: jsonResponseHeaders(event, true),
      body: JSON.stringify(
        createProblemDetails({
          type:
            statusCode === StatusCodes.BAD_REQUEST
              ? errorTypes.badRequest
              : errorTypes.internalServerError,
          status: statusCode,
          title: "Generation edit failed",
          detail,
        })
      ),
    }
  }
}
