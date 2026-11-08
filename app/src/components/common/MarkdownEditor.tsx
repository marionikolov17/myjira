'use client';

import {
  BoldIcon,
  EyeIcon,
  FileCodeIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  QuoteIcon,
  SquareCodeIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { MarkdownView } from '@/components/common/MarkdownView';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// --- Pure source transforms (D7): { value, selection } -> { value, selection } ---

type Selection = { start: number; end: number };
type TransformState = { value: string; selection: Selection };
type Transform = (state: TransformState) => TransformState;

/** Wraps the selection in a symmetric inline marker (e.g. `**`); with nothing
 *  selected the cursor lands between the markers. */
function wrapInline(marker: string): Transform {
  return ({ value, selection }) => {
    const { start, end } = selection;
    return {
      value: `${value.slice(0, start)}${marker}${value.slice(start, end)}${marker}${value.slice(end)}`,
      selection: { start: start + marker.length, end: end + marker.length },
    };
  };
}

/** Toggles a line prefix (`## `, `- `, `> `) on every line the selection touches. */
function prefixLines(prefix: string): Transform {
  return ({ value, selection }) => {
    const firstLineStart = value.lastIndexOf('\n', selection.start - 1) + 1;
    const nextBreak = value.indexOf('\n', selection.end);
    const lastLineEnd = nextBreak === -1 ? value.length : nextBreak;
    const lines = value.slice(firstLineStart, lastLineEnd).split('\n');
    let totalDelta = 0;
    let firstLineDelta = 0;
    const updated = lines.map((line, index) => {
      const delta = line.startsWith(prefix) ? -prefix.length : prefix.length;
      if (index === 0) firstLineDelta = delta;
      totalDelta += delta;
      return delta > 0 ? prefix + line : line.slice(prefix.length);
    });
    return {
      value: `${value.slice(0, firstLineStart)}${updated.join('\n')}${value.slice(lastLineEnd)}`,
      selection: { start: selection.start + firstLineDelta, end: selection.end + totalDelta },
    };
  };
}

/** Wraps the selection in a fenced code block on its own lines. */
function fencedCode({ value, selection }: TransformState): TransformState {
  const { start, end } = selection;
  const selected = value.slice(start, end);
  const leading = start > 0 && value[start - 1] !== '\n' ? '\n\n' : '';
  const codeStart = start + leading.length + 4;
  return {
    value: `${value.slice(0, start)}${leading}\`\`\`\n${selected}\n\`\`\`${value.slice(end)}`,
    selection: { start: codeStart, end: codeStart + selected.length },
  };
}

/** Builds the markdown link syntax from the popover's text + URL fields. */
function insertLink(text: string, url: string): Transform {
  return ({ value, selection }) => {
    const markdown = `[${text}](${url})`;
    const cursor = selection.start + markdown.length;
    return {
      value: `${value.slice(0, selection.start)}${markdown}${value.slice(selection.end)}`,
      selection: { start: cursor, end: cursor },
    };
  };
}

type ToolbarAction = {
  label: string;
  icon: LucideIcon;
  transform: Transform;
};

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: 'Heading', icon: Heading2Icon, transform: prefixLines('## ') },
  { label: 'Bold', icon: BoldIcon, transform: wrapInline('**') },
  { label: 'Italic', icon: ItalicIcon, transform: wrapInline('*') },
  { label: 'Code', icon: SquareCodeIcon, transform: wrapInline('`') },
  { label: 'Code block', icon: FileCodeIcon, transform: fencedCode },
  { label: 'List', icon: ListIcon, transform: prefixLines('- ') },
  { label: 'Quote', icon: QuoteIcon, transform: prefixLines('> ') },
];

type MarkdownEditorProps = {
  /** Applied to the source textarea so feature labels and errors wire up. */
  id: string;
  /** Live markdown source; drives the preview and the character counter. */
  value: string;
  /**
   * Character cap surfaced by the live counter. Over-length is flagged, but
   * input is never silently blocked — the owner decides how to gate saving.
   */
  maxLength: number;
  /** Plain controlled mode: called on every source change. */
  onChange?: (event: { target: { value: string } }) => void;
  /** RHF mode: the `register()` result, forwarded to the source textarea. */
  registration?: UseFormRegisterReturn;
  ariaInvalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  rows?: number;
  className?: string;
  /** Escape pressed in the source textarea (features use it to cancel). */
  onEscape?: () => void;
  /** Cmd/Ctrl+Enter pressed in the source textarea (features use it to save). */
  onSaveShortcut?: () => void;
};

/**
 * Generic Write/Preview markdown editor. The preview renders through the same
 * `MarkdownView` pipeline as the saved view, so authors always see what readers
 * will see. Save/cancel wiring stays with the feature.
 */
export function MarkdownEditor({
  id,
  value,
  maxLength,
  onChange,
  registration,
  ariaInvalid,
  disabled,
  autoFocus,
  rows = 8,
  className,
  onEscape,
  onSaveShortcut,
}: MarkdownEditorProps) {
  const generatedId = useId();
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelectionRef = useRef<Selection | null>(null);

  const overLimit = value.length > maxLength;
  const linkTextId = `${generatedId}-link-text`;
  const linkUrlId = `${generatedId}-link-url`;

  const setTextareaRef = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    registration?.ref(node);
  };

  const notifyChange = (next: string) => {
    if (registration) {
      void registration.onChange({ target: { name: registration.name, value: next } });
    } else {
      onChange?.({ target: { value: next } });
    }
  };

  const applyTransform = (transform: Transform) => {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const next = transform({
      value: el.value,
      selection: { start: el.selectionStart, end: el.selectionEnd },
    });
    pendingSelectionRef.current = next.selection;
    notifyChange(next.value);
  };

  // Toolbar buttons move focus off the textarea; restore the transformed
  // selection once the new value has rendered.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    const pending = pendingSelectionRef.current;
    if (!el || !pending) return;
    pendingSelectionRef.current = null;
    el.focus();
    el.setSelectionRange(pending.start, pending.end);
  }, [value]);

  const handleLinkPopoverOpenChange = (open: boolean) => {
    if (open) {
      const el = textareaRef.current;
      setLinkText(el ? el.value.slice(el.selectionStart, el.selectionEnd) : '');
      setLinkUrl('');
    }
    setLinkPopoverOpen(open);
  };

  const insertLinkFromPopover = () => {
    const text = linkText.trim();
    const url = linkUrl.trim();
    if (!text || !url) return;
    applyTransform(insertLink(text, url));
    setLinkPopoverOpen(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') onEscape?.();
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSaveShortcut?.();
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={mode === 'write'}
            onClick={() => setMode('write')}
            className={mode === 'write' ? 'bg-background shadow-sm' : undefined}
            disabled={disabled}
          >
            Write
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={mode === 'preview'}
            onClick={() => setMode('preview')}
            className={mode === 'preview' ? 'bg-background shadow-sm' : undefined}
            disabled={disabled}
          >
            <EyeIcon data-icon="inline-start" />
            Preview
          </Button>
        </div>

        {mode === 'write' && (
          <div className="ml-auto flex items-center gap-0.5">
            {TOOLBAR_ACTIONS.map(({ label, icon: Icon, transform }) => (
              <Button
                key={label}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={label}
                title={label}
                onClick={() => applyTransform(transform)}
                disabled={disabled}
              >
                <Icon aria-hidden="true" />
              </Button>
            ))}
            <Popover open={linkPopoverOpen} onOpenChange={handleLinkPopoverOpenChange}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Insert link"
                    title="Insert link"
                    disabled={disabled}
                  />
                }
              >
                <LinkIcon aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80">
                <PopoverHeader>
                  <PopoverTitle>Insert link</PopoverTitle>
                </PopoverHeader>
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor={linkTextId}>Text</FieldLabel>
                  <Input
                    id={linkTextId}
                    value={linkText}
                    onChange={(event) => setLinkText(event.target.value)}
                    placeholder="Link text"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor={linkUrlId}>URL</FieldLabel>
                  <Input
                    id={linkUrlId}
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        insertLinkFromPopover();
                      }
                    }}
                    placeholder="https://example.com"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="self-end"
                  onClick={insertLinkFromPopover}
                  disabled={!linkText.trim() || !linkUrl.trim()}
                >
                  Insert
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {mode === 'write' ? (
        <Textarea
          id={id}
          name={registration?.name}
          onBlur={registration?.onBlur}
          ref={setTextareaRef}
          value={value}
          rows={rows}
          autoFocus={autoFocus}
          aria-invalid={ariaInvalid || undefined}
          disabled={disabled}
          onChange={(event) => notifyChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-24"
        />
      ) : (
        <div className="min-h-24 rounded-lg border border-input bg-transparent px-3 py-2">
          {value.trim() ? (
            <MarkdownView>{value}</MarkdownView>
          ) : (
            <p className="text-sm text-muted-foreground italic">Nothing to preview yet.</p>
          )}
        </div>
      )}

      <p
        className={cn(
          'self-end text-xs text-muted-foreground',
          overLimit && 'font-medium text-destructive',
        )}
      >
        {overLimit
          ? `${value.length} / ${maxLength} characters — trim to ${maxLength} or fewer to save`
          : `${value.length} / ${maxLength} characters`}
      </p>
    </div>
  );
}
