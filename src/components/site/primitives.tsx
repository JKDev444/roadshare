import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-sm">
      <span className="h-2 w-2 rounded-full bg-gold" aria-hidden />
      {children}
    </span>
  );
}

export function Section({
  children,
  className,
  muted,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <section className={cn("py-16 sm:py-24", muted && "bg-card/40", className)}>
      <div className="mx-auto max-w-7xl px-4">{children}</div>
    </section>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  primary,
  secondary,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  primary?: { label: string; to: string };
  secondary?: { label: string; to: string };
}) {
  return (
    <div className="relative overflow-hidden border-b border-border surface-glow">
      <div className="absolute inset-0 topo-grid opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:py-28">
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            {title}
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{subtitle}</p>
        </Reveal>
        {(primary || secondary) && (
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap gap-3">
              {primary && (
                <Button size="lg" asChild>
                  <Link to={primary.to}>
                    {primary.label} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              )}
              {secondary && (
                <Button size="lg" variant="outline" asChild>
                  <Link to={secondary.to}>{secondary.label}</Link>
                </Button>
              )}
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}

export function CTASection() {
  return (
    <Section>
      <Reveal className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/90 to-primary p-10 text-primary-foreground sm:p-16">
        <div className="absolute inset-0 topo-grid opacity-10" aria-hidden />
        <div className="relative max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Build a free scenario in minutes.
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            Explore the interactive Cedar Hollow demo — map a project, compare allocation
            methods, and see each household's fair share update live.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/tools/cedar-hollow">
                Try the demo <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              asChild
            >
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

export interface ContentBlock {
  heading: string;
  body: string[];
  bullets?: string[];
}

export function ContentPage({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <Section>
      <div className="mx-auto max-w-3xl space-y-12">
        {blocks.map((b, i) => (
          <Reveal key={b.heading} delay={i * 0.03}>
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">{b.heading}</h2>
              {b.body.map((p, j) => (
                <p key={j} className="mt-3 text-muted-foreground">
                  {p}
                </p>
              ))}
              {b.bullets && (
                <ul className="mt-4 space-y-2">
                  {b.bullets.map((li) => (
                    <li key={li} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {li}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
