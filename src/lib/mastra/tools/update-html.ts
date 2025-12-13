import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { updateJobPartial } from "../../api/generate/endpoints/status"
import { updateUserWebsiteData } from "../../db/users"

export const updateHtmlTool = createTool({
  id: "update-html",
  description:
    "Updates the website HTML with the modified version. ALWAYS call this tool when you have made changes to the HTML.",
  inputSchema: z.object({
    jobId: z.string().optional().describe("The ID of the current generation job (if applicable)"),
    userId: z.string().optional().describe("The ID of the user (if applicable)"),
    html: z.string().describe("The full, modified HTML code"),
    description: z.string().describe("A brief description of what was changed"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { jobId, userId, html, description } = context

    console.log(
      `[Tool: update-html] Updating HTML. Job=${jobId}, User=${userId}, Desc=${description}`
    )

    if (!jobId && !userId) {
      throw new Error("Either jobId or userId must be provided")
    }

    try {
      if (jobId) {
        // Try updating generation job (for initial generation flow)
        try {
          await updateJobPartial(jobId, "finalHtml", html)
        } catch (error) {
          // If it fails (e.g. key path invalid or job not found in gen table), try edit store
          console.log(
            `[Tool: update-html] updateJobPartial failed, trying editStore. Msg: ${error instanceof Error ? error.message : "Unknown"}`
          )
          const { editStore } = await import("../../api/edit/edit-store")
          // For edit jobs, we just update 'finalHtml'
          await editStore.update(jobId, { finalHtml: html })
        }
      } else if (userId) {
        await updateUserWebsiteData(userId, { indexHtml: html })
      }

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
