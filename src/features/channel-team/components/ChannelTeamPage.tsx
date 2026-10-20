import { useEffect, useState, useMemo } from 'react'
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  Users,
  Copy,
  CheckCheck,
  Code2,
  Clock,
  AlertCircle,
  Search,
  MoreVertical,
  Shield,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { readTeamState, readActiveChannelId, readClientActor, resetTeamStorage } from '../storage'
import { membershipOf, isOwner } from '../resolver'
import { SECTIONS } from '../permissions'
import { inviteByUsername, createInviteCode, acceptInvitation, declineInvitation, updateMemberPermissions, removeMember, revokeInvitation } from '../adapter'
import { USER_BY_ID } from '../fixtures'
import type { TeamMember, Invitation, ActorContext, PermissionKey, AuditEntry } from '../types'
import { useLanguage } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const TEAM_EVENT = 'cylixstudio-demo:team-change'

// Stat Card Component - improved premium styling
function StatCard({ icon: Icon, label, value, subtitle }: any) {
  return (
    <div className="rounded-lg border border-[#bee1fc]/20 bg-gradient-to-br from-[#bee1fc]/5 to-transparent p-6 transition-all duration-200 hover:border-[#bee1fc]/40 hover:shadow-lg hover:shadow-[#bee1fc]/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#bee1fc]/20 to-[#bee1fc]/5 flex items-center justify-center ring-1 ring-[#bee1fc]/30">
          <Icon className="h-5 w-5 text-[#bee1fc]" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-2 font-medium tracking-wide uppercase">{label}</p>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-3">{subtitle}</p>}
    </div>
  )
}

// Permission Chip Component - professional tag-style
function PermissionChip({ permission, onRemove }: any) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#bee1fc]/15 to-[#bee1fc]/10 px-3 py-1.5 text-xs font-medium text-[#bee1fc] border border-[#bee1fc]/25 hover:border-[#bee1fc]/40 transition-all duration-200 whitespace-nowrap">
      {permission}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:text-[#bee1fc] transition-colors opacity-70 hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

// Avatar Component with real platform image support
function Avatar({ userId, size = 'md', showPlatformBadge = true }: any) {
  const user = USER_BY_ID[userId]
  const initials = (user?.username || userId).substring(0, 2).toUpperCase()
  
  // Use real platform avatar if available
  const hasImage = user?.avatarUrl && typeof user.avatarUrl === 'string'
  
  // Fallback to HSL gradient if no image
  const hue = user?.hue ?? 205
  const gradientClass = `bg-gradient-to-br from-[hsl(${hue},100%,55%)] to-[hsl(${hue},80%,40%)]`
  
  const sizeClass = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const badgeSizeClass = size === 'lg' ? 'h-3 w-3' : size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
  
  // Get platform color based on platform type
  const platformColors: Record<string, string> = {
    kick: 'bg-[#00c70f]',
    twitch: 'bg-[#9147ff]',
    youtube: 'bg-[#ff0000]',
    tiktok: 'bg-[#000000]',
  }
  const platformColor = platformColors[user?.platform?.toLowerCase() || 'kick'] || 'bg-[#bee1fc]'
  
  return (
    <div className="relative inline-flex">
      <div 
        className={`${sizeClass} rounded-full ${hasImage ? '' : gradientClass} flex items-center justify-center text-xs font-semibold text-white shadow-md ring-1 ring-white/20 overflow-hidden`}
      >
        {hasImage ? (
          <img 
            src={user.avatarUrl} 
            alt={user?.displayName || 'Avatar'}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to initials if image fails to load
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
        {!hasImage && (
          <span>{initials}</span>
        )}
      </div>
      {/* Platform badge indicator - shows actual platform color */}
      {showPlatformBadge && (
        <div 
          className={`${badgeSizeClass} absolute bottom-0 end-0 rounded-full ${platformColor} ring-1 ring-[#0a0a0a] shadow-sm`} 
          title={`Platform: ${user?.platform || 'Unknown'}`} 
        />
      )}
    </div>
  )
}

// Format permission for display
function formatPermissionName(perm: PermissionKey): string {
  const [section, action] = perm.split('.')
  const sectionDef = SECTIONS.find(s => s.id === section)
  const permDef = sectionDef?.permissions.find(p => p.key === perm)
  return permDef?.label.en || perm
}

// Get top N permissions for display
function getDisplayPermissions(permissions: PermissionKey[], limit = 3): { shown: string; count: string } {
  const formattedPerms = permissions.map(formatPermissionName).slice(0, limit)
  const remaining = Math.max(0, permissions.length - limit)
  const shown = formattedPerms.join(' | ')
  const count = remaining > 0 ? ` +${remaining}` : ''
  return { shown, count }
}

interface InviteModalState {
  step: 'method' | 'permissions' | 'review'
  method: 'username' | 'code'
  username: string
  selectedPermissions: Set<PermissionKey>
}

interface EditingState {
  member: TeamMember | null
  selectedPermissions: Set<PermissionKey>
}

export function ChannelTeamPage() {
  const { t, lang } = useLanguage()
  const [teamState, setTeamState] = useState(readTeamState())
  const [actor, setActor] = useState(readClientActor())
  const [activeChannelId, setActiveChannelId] = useState(readActiveChannelId())
  const [tab, setTab] = useState<'members' | 'invitations' | 'audit'>('members')
  
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteModal, setInviteModal] = useState<InviteModalState>({
    step: 'method',
    method: 'username',
    username: '',
    selectedPermissions: new Set(),
  })
  
  const [editingMember, setEditingMember] = useState<EditingState | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)
  
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null)
  
  const [searchMembers, setSearchMembers] = useState('')
  const [searchInvitations, setSearchInvitations] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    const handleStateChange = () => {
      setTeamState(readTeamState())
      setActor(readClientActor())
      setActiveChannelId(readActiveChannelId())
    }
    window.addEventListener(TEAM_EVENT, handleStateChange)
    return () => window.removeEventListener(TEAM_EVENT, handleStateChange)
  }, [])

  const currentMembers = useMemo(() => {
    return teamState.members.filter((m) => m.channelId === activeChannelId && m.status === 'active')
  }, [teamState, activeChannelId])

  const pendingInvitations = useMemo(() => {
    return teamState.invitations.filter((i) => i.channelId === activeChannelId && i.status === 'pending')
  }, [teamState, activeChannelId])

  const auditEntries = useMemo(() => {
    return [...teamState.audit].filter(a => a.channelId === activeChannelId).reverse().slice(0, 100)
  }, [teamState, activeChannelId])

  const filteredMembers = useMemo(() => {
    if (!searchMembers) return currentMembers
    return currentMembers.filter(m => 
      (USER_BY_ID[m.userId]?.username || m.userId).toLowerCase().includes(searchMembers.toLowerCase())
    )
  }, [currentMembers, searchMembers])

  const filteredInvitations = useMemo(() => {
    if (!searchInvitations) return pendingInvitations
    return pendingInvitations.filter(inv => {
      const target = inv.method === 'username' 
        ? (USER_BY_ID[inv.inviteeId || '']?.username || inv.inviteeId || '')
        : (inv.code || '')
      return target.toLowerCase().includes(searchInvitations.toLowerCase())
    })
  }, [pendingInvitations, searchInvitations])

  const canManageTeam = isOwner(actor.actorId, activeChannelId)

  if (!canManageTeam) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-red-400">{t('channelTeam.noAccess')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('channelTeam.ownerOnly')}</p>
          </div>
        </div>
      </div>
    )
  }

  const handleStartInvite = () => {
    setInviteModal({
      step: 'method',
      method: 'username',
      username: '',
      selectedPermissions: new Set(),
    })
    setShowInviteModal(true)
  }

  const handleInviteMethodSelect = (method: 'username' | 'code') => {
    setInviteModal(prev => ({
      ...prev,
      method,
      step: 'permissions',
      username: '',
    }))
  }

  const handleInvitePermissionChange = (permission: PermissionKey) => {
    setInviteModal(prev => ({
      ...prev,
      selectedPermissions: prev.selectedPermissions.has(permission)
        ? new Set([...prev.selectedPermissions].filter(p => p !== permission))
        : new Set([...prev.selectedPermissions, permission])
    }))
  }

  const handleInviteSubmit = async () => {
    try {
      const perms = Array.from(inviteModal.selectedPermissions)
      
      if (inviteModal.method === 'username') {
        if (!inviteModal.username.trim()) {
          toast.error(t('channelTeam.error.noUsername'))
          return
        }
        await inviteByUsername(activeChannelId, inviteModal.username, perms)
        toast.success(t('channelTeam.success.invited'))
      } else {
        await createInviteCode(activeChannelId, perms)
        toast.success(t('channelTeam.success.codeCreated'))
      }
      
      setShowInviteModal(false)
    } catch (error) {
      toast.error(t('channelTeam.error.inviteFailed'))
      console.error(error)
    }
  }

  const handleEditMember = (member: TeamMember) => {
    setEditingMember({
      member,
      selectedPermissions: new Set(member.permissions),
    })
    setShowEditModal(true)
  }

  const handleSavePermissions = async () => {
    if (!editingMember?.member) return
    try {
      await updateMemberPermissions(activeChannelId, editingMember.member.userId, Array.from(editingMember.selectedPermissions))
      toast.success(t('channelTeam.success.permissionsUpdated'))
      setShowEditModal(false)
      setEditingMember(null)
    } catch (error) {
      toast.error(t('channelTeam.error.updateFailed'))
      console.error(error)
    }
  }

  const handleRemoveMember = async () => {
    if (!deletingMemberId) return
    try {
      await removeMember(activeChannelId, deletingMemberId)
      toast.success(t('channelTeam.success.memberRemoved'))
      setShowDeleteDialog(false)
      setDeletingMemberId(null)
    } catch (error) {
      toast.error(t('channelTeam.error.removeFailed'))
      console.error(error)
    }
  }

  const handleRevokeInvitation = async () => {
    if (!revokingInvitationId) return
    try {
      await revokeInvitation(revokingInvitationId)
      toast.success(t('channelTeam.success.invitationRevoked'))
      setShowRevokeDialog(false)
      setRevokingInvitationId(null)
    } catch (error) {
      toast.error(t('channelTeam.error.revokeFailed'))
      console.error(error)
    }
  }

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await acceptInvitation(invitationId)
      toast.success(t('channelTeam.success.inviteAccepted'))
    } catch (error) {
      toast.error(t('channelTeam.error.acceptFailed'))
      console.error(error)
    }
  }

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await declineInvitation(invitationId)
      toast.success(t('channelTeam.success.inviteDeclined'))
    } catch (error) {
      toast.error(t('channelTeam.error.declineFailed'))
      console.error(error)
    }
  }

  const handleReset = async () => {
    if (!window.confirm(t('channelTeam.confirm.reset'))) return
    try {
      resetTeamStorage()
      toast.success(t('channelTeam.success.reset'))
      window.location.reload()
    } catch (error) {
      toast.error(t('channelTeam.error.resetFailed'))
      console.error(error)
    }
  }

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-emerald-500/15 border border-emerald-500/40', text: 'text-emerald-300' },
      pending: { bg: 'bg-amber-500/15 border border-amber-500/40', text: 'text-amber-300' },
      expired: { bg: 'bg-slate-500/15 border border-slate-500/40', text: 'text-slate-300' },
      revoked: { bg: 'bg-rose-500/15 border border-rose-500/40', text: 'text-rose-300' },
      declined: { bg: 'bg-rose-500/15 border border-rose-500/40', text: 'text-rose-300' },
    }
    const { bg, text } = statusMap[status] || statusMap.pending
    return { bg, text }
  }


  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="px-6 py-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-8 w-8 text-[#bee1fc]" />
                <h1 className="text-3xl font-bold text-foreground">{t('channelTeam.title')}</h1>
              </div>
              <p className="text-sm text-muted-foreground">{t('channelTeam.subtitle')}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-2 text-muted-foreground hover:text-foreground w-fit"
            >
              <RefreshCw className="h-4 w-4" />
              {t('settings.resetBtn')}
            </Button>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={Users}
              label={t('channelTeam.stats.totalMembers')}
              value={currentMembers.length}
              subtitle={currentMembers.length === 1 ? '1 team member' : `${currentMembers.length} team members`}
            />
            <StatCard
              icon={Clock}
              label={t('channelTeam.stats.pendingInvitations')}
              value={pendingInvitations.length}
              subtitle={pendingInvitations.length === 1 ? '1 pending' : `${pendingInvitations.length} pending`}
            />
            <StatCard
              icon={Shield}
              label={t('channelTeam.stats.customRoles')}
              value={SECTIONS.length}
              subtitle={`${SECTIONS.length} permission groups`}
            />
          </div>

          {/* Tabs */}
          <div className="border-b border-white/10">
            <div className="flex gap-6 overflow-x-auto">
              {(['members', 'invitations', 'audit'] as const).map((tabId) => (
                <button
                  key={tabId}
                  onClick={() => setTab(tabId)}
                  className={`pb-4 text-sm font-medium transition-colors whitespace-nowrap ${
                    tab === tabId
                      ? 'border-b-2 border-[#bee1fc] text-[#bee1fc]'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tabId === 'members' && t('channelTeam.members')}
                  {tabId === 'invitations' && `${t('channelTeam.invitations')} (${pendingInvitations.length})`}
                  {tabId === 'audit' && t('channelTeam.auditLog')}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="mt-8">
            {/* Members Tab */}
            {tab === 'members' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 relative max-w-sm">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={t('channelTeam.searchMembers')}
                      value={searchMembers}
                      onChange={(e) => setSearchMembers(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#bee1fc] focus:outline-none transition-colors"
                    />
                  </div>
                  <Button
                    onClick={handleStartInvite}
                    className="gap-2 bg-[#bee1fc] text-black hover:bg-[#bee1fc]/90 w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    {t('channelTeam.inviteMember')}
                  </Button>
                </div>

                {filteredMembers.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-12 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-sm text-muted-foreground">{t('channelTeam.noMembers')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <Avatar userId={member.userId} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{USER_BY_ID[member.userId]?.username || member.userId}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {member.permissions.length === 0 ? (
                                <span className="text-xs text-muted-foreground">{t('channelTeam.noPermissions')}</span>
                              ) : (
                                <>
                                  {member.permissions.slice(0, 3).map((perm) => (
                                    <PermissionChip key={perm} permission={formatPermissionName(perm)} />
                                  ))}
                                  {member.permissions.length > 3 && (
                                    <span className="text-xs text-muted-foreground">+{member.permissions.length - 3} more</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditMember(member)}
                            className="h-9 gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('channelTeam.edit')}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingMemberId(member.userId)
                              setShowDeleteDialog(true)
                            }}
                            className="h-9 text-red-500 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Invitations Tab */}
            {tab === 'invitations' && (
              <div className="space-y-6">
                <div className="flex-1 relative max-w-sm">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={t('channelTeam.searchInvitations')}
                    value={searchInvitations}
                    onChange={(e) => setSearchInvitations(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#bee1fc] focus:outline-none transition-colors"
                  />
                </div>

                {filteredInvitations.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-sm text-muted-foreground">{t('channelTeam.noPendingInvitations')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredInvitations.map((invitation) => {
                      const { bg, text } = getStatusBadge(invitation.status)
                      const isCodeInvite = invitation.method === 'code'
                      const target = isCodeInvite ? invitation.code : (USER_BY_ID[invitation.inviteeId || '']?.username || invitation.inviteeId)
                      
                      return (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-[#bee1fc]/10 flex items-center justify-center flex-shrink-0">
                              {isCodeInvite ? (
                                <Code2 className="h-5 w-5 text-[#bee1fc]" />
                              ) : (
                                <Users className="h-5 w-5 text-[#bee1fc]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold text-foreground truncate">{target}</p>
                                <span className={`text-xs px-2 py-1 rounded-full ${bg} ${text}`}>
                                  {invitation.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {invitation.permissions.slice(0, 2).map((perm) => (
                                  <PermissionChip key={perm} permission={formatPermissionName(perm)} />
                                ))}
                                {invitation.permissions.length > 2 && (
                                  <span className="text-xs text-muted-foreground">+{invitation.permissions.length - 2}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                {t('channelTeam.created')}: {new Date(invitation.createdAt).toLocaleDateString(lang)}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {isCodeInvite && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyInviteCode(invitation.code || '')}
                                className="h-9"
                              >
                                {copiedCode === invitation.code ? (
                                  <>
                                    <CheckCheck className="h-4 w-4 text-green-400" />
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-4 w-4" />
                                  </>
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRevokingInvitationId(invitation.id)
                                setShowRevokeDialog(true)
                              }}
                              className="h-9 text-red-500 hover:text-red-400"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Audit Log Tab */}
            {tab === 'audit' && (
              <div className="space-y-4">
                {auditEntries.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-12 text-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-sm text-muted-foreground">{t('channelTeam.noAuditLog')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditEntries.map((entry, index) => {
                      const actor = USER_BY_ID[entry.actorId]
                      return (
                        <div key={index} className="flex items-start gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]">
                          <Avatar userId={entry.actorId} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">
                              <span className="font-semibold">{actor?.username || entry.actorId}</span>
                              {' '}{t(`channelTeam.audit.${entry.action}`) || entry.action}
                              {' '}<span className="text-muted-foreground">{entry.target}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(entry.at).toLocaleDateString(lang)} {new Date(entry.at).toLocaleTimeString(lang)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invite Modal - Step 1: Method Selection */}
      {showInviteModal && inviteModal.step === 'method' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl">
            <h2 className="mb-6 text-lg font-semibold text-foreground">{t('channelTeam.inviteMember')}</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleInviteMethodSelect('username')}
                className="w-full p-4 rounded-lg border-2 border-white/10 bg-white/[0.02] text-left transition-all hover:border-[#bee1fc] hover:bg-white/[0.05]"
              >
                <p className="font-semibold text-foreground">{t('channelTeam.inviteByUsername')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('channelTeam.inviteByUsernameDesc')}</p>
              </button>
              <button
                onClick={() => handleInviteMethodSelect('code')}
                className="w-full p-4 rounded-lg border-2 border-white/10 bg-white/[0.02] text-left transition-all hover:border-[#bee1fc] hover:bg-white/[0.05]"
              >
                <p className="font-semibold text-foreground">{t('channelTeam.generateInvitationCode')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('channelTeam.generateInvitationCodeDesc')}</p>
              </button>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowInviteModal(false)}
              className="w-full mt-6"
            >
              {t('channelTeam.cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Invite Modal - Step 2: Permissions Selection */}
      {showInviteModal && inviteModal.step === 'permissions' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] rounded-lg border border-white/10 bg-[#0a0a0a] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <h2 className="text-lg font-semibold text-foreground">{t('channelTeam.selectPermissions')}</h2>
              <button onClick={() => setShowInviteModal(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {inviteModal.method === 'username' && (
              <div className="px-6 pt-4 pb-2 border-b border-white/10">
                <input
                  type="text"
                  placeholder={t('channelTeam.username')}
                  value={inviteModal.username}
                  onChange={(e) => setInviteModal(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-foreground placeholder:text-muted-foreground focus:border-[#bee1fc] focus:outline-none transition-colors"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {SECTIONS.map((section) => (
                <div key={section.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{section.label.en}</p>
                      <p className="text-xs text-muted-foreground mt-1">{section.description.en}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {section.permissions.map((perm) => (
                      <label key={perm.key} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white/[0.05] transition-colors">
                        <input
                          type="checkbox"
                          checked={inviteModal.selectedPermissions.has(perm.key)}
                          onChange={() => handleInvitePermissionChange(perm.key)}
                          className="h-4 w-4 rounded border-white/20"
                        />
                        <span className="text-sm text-foreground">{perm.label.en}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 p-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowInviteModal(false)}
                className="flex-1"
              >
                {t('channelTeam.cancel')}
              </Button>
              <Button
                onClick={handleInviteSubmit}
                disabled={inviteModal.method === 'username' && !inviteModal.username.trim()}
                className="flex-1 gap-2 bg-[#bee1fc] text-black hover:bg-[#bee1fc]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" />
                {inviteModal.method === 'username' ? t('channelTeam.sendInvite') : t('channelTeam.createCode')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {showEditModal && editingMember?.member && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] rounded-lg border border-white/10 bg-[#0a0a0a] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t('channelTeam.editPermissions')}</h2>
                <p className="text-sm text-muted-foreground mt-1">{USER_BY_ID[editingMember.member.userId]?.username || editingMember.member.userId}</p>
              </div>
              <button onClick={() => setShowEditModal(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {SECTIONS.map((section) => (
                <div key={section.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{section.label.en}</p>
                      <p className="text-xs text-muted-foreground mt-1">{section.description.en}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {section.permissions.map((perm) => (
                      <label key={perm.key} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white/[0.05] transition-colors">
                        <input
                          type="checkbox"
                          checked={editingMember.selectedPermissions.has(perm.key)}
                          onChange={() => setEditingMember(prev => {
                            if (!prev) return prev
                            const newPerms = new Set(prev.selectedPermissions)
                            if (newPerms.has(perm.key)) {
                              newPerms.delete(perm.key)
                            } else {
                              newPerms.add(perm.key)
                            }
                            return { ...prev, selectedPermissions: newPerms }
                          })}
                          className="h-4 w-4 rounded border-white/20"
                        />
                        <span className="text-sm text-foreground">{perm.label.en}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 p-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="flex-1"
              >
                {t('channelTeam.cancel')}
              </Button>
              <Button
                onClick={handleSavePermissions}
                className="flex-1 gap-2 bg-[#bee1fc] text-black hover:bg-[#bee1fc]/90"
              >
                <Check className="h-4 w-4" />
                {t('channelTeam.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Member Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#0a0a0a] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('channelTeam.confirm.remove')}</AlertDialogTitle>
            <AlertDialogDescription>{t('channelTeam.confirm.removeDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('channelTeam.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {t('channelTeam.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Invitation Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent className="bg-[#0a0a0a] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('channelTeam.confirm.revokeInvitation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('channelTeam.confirm.revokeInvitationDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('channelTeam.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeInvitation}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {t('channelTeam.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
