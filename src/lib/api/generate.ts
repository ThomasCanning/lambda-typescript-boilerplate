import { getColorAgent, getCopywriterAgent, getSeniorBuilderAgent } from "../mastra/agents"
import { fetchLinkedInProfiles, type LinkedInProfile } from "../mastra/tools/linkedin-profile"
import { z } from "zod"

export interface GenerateRequest {
  prompt: string
}

export interface GenerateResult {
  text: string
  toolResults?: unknown[]
}

export interface GeneratePartials {
  profileData?: LinkedInProfile
  draftHtml?: string
  colorOptions?: z.infer<typeof colorOptionsSchema>
  copyOptions?: z.infer<typeof copyOptionsSchema>
  styleOptions?: {
    options: Array<{
      id: string
      label: string
      css_variables?: Record<string, string>
      layout_description?: string
      html_preview_snippet?: string
    }>
  }
  finalHtml?: string
}

export interface GenerateProgressUpdate {
  step: "scrape" | "draft" | "options" | "awaiting_choices" | "style" | "final" | "complete"
  message?: string
  partials?: GeneratePartials
}

/**
 * Wraps an async operation with a timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${errorMessage} (timeout after ${timeoutMs}ms)`)), timeoutMs)
  })
  return Promise.race([promise, timeout])
}

const paletteOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  primary: z.string(),
  secondary: z.string(),
  background: z.string(),
  text: z.string(),
  accent: z.string(),
})

const colorOptionsSchema = z.object({
  options: z.array(paletteOptionSchema).length(6),
})

const copyOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  headline: z.string(),
  bio: z.string(),
})

const copyOptionsSchema = z.object({
  options: z.array(copyOptionSchema).length(3),
})

const draftSchema = z.object({
  index_html: z.string(),
})

/**
 * Strips markdown code blocks from a string if present.
 * Handles formats like ```json ... ```, ``` ... ```, etc.
 */
function stripMarkdownCodeBlocks(text: string): string {
  // Remove markdown code blocks (```json, ```, etc.)
  let cleaned = text.trim()

  // Match code blocks with optional language identifier
  const codeBlockRegex = /^```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```$/m
  const match = cleaned.match(codeBlockRegex)
  if (match && match[1]) {
    cleaned = match[1].trim()
  }

  // Also handle cases where there might be multiple code blocks or partial blocks
  // Remove any remaining ``` markers
  cleaned = cleaned.replace(/^```+\s*/gm, "").replace(/\s*```+$/gm, "")

  return cleaned.trim()
}

/**
 * Extracts the first complete JSON object from text that may contain extra content.
 * Handles cases where there's text before/after the JSON, or multiple JSON objects.
 */
function extractJsonObject(text: string): string {
  const cleaned = stripMarkdownCodeBlocks(text)

  // Find the first { and try to find the matching closing }
  const firstBrace = cleaned.indexOf("{")
  if (firstBrace === -1) {
    throw new Error("No JSON object found in response")
  }

  // Start from the first { and find the matching closing brace
  let braceCount = 0
  let inString = false
  let escapeNext = false
  let jsonEnd = -1

  for (let i = firstBrace; i < cleaned.length; i++) {
    const char = cleaned[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === "\\") {
      escapeNext = true
      continue
    }

    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === "{") {
      braceCount++
    } else if (char === "}") {
      braceCount--
      if (braceCount === 0) {
        jsonEnd = i + 1
        break
      }
    }
  }

  if (jsonEnd === -1) {
    throw new Error("Incomplete JSON object - no matching closing brace found")
  }

  return cleaned.substring(firstBrace, jsonEnd)
}

function parseAgentJson<T>(raw: string, schema: z.ZodType<T>, label: string): T {
  try {
    // Extract the JSON object from potentially messy response
    const jsonString = extractJsonObject(raw)
    const parsed = JSON.parse(jsonString)
    return schema.parse(parsed)
  } catch (error) {
    // Log the raw response for debugging (truncated to avoid huge logs)
    const truncatedRaw = raw.length > 500 ? raw.substring(0, 500) + "..." : raw
    console.error(`Failed to parse ${label} response. Raw (truncated):`, truncatedRaw)

    const message = error instanceof Error ? error.message : "Unknown parsing error"
    throw new Error(`Failed to parse ${label} response: ${message}`)
  }
}

/**
 * Run the generation job while emitting coarse-grained progress updates so we can
 * surface meaningful status to the UI (e.g., "Scraping profile", "Designing site").
 */
export async function runGenerateJob(
  prompt: string,
  onProgress?: (update: GenerateProgressUpdate) => Promise<void> | void
): Promise<GenerateResult> {
  const report = async (update: GenerateProgressUpdate) => {
    if (!onProgress) return
    try {
      await onProgress(update)
    } catch (error) {
      console.error("Failed to report progress", error)
    }
  }

  await report({ step: "scrape", message: "Scraping LinkedIn profile data" })

  const { profiles, error } = await fetchLinkedInProfiles([prompt])
  if (error) {
    throw new Error(error)
  }

  const profileData: LinkedInProfile | undefined = profiles[0]
  if (!profileData) {
    throw new Error("No LinkedIn profile data returned")
  }

  await report({
    step: "scrape",
    message: "LinkedIn profile scraped",
    partials: { profileData },
  })

  await report({ step: "draft", message: "Generating options and draft wireframe" })

  const seniorBuilderAgent = getSeniorBuilderAgent()
  const colorAgent = getColorAgent()
  const copywriterAgent = getCopywriterAgent()

  // Start all three agents in parallel
  const draftPromise = withTimeout(
    seniorBuilderAgent.generate(
      JSON.stringify({
        mode: "Mode A (Draft)",
        profileData,
        instructions: 'Return JSON only: {"index_html":"<html>...</html>"}',
      })
    ),
    120000,
    "Draft builder timed out"
  )

  const colorPromise = withTimeout(
    colorAgent.generate(JSON.stringify({ profileData })),
    60000,
    "Color agent timed out"
  )

  const copyPromise = withTimeout(
    copywriterAgent.generate(JSON.stringify({ profileData })),
    60000,
    "Copywriter agent timed out"
  )

  // Wait for color and copy options first (they're usually faster)
  const [colorResult, copyResult] = await Promise.all([colorPromise, copyPromise])

  const colorOptions = parseAgentJson(colorResult.text, colorOptionsSchema, "color options")
  const copyOptions = parseAgentJson(copyResult.text, copyOptionsSchema, "copy options")

  // Report options immediately when ready (draft can continue in background)
  await report({
    step: "awaiting_choices",
    message: "Color and copy options ready - waiting for your choices",
    partials: {
      profileData,
      colorOptions,
      copyOptions,
      // draftHtml will be added when ready
    },
  })

  // Continue waiting for draft in the background
  const draftResult = await draftPromise
  const draftHtml = parseAgentJson(draftResult.text, draftSchema, "draft").index_html

  // Update with draft when it's ready (if user hasn't made choices yet)
  await report({
    step: "awaiting_choices",
    message: "Draft wireframe ready - waiting for your choices",
    partials: {
      profileData,
      draftHtml,
      colorOptions,
      copyOptions,
    },
  })

  return {
    text: draftHtml,
    toolResults: draftResult.toolResults,
  }
}

// Legacy synchronous API used by the old handler; prefer runGenerateJob directly.
export async function generate(body: string): Promise<GenerateResult> {
  const request: GenerateRequest = JSON.parse(body)
  return runGenerateJob(request.prompt)
}
