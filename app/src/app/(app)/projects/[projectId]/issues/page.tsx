import { IssuesTableView } from '@/features/issues/components/IssuesTableView';

export default async function ProjectIssuesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <IssuesTableView projectId={projectId} />;
}
