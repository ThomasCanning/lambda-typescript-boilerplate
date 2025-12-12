import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3"

const s3Client = new S3Client({})

const RESERVED_SUBDOMAINS = new Set([
  "api",
  "www",
  "admin",
  "app",
  "auth",
  "blog",
  "cdn",
  "demo",
  "dev",
  "docs",
  "ftp",
  "help",
  "mail",
  "media",
  "staging",
  "status",
  "support",
  "test",
])

export async function isSubdomainAvailable(subdomain: string): Promise<boolean> {
  if (!/^[a-z0-9-]{4,32}$/.test(subdomain)) {
    return false
  }

  if (RESERVED_SUBDOMAINS.has(subdomain.toLowerCase())) {
    return false
  }

  const bucket = process.env.USER_SITES_BUCKET
  if (!bucket) {
    return true
  }

  try {
    const s3Key = `${subdomain}/index.html`
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: s3Key,
      })
    )
    return false
  } catch (error: unknown) {
    if (error && typeof error === "object") {
      if ("$metadata" in error && typeof error.$metadata === "object" && error.$metadata !== null) {
        const metadata = error.$metadata as { httpStatusCode?: number }
        if (metadata.httpStatusCode === 404) {
          return true
        }
      }
      if ("name" in error) {
        const errorName = String(error.name)
        if (errorName === "NotFound" || errorName === "NoSuchKey") {
          return true
        }
      }
    }
    console.error(`[isSubdomainAvailable] Error checking S3 for ${subdomain}:`, error)
    return false
  }
}

export function isValidSubdomainFormat(subdomain: string): boolean {
  return /^[a-z0-9-]{4,32}$/.test(subdomain)
}

export function getReservedSubdomains(): string[] {
  return Array.from(RESERVED_SUBDOMAINS)
}
