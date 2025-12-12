import { Palette, PenTool } from "lucide-react"

export type PaletteOption = {
  id: string
  label: string
  primary: string
  secondary: string
  background: string
  text: string
  accent: string
}

export type CopyOption = {
  id: string
  label: string
  headline: string
  bio: string
}

export type ColorOptions = {
  options: PaletteOption[]
}

export type CopyOptions = {
  options: CopyOption[]
}

export function ColorChoiceCard({
  options,
  onSelect,
}: {
  options: ColorOptions
  onSelect: (id: string) => void
}) {
  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-purple-100 rounded-2xl flex items-center justify-center mb-4 text-purple-600">
          <Palette className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold">Choose a Style</h2>
        <p className="text-lg text-muted-foreground">
          Select a color palette that matches your personal brand.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.options.map((opt) => (
          <div
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className="group p-5 rounded-xl border-2 border-border hover:border-purple-500/50 hover:bg-purple-50/10 cursor-pointer transition-all bg-white shadow-sm hover:shadow-md"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-lg">{opt.label}</span>
            </div>
            <div className="flex h-12 rounded-lg overflow-hidden ring-1 ring-black/5">
              <div className="flex-1" style={{ backgroundColor: opt.primary }} />
              <div className="flex-1" style={{ backgroundColor: opt.secondary }} />
              <div className="flex-1" style={{ backgroundColor: opt.background }} />
              <div className="flex-1" style={{ backgroundColor: opt.text }} />
              <div className="flex-1" style={{ backgroundColor: opt.accent }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CopyChoiceCard({
  options,
  onSelect,
}: {
  options: CopyOptions
  onSelect: (id: string) => void
}) {
  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-green-100 rounded-2xl flex items-center justify-center mb-4 text-green-600">
          <PenTool className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold">Refine Your Story</h2>
        <p className="text-lg text-muted-foreground">Choose the copy that best describes you.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {options.options.map((opt) => (
          <div
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className="group p-6 rounded-xl border-2 border-border hover:border-green-500/50 hover:bg-green-50/10 cursor-pointer transition-all bg-white shadow-sm hover:shadow-md text-left"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-lg text-foreground group-hover:text-green-700 transition-colors">
                {opt.label}
              </span>
            </div>
            <div className="space-y-3">
              <p className="text-base font-medium leading-normal text-foreground/90">
                {opt.headline}
              </p>
              <p className="text-sm text-muted-foreground">{opt.bio}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
