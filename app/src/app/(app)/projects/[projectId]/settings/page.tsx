import { ProjectSettingsView } from '@/features/projects/components/ProjectSettingsView';

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectSettingsView projectId={projectId} />;
}
