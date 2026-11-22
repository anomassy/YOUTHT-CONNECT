import { Link, useLocation } from 'wouter';
import {
  BookOpen,
  CalendarDays,
  Church,
  Heart,
  Home,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

export function Navigation() {
  const [location] = useLocation();
  const { navigationLayout } = useSettings();

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/devotion', label: 'Devotion', icon: BookOpen },
    { href: '/prayer', label: 'Prayer', icon: Heart },
    { href: '/community', label: 'Community', icon: MessageCircle },
    { href: '/music', label: 'Worship music', icon: Music2 },
    { href: '/events', label: 'Events', icon: CalendarDays },
    { href: '/reading-plans', label: 'Study guides', icon: BookOpen },
    { href: '/more', label: 'More', icon: MoreHorizontal },
  ];

  const mobileNavItems = navItems.filter(({ href }) =>
    ['/', '/devotion', '/prayer', '/community', '/music', '/more'].includes(href),
  );

  return (
    <>
      <aside className={cn(
        'hidden md:flex flex-col fixed inset-y-0 left-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40 transition-[width] duration-200',
        navigationLayout === 'compact' ? 'w-20' : 'w-64',
      )}>
        <div className={cn('flex items-center gap-3 px-5 py-6', navigationLayout === 'compact' && 'justify-center px-3')}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Church className="size-5" aria-hidden="true" />
          </span>
          <div className={cn('min-w-0', navigationLayout === 'compact' && 'sr-only')}>
            <p className="truncate font-semibold tracking-tight">Youth Connect</p>
            <p className="mt-0.5 text-xs text-sidebar-foreground/60">Faith. Friends. Fellowship.</p>
          </div>
        </div>
        
        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors',
                navigationLayout === 'compact' && 'justify-center px-2',
                isActive 
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )}>
                <item.icon className="size-5 shrink-0" aria-hidden="true" />
                <span className={cn(navigationLayout === 'compact' && 'sr-only')}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Link
            href="/settings"
            aria-current={location === '/settings' ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors',
              location === '/settings'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              navigationLayout === 'compact' && 'justify-center px-2',
            )}
          >
            <Settings className="size-5 shrink-0" />
            <span className={cn(navigationLayout === 'compact' && 'sr-only')}>Settings</span>
          </Link>
        </div>
      </aside>

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-safe backdrop-blur md:hidden">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-around px-1">
          {mobileNavItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'mobile-nav-item flex h-full w-full flex-col items-center justify-center gap-1',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className={cn('mobile-nav-icon size-5', isActive && 'fill-primary/10')} aria-hidden="true" />
                <span className="mobile-nav-label text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
