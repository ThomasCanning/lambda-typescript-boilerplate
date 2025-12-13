import { mastra } from "../../mastra"
import { editorSchema } from "../../mastra/agents/editAgent"

export interface ExecuteEditInput {
  jobId?: string
  userId?: string
  plan: unknown
  currentHtml: string
}

export async function executeEdit({ jobId, userId, plan, currentHtml }: ExecuteEditInput) {
  const editorAgent = mastra.getAgent("editorAgent")

  const idString = jobId ? `Job ID: ${jobId}` : `User ID: ${userId}`

  const result = await editorAgent.generate(
    `
    ${idString}
    
    CURRENT HTML:
    ${currentHtml}

    USER REQUEST (IMPLEMENTATION PLAN):
    ${JSON.stringify(plan, null, 2)}
    `,
    { output: editorSchema }
  )

  return result.object
}
