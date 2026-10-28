'use client'

import { TriangleAlertIcon } from 'lucide-react'
import { CopyableField } from '@/components/common/CopyableField'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CreateUserResponse } from '@/lib/api/schemas'
import { formatDateTime } from '@/lib/format'

type ActivationLinkDialogProps = {
  invite: CreateUserResponse | null
  onDismiss: () => void
}

export function ActivationLinkDialog({ invite, onDismiss }: ActivationLinkDialogProps) {
  return (
    <Dialog open={invite !== null} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invitation created</DialogTitle>
          <DialogDescription>
            {invite ? `${invite.user.name} (${invite.user.email}) was added as a pending user.` : ''}
          </DialogDescription>
        </DialogHeader>
        {invite && (
          <div className="flex flex-col gap-4">
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>This link will only be shown once.</AlertTitle>
              <AlertDescription>Share it with the invitee.</AlertDescription>
            </Alert>
            <CopyableField label="Activation link" value={invite.activation.url} />
            <p className="text-xs text-muted-foreground">
              Expires{' '}
              <time dateTime={invite.activation.expiresAt}>{formatDateTime(invite.activation.expiresAt)}</time>
            </p>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onDismiss}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
