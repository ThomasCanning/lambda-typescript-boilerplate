import { Search, Hammer } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

export function ScraperCard() {
  return (
    <div className="text-center space-y-4">
      <div className="relative w-24 h-24 mx-auto flex items-center justify-center rounded-full bg-blue-50 border-4 border-blue-100 animate-pulse">
        <Search className="w-10 h-10 text-blue-500 animate-bounce" />
      </div>
      <div>
        <h2 className="text-2xl font-bold">Scanning Profile</h2>
        <p className="text-muted-foreground mt-2">Gathering insights from LinkedIn...</p>
      </div>
    </div>
  )
}

export function BuilderCard() {
  return (
    <div className="text-center space-y-6">
      <div className="relative w-24 h-24 mx-auto flex items-center justify-center rounded-full bg-orange-50 border-4 border-orange-100">
        <Hammer className="w-10 h-10 text-orange-500 animate-pulse" />
        <div className="absolute inset-0 border-t-4 border-orange-500 rounded-full animate-spin"></div>
      </div>
      <div>
        <h2 className="text-2xl font-bold">Assembling Website</h2>
        <p className="text-muted-foreground mt-2">Putting it all together...</p>
      </div>
    </div>
  )
}

export function AgentsWorkingCard() {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-lg font-medium text-muted-foreground">Agents are working...</p>
        </div>
      </div>
    </div>
  )
}
