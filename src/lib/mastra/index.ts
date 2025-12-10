import { Mastra } from "@mastra/core"
import { DynamoDBStore } from "@mastra/dynamodb"
import { websiteBuilderWorkflow } from "./workflows/website-builder"
import { colorAgent } from "./agents/color"
import { copywriterAgent } from "./agents/copywriter"
import { seniorBuilderAgent } from "./agents/seniorBuilder"
import { researcherAgent } from "./agents/researcher"

const tableName = process.env.MASTRA_TABLE_NAME || "MastraStore"
const region = process.env.AWS_REGION || "us-east-1"

export const mastra = new Mastra({
  workflows: { websiteBuilderWorkflow },
  storage: new DynamoDBStore({
    name: "dynamodb",
    config: {
      tableName,
      region,
    },
  }),
  // Add your agents here
  agents: { colorAgent, copywriterAgent, seniorBuilderAgent, researcherAgent },
})
