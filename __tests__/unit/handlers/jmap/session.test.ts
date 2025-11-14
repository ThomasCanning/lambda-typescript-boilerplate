import { sessionHandler } from '../../../../src/handlers/jmap/session'
import { createBaseEvent } from '../../lib/auth/__setup__'

// Mock withAuth to bypass authentication
jest.mock('../../../../src/lib/auth', () => {
  const actual = jest.requireActual('../../../../src/lib/auth')
  return {
    ...actual,
    withAuth: (handler: any) => {
      // Bypass auth and call handler directly with mock auth context
      return async (event: any) => {
        const mockAuth = {
          ok: true as const,
          username: 'testuser',
          bearerToken: 'test-bearer-token',
          claims: { sub: 'user123', username: 'testuser' },
        }
        return await handler(event, mockAuth)
      }
    },
  }
})

describe('sessionHandler', () => {
  const ORIGINAL_API_URL = process.env.API_URL

  beforeEach(() => {
    process.env.API_URL = 'https://jmap.example.com/'
  })

  afterEach(() => {
    process.env.API_URL = ORIGINAL_API_URL
  })

  it('returns 200 and JSON payload on GET', async () => {
    const event = createBaseEvent({
      headers: { authorization: 'Bearer test-token' },
    })

    const res = await sessionHandler(event)

    expect(res.statusCode).toBe(200)
    expect(res.headers?.['Content-Type']).toBe('application/json')
    const body = JSON.parse(res.body!)
    expect(body).toEqual({
      capabilities: {},
      apiUrl: 'https://jmap.example.com/',
      primaryAccounts: {},
    })
  })

  it('returns 500 when API_URL is missing', async () => {
    delete process.env.API_URL

    const event = createBaseEvent({
      headers: { authorization: 'Bearer test-token' },
    })

    const res = await sessionHandler(event)

    expect(res.statusCode).toBe(500)
    const body = JSON.parse(res.body!)
    expect(body.error).toContain('API_URL')
  })
})
