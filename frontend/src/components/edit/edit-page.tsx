import { useEffect, useState } from "react"
import { fetchSite } from "@/lib/api"
import { Spinner } from "@/components/ui/spinner"

type EditPageProps = {
  header: React.ReactNode
  jobId?: string
  onSiteLoaded?: (html: string) => void
}

export function EditPage({ header, jobId, onSiteLoaded }: EditPageProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Fetch site content
    const loadSite = async () => {
      try {
        const res = await fetchSite(jobId)
        if (active && res.html) {
          setHtml(res.html)
          onSiteLoaded?.(res.html)
        }
      } catch (err) {
        console.error("Failed to fetch site", err)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSite()

    return () => {
      active = false
    }
  }, [jobId, onSiteLoaded])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pt-16">
      {header}
      <div className="flex-1 bg-gray-50/50 p-6 overflow-hidden flex flex-col">
        {html ? (
          <iframe
            srcDoc={html}
            className="w-full flex-1 rounded-xl shadow-lg border bg-white"
            title="Generated Website"
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            No website content found.
          </div>
        )}
      </div>
    </div>
  )
}
