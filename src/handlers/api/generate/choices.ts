import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { jsonResponseHeaders } from "../../../lib/auth"
import { createProblemDetails, errorTypes } from "../../../lib/errors"
import { submitGenerateChoices } from "../../../lib/api/generate/endpoints/choices"

interface GenerateChoicesInput {
  selectedPaletteId?: string
  selectedCopyId?: string
  selectedStyleId?: string
}

/**
 * Submits user choices (palette, copy, style) for an existing generation job.
 *
 * @param event - The API Gateway event containing the jobId in path parameters and choices in the body.
 * @returns A promise that resolves to the API Gateway response with the updated job status.
 */
export const generateChoicesHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
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

    if (!event.body) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(
          createProblemDetails({
            type: errorTypes.badRequest,
            status: StatusCodes.BAD_REQUEST,
            title: "Missing body",
            detail: "Request body is required",
          })
        ),
      }
    }

    const parsed = JSON.parse(event.body) as GenerateChoicesInput

    const result = await submitGenerateChoices(jobId, {
      selectedPaletteId: parsed.selectedPaletteId,
      selectedCopyId: parsed.selectedCopyId,
      selectedStyleId: parsed.selectedStyleId,
    })

    return {
      statusCode: StatusCodes.ACCEPTED,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error("[generate-choices] request failed", error)
    const isError = error instanceof Error
    const detail = isError ? error.message : "Unknown error occurred"
    const statusCode =
      isError && /job|choice|body|palette|copy|missing/i.test(detail)
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
          title: "Generation choices failed",
          detail,
        })
      ),
    }
  }
}
