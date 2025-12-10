/**
 * Website Builder Workflow
 *
 * New Architecture:
 * 1. Start Step (Scrape): Fetches and structures LinkedIn profile data.
 * 2. Parallel Selection Steps:
 *    - Color Step: Generates palettes -> Suspends for User Choice.
 *    - Copy Step: Generates copy variations -> Suspends for User Choice.
 * 3. Senior Step (Final): Takes scraped data + color choice + copy choice -> Generates Final HTML.
 */

import { createWorkflow, createStep } from "@mastra/core/workflows"
import { z } from "zod"
import { getColorAgent, getCopywriterAgent, getSeniorBuilderAgent } from "../agents"
import { fetchLinkedInProfiles, linkedInProfileSchema } from "../tools/linkedin-profile"
import { updateJobStatus } from "../../api/generate-status"

// --- Schemas ---

const paletteOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  primary: z.string(),
  secondary: z.string(),
  background: z.string(),
  text: z.string(),
  accent: z.string(),
})

const colorOptionsSchema = z.object({
  options: z.array(paletteOptionSchema),
})

const copyOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  headline: z.string(),
  bio: z.string(),
})

const copyOptionsSchema = z.object({
  options: z.array(copyOptionSchema),
})

const finalBuildSchema = z.object({
  index_html: z.string(),
})

// --- Helper Functions ---

function stripMarkdownCodeBlocks(text: string): string {
  let cleaned = text.trim()
  const codeBlockRegex = /^```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```$/m
  const match = cleaned.match(codeBlockRegex)
  if (match && match[1]) {
    cleaned = match[1].trim()
  }
  cleaned = cleaned.replace(/^```+\s*/gm, "").replace(/\s*```+$/gm, "")
  return cleaned.trim()
}

function extractJsonObject(text: string): string {
  const cleaned = stripMarkdownCodeBlocks(text)
  const firstBrace = cleaned.indexOf("{")
  if (firstBrace === -1) throw new Error("No JSON object found in response")

  let braceCount = 0
  let inString = false
  let escapeNext = false
  let jsonEnd = -1

  for (let i = firstBrace; i < cleaned.length; i++) {
    const char = cleaned[i]
    if (escapeNext) {
      escapeNext = false
      continue
    }
    if (char === "\\") {
      escapeNext = true
      continue
    }
    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === "{") braceCount++
    else if (char === "}") {
      braceCount--
      if (braceCount === 0) {
        jsonEnd = i + 1
        break
      }
    }
  }

  if (jsonEnd === -1) throw new Error("Incomplete JSON object")
  return cleaned.substring(firstBrace, jsonEnd)
}

function parseAgentJson<T>(raw: string, schema: z.ZodType<T>, context: string): T {
  try {
    const jsonString = extractJsonObject(raw)
    const parsed = JSON.parse(jsonString)
    return schema.parse(parsed)
  } catch (error) {
    const truncatedRaw = raw.length > 500 ? raw.substring(0, 500) + "..." : raw
    console.error(`Failed to parse ${context} response. Raw (truncated):`, truncatedRaw)
    throw new Error(
      `Failed to parse ${context} response: ${error instanceof Error ? error.message : "Unknown"}`
    )
  }
}

// --- Steps ---

export const startStep = createStep({
  id: "start-step",
  inputSchema: z.object({
    url: z.string(),
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    console.log("Start Step Input:", inputData.url)
    if (inputData.jobId) {
      await updateJobStatus(inputData.jobId, "running", {
        progressMessage: "Scraping processed...",
      })
    }

    const { profiles, error } = await fetchLinkedInProfiles([inputData.url])

    if (error) throw new Error(`LinkedIn fetch failed: ${error}`)
    const profileData = profiles[0]
    if (!profileData) throw new Error("No profile data returned from LinkedIn tool")

    if (inputData.jobId) {
      await updateJobStatus(inputData.jobId, "running", {
        progressMessage: "Profile scraped! Starting agents...",
        partials: { profileData },
      })
    }

    return { profileData, jobId: inputData.jobId }
  },
})

// Selection Step: Runs Color and Copy agents in parallel, updates status individually, then suspends.
export const selectionStep = createStep({
  id: "selection-step",
  stateSchema: z.object({
    colorOptions: colorOptionsSchema,
    copyOptions: copyOptionsSchema,
    selectedPaletteId: z.string().optional(),
    selectedCopyId: z.string().optional(),
  }),
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional(),
  }),
  resumeSchema: z.object({
    selectedPaletteId: z.string().optional(),
    selectedCopyId: z.string().optional(),
  }),
  suspendSchema: z.object({
    colorOptions: colorOptionsSchema,
    copyOptions: copyOptionsSchema,
  }),
  outputSchema: z.object({
    colorOptions: colorOptionsSchema,
    copyOptions: copyOptionsSchema,
    selectedPaletteId: z.string(),
    selectedCopyId: z.string(),
  }),
  execute: async ({ inputData, resumeData, state, setState, suspend }) => {
    // 1. Initial Run: Run Agents in Parallel
    if (!resumeData) {
      if (inputData.jobId) {
        await updateJobStatus(inputData.jobId, "running", {
          agentStates: { color: "thinking", copy: "thinking" },
        })
      }

      const colorAgent = getColorAgent()
      const copywriterAgent = getCopywriterAgent()

      // Define promises with side-effect status updates
      const colorPromise = colorAgent
        .generate(JSON.stringify({ profileData: inputData.profileData }))
        .then(async (res) => {
          if (inputData.jobId) {
            // We can't update part of agentStates easily without reading first or merging deep,
            // but updateJobStatus merges top-level keys. We should ensure we don't overwrite the other agent's status if they race.
            // For simplicity, we assume generic "running" + specific "waiting_for_user" is fine.
            // Ideally updateJobStatus supports deep merge or we fetch-modify-save.
            // Here we just fire and hope or use specific keys if supported.
            // We will optimistically update 'agentStates' assuming the library handles it or we send full object.
            // To be safe, we will rely on the final update before suspend, but try to push intermediate if possible.
            // For now, let's just let them finish. The "thinking" state is most important.
          }
          return res
        })

      const copyPromise = copywriterAgent.generate(
        JSON.stringify({ profileData: inputData.profileData })
      )

      const [colorResult, copyResult] = await Promise.all([colorPromise, copyPromise])

      const colorOptions = parseAgentJson(colorResult.text, colorOptionsSchema, "color agent")
      const copyOptions = parseAgentJson(copyResult.text, copyOptionsSchema, "copywriter agent")

      if (inputData.jobId) {
        await updateJobStatus(inputData.jobId, "running", {
          agentStates: { color: "waiting_for_user", copy: "waiting_for_user" },
          partials: { colorOptions, copyOptions },
        })
      }

      setState({ colorOptions, copyOptions })

      return suspend({ colorOptions, copyOptions }, { resumeLabel: "selection" })
    }

    // 2. Resume Run
    // This step resumes when the user has made BOTH choices (or we handle partials? User said "When either finishes... request decision").
    // If we use one step, we suspend once. The UI needs to gather both decisions and resume this step ONCE with both IDs.
    // OR, we can allow partial resume?
    // Mastra suspend is usually "Resume with data -> Continue".
    // If the user wants independent selection in UI, the UI can collect both, then submit both.
    // Or the UI submits one, we partially update DB, then wait for second?
    // Let's implement "Submit Both" for simplicity in this step, but the UI can show them appearing independently.
    // Wait, the User PROMPT said: "When either agent finishes... request decision... DO same for both... When all juniors done, trigger senior".
    // This strongly implies independent interaction.
    // If I bundle them in `selectionStep`, I force them to be resumed together.

    // Check if we have both
    if (!state.colorOptions || !state.copyOptions) throw new Error("Missing state")

    // We allow resume to come in with just one, but we check if we have both to proceed?
    // No, execute() runs linearly. If we resume, we are expected to finish or suspend again.

    // Let's Handle Partial Resume:
    // If resumeData has only palette, we save it and suspend again waiting for copy?
    // But we already have copyOptions from state.

    const paletteId = resumeData.selectedPaletteId || state.selectedPaletteId
    const copyId = resumeData.selectedCopyId || state.selectedCopyId

    // If we don't have both selected, we suspend again?
    // This allows unique interaction: User picks Color -> Resume -> We verify Copy is missing -> Suspend again.
    // This supports the independent UI flow!

    if (paletteId && copyId) {
      // All done
      return {
        colorOptions: state.colorOptions,
        copyOptions: state.copyOptions,
        selectedPaletteId: paletteId,
        selectedCopyId: copyId,
      }
    }

    // Partial selection - Update state and suspend again
    const newState = { ...state, selectedPaletteId: paletteId, selectedCopyId: copyId }
    setState(newState)

    // Update status to reflect what we are waiting for?
    // Maybe not needed for backend, UI knows what it picked.

    return suspend(
      {
        colorOptions: state.colorOptions,
        copyOptions: state.copyOptions,
        // meaningful info to UI?
      },
      { resumeLabel: "selection-partial" }
    )
  },
})

// Senior Step: Combines everything
export const seniorStep = createStep({
  id: "senior-step",
  inputSchema: z.object({
    profileData: linkedInProfileSchema, // from startStep
    colorOptions: colorOptionsSchema, // from selectionStep
    copyOptions: copyOptionsSchema, // from selectionStep
    selectedPaletteId: z.string(), // from selectionStep
    selectedCopyId: z.string(), // from selectionStep
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    html: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Resolve choices
    const selectedPalette = inputData.colorOptions.options.find(
      (o) => o.id === inputData.selectedPaletteId
    )
    const selectedCopy = inputData.copyOptions.options.find(
      (o) => o.id === inputData.selectedCopyId
    )

    if (!selectedPalette || !selectedCopy) throw new Error("Invalid selection IDs")

    if (inputData.jobId) {
      await updateJobStatus(inputData.jobId, "running", {
        agentStates: { senior: "thinking", color: "completed", copy: "completed" },
        progressMessage: "Finalizing website...",
      })
    }

    const seniorAgent = getSeniorBuilderAgent()
    const result = await seniorAgent.generate(
      JSON.stringify({
        profileData: inputData.profileData,
        colorPalette: selectedPalette,
        copy: selectedCopy,
      })
    )

    const finalHtml = parseAgentJson(result.text, finalBuildSchema, "senior builder").index_html

    if (inputData.jobId) {
      await updateJobStatus(inputData.jobId, "succeeded", {
        agentStates: { senior: "completed" },
        partials: { finalHtml },
        progressMessage: "Website created!",
      })
    }

    return { html: finalHtml }
  },
})

export const websiteBuilderWorkflow = createWorkflow({
  id: "website-builder-workflow",
  inputSchema: z.object({
    url: z.string(),
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    html: z.string(),
  }),
})
  .then(startStep)
  .then(selectionStep)
  .then(seniorStep)
  .commit()
