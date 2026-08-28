'use client';

import { Award, Rocket, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function BuilderSpotlight() {
  return (
    <section id="builders" className="scroll-mt-20">
      <div className="mb-6 flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
            <Award className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Builder Spotlight</h2>
            <p className="font-body text-sm text-muted-foreground">
              Proof of work from the Ink community
            </p>
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          className="hidden gap-2 font-display transition-all hover:scale-105 hover:border-accent hover:text-accent sm:flex"
        >
          <a
            href="https://docs.inkonchain.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Launch your app
            <Rocket className="h-4 w-4" />
          </a>
        </Button>
      </div>

      {/* Placeholder — real community profiles appear once a builder indexer exists. */}
      <Card className="glass border-border/60 animate-fade-in-up">
        <CardContent className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <Rocket className="h-8 w-8 text-[#B99CFF]/60" />
          <p className="font-display text-lg font-bold">Community spotlight — coming soon</p>
          <p className="max-w-md font-body text-sm leading-relaxed text-muted-foreground">
            Proof-of-work profiles for builders shipping on Ink will appear here once the
            community indexer is live.
          </p>
        </CardContent>
      </Card>

      <Card className="glass mt-4 border-border/60 p-6 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <p className="font-display text-lg font-bold">Building on Ink?</p>
            <p className="font-body text-sm text-muted-foreground">
              Ship your app and get featured in the spotlight.
            </p>
          </div>
          <Button
            asChild
            className="gap-2 bg-accent font-display text-accent-foreground transition-all hover:scale-105 hover:bg-accent/90 active:scale-95"
          >
            <a
              href="https://docs.inkonchain.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Launch your app
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </Card>
    </section>
  );
}
