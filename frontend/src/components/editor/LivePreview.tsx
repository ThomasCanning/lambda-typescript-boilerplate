import { RefreshCw, ExternalLink, Smartphone, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEditor } from "@/components/editor/EditorProvider"

export function LivePreview() {
  const { finalHtml } = useEditor()
  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Chrome */}
      <div className="h-12 border-b bg-background/50 backdrop-blur flex items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            <div className="size-3 rounded-full bg-red-400/20 border border-red-500/50" />
            <div className="size-3 rounded-full bg-amber-400/20 border border-amber-500/50" />
            <div className="size-3 rounded-full bg-green-400/20 border border-green-500/50" />
          </div>

          <div className="flex-1 max-w-xl mx-auto bg-muted/50 rounded-md h-8 flex items-center px-3 text-sm text-muted-foreground border border-transparent hover:border-border transition-colors cursor-text">
            localhost:3000/dashboard
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Smartphone className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 bg-muted">
            <Monitor className="size-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <RefreshCw className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ExternalLink className="size-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 p-8 overflow-auto flex items-center justify-center">
        <div className="w-full h-full bg-background rounded-lg border shadow-sm overflow-hidden relative">
          {/* Render Iframe if we have HTML */}
          {finalHtml ? (
            <iframe
              className="w-full h-full border-none"
              srcDoc={finalHtml}
              title="Preview"
              sandbox="allow-scripts" // Allow scripts but block other potentially unsafe things
            />
          ) : (
            /* Empty State (Keep your existing one) */
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground flex-col gap-4">
              <div className="p-4 rounded-full bg-muted">
                <Monitor className="size-8 opacity-20" />
              </div>
              <p>Waiting for generation...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
