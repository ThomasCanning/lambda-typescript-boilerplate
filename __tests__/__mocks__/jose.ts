// Mock implementation of jose for testing
// These are default implementations that should be overridden in tests
export function jwtVerify() {
  throw new Error('jwtVerify should be mocked in tests')
}

export function createRemoteJWKSet() {
  throw new Error('createRemoteJWKSet should be mocked in tests')
}

export function decodeJwt() {
  throw new Error('decodeJwt should be mocked in tests')
}

export type JWTPayload = Record<string, any>

