import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Pencil, X, Loader2 } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface FloatingEditorBarProps {
  onSend: (prompt: string) => void
  isDrawing: boolean
  onToggleDraw: () => void
  hasScreenshot: boolean
  onClearScreenshot: () => void
  onInputFocus?: () => void
  isLoading?: boolean
}

export function FloatingEditorBar({
  onSend,
  isDrawing,
  onToggleDraw,
  hasScreenshot,
  onClearScreenshot,
  onInputFocus,
  isLoading,
}: FloatingEditorBarProps) {
  const [prompt, setPrompt] = useState("")

  const handleSend = () => {
    if (isLoading) return
    if (prompt.trim()) {
      onSend(prompt)
      setPrompt("")
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50">
      <div className="bg-background/80 backdrop-blur-md border shadow-lg rounded-full p-2 flex items-center gap-2 transition-all">
        <Button
          variant={isDrawing ? "default" : "ghost"}
          size="icon"
          className={cn("rounded-full shrink-0", isDrawing && "bg-blue-500 hover:bg-blue-600")}
          onClick={onToggleDraw}
          title="Draw to select"
        >
          <Pencil className="h-4 w-4" />
        </Button>

        {hasScreenshot && (
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-xs font-medium shrink-0 animate-in fade-in slide-in-from-bottom-2">
            <span>Target selected</span>
            <button
              onClick={onClearScreenshot}
              className="hover:bg-background/50 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            isLoading ? "Applying edits..." : "Describe how to change the selected area..."
          }
          className="border-0 focus-visible:ring-0 bg-transparent shadow-none h-10 px-2"
          onFocus={onInputFocus}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />

        <Button
          onClick={handleSend}
          disabled={!prompt.trim() || isLoading}
          size="icon"
          className="rounded-full shrink-0"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
