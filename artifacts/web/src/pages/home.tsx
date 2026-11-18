import { useAuth } from '@/context/AuthContext';
import { useDevotionalStreak } from '@/hooks/use-streak';
import { useListDevotionals, useListEvents } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Flame, Calendar, BookOpen, Music, Users, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

export default function Home() {
  const { user } = useAuth();
  const { streak } = useDevotionalStreak(user?.id);
  
  const { data: devotionsData } = useListDevotionals();
  const { data: eventsData } = useListEvents();

  const todayDevotional = devotionsData?.devotionals?.[0];
  const upcomingEvents = eventsData?.events?.filter(e => new Date(e.startsAt) >= new Date()).slice(0, 2);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Section */}
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-primary">
            Good to see you, {user?.firstName}.
          </h1>
          <p className="text-muted-foreground mt-1">
            "This is the day that the Lord has made; let us rejoice and be glad in it."
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-center justify-center bg-secondary/10 px-4 py-2 rounded-xl border border-secondary/20">
          <Flame className="w-6 h-6 text-secondary mb-1" />
          <span className="font-bold text-lg leading-none">{streak}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Streak</span>
        </div>
      </section>

      {/* Streak Mobile */}
      <div className="sm:hidden flex items-center gap-3 bg-secondary/10 px-4 py-3 rounded-xl border border-secondary/20">
        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
          <Flame className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <p className="font-bold text-lg leading-none text-foreground">{streak} Day Streak</p>
          <p className="text-xs text-muted-foreground">Keep reading your daily devotions!</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Daily Devotional Card */}
          <Link href="/devotion">
            <Card className="hover-elevate cursor-pointer border-primary/20 bg-gradient-to-br from-card to-primary/5 transition-colors group">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Today's Word</span>
                </div>
                <CardTitle className="text-2xl font-serif group-hover:text-primary transition-colors">
                  {todayDevotional ? todayDevotional.title : "Loading today's reading..."}
                </CardTitle>
                {todayDevotional && (
                  <CardDescription className="text-secondary font-medium">
                    {todayDevotional.scriptureRef}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground line-clamp-3">
                  {todayDevotional ? todayDevotional.body : "A moment to connect with God's word and center your day."}
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { href: '/prayer', label: 'Prayer Wall', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { href: '/community', label: 'Chat', icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-500/10' },
              { href: '/music', label: 'Worship', icon: Music, color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { href: '/reading-plans', label: 'Sabbath School', icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            ].map((action) => (
              <Link key={action.label} href={action.href}>
                <Card className="hover-elevate cursor-pointer text-center py-6 h-full transition-colors hover:border-primary/30">
                  <div className={`w-12 h-12 mx-auto rounded-full ${action.bg} flex items-center justify-center mb-3`}>
                    <action.icon className={`w-6 h-6 ${action.color}`} />
                  </div>
                  <h3 className="font-medium text-sm">{action.label}</h3>
                </Card>
              </Link>
            ))}
          </div>

        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Upcoming Events
                </CardTitle>
                <Link href="/events" className="text-sm text-primary hover:underline font-medium">
                  See all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingEvents?.length ? (
                upcomingEvents.map(event => (
                  <div key={event.id} className="group relative border-l-2 border-transparent hover:border-secondary pl-3 transition-colors -ml-3">
                    <p className="text-sm font-semibold">{event.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(event.startsAt)} • {event.location || 'TBA'}
                    </p>
                    <Link href="/events" className="absolute inset-0" />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming events this week.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
