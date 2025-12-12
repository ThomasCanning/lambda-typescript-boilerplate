import { SQSClient, SendMessageCommand, SQSClientConfig } from "@aws-sdk/client-sqs"
import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"
import { randomUUID } from "crypto"

export type GenerateJobStatus = "pending" | "running" | "succeeded" | "failed"

export interface GenerateStartResponse {
  jobId: string
  status: GenerateJobStatus
}

interface StartPayload {
  prompt?: string
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

export async function startGenerate(body: string | null): Promise<GenerateStartResponse> {
  const tableName = getEnvVar("GENERATION_JOBS_TABLE")
  const queueUrl = getEnvVar("GENERATION_QUEUE_URL")
  const dynamoClient = createDynamoClient()
  const sqsClient = createSqsClient()

  if (!body) {
    throw new Error("Request body is required")
  }

  const payload: StartPayload = JSON.parse(body)
  const prompt = payload.prompt

  if (!prompt || typeof prompt !== "string") {
    throw new Error("Invalid or missing 'prompt'")
  }

  const now = new Date().toISOString()
  const jobId = randomUUID()
  // Set TTL to 1 hour from now (Unix timestamp in seconds)
  const expiresAt = Math.floor(Date.now() / 1000) + 3600

  await dynamoClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        jobId,
        prompt,
        status: "pending",
        currentStep: "queued",
        progressMessage: "Queued",
        createdAt: now,
        updatedAt: now,
        expiresAt,
      },
      ConditionExpression: "attribute_not_exists(jobId)",
    })
  )

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ jobId, prompt }),
    })
  )

  return {
    jobId,
    status: "pending",
  }
}
