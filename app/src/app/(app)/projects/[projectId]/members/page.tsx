import { MembersView } from '@/features/members/components/MembersView';

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <MembersView projectId={projectId} />;
}
