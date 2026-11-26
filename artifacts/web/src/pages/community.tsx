import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { 
  useListMyQuestions, 
  useSubmitQuestion,
  getListMyQuestionsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckSquare, Copy, Flag, Forward, Heart, Info, LockKeyhole, MessageCircle, MessageSquareQuote, Pin, Reply, Search, Send, Star, Trash2, User as UserIcon, UserCircle, Users } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Community() {
  const { user, token, getToken } = useAuth();
  const { anonAlias } = useAppContext();
  const [activeTab, setActiveTab] = useState('friends');
  const [directUserId, setDirectUserId] = useState<number | null>(null);
  const [directSearch, setDirectSearch] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [usersError, setUsersError] = useState('');
  const selectedMember = users.find((member) => member.id === directUserId);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadUsers = async () => {
      try {
        const freshToken = await getToken();
        if (!freshToken) throw new Error('Your session has expired. Sign in again.');
        const response = await fetch('/api/chat/conversations', {
          headers: { Authorization: `Bearer ${freshToken}` },
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || 'Could not load members for direct messages.');
        }
        if (active) {
          setUsers(result.users as ChatUser[]);
          setUsersError('');
        }
      } catch (error) {
        if (active) {
          setUsersError(error instanceof Error ? error.message : 'Could not load members.');
        }
      }
    };
    void loadUsers();
    const intervalId = activeTab === 'direct'
      ? window.setInterval(() => void loadUsers(), 10000)
      : undefined;
    return () => {
      active = false;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [activeTab, getToken, token]);

  const filteredUsers = users.filter((member) =>
    `${member.firstName} ${member.lastName} ${member.username}`
      .toLowerCase()
      .includes(directSearch.trim().toLowerCase()),
  );
  
  return (
    <div className="mx-auto flex h-[100dvh] max-w-6xl flex-col px-0 pt-safe md:h-screen md:p-6">
      <header className="flex flex-shrink-0 items-center gap-3 px-4 py-4 md:px-0">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MessageCircle className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">Connect with your community</p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 px-3 md:px-0">
          <TabsList className="grid h-auto w-full grid-cols-4 rounded-2xl bg-muted/70 p-1">
            <TabsTrigger value="friends" className="gap-2 rounded-xl py-2">
              <UserIcon className="size-4" /> <span>Friends</span>
            </TabsTrigger>
            <TabsTrigger value="direct" className="gap-2 rounded-xl py-2">
              <Users className="size-4" /> <span>Direct</span>
            </TabsTrigger>
            <TabsTrigger value="anonymous" className="gap-2 rounded-xl py-2">
              <UserCircle className="size-4" /> <span>Anonymous</span>
            </TabsTrigger>
            <TabsTrigger value="pastor" className="gap-2 rounded-xl py-2">
              <MessageSquareQuote className="size-4" /> <span>Ask Pastor</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="relative mt-3 min-h-0 flex-1">
          <TabsContent value="friends" className="absolute inset-0 mt-0 data-[state=active]:flex flex-col">
            <ChatRoom room="friends" title="Friends chat" displayName={user?.firstName || 'Friend'} userId={user?.id || 0} users={users} />
          </TabsContent>
          <TabsContent value="direct" className="absolute inset-0 mt-0 data-[state=active]:flex flex-col">
            <div className="grid min-h-0 flex-1 grid-rows-1 overflow-hidden border-y bg-card md:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] md:rounded-2xl md:border">
              <aside className={cn(
                'flex min-h-0 flex-col border-r',
                directUserId !== null && 'hidden md:flex',
              )}>
                <div className="space-y-3 border-b p-4">
                  <div>
                    <h2 className="font-semibold">Direct messages</h2>
                    <p className="text-xs text-muted-foreground">Your conversations</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      value={directSearch}
                      onChange={(event) => setDirectSearch(event.target.value)}
                      placeholder="Search people"
                      aria-label="Search direct messages"
                      className="h-10 rounded-xl bg-muted/50 pl-9"
                    />
                  </div>
                  {usersError && <p role="alert" className="text-xs text-destructive">{usersError}</p>}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {filteredUsers.length ? filteredUsers.map((member) => {
                    const active = directUserId === member.id;
                    const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}` || member.username[0] || '?';
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setDirectUserId(member.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/60',
                          active && 'bg-muted',
                        )}
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {initials.toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">{member.firstName} {member.lastName}</span>
                            {member.lastMessage && (
                              <time className="shrink-0 text-[10px] text-muted-foreground">
                                {new Date(member.lastMessage.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </time>
                            )}
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {member.lastMessage?.content ?? `@${member.username}`}
                          </span>
                        </span>
                      </button>
                    );
                  }) : (
                    <p className="p-5 text-center text-sm text-muted-foreground">
                      {users.length ? 'No people match your search.' : 'No other members are available yet.'}
                    </p>
                  )}
                </div>
              </aside>
              <section className={cn(
                'flex min-h-0 min-w-0 flex-col',
                directUserId === null && 'hidden md:flex',
              )}>
                {directUserId !== null ? (
                  <ChatRoom
                    key={`dm-${directUserId}`}
                    room="direct"
                    title={selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'Direct message'}
                    otherUserId={directUserId}
                    displayName={user?.firstName || 'Friend'}
                    userId={user?.id || 0}
                    users={users}
                    onBack={() => setDirectUserId(null)}
                  />
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MessageCircle className="size-6" aria-hidden="true" />
                    </span>
                    <p className="font-medium">Choose a conversation</p>
                    <p className="max-w-xs text-sm text-muted-foreground">Select a member to start or continue a private conversation.</p>
                  </div>
                )}
              </section>
            </div>
          </TabsContent>
          <TabsContent value="anonymous" className="absolute inset-0 mt-0 data-[state=active]:flex flex-col">
            <ChatRoom room="anonymous" title="Anonymous chat" displayName={anonAlias} userId={user?.id || 0} users={users} />
          </TabsContent>
          <TabsContent value="pastor" className="absolute inset-0 mt-0 data-[state=active]:flex flex-col">
            <AskPastor />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

type ChatUser = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  lastMessage: {
    userId: number;
    displayName: string;
    content: string;
    createdAt: string;
  } | null;
};
type ChatMessage = {
  id: number;
  room: string;
  userId: number;
  displayName: string;
  content: string;
  replyToId: number | null;
  replyTo: { displayName: string; content: string } | null;
  createdAt: string;
  isStarred: boolean;
  isPinned: boolean;
  isPinnedByMe: boolean;
};

function ChatRoom({
  room,
  title,
  otherUserId,
  displayName,
  userId,
  users,
  onBack,
}: {
  room: 'friends' | 'anonymous' | 'direct';
  title: string;
  otherUserId?: number;
  displayName: string;
  userId: number;
  users: ChatUser[];
  onBack?: () => void;
}) {
  const { token, getToken } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwardMessages, setForwardMessages] = useState<ChatMessage[]>([]);
  const [forwardToUserId, setForwardToUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [actionsMessageId, setActionsMessageId] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const conversationPath = room === 'direct' ? `/api/chat/dm/${otherUserId}` : `/api/chat/${room}`;

  useEffect(() => {
    if (!token || (room === 'direct' && !otherUserId)) return;
    let active = true;
    const loadMessages = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Your session has expired. Sign in again.');
        const response = await fetch(conversationPath, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Could not load messages.');
        if (active) {
          setMessages(result.messages as ChatMessage[]);
          setLoadError('');
          setIsLoading(false);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Could not load messages.');
          setIsLoading(false);
        }
      }
    };
    setIsLoading(true);
    void loadMessages();
    const intervalId = window.setInterval(loadMessages, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [conversationPath, getToken, otherUserId, room, token]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const sendMessage = async (content: string, replyToId: number | null = null, targetUserId = otherUserId) => {
    const token = await getToken();
    if (!token) throw new Error('Your session has expired. Sign in again.');
    if (room === 'direct' && !targetUserId) {
      throw new Error('Choose a member before sending a direct message.');
    }
    const path = room === 'direct' ? `/api/chat/dm/${targetUserId}` : `/api/chat/${room}`;
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content, displayName, replyToId }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Could not send message.');
    const sentMessage = result.message as ChatMessage;
    if (room !== 'direct' || targetUserId === otherUserId) {
      setMessages((current) => current.some((item) => item.id === sentMessage.id)
        ? current
        : [...current, sentMessage]);
    }
    return sentMessage;
  };

  const requestMessageAction = async (
    messageId: number,
    action: string,
    method: 'POST' | 'DELETE' = 'POST',
    body?: Record<string, unknown>,
  ) => {
    const token = await getToken();
    if (!token) throw new Error('Your session has expired. Sign in again.');
    const response = await fetch(`/api/chat/messages/${messageId}/${action}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(result?.detail || 'Could not update this message.');
    return result;
  };

  const toggleStar = async (msg: ChatMessage) => {
    try {
      const result = await requestMessageAction(msg.id, 'star', 'POST', { starred: !msg.isStarred });
      setMessages((current) => current.map((item) => item.id === msg.id
        ? { ...item, isStarred: result.isStarred }
        : item));
      toast({ description: result.isStarred ? 'Message saved to your stars.' : 'Message removed from your stars.' });
    } catch (error) {
      toast({
        title: 'Could not update starred message',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const pinMessage = async (msg: ChatMessage, visibility: 'me' | 'everyone') => {
    try {
      await requestMessageAction(msg.id, 'pin', 'POST', { visibility });
      setMessages((current) => current.map((item) => item.id === msg.id
        ? { ...item, isPinned: true, isPinnedByMe: true }
        : item));
      toast({ description: visibility === 'everyone' ? 'Pinned for everyone in this conversation.' : 'Pinned just for you.' });
    } catch (error) {
      toast({
        title: 'Could not pin message',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const unpinMessage = async (msg: ChatMessage) => {
    try {
      await requestMessageAction(msg.id, 'pin', 'DELETE');
      setMessages((current) => current.map((item) => item.id === msg.id
        ? { ...item, isPinnedByMe: false, isPinned: item.isPinned && !item.isPinnedByMe }
        : item));
      toast({ description: 'Your pin was removed.' });
    } catch (error) {
      toast({
        title: 'Could not unpin message',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const reportMessage = async (msg: ChatMessage) => {
    const reason = window.prompt('Tell the moderators why you are reporting this message.');
    if (!reason?.trim()) return;
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(`/api/chat/messages/${msg.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Could not send this report.');
      toast({ description: 'Your report was sent to the moderators for review.' });
    } catch (error) {
      toast({
        title: 'Could not report message',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const deleteMessages = async (messageIds: number[]) => {
    const ownedIds = messageIds.filter((id) => messages.some((item) => item.id === id && item.userId === userId));
    if (!ownedIds.length) {
      toast({ title: 'No selected messages can be deleted', description: 'You can only delete messages you sent.' });
      return;
    }
    if (!window.confirm(`Delete ${ownedIds.length} message${ownedIds.length === 1 ? '' : 's'}?`)) return;
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      for (const id of ownedIds) {
        const response = await fetch(`/api/chat/messages/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.detail || 'Could not delete a selected message.');
        }
      }
      setMessages((current) => current.filter((item) => !ownedIds.includes(item.id)));
      setSelectedMessageIds([]);
      setSelectionMode(false);
      setSelectedMessageId(null);
      toast({ description: `${ownedIds.length} message${ownedIds.length === 1 ? '' : 's'} deleted.` });
    } catch (error) {
      toast({
        title: 'Could not delete selected messages',
        description: error instanceof Error ? error.message : 'Some messages may not have been deleted.',
        variant: 'destructive',
      });
    }
  };

  const toggleMultiSelection = (msg: ChatMessage) => {
    setSelectedMessageIds((current) => current.includes(msg.id)
      ? current.filter((id) => id !== msg.id)
      : [...current, msg.id]);
  };

  const startForwarding = (selected: ChatMessage[]) => {
    setForwardMessages(selected);
    setForwardToUserId(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSending(true);
    try {
      await sendMessage(message.trim(), replyTo?.id ?? null);
      setMessage('');
      setReplyTo(null);
    } catch (error) {
      toast({
        title: 'Could not send message',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="flex h-full flex-1 flex-col overflow-hidden rounded-none border-x-0 bg-card shadow-none md:rounded-2xl md:border-x md:shadow-sm">
      <div className="flex flex-shrink-0 items-center gap-3 border-b px-4 py-3">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 md:hidden"
            aria-label="Back to conversations"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
        )}
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {room === 'anonymous' ? <UserCircle className="size-5" aria-hidden="true" /> : <Users className="size-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{room === 'direct' ? 'One-to-one conversation' : 'Community conversation'}</p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
          <LockKeyhole className="size-3.5" aria-hidden="true" /> Signed-in member
        </span>
      </div>
      <div className={cn(
        'flex-1 space-y-4 overflow-y-auto p-4',
        room === 'direct' ? 'bg-[#efeae2] dark:bg-slate-950' : 'bg-muted/15',
      )} ref={scrollRef} aria-live="polite">
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center p-4 text-muted-foreground"><div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading messages" /></div>
        ) : loadError && messages.length === 0 ? (
          <p role="alert" className="text-center py-8 text-sm text-destructive">{loadError}</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <span className="flex size-12 items-center justify-center rounded-full bg-background text-primary shadow-sm">
              <MessageCircle className="size-5" aria-hidden="true" />
            </span>
            <p className="font-medium text-foreground">A new conversation</p>
            <p className="text-sm">Send a message to get things started.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === userId;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex max-w-[88%] flex-col rounded-2xl transition-colors sm:max-w-[75%]",
                  isMe ? "ml-auto items-end" : "mr-auto items-start",
                  (selectionMode ? selectedMessageIds.includes(msg.id) : selectedMessageId === msg.id) && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
                )}
                onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
                onTouchEnd={(event) => {
                  const endX = event.changedTouches[0]?.clientX;
                  if (touchStartX.current !== null && endX !== undefined && Math.abs(endX - touchStartX.current) > 55) {
                    setReplyTo(msg);
                  }
                  touchStartX.current = null;
                }}
              >
                {(!isMe || room !== 'direct') && <span className="mb-1 px-2 text-[11px] font-medium text-muted-foreground">{msg.displayName}</span>}
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectionMode ? selectedMessageIds.includes(msg.id) : selectedMessageId === msg.id}
                  aria-label={`${selectionMode ? 'Toggle selection for' : 'Select'} message from ${msg.displayName}`}
                  onClick={() => {
                    if (selectionMode) {
                      toggleMultiSelection(msg);
                      return;
                    }
                    setSelectedMessageId((current) => current === msg.id ? null : msg.id);
                    setActionsMessageId(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (selectionMode) {
                        toggleMultiSelection(msg);
                        return;
                      }
                      setSelectedMessageId((current) => current === msg.id ? null : msg.id);
                      setActionsMessageId(null);
                    }
                  }}
                  className={cn(
                  "whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                  isMe
                    ? room === 'direct'
                      ? "rounded-tr-sm bg-[#d9fdd3] text-[#111b21] dark:bg-emerald-900 dark:text-emerald-50"
                      : "rounded-tr-sm bg-primary text-primary-foreground"
                    : room === 'direct'
                      ? "rounded-tl-sm border-0 bg-white text-[#111b21] dark:bg-slate-800 dark:text-slate-50"
                      : "rounded-tl-sm border bg-card"
                )}>
                  {msg.replyTo && (
                    <div className="mb-2 border-l-2 border-current/40 pl-2 text-xs opacity-80">
                      <p>{msg.replyTo.displayName}</p>
                      <p className="line-clamp-2">{msg.replyTo.content}</p>
                    </div>
                  )}
                  {msg.content}
                </div>
                <time dateTime={msg.createdAt} className="mt-1 px-2 text-[10px] text-muted-foreground">
                  {Number.isNaN(new Date(msg.createdAt).getTime())
                    ? ''
                    : new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </time>
                {(msg.isPinned || msg.isStarred) && (
                  <div className="mt-1 flex gap-2 px-1 text-muted-foreground" aria-label="Message saved or pinned">
                    {msg.isPinned && <Pin className="h-3.5 w-3.5" aria-label="Pinned" />}
                    {msg.isStarred && <Star className="h-3.5 w-3.5 fill-current" aria-label="Starred privately" />}
                  </div>
                )}
                {selectedMessageId === msg.id && (
                  <DropdownMenu open={actionsMessageId === msg.id} onOpenChange={(open) => setActionsMessageId(open ? msg.id : null)}>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Message information and actions" title="Message information and actions">
                        <Info className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isMe ? 'end' : 'start'}>
                      <DropdownMenuItem onSelect={() => setReplyTo(msg)}><Reply /> Reply</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => {
                        void navigator.clipboard.writeText(msg.content)
                          .then(() => toast({ description: 'Message copied.' }))
                          .catch(() => toast({ title: 'Could not copy message', description: 'Clipboard access was denied.', variant: 'destructive' }));
                      }}><Copy /> Copy</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => startForwarding([msg])}><Forward /> Forward</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger><Pin /> Pin</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onSelect={() => void pinMessage(msg, 'everyone')}>Pin for everyone</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void pinMessage(msg, 'me')}>Pin for me</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      {msg.isPinnedByMe && <DropdownMenuItem onSelect={() => void unpinMessage(msg)}><Pin /> Unpin</DropdownMenuItem>}
                      <DropdownMenuItem onSelect={() => void toggleStar(msg)}>
                        {msg.isStarred ? <Heart className="fill-current" /> : <Star />}
                        {msg.isStarred ? 'Remove star' : 'Star privately'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => {
                        setSelectionMode(true);
                        setSelectedMessageIds([msg.id]);
                        setSelectedMessageId(null);
                      }}><CheckSquare /> Select</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void reportMessage(msg)}><Flag /> Report</DropdownMenuItem>
                      {isMe && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void deleteMessages([msg.id])}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })
        )}
        {loadError && messages.length > 0 && (
          <p role="status" className="text-center text-xs text-muted-foreground">
            Could not refresh messages. Retrying automatically.
          </p>
        )}
      </div>
      <div className="mt-auto flex-shrink-0 border-t bg-card p-3 sm:p-4">
        {selectionMode && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md bg-muted p-2 text-sm">
            <span className="mr-auto">{selectedMessageIds.length} selected</span>
            <Button type="button" size="sm" variant="outline" disabled={!selectedMessageIds.length} onClick={() => startForwarding(messages.filter((item) => selectedMessageIds.includes(item.id)))}>
              <Forward className="mr-1 h-4 w-4" /> Forward
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={!selectedMessageIds.some((id) => messages.some((item) => item.id === id && item.userId === userId))} onClick={() => void deleteMessages(selectedMessageIds)}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete mine
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => {
              setSelectionMode(false);
              setSelectedMessageIds([]);
            }}>Done</Button>
          </div>
        )}
        {replyTo && (
          <div className="mb-2 flex items-start justify-between rounded-md bg-muted p-2 text-xs">
            <div><p className="font-medium">Replying to {replyTo.displayName}</p><p className="line-clamp-1">{replyTo.content}</p></div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)}>Cancel</Button>
          </div>
        )}
        {forwardMessages.length > 0 && (
          <div className="mb-2 space-y-2 rounded-md bg-muted p-2 text-xs">
            <p>Forwarding {forwardMessages.length} message{forwardMessages.length === 1 ? '' : 's'}:</p>
            <p className="line-clamp-2">{forwardMessages.slice(0, 3).map((item) => `${item.displayName}: ${item.content}`).join(' · ')}</p>
            <div className="flex gap-2">
              <select
                aria-label="Forward to member"
                value={forwardToUserId ?? ''}
                onChange={(event) => setForwardToUserId(event.target.value ? Number(event.target.value) : null)}
                className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1"
              >
                <option value="">Choose a member</option>
                {users.map((member) => (
                  <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>
                ))}
              </select>
              <Button type="button" size="sm" disabled={!forwardToUserId} onClick={() => {
                if (!forwardToUserId) return;
                const forwarded = forwardMessages.map((item) => `Forwarded from ${item.displayName}: ${item.content}`).join('\n\n');
                void sendMessage(forwarded, null, forwardToUserId)
                  .then(() => {
                    toast({ description: 'Message forwarded.' });
                    setForwardMessages([]);
                    setForwardToUserId(null);
                    setSelectionMode(false);
                    setSelectedMessageIds([]);
                  })
                  .catch((error: unknown) => toast({
                    title: 'Could not forward message',
                    description: error instanceof Error ? error.message : 'Please try again.',
                    variant: 'destructive',
                  }));
              }}>Forward</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setForwardMessages([])}>Cancel</Button>
            </div>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <Input 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={room === 'direct' ? 'Message privately…' : 'Type a message...'}
            aria-label="Write a message"
            className="h-11 flex-1 rounded-full border-transparent bg-muted/60 px-4 focus-visible:ring-1"
          />
          <Button type="submit" size="icon" aria-label="Send message" disabled={!message.trim() || isSending} className="size-11 flex-shrink-0 rounded-full shadow-sm">
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}

function AskPastor() {
  const [question, setQuestion] = useState('');
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMyQuestions();
  const submitQ = useSubmitQuestion();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    submitQ.mutate(
      { data: { content: question } },
      {
        onSuccess: () => {
          setQuestion('');
          queryClient.invalidateQueries({ queryKey: getListMyQuestionsQueryKey() });
        }
      }
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-0 md:pt-4 space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 md:p-6">
          <h2 className="font-serif text-lg text-primary mb-2">Ask a Question</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Have a question about faith, the Bible, or life? Ask here. Only the pastoral team will see who asked.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea 
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What's on your mind?"
              className="resize-none bg-background"
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!question.trim() || submitQ.isPending}>
                Submit Question
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Your Questions</h3>
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-muted rounded-xl"></div>
          </div>
        ) : data?.questions?.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">You haven't asked any questions yet.</p>
        ) : (
          data?.questions?.map((q) => (
            <Card key={q.id} className="overflow-hidden">
              <div className="p-4 bg-muted/30">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-1 rounded">Ticket: {q.ticketCode}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(q.createdAt)}</span>
                </div>
                <p className="font-medium text-sm">{q.content}</p>
              </div>
              {q.answer ? (
                <div className="p-4 border-t border-secondary/20 bg-secondary/5">
                  <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Pastoral Response</p>
                  <p className="text-sm">{q.answer}</p>
                </div>
              ) : (
                <div className="p-3 border-t bg-card text-xs text-muted-foreground flex items-center justify-center italic">
                  Awaiting response...
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
