import { jmapHandler } from '../../../../src/handlers/jmap/rpc'
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

describe('jmapHandler', () => {
  it('returns 200 and JSON payload on POST', async () => {
    const event = createBaseEvent({
      requestContext: { http: { method: 'POST' } } as any,
      headers: { authorization: 'Bearer test-token' },
      body: '{"methodCalls": []}',
    })

    const res = await jmapHandler(event)

    expect(res.statusCode).toBe(200)
    expect(res.headers?.['Content-Type']).toBe('application/json')
    const body = JSON.parse(res.body!)
    expect(body).toEqual({ methodResponses: [] })
  })

  it('handles request body correctly', async () => {
    const event = createBaseEvent({
      requestContext: { http: { method: 'POST' } } as any,
      headers: { authorization: 'Bearer test-token' },
      body: '{"methodCalls": [{"method": "Core/echo", "arguments": {}}]}',
    })

    const res = await jmapHandler(event)

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body!)
    expect(body).toEqual({ methodResponses: [] })
  })
})
