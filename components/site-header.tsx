'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Wallet, LogOut, BarChart3, ExternalLink, LayoutDashboard, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { InkLogo } from '@/components/ink-logo';
import { cn } from '@/lib/utils';

export type View = 'dashboard' | 'my-dashboard';

type NavLink = {
  label: string;
  view?: View;
  href?: string;
  icon: React.ReactNode;
};

const navLinks: NavLink[] = [
  { label: 'InkBoard', view: 'dashboard', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'My Dashboard', view: 'my-dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Ecosystem', href: '/ecosystem', icon: <Globe className="h-4 w-4" /> },
  { label: 'Builders', href: '/builders', icon: <ExternalLink className="h-4 w-4" /> },
];

type HeaderProps = {
  connected: boolean;
  address: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  view: View;
  onViewChange: (v: View) => void;
};

export function Header({ connected, address, onConnect, onDisconnect, view, onViewChange }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (link: NavLink) => {
    if (link.view) onViewChange(link.view);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8 2xl:px-12">
        {/* Mobile: hamburger left */}
        <div className="flex items-center gap-3 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Open menu">
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-r border-border/60 p-0">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <div className="flex h-full flex-col">
                <div className="flex h-16 items-center gap-2 border-b border-border/60 px-6">
                  <InkLogo />
                  <span className="font-display text-lg font-bold tracking-tight">Ink</span>
                </div>
                <nav className="flex flex-1 flex-col gap-1 p-4">
                  {navLinks.map((link) =>
                    link.view ? (
                      <button
                        key={link.label}
                        onClick={() => handleNavClick(link)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors',
                          view === link.view
                            ? 'bg-[#8B5CF6]/15 text-[#C8B5FF]'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        )}
                      >
                        {link.icon}
                        {link.label}
                      </button>
                    ) : (
                      <Link
                        key={link.label}
                        href={link.href!}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        {link.icon}
                        {link.label}
                      </Link>
                    )
                  )}
                </nav>
                {connected && (
                  <div className="border-t border-border/60 p-4">
                    <button
                      onClick={() => {
                        onDisconnect();
                        setMobileOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out 👋
                    </button>
                  </div>
                )}
                <SheetClose className="absolute right-4 top-4" />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Logo — center on mobile, left on desktop */}
        <div className="flex items-center gap-2.5 md:flex-1">
          <InkLogo />
          <span className="font-display text-xl font-bold tracking-tight">Ink</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) =>
            link.view ? (
              <button
                key={link.label}
                onClick={() => onViewChange(link.view as View)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  view === link.view
                    ? 'bg-[#8B5CF6]/15 text-[#C8B5FF]'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                {link.icon}
                {link.label}
              </button>
            ) : (
              <Link
                key={link.label}
                href={link.href!}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {link.icon}
                {link.label}
              </Link>
            )
          )}
        </nav>

        {/* Right: Connect / Avatar */}
        <div className="flex flex-1 items-center justify-end gap-3">
          {connected && address ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onViewChange('my-dashboard')}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-secondary"
                title="View My Dashboard"
              >
                <Avatar className="h-9 w-9 border-2 border-[#8B5CF6]/40">
                  <AvatarFallback className="bg-[#8B5CF6]/15 font-display text-xs font-bold text-[#C8B5FF]">
                    {address.slice(2, 4).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden font-display text-sm font-medium sm:inline">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDisconnect}
                className="hidden h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:flex"
                title="Disconnect Wallet"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={onConnect}
              size="sm"
              className="gap-2 bg-[#7337F2] font-display text-white transition-all hover:scale-105 hover:bg-[#7337F2]/90 active:scale-95"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
