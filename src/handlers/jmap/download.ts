import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { withAuth, jsonResponseHeaders } from "../../lib/auth"
import { StatusCodes } from "http-status-codes"
import { upload } from "../../lib/jmap/blob/upload"
import { Id } from "../../lib/jmap/types"
import { requestErrors } from "../../lib/jmap/errors"

export const uploadHandler = withAuth(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    const accountId = event.pathParameters?.accountId as Id

    if (!accountId) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify({
          type: requestErrors.notRequest,
          status: StatusCodes.BAD_REQUEST,
          detail: "Missing accountId path parameter",
        }),
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

    try {
      const blobResponse = await upload(accountId, contentType, data)

      return {
        statusCode: StatusCodes.CREATED, // or 200 OK
        headers: jsonResponseHeaders(event),
        body: JSON.stringify(blobResponse),
      }
    } catch (error) {
      console.error("Blob upload failed", error)
      return {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify({
          type: "serverError",
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          detail: "Could not persist blob data",
        }),
      }
    }
  }
)
