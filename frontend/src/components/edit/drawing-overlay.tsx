import { useRef, useEffect, useState } from "react"

interface Point {
  x: number
  y: number
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface DrawingOverlayProps {
  isActive: boolean
  onDrawComplete: (box: Box) => void
  className?: string
}

export function DrawingOverlay({ isActive, onDrawComplete, className }: DrawingOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null)
  const [completedBox, setCompletedBox] = useState<Box | null>(null)

  // Reset when overlay becomes active/inactive
  useEffect(() => {
    if (!isActive) {
      setStartPoint(null)
      setCurrentPoint(null)
      setCompletedBox(null)
      setIsDrawing(false)
    }
  }, [isActive])

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    if (!svgRef.current) return null
    const rect = svgRef.current.getBoundingClientRect()

    // Handle both mouse and touch events
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isActive) return
    e.preventDefault() // Prevent scrolling on touch
    setIsDrawing(true)
    const point = getCoordinates(e)
    if (point) {
      setStartPoint(point)
      setCurrentPoint(point)
      setCompletedBox(null) // Clear previous box when starting new one
    }
  }

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isActive || !isDrawing) return
    e.preventDefault()
    const point = getCoordinates(e)
    if (point) {
      setCurrentPoint(point)
    }
  }

  const handleEnd = () => {
    if (!isActive || !isDrawing || !startPoint || !currentPoint) return

    setIsDrawing(false)

    // Calculate final box
    const x = Math.min(startPoint.x, currentPoint.x)
    const y = Math.min(startPoint.y, currentPoint.y)
    const width = Math.abs(currentPoint.x - startPoint.x)
    const height = Math.abs(currentPoint.y - startPoint.y)

    // Only accept if larger than essentially a click (5x5 pixels)
    if (width > 5 && height > 5) {
      const box = { x, y, width, height }
      setCompletedBox(box)
      onDrawComplete(box)
    } else {
      // Reset if too small
      setStartPoint(null)
      setCurrentPoint(null)
    }
  }

  const getBoxDimensions = () => {
    if (!startPoint || !currentPoint) return null
    const x = Math.min(startPoint.x, currentPoint.x)
    const y = Math.min(startPoint.y, currentPoint.y)
    const width = Math.abs(currentPoint.x - startPoint.x)
    const height = Math.abs(currentPoint.y - startPoint.y)
    return { x, y, width, height }
  }

  if (!isActive && !completedBox) return null

  const activeBox = isDrawing ? getBoxDimensions() : completedBox

  return (
    <div className={className} style={{ touchAction: "none" }}>
      <svg
        ref={svgRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        {activeBox && (
          <rect
            x={activeBox.x}
            y={activeBox.y}
            width={activeBox.width}
            height={activeBox.height}
            stroke="#3b82f6"
            strokeWidth="3"
            fill="rgba(59, 130, 246, 0.1)"
            style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.3))" }}
          />
        )}
      </svg>
    </div>
  )
}
