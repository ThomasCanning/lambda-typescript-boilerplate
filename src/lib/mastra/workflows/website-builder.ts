/**
 * Website Builder Workflow
 *
 * Simpler architecture:
 * 1. Worker calls Researcher Agent directly.
 * 2. Worker calls this "Design Workflow" (Junior Agents) to generate options.
 * 3. Worker pauses.
 * 4. User selects options.
 * 5. Worker resumes (calls Senior Agent directly).
 */

import { createWorkflow, createStep } from "@mastra/core/workflows"
import { z } from "zod"
import { linkedInProfileSchema } from "../tools/linkedin-profile"
import { updateJobAgentState, updateJobPartial } from "../../api/generate-status"
import { colorOptionsSchema } from "../agents/color"
import { copyOptionsSchema } from "../agents/copywriter"

// --- Steps ---

// Color Step: Generates options
export const generateColorStep = createStep({
  id: "generate-color-step",
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    colorOptions: colorOptionsSchema,
  }),
  execute: async ({ mastra, inputData }) => {
    console.log("Starting generateColorStep", { jobId: inputData.jobId })

    if (inputData.jobId) {
      await updateJobAgentState(inputData.jobId, "color", "thinking")
    }

    const agent = mastra.getAgent("colorAgent")
    const result = await agent.generate(JSON.stringify({ profileData: inputData.profileData }), {
      output: colorOptionsSchema,
    })

    const colorOptions = JSON.parse(JSON.stringify(result.object))

    if (inputData.jobId) {
      await updateJobPartial(inputData.jobId, "colorOptions", colorOptions)
      await updateJobAgentState(inputData.jobId, "color", "waiting_for_user")
    }

    return { colorOptions }
  },
})

// Copy Step: Generates options
export const generateCopyStep = createStep({
  id: "generate-copy-step",
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    copyOptions: copyOptionsSchema,
  }),
  execute: async ({ mastra, inputData }) => {
    console.log("Starting generateCopyStep", { jobId: inputData.jobId })

    if (inputData.jobId) {
      await updateJobAgentState(inputData.jobId, "copy", "thinking")
    }

    const result = await mastra
      .getAgent("copywriterAgent")
      .generate(JSON.stringify({ profileData: inputData.profileData }), {
        output: copyOptionsSchema,
      })

    const copyOptions = JSON.parse(JSON.stringify(result.object))

    if (inputData.jobId) {
      await updateJobPartial(inputData.jobId, "copyOptions", copyOptions)
      await updateJobAgentState(inputData.jobId, "copy", "waiting_for_user")
    }

    return { copyOptions }
  },
})

export const designWorkflow = createWorkflow({
  id: "design-workflow",
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    // Parallel step output is a map keyed by step ID
    "generate-color-step": z.object({
      colorOptions: colorOptionsSchema,
    }),
    "generate-copy-step": z.object({
      copyOptions: copyOptionsSchema,
    }),
  }),
})
  .parallel([generateColorStep, generateCopyStep])
  .commit()
