import { createFileRoute } from '@tanstack/react-router'
import { ChannelTeamPage } from '@/features/channel-team/components/ChannelTeamPage'

export const Route = createFileRoute('/_authenticated/channel-team')({
  component: ChannelTeamPage,
  meta: () => [
    {
      title: 'Channel Team',
    },
  ],
})
