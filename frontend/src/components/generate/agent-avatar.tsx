import { CheckCircle2 } from "lucide-react"

export function AgentAvatar({
  icon: Icon,
  status,
  label,
}: {
  icon: React.ElementType
  status: "idle" | "thinking" | "waiting" | "completed"
  label: string
}) {
  const getStyles = () => {
    switch (status) {
      case "idle":
        return "bg-gray-100 text-gray-400 border-gray-200"
      case "thinking":
        return "bg-blue-50 text-blue-600 border-blue-200 animate-pulse ring-2 ring-blue-100"
      case "waiting":
        return "bg-amber-50 text-amber-600 border-amber-200 ring-2 ring-amber-100 bg-amber-50/50"
      case "completed":
        return "bg-green-50 text-green-600 border-green-200"
      default:
        return "bg-gray-100 text-gray-400"
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5 group">
      <div
        className={`
                 relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300
                 ${getStyles()}
             `}
      >
        <Icon className="w-5 h-5" />

        {/* Status Badge */}
        {status === "completed" && (
          <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border-2 border-white">
            <CheckCircle2 className="w-3 h-3" />
          </div>
        )}
        {status === "waiting" && (
          <div className="absolute -top-1 -right-1 bg-amber-500 w-3 h-3 rounded-full border-2 border-white animate-pulse" />
        )}
      </div>
      <span
        className={`text-[10px] font-semibold uppercase tracking-wider ${status === "idle" ? "text-gray-300" : "text-gray-600"}`}
      >
        {label}
      </span>
    </div>
  )
}
