import { useState } from "react"
import {
  Send,
  Paperclip,
  ChevronDown,
  Image as ImageIcon,
  FileCode,
  CheckCircle2,
  Circle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useEditor } from "@/components/editor/EditorProvider" // Import context hook
import { sendEditCommand } from "@/lib/api"

type ThoughtStep = {
  icon: string
  text: string
  status: string | undefined
}

type HistoryItem =
  | { type: "user"; content: string }
  | { type: "agent"; content: string }
  | { type: "thought"; duration: string; expanded: boolean; steps: ThoughtStep[] }

export function AICommandCenter() {
  const [input, setInput] = useState("")
  const { agentStates, status: jobStatus, jobId } = useEditor() // Get real data
  const [localHistory, setLocalHistory] = useState<HistoryItem[]>([])

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!input) return
    if (!jobId) return

    // Optimistically add user message
    const newMessage: HistoryItem = { type: "user", content: input }
    setLocalHistory((prev) => [...prev, newMessage])

    await sendEditCommand(jobId, input)
    setInput("")
  }

  // ... (keep definitions of steps, currentProcess, systemMessage) ...

  // 1. Transform 'agentStates' into "Thinking Steps"
  const steps: ThoughtStep[] = [
    {
      icon: "file",
      text: `Copywriter: ${agentStates?.copy || "idle"}`,
      status: agentStates?.copy,
    },
    {
      icon: "edit",
      text: `Designer: ${agentStates?.color || "idle"}`,
      status: agentStates?.color,
    },
    {
      icon: "search",
      text: `Senior Dev: ${agentStates?.senior || "idle"}`,
      status: agentStates?.senior,
    },
  ].filter((s) => s.status !== "idle") // Only show active/completed agents

  // 2. Create a dynamic history item
  const currentProcess: HistoryItem = {
    type: "thought",
    duration: "Active",
    expanded: true,
    steps: steps,
  }

  // 3. Create the System Message (Progress)
  const systemMessage: HistoryItem | null = jobStatus?.progressMessage
    ? {
        type: "agent",
        content: jobStatus.progressMessage,
      }
    : null

  // Combine them
  const history: HistoryItem[] = [
    ...localHistory,
    ...(steps.length > 0 ? [currentProcess] : []),
    ...(systemMessage ? [systemMessage] : []),
  ]

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-6 pb-24">
        {history.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              "flex flex-col gap-2 max-w-[90%]",
              msg.type === "user" ? "self-end items-end" : "self-start"
            )}
          >
            {msg.type === "user" && (
              <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm">
                {msg.content}
              </div>
            )}

            {msg.type === "thought" && (
              <ThinkingProcess steps={msg.steps || []} duration={msg.duration} />
            )}

            {msg.type === "agent" && (
              <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-foreground">
                {msg.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-background absolute bottom-0 left-0 right-0">
        <div className="relative rounded-xl border shadow-sm bg-muted/30 focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all">
          <form onSubmit={(e) => void handleSubmit(e)}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  // Call your submit function manually
                  void handleSubmit(e)
                }
              }}
              placeholder="Ask Alan anything..."
              className="w-full bg-transparent border-none focus:ring-0 resize-none px-4 py-3 min-h-[60px] text-sm"
              rows={1}
            />
          </form>
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
              >
                <Paperclip className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
              >
                <ImageIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
              >
                <FileCode className="size-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center text-xs text-muted-foreground bg-background border rounded-full px-2 py-1 gap-1 cursor-pointer hover:bg-muted">
                <span>Auto</span>
                <ChevronDown className="size-3" />
              </div>
              <Button size="icon" className="h-8 w-8 rounded-lg">
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThinkingProcess({ steps, duration }: { steps: ThoughtStep[]; duration?: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border rounded-lg overflow-hidden bg-card w-full max-w-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-xs font-medium text-muted-foreground"
      >
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 animate-pulse" />
          <span>Thought for {duration}</span>
        </div>
        <ChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2 text-xs border-t">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-0.5">{iconForType(step.icon)}</span>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function iconForType(type: string) {
  switch (type) {
    case "file":
      return <FileCode className="size-3" />
    case "search":
      return <Circle className="size-3" />
    case "edit":
      return <CheckCircle2 className="size-3 text-green-500" />
    default:
      return <Circle className="size-3" />
  }
}
