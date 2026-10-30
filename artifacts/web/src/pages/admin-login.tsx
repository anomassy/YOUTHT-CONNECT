import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAdminLogin } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Church, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { adminLogin } = useAuth();
  const { toast } = useToast();
  const mutation = useAdminLogin();
  const [password, setPassword] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    mutation.mutate({ data: { password } }, {
      onSuccess: (result) => {
        adminLogin(result.token);
        setLocation('/admin');
      },
      onError: (error: any) => {
        const message = error?.status === 503
          ? 'The admin password has not been configured in the local .env file.'
          : 'That admin password is not correct.';
        toast({ title: 'Admin login failed', description: message, variant: 'destructive' });
        setPassword('');
      },
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-2 shadow-lg"><Church className="w-8 h-8" /></div>
          <h1 className="text-3xl font-serif text-primary tracking-tight">Youth Connect</h1>
          <p className="text-muted-foreground">Administrator sign in</p>
        </div>
        <Card className="border-border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Admin access</CardTitle>
            <CardDescription>Enter the administrator password configured for this system.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <Input autoFocus autoComplete="current-password" type="password" placeholder="Administrator password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <Button type="submit" className="w-full" disabled={mutation.isPending || !password}>{mutation.isPending ? 'Checking…' : 'Continue to admin panel'}</Button>
            </form>
            <Link href="/login" className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="w-4 h-4" /> Back to member login</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}