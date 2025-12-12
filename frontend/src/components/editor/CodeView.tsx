import { useEditor } from "@/components/editor/EditorProvider"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
export function CodeView() {
  const { finalHtml } = useEditor()
  return (
    <div className="h-full bg-[#1e1e1e] overflow-auto text-sm">
      <SyntaxHighlighter
        language="html"
        style={vscDarkPlus}
        customStyle={{ margin: 0, height: "100%", borderRadius: 0 }}
        showLineNumbers={true}
        wrapLines={true}
      >
        {finalHtml || "<!-- No code generated yet -->"}
      </SyntaxHighlighter>
    </div>
  )
}
