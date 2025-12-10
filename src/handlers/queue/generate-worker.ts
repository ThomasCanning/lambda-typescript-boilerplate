import { SQSRecord } from "aws-lambda/trigger/sqs"
import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { mastra } from "../../lib/mastra"
import { updateJobStatus } from "../../lib/api/generate-status"

interface QueueMessage {
  jobId?: string
  prompt?: string
  selectedPaletteId?: string
  selectedCopyId?: string
}

interface WorkflowResult {
  status: "success" | "suspended" | "failed"
  error?: string | Error
}

function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function createDynamoClient() {
  const config: DynamoDBClientConfig = {}
  if (process.env.AWS_REGION) config.region = process.env.AWS_REGION
  if (process.env.DDB_ENDPOINT) config.endpoint = process.env.DDB_ENDPOINT
  return DynamoDBDocumentClient.from(new DynamoDBClient(config))
}

const dynamoClient = createDynamoClient()

async function processRecord(record: SQSRecord): Promise<void> {
  const message: QueueMessage = JSON.parse(record.body ?? "{}")
  const { jobId, prompt } = message
  if (!jobId) return

  const tableName = getEnvVar("GENERATION_JOBS_TABLE")

  try {
    const isResume = Boolean(message.selectedPaletteId || message.selectedCopyId)
    const workflow = mastra.getWorkflow("websiteBuilderWorkflow")
    if (!workflow) throw new Error("Workflow not found")

    // --- START NEW JOB ---
    if (!isResume) {
      await updateJobStatus(jobId, "running", {
        currentStep: "starting",
        progressMessage: "Starting AI Workflow...",
      })

      // Create new run
      const run = await workflow.createRunAsync()

      // Save runId to DB so we can resume later
      await dynamoClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { jobId },
          UpdateExpression: "SET mastraRunId = :runId",
          ExpressionAttributeValues: { ":runId": run.runId },
        })
      )

      // Start the run
      const result = await run.start({ inputData: { url: prompt!, jobId } })

      handleWorkflowResult(jobId, result)
      return
    }

    // --- RESUME JOB ---
    // 1. Get mastraRunId
    const job = await dynamoClient.send(new GetCommand({ TableName: tableName, Key: { jobId } }))
    const mastraRunId = job.Item?.mastraRunId

    if (!mastraRunId) {
      throw new Error(`Cannot resume job ${jobId}: Missing mastraRunId`)
    }

    const run = await workflow.createRunAsync({ runId: mastraRunId })

    // 3. Determine which step to resume
    let stepId = ""
    let resumePayload = {}

    if (message.selectedPaletteId) {
      stepId = "generate-color-step"
      resumePayload = { selectedPaletteId: message.selectedPaletteId }
    } else if (message.selectedCopyId) {
      stepId = "generate-copy-step"
      resumePayload = { selectedCopyId: message.selectedCopyId }
    } else {
      throw new Error("Resume triggered without valid selection")
    }

    const result = await run.resume({
      step: stepId,
      resumeData: resumePayload,
    })

    handleWorkflowResult(jobId, result)
  } catch (error) {
    console.error("Worker Error Trace:", error)
    await updateJobStatus(jobId, "failed", {
      error: error instanceof Error ? error.message : "Unknown Error",
    })
    throw error
  }
}

async function handleWorkflowResult(jobId: string, result: WorkflowResult) {
  switch (result.status) {
    case "suspended":
      await updateJobStatus(jobId, "awaiting_choices", {
        currentStep: "awaiting_choices",
      })
      break

    case "failed": {
      const errorMessage =
        result.error instanceof Error
          ? result.error.message
          : String(result.error || "Workflow failed")
      await updateJobStatus(jobId, "failed", {
        error: errorMessage,
      })
      break
    }
  }
}

export const handler = async (event: { Records: SQSRecord[] }) => {
  for (const record of event.Records) {
    await processRecord(record)
  }
}
