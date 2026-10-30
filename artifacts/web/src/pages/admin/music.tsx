import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListMusicQueryKey,
  useCreateMusic,
  useDeleteMusic,
  useListMusic,
  useRequestUploadUrl,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Music2, Trash2, Upload } from 'lucide-react';
import { formatTime } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

export default function AdminMusic() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const { data } = useListMusic();
  const requestUpload = useRequestUploadUrl();
  const create = useCreateMusic();
  const remove = useDeleteMusic();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);

  const handleFile = (selected: File | null) => {
    setFile(selected);
    setDuration(0);
    if (!selected) return;
    const preview = URL.createObjectURL(selected);
    const audio = new Audio(preview);
    audio.onloadedmetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
      URL.revokeObjectURL(preview);
    };
    audio.onerror = () => URL.revokeObjectURL(preview);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !artist.trim() || !file) {
      toast({ title: 'Missing information', description: 'Add a title, artist, and audio file.', variant: 'destructive' });
      return;
    }
    try {
      const upload = await requestUpload.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type || 'audio/mpeg' },
      });
      const uploadUrl = new URL(upload.uploadURL, window.location.href);
      const headers = new Headers({ 'Content-Type': file.type || 'audio/mpeg' });
      if (uploadUrl.origin === window.location.origin) {
        const token = await getToken();
        if (!token) throw new Error('Your administrator session has expired. Sign in again.');
        headers.set('Authorization', `Bearer ${token}`);
      }
      const uploaded = await fetch(uploadUrl, {
        method: 'PUT',
        headers,
        body: file,
      });
      if (!uploaded.ok) throw new Error('Audio upload failed.');
      await create.mutateAsync({
        data: { title: title.trim(), artist: artist.trim(), duration, audioPath: upload.objectPath },
      });
      setTitle('');
      setArtist('');
      setFile(null);
      setDuration(0);
      queryClient.invalidateQueries({ queryKey: getListMusicQueryKey() });
      toast({ description: 'Music added successfully.' });
    } catch (error) {
      toast({
        title: 'Could not add music',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const deleteTrack = (id: number) => {
    if (!confirm('Delete this track?')) return;
    remove.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMusicQueryKey() });
        toast({ description: 'Track deleted.' });
      },
    });
  };

  const isSaving = requestUpload.isPending || create.isPending;
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Manage Music</h1>
        <p className="text-muted-foreground mt-1">Upload audio files for the worship library.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Add audio</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Input placeholder="Song title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input placeholder="Artist or choir" value={artist} onChange={(e) => setArtist(e.target.value)} />
            </div>
            <Input type="file" accept="audio/*" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            {file && <p className="text-sm text-muted-foreground">{file.name} {duration ? `· ${formatTime(duration)}` : '· reading duration…'}</p>}
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Uploading…' : 'Upload music'}</Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <h2 className="text-xl font-bold">Uploaded tracks</h2>
        {data?.tracks?.length ? data.tracks.map((track) => (
          <Card key={track.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <Music2 className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0"><p className="font-semibold truncate">{track.title}</p><p className="text-sm text-muted-foreground truncate">{track.artist} · {formatTime(track.duration)}</p></div>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteTrack(track.id)} disabled={remove.isPending}><Trash2 className="w-4 h-4" /></Button>
            </CardContent>
          </Card>
        )) : <p className="text-sm text-muted-foreground py-6">No uploaded music yet.</p>}
      </div>
    </div>
  );
}