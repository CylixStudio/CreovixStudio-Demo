import { useQuery } from "@tanstack/react-query";

import { getStreamlabsSocketToken } from "@/lib/connections.functions";

/**
 * Streamlabs tips should arrive via the public webhook. We no longer pull the
 * durable socket token into the browser (XSS risk).
 */
export function StreamlabsBridge({ userId }: { userId: string }) {
  useQuery({
    queryKey: ["streamlabs-socket-token", userId],
    staleTime: 5 * 60 * 1000,
    queryFn: () => getStreamlabsSocketToken(),
  });
  return null;
}
