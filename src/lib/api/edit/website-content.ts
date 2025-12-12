import { APIGatewayProxyEventV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { createProblemDetails, errorTypes } from "../../errors"
import { getGenerateStatus } from "../generate/endpoints/status"
import { verifyBearerFromEvent } from "../../auth/verification"
import { getUser } from "../../db/users"

export interface WebsiteContent {
  html: string | undefined
  source: "generate" | "user"
}

export async function fetchWebsiteContent(event: APIGatewayProxyEventV2): Promise<WebsiteContent> {
  const jobId = event.pathParameters?.jobId

  if (jobId) {
    // 1. Fetch from generate table
    const status = await getGenerateStatus(jobId)

    return {
      html: status.partials?.finalHtml,
      source: "generate",
    }
  } else {
    // 2. Fetch from user object (requires auth)
    const clientId = process.env.USER_POOL_CLIENT_ID
    if (!clientId) {
      throw createProblemDetails({
        type: errorTypes.internalServerError,
        status: StatusCodes.INTERNAL_SERVER_ERROR,
        detail: "Server misconfiguration. (USER_POOL_CLIENT_ID missing)",
        title: "Internal Server Error",
      })
    }

    const auth = await verifyBearerFromEvent(event, clientId)
    const user = await getUser(auth.username)

    if (!user) {
      throw createProblemDetails({
        type: errorTypes.notFound,
        status: StatusCodes.NOT_FOUND,
        detail: "User not found",
        title: "Not Found",
      })
    }

    return {
      html: user.websiteData?.indexHtml,
      source: "user",
    }
  }
}
