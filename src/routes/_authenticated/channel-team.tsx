import { createFileRoute } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { ChannelTeamPage } from '@/features/channel-team/components/ChannelTeamPage'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useLanguage } from '@/lib/i18n'

export const Route = createFileRoute('/_authenticated/channel-team')({
  component: ChannelTeamRoute,
  head: () => ({ meta: [{ title: 'Channel Team' }] }),
})

function ChannelTeamRoute() {
  const { user } = Route.useRouteContext()
  const workspace = useWorkspace(user.id)
  const { t } = useLanguage()

  return (
    <AppShell
      user={user}
      profile={workspace.data?.profile}
      title={t('channelTeam.title')}
      subtitle={t('channelTeam.subtitle')}
    >
      <ChannelTeamPage />
    </AppShell>
  )
}
