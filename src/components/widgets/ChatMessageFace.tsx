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
      className={`chat-refined chat-refined-${layout}`}
      style={{ "--chat-accent": color } as CSSProperties}
    >
      {layout === "bubble" ? <ChatPortrait url={avatarUrl} author={author} /> : null}
      <div className="chat-refined-body">
        <header>
          {layout === "island" ? <span className="chat-island-dot" /> : null}
          {meta}
          {name}
        </header>
        <bdi className="chat-refined-text" dir="auto">
          {children}
        </bdi>
      </div>
    </div>
  );
}
