import { Mastra } from "@mastra/core"
import { DynamoDBStore } from "@mastra/dynamodb"
import { designWorkflow } from "./workflows/website-builder"
import { colorAgent } from "./agents/color"
import { copywriterAgent } from "./agents/copywriter"
import { seniorBuilderAgent } from "./agents/seniorBuilder"
import { selectAgent } from "./agents/selectAgent"
import { planAgent } from "./agents/planAgent"
import { editorAgent } from "./agents/editAgent"

import { MockStore } from "@mastra/core/storage"

const tableName = process.env.MASTRA_TABLE_NAME || "MastraStore"
const region = process.env.AWS_REGION || "us-east-1"

// Silence Mastra telemetry warnings
// @ts-expect-error - internal flag to disable telemetry
globalThis.___MASTRA_TELEMETRY___ = true

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
  agents: { colorAgent, copywriterAgent, seniorBuilderAgent, selectAgent, planAgent, editorAgent },
})
