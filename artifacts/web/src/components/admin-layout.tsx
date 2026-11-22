import { Link, useLocation } from 'wouter';
import {
  BookOpen,
  CalendarDays,
  FileText,
  Flag,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Music2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/devotions', label: 'Devotions', icon: FileText },
  { href: '/admin/study-guides', label: 'Quarterly & study plans', icon: BookOpen },
  { href: '/admin/events', label: 'Events', icon: CalendarDays },
  { href: '/admin/questions', label: 'Pastoral Q&A', icon: MessageSquareText },
  { href: '/admin/music', label: 'Music', icon: Music2 },
  { href: '/admin/chat-reports', label: 'Chat reports', icon: Flag },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();

  const navigation = (
    <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-3">
      {adminLinks.map(({ href, label, icon: Icon }) => {
        const active = location === href || (href !== '/admin' && location.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors md:w-full',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-background md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card md:flex">
        <div className="border-b px-5 py-5">
          <p className="font-semibold tracking-tight">Youth Connect</p>
          <p className="mt-1 text-xs text-muted-foreground">Administration workspace</p>
        </div>
        <div className="flex-1 overflow-y-auto">{navigation}</div>
        <div className="border-t p-3">
          <Button type="button" variant="ghost" className="w-full justify-start gap-3" onClick={logout}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-semibold">Admin workspace</p>
            <p className="text-xs text-muted-foreground">Youth Connect</p>
          </div>
          <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={logout}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
        {navigation}
      </header>

      <main className="min-w-0 pb-8">{children}</main>
    </div>
  );
}
