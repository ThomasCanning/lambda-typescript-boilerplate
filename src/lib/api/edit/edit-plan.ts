import { mastra } from "../../mastra"
import { editPlanSchema } from "../../mastra/agents/planAgent"

export async function createEditPlan(prompt: string, selectedHtml: string) {
  const planAgent = mastra.getAgent("planAgent")

  const result = await planAgent.generate(
    JSON.stringify({
      prompt,
      selectedHtml,
    }),
    { output: editPlanSchema }
  )

  return result.object
}
