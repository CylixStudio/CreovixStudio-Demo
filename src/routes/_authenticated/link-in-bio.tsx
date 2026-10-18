import { createFileRoute } from "@tanstack/react-router";

import { LinkInBioStudio } from "@/components/link-in-bio/LinkInBioStudio";
import { useWorkspace } from "@/hooks/useWorkspace";
import { parseLinkInBioSearch } from "@/lib/linkInBio";

export const Route = createFileRoute("/_authenticated/link-in-bio")({
  validateSearch: (search: Record<string, unknown>) => parseLinkInBioSearch(search),
  head: () => ({
    meta: [
      { title: "CylixStudio — Link in Bio" },
      { name: "description", content: "Set up a public page for socials, streams, and custom links." },
    ],
  }),
  component: LinkInBioEditorPage,
});

function LinkInBioEditorPage() {
  const { user } = Route.useRouteContext();
  const { setup, step } = Route.useSearch();
  const { data: workspace } = useWorkspace(user.id);

  return (
    <LinkInBioStudio
      userId={user.id}
      user={user}
      workspaceProfile={workspace?.profile}
      forceSetup={Boolean(setup)}
      step={step}
    />
  );
}
