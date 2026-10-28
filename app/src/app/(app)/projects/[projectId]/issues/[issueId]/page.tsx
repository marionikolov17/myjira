import { IssueDetailView } from '@/features/issues/components/detail/IssueDetailView';

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; issueId: string }>;
}) {
  const { projectId, issueId } = await params;
  return <IssueDetailView projectId={projectId} issueId={issueId} />;
}
