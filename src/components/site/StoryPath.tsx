import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

import { Reveal } from "./primitives";

export interface StoryStop {
  icon: LucideIcon;
  title: string;
  body: string;
}

export function StoryPath({ stops }: { stops: StoryStop[] }) {
  return (
    <div className="relative mt-14">
      {/* Desktop: horizontal road with numbered stops */}
      <div className="relative hidden lg:block">
        <svg
          viewBox="0 0 1200 60"
          preserveAspectRatio="none"
          className="absolute left-0 right-0 top-8 h-16 w-full"
          aria-hidden
        >
          <line
            x1="40" y1="30" x2="1160" y2="30"
            stroke="var(--color-map-asphalt)"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <motion.line
            x1="40" y1="30" x2="1160" y2="30"
            stroke="var(--color-map-lane)"
            strokeWidth="2.5"
            strokeDasharray="14 14"
            strokeLinecap="round"
            animate={{ strokeDashoffset: [0, -56] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
          />
        </svg>
        <ol className="relative grid grid-cols-6 gap-4">
          {stops.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06}>
              <li className="flex flex-col items-center text-center">
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
                  <s.icon className="h-5 w-5" />
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-gold font-mono text-[11px] font-bold text-foreground">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-6 font-display text-base font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>

      {/* Mobile / tablet: vertical timeline */}
      <ol className="relative space-y-6 lg:hidden">
        <span
          className="absolute left-6 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary/60 via-primary/30 to-transparent"
          aria-hidden
        />
        {stops.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.04}>
            <li className="relative flex gap-4 pl-0">
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-background bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
                <s.icon className="h-4 w-4" />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-gold font-mono text-[10px] font-bold text-foreground">
                  {i + 1}
                </span>
              </span>
              <div className="pt-1.5">
                <h3 className="font-display text-base font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}