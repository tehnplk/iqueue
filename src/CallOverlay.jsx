import { Volume2 } from 'lucide-react'

// Shown in a transparent, click-through window; closes itself when the fade finishes.
export default function CallOverlay() {
  return (
    <div className="call-overlay" onAnimationEnd={() => window.close()}>
      <Volume2 size={192} strokeWidth={1.5} />
    </div>
  )
}
