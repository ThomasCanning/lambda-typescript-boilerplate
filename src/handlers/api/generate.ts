import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { jsonResponseHeaders } from "../../lib/auth"
import { StatusCodes } from "http-status-codes"
import { createProblemDetails, errorTypes } from "../../lib/errors"
import { generate } from "../../lib/api/generate"
/**
 * Handles synchronous generation requests.
 *
 * @param event - The API Gateway event containing the generation parameters (prompt) in the body.
 * @returns A promise that resolves to the API Gateway response with the generation result.
 */
export const generateHandler = async (
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

  try {
    const result = await generate(event.body)

    return {
      statusCode: StatusCodes.OK,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify(result),
    }
  } catch (error) {
    const isError = error instanceof Error
    const title = isError ? `Generation failed: ${error.name}` : "Generation failed"
    const detail = isError ? error.message : "Unknown error occurred"

    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      headers: jsonResponseHeaders(event, true),
      body: JSON.stringify(
        createProblemDetails({
          type: errorTypes.internalServerError,
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          title,
          detail,
        })
      ),
    }
  }
}
