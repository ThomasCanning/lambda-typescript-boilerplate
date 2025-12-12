import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { jsonResponseHeaders } from "../../lib/auth"
import { StatusCodes } from "http-status-codes"
import { withAuth } from "../../lib/auth"

/**
 * Validates authentication token and returns a success message if valid.
 *
 * @param event - The API Gateway event containing the request details.
 * @returns A promise that resolves to the API Gateway response.
 */
export const authedHandler = withAuth(
  async (event: APIGatewayProxyEventV2, auth): Promise<APIGatewayProxyStructuredResultV2> => {
    return {
      statusCode: StatusCodes.OK,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify({
        user: auth.user,
      }),
    }
  }
)
