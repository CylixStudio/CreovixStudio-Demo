import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { cn } from "@/lib/utils";

export const LEGAL_CONTACT_EMAIL = "store@creovix.com";
export const LEGAL_OPERATOR = "CylixStudio";
export const LEGAL_UPDATED = "12 September 2026";

export type LegalTocItem = { id: string; title: string };

type LegalDocumentProps = {
  title: string;
  lede: string;
  lastUpdated?: string;
  toc: LegalTocItem[];
  children: ReactNode;
};

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border/70 pt-10 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-4 space-y-4 text-[0.95rem] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalSub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <div className="mt-2 space-y-3">{children}</div>
    </div>
  );
}

export function LegalDocument({
  title,
  lede,
  lastUpdated = LEGAL_UPDATED,
  toc,
  children,
}: LegalDocumentProps) {
  const [active, setActive] = useState(toc[0]?.id ?? "");

  useEffect(() => {
    const nodes = toc
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = visible[0]?.target.id;
        if (id) setActive(id);
      },
      { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.2, 0.6] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [toc]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="CylixStudio"
          >
            <BrandLogo showWordmark size="sm" />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground" aria-label="Legal documents">
            <Link to="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:py-16">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            On this page
          </p>
          <nav
            aria-label="Table of contents"
            className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-0"
          >
            {toc.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors lg:rounded-none lg:border-s lg:px-3 lg:py-2",
                  active === item.id
                    ? "border-foreground/40 bg-white/[0.04] text-foreground lg:bg-transparent"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-prose">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Legal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          <p className="mt-6 text-[0.95rem] leading-relaxed text-muted-foreground">{lede}</p>
          <div className="mt-10 space-y-10">{children}</div>
        </article>
      </div>
    </div>
  );
}
