import { Mastra } from "@mastra/core/mastra"
import { getColorAgent, getCopywriterAgent, getSeniorBuilderAgent, getStyleAgent } from "./agents"
import { websiteBuilderWorkflow } from "./workflows"

let mastraInstance: Mastra | null = null

export function getMastra(): Mastra {
  if (mastraInstance) return mastraInstance

  mastraInstance = new Mastra({
    agents: {
      colorAgent: getColorAgent(),
      copywriterAgent: getCopywriterAgent(),
      styleAgent: getStyleAgent(),
      seniorBuilderAgent: getSeniorBuilderAgent(),
    },
    workflows: { websiteBuilderWorkflow },
  })

  return mastraInstance
}
