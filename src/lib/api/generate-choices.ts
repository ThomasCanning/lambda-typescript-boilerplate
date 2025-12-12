import { SQSClient, SendMessageCommand, SQSClientConfig } from "@aws-sdk/client-sqs"
import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { GenerateJobStatus } from "./generate-status"

interface ChoicesPayload {
  selectedPaletteId?: string
  selectedCopyId?: string
  selectedStyleId?: string
}

function createDynamoClient(): DynamoDBDocumentClient {
  const config: DynamoDBClientConfig = {}
  if (process.env.AWS_REGION) config.region = process.env.AWS_REGION

  return DynamoDBDocumentClient.from(new DynamoDBClient(config))
}

function createSqsClient(): SQSClient {
  const config: SQSClientConfig = {}
  if (process.env.AWS_REGION) config.region = process.env.AWS_REGION

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

  if (!jobId) throw new Error("jobId is required")

  // 1. Strict Validation: Both Palette and Copy are required.
  const { selectedPaletteId, selectedCopyId } = choices
  if (!selectedPaletteId || !selectedCopyId) {
    throw new Error("Both selectedPaletteId and selectedCopyId are required.")
  }

  // 2. Prepare Updates
  const now = new Date().toISOString()
  const newStatus: GenerateJobStatus = "running"

  const updateParts: string[] = [
    "#status = :status",
    "#updatedAt = :updatedAt",
    "choices = :choicesMap",
  ]

  const attributeNames: Record<string, string> = {
    "#status": "status",
    "#updatedAt": "updatedAt",
  }

  const attributeValues: Record<string, string | ChoicesPayload> = {
    ":status": newStatus,
    ":updatedAt": now,
    ":choicesMap": { selectedPaletteId, selectedCopyId },
  }

  // 3. Atomic Write to DynamoDB (Overwrite choices)
  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
      ConditionExpression: "attribute_exists(jobId)", // Ensure job exists
    })
  )

  // 4. Trigger Worker (Phase 2)
  console.log(
    `[Job ${jobId}] Phase 2 Triggered. Choices: Palette=${selectedPaletteId}, Copy=${selectedCopyId}`
  )

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        jobId,
        selectedPaletteId,
        selectedCopyId,
      }),
    })
  )

  return { jobId, status: newStatus }
}
