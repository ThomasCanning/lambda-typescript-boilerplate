import { SQSClient, SendMessageCommand, SQSClientConfig } from "@aws-sdk/client-sqs"
import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb"
import { GenerateJobStatus } from "./generate-status"

interface ChoicesPayload {
  selectedPaletteId?: string
  selectedCopyId?: string
  selectedStyleId?: string
}

function createDynamoClient(): DynamoDBDocumentClient {
  const config: DynamoDBClientConfig = {}
  if (process.env.AWS_REGION) config.region = process.env.AWS_REGION
  if (process.env.DDB_ENDPOINT) config.endpoint = process.env.DDB_ENDPOINT
  if (config.endpoint || process.env.IS_LOCAL_DEV === "true") {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
    }
  }
  return DynamoDBDocumentClient.from(new DynamoDBClient(config))
}

function createSqsClient(): SQSClient {
  const config: SQSClientConfig = {}
  if (process.env.AWS_REGION) config.region = process.env.AWS_REGION
  if (process.env.SQS_ENDPOINT) config.endpoint = process.env.SQS_ENDPOINT
  if (config.endpoint || process.env.IS_LOCAL_DEV === "true") {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
    }
  }
  return new SQSClient(config)
}

function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export async function submitGenerateChoices(
  jobId: string,
  choices: ChoicesPayload
): Promise<{ jobId: string; status: GenerateJobStatus }> {
  const tableName = getEnvVar("GENERATION_JOBS_TABLE")
  const queueUrl = getEnvVar("GENERATION_QUEUE_URL")
  const dynamoClient = createDynamoClient()
  const sqsClient = createSqsClient()

  if (!jobId) {
    throw new Error("jobId is required")
  }

  const existing = await dynamoClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { jobId },
    })
  )

  if (!existing.Item) {
    throw new Error("Job not found")
  }

  // Merge existing choices with new choices (don't overwrite)
  const existingChoices = (existing.Item.choices as ChoicesPayload | undefined) || {}
  const mergedChoices: ChoicesPayload = {
    ...existingChoices,
    ...choices, // New choices override existing ones
  }

  // Log for debugging
  console.log("[generate-choices] Choices merge:", {
    jobId,
    incoming: choices,
    existing: existingChoices,
    merged: mergedChoices,
  })

  // Validate merged choices (after merging, so we check the complete set)
  if (
    !mergedChoices.selectedPaletteId &&
    !mergedChoices.selectedCopyId &&
    !mergedChoices.selectedStyleId
  ) {
    console.error("[generate-choices] Validation failed - no selections:", mergedChoices)
    throw new Error("At least one selection is required")
  }

  // If submitting style, all three selections must be present
  if (choices.selectedStyleId) {
    if (
      !mergedChoices.selectedPaletteId ||
      !mergedChoices.selectedCopyId ||
      !mergedChoices.selectedStyleId
    ) {
      throw new Error("Palette, copy, and style selections are all required for final generation")
    }
  }
  // Otherwise, allow incremental submissions (just palette, just copy, or both)
  // No additional validation needed - the queue worker will handle the flow

  // Determine status based on what's being submitted
  // If palette is submitted, we go to "running" state to process color injection
  // If style is submitted, we go to "running" state to process final build
  const newStatus: GenerateJobStatus =
    choices.selectedPaletteId || choices.selectedStyleId ? "running" : "awaiting_choices"

  // Remove undefined values from choices before storing in DynamoDB
  // DynamoDB doesn't accept undefined values
  const cleanedChoices: ChoicesPayload = {}
  if (mergedChoices.selectedPaletteId) {
    cleanedChoices.selectedPaletteId = mergedChoices.selectedPaletteId
  }
  if (mergedChoices.selectedCopyId) {
    cleanedChoices.selectedCopyId = mergedChoices.selectedCopyId
  }
  if (mergedChoices.selectedStyleId) {
    cleanedChoices.selectedStyleId = mergedChoices.selectedStyleId
  }

  // Update status and store selections
  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt, #choices = :choices",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updatedAt": "updatedAt",
        "#choices": "choices",
      },
      ExpressionAttributeValues: {
        ":status": newStatus,
        ":updatedAt": new Date().toISOString(),
        ":choices": cleanedChoices,
      },
    })
  )

  // Send SQS message if we have a palette selection (to trigger color injection)
  // OR if we have a style selection (to trigger final build)
  // We trigger on palette selection even without copy, so the worker can generate the colored draft
  if (choices.selectedPaletteId || choices.selectedStyleId) {
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          jobId,
          selectedPaletteId: cleanedChoices.selectedPaletteId,
          selectedCopyId: cleanedChoices.selectedCopyId, // Might be undefined, which is fine
          selectedStyleId: cleanedChoices.selectedStyleId,
        }),
      })
    )
  }

  return { jobId, status: newStatus }
}
