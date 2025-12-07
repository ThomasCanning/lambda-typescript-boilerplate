import { createFileRoute } from "@tanstack/react-router"
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
import { useGenerate } from "@/lib/api/hooks/use-generate"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [validationError, setValidationError] = useState<string>()

  const generateMutation = useGenerate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!linkedinUrl.trim()) {
      setValidationError("LinkedIn URL is required")
      return
    }

    // Validate it's a LinkedIn URL
    const urlPattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/
    if (!urlPattern.test(linkedinUrl.trim())) {
      setValidationError(
        "Please enter a valid LinkedIn profile URL (e.g., https://www.linkedin.com/in/username)"
      )
      return
    }

    setValidationError(undefined)
    generateMutation.mutate({
      prompt: linkedinUrl.trim(),
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">OneClickWebsite</h1>
          <p className="text-muted-foreground">Generate your website in one click</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Enter your LinkedIn profile URL to generate your website
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pb-6">
              {generateMutation.isError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {generateMutation.error instanceof Error
                      ? generateMutation.error.message
                      : "Generation failed"}
                  </AlertDescription>
                </Alert>
              )}

              {generateMutation.isSuccess && (
                <Alert>
                  <AlertDescription className="space-y-2">
                    <p className="text-sm font-medium">Website generated successfully!</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Create a blob and open in new window
                          const blob = new Blob([generateMutation.data.text], { type: "text/html" })
                          const url = URL.createObjectURL(blob)
                          window.open(url, "_blank")
                        }}
                      >
                        Open in New Window
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Download the HTML file
                          const blob = new Blob([generateMutation.data.text], { type: "text/html" })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement("a")
                          a.href = url
                          a.download = "index.html"
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)
                        }}
                      >
                        Download HTML
                      </Button>
                    </div>
                    <div className="mt-4 border rounded-lg overflow-hidden">
                      <iframe
                        srcDoc={generateMutation.data.text}
                        className="w-full h-96 border-0"
                        title="Generated Website Preview"
                      />
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn Profile URL</Label>
                <Input
                  id="linkedin"
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => {
                    setLinkedinUrl(e.target.value)
                    if (validationError) {
                      setValidationError(undefined)
                    }
                  }}
                  disabled={generateMutation.isPending}
                  placeholder="https://www.linkedin.com/in/username"
                  aria-invalid={!!validationError}
                />
                {validationError && <p className="text-sm text-destructive">{validationError}</p>}
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Button type="submit" disabled={generateMutation.isPending} className="w-full">
                {generateMutation.isPending ? "Generating..." : "Generate Website"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
