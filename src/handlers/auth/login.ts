import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { authenticateRequest, setAuthCookies, jsonResponseHeaders } from "../../lib/auth"
import { createProblemDetails, errorTypes } from "../../lib/errors"

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const result = await authenticateRequest(event)

  if (!result.ok) {
    return {
      statusCode: StatusCodes.UNAUTHORIZED,
      headers: jsonResponseHeaders(event, true),
      body: JSON.stringify(
        createProblemDetails({
          type: errorTypes.unauthorized,
          status: StatusCodes.UNAUTHORIZED,
          detail: result.message,
          title: "Unauthorized",
        })
      ),
    }
  }

  const cookieHeaders = setAuthCookies(result.bearerToken, result.refreshToken)
  return {
    statusCode: StatusCodes.OK,
    headers: jsonResponseHeaders(event),
    cookies: cookieHeaders,
    body: JSON.stringify({ success: true }),
  }
}
