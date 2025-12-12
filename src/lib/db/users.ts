import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"

// --- Types ---

export interface User {
  userId: string
  email: string
  createdAt: string
  updatedAt: string
  websiteData: WebsiteData
}

export interface WebsiteData {
  indexHtml?: string
  palette?: ColorPalette
  copy?: CopyStyle
  profileData?: LinkedInProfile
}

export interface ColorPalette {
  id: string
  label?: string
  background?: string
  text?: string
  primary?: string
  secondary?: string
  accent?: string
  // Allow other color fields
  [key: string]: string | undefined
}

export interface CopyStyle {
  id: string
  label?: string
  headline?: string
  bio?: string
  // Allow other copy fields
  [key: string]: string | undefined
}

// Minimal LinkedIn Profile Type based on example
export interface LinkedInProfile {
  basic_info?: {
    first_name?: string
    last_name?: string
    fullname?: string
    headline?: string
    about?: string
    profile_picture_url?: string
    // ... other fields
    [key: string]: unknown
  }
  experience?: Array<Record<string, unknown>>
  education?: Array<Record<string, unknown>>
  // ... other sections
  [key: string]: unknown
}

// --- Client ---

function createDynamoClient() {
  const config = process.env.AWS_REGION ? { region: process.env.AWS_REGION } : {}
  return DynamoDBDocumentClient.from(new DynamoDBClient(config), {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  })
}

export async function getUser(userId: string): Promise<User | null> {
  const tableName = process.env.USERS_TABLE
  if (!tableName) {
    throw new Error("Missing required environment variable: USERS_TABLE")
  }
  const client = createDynamoClient()

  try {
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { userId },
      })
    )

    if (!result.Item) return null
    return result.Item as User
  } catch (error) {
    console.error(`[getUser] Failed to fetch user ${userId}`, error)
    throw error
  }
}
