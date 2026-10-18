import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import "@/lib/demoGuard";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // TikTok's property verifier requests the submitted URL verbatim and does
    // not reliably follow the framework's canonical trailing-slash redirect.
    trailingSlash: "preserve",
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
