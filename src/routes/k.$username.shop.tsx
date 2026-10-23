import { createFileRoute } from "@tanstack/react-router";

import { DemoShopRoute } from "@/components/public/DemoShopRoute";
import { checkDemoShopRoute, DEMO_SHOP_HEADERS } from "@/lib/demoShopRoute";

export const Route = createFileRoute("/k/$username/shop")({
  beforeLoad: ({ params }) => checkDemoShopRoute(params.username, "kick"),
  headers: () => DEMO_SHOP_HEADERS,
  component: KickShop,
  notFoundComponent: KickShop,
});

function KickShop() {
  const { username } = Route.useParams();
  return <DemoShopRoute username={username} platform="kick" />;
}
