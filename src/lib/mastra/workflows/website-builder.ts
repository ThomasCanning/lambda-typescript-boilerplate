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
    if (inputData.jobId) {
      await updateJobAgentState(inputData.jobId, "color", "thinking")
    }

    const agent = mastra.getAgent("colorAgent")
    const payload = JSON.stringify({ profileData: inputData.profileData })
    console.log("Color Agent Input Payload:", payload)

    const result = await agent.generate(payload, {
      output: colorOptionsSchema,
    })
    // Log success without dumping object
    console.log("Color Agent finished.")

    const colorOptions = JSON.parse(JSON.stringify(result.object))

    if (inputData.jobId) {
      // We still update partials so they are safe in DB
      await updateJobPartial(inputData.jobId, "colorOptions", colorOptions)
      // signal completion to "thinking" -> "completed" so UI knows this specific agent is done
      await updateJobAgentState(inputData.jobId, "color", "completed")
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
    if (inputData.jobId) {
      await updateJobAgentState(inputData.jobId, "copy", "thinking")
    }

    const result = await mastra
      .getAgent("copywriterAgent")
      .generate(JSON.stringify({ profileData: inputData.profileData }), {
        output: copyOptionsSchema,
      })
    // Log success without dumping object
    console.log("Copy Agent finished.")

    const copyOptions = JSON.parse(JSON.stringify(result.object))

    if (inputData.jobId) {
      // We still update partials so they are safe in DB
      await updateJobPartial(inputData.jobId, "copyOptions", copyOptions)
      // signal completion to "thinking" -> "completed" so UI knows this specific agent is done
      await updateJobAgentState(inputData.jobId, "copy", "completed")
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
