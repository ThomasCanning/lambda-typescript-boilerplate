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

  // Merge existing choices with new choices for validation and status calculation
  // We still do this in memory to determine WHAT to write and verify correctness
  const existingChoices = (existing.Item.choices as ChoicesPayload | undefined) || {}
  const mergedChoices: ChoicesPayload = {
    ...existingChoices,
    ...choices,
  }

  // Validate merged choices
  if (
    !mergedChoices.selectedPaletteId &&
    !mergedChoices.selectedCopyId &&
    !mergedChoices.selectedStyleId
  ) {
    throw new Error("At least one selection is required")
  }

  // Strict validation for final submission
  if (choices.selectedStyleId) {
    if (
      !mergedChoices.selectedPaletteId ||
      !mergedChoices.selectedCopyId ||
      !mergedChoices.selectedStyleId
    ) {
      throw new Error("Palette, copy, and style selections are all required for final generation")
    }
  }

  const newStatus: GenerateJobStatus =
    choices.selectedPaletteId || choices.selectedStyleId || choices.selectedCopyId
      ? "running"
      : "awaiting_choices"

  // Prepare cleaned choices for SQS (remove undefineds)
  const cleanedChoices: ChoicesPayload = {}
  if (mergedChoices.selectedPaletteId)
    cleanedChoices.selectedPaletteId = mergedChoices.selectedPaletteId
  if (mergedChoices.selectedCopyId) cleanedChoices.selectedCopyId = mergedChoices.selectedCopyId
  if (mergedChoices.selectedStyleId) cleanedChoices.selectedStyleId = mergedChoices.selectedStyleId

  // --- ATOMIC DYNAMODB UPDATE ---
  // We check if 'choices' map exists to handle initialization vs nested updates
  const hasChoicesMap = !!existing.Item.choices

  if (!hasChoicesMap) {
    // Initialize map if missing
    // We can just regular update here since we know it was empty
    await dynamoClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { jobId },
        UpdateExpression: "SET choices = if_not_exists(choices, :empty)",
        ExpressionAttributeValues: { ":empty": {} },
      })
    )
  }

  // Construct atomic update for fields
  const updateParts: string[] = ["#status = :status", "#updatedAt = :updatedAt"]
  const attributeNames: Record<string, string> = {
    "#status": "status",
    "#updatedAt": "updatedAt",
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attributeValues: Record<string, any> = {
    ":status": newStatus,
    ":updatedAt": new Date().toISOString(),
  }

  if (choices.selectedPaletteId) {
    updateParts.push("choices.selectedPaletteId = :paletteId")
    attributeValues[":paletteId"] = choices.selectedPaletteId
  }
  if (choices.selectedCopyId) {
    updateParts.push("choices.selectedCopyId = :copyId")
    attributeValues[":copyId"] = choices.selectedCopyId
  }
  if (choices.selectedStyleId) {
    updateParts.push("choices.selectedStyleId = :styleId")
    attributeValues[":styleId"] = choices.selectedStyleId
  }

  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
    })
  )

  // Send SQS message logic
  if (choices.selectedPaletteId || choices.selectedStyleId || choices.selectedCopyId) {
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          jobId,
          selectedPaletteId: cleanedChoices.selectedPaletteId,
          selectedCopyId: cleanedChoices.selectedCopyId,
          selectedStyleId: cleanedChoices.selectedStyleId,
        }),
      })
    )
  }

  return { jobId, status: newStatus }
}
