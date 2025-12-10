import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { jsonResponseHeaders } from "../../lib/auth"
import { createProblemDetails, errorTypes } from "../../lib/errors"
import { NotFoundError, getGenerateStatus } from "../../lib/api/generate-status"

/**
 * Retrieves the current status of a specific generation job.
 *
 * @param event - The API Gateway event containing the 'jobId' in path parameters.
 * @returns A promise that resolves to the API Gateway response containing the job status.
 */
export const generateStatusHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const jobId = event.pathParameters?.jobId

  if (!jobId) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      headers: jsonResponseHeaders(event, true),
      body: JSON.stringify(
        createProblemDetails({
          type: errorTypes.badRequest,
          status: StatusCodes.BAD_REQUEST,
          title: "Missing jobId",
          detail: "Path parameter 'jobId' is required",
        })
      ),
    }
  }

  try {
    const status = await getGenerateStatus(jobId)

    return {
      statusCode: StatusCodes.OK,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify(status),
    }
  } catch (error) {
    console.error("[generate-status] request failed", error)
    const isError = error instanceof Error
    const detail = isError ? error.message : "Unknown error occurred"

    if (error instanceof NotFoundError) {
      return {
        statusCode: StatusCodes.NOT_FOUND,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(
          createProblemDetails({
            type: errorTypes.notFound,
            status: StatusCodes.NOT_FOUND,
            title: "Job not found",
            detail,
          })
        ),
      }
    }

    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      headers: jsonResponseHeaders(event, true),
      body: JSON.stringify(
        createProblemDetails({
          type: errorTypes.internalServerError,
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          title: "Failed to fetch job status",
          detail,
        })
      ),
    }
  }
}
