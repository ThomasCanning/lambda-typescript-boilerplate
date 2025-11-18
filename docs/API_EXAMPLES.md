# API Examples

This document provides example commands for interacting with the JMAP server API. All examples use `jq` to pretty-print JSON responses. Use the `-s` (silent) flag with curl to suppress progress output when piping to `jq`.

## Base URL

Replace `jmapbox.com` with your domain:

- API: `https://api.jmapbox.com`
- Autodiscovery: `https://jmapbox.com`

## Authentication

Get an access token:

```bash
# Note: /auth/token requires POST method
TOKEN=$(curl -s -X POST https://api.jmapbox.com/auth/token \
  -u 'admin@jmapbox.com:Password123!' | jq -r '.accessToken')

echo "Token: $TOKEN"
```

## Logout

```bash
curl -s -X POST https://api.jmapbox.com/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
```

## JMAP Endpoints

### Session Discovery

```bash
curl -s https://api.jmapbox.com/jmap/session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
```

### JMAP API Request

#### Basic JMAP API Request

```bash
curl -s -X POST https://api.jmapbox.com/jmap/api \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "using": ["urn:ietf:params:jmap:core"],
    "methodCalls": [
      ["Mailbox/get", {"accountId": "u1"}, "c1"]
    ]
  }' | jq .
```

#### Example with Multiple Method Calls

```bash
curl -s -X POST https://api.jmapbox.com/jmap/api \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "using": ["urn:ietf:params:jmap:core"],
    "methodCalls": [
      ["Mailbox/get", {"accountId": "u1"}, "c1"],
      ["Email/get", {"accountId": "u1", "ids": ["msg1"]}, "c2"]
    ]
  }' | jq .
```
