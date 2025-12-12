import { LayoutGrid, Code, Database, CreditCard, Send, Settings, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface GlobalNavProps {
  activeTab: "app" | "code"
  onTabChange: (tab: "app" | "code") => void
}

export function GlobalNav({ activeTab, onTabChange }: GlobalNavProps) {
  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <div className="font-bold text-lg tracking-tight flex items-center gap-2">
          {/* Logo placeholder */}
          <div className="size-8 rounded bg-primary/10 flex items-center justify-center text-primary">
            <LayoutGrid className="size-5" />
          </div>
          <span>Alan</span>
        </div>

        <nav className="flex items-center gap-1">
          <Button
            onClick={() => onTabChange("app")}
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 font-medium transition-colors",
              activeTab === "app"
                ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-4" />
            App
          </Button>
          <Button
            onClick={() => onTabChange("code")}
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 font-medium transition-colors",
              activeTab === "code"
                ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Code className="size-4" />
            Code
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Database className="size-4" />
            Database
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <CreditCard className="size-4" />
            Billing
          </Button>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="gap-2">
          <Send className="size-4" />
          Publish
        </Button>
        <Button size="icon" variant="ghost">
          <Settings className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" className="rounded-full bg-muted">
          <User className="size-4" />
        </Button>
      </div>
    </header>
  )
}
