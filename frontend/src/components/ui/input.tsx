import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/60 selection:bg-primary/20 selection:text-foreground border-input/50 h-12 w-full min-w-0 rounded-xl border-2 bg-background/50 backdrop-blur-sm px-4 py-3 text-base shadow-sm transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "hover:border-primary/30 hover:bg-background/80",
        "focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10",
        "aria-invalid:border-destructive/50 aria-invalid:ring-4 aria-invalid:ring-destructive/10",
        className
      )}
      {...props}
    />
  )
}

export { Input }
