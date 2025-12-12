import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { jsonResponseHeaders } from "../../../lib/auth/headers"
import { createProblemDetails, errorTypes, isProblemDetails } from "../../../lib/errors"
import { fetchWebsiteContent } from "../../../lib/api/edit/website-content"

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const result = await fetchWebsiteContent(event)

    return {
      statusCode: StatusCodes.OK,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error("[edit-get] request failed", error)

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
