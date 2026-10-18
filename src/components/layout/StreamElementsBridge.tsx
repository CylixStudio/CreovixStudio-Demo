import { useQuery } from "@tanstack/react-query";

import { getStreamElementsToken } from "@/lib/connections.functions";

/**
 * StreamElements tips should arrive via the public webhook. We no longer pull the
 * durable JWT into the browser (XSS risk). This component only checks that a
 * connection exists so Settings UX can stay coherent.
 */
export function StreamElementsBridge({ userId }: { userId: string }) {
  useQuery({
    queryKey: ["streamelements-token", userId],
    staleTime: 5 * 60 * 1000,
    queryFn: () => getStreamElementsToken(),
  });
  return null;
}
