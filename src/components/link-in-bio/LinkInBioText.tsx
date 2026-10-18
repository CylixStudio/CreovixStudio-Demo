import type { CSSProperties, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const bioWrapClass = "whitespace-pre-wrap break-words [overflow-wrap:anywhere] [unicode-bidi:plaintext]";

const bioWrapStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  unicodeBidi: "plaintext",
};

export function LinkInBioText({
  children,
  className,
  style,
  as: Tag = "p",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
}) {
  return (
    <Tag className={cn(bioWrapClass, className)} dir="auto" style={{ ...bioWrapStyle, ...style }}>
      {children}
    </Tag>
  );
}
