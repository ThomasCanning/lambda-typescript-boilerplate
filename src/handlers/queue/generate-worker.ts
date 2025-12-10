import { SQSEvent, SQSRecord } from "aws-lambda/trigger/sqs"
import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"
import {
  websiteBuilderWorkflow,
  selectionStep,
  seniorStep,
} from "../../lib/mastra/workflows/website-builder"
import type { GenerateProgressUpdate } from "../../lib/api/generate"
import { updateJobStatus } from "../../lib/api/generate-status"

interface QueueMessage {
  jobId?: string
  prompt?: string
  selectedPaletteId?: string
  selectedCopyId?: string
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

  if (!context) return partials

  if (context.profileData) {
    // Summarize profile data for the frontend/logs

    const basic = context.profileData?.basic_info || {}
    partials.profileData = {
      basic_info: {
        fullname: basic.fullname,
        headline: basic.headline,
        profile_picture_url: basic.profile_picture_url,
      },
    }
  }
  if (context.colorOptions) partials.colorOptions = context.colorOptions
  if (context.copyOptions) partials.copyOptions = context.copyOptions
  // If we have selections from partial resume
  if (context.selectedPaletteId || context.selectedCopyId) {
    partials.choices = {
      selectedPaletteId: context.selectedPaletteId,
      selectedCopyId: context.selectedCopyId,
    }
  }

  return partials
}

async function processRecord(record: SQSRecord): Promise<void> {
  const message: QueueMessage = JSON.parse(record.body ?? "{}")
  const { jobId, prompt } = message
  if (!jobId) return

  console.log(`[Worker] Processing Job: ${jobId} `, message)
  const tableName = getEnvVar("GENERATION_JOBS_TABLE")

  try {
    const isResume = Boolean(message.selectedPaletteId || message.selectedCopyId)

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

      if (result.status === "suspended") {
        // Extract the payload from the suspended step by searching result.steps or result.context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let suspendedState: any = result.context || {}

        // Check new Mastra structure: result.steps
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((result as any).steps) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const steps = (result as any).steps as Record<
            string,
            { status: string; suspendPayload?: unknown; payload?: unknown; output?: unknown }
          >
          const suspendedStep = Object.values(steps).find((res) => res.status === "suspended")
          if (suspendedStep) {
            if (suspendedStep.suspendPayload) {
              suspendedState = { ...suspendedState, ...suspendedStep.suspendPayload }
            } else if (suspendedStep.output) {
              suspendedState = { ...suspendedState, ...suspendedStep.output }
            } else if (suspendedStep.payload) {
              suspendedState = { ...suspendedState, ...suspendedStep.payload }
            }
          }
        }
        // Fallback to old context.stepResults if available
        else if (result.context?.stepResults) {
          const stepResults: Record<
            string,
            { status: string; suspendPayload?: unknown; payload?: unknown }
          > = result.context.stepResults
          const suspendedStep = Object.values(stepResults).find((res) => res.status === "suspended")
          if (suspendedStep) {
            if (suspendedStep.suspendPayload) {
              suspendedState = { ...suspendedState, ...suspendedStep.suspendPayload }
            } else if (suspendedStep.payload) {
              suspendedState = { ...suspendedState, ...suspendedStep.payload }
            }
          }
        }
        // DO NOT CLOSE THE IF BLOCK HERE, as suspendedState is used below

        // Clean logs by summarizing profile data
        const loggableState = { ...suspendedState }
        if (loggableState.profileData) {
          const basic = loggableState.profileData?.basic_info || {}
          loggableState.profileData = {
            basic_info: {
              fullname: basic.fullname,
              headline: basic.headline,
              // profile_picture_url: basic.profile_picture_url // Optional in logs?
            },
          }
        }
        console.log(
          "[Worker] Workflow Suspended. Result Context (Summary):",
          JSON.stringify(loggableState, null, 2)
        )

        await updateJobStatus(jobId, "awaiting_choices", {
          currentStep: "awaiting_choices",
          progressMessage: "Draft ready! Please select options.",
          agentStates: { color: "waiting_for_user", copy: "waiting_for_user" },
          partials: mapContextToProgress(suspendedState),
        })
      } else if (result.status === "failed") {
        console.error("Workflow failed:", result.error)
        await updateJobStatus(jobId, "failed", {
          error: result.error || "Workflow failed due to an unknown error",
        })
      } else if (result.status === "success" && !result.context) {
        console.warn("Workflow finished unexpectedly early", result)
        await updateJobStatus(jobId, "failed", {
          error: "Workflow finished unexpectedly early or returned no data.",
        })
      }
      return
    }

    // --- RESUME JOB ---
    // Fetch state
    const job = await dynamoClient.send(new GetCommand({ TableName: tableName, Key: { jobId } }))
    const currentPartials = job.Item?.partials || {}
    const currentChoices = job.Item?.choices || {}

    // We assume we are in 'selectionStep' phase since that's the only suspension.

    // 1. Re-hydrate Selection Step Input/State
    const inputData = {
      profileData: currentPartials.profileData,
      jobId, // Pass jobId so we can update status inside agents if needed
    }

    // State comes from partials
    const state = {
      colorOptions: currentPartials.colorOptions,
      copyOptions: currentPartials.copyOptions,
      selectedPaletteId: currentChoices.selectedPaletteId,
      selectedCopyId: currentChoices.selectedCopyId,
    }

    // Resume Data from Message
    const resumeData = {
      selectedPaletteId: message.selectedPaletteId,
      selectedCopyId: message.selectedCopyId,
    }

    console.log("Resuming Selection Step", { state, resumeData })

    // Execute Selection Step Resumption
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const selectionResult = (await selectionStep.execute({
      inputData: inputData as any,
      resumeData: resumeData as any,
      state: state as any,
      setState: () => {}, // State is managed via response/DB
      suspend: (data: any) => ({ status: "suspended", data: data, suspendPayload: data }) as any,
    } as any)) as unknown as {
      status?: string
      suspendPayload?: unknown
      colorOptions?: any
      copyOptions?: any
      selectedPaletteId?: string
      selectedCopyId?: string
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // If it suspended again (partial choice), update DB and wait
    if (selectionResult.status === "suspended") {
      console.log("Selection step suspended (partial selection).")
      await updateJobStatus(jobId, "awaiting_choices", {
        currentStep: "awaiting_choices",
        // The payload contains the new state (e.g. one ID selected)
        partials: mapContextToProgress(selectionResult.suspendPayload),
      })
      return
    }

    // If it finished, we have both choices! Proceed to Senior Step.
    if (selectionResult.selectedPaletteId && selectionResult.selectedCopyId) {
      console.log("Selection Complete. Starting Senior Step.")

      // Execute Senior Step manually
      const seniorInput = {
        profileData: currentPartials.profileData,
        colorOptions: selectionResult.colorOptions || currentPartials.colorOptions,
        copyOptions: selectionResult.copyOptions || currentPartials.copyOptions,
        selectedPaletteId: selectionResult.selectedPaletteId,
        selectedCopyId: selectionResult.selectedCopyId,
        jobId,
      }

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const finalResult = await seniorStep.execute({
        inputData: seniorInput as any,
        state: {} as any,
        setState: () => {},
        suspend: () => ({}) as any, // Should not suspend
      } as any)
      /* eslint-enable @typescript-eslint/no-explicit-any */

      // Final Result Handling
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = finalResult?.html || (finalResult as any)?.payload?.html

      if (html) {
        await updateJobStatus(jobId, "succeeded", {
          currentStep: "complete",
          progressMessage: "Website generated!",
          result: { text: html },
          partials: { ...currentPartials, finalHtml: html },
        })
      } else {
        await updateJobStatus(jobId, "failed", { error: "Senior agent returned no HTML" })
      }
    }
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
