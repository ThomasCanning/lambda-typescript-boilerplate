import { Mastra } from "@mastra/core/mastra"
import { getScraperAgent } from "./agents/scraper"
import { getDesignerAgent } from "./agents/designer"
import { websiteBuilderWorkflow } from "./workflows"

let mastraInstance: Mastra | null = null

export function getMastra(): Mastra {
  if (mastraInstance) return mastraInstance

  mastraInstance = new Mastra({
    agents: {
      scraperAgent: getScraperAgent(),
      designerAgent: getDesignerAgent(),
    },
    workflows: { websiteBuilderWorkflow },
  })

  return mastraInstance
}
