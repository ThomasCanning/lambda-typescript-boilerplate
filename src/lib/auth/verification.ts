import { APIGatewayProxyEventV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { CognitoJwtVerifier } from "aws-jwt-verify"
import { decodeJwt } from "jose"
import { AuthResult } from "./types"
import { getHeader } from "./headers"
import { getTokenFromCookies } from "./cookies"

// Cache verifier instances per userPoolId+clientId combination
const verifierCache = new Map<string, ReturnType<typeof CognitoJwtVerifier.create>>()

function extractUserPoolId(issuer: string): string | null {
  // Issuer format: https://cognito-idp.{region}.amazonaws.com/{userPoolId}
  const match = issuer.match(/https:\/\/cognito-idp\.[^/]+\/(.+)/)
  return match ? match[1] : null
}

function getVerifier(userPoolId: string, userPoolClientId: string) {
  const cacheKey = `${userPoolId}:${userPoolClientId}`
  let verifier = verifierCache.get(cacheKey)
  if (!verifier) {
    // Create verifier that validates access tokens
    // It automatically handles JWKS fetching, signature verification, issuer validation, and expiration
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: "access",
      clientId: userPoolClientId,
    })
    verifierCache.set(cacheKey, verifier)
  }
  return verifier
}

export async function verifyBearerFromEvent(
  event: APIGatewayProxyEventV2,
  userPoolClientId: string
): Promise<AuthResult> {
  let token = getTokenFromCookies(event, "access_token")

  if (!token) {
    const authz = getHeader(event, "authorization")
    if (authz?.startsWith("Bearer ")) {
      token = authz.slice(7)
    }
  }

  if (!token) {
    return { ok: false, statusCode: StatusCodes.UNAUTHORIZED, message: "Missing Bearer token" }
  }

  try {
    // Extract userPoolId from token's issuer claim
    const decoded = decodeJwt(token)
    const issuer = decoded.iss
    if (!issuer || typeof issuer !== "string") {
      return { ok: false, statusCode: StatusCodes.UNAUTHORIZED, message: "Missing issuer claim" }
    }

    const userPoolId = extractUserPoolId(issuer)
    if (!userPoolId) {
      return {
        ok: false,
        statusCode: StatusCodes.UNAUTHORIZED,
        message: "Invalid token issuer format",
      }
    }

    const verifier = getVerifier(userPoolId, userPoolClientId)
    // Verify token: checks signature, issuer, expiration, client ID, and token use
    const payload = await verifier.verify(token)

    return { ok: true, claims: payload, bearerToken: token }
  } catch (e) {
    const err = e as Error
    console.error("[auth] Token verification failed", {
      error: err.message,
      errorName: err.name,
      path: event.requestContext?.http?.path,
      method: event.requestContext?.http?.method,
    })
    return { ok: false, statusCode: StatusCodes.UNAUTHORIZED, message: "Invalid token" }
  }
}
