import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { updateJobPartial } from "../../api/generate-status"

export const updateHtmlTool = createTool({
  id: "update-html",
  description:
    "Updates the website HTML with the modified version. ALWAYS call this tool when you have made changes to the HTML.",
  inputSchema: z.object({
    jobId: z.string().describe("The ID of the current generation job"),
    html: z.string().describe("The full, modified HTML code"),
    description: z.string().describe("A brief description of what was changed"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { jobId, html, description } = context

    console.log(`[Tool: update-html] Updating HTML for job ${jobId}. Description: ${description}`)

    try {
      await updateJobPartial(jobId, "finalHtml", html)
      return {
        success: true,
        message: "HTML updated successfully",
      }
    } catch (error) {
      console.error("[Tool: update-html] Failed to update HTML", error)
      throw new Error("Failed to save HTML changes to database")
    }
  },
})
