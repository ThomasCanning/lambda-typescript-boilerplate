import { Mastra } from "@mastra/core/mastra"
import { scraperAgent } from "./agents/scraper"
import { designerAgent } from "./agents/designer"
import { websiteBuilderWorkflow } from "./workflows"

export const mastra = new Mastra({
  agents: { scraperAgent, designerAgent },
  workflows: { websiteBuilderWorkflow },
})
