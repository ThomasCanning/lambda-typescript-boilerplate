import { SQSRecord } from "aws-lambda/trigger/sqs"
import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"
import { mastra } from "../../lib/mastra"
import { updateJobStatus, updateJobAgentState } from "../../lib/api/generate-status"
import { linkedInProfileSchema } from "../../lib/mastra/tools/linkedin-profile"
import { finalBuildSchema } from "../../lib/mastra/agents/seniorBuilder"
import { colorOptionsSchema } from "../../lib/mastra/agents/color"
import { copyOptionsSchema } from "../../lib/mastra/agents/copywriter"

interface QueueMessage {
  jobId?: string
  prompt?: string // URL
  // Choice fields
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

async function processRecord(record: SQSRecord): Promise<void> {
  const message: QueueMessage = JSON.parse(record.body ?? "{}")
  const { jobId, prompt } = message
  if (!jobId) return

  const tableName = getEnvVar("GENERATION_JOBS_TABLE")

  try {
    // Check if this is a "Choice Submission" or "New Job"
    const isResume = Boolean(message.selectedPaletteId || message.selectedCopyId)

    if (!isResume) {
      // --- PHASE 1: START NEW JOB (Scrape + Junior Agents) ---
      if (!prompt) throw new Error("URL is required for new job")

      await updateJobStatus(jobId, "running", {
        currentStep: "scraping",
        progressMessage: "Researcher Agent starting...",
      })

      // 1. Run Researcher Agent (Direct Call)
      console.log(`[Job ${jobId}] Starting Researcher Agent...`)
      const researcher = mastra.getAgent("researcherAgent")
      const scrapeResult = await researcher.generate(
        `Fetch the LinkedIn profile data for this URL: ${prompt}`,
        {
          output: linkedInProfileSchema,
        }
      )

      const profileData = scrapeResult.object
      // Sanitize date for DB (no undefineds)
      const cleanProfileData = JSON.parse(JSON.stringify(profileData))

      await updateJobStatus(jobId, "running", {
        currentStep: "designing",
        progressMessage: "Profile data fetched! Starting design agents...",
        partials: { profileData: cleanProfileData },
        agentStates: { color: "idle", copy: "idle" },
      })

      // 2. Run Design Workflow (Junior Agents Parallel)
      console.log(`[Job ${jobId}] Starting Design Workflow...`)
      const designWorkflow = mastra.getWorkflow("designWorkflow")
      if (!designWorkflow) throw new Error("Design Workflow not found")

      // Execute Workflow (without suspend, it runs to completion now)
      const run = await designWorkflow.createRunAsync()
      const workflowResult = await run.start({
        inputData: { profileData: cleanProfileData, jobId },
      })

      // Workflow returns { "generate-color-step": { colorOptions }, "generate-copy-step": { copyOptions } }
      // The workflow steps themselves already call updateJobPartial to save their specific options.
      // But we should verify or update the final status.

      console.log(`[Job ${jobId}] Design Workflow completed.`)

      // We explicitly set status to awaiting_choices if successful
      if (workflowResult.status === "success") {
        await updateJobStatus(jobId, "awaiting_choices", {
          currentStep: "awaiting_choices",
          progressMessage: "Please select your options.",
        })
      } else {
        throw new Error(`Design workflow failed: ${workflowResult.status}`)
      }
    } else {
      // --- PHASE 2: FINISH JOB (Senior Agent) ---
      console.log(`[Job ${jobId}] Resuming for final build...`)

      // 1. Fetch Job Data (Partials)
      const jobRecord = await dynamoClient.send(
        new GetCommand({ TableName: tableName, Key: { jobId } })
      )
      const partials = jobRecord.Item?.partials || {}

      const profileData = partials.profileData
      const colorOptions = partials.colorOptions
      const copyOptions = partials.copyOptions

      if (!profileData || !colorOptions || !copyOptions) {
        throw new Error("Missing required partial data (profile, color, or copy) to proceed.")
      }

      // 2. Resolve Selections
      const selectedPaletteId =
        message.selectedPaletteId || jobRecord.Item?.choices?.selectedPaletteId
      const selectedCopyId = message.selectedCopyId || jobRecord.Item?.choices?.selectedCopyId

      const parsedColor = colorOptionsSchema.safeParse(colorOptions)
      const parsedCopy = copyOptionsSchema.safeParse(copyOptions)

      if (!parsedColor.success || !parsedCopy.success) {
        throw new Error("Invalid options data in DB")
      }

      const selectedPalette = parsedColor.data.options.find((o) => o.id === selectedPaletteId)
      const selectedCopy = parsedCopy.data.options.find((o) => o.id === selectedCopyId)

      if (!selectedPalette || !selectedCopy) {
        throw new Error(`Invalid selection IDs: ${selectedPaletteId}, ${selectedCopyId}`)
      }

      await updateJobStatus(jobId, "running", {
        currentStep: "building",
        progressMessage: "Finalizing website with Senior Agent...",
      })
      await updateJobAgentState(jobId, "senior", "thinking")

      // 3. Call Senior Agent
      console.log(`[Job ${jobId}] Calling Senior Agent...`)
      const seniorAgent = mastra.getAgent("seniorBuilderAgent")
      const buildResult = await seniorAgent.generate(
        JSON.stringify({
          profileData,
          colorPalette: selectedPalette,
          copy: selectedCopy,
        }),
        { output: finalBuildSchema }
      )

      const finalHtml = buildResult.object.index_html

      // 4. Complete Job
      await updateJobStatus(jobId, "succeeded", {
        partials: { finalHtml },
        result: { text: "Website generated successfully" },
        progressMessage: "Website created!",
      })
      await updateJobAgentState(jobId, "senior", "completed")
      console.log(`[Job ${jobId}] Job Succeeded!`)
    }
  } catch (error) {
    console.error(`[Job ${jobId}] Worker Error:`, error)
    await updateJobStatus(jobId, "failed", {
      error: error instanceof Error ? error.message : "Unknown Error",
    })
    throw error
  }
}

export const generateWorkerHandler = async (event: { Records: SQSRecord[] }) => {
  for (const record of event.Records) {
    await processRecord(record)
  }
}
