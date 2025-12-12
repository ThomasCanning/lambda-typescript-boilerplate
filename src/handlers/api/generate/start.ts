import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { jsonResponseHeaders } from "../../../lib/auth"
import { createProblemDetails, errorTypes } from "../../../lib/errors"
import { startGenerate } from "../../../lib/api/generate/endpoints/start"

/*
 * Initiates a new website generation job based on a provided URL or prompt.
 *
 * @param event - The API Gateway event containing the JSON body with 'prompt'.
 * @returns A promise that resolves to the API Gateway response containing the new jobId.
 */
export const generateStartHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    // Body parsing is handled by startGenerate, but structured as GenerateStartInput
    const result = await startGenerate(event.body ?? null)

    return {
      statusCode: StatusCodes.ACCEPTED,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error("[generate-start] request failed", error)
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
          title: "Generation start failed",
          detail,
        })
      ),
    }
  }
}
