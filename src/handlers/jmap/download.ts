import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { withAuth, jsonResponseHeaders } from "../../lib/auth"
import { StatusCodes } from "http-status-codes"
import { download } from "../../lib/jmap/blob/download"
import { Id } from "../../lib/jmap/types"
import { RequestError, requestErrors, ProblemDetails } from "../../lib/jmap/errors"

export const downloadHandler = withAuth(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    const accountId = event.pathParameters?.accountId as Id
    const blobId = event.pathParameters?.blobId as Id
    const name = event.pathParameters?.name
    const type = event.queryStringParameters?.type

    if (!accountId || !blobId || !name || !type) {
      const requestError: RequestError = {
        type: requestErrors.notRequest,
        status: StatusCodes.BAD_REQUEST,
        detail: "Missing required parameters",
      }
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify(requestError),
      }
    }

    try {
      const data = await download(accountId, blobId)

      return {
        statusCode: StatusCodes.OK,
        headers: {
          ...jsonResponseHeaders(event),
          "Content-Type": type,
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "private, immutable, max-age=31536000",
        },
        body: data.toString("base64"),
        isBase64Encoded: true,
      }
    } catch (error) {
      return {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify(error as ProblemDetails),
      }
    }
  }
)
