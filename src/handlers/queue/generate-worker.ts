import { SQSEvent, SQSRecord } from "aws-lambda/trigger/sqs"
import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"
import {
  websiteBuilderWorkflow,
  colorInjectionStep,
  finalBuildStep,
} from "../../lib/mastra/workflows"
import type { GenerateProgressUpdate } from "../../lib/api/generate"
import { updateJobStatus } from "../../lib/api/generate-status"

interface QueueMessage {
  jobId?: string
  prompt?: string
  selectedPaletteId?: string
  selectedCopyId?: string
  selectedStyleId?: string
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

// Map Workflow Context output to our UI Progress format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContextToProgress(context: any): Partial<GenerateProgressUpdate["partials"]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partials: any = {}

  if (context.profileData) partials.profileData = context.profileData
  if (context.draftHtml) partials.draftHtml = context.draftHtml
  if (context.colorOptions) partials.colorOptions = context.colorOptions
  if (context.copyOptions) partials.copyOptions = context.copyOptions
  if (context.styleOptions) partials.styleOptions = context.styleOptions

  return partials
}

async function processRecord(record: SQSRecord): Promise<void> {
  const message: QueueMessage = JSON.parse(record.body ?? "{}")
  const { jobId, prompt } = message
  if (!jobId) return

  console.log(`[Worker] Processing Job: ${jobId}`, message)
  const tableName = getEnvVar("GENERATION_JOBS_TABLE")

  try {
    const isResume = Boolean(message.selectedPaletteId || message.selectedStyleId)

    // --- START NEW JOB ---
    if (!isResume) {
      await updateJobStatus(jobId, "running", {
        currentStep: "starting",
        progressMessage: "Starting AI Workflow...",
      })

      // Execute Workflow
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const run = (await websiteBuilderWorkflow.createRunAsync()) as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await run.start({ inputData: { url: prompt!, jobId } })) as any

      // Wait for completion or suspension
      if (result.status === "suspended") {
        const suspendedState = result.context // Or wherever the state lives in the new result object. Assuming context based on previous code.
        await updateJobStatus(jobId, "awaiting_choices", {
          currentStep: "awaiting_choices",
          progressMessage: "Draft ready! Please select a color palette.",
          partials: mapContextToProgress(suspendedState),
        })
      } else {
        console.warn("Workflow finished uniquely early or failed", result)
      }
      return
    }

    // --- RESUME JOB (MANUAL STEP EXECUTION) ---
    // Fetch state
    const job = await dynamoClient.send(new GetCommand({ TableName: tableName, Key: { jobId } }))
    const currentPartials = job.Item?.partials || {}
    const currentChoices = job.Item?.choices || {}

    // B. Style/Copy Selected -> Final Build
    if (message.selectedStyleId) {
      console.log("Resuming: Style Selection -> Final Build")
      await updateJobStatus(jobId, "running", { progressMessage: "Finalizing website..." })

      const inputData = { ...currentPartials, selectedPaletteId: currentChoices.selectedPaletteId }
      const resumeData = {
        selectedStyleId: message.selectedStyleId,
        selectedCopyId: message.selectedCopyId || currentChoices.selectedCopyId, // handle cases where copy was picked earlier?
      }
      const state = { ...currentPartials, selectedPaletteId: currentChoices.selectedPaletteId }

      // Execute Final Step
      // The final step returns { html }, not a suspend object
      const result = await finalBuildStep.execute({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputData: inputData as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resumeData: resumeData as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: state as any,
        setState: () => {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        suspend: () => ({}) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      // @ts-expect-error - Runtime result handling
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = result?.html || result?.payload?.html || (result as any)?.text

      if (html) {
        await updateJobStatus(jobId, "succeeded", {
          currentStep: "complete",
          progressMessage: "Website generated!",
          result: { text: html },
          partials: { ...currentPartials, finalHtml: html },
        })
      }
      return
    }

    // A. Color Selected -> Intermediate Upgrade (Draft + Color)
    if (message.selectedPaletteId) {
      console.log("Resuming: Color Selection -> Injection Phase")
      await updateJobStatus(jobId, "running", {
        progressMessage: "Injecting colors & generating styles...",
      })

      // Map state for color injection step
      const inputData = {
        profileData: currentPartials.profileData,
        draftHtml: currentPartials.draftHtml,
        colorOptions: currentPartials.colorOptions,
        copyOptions: currentPartials.copyOptions,
      }
      const state = { ...currentPartials }
      const resumeData = { selectedPaletteId: message.selectedPaletteId }

      // Execute Color Injection Step

      const result = (await colorInjectionStep.execute({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputData: inputData as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resumeData: resumeData as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: state as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setState: (s: any) => {
          Object.assign(state, s)
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        suspend: (data: any) => ({ status: "suspended", data: data }) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)) as any

      // If it returned a suspended result (which it should), we update DB
      if (result && result.status === "suspended") {
        await updateJobStatus(jobId, "awaiting_style", {
          currentStep: "awaiting_style",
          progressMessage: "Colors injected! Select a style to finish.",
          // Merge the new state back into partials
          partials: mapContextToProgress({ ...state, ...result.data }),
        })
      }
      // Handle SUCCESSFUL completion (OutputSchema) - This is what happens when we resume with a palette
      else if (result && result.draftHtml) {
        await updateJobStatus(jobId, "awaiting_style", {
          currentStep: "awaiting_style",
          progressMessage: "Colors injected! Select a style to finish.",
          // Merge the new state back into partials
          partials: mapContextToProgress({ ...state, ...result }),
        })
      }
      return
    }
    // throw error <--- Removing this line
  } catch (error) {
    console.error("Worker Error Trace:", error)
    if (error instanceof Error) {
      console.error("Stack:", error.stack)
    }
    await updateJobStatus(jobId, "failed", {
      error: error instanceof Error ? error.message : "Unknown Error",
    })
    // Re-throw to let SQS handle it (retries/DLQ)
    throw error
  }
}

export const generateWorkerHandler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    await processRecord(record)
  }
}
