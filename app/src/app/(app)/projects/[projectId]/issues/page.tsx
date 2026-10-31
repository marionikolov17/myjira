import type { Metadata } from 'next';
import { IssuesView } from '@/features/issues/components/IssuesView';

export const metadata: Metadata = { title: 'Issues' };

export default async function ProjectIssuesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <IssuesView projectId={projectId} />;
}
