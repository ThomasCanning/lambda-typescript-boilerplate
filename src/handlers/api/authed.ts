import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { jsonResponseHeaders } from "../../lib/auth"
import { StatusCodes } from "http-status-codes"
import { createProblemDetails, errorTypes } from "../../lib/errors"
import { withAuth } from "../../lib/auth"

/**
 * Validates authentication token and returns a success message if valid.
 *
 * @param event - The API Gateway event containing the request details.
 * @returns A promise that resolves to the API Gateway response.
 */
export const authedHandler = withAuth(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    if (!event.body) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(
          createProblemDetails({
            type: errorTypes.badRequest,
            status: StatusCodes.BAD_REQUEST,
            title: "Missing request body",
            detail: "Event body is required",
          })
        ),
      }
    }

    return {
      statusCode: StatusCodes.OK,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify({
        message: "Hello, world!",
      }),
    }
  }
)
