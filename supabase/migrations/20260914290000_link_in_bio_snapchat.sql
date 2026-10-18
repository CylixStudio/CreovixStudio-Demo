ALTER TABLE public.link_in_bio_links
  DROP CONSTRAINT IF EXISTS link_in_bio_links_platform;

ALTER TABLE public.link_in_bio_links
  ADD CONSTRAINT link_in_bio_links_platform CHECK (
    platform IN (
      'kick',
      'twitch',
      'youtube',
      'tiktok',
      'instagram',
      'snapchat',
      'x',
      'discord',
      'whatsapp',
      'custom'
    )
  );
