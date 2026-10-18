import { useEffect, useState } from 'react'
import { Container, Tabs, Group, Button, Stack, Box, Badge, Text, Avatar, SimpleGrid, Paper, Title, ActionIcon, Modal, TextInput, Select } from '@mantine/core'
import { IconPlus, IconTrash, IconEdit, IconCheck, IconX } from '@tabler/icons-react'
import { readTeamStorage, getActiveChannelId, getActorContext } from '../storage'
import { getChannelTeamState, isOwner } from '../resolver'
import { inviteByUsername, createInviteCode, acceptInvitation, declineInvitation, updateMemberPermissions, removeMember } from '../adapter'
import { PERMISSION_SECTIONS } from '../permissions'
import type { TeamMember, Invitation, ActorContext } from '../types'
import { useLanguage } from '~/lib/i18n'
import styles from './ChannelTeamPage.module.css'

export function ChannelTeamPage() {
  const { t } = useLanguage()
  const [teamState, setTeamState] = useState(getChannelTeamState(readTeamStorage(), getActiveChannelId()))
  const [actor, setActor] = useState<ActorContext | null>(getActorContext())
  const [activeTab, setActiveTab] = useState<string | null>('members')

  // Modals
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [generatedCode, setGeneratedCode] = useState('')
  const [codePermissions, setCodePermissions] = useState<Record<string, string>>({})

  const canManageTeam = actor && teamState ? isOwner(teamState, actor.userId) : false

  // Listen to team state changes
  useEffect(() => {
    const handleStorageChange = () => {
      setTeamState(getChannelTeamState(readTeamStorage(), getActiveChannelId()))
      setActor(getActorContext())
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  if (!teamState || !actor) {
    return <Container>{t('common.loading')}</Container>
  }

  const members = teamState.members || []
  const invitations = teamState.invitations || []
  const auditLog = teamState.auditLog || []

  const handleInviteByUsername = async () => {
    if (!inviteUsername.trim()) return
    try {
      await inviteByUsername(inviteUsername, codePermissions, getActiveChannelId())
      setInviteUsername('')
      setCodePermissions({})
      setInviteModalOpen(false)
      setTeamState(getChannelTeamState(readTeamStorage(), getActiveChannelId()))
    } catch (error) {
      console.error('Failed to invite:', error)
    }
  }

  const handleCreateCode = () => {
    const code = createInviteCode(codePermissions, getActiveChannelId())
    setGeneratedCode(code)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode)
  }

  const handleAcceptInvitation = (invitationId: string) => {
    acceptInvitation(invitationId, getActiveChannelId())
    setTeamState(getChannelTeamState(readTeamStorage(), getActiveChannelId()))
  }

  const handleDeclineInvitation = (invitationId: string) => {
    declineInvitation(invitationId, getActiveChannelId())
    setTeamState(getChannelTeamState(readTeamStorage(), getActiveChannelId()))
  }

  const handleUpdatePermissions = (memberId: string, permissions: Record<string, string>) => {
    updateMemberPermissions(memberId, permissions, getActiveChannelId())
    setTeamState(getChannelTeamState(readTeamStorage(), getActiveChannelId()))
    setPermissionsModalOpen(false)
    setEditingMember(null)
  }

  const handleRemoveMember = (memberId: string) => {
    if (confirm(t('channelTeam.confirmRemove'))) {
      removeMember(memberId, getActiveChannelId())
      setTeamState(getChannelTeamState(readTeamStorage(), getActiveChannelId()))
    }
  }

  return (
    <Container size="lg" py="lg">
      <Title order={1} mb="lg">
        {t('channelTeam.title')}
      </Title>

      <Tabs value={activeTab} onTabChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="members">{t('channelTeam.members')}</Tabs.Tab>
          <Tabs.Tab value="invitations">{t('channelTeam.invitations')}</Tabs.Tab>
          <Tabs.Tab value="audit">{t('channelTeam.auditLog')}</Tabs.Tab>
        </Tabs.List>

        {/* Members Tab */}
        <Tabs.Panel value="members" pt="xl">
          <Group mb="lg" justify="space-between">
            <Title order={2}>{t('channelTeam.teamMembers')}</Title>
            {canManageTeam && (
              <Button leftSection={<IconPlus size={16} />} onClick={() => setInviteModalOpen(true)}>
                {t('channelTeam.addMember')}
              </Button>
            )}
          </Group>

          {members.length === 0 ? (
            <Text c="dimmed">{t('channelTeam.noMembers')}</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} gap="md">
              {members.map((member) => (
                <Paper key={member.id} p="md" radius="md" withBorder className={styles.memberCard}>
                  <Group justify="space-between" mb="sm">
                    <Group>
                      <Avatar name={member.displayName} color="blue" radius="xl" />
                      <div>
                        <Text fw={500}>{member.displayName}</Text>
                        <Text size="xs" c="dimmed">
                          @{member.username}
                        </Text>
                      </div>
                    </Group>
                    <Badge>{t(`channelTeam.${member.status}`)}</Badge>
                  </Group>

                  <Stack gap="xs" mb="md">
                    {Object.entries(PERMISSION_SECTIONS).map(([section, config]) => {
                      const level = member.permissions?.[section] || 'none'
                      return (
                        <Group key={section} justify="space-between">
                          <Text size="sm">{t(config.label)}</Text>
                          <Badge size="sm" variant="light">
                            {t(`channelTeam.${level}`)}
                          </Badge>
                        </Group>
                      )
                    })}
                  </Stack>

                  {canManageTeam && (
                    <Group>
                      <ActionIcon
                        variant="light"
                        onClick={() => {
                          setEditingMember(member)
                          setPermissionsModalOpen(true)
                        }}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" onClick={() => handleRemoveMember(member.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  )}
                </Paper>
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        {/* Invitations Tab */}
        <Tabs.Panel value="invitations" pt="xl">
          <Title order={2} mb="lg">
            {t('channelTeam.pendingInvitations')}
          </Title>

          {invitations.length === 0 ? (
            <Text c="dimmed">{t('channelTeam.noInvitations')}</Text>
          ) : (
            <Stack gap="md">
              {invitations.map((invitation) => (
                <Paper key={invitation.id} p="md" radius="md" withBorder>
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>
                        {invitation.inviteeUsername} {invitation.inviteeUserId ? `(${invitation.inviteeUserId})` : `(Code: ${invitation.code})`}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t(`channelTeam.${invitation.status}`)} • {new Date(invitation.createdAt).toLocaleDateString()}
                      </Text>
                    </div>
                    {invitation.status === 'pending' && (
                      <Group>
                        <ActionIcon variant="light" color="green" onClick={() => handleAcceptInvitation(invitation.id)}>
                          <IconCheck size={16} />
                        </ActionIcon>
                        <ActionIcon variant="light" color="red" onClick={() => handleDeclineInvitation(invitation.id)}>
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        {/* Audit Log Tab */}
        <Tabs.Panel value="audit" pt="xl">
          <Title order={2} mb="lg">
            {t('channelTeam.auditLog')}
          </Title>

          {auditLog.length === 0 ? (
            <Text c="dimmed">{t('channelTeam.noAuditLog')}</Text>
          ) : (
            <Stack gap="md">
              {auditLog.map((entry, idx) => (
                <Paper key={idx} p="md" radius="md" withBorder>
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>{entry.action}</Text>
                      <Text size="xs" c="dimmed">
                        {entry.actorId} • {entry.section} • {new Date(entry.timestamp).toLocaleString()}
                      </Text>
                    </div>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Invite Modal */}
      <Modal opened={inviteModalOpen} onClose={() => setInviteModalOpen(false)} title={t('channelTeam.inviteMember')}>
        <Stack gap="md">
          <TextInput
            label={t('channelTeam.username')}
            placeholder="john_doe"
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.currentTarget.value)}
          />

          <Box>
            <Text fw={500} mb="sm">
              {t('channelTeam.permissions')}
            </Text>
            {Object.entries(PERMISSION_SECTIONS).map(([section, config]) => (
              <Select
                key={section}
                label={t(config.label)}
                placeholder={t('channelTeam.selectPermission')}
                data={[
                  { value: 'none', label: t('channelTeam.none') },
                  { value: 'view', label: t('channelTeam.view') },
                  { value: 'manage', label: t('channelTeam.manage') },
                ]}
                value={codePermissions[section] || 'none'}
                onChange={(val) =>
                  setCodePermissions({
                    ...codePermissions,
                    [section]: val || 'none',
                  })
                }
                mb="sm"
              />
            ))}
          </Box>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setInviteModalOpen(false)}>
              {t('channelTeam.cancel')}
            </Button>
            <Button onClick={handleInviteByUsername}>{t('channelTeam.send')}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Permissions Modal */}
      <Modal opened={permissionsModalOpen} onClose={() => setPermissionsModalOpen(false)} title={t('channelTeam.editPermissions')}>
        {editingMember && (
          <Stack gap="md">
            <Text fw={500}>{editingMember.displayName}</Text>
            {Object.entries(PERMISSION_SECTIONS).map(([section, config]) => (
              <Select
                key={section}
                label={t(config.label)}
                placeholder={t('channelTeam.selectPermission')}
                data={[
                  { value: 'none', label: t('channelTeam.none') },
                  { value: 'view', label: t('channelTeam.view') },
                  { value: 'manage', label: t('channelTeam.manage') },
                ]}
                value={editingMember.permissions?.[section] || 'none'}
                onChange={(val) => {
                  setEditingMember({
                    ...editingMember,
                    permissions: {
                      ...editingMember.permissions,
                      [section]: val || 'none',
                    },
                  })
                }}
                mb="sm"
              />
            ))}

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPermissionsModalOpen(false)}>
                {t('channelTeam.cancel')}
              </Button>
              <Button onClick={() => handleUpdatePermissions(editingMember.id, editingMember.permissions || {})}>
                {t('channelTeam.save')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  )
}
