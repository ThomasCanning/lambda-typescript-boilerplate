import { createFileRoute } from "@tanstack/react-router"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { GlobalNav } from "../components/editor/GlobalNav"
import { AICommandCenter } from "../components/editor/AICommandCenter"
import { LivePreview } from "../components/editor/LivePreview"
// import { FloaterWidget } from "../components/editor/FloaterWidget"
import { useState } from "react"
// import { useJobStatus } from '@/hooks/useJobStatus';
import { CodeView } from "@/components/editor/CodeView"
import { EditorProvider } from "@/components/editor/EditorProvider"

export const Route = createFileRoute("/edit/$jobId")({
  component: EditRoute,
})

function EditRoute() {
  const { jobId } = Route.useParams()
  const [activeTab, setActiveTab] = useState<"app" | "code">("app")
  // const { data, isLoading, error } = useJobStatus(jobId);
  // console.log('Job Status:', data);
  // Remove the direct useJobStatus call here, the Provider handles it now!

  return (
    <EditorProvider jobId={jobId}>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* Pass state to Nav */}
        <GlobalNav activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 overflow-hidden relative">
          <PanelGroup direction="horizontal">
            {/* Left Panel: Brain */}
            <Panel defaultSize={25} minSize={20} maxSize={40} className="border-r border-border">
              <AICommandCenter />
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize z-10" />

            {/* Right Panel - Conditional Rendering */}
            <Panel defaultSize={75} className="relative">
              {activeTab === "app" ? (
                <>
                  <LivePreview />
                  {/* <FloaterWidget /> */}
                </>
              ) : (
                <CodeView />
              )}
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </EditorProvider>
  )
}
