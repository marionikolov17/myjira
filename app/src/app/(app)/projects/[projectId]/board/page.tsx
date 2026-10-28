import type { Metadata } from 'next'
import { BoardView } from '@/features/issues/components/board/BoardView'

export const metadata: Metadata = { title: 'Board' }

export default async function BoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  return <BoardView projectId={projectId} />
}
