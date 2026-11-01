import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';

type ChatReport = {
  id: number;
  messageId: number;
  reporterUsername: string;
  room: string;
  messageContent: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
};

export default function AdminChatReports() {
  const { token, getToken } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<ChatReport[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadReports = useCallback(async () => {
    const freshToken = await getToken();
    if (!freshToken) throw new Error('Your admin session has expired. Sign in again.');
    const response = await fetch('/api/chat/reports', {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Could not load chat reports.');
    setReports(result.reports as ChatReport[]);
    setError('');
  }, [getToken]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setIsLoading(true);
    loadReports()
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load chat reports.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [loadReports, token]);

  const updateReport = async (report: ChatReport, status: 'resolved' | 'dismissed') => {
    try {
      const freshToken = await getToken();
      if (!freshToken) throw new Error('Your admin session has expired. Sign in again.');
      const response = await fetch(`/api/chat/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Could not update this report.');
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, status } : item));
      toast({ description: `Report ${status}.` });
    } catch (updateError) {
      toast({
        title: 'Could not update report',
        description: updateError instanceof Error ? updateError.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openReports = reports.filter((report) => report.status === 'open');
  const closedReports = reports.filter((report) => report.status !== 'open');

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Chat message reports</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading reports…</p>
      ) : error ? (
        <p role="alert" className="text-destructive">{error}</p>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Needs review ({openReports.length})</h2>
            {openReports.length === 0 && <p className="text-muted-foreground">No open chat reports.</p>}
            {openReports.map((report) => (
              <Card key={report.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>Reported by @{report.reporterUsername}</span>
                    <span>{formatDate(report.createdAt)}</span>
                  </div>
                  <p className="rounded bg-muted p-3 text-sm whitespace-pre-wrap">{report.messageContent}</p>
                  <p className="text-sm"><strong>Reason:</strong> {report.reason}</p>
                  <p className="text-xs text-muted-foreground">Conversation: {report.room} · Message #{report.messageId}</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => void updateReport(report, 'dismissed')}>Dismiss</Button>
                    <Button onClick={() => void updateReport(report, 'resolved')}>Mark reviewed</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
          {closedReports.length > 0 && (
            <section className="space-y-4 border-t pt-6">
              <h2 className="text-xl font-semibold text-muted-foreground">Reviewed ({closedReports.length})</h2>
              {closedReports.map((report) => (
                <Card key={report.id} className="opacity-75">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-xs text-muted-foreground">{report.status} · @{report.reporterUsername} · {formatDate(report.createdAt)}</p>
                    <p className="text-sm whitespace-pre-wrap">{report.messageContent}</p>
                    <p className="text-sm"><strong>Reason:</strong> {report.reason}</p>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
