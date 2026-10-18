import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bio/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/u/$slug", params: { slug: params.slug } });
  },
});
