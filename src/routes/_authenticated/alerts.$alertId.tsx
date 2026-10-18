import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/alerts/$alertId")({
  component: () => <Navigate to="/alerts" />,
});
