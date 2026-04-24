import { FolderOpen } from 'lucide-react'
import { usePickAndOpenProject } from '@/hooks/useProjectLoader'

export function OpenFolderButton() {
  const pickAndOpen = usePickAndOpenProject()
  return (
    <button
      type="button"
      onClick={() => pickAndOpen()}
      title="Open project folder"
      aria-label="Open project folder"
      className="grid size-8 place-items-center rounded text-app-muted hover:bg-app-panel hover:text-app"
    >
      <FolderOpen className="size-5" />
    </button>
  )
}
