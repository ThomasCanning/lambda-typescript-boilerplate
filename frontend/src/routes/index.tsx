import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { postGenerateStart } from "@/lib/api/http/generate"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const [linkedinUsername, setLinkedinUsername] = useState("")
  const [validationError, setValidationError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const username = linkedinUsername.trim()

    if (!username) {
      setValidationError("LinkedIn username is required")
      return
    }

    // Validate it's a valid LinkedIn username (alphanumeric, hyphens, underscores)
    const usernamePattern = /^[a-zA-Z0-9_-]+$/
    if (!usernamePattern.test(username)) {
      setValidationError(
        "Please enter a valid LinkedIn username (e.g., thomasjcanning). Only letters, numbers, hyphens, and underscores are allowed."
      )
      return
    }

    // Construct the full LinkedIn URL
    const linkedinUrl = `https://www.linkedin.com/in/${username}`

    setValidationError(undefined)
    setIsSubmitting(true)

    try {
      const { jobId } = await postGenerateStart({ prompt: linkedinUrl })
      // Navigate to the generation page
      void navigate({ to: "/generate/$jobId", params: { jobId } })
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Failed to start generation")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" asChild>
          <Link to="/login">Log in</Link>
        </Button>
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">OneClick</h1>
          <p className="text-muted-foreground">Generate your website in one click</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>Enter your LinkedIn username to generate your website</CardDescription>
          </CardHeader>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <CardContent className="space-y-4 pb-6">
              {validationError && (
                <Alert variant="destructive">
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn Username</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    linkedin.com/in/
                  </span>
                  <Input
                    id="linkedin"
                    type="text"
                    value={linkedinUsername}
                    onChange={(e) => {
                      setLinkedinUsername(e.target.value)
                      if (validationError) {
                        setValidationError(undefined)
                      }
                    }}
                    disabled={isSubmitting}
                    placeholder="thomasjcanning"
                    aria-invalid={!!validationError}
                    className="flex-1"
                  />
                </div>
                {validationError && <p className="text-sm text-destructive">{validationError}</p>}
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Starting..." : "Generate Website"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
