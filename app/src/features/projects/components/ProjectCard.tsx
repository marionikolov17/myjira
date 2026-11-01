'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Project } from '@/lib/api/schemas';
import { formatRelative } from '@/lib/format';
import { MemberAvatarStack } from './MemberAvatarStack';

export function ProjectCard({ project, compact = false }: { project: Project; compact?: boolean }) {
  return (
    <Link
      href={`/projects/${project.id}/board`}
      className="group block h-full rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader>
          <CardTitle className="truncate">{project.name}</CardTitle>
          <CardDescription className="line-clamp-2 min-h-10">
            {project.description || 'No description'}
          </CardDescription>
        </CardHeader>
        {!compact && (
          <CardContent>
            <MemberAvatarStack projectId={project.id} />
          </CardContent>
        )}
        <CardFooter className="mt-auto text-xs text-muted-foreground">
          Updated {formatRelative(project.updatedAt)}
        </CardFooter>
      </Card>
    </Link>
  );
}
