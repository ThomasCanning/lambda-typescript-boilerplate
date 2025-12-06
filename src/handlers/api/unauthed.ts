import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { jsonResponseHeaders } from "../../lib/auth"
import { StatusCodes } from "http-status-codes"
import { createProblemDetails, errorTypes } from "../../lib/errors"

export const unauthedHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
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
