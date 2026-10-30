import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { AdminGuard, AuthGuard } from './components/auth-guard';
import { Layout } from './components/layout';

import NotFound from '@/pages/not-found';
import Login from './pages/login';
import Register from './pages/register';
import AdminLogin from './pages/admin-login';
import Home from './pages/home';
import Devotion from './pages/devotion';
import PrayerWall from './pages/prayer';
import Community from './pages/community';
import MusicPage from './pages/music';
import ReadingPlans from './pages/reading-plans';
import Events from './pages/events';
import Profile from './pages/profile';
import More from './pages/more';

import AdminIndex from './pages/admin/index';
import AdminDevotions from './pages/admin/devotions';
import AdminEvents from './pages/admin/events';
import AdminQuestions from './pages/admin/questions';
import AdminMusic from './pages/admin/music';
import AdminStudyGuides from './pages/admin/study-guides';

const queryClient = new QueryClient();

function AuthenticatedApp() {
  return (
    <AuthGuard>
      <Layout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/devotion" component={Devotion} />
          <Route path="/prayer" component={PrayerWall} />
          <Route path="/community" component={Community} />
          <Route path="/music" component={MusicPage} />
          <Route path="/reading-plans" component={ReadingPlans} />
          <Route path="/events" component={Events} />
          <Route path="/profile" component={Profile} />
          <Route path="/more" component={More} />
          
          <Route path="/admin"><AdminGuard><AdminIndex /></AdminGuard></Route>
          <Route path="/admin/devotions"><AdminGuard><AdminDevotions /></AdminGuard></Route>
          <Route path="/admin/events"><AdminGuard><AdminEvents /></AdminGuard></Route>
          <Route path="/admin/questions"><AdminGuard><AdminQuestions /></AdminGuard></Route>
          <Route path="/admin/music"><AdminGuard><AdminMusic /></AdminGuard></Route>
          <Route path="/admin/study-guides"><AdminGuard><AdminStudyGuides /></AdminGuard></Route>
          
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route component={AuthenticatedApp} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AppProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
