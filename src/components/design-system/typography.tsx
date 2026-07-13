import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Semantic typography primitives. Every text element in Academy OS should map
 * to one of these — never write ad-hoc `text-2xl font-bold` in pages.
 */

type TextProps = {
  children: ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
};

function make(defaultTag: keyof React.JSX.IntrinsicElements, base: string) {
  return function T({ children, className, as }: TextProps) {
    const Tag = (as ?? defaultTag) as keyof React.JSX.IntrinsicElements;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const El = Tag as any;
    return <El className={cn(base, className)}>{children}</El>;
  };
}

export const Display = make("h1", "ds-display text-foreground");
export const PageTitle = make("h1", "ds-h1 text-foreground");
export const SectionTitle = make("h2", "ds-h2 text-foreground");
export const CardTitle = make("h3", "ds-h3 text-foreground");
export const Body = make("p", "ds-body text-foreground");
export const Muted = make("p", "ds-body text-muted-foreground");
export const Caption = make("span", "ds-caption");
export const Eyebrow = make("span", "ds-eyebrow");
export const Stat = make("span", "ds-stat text-foreground");
