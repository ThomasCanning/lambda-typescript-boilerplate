import { createWorkflow, createStep } from "@mastra/core/workflows"
import { z } from "zod"
import { scraperAgent } from "../agents/scraper"
import { designerAgent } from "../agents/designer"

const scrapeStep = createStep({
  id: "scrape-step",
  inputSchema: z.object({
    url: z.string(),
  }),
  outputSchema: z.object({
    profileData: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log("Scrape Step Input:", inputData)
    try {
      const result = await scraperAgent.generate(`Scrape this LinkedIn profile: ${inputData.url}`)
      console.log("Scraper Agent Result Text:", result.text)
      console.log("Scraper Agent Tool Results:", JSON.stringify(result.toolResults, null, 2))

      // Basic validation to ensure we got JSON back, or fallback to extracting it from tool results if the agent failed to repeat it
      let profileData = result.text

      // If the agent returned empty text but used the tool, try to use the tool result directly
      if (
        (!profileData || profileData.trim().length === 0 || !profileData.trim().startsWith("{")) &&
        result.toolResults &&
        result.toolResults.length > 0
      ) {
        console.log("Agent output invalid/empty, checking tool results...")
        // @ts-expect-error - toolResults structure may vary
        const toolOutput = result.toolResults[0]?.output
        if (toolOutput && toolOutput.profiles && toolOutput.profiles.length > 0) {
          profileData = JSON.stringify(toolOutput.profiles[0])
          console.log("Used tool output directly.")
        }
      }

      return { profileData }
    } catch (error) {
      console.error("Scrape Step Error:", error)
      throw error
    }
  },
})

const designStep = createStep({
  id: "design-step",
  inputSchema: z.object({
    profileData: z.string(),
  }),
  outputSchema: z.object({
    html: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log("Design Step Input Data Length:", inputData.profileData.length)
    try {
      const result = await designerAgent.generate(inputData.profileData)
      console.log("Designer Agent Result Text Length:", result.text.length)
      return { html: result.text }
    } catch (error) {
      console.error("Design Step Error:", error)
      throw error
    }
  },
})

export const websiteBuilderWorkflow = createWorkflow({
  id: "website-builder-workflow",
  inputSchema: z.object({
    url: z.string(),
  }),
  outputSchema: z.object({
    html: z.string(),
  }),
})
  .then(scrapeStep)
  .then(designStep)
  .commit()
