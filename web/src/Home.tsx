import { useState, type FormEvent } from 'react';
import { LogIn, MonitorUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Role } from './api';

interface Props {
  initialName: string;
  initialRoom?: string;
  onEnter: (room: string, role: Role, name: string) => void;
}

function randomRoomId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function Home({ initialName, initialRoom, onEnter }: Props) {
  const [name, setName] = useState(initialName);
  const [room, setRoom] = useState(initialRoom ?? '');

  const displayName = name.trim() || 'Anônimo';

  const createRoom = () => onEnter(randomRoomId(), 'presenter', displayName);

  const joinRoom = (e: FormEvent) => {
    e.preventDefault();
    if (room.trim()) onEnter(room.trim(), 'viewer', displayName);
  };

  return (
    <main className="mx-auto grid max-w-md gap-6 px-4 py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Kamus Screen Sharing</h1>
        <p className="text-muted-foreground">Compartilhe sua tela com os amigos direto do navegador.</p>
      </header>

      <div className="grid gap-2">
        <Label htmlFor="name">Seu nome</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Maria"
          maxLength={64}
        />
      </div>

      {!initialRoom && (
        <Card>
          <CardHeader>
            <CardTitle>Apresentar</CardTitle>
            <CardDescription>Crie uma sala e envie o link para quem vai assistir.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={createRoom}>
              <MonitorUp />
              Criar sala e compartilhar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assistir</CardTitle>
          <CardDescription>Entre numa sala com o código que você recebeu.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={joinRoom}>
            <div className="grid gap-2">
              <Label htmlFor="room">Código da sala</Label>
              <Input
                id="room"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Ex.: a1b2c3d4"
              />
            </div>
            <Button type="submit" variant={initialRoom ? 'default' : 'secondary'} disabled={!room.trim()}>
              <LogIn />
              Entrar como espectador
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
