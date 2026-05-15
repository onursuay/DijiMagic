'use client'

export default function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex-1 flex flex-col overflow-y-auto"
      onClick={() => window.dispatchEvent(new Event('sidebar:close-groups'))}
    >
      {children}
    </div>
  )
}
