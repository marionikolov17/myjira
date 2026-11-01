import type { Metadata } from 'next';
import { ProjectSettingsView } from '@/features/projects/components/ProjectSettingsView';

export const metadata: Metadata = { title: 'Settings' };

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectSettingsView projectId={projectId} />;
}
