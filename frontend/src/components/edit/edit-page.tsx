import { useEffect, useState, useRef } from "react"
import { fetchSite } from "@/lib/api"
import { Spinner } from "@/components/ui/spinner"
import { FloatingEditorBar } from "./floating-editor-bar"
import { DrawingOverlay } from "./drawing-overlay"
import { cn } from "@/lib/utils"
import { toPng } from "html-to-image"

type EditPageProps = {
  header: React.ReactNode
  jobId?: string
  onSiteLoaded?: (html: string) => void
}

export function EditPage({ header, jobId, onSiteLoaded }: EditPageProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

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

  const handleDrawComplete = async (box: {
    x: number
    y: number
    width: number
    height: number
  }) => {
    setIsDrawing(false)

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

      // DEBUG: Download screenshot
      const link = document.createElement("a")
      link.download = `edit-crop-${Date.now()}.png`
      link.href = croppedDataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Screenshot failed:", error)
    }
  }

  const handleSend = async (prompt: string) => {
    setIsSending(true)
    // Mock API call
    console.log("Sending edit request:", { prompt, screenshot })

    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setIsSending(false)
    setScreenshot(null)
    // Here we would typically refresh the site or show the updated version
  }

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
        onClearScreenshot={() => setScreenshot(null)}
        isLoading={isSending}
      />
    </div>
  )
}
