import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import {
  authenticateRequest,
  handleAuthError,
  setAuthCookies,
  jsonResponseHeaders,
} from "../../lib/auth"

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const result = await authenticateRequest(event)

  if (!result.ok) {
    return handleAuthError(event, result)
  }

  const cookieHeaders = setAuthCookies(result.bearerToken, result.refreshToken)
  return {
    statusCode: StatusCodes.OK,
    headers: jsonResponseHeaders(event),
    cookies: cookieHeaders,
    body: JSON.stringify({ success: true }),
  }
}
