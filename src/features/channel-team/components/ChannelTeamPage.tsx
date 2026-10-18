import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, Check, X, RefreshCw, Users, Copy, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { readTeamState, readActiveChannelId, readClientActor, resetTeamStorage } from '../storage'
import { membershipOf, isOwner } from '../resolver'
import { SECTIONS } from '../permissions'
import { inviteByUsername, createInviteCode, acceptInvitation, declineInvitation, updateMemberPermissions, removeMember } from '../adapter'
import type { TeamMember, Invitation, ActorContext, PermissionKey } from '../types'
import { useLanguage } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Tabs } from '@/components/ui/tabs'
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

export function ChannelTeamPage() {
  const { t, lang } = useLanguage()
  const [teamState, setTeamState] = useState(readTeamState())
  const [actor, setActor] = useState(readClientActor())
  const [activeChannelId, setActiveChannelId] = useState(readActiveChannelId())
  const [tab, setTab] = useState('members')
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteMethod, setInviteMethod] = useState<'username' | 'code'>('username')
  const [selectedPermissions, setSelectedPermissions] = useState<Set<PermissionKey>>(new Set())
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Load state on mount and listen for changes
  useEffect(() => {
    const handleStateChange = () => {
      setTeamState(readTeamState())
      setActor(readClientActor())
      setActiveChannelId(readActiveChannelId())
    }
    window.addEventListener(TEAM_EVENT, handleStateChange)
    return () => window.removeEventListener(TEAM_EVENT, handleStateChange)
  }, [])

  const currentMembers = teamState.members.filter((m) => m.channelId === activeChannelId && m.status === 'active')
  const pendingInvitations = teamState.invitations.filter((i) => i.channelId === activeChannelId && i.status === 'pending')
  const canManageTeam = isOwner(actor.actorId, activeChannelId)

  if (!canManageTeam) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-8">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-400">{t('channelTeam.noAccess')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('channelTeam.ownerOnly')}</p>
        </div>
      </div>
    )
  }

  const handleInviteSubmit = async () => {
    try {
      if (inviteMethod === 'username') {
        if (!inviteUsername.trim()) {
          toast.error(t('channelTeam.error.noUsername'))
          return
        }
        const perms = Array.from(selectedPermissions)
        await inviteByUsername(activeChannelId, inviteUsername, perms)
        toast.success(t('channelTeam.success.invited'))
        setInviteUsername('')
        setSelectedPermissions(new Set())
        setShowInviteModal(false)
      } else {
        const perms = Array.from(selectedPermissions)
        const code = await createInviteCode(activeChannelId, perms)
        toast.success(t('channelTeam.success.codeCreated'))
        setInviteMethod('username')
        setSelectedPermissions(new Set())
        setShowInviteModal(false)
      }
    } catch (error) {
      toast.error(t('channelTeam.error.inviteFailed'))
      console.error(error)
    }
  }

  const handlePermissionsChange = async (memberId: string, permissions: Set<PermissionKey>) => {
    try {
      await updateMemberPermissions(activeChannelId, memberId, Array.from(permissions))
      toast.success(t('channelTeam.success.permissionsUpdated'))
      setShowPermissionsModal(false)
      setEditingMember(null)
      setSelectedPermissions(new Set())
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-[#bee1fc]" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('channelTeam.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('channelTeam.subtitle')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            {t('settings.resetBtn')}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <div className="border-b border-white/10">
            <div className="flex gap-4">
              <button
                onClick={() => setTab('members')}
                className={`pb-2 text-sm font-medium transition-colors ${
                  tab === 'members'
                    ? 'border-b-2 border-[#bee1fc] text-[#bee1fc]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('channelTeam.members')}
              </button>
              <button
                onClick={() => setTab('invitations')}
                className={`pb-2 text-sm font-medium transition-colors ${
                  tab === 'invitations'
                    ? 'border-b-2 border-[#bee1fc] text-[#bee1fc]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('channelTeam.invitations')} ({pendingInvitations.length})
              </button>
              <button
                onClick={() => setTab('audit')}
                className={`pb-2 text-sm font-medium transition-colors ${
                  tab === 'audit'
                    ? 'border-b-2 border-[#bee1fc] text-[#bee1fc]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('channelTeam.auditLog')}
              </button>
            </div>
          </div>

          {/* Members Tab */}
          {tab === 'members' && (
            <div className="space-y-4">
              <Button
                onClick={() => {
                  setInviteMethod('username')
                  setShowInviteModal(true)
                }}
                className="gap-2 bg-[#bee1fc] text-black hover:bg-[#bee1fc]/90"
              >
                <Plus className="h-4 w-4" />
                {t('channelTeam.addMember')}
              </Button>

              {currentMembers.length === 0 ? (
                <div className="rounded-lg border border-white/5 p-8 text-center">
                  <p className="text-sm text-muted-foreground">{t('channelTeam.noMembers')}</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {currentMembers.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-4 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#bee1fc] to-[#bee1fc]/50 flex items-center justify-center text-sm font-semibold text-black">
                          {member.userId[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{member.userId}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.permissions.length} {t('channelTeam.permissions')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingMember(member)
                            setSelectedPermissions(new Set(member.permissions))
                            setShowPermissionsModal(true)
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingMemberId(member.userId)
                            setShowDeleteDialog(true)
                          }}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-400"
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
            <div className="space-y-4">
              {pendingInvitations.length === 0 ? (
                <div className="rounded-lg border border-white/5 p-8 text-center">
                  <p className="text-sm text-muted-foreground">{t('channelTeam.noPendingInvitations')}</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-4"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {invitation.method === 'username' ? invitation.inviteeId : t('channelTeam.codeInvite')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invitation.permissions.length} {t('channelTeam.permissions')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeclineInvitation(invitation.id)}
                          className="h-8 gap-1 px-2 text-red-500 hover:text-red-400"
                        >
                          <X className="h-4 w-4" />
                          {t('channelTeam.decline')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Audit Log Tab */}
          {tab === 'audit' && (
            <div className="space-y-4">
              {teamState.auditLog.length === 0 ? (
                <div className="rounded-lg border border-white/5 p-8 text-center">
                  <p className="text-sm text-muted-foreground">{t('channelTeam.noAuditLog')}</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {teamState.auditLog.slice().reverse().map((log, index) => (
                    <div key={index} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">{log.actor}</span> {log.action}
                      </p>
                      <p className="mt-1 text-muted-foreground/70">{new Date(log.timestamp).toLocaleString(lang)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Tabs>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="rounded-lg bg-[#0a0a0a] p-6 shadow-xl border border-white/10 w-full max-w-sm mx-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">{t('channelTeam.addMember')}</h2>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setInviteMethod('username')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      inviteMethod === 'username'
                        ? 'bg-[#bee1fc] text-black'
                        : 'bg-white/[0.05] text-foreground hover:bg-white/10'
                    }`}
                  >
                    {t('channelTeam.byUsername')}
                  </button>
                  <button
                    onClick={() => setInviteMethod('code')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      inviteMethod === 'code'
                        ? 'bg-[#bee1fc] text-black'
                        : 'bg-white/[0.05] text-foreground hover:bg-white/10'
                    }`}
                  >
                    {t('channelTeam.byCode')}
                  </button>
                </div>

                {inviteMethod === 'username' && (
                  <input
                    type="text"
                    placeholder={t('channelTeam.username')}
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-foreground placeholder:text-muted-foreground focus:border-[#bee1fc] focus:outline-none transition-colors"
                  />
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{t('channelTeam.selectPermissions')}</p>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {SECTIONS.map((section) => (
                      <div key={section.id} className="rounded bg-white/[0.02] p-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{section.label}</p>
                        <div className="space-y-1">
                          {section.permissions.map((perm) => (
                            <label key={perm.key} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedPermissions.has(perm.key)}
                                onChange={(e) => {
                                  const newPerms = new Set(selectedPermissions)
                                  if (e.target.checked) {
                                    newPerms.add(perm.key)
                                  } else {
                                    newPerms.delete(perm.key)
                                  }
                                  setSelectedPermissions(newPerms)
                                }}
                                className="h-3 w-3"
                              />
                              <span className="text-muted-foreground">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowInviteModal(false)} className="flex-1">
                    {t('channelTeam.cancel')}
                  </Button>
                  <Button
                    onClick={handleInviteSubmit}
                    className="flex-1 gap-2 bg-[#bee1fc] text-black hover:bg-[#bee1fc]/90"
                  >
                    <Check className="h-4 w-4" />
                    {inviteMethod === 'username' ? t('channelTeam.sendInvite') : t('channelTeam.createCode')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Permissions Modal */}
        {showPermissionsModal && editingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="rounded-lg bg-[#0a0a0a] p-6 shadow-xl border border-white/10 w-full max-w-sm mx-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {t('channelTeam.editPermissions')} - {editingMember.userId}
              </h2>

              <div className="max-h-64 overflow-y-auto space-y-3 mb-6">
                {SECTIONS.map((section) => (
                  <div key={section.id} className="rounded bg-white/[0.02] p-3">
                    <p className="text-sm font-medium text-muted-foreground mb-2">{section.label}</p>
                    <div className="space-y-1">
                      {section.permissions.map((perm) => (
                        <label key={perm.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.has(perm.key)}
                            onChange={(e) => {
                              const newPerms = new Set(selectedPermissions)
                              if (e.target.checked) {
                                newPerms.add(perm.key)
                              } else {
                                newPerms.delete(perm.key)
                              }
                              setSelectedPermissions(newPerms)
                            }}
                            className="h-4 w-4"
                          />
                          <span className="text-muted-foreground">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowPermissionsModal(false)} className="flex-1">
                  {t('channelTeam.cancel')}
                </Button>
                <Button
                  onClick={() => handlePermissionsChange(editingMember.userId, selectedPermissions)}
                  className="flex-1 gap-2 bg-[#bee1fc] text-black hover:bg-[#bee1fc]/90"
                >
                  <Check className="h-4 w-4" />
                  {t('channelTeam.save')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && (
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
        )}
      </div>
    </div>
  )
}
