import { createServerFn } from "@tanstack/react-start";

import { DEMO_BUILD } from "@/lib/demoMode";
import {
  listPublicCommands,
  listPublicShop,
  listPublicTimers,
  loadCommandsChannel,
  loadPublishedChannel,
  type PublicCommand,
  type PublicShopItem,
  type PublicTimer,
} from "@/lib/publicChannel.server";
import {
  noteCommandsTrace,
  readPublicCommandsCache,
  writePublicCommandsCache,
} from "@/lib/publicCommandsCache";

function readSlug(input: unknown): { slug: string } {
  if (!input || typeof input !== "object") return { slug: "" };
  const slug = (input as { slug?: unknown }).slug;
  return { slug: typeof slug === "string" ? slug : "" };
}

/** Labeled Demo fixture. Not a real channel and not copied to production. */
export const FIXTURE_HUNDRED_SLUG = "fixture-hundred";

export function fixtureHundredCommands(): PublicCommand[] {
  return Array.from({ length: 110 }, (_, index) => ({
    trigger: `!fixture${index + 1}`,
    response: `FIXTURE public command ${index + 1}`,
  }));
}

export type PublicCommandsPage =
  | { found: false }
  | {
      found: true;
      slug: string;
      displayName: string;
      avatarUrl: string;
      commands: PublicCommand[];
      timers: PublicTimer[];
    };

export type PublicStorePage =
  | { found: false }
  | { found: true; slug: string; displayName: string; items: PublicShopItem[] };

export const loadPublicCommandsPage = createServerFn({ method: "POST" })
  .inputValidator(readSlug)
  .handler(async ({ data }): Promise<PublicCommandsPage> => {
    const slug = data.slug.trim().toLowerCase();
    const started = performance.now();
    const cached = readPublicCommandsCache<PublicCommandsPage>(slug, Date.now());
    if (cached) {
      noteCommandsTrace({
        cache: "hit",
        channelMs: 0,
        listMs: 0,
        totalMs: roundMs(performance.now() - started),
      });
      return cached;
    }
    const loaded = await loadPublicCommandsUncached(slug);
    const stored = writePublicCommandsCache(slug, loaded.page, Date.now());
    noteCommandsTrace({
      cache: stored ? "miss" : "skip",
      channelMs: loaded.channelMs,
      listMs: loaded.listMs,
      totalMs: roundMs(performance.now() - started),
    });
    return loaded.page;
  });

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

async function loadPublicCommandsUncached(slug: string): Promise<{
  page: PublicCommandsPage;
  channelMs: number;
  listMs: number;
}> {
  const channelStarted = performance.now();
  const channel = await loadCommandsChannel(slug);
  const channelMs = roundMs(performance.now() - channelStarted);
  if (!channel) return { page: { found: false }, channelMs, listMs: 0 };
  if (DEMO_BUILD && channel.slug === FIXTURE_HUNDRED_SLUG) {
    return {
      page: {
        found: true,
        slug: channel.slug,
        displayName: "FIXTURE hundred",
        avatarUrl: channel.avatarUrl,
        commands: fixtureHundredCommands(),
        timers: [],
      },
      channelMs,
      listMs: 0,
    };
  }
  const listStarted = performance.now();
  const [commands, timers] = await Promise.all([
    listPublicCommands(channel.userId),
    listPublicTimers(channel.userId),
  ]);
  return {
    page: {
      found: true,
      slug: channel.slug,
      displayName: channel.displayName,
      avatarUrl: channel.avatarUrl,
      commands,
      timers,
    },
    channelMs,
    listMs: roundMs(performance.now() - listStarted),
  };
}

export const loadPublicStorePage = createServerFn({ method: "POST" })
  .inputValidator(readSlug)
  .handler(async ({ data }): Promise<PublicStorePage> => {
    const channel = await loadPublishedChannel(data.slug);
    if (!channel) return { found: false };
    const items = await listPublicShop(channel.userId);
    return { found: true, slug: channel.slug, displayName: channel.displayName, items };
  });
