import { createTool } from "@mastra/core/tools"
// import { ApifyClient } from "apify-client" // TODO: Uncomment when using real API
import { z } from "zod"

// Schema for experience entries
const experienceSchema = z.object({
  companyId: z.string().nullable(),
  companyUrn: z.string().nullable(),
  companyLink1: z.string().nullable(),
  companyName: z.string().nullable(),
  companySize: z.string().nullable(),
  companyWebsite: z.string().nullable(),
  companyIndustry: z.string().nullable(),
  logo: z.string().nullable(),
  title: z.string().nullable(),
  jobDescription: z.string().nullable(),
  jobStartedOn: z.string().nullable(),
  jobEndedOn: z.string().nullable(),
  jobLocation: z.string().nullable(),
  jobStillWorking: z.boolean().nullable(),
  jobLocationCountry: z.string().nullable(),
  employmentType: z.string().nullable(),
  subtitle: z.string().nullable(),
  caption: z.string().nullable(),
  metadata: z.string().nullable(),
})

// Schema for education entries
const educationSchema = z.object({
  companyId: z.string().nullable(),
  companyUrn: z.string().nullable(),
  companyLink1: z.string().nullable(),
  logo: z.string().nullable(),
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  period: z
    .object({
      startedOn: z.object({ year: z.number().nullable() }).nullable(),
      endedOn: z.object({ year: z.number().nullable() }).nullable(),
    })
    .nullable(),
  breakdown: z.boolean().nullable(),
})

// Schema for skills
const skillSchema = z.object({
  title: z.string(),
})

// Schema for people also viewed
const personViewedSchema = z.object({
  last_name: z.string().nullable(),
  first_name: z.string().nullable(),
  headline: z.string().nullable(),
  entity_urn: z.string().nullable(),
  public_identifier: z.string().nullable(),
  premium: z.boolean().nullable(),
  profile_picture: z.string().nullable(),
  url: z.string().nullable(),
  follower_count: z.number().nullable(),
})

// Main LinkedIn profile schema
const linkedInProfileSchema = z.object({
  linkedinUrl: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string().nullable(),
  headline: z.string().nullable(),
  connections: z.number().nullable(),
  followers: z.number().nullable(),
  email: z.string().nullable(),
  mobileNumber: z.string().nullable(),
  jobTitle: z.string().nullable(),
  jobStartedOn: z.string().nullable(),
  jobLocation: z.string().nullable(),
  jobStillWorking: z.boolean().nullable(),
  companyName: z.string().nullable(),
  companyIndustry: z.string().nullable(),
  companyWebsite: z.string().nullable(),
  companyLinkedin: z.string().nullable(),
  companyFoundedIn: z.string().nullable(),
  companySize: z.string().nullable(),
  currentJobDuration: z.string().nullable(),
  currentJobDurationInYrs: z.number().nullable(),
  topSkillsByEndorsements: z.string().nullable(),
  addressCountryOnly: z.string().nullable(),
  addressWithCountry: z.string().nullable(),
  addressWithoutCountry: z.string().nullable(),
  profilePic: z.string().nullable(),
  profilePicHighQuality: z.string().nullable(),
  backgroundPic: z.string().nullable(),
  linkedinId: z.string().nullable(),
  isPremium: z.boolean().nullable(),
  isVerified: z.boolean().nullable(),
  isJobSeeker: z.boolean().nullable(),
  isRetired: z.boolean().nullable(),
  isCreator: z.boolean().nullable(),
  isInfluencer: z.boolean().nullable(),
  about: z.string().nullable(),
  publicIdentifier: z.string().nullable(),
  linkedinPublicUrl: z.string().nullable(),
  openConnection: z.boolean().nullable(),
  urn: z.string().nullable(),
  birthday: z
    .object({
      day: z.string().nullable(),
      month: z.string().nullable(),
      year: z.string().nullable(),
    })
    .nullable(),
  associatedHashtag: z.array(z.string()).nullable(),
  experiences: z.array(experienceSchema).nullable(),
  skills: z.array(skillSchema).nullable(),
  educations: z.array(educationSchema).nullable(),
  licenseAndCertificates: z.array(z.unknown()).nullable(),
  honorsAndAwards: z.array(z.unknown()).nullable(),
  languages: z.array(z.unknown()).nullable(),
  volunteerAndAwards: z.array(z.unknown()).nullable(),
  verifications: z.array(z.unknown()).nullable(),
  promos: z.array(z.unknown()).nullable(),
  highlights: z.array(z.unknown()).nullable(),
  projects: z.array(z.unknown()).nullable(),
  publications: z.array(z.unknown()).nullable(),
  patents: z.array(z.unknown()).nullable(),
  courses: z.array(z.unknown()).nullable(),
  testScores: z.array(z.unknown()).nullable(),
  organizations: z.array(z.unknown()).nullable(),
  volunteerCauses: z.array(z.unknown()).nullable(),
  interests: z.array(z.unknown()).nullable(),
  recommendationsReceived: z.array(z.unknown()).nullable(),
  recommendations: z.array(z.unknown()).nullable(),
  peopleAlsoViewed: z.array(personViewedSchema).nullable(),
  updates: z.array(z.unknown()).nullable(),
  creatorWebsite: z.array(z.unknown()).nullable(),
  profilePicAllDimensions: z.array(z.unknown()).nullable(),
})

// TODO: Remove this mock data and use the real Apify API
const MOCK_PROFILE = {
  linkedinUrl: "https://www.linkedin.com/in/thomasjcanning",
  firstName: "Thomas",
  lastName: "Canning",
  fullName: "Thomas Canning",
  headline:
    "University of Bath Computer Science BSc final year student - 14 months as fullstack engineer at Confluent",
  connections: 146,
  followers: 146,
  email: "thomas@confluent.io",
  mobileNumber: null,
  jobTitle: "Full-Stack Software Enginee",
  jobStartedOn: "6-2024",
  jobLocation: "London Area, United Kingdom",
  jobStillWorking: false,
  companyName: "Confluent",
  companyIndustry: "Software Development",
  companyWebsite: "http://confluent.io/",
  companyLinkedin: "https://www.linkedin.com/company/confluent/",
  companyFoundedIn: null,
  companySize: "1001-5000",
  currentJobDuration: "1 yr 3 mos",
  currentJobDurationInYrs: 1.25,
  topSkillsByEndorsements: null,
  addressCountryOnly: "United Kingdom",
  addressWithCountry: "Norwich, England United Kingdom",
  addressWithoutCountry: "Norwich, England",
  profilePic:
    "https://media.licdn.com/dms/image/v2/D4E03AQGbedhW87kl_Q/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1725567795932?e=1766620800&v=beta&t=XtXpr4sHozwuRRuiOwvjh6wd8ALk3VpUNYQrNPpdnNE",
  profilePicHighQuality:
    "https://media.licdn.com/dms/image/v2/D4E03AQGbedhW87kl_Q/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1725567795932?e=1766620800&v=beta&t=XtXpr4sHozwuRRuiOwvjh6wd8ALk3VpUNYQrNPpdnNE",
  backgroundPic:
    "https://media.licdn.com/dms/image/v2/D4E16AQGl1K_qhBqpkw/profile-displaybackgroundimage-shrink_350_1400/profile-displaybackgroundimage-shrink_350_1400/0/1730497172545?e=1766620800&v=beta&t=wDhTj_sW0o7VZbGEL6DcM0V9Wtk-wj9UnzZHuH1jrqw",
  linkedinId: "1040620305",
  isPremium: false,
  isVerified: true,
  isJobSeeker: false,
  isRetired: false,
  isCreator: false,
  isInfluencer: false,
  about:
    "Driven by a passion for technology, mathematics, machine learning, and finance, I am a Computer Science student studying at the University of Bath with a strong interest in pursuing a career in quantitative finance. Currently honing my programming and problem-solving skills as a Software Engineer at Confluent during my year in industry, I am eager to apply my skills and gain further experience in quantitative finance through an internship in the summer of 2025.",
  publicIdentifier: "thomasjcanning",
  linkedinPublicUrl: "https://linkedin.com/in/thomasjcanning",
  openConnection: false,
  urn: "ACoAAD4GmxEBjOCIu4hbMd7j26OWUNvxaurFsko",
  birthday: { day: "", month: "", year: "" },
  associatedHashtag: [],
  experiences: [
    {
      companyId: "88873",
      companyUrn: "urn:li:fsd_company:88873",
      companyLink1: "https://www.linkedin.com/company/confluent/",
      companyName: "Confluent",
      companySize: "1001-5000",
      companyWebsite: "http://confluent.io/",
      companyIndustry: "Software Development",
      logo: "https://media.licdn.com/dms/image/v2/D4E0BAQH5-OYbTze-EA/company-logo_400_400/B4EZbt9pRdHkAc-/0/1747749082914/confluent_logo?e=1766620800&v=beta&t=Uh-jcPFmzHbKQ8KtKGES_q3QreF-U21eW5N97oreEok",
      title: "Full-Stack Software Enginee",
      jobDescription:
        "14+ months as a Software Engineer as part of my placement year. Joining as a Cloud Infrastructure Engineer, my role evolved into that of a Full-stack Software Engineer, shaping the future of continuous deployment at Confluent by building a platform that automates artifact delivery pipelines - in particular, taking ownership of its UI. I gained a breadth of experience spanning Kubernetes, Golang, Terraform, AWS (EKS, VPC, S3), React, Typescript, Tailwind CSS,  Docker, and Helm.",
      jobStartedOn: "6-2024",
      jobEndedOn: "8-2025",
      jobLocation: "London Area, United Kingdom",
      jobStillWorking: false,
      jobLocationCountry: "US",
      employmentType: "Full-time",
      subtitle: null,
      caption: null,
      metadata: null,
    },
    {
      companyId: "71976100",
      companyUrn: "urn:li:fsd_company:71976100",
      companyLink1: "https://www.linkedin.com/company/girlguidinganglia/",
      companyName: "Girlguiding Anglia",
      companySize: "11-50",
      companyWebsite: "http://www.girlguiding-anglia.org.uk",
      companyIndustry: "Non-profit Organizations",
      logo: "https://media.licdn.com/dms/image/v2/C4E0BAQF5AhnX7_QrVw/company-logo_400_400/company-logo_400_400/0/1678265659357/girlguidinganglia_logo?e=1766620800&v=beta&t=RZmozYhnEeg08YfTOYdqOfOQN-bRxz-t-iP8UJbtRYY",
      title: "Seasonal Activities Instructor",
      jobDescription:
        "I led a variety of outdoor activities to groups of young people, taking responsibility over participants and instructing enthusiastically to the highest standards, encouraging teamwork amongst groups, and often working collaboratively with other instructors.",
      jobStartedOn: "4-2022",
      jobEndedOn: "7-2024",
      jobLocation: "Hautbois Activity Centre",
      jobStillWorking: false,
      jobLocationCountry: "GB",
      employmentType: "Full-time",
      subtitle: null,
      caption: null,
      metadata: null,
    },
  ],
  skills: [
    { title: "Confluent" },
    { title: "Software Engineering" },
    { title: "Machine Learning" },
    { title: "Discrete Mathematics" },
    { title: "Programming" },
    { title: "Visual Computing" },
  ],
  educations: [
    {
      companyId: "12686",
      companyUrn: "urn:li:fsd_company:12686",
      companyLink1: "https://www.linkedin.com/school/university-of-bath/",
      logo: "https://media.licdn.com/dms/image/v2/D4E0BAQHpoMktZkAMEQ/company-logo_200_200/company-logo_200_200/0/1709289603085/university_of_bath_logo?e=1766620800&v=beta&t=R6ypQd_pfNDVFsjadki5I_z5Pw9ygCDuhyV6PbuXF5E",
      title: "University of Bath",
      subtitle: "Bachelor's degree, Computer Science",
      period: { startedOn: { year: 2022 }, endedOn: { year: 2026 } },
      breakdown: false,
    },
    {
      companyId: "4149053",
      companyUrn: "urn:li:fsd_company:4149053",
      companyLink1: "https://www.linkedin.com/school/wymondham-college/",
      logo: "https://media.licdn.com/dms/image/v2/C4D0BAQGASuI7UN-QvQ/company-logo_200_200/company-logo_200_200/0/1630516775806/wymondham_college_logo?e=1766620800&v=beta&t=RVcoi-qKEr4L7jruqmBMcTaOvc2Km54hw3mUO4-bfLw",
      title: "Wymondham College",
      subtitle: null,
      period: { startedOn: { year: 2020 }, endedOn: { year: 2022 } },
      breakdown: false,
    },
  ],
  licenseAndCertificates: [],
  honorsAndAwards: [],
  languages: [],
  volunteerAndAwards: [],
  verifications: [],
  promos: [],
  highlights: [],
  projects: [],
  publications: [],
  patents: [],
  courses: [],
  testScores: [],
  organizations: [],
  volunteerCauses: [],
  interests: [],
  recommendationsReceived: [],
  recommendations: [],
  peopleAlsoViewed: [],
  updates: [],
  creatorWebsite: [{ category: "PERSONAL", url: "thomascanning.co.uk" }],
  profilePicAllDimensions: [],
}

export const linkedInProfileTool = createTool({
  id: "linkedin-profile-tool",
  description:
    "Fetches LinkedIn profile data for one or more profile URLs. Currently returns mock data for development. No internet access required - works offline with pre-configured profile data.",
  inputSchema: z.object({
    profileUrls: z
      .array(z.string())
      .min(1)
      .describe("Array of LinkedIn profile URLs to fetch data for"),
  }),
  outputSchema: z.object({
    profiles: z.array(linkedInProfileSchema),
    error: z.string().nullable(),
  }),
  execute: async ({ context }) => {
    // Extract profileUrls from context (even though we're using mock data for now)
    const { profileUrls } = context
    console.log("LinkedIn Profile Tool called with URLs:", profileUrls)

    // TODO: Replace with real Apify API call
    // const apiToken = process.env.APIFY_API_TOKEN
    // if (!apiToken) {
    //   return {
    //     profiles: [],
    //     error: "APIFY_API_TOKEN environment variable is not set",
    //   }
    // }
    // try {
    //   const client = new ApifyClient({ token: apiToken })
    //   const input = { profileUrls }
    //   const run = await client.actor("2SyF0bVxmgGr8IVCZ").call(input)
    //   const { items } = await client.dataset(run.defaultDatasetId).listItems()
    //   return {
    //     profiles: items as z.infer<typeof linkedInProfileSchema>[],
    //     error: null,
    //   }
    // } catch (error) {
    //   return {
    //     profiles: [],
    //     error: error instanceof Error ? error.message : "Unknown error fetching LinkedIn profiles",
    //   }
    // }

    // For now, return mock data regardless of URL (for development)
    return {
      profiles: [MOCK_PROFILE],
      error: null,
    }
  },
})
