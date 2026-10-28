import Link from 'next/link';
import { ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export function WelcomeCard() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Welcome to MyJira</CardTitle>
        <CardDescription>
          You&apos;re not part of any project yet. Head to Projects to create one, or ask a project
          owner to add you.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button nativeButton={false} render={<Link href="/projects" />}>
          Go to projects
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}
