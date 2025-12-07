//AI Generated script to generate env.json for SAM local development

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const templatePath = path.join(__dirname, '..', 'template.yaml');
const envJsonPath = path.join(__dirname, '..', 'env.json');

// Get values from environment or use defaults
const region = process.env.REGION || process.env.AWS_REGION || 'eu-west-2';
const userPoolClientId = process.env.USER_POOL_CLIENT_ID || '';
const userPoolId = process.env.USER_POOL_ID || '';
const apiBase = process.env.API_BASE || 'http://localhost:3001';
const vertexAiApiKey = process.env.VERTEX_AI_API_KEY || '';
const googleVertexProject = process.env.GOOGLE_VERTEX_PROJECT || '';
const googleVertexLocation = process.env.GOOGLE_VERTEX_LOCATION || 'us-central1';
const googleCredentialsJson = process.env.GOOGLE_CREDENTIALS_JSON || '';
const apifyApiToken = process.env.APIFY_API_TOKEN || '';

// Read and parse template.yaml
// Suppress warnings about CloudFormation intrinsic functions (!Ref, !Sub, etc.)
// We only need to detect if keys exist, not evaluate them
const originalEmitWarning = process.emitWarning;
process.emitWarning = () => {}; // Suppress YAML warnings

const templateContent = fs.readFileSync(templatePath, 'utf8');
const template = yaml.parse(templateContent);

process.emitWarning = originalEmitWarning; // Restore warnings

// Extract functions and their environment variables
const envJson = {};

// Get Globals environment variables if they exist
const globalEnvVars = template.Globals?.Function?.Environment?.Variables || {};

for (const [resourceName, resource] of Object.entries(template.Resources || {})) {
  if (resource.Type === 'AWS::Serverless::Function') {
    const envVars = {};
    
    // Get environment variables from function definition
    const functionEnvVars = resource.Properties?.Environment?.Variables || {};
    
    // Combine global and function-specific variables
    // Note: In a real deployment, this merge happens automatically. 
    // Here we manually check for keys we care about in both places.
    
    // Always set IS_LOCAL_DEV to true for local development
    envVars.IS_LOCAL_DEV = "true";
    
    // Check for USER_POOL_CLIENT_ID (in function or globals)
    if (functionEnvVars.USER_POOL_CLIENT_ID !== undefined || globalEnvVars.USER_POOL_CLIENT_ID !== undefined) {
      envVars.USER_POOL_CLIENT_ID = userPoolClientId;
    }
    
    // Check for USER_POOL_ID (in function or globals)
    if (functionEnvVars.USER_POOL_ID !== undefined || globalEnvVars.USER_POOL_ID !== undefined) {
      envVars.USER_POOL_ID = userPoolId;
    }
    
    // Check for BASE_URL
    if (functionEnvVars.BASE_URL !== undefined || globalEnvVars.BASE_URL !== undefined) {
      envVars.BASE_URL = apiBase;
    }
    
    // Check for VERTEX_AI_API_KEY
    if (functionEnvVars.VERTEX_AI_API_KEY !== undefined || globalEnvVars.VERTEX_AI_API_KEY !== undefined) {
      envVars.VERTEX_AI_API_KEY = vertexAiApiKey;
    }
    
    // Check for GOOGLE_VERTEX_PROJECT
    if (functionEnvVars.GOOGLE_VERTEX_PROJECT !== undefined || globalEnvVars.GOOGLE_VERTEX_PROJECT !== undefined) {
      envVars.GOOGLE_VERTEX_PROJECT = googleVertexProject;
    }
    
    // Check for GOOGLE_VERTEX_LOCATION
    if (functionEnvVars.GOOGLE_VERTEX_LOCATION !== undefined || globalEnvVars.GOOGLE_VERTEX_LOCATION !== undefined) {
      envVars.GOOGLE_VERTEX_LOCATION = googleVertexLocation;
    }
    
    // Check for GOOGLE_CREDENTIALS_JSON
    if (functionEnvVars.GOOGLE_CREDENTIALS_JSON !== undefined || globalEnvVars.GOOGLE_CREDENTIALS_JSON !== undefined) {
      envVars.GOOGLE_CREDENTIALS_JSON = googleCredentialsJson;
    }
    
    // Check for APIFY_API_TOKEN
    if (functionEnvVars.APIFY_API_TOKEN !== undefined || globalEnvVars.APIFY_API_TOKEN !== undefined) {
      envVars.APIFY_API_TOKEN = apifyApiToken;
    }
    
    // Add AWS_REGION for local dev if likely needed (Cognito usage)
    if (envVars.USER_POOL_CLIENT_ID || envVars.USER_POOL_ID) {
      envVars.AWS_REGION = region;
    }
    
    // Always add to env.json
    envJson[resourceName] = envVars;
  }
}

// Write env.json
fs.writeFileSync(envJsonPath, JSON.stringify(envJson, null, 2) + '\n');
console.log(`Wrote env.json (region=${region}, client_id=${userPoolClientId || '<unset>'}, pool_id=${userPoolId || '<unset>'})`);
console.log(`Functions: ${Object.keys(envJson).join(', ')}`);
