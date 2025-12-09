import { createWorkflow, createStep } from "@mastra/core/workflows"
import { z } from "zod"
import { getColorAgent, getCopywriterAgent, getSeniorBuilderAgent, getStyleAgent } from "../agents"
import { fetchLinkedInProfiles, linkedInProfileSchema } from "../tools/linkedin-profile"
import { updateJobStatus } from "../../api/generate-status"

// --- Schemas (Copied from previous implementation) ---
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

const styleOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  css_variables: z
    .record(z.string(), z.string())
    .describe("CSS custom properties keyed by variable name"),
  layout_description: z.string(),
  html_preview_snippet: z.string(),
})

const styleOptionsSchema = z.object({
  options: z.array(styleOptionSchema).length(3),
})

const draftSchema = z.object({
  index_html: z.string(),
})

// --- Helper Functions ---
function stripMarkdownCodeBlocks(text: string): string {
  let cleaned = text.trim()
  const codeBlockRegex = /^```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```$/m
  const match = cleaned.match(codeBlockRegex)
  if (match && match[1]) {
    cleaned = match[1].trim()
  }
  cleaned = cleaned.replace(/^```+\s*/gm, "").replace(/\s*```+$/gm, "")
  return cleaned.trim()
}

function extractJsonObject(text: string): string {
  const cleaned = stripMarkdownCodeBlocks(text)
  const firstBrace = cleaned.indexOf("{")
  if (firstBrace === -1) throw new Error("No JSON object found in response")

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
    if (inString) continue

    if (char === "{") braceCount++
    else if (char === "}") {
      braceCount--
      if (braceCount === 0) {
        jsonEnd = i + 1
        break
      }
    }
  }

  if (jsonEnd === -1) throw new Error("Incomplete JSON object")
  return cleaned.substring(firstBrace, jsonEnd)
}

function parseAgentJson<T>(raw: string, schema: z.ZodType<T>, context: string): T {
  try {
    const jsonString = extractJsonObject(raw)
    const parsed = JSON.parse(jsonString)
    return schema.parse(parsed)
  } catch (error) {
    const truncatedRaw = raw.length > 500 ? raw.substring(0, 500) + "..." : raw
    console.error(`Failed to parse ${context} response. Raw (truncated):`, truncatedRaw)
    throw new Error(
      `Failed to parse ${context} response: ${error instanceof Error ? error.message : "Unknown"}`
    )
  }
}

// --- Steps ---

export const scrapeStep = createStep({
  id: "scrape-step",
  inputSchema: z.object({
    url: z.string(),
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    profileData: linkedInProfileSchema,
  }),
  execute: async ({ inputData }) => {
    console.log("Scrape Step Input:", inputData.url)
    if (inputData.jobId) {
      await updateJobStatus(inputData.jobId, "running", {
        progressMessage: "Scraping LinkedIn profile...",
      })
    }

    const { profiles, error } = await fetchLinkedInProfiles([inputData.url])

    if (error) throw new Error(`LinkedIn fetch failed: ${error}`)
    const profileData = profiles[0]
    if (!profileData) throw new Error("No profile data returned from LinkedIn tool")

    if (inputData.jobId) {
      // We can also save the partial profile data here!
      await updateJobStatus(inputData.jobId, "running", {
        progressMessage: "Profile scraped! Analyzing...",
        partials: { profileData },
      })
    }

    return { profileData }
  },
})

// Phase 1: Initial Discovery (Draft + Options)
export const discoveryStep = createStep({
  id: "discovery-step",
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    profileData: linkedInProfileSchema,
    draftHtml: z.string(),
    colorOptions: colorOptionsSchema,
    copyOptions: copyOptionsSchema,
  }),
  execute: async ({ inputData }) => {
    const [seniorBuilderAgent, colorAgent, copywriterAgent] = [
      getSeniorBuilderAgent(),
      getColorAgent(),
      getCopywriterAgent(),
    ]

    if (inputData.jobId) {
      await updateJobStatus(inputData.jobId, "running", {
        progressMessage: "Generating website draft and options...",
      })
    }

    // Use Senior Agent Mode A (Draft)
    const draftPayload = JSON.stringify({
      mode: "Mode A (Draft)",
      profileData: inputData.profileData,
      instructions: 'Return JSON only: {"index_html":"<html>...</html>"}',
    })

    const [draftResult, colorResult, copyResult] = await Promise.all([
      seniorBuilderAgent.generate(draftPayload),
      colorAgent.generate(JSON.stringify({ profileData: inputData.profileData })),
      copywriterAgent.generate(JSON.stringify({ profileData: inputData.profileData })),
    ])

    const draftHtml = parseAgentJson(
      draftResult.text,
      draftSchema,
      "senior builder draft"
    ).index_html
    const colorOptions = parseAgentJson(colorResult.text, colorOptionsSchema, "color agent")
    const copyOptions = parseAgentJson(copyResult.text, copyOptionsSchema, "copywriter agent")

    return {
      profileData: inputData.profileData,
      draftHtml,
      colorOptions,
      copyOptions,
    }
  },
})

// Phase 2: Color Injection & Style Discovery
export const colorInjectionStep = createStep({
  id: "color-injection-step",
  stateSchema: z.object({
    draftHtml: z.string(), // Holds the 'Draft' then 'Colored Draft'
    colorOptions: colorOptionsSchema,
    copyOptions: copyOptionsSchema,
    profileData: linkedInProfileSchema,
  }),
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    draftHtml: z.string(),
    colorOptions: colorOptionsSchema,
    copyOptions: copyOptionsSchema,
  }),
  resumeSchema: z.object({
    selectedPaletteId: z.string(),
  }),
  suspendSchema: z.object({
    draftHtml: z.string(),
    colorOptions: colorOptionsSchema,
    copyOptions: copyOptionsSchema,
    profileData: linkedInProfileSchema,
  }),
  outputSchema: z.object({
    profileData: linkedInProfileSchema,
    draftHtml: z.string(), // Updated with colors
    colorOptions: colorOptionsSchema,
    copyOptions: copyOptionsSchema,
    selectedPaletteId: z.string(),
    styleOptions: styleOptionsSchema,
  }),
  execute: async ({ inputData, resumeData, state, setState, suspend }) => {
    // 1. If no resume data (first run), suspend and ask for Color Choice
    if (!resumeData) {
      // Store initial state
      setState({
        draftHtml: inputData.draftHtml,
        colorOptions: inputData.colorOptions,
        copyOptions: inputData.copyOptions,
        profileData: inputData.profileData,
      })

      return suspend(
        {
          draftHtml: inputData.draftHtml,
          colorOptions: inputData.colorOptions,
          copyOptions: inputData.copyOptions,
          profileData: inputData.profileData,
        },
        { resumeLabel: "palette-selection" }
      )
    }

    // 2. We have resume data (User picked a color)
    if (!state.draftHtml || !state.colorOptions || !state.profileData) {
      throw new Error("State missing for color injection phase")
    }

    const selectedPalette = state.colorOptions.options.find(
      (o) => o.id === resumeData.selectedPaletteId
    )
    if (!selectedPalette)
      throw new Error(`Selected palette ${resumeData.selectedPaletteId} not found`)

    // Parallel: Generate Styles (Style Agent) ONLY - No more Mode B Color Injection
    const styleAgent = getStyleAgent()

    const [styleResult] = await Promise.all([
      styleAgent.generate(
        JSON.stringify({
          profileData: state.profileData,
          selectedPalette,
        })
      ),
    ])

    const styleOptions = parseAgentJson(styleResult.text, styleOptionsSchema, "style agent")

    return {
      profileData: state.profileData,
      draftHtml: state.draftHtml, // Keep original B&W draft
      colorOptions: state.colorOptions,
      copyOptions: state.copyOptions,
      selectedPaletteId: resumeData.selectedPaletteId,
      styleOptions,
    }
  },
})

// Phase 3: Final Build (Wait for Style/Copy choices)
// Note: We can combine Copy + Style selection in one step if the UI does them together,
// or split them. Based on user request "When copywrite finishes... When styling finishes...",
// but usually these are presented together in the "Next" phase.
// For now, I'll assume the user selects Style and Copy together or sequentially after color.
export const finalBuildStep = createStep({
  id: "final-build-step",
  stateSchema: z.object({
    draftHtml: z.string(),
    styleOptions: styleOptionsSchema,
    copyOptions: copyOptionsSchema,
    colorOptions: colorOptionsSchema, // Needed to find selected palette object
    selectedPaletteId: z.string(),
    profileData: linkedInProfileSchema,
  }),
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    draftHtml: z.string(),
    colorOptions: colorOptionsSchema,
    copyOptions: copyOptionsSchema,
    selectedPaletteId: z.string(),
    styleOptions: styleOptionsSchema,
  }),
  resumeSchema: z.object({
    selectedStyleId: z.string(),
    selectedCopyId: z.string(),
  }),
  suspendSchema: z.object({
    draftHtml: z.string(),
    styleOptions: styleOptionsSchema,
    copyOptions: copyOptionsSchema,
    // We don't strictly need to return everything in suspend if we don't display it,
    // but good for completeness for the UI
  }),
  outputSchema: z.object({
    html: z.string(),
  }),
  execute: async ({ inputData, resumeData, state, setState, suspend }) => {
    if (!resumeData) {
      setState({
        draftHtml: inputData.draftHtml,
        styleOptions: inputData.styleOptions,
        copyOptions: inputData.copyOptions,
        colorOptions: inputData.colorOptions,
        selectedPaletteId: inputData.selectedPaletteId,
        profileData: inputData.profileData,
      })

      return suspend(
        {
          draftHtml: inputData.draftHtml,
          styleOptions: inputData.styleOptions,
          copyOptions: inputData.copyOptions,
        },
        { resumeLabel: "style-copy-selection" }
      )
    }

    if (!state.draftHtml || !state.styleOptions || !state.copyOptions || !state.colorOptions) {
      throw new Error("State missing for final build phase")
    }

    const selectedStyle = state.styleOptions.options.find(
      (o) => o.id === resumeData.selectedStyleId
    )
    const selectedCopy = state.copyOptions.options.find((o) => o.id === resumeData.selectedCopyId)
    const selectedPalette = state.colorOptions.options.find((o) => o.id === state.selectedPaletteId)

    if (!selectedStyle) throw new Error("Selected style not found")
    if (!selectedCopy) throw new Error("Selected copy not found")
    if (!selectedPalette) throw new Error("Selected palette not found")

    const seniorBuilderAgent = getSeniorBuilderAgent()

    // Use Mode C (Final)
    const finalResult = await seniorBuilderAgent.generate(
      JSON.stringify({
        mode: "Mode C (Final)",
        draftHtml: state.draftHtml, // This is the colored draft
        profileData: state.profileData,
        userChoices: {
          palette: selectedPalette,
          copy: selectedCopy,
          style: selectedStyle,
        },
        instructions: 'Return JSON only: {"index_html":"<html>...</html>"}',
      })
    )

    const finalHtml = parseAgentJson(
      finalResult.text,
      draftSchema,
      "senior builder final"
    ).index_html

    return { html: finalHtml }
  },
})

export const websiteBuilderWorkflow = createWorkflow({
  id: "website-builder-workflow",
  inputSchema: z.object({
    url: z.string(),
    jobId: z.string().optional(),
  }),
  outputSchema: z.object({
    html: z.string(),
  }),
})
  .then(scrapeStep)
  .then(discoveryStep)
  .then(colorInjectionStep)
  .then(finalBuildStep)
  .commit()
