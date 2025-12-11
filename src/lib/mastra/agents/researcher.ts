import { Agent } from "@mastra/core/agent"
import { vertex } from "../providers/vertex"
import { linkedInProfileTool } from "../tools/linkedin-profile"

export const researcherAgent = new Agent({
  name: "researcher-agent",
  model: vertex("gemini-2.5-flash-lite-preview-09-2025"),
  instructions: `You are a researcher. Your sole task is to call the linkedInProfileTool to fetch LinkedIn profile data for a given URL and return the results. Do not filter or summarize the data.`,
  tools: { linkedInProfileTool },
})
