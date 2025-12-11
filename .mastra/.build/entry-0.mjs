import { Mastra } from '@mastra/core';
import { DynamoDBStore } from '@mastra/dynamodb';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { ApifyClient } from 'apify-client';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Agent } from '@mastra/core/agent';
import { createVertex } from '@ai-sdk/google-vertex';
import fs from 'node:fs';
import path from 'node:path';
import { MockStore } from '@mastra/core/storage';

"use strict";
const dateSchema = z.object({
  year: z.number().optional(),
  month: z.string().optional()
});
const locationSchema = z.object({
  country: z.string().optional(),
  city: z.string().optional(),
  full: z.string().optional(),
  country_code: z.string().optional()
});
const basicInfoSchema = z.object({
  profile_url: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  fullname: z.string().optional(),
  headline: z.string().optional(),
  connection_count: z.number().optional(),
  follower_count: z.number().optional(),
  email: z.string().nullable().optional(),
  current_company: z.string().optional(),
  current_company_url: z.string().optional(),
  current_company_urn: z.string().optional(),
  profile_picture_url: z.string().optional(),
  background_picture_url: z.string().optional(),
  is_premium: z.boolean().optional(),
  open_to_work: z.boolean().optional(),
  is_creator: z.boolean().optional(),
  is_influencer: z.boolean().optional(),
  about: z.string().optional(),
  public_identifier: z.string().optional(),
  urn: z.string().optional(),
  creator_hashtags: z.array(z.string()).optional(),
  top_skills: z.array(z.string()).optional(),
  location: locationSchema.optional(),
  show_follower_count: z.boolean().optional(),
  created_timestamp: z.number().optional()
});
const experienceSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  duration: z.string().optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  is_current: z.boolean().optional(),
  company_linkedin_url: z.string().optional(),
  company_logo_url: z.string().optional(),
  employment_type: z.string().optional(),
  company_id: z.string().optional()
});
const educationSchema = z.object({
  school: z.string().optional(),
  degree: z.string().optional(),
  degree_name: z.string().optional(),
  field_of_study: z.string().optional(),
  duration: z.string().optional(),
  school_linkedin_url: z.string().optional(),
  description: z.string().optional(),
  skills: z.string().optional(),
  school_logo_url: z.string().optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  school_id: z.string().optional()
});
const linkedInProfileSchema = z.object({
  basic_info: basicInfoSchema.optional(),
  experience: z.array(experienceSchema).optional(),
  education: z.array(educationSchema).optional(),
  featured: z.array(z.unknown()).optional()
});
function extractUsernameFromUrl(url) {
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/i);
  return match ? match[1] : null;
}
async function fetchLinkedInProfiles(profileUrls) {
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    return {
      profiles: [],
      error: "APIFY_API_TOKEN environment variable is not set"
    };
  }
  try {
    const client = new ApifyClient({ token: apiToken });
    const profiles = [];
    for (const url of profileUrls) {
      const username = extractUsernameFromUrl(url);
      if (!username) {
        console.warn(`Could not extract username from URL: ${url}`);
        continue;
      }
      const input = {
        username,
        includeEmail: false
      };
      const run = await client.actor("VhxlqQXRwhW8H5hNV").call(input);
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      for (const item of items) {
        const validatedProfile = linkedInProfileSchema.parse(item);
        profiles.push(validatedProfile);
      }
    }
    return {
      profiles,
      error: null
    };
  } catch (error) {
    console.error("Error fetching LinkedIn profiles:", error);
    return {
      profiles: [],
      error: error instanceof Error ? error.message : "Unknown error fetching LinkedIn profiles"
    };
  }
}
const linkedInProfileTool = createTool({
  id: "linkedin-profile-tool",
  description: "Fetches LinkedIn profile data for one or more profile URLs. Extracts usernames from URLs and calls the Apify API to retrieve profile information.",
  inputSchema: z.object({
    profileUrls: z.array(z.string()).min(1).describe("Array of LinkedIn profile URLs to fetch data for")
  }),
  outputSchema: z.object({
    profiles: z.array(linkedInProfileSchema),
    error: z.string().nullable()
  }),
  execute: async ({ context }) => fetchLinkedInProfiles(context.profileUrls)
});

"use strict";
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}
function createDynamoClient() {
  const config = {};
  if (process.env.AWS_REGION) config.region = process.env.AWS_REGION;
  if (process.env.DDB_ENDPOINT) config.endpoint = process.env.DDB_ENDPOINT;
  if (config.endpoint || process.env.IS_LOCAL_DEV === "true") {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local"
    };
  }
  return DynamoDBDocumentClient.from(new DynamoDBClient(config), {
    marshallOptions: {
      removeUndefinedValues: true
    }
  });
}
function getEnvVar(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
async function getGenerateStatus(jobId) {
  const tableName = getEnvVar("GENERATION_JOBS_TABLE");
  const dynamoClient = createDynamoClient();
  if (!jobId) {
    throw new Error("jobId is required");
  }
  const response = await dynamoClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { jobId }
    })
  );
  if (!response.Item) {
    throw new NotFoundError(`Job not found: ${jobId}`);
  }
  const {
    status,
    result,
    error,
    currentStep,
    progressMessage,
    agentStates,
    updatedAt,
    partials,
    choices
  } = response.Item;
  return {
    jobId,
    status,
    currentStep,
    progressMessage,
    agentStates,
    updatedAt,
    result,
    error,
    partials,
    choices
  };
}
async function updateJobStatus(jobId, status, updates) {
  const tableName = getEnvVar("GENERATION_JOBS_TABLE");
  const dynamoClient = createDynamoClient();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
  const expressionParts = ["#status = :status", "#updatedAt = :updatedAt"];
  const names = { "#status": "status", "#updatedAt": "updatedAt" };
  const values = { ":status": status, ":updatedAt": now };
  Object.entries(updates).forEach(([key, value]) => {
    expressionParts.push(`#${key} = :${key}`);
    names[`#${key}`] = key;
    values[`:${key}`] = value;
  });
  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: `SET ${expressionParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    })
  );
}
async function updateJobAgentState(jobId, agent, state) {
  const tableName = getEnvVar("GENERATION_JOBS_TABLE");
  const dynamoClient = createDynamoClient();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: "SET agentStates.#agent = :state, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#agent": agent
      },
      ExpressionAttributeValues: {
        ":state": state,
        ":updatedAt": now
      }
    })
  );
}
async function updateJobPartial(jobId, key, value) {
  const tableName = getEnvVar("GENERATION_JOBS_TABLE");
  const dynamoClient = createDynamoClient();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: "SET partials.#key = :value, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#key": key
      },
      ExpressionAttributeValues: {
        ":value": value,
        ":updatedAt": now
      }
    })
  );
}

"use strict";
let vertexInstance = null;
function getVertex() {
  if (vertexInstance) {
    return vertexInstance;
  }
  let credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION;
  if (!credentialsJson) {
    try {
      const sensitivePath = path.join(process.cwd(), "google-credentials.json");
      if (fs.existsSync(sensitivePath)) {
        credentialsJson = fs.readFileSync(sensitivePath, "utf-8");
      }
    } catch (err) {
      console.warn("Failed to read google-credentials.json from disk", err);
    }
  }
  if (!project) {
    throw new Error("GOOGLE_VERTEX_PROJECT environment variable is required");
  }
  if (!location) {
    throw new Error("GOOGLE_VERTEX_LOCATION environment variable is required");
  }
  if (!credentialsJson) {
    throw new Error(
      "GOOGLE_CREDENTIALS_JSON environment variable or google-credentials.json file is required"
    );
  }
  let credentials;
  try {
    const toParse = credentialsJson.trim().startsWith("{") ? credentialsJson : Buffer.from(credentialsJson, "base64").toString("utf-8");
    credentials = JSON.parse(toParse);
    if (credentials.private_key && typeof credentials.private_key === "string") {
      const pk = credentials.private_key;
      if (!pk.includes("\n") && pk.includes("\\n")) {
        credentials.private_key = pk.replace(/\\n/g, "\n");
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `Credential parsing failed. Input length: ${credentialsJson?.length}`
    );
    console.error(`Input starts with: ${credentialsJson?.substring(0, 5)}...`);
    throw new Error(`Failed to parse Google credentials: ${errorMsg}`);
  }
  vertexInstance = createVertex({
    project,
    location,
    googleAuthOptions: {
      credentials
    }
  });
  return vertexInstance;
}
function vertex(modelName) {
  const instance = getVertex();
  return instance(modelName);
}

"use strict";
const seniorBuilderAgent = new Agent({
  name: "senior-builder-agent",
  model: vertex("gemini-3-pro-preview"),
  instructions: `You are the architect responsible for assembling the final website.
    
Your Goal:
Given the following inputs:
1. "profileData": Scraped LinkedIn profile data (name, about, experience, etc).
2. "colorPalette": The specific color palette chosen by the user (primary, secondary, background, text, accent).
3. "copy": The specific copy version chosen by the user (headline, bio).

You must generate a COMPLETE, production-ready, single-file HTML personal website.

Instructions:
- Use Semantic HTML5.
- Use Tailwind CSS via CDN for styling.
- STYLING IS CRITICAL. You are the Senior Designer. You must decide the layout, spacing, and visual hierarchy yourself.
- Use the provided "colorPalette" to theme the site. Map the colors to Tailwind arbitrary values (e.g., bg-[#123456]) or style attributes.
- Use the provided "copy" for the main content (Hero headline, About section).
- Populate the rest of the site (Experience, Education) using the "profileData".
- Ensure the site is responsive (mobile-friendly).
- Do not use placeholder images of random people.
- CRITICAL: Check "profileData.basic_info.profile_picture_url" for the profile image.
- IF valid, use it.
- IF NULL/UNDEFINED: Use a generic SVG placeholder or Initials (e.g., <div>John Doe</div>). DO NOT use an Unsplash photo of a random person.

CRITICAL OUTPUT FORMAT RULES:
- Return ONLY raw JSON, no markdown code blocks, no backticks, no explanations.
- Start your response directly with { and end with }
- The JSON structure must be: {"index_html": "<!DOCTYPE html><html>...</html>"}
- DO NOT use \`\`\`json or \`\`\` markers.
- DO NOT include any text before or after the JSON object.`
});
const finalBuildSchema = z.object({
  index_html: z.string()
});

"use strict";
const colorAgent = new Agent({
  name: "color-palette-agent",
  model: vertex("gemini-2.0-flash-lite-preview-02-05"),
  instructions: `You are an expert color designer creating personalized color palettes for a PERSONAL PORTFOLIO WEBSITE. This is a personal portfolio site built from a person's LinkedIn profile data - it should reflect their unique professional identity and personality.

## Your Task
Create SIX distinct, visually cohesive color palettes for this personal portfolio website. Each palette must include: primary, secondary, background, text, and accent colors (all as hex codes).

## Required Palettes
You MUST include these three palettes, then create 3 additional diverse palettes:

1. **Corporate/Professional**: Inspired by LinkedIn's blue palette (#0077B5, #0A66C2) - professional and trustworthy. Label based on the exact blue shade: "Professional", "Azure", "Corporate", "Navy", etc.

2. **Industry-Inspired**: Based on the person's industry, role, and company logos. Extract colors from company_logo_url fields. Label should reflect both industry and color (e.g., "Tech", "Finance", or specific color names like "Coral", "Emerald").

3. **Minimalist**: A minimalist palette with a focus on simplicity and minimalism. Label should reflect the minimalist aesthetic.

3-6. **Three Additional Palettes**: Create diverse options inspired by:
   - Colors from profile_picture_url and background_picture_url
   - Personality indicators from their profile
   - Demographic considerations (age, gender if apparent)
   - Different aesthetic styles (minimal, dark mode, pastel, warm, etc.)
   - Ensure these palettes would actually go well on a personal portfolio website

Use these actual extracted colors as the foundation for your palettes - do not make up generic colors.

## Palette Naming Rules
**CRITICAL: Labels must describe the ACTUAL COLORS, not generic terms, prefer 1 word but 2 is also fine.**

- Green (#388E3C) \u2192 "Nature", "Forest", "Emerald", "Sage" (NOT "Safe")
- Red (#D32F2F) \u2192 "Coral", "Scarlet", "Fiery" (NOT "Bold")
- Grey (#616161) \u2192 "Stone", "Minimal", "Neutral" (NOT "Modern")
- Orange (#FF9800) \u2192 "Sunset", "Amber", "Terracotta" (NOT "Vibrant")
- Dark grey (#212121) \u2192 "Charcoal", "Midnight", "Noir" (NOT "Dark")

## Output Format
Return ONLY valid JSON:
{
  "options": [
    {
      "id": "palette-1",
      "label": "Descriptive Color-Based Label",
      "primary": "#HEXCODE",
      "secondary": "#HEXCODE",
      "background": "#HEXCODE",
      "text": "#HEXCODE",
      "accent": "#HEXCODE"
    }
    ... (5 more palettes)
  ]
}

## Rules
- Use hex codes for all colors
- Ensure text has sufficient contrast with background (WCAG AA)
- Make it personal - consider their profile deeply
- All palettes must be suitable for a personal portfolio website and work together as a colour scheme.`
});
const paletteOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  primary: z.string(),
  secondary: z.string(),
  background: z.string(),
  text: z.string(),
  accent: z.string()
});
const colorOptionsSchema = z.object({
  options: z.array(paletteOptionSchema)
});

"use strict";
const copywriterAgent = new Agent({
  name: "copywriter-agent",
  model: vertex("gemini-2.5-flash-lite-preview-09-2025 "),
  instructions: `You are a concise marketing copywriter.

Input: LinkedIn profile JSON.
Task: Rewrite the "About" narrative into THREE distinct tones (e.g., Storyteller, Executive, Minimalist).
Rules:
- Create a headline (1 sentence) and a short bio (3-5 sentences max) per option.
- Respect factual data; no fabrications. DO NOT invent dates (e.g., "Summer 2025") or roles not in the input.
- STRICTLY GROUNDED: If a specific detail (like internship plans) is not in the "about" or "experience" data, DO NOT include it.
- If the "About" section is empty, use the "Headline" and "Experience" to infer a professional summary, but do not hallucinate future aspirations.
Output schema:
{ "options": [ { "id": "copy-1", "label": "Storyteller", "headline": "...", "bio": "..." }, ... ] }`
});
const copyOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  headline: z.string(),
  bio: z.string()
});
const copyOptionsSchema = z.object({
  options: z.array(copyOptionSchema)
});

"use strict";
const startStep = createStep({
  id: "start-step",
  inputSchema: z.object({
    url: z.string(),
    jobId: z.string().optional()
  }),
  outputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional()
  }),
  execute: async ({ inputData, mastra }) => {
    if (inputData.jobId) {
      await updateJobStatus(inputData.jobId, "running", {
        progressMessage: "Researcher Agent starting..."
      });
    }
    const result = await mastra.getAgent("researcherAgent").generate(`Fetch the LinkedIn profile data for this URL: ${inputData.url}`, {
      output: linkedInProfileSchema
    });
    const profileData = result.object;
    const cleanProfileData = profileData ? JSON.parse(JSON.stringify(profileData)) : {};
    if (inputData.jobId) {
      await updateJobStatus(inputData.jobId, "running", {
        progressMessage: "Profile data fetched and cleaned! Starting design agents...",
        partials: { profileData: cleanProfileData },
        agentStates: { color: "idle", copy: "idle" }
      });
    }
    return { profileData: cleanProfileData, jobId: inputData.jobId };
  }
});
const generateColorStep = createStep({
  id: "generate-color-step",
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional()
  }),
  outputSchema: z.object({
    colorOptions: colorOptionsSchema,
    selectedPaletteId: z.string()
  }),
  stateSchema: z.object({
    generatedOptions: colorOptionsSchema.optional()
  }),
  resumeSchema: z.object({
    selectedPaletteId: z.string()
  }),
  execute: async ({ mastra, inputData, resumeData, state, setState, suspend }) => {
    if (resumeData) {
      console.log("Color Step Resume Debug:", { state, resumeData });
      if (!state.generatedOptions) {
        throw new Error("Resumed without generated options in state");
      }
      if (inputData.jobId) {
        await updateJobAgentState(inputData.jobId, "color", "completed");
      }
      return {
        colorOptions: state.generatedOptions,
        selectedPaletteId: resumeData.selectedPaletteId
      };
    }
    let colorOptions = state.generatedOptions;
    if (!colorOptions) {
      if (inputData.jobId) {
        await updateJobAgentState(inputData.jobId, "color", "thinking");
      }
      const agent = mastra.getAgent("colorAgent");
      const result = await agent.generate(JSON.stringify({ profileData: inputData.profileData }), {
        output: colorOptionsSchema
      });
      colorOptions = JSON.parse(JSON.stringify(result.object));
      setState({ generatedOptions: colorOptions });
      if (inputData.jobId) {
        await updateJobPartial(inputData.jobId, "colorOptions", colorOptions);
        await updateJobAgentState(inputData.jobId, "color", "waiting_for_user");
      }
    }
    return suspend(
      { colorOptions },
      // suspend payload (informational)
      { resumeLabel: "Select Color" }
      // resume config
    );
  }
});
const generateCopyStep = createStep({
  id: "generate-copy-step",
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    jobId: z.string().optional()
  }),
  outputSchema: z.object({
    copyOptions: copyOptionsSchema,
    selectedCopyId: z.string()
  }),
  stateSchema: z.object({
    generatedOptions: copyOptionsSchema.optional()
  }),
  resumeSchema: z.object({
    selectedCopyId: z.string()
  }),
  execute: async ({ mastra, inputData, resumeData, state, setState, suspend }) => {
    if (resumeData) {
      console.log("Copy Step Resume Debug:", { state, resumeData });
      if (!state.generatedOptions) {
        throw new Error("Resumed without generated options in state");
      }
      if (inputData.jobId) {
        await updateJobAgentState(inputData.jobId, "copy", "completed");
      }
      return {
        copyOptions: state.generatedOptions,
        selectedCopyId: resumeData.selectedCopyId
      };
    }
    let copyOptions = state.generatedOptions;
    if (!copyOptions) {
      if (inputData.jobId) {
        await updateJobAgentState(inputData.jobId, "copy", "thinking");
      }
      const result = await mastra.getAgent("copywriterAgent").generate(JSON.stringify({ profileData: inputData.profileData }), {
        output: copyOptionsSchema
      });
      copyOptions = JSON.parse(JSON.stringify(result.object));
      setState({ generatedOptions: copyOptions });
      if (inputData.jobId) {
        await updateJobPartial(inputData.jobId, "copyOptions", copyOptions);
        await updateJobAgentState(inputData.jobId, "copy", "waiting_for_user");
      }
    }
    return suspend({ copyOptions }, { resumeLabel: "Select Copy" });
  }
});
const seniorStep = createStep({
  id: "senior-step",
  inputSchema: z.object({
    profileData: linkedInProfileSchema,
    // direct from startStep
    // Parallel outputs come in as a map keyed by step ID
    "generate-color-step": z.object({
      colorOptions: colorOptionsSchema,
      selectedPaletteId: z.string()
    }),
    "generate-copy-step": z.object({
      copyOptions: copyOptionsSchema,
      selectedCopyId: z.string()
    }),
    jobId: z.string().optional()
  }),
  outputSchema: z.object({
    html: z.string()
  }),
  execute: async ({ inputData }) => {
    const colorResult = inputData["generate-color-step"];
    const copyResult = inputData["generate-copy-step"];
    const { profileData, jobId } = inputData;
    const selectedPalette = colorResult.colorOptions.options.find(
      (o) => o.id === colorResult.selectedPaletteId
    );
    const selectedCopy = copyResult.copyOptions.options.find(
      (o) => o.id === copyResult.selectedCopyId
    );
    if (!selectedPalette || !selectedCopy) throw new Error("Invalid selection IDs");
    if (jobId) {
      await updateJobStatus(jobId, "running", {
        agentStates: { senior: "thinking", color: "completed", copy: "completed" },
        progressMessage: "Finalizing website..."
      });
    }
    const result = await seniorBuilderAgent.generate(
      JSON.stringify({
        profileData,
        colorPalette: selectedPalette,
        copy: selectedCopy
      }),
      { output: finalBuildSchema }
    );
    const finalHtml = result.object.index_html;
    if (jobId) {
      await updateJobStatus(jobId, "succeeded", {
        agentStates: { senior: "completed" },
        partials: {
          finalHtml,
          profileData,
          // ensure complete data is in final record
          colorOptions: colorResult.colorOptions,
          copyOptions: copyResult.copyOptions
        },
        choices: {
          selectedPaletteId: colorResult.selectedPaletteId,
          selectedCopyId: copyResult.selectedCopyId
        },
        progressMessage: "Website created!"
      });
    }
    return { html: finalHtml };
  }
});
const websiteBuilderWorkflow = createWorkflow({
  id: "website-builder-workflow",
  inputSchema: z.object({
    url: z.string(),
    jobId: z.string().optional()
  }),
  outputSchema: z.object({
    html: z.string()
  })
}).then(startStep).parallel([generateColorStep, generateCopyStep]).then(seniorStep).commit();

"use strict";
const researcherAgent = new Agent({
  name: "researcher-agent",
  model: vertex("gemini-2.5-flash-lite-preview-09-2025"),
  instructions: `You are a researcher. Your sole task is to call the linkedInProfileTool to fetch LinkedIn profile data for a given URL and return the results. Do not filter or summarize the data.`,
  tools: { linkedInProfileTool }
});

"use strict";
const tableName = process.env.MASTRA_TABLE_NAME || "MastraStore";
const region = process.env.AWS_REGION || "us-east-1";
const mastra = new Mastra({
  workflows: {
    websiteBuilderWorkflow
  },
  storage: process.env.NODE_ENV === "development" ? new MockStore() : new DynamoDBStore({
    name: "dynamodb",
    config: {
      tableName,
      region,
      // @ts-expect-error - removeUndefinedValues is missing from type but required for runtime
      removeUndefinedValues: true
    }
  }),
  // Add your agents here
  agents: {
    colorAgent,
    copywriterAgent,
    seniorBuilderAgent,
    researcherAgent
  }
});

export { mastra };
