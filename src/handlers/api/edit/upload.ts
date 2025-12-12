import { APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { withAuth } from "../../../lib/auth"
import { jsonResponseHeaders } from "../../../lib/auth"
import { createProblemDetails, errorTypes, isProblemDetails } from "../../../lib/errors"
import { updateUserSubdomain } from "../../../lib/db/users"
import {
  isSubdomainAvailable,
  isValidSubdomainFormat,
} from "../../../lib/user-site-deployment/validation"

const s3Client = new S3Client({})

export const handler = withAuth(async (event, auth): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const user = auth.user
    if (!user) {
      throw createProblemDetails({
        type: errorTypes.internalServerError,
        status: StatusCodes.INTERNAL_SERVER_ERROR,
        title: "User Load Failed",
        detail: "Authenticated user data is missing",
      })
    }

    const indexHtml = user.websiteData?.indexHtml
    if (!indexHtml) {
      throw createProblemDetails({
        type: errorTypes.badRequest,
        status: StatusCodes.BAD_REQUEST,
        title: "No Website Data",
        detail: "You need to generate a website before editing/uploading.",
      })
    }

    let subdomain = user.subdomain
    let isNewSubdomain = false

    // If user doesn't have a subdomain, they MUST provide one
    if (!subdomain) {
      const body = event.body ? JSON.parse(event.body) : {}
      const requestedSubdomain = body.subdomain

      if (!requestedSubdomain) {
        throw createProblemDetails({
          type: errorTypes.badRequest,
          status: StatusCodes.BAD_REQUEST,
          title: "Subdomain Required",
          detail: "This is your first publish. Please provide a unique subdomain.",
        })
      }

      // Validate format
      if (!isValidSubdomainFormat(requestedSubdomain)) {
        throw createProblemDetails({
          type: errorTypes.badRequest,
          status: StatusCodes.BAD_REQUEST,
          title: "Invalid Subdomain",
          detail: "Subdomain must be 4-32 characters, lowercase alphanumeric or hyphen.",
        })
      }

      // Check availability (checks reserved subdomains and S3)
      const available = await isSubdomainAvailable(requestedSubdomain)
      if (!available) {
        throw createProblemDetails({
          type: errorTypes.conflict,
          status: StatusCodes.CONFLICT,
          title: "Subdomain Taken",
          detail: `The subdomain '${requestedSubdomain}' is already in use or reserved.`,
        })
      }

      // Reserve it in DB
      await updateUserSubdomain(user.userId, requestedSubdomain)
      subdomain = requestedSubdomain
      isNewSubdomain = true
    }

    // Upload to S3
    const bucket = process.env.USER_SITES_BUCKET
    if (!bucket) {
      // In dev, bucket might be empty - frontend should handle dev mode with blob download
      throw createProblemDetails({
        type: errorTypes.badRequest,
        status: StatusCodes.BAD_REQUEST,
        title: "Deployment Not Available",
        detail:
          "S3 bucket not configured. In development, use the frontend's blob download feature.",
      })
    }

    const s3Key = `${subdomain}/index.html`
    console.log(`[Upload] Uploading to Bucket: ${bucket}, Key: ${s3Key}`)
    console.log(`[Upload] HTML Content Length: ${indexHtml.length} bytes`)

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: indexHtml,
        ContentType: "text/html",
        CacheControl: "max-age=0, must-revalidate", // Ensure immediate updates
      })
    )

    const rootDomain = process.env.ROOT_DOMAIN || "example.com"
    const url = `https://${subdomain}.${rootDomain}`
    const directUrl = `https://${bucket}.s3.amazonaws.com/${s3Key}` // Debug URL

    console.log(`[Upload] Success. URL: ${url}, Direct: ${directUrl}`)

    return {
      statusCode: StatusCodes.OK,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify({
        success: true,
        url,
        subdomain,
        isNewSubdomain,
      }),
    }
  } catch (error) {
    if (isProblemDetails(error)) {
      return {
        statusCode: error.status,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(error),
      }
    }

    console.error("[upload] error", error)
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      headers: jsonResponseHeaders(event, true),
      body: JSON.stringify(
        createProblemDetails({
          type: errorTypes.internalServerError,
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          detail: "Upload failed",
          title: "Internal Server Error",
        })
      ),
    }
  }
})
