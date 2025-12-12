import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { jsonResponseHeaders } from "../../lib/auth" // Adjust import path if needed (../../lib/auth/index.ts exports headers?)
import { createProblemDetails, errorTypes, isProblemDetails } from "../../lib/errors"
import { signUp } from "../../lib/auth/cognito"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"

interface SignupRequestBody {
  username: string
  password: string
  jobId?: string
}

function createDynamoClient() {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  })
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    if (!event.body) {
      throw createProblemDetails({
        type: errorTypes.badRequest,
        status: StatusCodes.BAD_REQUEST,
        title: "Missing body",
        detail: "Request body is required",
      })
    }

    const { username, password, jobId } = JSON.parse(event.body) as SignupRequestBody
    const userPoolClientId = process.env.USER_POOL_CLIENT_ID
    if (!userPoolClientId) throw new Error("Missing USER_POOL_CLIENT_ID")

    const usersTable = process.env.USERS_TABLE
    if (!usersTable) throw new Error("Missing USERS_TABLE")

    const generationJobsTable = process.env.GENERATION_JOBS_TABLE
    if (!generationJobsTable) throw new Error("Missing GENERATION_JOBS_TABLE")

    // 1. Sign up user in Cognito
    const { userSub } = await signUp(username, password, userPoolClientId)

    // 2. If jobId provided, try to migrate data from generation table
    if (jobId) {
      const dynamoClient = createDynamoClient()
      try {
        const jobResult = await dynamoClient.send(
          new GetCommand({
            TableName: generationJobsTable,
            Key: { jobId },
          })
        )

        const item = jobResult.Item
        if (item) {
          const partials = item.partials || {}
          const choices = item.choices || {}

          // Check if we have the necessary data to persist
          // "website data... index.html file, their color palette choice, and their copy choice"
          const finalHtml = partials.finalHtml
          const selectedPaletteId = choices.selectedPaletteId
          const selectedCopyId = choices.selectedCopyId

          // Only persist if we have the core generated asset (finalHtml)
          // and choices to reconstruct the state if needed.
          if (finalHtml && selectedPaletteId && selectedCopyId) {
            // Try to find the actual objects in partials.colorOptions / copyOptions
            // This is "nice to have" but if missing, we just store IDs?
            // The user said "store... their color palette choice".
            // Storing the ID might not be enough if the options are dynamic/AI generated and not static.
            // But they are in `partials.colorOptions` which is an object/array.

            let selectedPalette = null
            let selectedCopy = null

            if (partials.colorOptions?.options && Array.isArray(partials.colorOptions.options)) {
              selectedPalette = partials.colorOptions.options.find(
                (o: { id: string }) => o.id === selectedPaletteId
              )
            }
            if (partials.copyOptions?.options && Array.isArray(partials.copyOptions.options)) {
              selectedCopy = partials.copyOptions.options.find(
                (o: { id: string }) => o.id === selectedCopyId
              )
            }

            const websiteData = {
              indexHtml: finalHtml,
              palette: selectedPalette || { id: selectedPaletteId },
              copy: selectedCopy || { id: selectedCopyId },
              // Include profile data if available
              profileData: partials.profileData,
            }

            // Persist to UsersTable
            const now = new Date().toISOString()
            await dynamoClient.send(
              new PutCommand({
                TableName: usersTable,
                Item: {
                  userId: userSub,
                  email: username,
                  websiteData,
                  createdAt: now,
                  updatedAt: now,
                },
                // Prevent overwrite? Or allow? Assuming new user so overwrite is fine or doesn't matter.
              })
            )
            console.log(`[Signup] Migrated data for user ${userSub} from job ${jobId}`)
          } else {
            console.log(
              `[Signup] Job ${jobId} found but missing required data (finalHtml, palette, copy). Skipping migration.`
            )
          }
        } else {
          console.log(`[Signup] Job ${jobId} not found in generation table. Skipping migration.`)
        }
      } catch (migrationError) {
        // Don't fail the signup if migration fails, just log it.
        console.error(
          `[Signup] Data migration failed for user ${userSub} and job ${jobId}`,
          migrationError
        )
      }
    }

    return {
      statusCode: StatusCodes.CREATED,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify({ success: true, userId: userSub }),
    }
  } catch (error) {
    if (isProblemDetails(error)) {
      return {
        statusCode: error.status,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(error),
      }
    }

    console.error("[signup] error", error)
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      headers: jsonResponseHeaders(event, true),
      body: JSON.stringify(
        createProblemDetails({
          type: errorTypes.internalServerError,
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          detail: "Signup failed due to internal error",
          title: "Internal Server Error",
        })
      ),
    }
  }
}
