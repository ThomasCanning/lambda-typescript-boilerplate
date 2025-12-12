import { SQSRecord } from "aws-lambda/trigger/sqs"
import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"
import { mastra } from "../../lib/mastra"
import {
  updateJobStatus,
  updateJobAgentState,
  updateJobPartial,
} from "../../lib/api/generate-status"
import { fetchLinkedInProfiles } from "../../lib/mastra/tools/linkedin-profile"
import { finalBuildSchema } from "../../lib/mastra/agents/seniorBuilder"
import { colorOptionsSchema } from "../../lib/mastra/agents/color"
import { copyOptionsSchema } from "../../lib/mastra/agents/copywriter"
import { z } from "zod"

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

  return DynamoDBDocumentClient.from(new DynamoDBClient(config))
}

const dynamoClient = createDynamoClient()

async function processRecord(record: SQSRecord): Promise<void> {
  if (!record.body) return
  const message: QueueMessage = JSON.parse(record.body)
  const { jobId, prompt } = message
  if (!jobId) return

  // Concise log
  console.log(
    `[Job ${jobId}] Processing. Prompt=${!!prompt}, Palette=${message.selectedPaletteId}, Copy=${message.selectedCopyId}`
  )

  const tableName = getEnvVar("GENERATION_JOBS_TABLE")

  try {
    // Check if this is a "Choice Submission" or "New Job"
    const isResume = Boolean(message.selectedPaletteId || message.selectedCopyId)

    if (!isResume) {
      // --- PHASE 1: START NEW JOB (Scrape + Junior Agents) ---
      if (!prompt) throw new Error("URL is required for new job")

      await updateJobStatus(jobId, "running", {
        currentStep: "scraping",
        progressMessage: "Fetching LinkedIn profile...",
      })

      // 1. Fetch Profile Data (Direct Call)
      console.log(`[Job ${jobId}] Fetching LinkedIn Profile for: ${prompt}`)
      const scrapeResult = await fetchLinkedInProfiles([prompt])
      console.log(`[Job ${jobId}] Fetch finished.`)

      if (scrapeResult.error) {
        throw new Error(`LinkedIn tool error: ${scrapeResult.error}`)
      }

      if (!scrapeResult.profiles || scrapeResult.profiles.length === 0) {
        throw new Error("No LinkedIn profiles found for the given URL.")
      }

      const profileData = scrapeResult.profiles[0]
      // Sanitize date for DB (no undefineds)
      const cleanProfileData = JSON.parse(JSON.stringify(profileData))

      await updateJobStatus(jobId, "running", {
        currentStep: "designing",
        progressMessage: "Profile data fetched! Starting design agents...",
        partials: { profileData: cleanProfileData },
        agentStates: { color: "idle", copy: "idle" },
      })

      // 2. Run Design Workflow (Junior Agents Parallel)
      const designWorkflow = mastra.getWorkflow("designWorkflow")
      if (!designWorkflow) throw new Error("Design Workflow not found")

      // Execute Workflow
      const run = await designWorkflow.createRunAsync()
      const workflowResult = await run.start({
        inputData: { profileData: cleanProfileData, jobId },
      })

      // We explicitly set status to awaiting_choices if successful
      if (workflowResult.status === "success") {
        // Atomic update: only now do we ask for user input
        await updateJobStatus(jobId, "awaiting_choices", {
          currentStep: "awaiting_choices",
          progressMessage: "Please select your options.",
          agentStates: { color: "waiting_for_user", copy: "waiting_for_user" },
        })
      } else {
        throw new Error(`Design workflow failed: ${workflowResult.status}`)
      }
    } else {
      // --- PHASE 2: FINISH JOB (Senior Agent) ---

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
        message.selectedPaletteId || jobRecord.Item?.choices?.selectedPaletteId || ""
      const selectedCopyId = message.selectedCopyId || jobRecord.Item?.choices?.selectedCopyId || ""

      console.log(
        `[Job ${jobId}] Resolved Selections - Palette: ${selectedPaletteId}, Copy: ${selectedCopyId}`
      )

      const parsedColor = colorOptionsSchema.safeParse(colorOptions)
      const parsedCopy = copyOptionsSchema.safeParse(copyOptions)

      if (!parsedColor.success || !parsedCopy.success) {
        throw new Error("Invalid options data in DB")
      }

      const selectedPalette: z.infer<typeof colorOptionsSchema>["options"][number] | undefined =
        parsedColor.data.options.find((o) => o.id === selectedPaletteId)
      const selectedCopy: z.infer<typeof copyOptionsSchema>["options"][number] | undefined =
        parsedCopy.data.options.find((o) => o.id === selectedCopyId)

      if (!selectedPalette || !selectedCopy) {
        throw new Error(`Invalid selection IDs: ${selectedPaletteId}, ${selectedCopyId}`)
      }

      await updateJobStatus(jobId, "running", {
        currentStep: "building",
        progressMessage: "Finalizing website with Senior Agent...",
      })
      await updateJobAgentState(jobId, "senior", "thinking")

      // 3. Call Senior Agent
      const seniorAgent = mastra.getAgent("seniorBuilderAgent")
      const buildResult = await seniorAgent.generate(
        JSON.stringify({
          profileData,
          colorPalette: selectedPalette,
          wordingStyle: selectedCopy,
        }),
        { output: finalBuildSchema }
      )
      console.log(`[Job ${jobId}] Senior Agent finished.`)

      const finalHtml = buildResult.object.index_html

      // 4. Complete Job
      // Save finalHtml without overwriting other partials
      await updateJobPartial(jobId, "finalHtml", finalHtml)

      await updateJobStatus(jobId, "succeeded", {
        result: { text: "Website generated successfully" },
        progressMessage: "Website created!",
      })
      await updateJobAgentState(jobId, "senior", "completed")
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
