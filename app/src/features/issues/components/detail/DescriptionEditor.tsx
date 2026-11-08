'use client';

import { PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { MarkdownView } from '@/components/common/MarkdownView';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ISSUE_DESCRIPTION_MAX_LENGTH } from '@/lib/api/schemas';

type DescriptionEditorProps = {
  value: string;
  canEdit: boolean;
  onSave: (next: string) => Promise<boolean>;
};

/**
 * Thin wrapper over the shared markdown surfaces: the saved view renders via
 * `MarkdownView`, editing delegates the Write/Preview + toolbar experience to
 * `MarkdownEditor`. This component owns the draft, the save contract, and the
 * `canEdit` gate.
 */
export function DescriptionEditor({ value, canEdit, onSave }: DescriptionEditorProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = draft !== null;
  const tooLong = (draft?.length ?? 0) > ISSUE_DESCRIPTION_MAX_LENGTH;

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
        <MarkdownEditor
          id="issue-description"
          value={draft}
          maxLength={ISSUE_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          ariaInvalid={tooLong}
          disabled={saving}
          autoFocus
          onEscape={() => setDraft(null)}
          onSaveShortcut={() => void save()}
        />
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
        <MarkdownView>{value}</MarkdownView>
      ) : (
        <p className="text-sm text-muted-foreground italic">No description provided.</p>
      )}
    </section>
  );
}
