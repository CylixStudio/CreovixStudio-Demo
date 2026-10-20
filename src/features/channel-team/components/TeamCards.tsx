import { useEffect, useState, type ReactNode } from 'react'
import { CheckCheck, Code2, Copy, MoreVertical, Pencil, Shield, Trash2, X } from 'lucide-react'
import { PlatformIcon, normalizePlatform } from '@/components/widgets/PlatformIcon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLanguage } from '@/lib/i18n'
import { SECTION_BY_ID, permissionLabel, sectionOfKey } from '../permissions'
import { USER_BY_ID } from '../fixtures'
import type { Invitation, PermissionKey, SectionId, TeamMember } from '../types'

const PLATFORM_NAME = { TWITCH: 'Twitch', KICK: 'Kick', YOUTUBE: 'YouTube', TIKTOK: 'TikTok', X: 'X' } as const

function initialsOf(name: string): string {
  const parts = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  return (parts[0] ?? name).slice(0, 2).toUpperCase()
}

/** Real platform picture when the user has one; initials on a neutral surface otherwise or when the image fails. */
export function TeamAvatar({ userId, size = 44 }: { userId: string; size?: number }) {
  const user = USER_BY_ID[userId]
  const url = user?.avatarUrl || null
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  useEffect(() => {
    setFailedUrl(null)
  }, [url])

  const label = user?.username || userId
  const showImage = !!url && failedUrl !== url

  return (
    <span
      className="surface-inset inline-flex shrink-0 select-none items-center justify-center overflow-hidden !rounded-full text-xs font-semibold uppercase text-foreground/80"
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.33)) }}
    >
      {showImage ? (
        <img
          key={url}
          src={url}
          alt={label}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <span aria-hidden>{initialsOf(user?.displayName || label)}</span>
      )}
    </span>
  )
}

export function PlatformBadge({ platform }: { platform?: string | null | undefined }) {
  const key = platform ? normalizePlatform(platform) : null
  if (!key) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
      <PlatformIcon platform={key} size={11} />
      {PLATFORM_NAME[key]}
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useLanguage()
  const tone: Record<string, string> = {
    active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    revoked: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    declined: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    expired: 'border-white/10 bg-white/[0.04] text-muted-foreground',
  }
  const labels: Record<string, string> = {
    active: t('channelTeam.active'),
    pending: t('channelTeam.pending'),
    revoked: t('channelTeam.revoked'),
    declined: t('channelTeam.declined'),
    expired: t('channelTeam.expired'),
  }
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${tone[status] ?? tone['expired']}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[status] ?? status}
    </span>
  )
}

function PermissionSummary({ permissions }: { permissions: readonly PermissionKey[] }) {
  const { t, lang } = useLanguage()
  if (permissions.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{t('channelTeam.noPermissions')}</span>
      </div>
    )
  }

  const groups: SectionId[] = []
  for (const key of permissions) {
    const id = sectionOfKey(key)
    if (!groups.includes(id)) groups.push(id)
  }
  const shown = groups.slice(0, 2)
  const rest = groups.length - shown.length
  const fullList = permissions.map((key) => permissionLabel(key)[lang]).join(' · ')

  return (
    <div className="flex min-w-0 items-center gap-2" title={fullList}>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground/90">
        <Shield className="h-3.5 w-3.5 text-[#bee1fc]" />
        {t('channelTeam.card.permCount', { n: permissions.length })}
      </span>
      <span className="h-3 w-px shrink-0 bg-white/10" />
      <div className="flex min-w-0 items-center gap-1">
        {shown.map((id) => (
          <span key={id} className="max-w-[7.5rem] truncate rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {SECTION_BY_ID[id]?.label[lang] ?? id}
          </span>
        ))}
        {rest > 0 && <span dir="ltr" className="shrink-0 text-[11px] font-medium text-[#bee1fc]">+{rest}</span>}
      </div>
    </div>
  )
}

function IdCardShell({
  left,
  title,
  badges,
  status,
  menu,
  footer,
}: {
  left: ReactNode
  title: ReactNode
  badges: ReactNode
  status: ReactNode
  menu: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="surface-card flex min-w-0 flex-col gap-2.5 p-3 transition-colors hover:border-white/20">
      <div className="flex items-center gap-3">
        {left}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{title}</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">{badges}</div>
        </div>
        {status}
        {menu}
      </div>
      <div className="border-t border-white/[0.06] pt-2.5">{footer}</div>
    </div>
  )
}

function MenuTrigger({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" aria-label={label} className="-me-1 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
  )
}

export function MemberIdCard({
  member,
  onEdit,
  onRemove,
}: {
  member: TeamMember
  onEdit: () => void
  onRemove: () => void
}) {
  const { t, lang } = useLanguage()
  const user = USER_BY_ID[member.userId]
  const joined = new Date(member.joinedAt).toLocaleDateString(lang)

  return (
    <IdCardShell
      left={<TeamAvatar userId={member.userId} />}
      title={user?.username || member.userId}
      badges={
        <>
          <PlatformBadge platform={user?.platform} />
          <span className="truncate text-[11px] text-muted-foreground">{t('channelTeam.card.joined', { date: joined })}</span>
        </>
      }
      status={<StatusPill status={member.status} />}
      menu={
        <DropdownMenu>
          <MenuTrigger label={t('channelTeam.card.actions')} />
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="h-4 w-4" />
              {t('channelTeam.edit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRemove} className="text-red-400 focus:text-red-400">
              <Trash2 className="h-4 w-4" />
              {t('channelTeam.remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      footer={<PermissionSummary permissions={member.permissions} />}
    />
  )
}

export function InvitationIdCard({
  invitation,
  copied,
  onCopy,
  onRevoke,
}: {
  invitation: Invitation
  copied: boolean
  onCopy: () => void
  onRevoke: () => void
}) {
  const { t, lang } = useLanguage()
  const isCode = invitation.method === 'code'
  const invitee = invitation.inviteeId ? USER_BY_ID[invitation.inviteeId] : undefined
  const target = isCode ? invitation.code || '' : invitee?.username || invitation.inviteeId || ''

  return (
    <IdCardShell
      left={
        isCode || !invitation.inviteeId ? (
          <span className="surface-inset inline-flex h-11 w-11 shrink-0 items-center justify-center !rounded-full text-[#bee1fc]">
            <Code2 className="h-5 w-5" />
          </span>
        ) : (
          <TeamAvatar userId={invitation.inviteeId} />
        )
      }
      title={<span className={isCode ? 'font-mono tracking-wide' : ''}>{target}</span>}
      badges={
        <>
          {isCode ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
              {t('channelTeam.card.inviteCode')}
            </span>
          ) : (
            <PlatformBadge platform={invitee?.platform} />
          )}
          <span className="truncate text-[11px] text-muted-foreground">
            {t('channelTeam.created')}: {new Date(invitation.createdAt).toLocaleDateString(lang)}
          </span>
        </>
      }
      status={<StatusPill status={invitation.status} />}
      menu={
        <DropdownMenu>
          <MenuTrigger label={t('channelTeam.card.actions')} />
          <DropdownMenuContent align="end" className="min-w-40">
            {isCode && (
              <DropdownMenuItem onSelect={onCopy}>
                {copied ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                {t('channelTeam.card.copyCode')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onRevoke} className="text-red-400 focus:text-red-400">
              <X className="h-4 w-4" />
              {t('channelTeam.revoke')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      footer={<PermissionSummary permissions={invitation.permissions} />}
    />
  )
}
