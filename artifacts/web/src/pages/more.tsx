import { Link } from 'wouter';
import { Music, BookOpen, Calendar, User, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function More() {
  const links = [
    { href: '/music', label: 'Worship Music', icon: Music, color: 'text-purple-500', desc: 'Listen to classic hymns' },
    { href: '/reading-plans', label: 'Reading Plans', icon: BookOpen, color: 'text-orange-500', desc: 'Bible study tracks' },
    { href: '/events', label: 'Events', icon: Calendar, color: 'text-blue-500', desc: 'Upcoming youth gatherings' },
    { href: '/profile', label: 'My Profile', icon: User, color: 'text-green-500', desc: 'Manage your account' },
    { href: '/settings', label: 'Settings', icon: Settings, color: 'text-slate-500', desc: 'Personalize your experience' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif text-primary mb-6">More</h1>
      
      <div className="grid gap-4 md:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover-elevate cursor-pointer hover:border-primary/30 transition-all group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-muted group-hover:bg-background shadow-sm transition-colors`}>
                  <link.icon className={`w-6 h-6 ${link.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{link.label}</h3>
                  <p className="text-sm text-muted-foreground">{link.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
