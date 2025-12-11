import { Mastra } from "@mastra/core"
import { DynamoDBStore } from "@mastra/dynamodb"
import { designWorkflow } from "./workflows/website-builder"
import { colorAgent } from "./agents/color"
import { copywriterAgent } from "./agents/copywriter"
import { seniorBuilderAgent } from "./agents/seniorBuilder"
import { researcherAgent } from "./agents/researcher"

import { MockStore } from "@mastra/core/storage"

const tableName = process.env.MASTRA_TABLE_NAME || "MastraStore"
const region = process.env.AWS_REGION || "us-east-1"

export const mastra = new Mastra({
  workflows: { designWorkflow },
  storage:
    process.env.NODE_ENV === "development"
      ? new MockStore()
      : new DynamoDBStore({
          name: "dynamodb",
          config: {
            tableName,
            region,
            // @ts-expect-error - removeUndefinedValues is missing from type but required for runtime
            removeUndefinedValues: true,
          },
        }),
  // Add your agents here
  agents: { colorAgent, copywriterAgent, seniorBuilderAgent, researcherAgent },
})
