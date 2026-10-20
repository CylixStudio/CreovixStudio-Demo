import { useEffect, useState, useMemo } from 'react'
import {
  Plus,
  Check,
  X,
  RefreshCw,
  Users,
  Clock,
  AlertCircle,
  Search,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { readTeamState, readActiveChannelId, readClientActor, resetTeamStorage } from '../storage'
import { membershipOf, isOwner } from '../resolver'
import { SECTIONS, setKey, isPermissionKey, permissionLabel } from '../permissions'
import { inviteByUsername, createInviteCode, updateMemberPermissions, removeMember, revokeInvitation, type TeamResult } from '../adapter'
import { USER_BY_ID, TEAM_USERS } from '../fixtures'
import type { TeamMember, PermissionKey } from '../types'
import { MemberIdCard, InvitationIdCard, TeamAvatar } from './TeamCards'
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
const INVITE_CODE_HOURS = 168

// Compact stat tile
function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="surface-card flex items-center gap-3 p-3">
      <span className="surface-inset inline-flex h-9 w-9 shrink-0 items-center justify-center text-[#bee1fc]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold leading-tight text-foreground">{value}</p>
      </div>
    </div>
  )
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
    return teamState.audit.filter(a => a.channelId === activeChannelId).slice(0, 100)
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
      selectedPermissions: new Set(setKey(Array.from(prev.selectedPermissions), permission, !prev.selectedPermissions.has(permission))),
    }))
  }

  const reportResult = (result: TeamResult<unknown>, successKey: Parameters<typeof t>[0]) => {
    if (result.ok) {
      toast.success(t(successKey))
      return true
    }
    toast.error(t(`channelTeam.err.${result.error}` as Parameters<typeof t>[0]))
    return false
  }

  const auditActionLabel = (action: string) => {
    const key = `channelTeam.audit.${action}` as Parameters<typeof t>[0]
    const translated = t(key)
    if (translated !== key) return translated
    return isPermissionKey(action) ? permissionLabel(action)[lang] : action
  }

  const handleInviteSubmit = () => {
    const perms = Array.from(inviteModal.selectedPermissions)

    if (inviteModal.method === 'username') {
      const wanted = inviteModal.username.trim().replace(/^@/, '').toLowerCase()
      if (!wanted) {
        toast.error(t('channelTeam.error.noUsername'))
        return
      }
      const invitee = TEAM_USERS.find((u) => u.username.toLowerCase() === wanted)
      if (!invitee) {
        toast.error(t('channelTeam.err.not_found'))
        return
      }
      if (!reportResult(inviteByUsername(activeChannelId, invitee.id, perms), 'channelTeam.success.invited')) return
    } else {
      if (!reportResult(createInviteCode(activeChannelId, perms, INVITE_CODE_HOURS), 'channelTeam.success.codeCreated')) return
      setTab('invitations')
    }

    setShowInviteModal(false)
  }

  const handleEditMember = (member: TeamMember) => {
    setEditingMember({
      member,
      selectedPermissions: new Set(member.permissions),
    })
    setShowEditModal(true)
  }

  const handleSavePermissions = () => {
    if (!editingMember?.member) return
    if (!reportResult(updateMemberPermissions(editingMember.member.id, Array.from(editingMember.selectedPermissions)), 'channelTeam.success.permissionsUpdated')) return
    setShowEditModal(false)
    setEditingMember(null)
  }

  const handleRemoveMember = () => {
    if (!deletingMemberId) return
    reportResult(removeMember(deletingMemberId), 'channelTeam.success.memberRemoved')
    setShowDeleteDialog(false)
    setDeletingMemberId(null)
  }

  const handleRevokeInvitation = () => {
    if (!revokingInvitationId) return
    reportResult(revokeInvitation(revokingInvitationId), 'channelTeam.success.invitationRevoked')
    setShowRevokeDialog(false)
    setRevokingInvitationId(null)
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

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2.5">
                <Users className="h-6 w-6 text-[#bee1fc]" />
                <h1 className="text-2xl font-bold text-foreground">{t('channelTeam.title')}</h1>
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
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={Users} label={t('channelTeam.stats.totalMembers')} value={currentMembers.length} />
            <StatCard icon={Clock} label={t('channelTeam.stats.pendingInvitations')} value={pendingInvitations.length} />
            <StatCard icon={Shield} label={t('channelTeam.stats.customRoles')} value={SECTIONS.length} />
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
          <div className="mt-5">
            {/* Members Tab */}
            {tab === 'members' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 relative max-w-sm">
                    <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={t('channelTeam.searchMembers')}
                      value={searchMembers}
                      onChange={(e) => setSearchMembers(e.target.value)}
                      className="w-full ps-9 pe-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#bee1fc] focus:outline-none transition-colors"
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
                  <div className="surface-card p-10 text-center">
                    <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">{t('channelTeam.noMembers')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredMembers.map((member) => (
                      <MemberIdCard
                        key={member.id}
                        member={member}
                        onEdit={() => handleEditMember(member)}
                        onRemove={() => {
                          setDeletingMemberId(member.id)
                          setShowDeleteDialog(true)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Invitations Tab */}
            {tab === 'invitations' && (
              <div className="space-y-4">
                <div className="flex-1 relative max-w-sm">
                  <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={t('channelTeam.searchInvitations')}
                    value={searchInvitations}
                    onChange={(e) => setSearchInvitations(e.target.value)}
                    className="w-full ps-9 pe-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#bee1fc] focus:outline-none transition-colors"
                  />
                </div>

                {filteredInvitations.length === 0 ? (
                  <div className="surface-card p-10 text-center">
                    <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">{t('channelTeam.noPendingInvitations')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredInvitations.map((invitation) => (
                      <InvitationIdCard
                        key={invitation.id}
                        invitation={invitation}
                        copied={copiedCode === invitation.code}
                        onCopy={() => copyInviteCode(invitation.code || '')}
                        onRevoke={() => {
                          setRevokingInvitationId(invitation.id)
                          setShowRevokeDialog(true)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Audit Log Tab */}
            {tab === 'audit' && (
              <div className="space-y-4">
                {auditEntries.length === 0 ? (
                  <div className="surface-card p-10 text-center">
                    <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">{t('channelTeam.noAuditLog')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditEntries.map((entry, index) => {
                      const actor = USER_BY_ID[entry.actorId]
                      return (
                        <div key={index} className="surface-card flex items-start gap-3 p-3 transition-colors hover:border-white/20">
                          <TeamAvatar userId={entry.actorId} size={32} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">
                              <span className="font-semibold">{actor?.username || entry.actorId}</span>
                              {' '}{auditActionLabel(entry.action)}
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
          <div className="surface-card w-full max-w-sm p-6 shadow-2xl">
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
          <div className="surface-card w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
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
                <div key={section.id} className="surface-inset p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{section.label[lang]}</p>
                      <p className="text-xs text-muted-foreground mt-1">{section.description[lang]}</p>
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
                        <span className="text-sm text-foreground">{perm.label[lang]}</span>
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
          <div className="surface-card w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
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
                <div key={section.id} className="surface-inset p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{section.label[lang]}</p>
                      <p className="text-xs text-muted-foreground mt-1">{section.description[lang]}</p>
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
                            const next = setKey(Array.from(prev.selectedPermissions), perm.key, !prev.selectedPermissions.has(perm.key))
                            return { ...prev, selectedPermissions: new Set(next) }
                          })}
                          className="h-4 w-4 rounded border-white/20"
                        />
                        <span className="text-sm text-foreground">{perm.label[lang]}</span>
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
        <AlertDialogContent className="surface-card">
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
        <AlertDialogContent className="surface-card">
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
