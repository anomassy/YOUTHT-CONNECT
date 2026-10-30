import { useRef } from 'react';
import { useLocation, Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin } from '@workspace/api-client-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Church } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SignIn } from '@clerk/react';
import { isClerkEnabled } from '@/context/AuthContext';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, error: authError, logout } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const lastLogoTap = useRef(0);

  const handleLogoTap = () => {
    const now = Date.now();
    if (now - lastLogoTap.current < 450) {
      lastLogoTap.current = 0;
      setLocation('/admin-login');
      return;
    }
    lastLogoTap.current = now;
  };

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  if (isClerkEnabled) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
        <div className="space-y-6">
          <div className="text-center">
            <button
              type="button"
              aria-label="Youth Connect admin login"
              onClick={handleLogoTap}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"
            >
              <Church className="h-8 w-8" aria-hidden="true" />
            </button>
            <h1 className="text-3xl font-serif text-primary tracking-tight">Youth Connect</h1>
            <p className="mt-2 text-muted-foreground">Welcome back to fellowship.</p>
          </div>
          {authError ? (
            <div className="max-w-md space-y-4 text-center">
              <p role="alert" className="text-sm text-destructive">{authError}</p>
              <button type="button" className="text-sm underline" onClick={logout}>Sign out</button>
            </div>
          ) : (
            <SignIn routing="hash" forceRedirectUrl="/" />
          )}
        </div>
      </div>
    );
  }

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (res) => {
          login(res.token, res.user);
          setLocation('/');
        },
        onError: () => {
          toast({
            title: 'Login failed',
            description: 'Please check your credentials and try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <button
            type="button"
            aria-label="Youth Connect logo"
            onClick={handleLogoTap}
            className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-4 shadow-lg cursor-default"
          >
            <Church className="w-8 h-8" />
          </button>
          <h1 className="text-3xl font-serif text-primary tracking-tight">Youth Connect</h1>
          <p className="text-muted-foreground">Welcome back to fellowship.</p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Enter your email or username below</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username or Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center border-t p-4 bg-muted/20">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Create one
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
