'use client';

import { Rocket, Award, Hammer, FlaskConical, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { builders, type Builder } from '@/lib/mock-data';

const badgeIcons: Record<string, React.ReactNode> = {
  Builder: <Hammer className="h-3 w-3" />,
  Maker: <Rocket className="h-3 w-3" />,
  Researcher: <FlaskConical className="h-3 w-3" />,
};

export function BuilderSpotlight() {
  return (
    <section id="builders" className="scroll-mt-20">
      <div className="mb-6 flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
            <Award className="h-5 w-5 text-accent" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold tracking-tight">Builder Spotlight</h2>
              <Badge variant="outline" className="border-accent/30 bg-accent/10 font-display text-[10px] text-[#C8B5FF]">
                📊 Live Data Coming Soon
              </Badge>
            </div>
            <p className="font-body text-sm text-muted-foreground">
              Proof of work from the Ink community (Featured preview)
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="hidden gap-2 font-display transition-all hover:scale-105 hover:border-accent hover:text-accent sm:flex"
        >
          Launch your app
          <Rocket className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {builders.map((builder, i) => (
          <BuilderCard key={builder.handle} builder={builder} index={i} />
        ))}
      </div>

      <Card className="glass mt-4 border-border/60 p-6 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <p className="font-display text-lg font-bold">Building on Ink?</p>
            <p className="font-body text-sm text-muted-foreground">
              Ship your app and get featured in the spotlight.
            </p>
          </div>
          <Button className="gap-2 bg-accent font-display text-accent-foreground transition-all hover:scale-105 hover:bg-accent/90 active:scale-95">
            Launch your app
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </section>
  );
}

function BuilderCard({ builder, index }: { builder: Builder; index: number }) {
  return (
    <Card
      className="glass group border-border/60 p-5 transition-all hover:scale-[1.02] hover:border-accent/40 animate-fade-in-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <CardContent className="p-0">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 border-2 border-accent/30">
            <AvatarFallback className="bg-secondary font-display text-sm font-bold">
              {builder.name.split(' ').map((n) => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">{builder.name}</h3>
              <Badge variant="secondary" className="gap-1 font-display text-xs">
                {badgeIcons[builder.badge]}
                {builder.badge}
              </Badge>
            </div>
            <p className="font-body text-sm text-muted-foreground">@{builder.handle}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Role
            </span>
            <span className="font-display text-sm font-medium">{builder.role}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {builder.skills.map((skill) => (
              <Badge key={skill} variant="outline" className="font-display text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/40 bg-secondary/30 p-3">
          <p className="font-body text-sm text-muted-foreground">{builder.contribution}</p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5 text-accent" />
            <span className="font-display text-sm font-semibold">{builder.shipped} shipped</span>
          </div>
          <a
            href="#profile"
            className="font-display text-sm font-medium text-accent transition-colors hover:text-accent/80"
          >
            View profile →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
