import { createFileRoute } from "@tanstack/react-router";

import { DemoShopRoute } from "@/components/public/DemoShopRoute";
import { checkDemoShopRoute, DEMO_SHOP_HEADERS } from "@/lib/demoShopRoute";

export const Route = createFileRoute("/t/$username/shop")({
  beforeLoad: ({ params }) => checkDemoShopRoute(params.username, "twitch"),
  headers: () => DEMO_SHOP_HEADERS,
  component: TwitchShop,
  notFoundComponent: TwitchShop,
});

function TwitchShop() {
  const { username } = Route.useParams();
  return <DemoShopRoute username={username} platform="twitch" />;
}
