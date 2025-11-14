import { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock AWS SDK - must be defined before any imports
const mockSend = jest.fn()

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  return {
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    InitiateAuthCommand: jest.requireActual('@aws-sdk/client-cognito-identity-provider').InitiateAuthCommand,
    RevokeTokenCommand: jest.requireActual('@aws-sdk/client-cognito-identity-provider').RevokeTokenCommand,
  }
})

export { mockSend }

// Helper to create base event
export function createBaseEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    requestContext: {
      http: {
        method: 'GET',
        path: '/test',
      },
    } as any,
    headers: {},
    cookies: [],
    ...overrides,
  } as APIGatewayProxyEventV2
}

// Test constants
export const TEST_CLIENT_ID = 'test-client-id'
export const TEST_ACCESS_TOKEN = 'test-access-token-123'
export const TEST_REFRESH_TOKEN = 'test-refresh-token-123'

// Cleanup function
export function cleanupMocks() {
  jest.clearAllMocks()
  mockSend.mockReset()
  process.env.USER_POOL_CLIENT_ID = TEST_CLIENT_ID
  process.env.AWS_REGION = 'us-east-1'
}
