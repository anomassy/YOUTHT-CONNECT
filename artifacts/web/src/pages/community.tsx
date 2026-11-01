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
import { Copy, Forward, Info, MessageSquareQuote, Reply, Send, Trash2, User as UserIcon, UserCircle, Users } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function Community() {
  const { user, token, getToken } = useAuth();
  const { anonAlias } = useAppContext();
  const [activeTab, setActiveTab] = useState('friends');
  const [directUserId, setDirectUserId] = useState<number | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [usersError, setUsersError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadUsers = async () => {
      try {
        const freshToken = await getToken();
        if (!freshToken) throw new Error('Your session has expired. Sign in again.');
        const response = await fetch('/api/chat/users', {
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
    return () => { active = false; };
  }, [getToken, token]);
  
  return (
    <div className="h-[100dvh] md:h-screen flex flex-col md:p-6 max-w-5xl mx-auto pt-safe">
      <div className="px-4 py-4 md:px-0 flex-shrink-0">
        <h1 className="text-2xl font-serif text-primary">Community</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 md:px-0 flex-shrink-0">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="friends" className="gap-2">
              <UserIcon className="w-4 h-4 hidden sm:block" /> Friends
            </TabsTrigger>
            <TabsTrigger value="direct" className="gap-2">
              <Users className="w-4 h-4 hidden sm:block" /> Direct
            </TabsTrigger>
            <TabsTrigger value="anonymous" className="gap-2">
              <UserCircle className="w-4 h-4 hidden sm:block" /> Anonymous
            </TabsTrigger>
            <TabsTrigger value="pastor" className="gap-2">
              <MessageSquareQuote className="w-4 h-4 hidden sm:block" /> Ask Pastor
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 relative mt-4">
          <TabsContent value="friends" className="absolute inset-0 mt-0 data-[state=active]:flex flex-col">
            <ChatRoom room="friends" displayName={user?.firstName || 'Friend'} userId={user?.id || 0} users={users} />
          </TabsContent>
          <TabsContent value="direct" className="absolute inset-0 mt-0 data-[state=active]:flex flex-col">
            <div className="px-4 pb-3">
              <label htmlFor="direct-message-user" className="sr-only">Choose a member</label>
              <select
                id="direct-message-user"
                value={directUserId ?? ''}
                onChange={(event) => setDirectUserId(event.target.value ? Number(event.target.value) : null)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Choose a member to message</option>
                {users.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName} (@{member.username})
                  </option>
                ))}
              </select>
              {usersError && <p className="mt-2 text-sm text-destructive">{usersError}</p>}
            </div>
            {directUserId ? (
              <ChatRoom
                key={`dm-${directUserId}`}
                room="direct"
                otherUserId={directUserId}
                displayName={user?.firstName || 'Friend'}
                userId={user?.id || 0}
                users={users}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a member to start a private conversation.
              </div>
            )}
          </TabsContent>
          <TabsContent value="anonymous" className="absolute inset-0 mt-0 data-[state=active]:flex flex-col">
            <ChatRoom room="anonymous" displayName={anonAlias} userId={user?.id || 0} users={users} />
          </TabsContent>
          <TabsContent value="pastor" className="absolute inset-0 mt-0 data-[state=active]:flex flex-col">
            <AskPastor />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

type ChatUser = { id: number; firstName: string; lastName: string; username: string };
type ChatMessage = {
  id: number;
  room: string;
  userId: number;
  displayName: string;
  content: string;
  replyToId: number | null;
  replyTo: { displayName: string; content: string } | null;
  createdAt: string;
};

function ChatRoom({
  room,
  otherUserId,
  displayName,
  userId,
  users,
}: {
  room: 'friends' | 'anonymous' | 'direct';
  otherUserId?: number;
  displayName: string;
  userId: number;
  users: ChatUser[];
}) {
  const { token, getToken } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [forwardToUserId, setForwardToUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [actionsMessageId, setActionsMessageId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
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
    if (room === 'direct' && targetUserId === otherUserId) {
      setMessages((current) => [...current, result.message as ChatMessage]);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    try {
      await sendMessage(message.trim(), replyTo?.id ?? null);
      if (room !== 'direct') {
        const token = await getToken();
        if (!token) throw new Error('Your session has expired. Sign in again.');
        const response = await fetch(conversationPath, { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Message sent but refresh failed.');
        setMessages(result.messages as ChatMessage[]);
      }
      setMessage('');
      setReplyTo(null);
    } catch (error) {
      toast({
        title: 'Could not send message',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="flex-1 flex flex-col h-full rounded-none border-x-0 md:rounded-xl md:border-x shadow-none md:shadow-sm overflow-hidden bg-card">
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {isLoading ? (
          <div className="flex justify-center p-4 text-muted-foreground"><div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"/></div>
        ) : loadError ? (
          <p role="alert" className="text-center py-8 text-sm text-destructive">{loadError}</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground h-full flex items-center justify-center">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === userId;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%] rounded-lg transition-colors",
                  isMe ? "ml-auto items-end" : "mr-auto items-start",
                  selectedMessageId === msg.id && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
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
                <span className="text-[10px] text-muted-foreground mb-1 px-1">{msg.displayName}</span>
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedMessageId === msg.id}
                  aria-label={`Select message from ${msg.displayName}`}
                  onClick={() => {
                    setSelectedMessageId((current) => current === msg.id ? null : msg.id);
                    setActionsMessageId(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedMessageId((current) => current === msg.id ? null : msg.id);
                      setActionsMessageId(null);
                    }
                  }}
                  className={cn(
                  "px-4 py-2 rounded-2xl text-sm",
                  isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"
                )}>
                  {msg.replyTo && (
                    <div className="mb-2 border-l-2 border-current/40 pl-2 text-xs opacity-80">
                      <p>{msg.replyTo.displayName}</p>
                      <p className="line-clamp-2">{msg.replyTo.content}</p>
                    </div>
                  )}
                  {msg.content}
                </div>
                {selectedMessageId === msg.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Message information and actions"
                    title="Message information and actions"
                    aria-expanded={actionsMessageId === msg.id}
                    onClick={() => setActionsMessageId((current) => current === msg.id ? null : msg.id)}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                )}
                <div className={cn(
                  "mt-1 flex gap-1",
                  selectedMessageId === msg.id && actionsMessageId === msg.id ? "flex" : "hidden",
                )}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Reply" aria-label="Reply" onClick={() => setReplyTo(msg)}>
                    <Reply className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Copy" aria-label="Copy" onClick={() => {
                    void navigator.clipboard.writeText(msg.content)
                      .then(() => toast({ description: 'Message copied.' }))
                      .catch(() => toast({ title: 'Could not copy message', description: 'Clipboard access was denied.', variant: 'destructive' }));
                  }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Forward" aria-label="Forward" onClick={() => {
                    setForwardMessage(msg);
                    setForwardToUserId(null);
                  }}>
                    <Forward className="h-3.5 w-3.5" />
                  </Button>
                  {isMe && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete message" aria-label="Delete message" onClick={() => {
                      if (!window.confirm('Delete this message?')) return;
                      void (async () => {
                        const token = await getToken();
                        if (!token) throw new Error('Your session has expired. Sign in again.');
                        const response = await fetch(`/api/chat/messages/${msg.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (!response.ok) throw new Error('Could not delete this message.');
                        setMessages((current) => current.filter((item) => item.id !== msg.id));
                      })().catch((error: unknown) => toast({
                        title: 'Could not delete message',
                        description: error instanceof Error ? error.message : 'Please try again.',
                        variant: 'destructive',
                      }));
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="p-3 border-t bg-card mt-auto flex-shrink-0">
        {replyTo && (
          <div className="mb-2 flex items-start justify-between rounded-md bg-muted p-2 text-xs">
            <div><p className="font-medium">Replying to {replyTo.displayName}</p><p className="line-clamp-1">{replyTo.content}</p></div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)}>Cancel</Button>
          </div>
        )}
        {forwardMessage && (
          <div className="mb-2 space-y-2 rounded-md bg-muted p-2 text-xs">
            <p className="line-clamp-2">Forwarding: {forwardMessage.content}</p>
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
                void sendMessage(`Forwarded from ${forwardMessage.displayName}: ${forwardMessage.content}`, null, forwardToUserId)
                  .then(() => {
                    toast({ description: 'Message forwarded.' });
                    setForwardMessage(null);
                    setForwardToUserId(null);
                  })
                  .catch((error: unknown) => toast({
                    title: 'Could not forward message',
                    description: error instanceof Error ? error.message : 'Please try again.',
                    variant: 'destructive',
                  }));
              }}>Forward</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setForwardMessage(null)}>Cancel</Button>
            </div>
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-2">
          <Input 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={room === 'direct' ? 'Message privately…' : 'Type a message...'}
            className="flex-1 bg-muted/50 border-transparent focus-visible:ring-1"
          />
          <Button type="submit" size="icon" disabled={!message.trim()} className="rounded-full flex-shrink-0">
            <Send className="w-4 h-4" />
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
