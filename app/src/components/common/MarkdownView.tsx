import { memo } from 'react';
import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

type MarkdownViewProps = {
  /** The markdown source to render. */
  children: string;
  className?: string;
};

/** Only absolute http(s) links open in a new tab; everything else stays in-app. */
function isExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Link renderer shared by regular links and image alt-text links. react-markdown's
 * built-in URL transform strips dangerous protocols (javascript: etc.) before this
 * runs; a stripped URL renders as plain text so nothing unsafe stays clickable.
 */
function SafeLink({
  url,
  title,
  children,
}: {
  url: string | undefined;
  title: string | undefined;
  children: ReactNode;
}) {
  if (!url) return <>{children}</>;
  const external = isExternalLink(url);
  return (
    <a
      href={url}
      title={title}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  );
}

/** Markdown image syntax renders its alt text as a link, never an <img>. */
function AltTextLink({
  url,
  alt,
  title,
}: {
  url: string | undefined;
  alt: string | undefined;
  title: string | undefined;
}) {
  const label = alt && alt.trim() !== '' ? alt : 'image';
  return (
    <SafeLink url={url} title={title}>
      {label}
    </SafeLink>
  );
}

const components: Components = {
  // React's anchor/img typings widen href/src to `string | Blob`; react-markdown
  // only ever produces strings, so normalize before handing off to SafeLink.
  a: ({ href, title, children }) => (
    <SafeLink url={typeof href === 'string' ? href : undefined} title={title}>
      {children}
    </SafeLink>
  ),
  img: ({ src, alt, title }) => (
    <AltTextLink url={typeof src === 'string' ? src : undefined} alt={alt} title={title} />
  ),
};

/**
 * Shared, sanitized markdown renderer. The exact pipeline powers both the saved
 * description view and the editor's preview mode, so authors always see what
 * readers will see. Raw HTML never enters the render tree (no rehype-raw).
 */
export const MarkdownView = memo(function MarkdownView({ children, className }: MarkdownViewProps) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-pre:bg-muted prose-pre:text-foreground',
        'prose-pre:prose-code:bg-transparent prose-pre:prose-code:px-0 prose-pre:prose-code:py-0',
        'prose-code:rounded-md prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal',
        'prose-code:before:content-none prose-code:after:content-none',
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {children}
      </Markdown>
    </div>
  );
});
