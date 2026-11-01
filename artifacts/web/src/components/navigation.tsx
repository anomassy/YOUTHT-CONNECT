import { Link, useLocation } from 'wouter';
import { Home, BookOpen, Heart, MessageCircle, MoreHorizontal, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

export function Navigation() {
  const [location] = useLocation();
  const { navigationLayout, mobileNavigation } = useSettings();

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/devotion', label: 'Devotion', icon: BookOpen },
    { href: '/prayer', label: 'Prayer', icon: Heart },
    { href: '/community', label: 'Community', icon: MessageCircle },
    { href: '/more', label: 'More', icon: MoreHorizontal },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden md:flex flex-col fixed inset-y-0 left-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40 transition-[width] duration-200',
        navigationLayout === 'compact' ? 'w-20' : 'w-64',
      )}>
        <div className="p-6">
          <h1 className={cn('font-bold tracking-tight text-sidebar-primary', navigationLayout === 'compact' ? 'text-center text-sm' : 'text-xl')}>{navigationLayout === 'compact' ? 'YC' : 'Youth Connect'}</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                navigationLayout === 'compact' && 'justify-center px-2',
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}>
                <item.icon className="w-5 h-5" />
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
              'flex items-center gap-3 rounded-md px-4 py-3 transition-colors',
              location === '/settings'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              navigationLayout === 'compact' && 'justify-center px-2',
            )}
          >
            <Settings className="size-5 shrink-0" />
            <span className={cn(navigationLayout === 'compact' && 'sr-only')}>Settings</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-40 pb-safe">
        <div className={cn('flex justify-around items-center h-16', mobileNavigation === 'compact' && 'h-14')}>
          {[...navItems, { href: '/settings', label: 'Settings', icon: Settings }].map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn(
                "mobile-nav-item flex flex-col items-center justify-center w-full h-full space-y-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                <item.icon className={cn("mobile-nav-icon w-5 h-5", isActive && "fill-primary/20")} />
                <span className="mobile-nav-label text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
