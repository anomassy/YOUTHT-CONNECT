import { useAppContext } from '@/context/AppContext';
import { Link, useLocation } from 'wouter';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, MessageSquareQuote, Music2, BookOpen, Flag } from 'lucide-react';

export default function AdminIndex() {
  const { isAdmin } = useAppContext();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAdmin) setLocation('/login');
  }, [isAdmin, setLocation]);

  if (!isAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const sections = [
    { href: '/admin/devotions', label: 'Manage Devotionals', icon: FileText, desc: 'Create and delete daily readings' },
    { href: '/admin/events', label: 'Manage Events', icon: Calendar, desc: 'Schedule new youth gatherings' },
    { href: '/admin/questions', label: 'Answer Questions', icon: MessageSquareQuote, desc: 'Respond to anonymous user questions' },
    { href: '/admin/chat-reports', label: 'Chat reports', icon: Flag, desc: 'Review reports submitted on chat messages' },
    { href: '/admin/music', label: 'Manage Music', icon: Music2, desc: 'Upload worship music and audio files' },
    { href: '/admin/study-guides', label: 'Study Guides', icon: BookOpen, desc: 'Create reading plans and verse guides' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-serif text-primary">Admin Dashboard</h1>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map(section => (
          <Card key={section.href} className="hover-elevate border-border">
            <CardContent className="p-6">
              <section.icon className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-semibold text-lg mb-2">{section.label}</h3>
              <p className="text-sm text-muted-foreground mb-4">{section.desc}</p>
              <Button asChild variant="outline" className="w-full">
                <Link href={section.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
