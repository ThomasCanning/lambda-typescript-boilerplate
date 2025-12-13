import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export interface EditJob {
  jobId: string
  screenshot?: string
  prompt?: string
  selectedHtml?: string
  originalHtml?: string
  finalHtml?: string
  status?: "pending" | "running" | "succeeded" | "failed"
  agentStates?: {
    selector?: "idle" | "thinking" | "completed"
    planner?: "idle" | "thinking" | "completed"
    editor?: "idle" | "thinking" | "completed"
  }
  error?: string
}

export const editStore = {
  get: async (jobId: string): Promise<EditJob | undefined> => {
    const TABLE_NAME = process.env.EDIT_JOBS_TABLE
    if (!TABLE_NAME) throw new Error("EDIT_JOBS_TABLE not set")

    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { jobId },
      })
    )
    return result.Item as EditJob | undefined
  },

  update: async (jobId: string, updates: Partial<Omit<EditJob, "jobId">>) => {
    const TABLE_NAME = process.env.EDIT_JOBS_TABLE
    if (!TABLE_NAME) throw new Error("EDIT_JOBS_TABLE not set")

    const updateExpParts: string[] = []
    const expAttrValues: Record<string, unknown> = {}
    const expAttrNames: Record<string, string> = {}

    for (const [key, value] of Object.entries(updates)) {
      updateExpParts.push(`#${key} = :${key}`)
      expAttrNames[`#${key}`] = key
      expAttrValues[`:${key}`] = value
    }

    if (updateExpParts.length === 0) return

    await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { jobId },
        UpdateExpression: `SET ${updateExpParts.join(", ")}`,
        ExpressionAttributeNames: expAttrNames,
        ExpressionAttributeValues: expAttrValues,
      })
    )
  },
}
