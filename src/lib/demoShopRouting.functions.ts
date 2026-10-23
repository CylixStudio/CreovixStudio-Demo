import { createServerFn } from "@tanstack/react-start";

import { parseShopRoutingHints, SHOP_ROUTING_COOKIE } from "@/lib/demoShopRoutingHints";

export const readDemoShopRoutingHints = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  return parseShopRoutingHints(getCookie(SHOP_ROUTING_COOKIE));
});
