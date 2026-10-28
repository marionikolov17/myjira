'use client';

import { PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

const MAX_LENGTH = 5000;

type DescriptionEditorProps = {
  value: string;
  canEdit: boolean;
  onSave: (next: string) => Promise<boolean>;
};

export function DescriptionEditor({ value, canEdit, onSave }: DescriptionEditorProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = draft !== null;
  const tooLong = (draft?.length ?? 0) > MAX_LENGTH;

  const save = async () => {
    if (draft === null || tooLong) return;
    if (draft.trim() === value.trim()) return setDraft(null);
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (ok) setDraft(null);
  };

  if (editing) {
    return (
      <Field data-invalid={tooLong || undefined}>
        <FieldLabel htmlFor="issue-description">Description</FieldLabel>
        <Textarea
          id="issue-description"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setDraft(null);
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void save();
          }}
          rows={8}
          autoFocus
          aria-invalid={tooLong || undefined}
          className="min-h-40"
        />
        {tooLong && <FieldError>Description must be 5000 characters or fewer</FieldError>}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || tooLong}>
            {saving && <Spinner data-icon="inline-start" />}
            Save
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <section aria-labelledby="issue-description-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="issue-description-heading" className="text-sm font-medium text-muted-foreground">
          Description
        </h2>
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(value)}>
            <PencilIcon data-icon="inline-start" />
            Edit
          </Button>
        )}
      </div>
      {value ? (
        <p className="text-sm leading-relaxed text-pretty whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No description provided.</p>
      )}
    </section>
  );
}
