import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"

export type GenerateJobStatus =
  | "pending"
  | "running"
  | "awaiting_choices"
  | "awaiting_style"
  | "succeeded"
  | "failed"

export interface GeneratePartialsStatus {
  profileData?: unknown
  colorOptions?: unknown
  copyOptions?: unknown
  finalHtml?: string
  choices?: {
    selectedPaletteId?: string
    selectedCopyId?: string
  }
}

export interface GenerateStatusResponse {
  jobId: string
  status: GenerateJobStatus
  currentStep?: string
  progressMessage?: string
  agentStates?: {
    color?: "idle" | "thinking" | "waiting_for_user" | "completed"
    copy?: "idle" | "thinking" | "waiting_for_user" | "completed"
    senior?: "idle" | "thinking" | "completed"
  }
  updatedAt?: string
  result?: unknown
  error?: string
  partials?: GeneratePartialsStatus
  choices?: {
    selectedPaletteId?: string
    selectedCopyId?: string
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }
}

function createDynamoClient(): DynamoDBDocumentClient {
  const config: DynamoDBClientConfig = {}
  if (process.env.AWS_REGION) config.region = process.env.AWS_REGION
  if (process.env.DDB_ENDPOINT) config.endpoint = process.env.DDB_ENDPOINT

  // Dynamo local still needs credentials for request signing.
  if (config.endpoint || process.env.IS_LOCAL_DEV === "true") {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
    }
  }

  return DynamoDBDocumentClient.from(new DynamoDBClient(config), {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  })
}

function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export async function getGenerateStatus(jobId: string): Promise<GenerateStatusResponse> {
  const tableName = getEnvVar("GENERATION_JOBS_TABLE")
  const dynamoClient = createDynamoClient()

  if (!jobId) {
    throw new Error("jobId is required")
  }

  const response = await dynamoClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { jobId },
    })
  )

  if (!response.Item) {
    throw new NotFoundError(`Job not found: ${jobId}`)
  }

  const {
    status,
    result,
    error,
    currentStep,
    progressMessage,
    agentStates,
    updatedAt,
    partials,
    choices,
  } = response.Item as {
    status: GenerateJobStatus
    result?: unknown
    error?: string
    currentStep?: string
    progressMessage?: string
    agentStates?: GenerateStatusResponse["agentStates"]
    updatedAt?: string
    partials?: GeneratePartialsStatus
    choices?: {
      selectedPaletteId?: string
      selectedCopyId?: string
      selectedStyleId?: string
    }
  }

  return {
    jobId,
    status,
    currentStep,
    progressMessage,
    agentStates,
    updatedAt,
    result,
    error,
    partials,
    choices,
  }
}

export async function updateJobStatus(
  jobId: string,
  status: GenerateJobStatus,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updates: Record<string, any>
) {
  const tableName = getEnvVar("GENERATION_JOBS_TABLE")
  const dynamoClient = createDynamoClient()
  const now = new Date().toISOString()
  const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb")

  const expressionParts = ["#status = :status", "#updatedAt = :updatedAt"]
  const names: Record<string, string> = { "#status": "status", "#updatedAt": "updatedAt" }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const values: Record<string, any> = { ":status": status, ":updatedAt": now }

  Object.entries(updates).forEach(([key, value]) => {
    expressionParts.push(`#${key} = :${key}`)
    names[`#${key}`] = key
    values[`:${key}`] = value
  })

  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: `SET ${expressionParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  )
}

export async function updateJobAgentState(
  jobId: string,
  agent: "color" | "copy" | "senior",
  state: "idle" | "thinking" | "waiting_for_user" | "completed"
) {
  const tableName = getEnvVar("GENERATION_JOBS_TABLE")
  const dynamoClient = createDynamoClient()
  const now = new Date().toISOString()
  const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb")

  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: "SET agentStates.#agent = :state, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#agent": agent,
      },
      ExpressionAttributeValues: {
        ":state": state,
        ":updatedAt": now,
      },
    })
  )
}

export async function updateJobPartial(
  jobId: string,
  key: keyof GeneratePartialsStatus,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
) {
  const tableName = getEnvVar("GENERATION_JOBS_TABLE")
  const dynamoClient = createDynamoClient()
  const now = new Date().toISOString()
  const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb")

  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: "SET partials.#key = :value, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#key": key,
      },
      ExpressionAttributeValues: {
        ":value": value,
        ":updatedAt": now,
      },
    })
  )
}
