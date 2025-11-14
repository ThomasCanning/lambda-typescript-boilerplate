import { isAuthenticatedContext, AuthResult } from '../../../../src/lib/auth/types'

describe('types', () => {
  describe('isAuthenticatedContext', () => {
    it('returns true for authenticated context', () => {
      const result: AuthResult = { ok: true, bearerToken: 'token' }
      expect(isAuthenticatedContext(result)).toBe(true)
    })

    it('returns false for error result', () => {
      const result: AuthResult = { ok: false, statusCode: 401, message: 'Unauthorized' }
      expect(isAuthenticatedContext(result)).toBe(false)
    })

    it('narrows type correctly', () => {
      const result: AuthResult = { ok: true, bearerToken: 'token' }
      if (isAuthenticatedContext(result)) {
        // TypeScript should know result.bearerToken exists here
        expect(result.bearerToken).toBe('token')
      }
    })
  })
})

