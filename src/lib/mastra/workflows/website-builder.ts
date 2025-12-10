/**
 * Website Builder Workflow
 *
 * 1. Start Step (Scrape): Fetches and structures LinkedIn profile data.
 * 2. Parallel Selection Steps:
 *    - Color Step: Generates palettes -> Suspends for User Choice.
 *    - Copy Step: Generates copy variations -> Suspends for User Choice.
 * 3. Senior Step (Final): Takes scraped data + color choice + copy choice -> Generates Final HTML.
 */

import { createWorkflow, createStep } from "@mastra/core/workflows"
import { z } from "zod"
import { linkedInProfileSchema } from "../tools/linkedin-profile"
import { updateJobStatus, updateJobAgentState, updateJobPartial } from "../../api/generate-status"
import { seniorBuilderAgent, finalBuildSchema } from "../agents/seniorBuilder"
import { colorOptionsSchema } from "../agents/color"
import { copyOptionsSchema } from "../agents/copywriter"

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
  execute: async ({ inputData, mastra }) => {
    if (inputData.jobId) {
      await updateJobStatus(inputData.jobId, "running", {
        progressMessage: "Researcher Agent starting...",
      })
    }

    // Call Researcher Agent to fetch and clean data
    const result = await mastra
      .getAgent("researcherAgent")
      .generate(`Fetch the LinkedIn profile data for this URL: ${inputData.url}`, {
        output: linkedInProfileSchema,
      })

    const profileData = result.object

    if (inputData.jobId) {
      await updateJobStatus(inputData.jobId, "running", {
        progressMessage: "Profile data fetched and cleaned! Starting design agents...",
        partials: { profileData },
        agentStates: { color: "idle", copy: "idle" },
      })
    }

    return { profileData, jobId: inputData.jobId }
  },
})

// Color Step: Generates options -> Suspends -> Returns Selection
export const generateColorStep = createStep({
  id: "generate-color-step",
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    colorOptions: colorOptionsSchema,
    selectedPaletteId: z.string(),
  }),
  stateSchema: z.object({
    generatedOptions: colorOptionsSchema.optional(),
  }),
  resumeSchema: z.object({
    selectedPaletteId: z.string(),
  }),
  execute: async ({ mastra, inputData, resumeData, state, setState, suspend }) => {
    // 1. If we have resumeData, user made a choice
    if (resumeData) {
      if (!state.generatedOptions) {
        // Should not happen if workflow persisted correctly
        throw new Error("Resumed without generated options in state")
      }
      if (inputData.jobId) {
        await updateJobAgentState(inputData.jobId, "color", "completed")
      }
      return {
        colorOptions: state.generatedOptions,
        selectedPaletteId: resumeData.selectedPaletteId,
      }
    }

    // 2. Generate Options (if not already done)
    let colorOptions = state.generatedOptions
    if (!colorOptions) {
      if (inputData.jobId) {
        await updateJobAgentState(inputData.jobId, "color", "thinking")
      }

      const agent = mastra.getAgent("colorAgent")
      const result = await agent.generate(JSON.stringify({ profileData: inputData.profileData }), {
        output: colorOptionsSchema,
      })

      colorOptions = result.object

      setState({ generatedOptions: colorOptions })

      if (inputData.jobId) {
        await updateJobPartial(inputData.jobId, "colorOptions", colorOptions)
        await updateJobAgentState(inputData.jobId, "color", "waiting_for_user")
      }
    }

    // 3. Suspend for selection
    // Note: We update status *before* suspend so UI knows we are waiting
    return suspend(
      { colorOptions }, // suspend payload (informational)
      { resumeLabel: "Select Color" } // resume config
    )
  },
})

// Copy Step: Generates options -> Suspends -> Returns Selection
export const generateCopyStep = createStep({
  id: "generate-copy-step",
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    copyOptions: copyOptionsSchema,
    selectedCopyId: z.string(),
  }),
  stateSchema: z.object({
    generatedOptions: copyOptionsSchema.optional(),
  }),
  resumeSchema: z.object({
    selectedCopyId: z.string(),
  }),
  execute: async ({ mastra, inputData, resumeData, state, setState, suspend }) => {
    // 1. If we have resumeData, user made a choice
    if (resumeData) {
      if (!state.generatedOptions) {
        throw new Error("Resumed without generated options in state")
      }
      if (inputData.jobId) {
        await updateJobAgentState(inputData.jobId, "copy", "completed")
      }
      return {
        copyOptions: state.generatedOptions,
        selectedCopyId: resumeData.selectedCopyId,
      }
    }

    // 2. Generate Options
    let copyOptions = state.generatedOptions
    if (!copyOptions) {
      if (inputData.jobId) {
        await updateJobAgentState(inputData.jobId, "copy", "thinking")
      }

      const result = await mastra
        .getAgent("copywriterAgent")
        .generate(JSON.stringify({ profileData: inputData.profileData }), {
          output: copyOptionsSchema,
        })

      copyOptions = result.object

      setState({ generatedOptions: copyOptions })

      if (inputData.jobId) {
        await updateJobPartial(inputData.jobId, "copyOptions", copyOptions)
        await updateJobAgentState(inputData.jobId, "copy", "waiting_for_user")
      }
    }

    // 3. Suspend
    return suspend({ copyOptions }, { resumeLabel: "Select Copy" })
  },
})

// Senior Step: Combines parallel outputs
export const seniorStep = createStep({
  id: "senior-step",
  inputSchema: z.object({
    profileData: linkedInProfileSchema, // direct from startStep
    // Parallel outputs come in as a map keyed by step ID
    "generate-color-step": z.object({
      colorOptions: colorOptionsSchema,
      selectedPaletteId: z.string(),
    }),
    "generate-copy-step": z.object({
      copyOptions: copyOptionsSchema,
      selectedCopyId: z.string(),
    }),
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    html: z.string(),
  }),
  execute: async ({ inputData }) => {
    const colorResult = inputData["generate-color-step"]
    const copyResult = inputData["generate-copy-step"]
    const { profileData, jobId } = inputData

    // Resolve choices
    const selectedPalette = colorResult.colorOptions.options.find(
      (o) => o.id === colorResult.selectedPaletteId
    )
    const selectedCopy = copyResult.copyOptions.options.find(
      (o) => o.id === copyResult.selectedCopyId
    )

    if (!selectedPalette || !selectedCopy) throw new Error("Invalid selection IDs")

    if (jobId) {
      // Need to re-fetch? No, we have inputs.
      // But update status
      await updateJobStatus(jobId, "running", {
        agentStates: { senior: "thinking", color: "completed", copy: "completed" },
        progressMessage: "Finalizing website...",
      })
    }

    const result = await seniorBuilderAgent.generate(
      JSON.stringify({
        profileData,
        colorPalette: selectedPalette,
        copy: selectedCopy,
      }),
      { output: finalBuildSchema }
    )

    const finalHtml = result.object.index_html

    if (jobId) {
      await updateJobStatus(jobId, "succeeded", {
        agentStates: { senior: "completed" },
        partials: {
          finalHtml,
          profileData, // ensure complete data is in final record
          colorOptions: colorResult.colorOptions,
          copyOptions: copyResult.copyOptions,
        },
        choices: {
          selectedPaletteId: colorResult.selectedPaletteId,
          selectedCopyId: copyResult.selectedCopyId,
        },
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
  .parallel([generateColorStep, generateCopyStep])
  .then(seniorStep)
  .commit()
