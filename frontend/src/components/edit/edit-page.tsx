import { useEffect, useState, useRef } from "react"
import { useUser } from "@/lib/api/hooks/use-user"
import { fetchSite, submitEdit, fetchEditStatus } from "@/lib/api"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { FloatingEditorBar } from "./floating-editor-bar"
import { DrawingOverlay } from "./drawing-overlay"
import { cn } from "@/lib/utils"
import { toPng } from "html-to-image"
import type { EditAgentStates } from "./agent-status-bar"

type EditPageProps = {
  renderHeader: (props: { agentStates: EditAgentStates }) => React.ReactNode
  jobId?: string
  onSiteLoaded?: (html: string) => void
}

export function EditPage({ renderHeader, jobId, onSiteLoaded }: EditPageProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false)
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false)
  const [agentStates, setAgentStates] = useState<EditAgentStates>({})
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const { user, isLoading: userLoading } = useUser()

  // Job ID for the current editing session (from screenshot upload)
  const [editJobId, setEditJobId] = useState<string | null>(null)

  // ... (useEffect hook content omitted for brevity, it remains unchanged) ...

  useEffect(() => {
    // ... (content of this useEffect is unchanged, just restoring context)
    // Actually, I can just replace the variable declarations and handler logic.
    // I will replace from handleInputFocus downwards to be safe and cover all usages.
    if (userLoading) return

    let active = true

    // Fetch site content
    const loadSite = async () => {
      try {
        const idToFetch = user ? undefined : jobId
        const res = await fetchSite(idToFetch)

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
  }, [jobId, onSiteLoaded, user, userLoading])

  // ... (useEffect hook content omitted for brevity, it remains unchanged) ...

  const handleDrawComplete = async (box: {
    x: number
    y: number
    width: number
    height: number
  }) => {
    setIsDrawing(false)
    setEditJobId(null) // Reset job ID for new screenshot

    if (!iframeRef.current?.contentWindow) return

    try {
      const win = iframeRef.current.contentWindow
      const doc = win.document
      const body = doc.body

      // Determine effective scroll position
      let scrollX = win.scrollX
      let scrollY = win.scrollY

      if (scrollX === 0 && scrollY === 0) {
        const candidates = [doc.documentElement, doc.body, ...Array.from(doc.body.children)]
        for (const el of candidates) {
          if (el.scrollTop > 0 || el.scrollLeft > 0) {
            scrollX = el.scrollLeft
            scrollY = el.scrollTop
            break
          }
        }
      }

      console.log("Scroll position:", { scrollX, scrollY })
      console.log("Box selection:", box)

      // 1. Capture the ENTIRE scrollable content of the iframe body
      // We set height/width explicitly to scrollHeight/Width to force full render
      const dataUrl = await toPng(body, {
        width: body.scrollWidth,
        height: body.scrollHeight,
        pixelRatio: window.devicePixelRatio,
        fontEmbedCSS: "", // Prevent security errors by skipping font embedding
      })

      // 2. Load the full image so we can crop it
      const img = new Image()
      img.src = dataUrl

      await new Promise((resolve) => {
        img.onload = resolve
      })

      // 3. Create a cropped canvas
      // Calculate absolute position in the document
      const absoluteX = box.x + scrollX
      const absoluteY = box.y + scrollY

      // Account for pixel ratio in the source image
      const pixelRatio = window.devicePixelRatio

      const croppedCanvas = document.createElement("canvas")
      croppedCanvas.width = box.width * pixelRatio
      croppedCanvas.height = box.height * pixelRatio

      const ctx = croppedCanvas.getContext("2d")
      if (!ctx) return

      // Draw:
      // Source X = absoluteX * pixelRatio
      // Source Y = absoluteY * pixelRatio
      // Source W = box.width * pixelRatio
      // Source H = box.height * pixelRatio
      // Dest X,Y = 0,0
      // Dest W,H = canvas width, height

      ctx.drawImage(
        img,
        absoluteX * pixelRatio,
        absoluteY * pixelRatio,
        box.width * pixelRatio,
        box.height * pixelRatio,
        0,
        0,
        croppedCanvas.width,
        croppedCanvas.height
      )

      const croppedDataUrl = croppedCanvas.toDataURL("image/png")
      setScreenshot(croppedDataUrl)
    } catch (error) {
      console.error("Screenshot failed:", error)
    }
  }

  const [pollingJobId, setPollingJobId] = useState<string | null>(null)

  useEffect(() => {
    if (!pollingJobId) return

    let timeoutId: NodeJS.Timeout
    let active = true

    const poll = async () => {
      try {
        const status = await fetchEditStatus(pollingJobId)

        if (!active) return

        if (status.agentStates) {
          setAgentStates(status.agentStates)
        }

        if (status.status === "succeeded") {
          // Fetch the new site content (using the job ID we just polled)
          // We can retrieve the content by calling fetchSite with the jobId
          try {
            // In edit flow, we might want to fetch by jobId to get the *result* of the edit
            // The backend's fetchSite (api/edit/{jobId}) now supports checking editStore
            const res = await fetchSite(pollingJobId)
            if (res.html) {
              setHtml(res.html)
              onSiteLoaded?.(res.html)
              toast.success("Edit applied successfully!")
            }
          } catch (err) {
            console.error("Failed to fetch updated site", err)
            toast.error("Edit succeeded but failed to load result.")
          }
          setPollingJobId(null)
        } else if (status.status === "failed") {
          toast.error(`Edit failed: ${status.error || "Unknown error"}`)
          setPollingJobId(null)
        } else {
          // Continue polling
          timeoutId = setTimeout(() => void poll(), 2000)
        }
      } catch (e) {
        console.error("Polling failed", e)
        // Retry
        timeoutId = setTimeout(() => void poll(), 2000)
      }
    }

    void poll()

    return () => {
      active = false
      clearTimeout(timeoutId)
    }
  }, [pollingJobId, onSiteLoaded])

  const handleInputFocus = async () => {
    if (
      screenshot &&
      !editJobId &&
      !isUploadingScreenshot &&
      !isSubmittingPrompt &&
      !pollingJobId
    ) {
      console.log("Uploading screenshot to start edit job...")
      setIsUploadingScreenshot(true)
      try {
        // If user is signed in, pass undefined. If guest, pass the page jobId.
        const pageId = user ? undefined : jobId
        const res = await submitEdit({ screenshot }, pageId)
        if (res.jobId) {
          setEditJobId(res.jobId)
          console.log("Edit job started:", res.jobId)
        }
      } catch (error) {
        console.error("Failed to upload screenshot:", error)
      } finally {
        setIsUploadingScreenshot(false)
      }
    }
  }

  const handleSend = async (prompt: string) => {
    if (!editJobId) {
      // If we don't have a job ID yet (e.g. somehow failed to upload screenshot or user didn't select anything?), we can't send.
      // But if we have a screenshot and no job ID, maybe we should try uploading now?
      if (screenshot) {
        // handleInputFocus handles this, but let's be safe
        // For now assuming handleInputFocus did its job or we can just try again here if needed.
        // Let's defer to handleInputFocus logic or just block.
        // Actually, better to just try uploading first if not present.
        setIsSubmittingPrompt(true)
        try {
          // If user is signed in, pass undefined. If guest, pass the page jobId.
          const pageId = user ? undefined : jobId
          const res = await submitEdit({ screenshot }, pageId)
          if (res.jobId) {
            await submitEdit({ jobId: res.jobId, prompt }, pageId)
            // Start polling with the new job ID
            setPollingJobId(res.jobId)

            // Reset local state
            setScreenshot(null)
            setEditJobId(null)
          }
        } catch (error) {
          console.error("Failed to send edit:", error)
        } finally {
          setIsSubmittingPrompt(false)
        }
        return
      }
      return
    }

    setIsSubmittingPrompt(true)
    try {
      const pageId = user ? undefined : jobId
      await submitEdit({ jobId: editJobId, prompt }, pageId)

      // Start polling
      setPollingJobId(editJobId)

      // Cleanup after send
      setScreenshot(null)
      setEditJobId(null)
    } catch (error) {
      console.error("Failed to send prompt:", error)
    } finally {
      setIsSubmittingPrompt(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const isProcessing = isSubmittingPrompt || !!pollingJobId

  return (
    <div className="min-h-screen bg-background flex flex-col pt-20">
      {renderHeader({ agentStates })}
      <div className="flex-1 bg-gray-50/50 p-6 overflow-hidden flex flex-col relative">
        {html ? (
          <div className="relative w-full flex-1 rounded-xl shadow-lg border bg-white overflow-hidden">
            <iframe
              ref={iframeRef}
              srcDoc={html}
              className="absolute inset-0 w-full h-full border-0"
              title="Generated Website"
            />
            <DrawingOverlay
              isActive={isDrawing}
              onDrawComplete={(points) => {
                void handleDrawComplete(points)
              }}
              className={cn(
                "absolute inset-0 z-10",
                isDrawing ? "cursor-crosshair touch-none" : "pointer-events-none"
              )}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            No website content found.
          </div>
        )}
      </div>

      <FloatingEditorBar
        onSend={(prompt) => {
          void handleSend(prompt)
        }}
        isDrawing={isDrawing}
        onToggleDraw={() => setIsDrawing(!isDrawing)}
        hasScreenshot={!!screenshot}
        onClearScreenshot={() => {
          setScreenshot(null)
          setEditJobId(null)
        }}
        onInputFocus={() => void handleInputFocus()}
        isLoading={isProcessing}
      />
    </div>
  )
}
