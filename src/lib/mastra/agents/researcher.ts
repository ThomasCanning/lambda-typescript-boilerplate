import { Agent } from "@mastra/core/agent"
import { vertex } from "../providers/vertex"
import { linkedInProfileTool } from "../tools/linkedin-profile"

export const researcherAgent = new Agent({
  name: "researcher-agent",
  model: vertex("gemini-2.0-flash"),
  instructions: `You are a researcher. You must call the linkedInProfileTool which calls an API to fetch LinkedIn profile data for someone. You are doing this for the purpose of building a personal portfolio website for them. You should strip out any empty, null, or broken values from the data, or anything that you think is completely irrelevant to the person's profile.`,
  tools: { linkedInProfileTool },
})
