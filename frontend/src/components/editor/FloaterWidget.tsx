import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Paperclip, Sparkles, Scan, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function FloaterWidget() {
  const [input, setInput] = useState("")
  const [isScanMode, setIsScanMode] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])

  // In a real app, this would trigger the file picker
  const handleAttach = () => {
    // Simulation: Add a fake file
    const fakeFile = new File(["dummy"], `screenshot-${Date.now()}.png`, { type: "image/png" })
    setAttachments([...attachments, fakeFile])
  }

  const toggleScanMode = () => {
    setIsScanMode(!isScanMode)
    // In the future, this would send a message to LivePreview to enable bounding box selection
    console.log("Toggled Selection Mode:", !isScanMode)
  }
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      {/* Selection Mode Indicator */}
      <AnimatePresence>
        {isScanMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold mx-auto w-fit shadow-lg"
          >
            Review Mode Active: Click elements to select
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        className={cn(
          "bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl p-2 pl-4 flex items-center gap-4 dark:bg-zinc-900/90 dark:border-zinc-800 transition-all",
          isScanMode && "ring-2 ring-blue-500 border-blue-500"
        )}
      >
        {/* Logo or Active State */}
        <div className="flex-shrink-0 text-pink-500">
          <Sparkles className={cn("size-6 fill-current", isScanMode && "text-blue-500")} />
        </div>

        {/* Wrapper for Input + Attachments */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          {attachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-1.5 scrollbar-hide">
              {attachments.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 pl-2 pr-1 py-1 rounded-md text-xs group shrink-0"
                >
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <button
                    onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                    className="hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-sm p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isScanMode ? "Describe what to change about the selection..." : "Ask Alan..."
            }
            className="w-full bg-transparent border-none outline-none text-base placeholder:text-zinc-500 text-zinc-800 dark:text-zinc-100 min-w-0"
          />
        </div>

        {/* Actions Group */}
        <div className="flex items-center gap-1 pr-1">
          {/* Scan / Bounding Box Toggle */}
          <Button
            onClick={toggleScanMode}
            size="icon"
            variant="ghost"
            className={cn(
              "h-9 w-9 rounded-full transition-colors",
              isScanMode
                ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
            )}
          >
            <Scan className="size-5" />
          </Button>
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1" />
          {/* Attach */}
          <Button
            onClick={handleAttach}
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900"
          >
            <Paperclip className="size-5" />
          </Button>
          {/* Send */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
