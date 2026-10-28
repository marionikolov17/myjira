import { CodeIcon, CrownIcon, ShieldIcon, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PROJECT_ROLE_LABELS, type ProjectRoleName, type WorkspaceRoleName } from '@/lib/api/schemas'

type RoleBadgeProps =
  | { scope: 'workspace'; role: WorkspaceRoleName }
  | { scope: 'project'; role: ProjectRoleName }

type Tier = 'owner' | 'admin' | 'developer'

const TIER_ICON: Record<Tier, LucideIcon> = { owner: CrownIcon, admin: ShieldIcon, developer: CodeIcon }
const TIER_VARIANT: Record<Tier, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  developer: 'outline',
}

function tierOf(role: WorkspaceRoleName | ProjectRoleName): Tier {
  if (role === 'Owner' || role === 'ProjectOwner') return 'owner'
  if (role === 'Admin' || role === 'ProjectAdmin') return 'admin'
  return 'developer'
}

export function RoleBadge(props: RoleBadgeProps) {
  const tier = tierOf(props.role)
  const Icon = TIER_ICON[tier]
  const label = props.scope === 'project' ? PROJECT_ROLE_LABELS[props.role] : props.role
  return (
    <Badge variant={TIER_VARIANT[tier]}>
      <Icon data-icon="inline-start" aria-hidden="true" />
      {label}
    </Badge>
  )
}
