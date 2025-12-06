# Development

## Local Setup

1. Install dependencies: `npm install`
2. Run locally: `make local`
3. Server runs at: `http://localhost:3001`

## Testing

```bash
npm test
npm test -- --watch
```

## Authentication

- Bearer tokens (cookies or header)
- Basic auth (fallback)
- Automatic token refresh via cookies

Endpoints: `/auth/login`, `/auth/token`, `/auth/logout`

## API Usage

```bash
# Get token
TOKEN=$(curl -s -X POST https://api.example.com/auth/token \
  -u 'user@example.com:password' | jq -r '.accessToken')

# Authenticated endpoint
curl -X POST https://api.example.com/api/endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# Unauthenticated endpoint
curl -X POST https://api.example.com/api/public \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```
