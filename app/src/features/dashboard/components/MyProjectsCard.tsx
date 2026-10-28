import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import type { Project } from '@/lib/api/schemas';

export function MyProjectsCard({
  projects,
  isLoading,
}: {
  projects: Project[];
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My projects</CardTitle>
        <CardDescription>Recently updated projects you can access.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/projects" />}>
            See all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }, (_, index) => (
                <li key={index}>
                  <Skeleton className="h-32 rounded-2xl" />
                </li>
              ))
            : projects.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} compact />
                </li>
              ))}
        </ul>
      </CardContent>
    </Card>
  );
}
