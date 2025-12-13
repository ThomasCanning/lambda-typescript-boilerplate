import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { jsonResponseHeaders } from "../../../lib/auth/headers"
import { createProblemDetails, errorTypes, isProblemDetails } from "../../../lib/errors"
import { getEditStatus } from "../../../lib/api/edit/endpoints/status"

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const jobId = event.pathParameters?.jobId

    if (!jobId) {
      throw createProblemDetails({
        type: errorTypes.badRequest,
        status: StatusCodes.BAD_REQUEST,
        detail: "Missing jobId",
        title: "Bad Request",
      })
    }

    const result = await getEditStatus(jobId)

    return {
      statusCode: StatusCodes.OK,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error("[edit-status] request failed", error)

    if (isProblemDetails(error)) {
      return {
        statusCode: error.status,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(error),
      }
    }

    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      headers: jsonResponseHeaders(event, true),
      body: JSON.stringify(
        createProblemDetails({
          type: errorTypes.internalServerError,
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          detail: error instanceof Error ? error.message : "Unknown error",
          title: "Internal Server Error",
        })
      ),
    }
  }
}
