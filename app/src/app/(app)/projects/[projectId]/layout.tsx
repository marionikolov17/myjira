import type { ReactNode } from 'react'
import { ProjectLayoutView } from '@/features/projects/components/ProjectLayoutView'

export default function ProjectLayout({ children }: { children: ReactNode }) {
  return <ProjectLayoutView>{children}</ProjectLayoutView>
}
