import { createTool } from '@mastra/core/tools';
import { ApifyClient } from 'apify-client';
import { z } from 'zod';

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

export { fetchLinkedInProfiles, linkedInProfileSchema, linkedInProfileTool };
