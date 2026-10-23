import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import type { ChatLayout } from "@/lib/widgets";

function ChatPortrait({ url, author }: { url?: string | null | undefined; author: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const usable = url && /^https:\/\//i.test(url) && failed !== url ? url : null;
  return (
    <span className="chat-refined-avatar">
      {usable ? (
        <img src={usable} alt="" referrerPolicy="no-referrer" onError={() => setFailed(usable)} />
      ) : (
        <bdi>{Array.from(author.trim())[0] ?? "?"}</bdi>
      )}
    </span>
  );
}

export function ChatMessageFace({
  layout,
  author,
  name,
  meta,
  color,
  avatarUrl,
  children,
}: {
  layout: ChatLayout;
  author: string;
  name: ReactNode;
  meta?: ReactNode;
  color: string;
  avatarUrl?: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <div
      data-chat-face={layout}
      dir="ltr"
      className={`premium-chat premium-chat-${layout}`}
      style={{ "--chat-accent": color } as CSSProperties}
    >
      {layout !== "island" ? <ChatPortrait url={avatarUrl} author={author} /> : null}
      <div className="premium-chat-copy">
        <header>
          {meta}
          {name}
        </header>
        <bdi className="premium-chat-text" dir="auto">
          {children}
        </bdi>
      </div>
      {layout === "island" ? <ChatPortrait url={avatarUrl} author={author} /> : null}
    </div>
  );
}
