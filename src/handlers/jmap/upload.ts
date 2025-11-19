import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { withAuth, jsonResponseHeaders } from "../../lib/auth"
import { StatusCodes } from "http-status-codes"
import { upload } from "../../lib/jmap/blob/upload"
import { Id } from "../../lib/jmap/types"
import { RequestError, requestErrors } from "../../lib/jmap/errors"
import { capabilityJmapCore } from "../../lib/jmap/session"
import { ProblemDetails } from "../../lib/jmap/errors"

export const uploadHandler = withAuth(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    const accountId = event.pathParameters?.accountId as Id

    if (!accountId) {
      const requestError: RequestError = {
        type: requestErrors.notRequest,
        status: StatusCodes.BAD_REQUEST,
        detail: "Missing accountId path parameter",
      }
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify(requestError),
      }
    }

    const contentType = event.headers["content-type"] || "application/octet-stream"

    let data: Buffer
    if (event.isBase64Encoded && event.body) {
      data = Buffer.from(event.body, "base64")
    } else if (event.body) {
      data = Buffer.from(event.body, "utf-8")
    } else {
      data = Buffer.alloc(0)
    }

    if (data.length > capabilityJmapCore.maxSizeUpload) {
      const requestError: RequestError = {
        type: requestErrors.limit,
        status: StatusCodes.BAD_REQUEST,
        detail: "Data size exceeds the maximum allowed size",
        limit: "maxSizeUpload",
      }
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify(requestError),
      }
    }

    try {
      const blobResponse = await upload(accountId, contentType, data)

      return {
        statusCode: StatusCodes.CREATED,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify(blobResponse),
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
