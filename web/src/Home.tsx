import { useState, type FormEvent } from 'react';
import { History, LogIn, MonitorUp, Smartphone, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Role } from './api';
import { canShareScreen } from './device';
import { isValidRoomName, normalizeRoomName, randomRoomId } from './rooms';

interface Props {
  initialName: string;
  initialRoom?: string;
  /** Papel pedido no link (?apresentar), mantido ao entrar pelo formulário. */
  initialRole?: Role;
  recentRooms: string[];
  onEnter: (room: string, role: Role, name: string) => void;
  onForgetRoom: (room: string) => void;
}

export function Home({ initialName, initialRoom, initialRole, recentRooms, onEnter, onForgetRoom }: Props) {
  const [name, setName] = useState(initialName);
  const [newRoom, setNewRoom] = useState('');
  const [room, setRoom] = useState(initialRoom ?? '');

  const displayName = name.trim() || 'Anônimo';
  const newRoomName = normalizeRoomName(newRoom);
  const joinRoomName = normalizeRoomName(room);

  const present = (e: FormEvent) => {
    e.preventDefault();
    // No celular não dá para transmitir: entra na sala só para assistir.
    onEnter(newRoom.trim() ? newRoomName : randomRoomId(), canShareScreen ? 'presenter' : 'viewer', displayName);
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const role = initialRoom && initialRole === 'presenter' && canShareScreen ? 'presenter' : 'viewer';
    if (isValidRoomName(joinRoomName)) onEnter(joinRoomName, role, displayName);
  };

  return (
    <main className="mx-auto grid max-w-md gap-6 px-4 py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Kamus Screen Sharing</h1>
        <p className="text-muted-foreground">
          {initialRoom ? (
            <>
              Você foi convidado para a sala <strong className="text-foreground">{initialRoom}</strong>.
            </>
          ) : (
            'Compartilhe sua tela com os amigos direto do navegador.'
          )}
        </p>
      </header>

      <div className="grid gap-2">
        <Label htmlFor="name">Seu nome</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Maria"
          maxLength={64}
          autoFocus={!initialName}
        />
      </div>

      {!initialRoom && recentRooms.length > 0 && (
        <section className="grid gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <History className="size-4" />
            Salas recentes
          </h2>
          <div className="flex flex-wrap gap-2">
            {recentRooms.map((r) => (
              <div key={r} className="flex items-center rounded-md border">
                <Button variant="ghost" size="sm" className="rounded-r-none" onClick={() => onEnter(r, 'viewer', displayName)}>
                  {r}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-l-none text-muted-foreground"
                  onClick={() => onForgetRoom(r)}
                  aria-label={`Esquecer a sala ${r}`}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!initialRoom && (
        <Card>
          <CardHeader>
            <CardTitle>{canShareScreen ? 'Apresentar' : 'Criar sala'}</CardTitle>
            <CardDescription>
              Dê um nome para ter uma sala fixa do grupo (o link é sempre o mesmo), ou deixe vazio para
              gerar um código.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={present}>
              {!canShareScreen && <MobileNotice />}
              <div className="grid gap-2">
                <Label htmlFor="new-room">Nome da sala (opcional)</Label>
                <Input
                  id="new-room"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  placeholder="Ex.: amigos"
                  maxLength={64}
                />
                {newRoom.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Link: {window.location.origin}/s/{newRoomName || '…'}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={!!newRoom.trim() && !isValidRoomName(newRoomName)}>
                {canShareScreen ? <MonitorUp /> : <LogIn />}
                {!canShareScreen
                  ? 'Criar sala'
                  : newRoom.trim()
                    ? 'Entrar e apresentar'
                    : 'Criar sala e compartilhar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assistir</CardTitle>
          <CardDescription>
            {initialRoom
              ? 'Dentro da sala, você também pode assumir a apresentação quando ninguém estiver transmitindo.'
              : 'Entre numa sala com o nome ou código que você recebeu.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={join}>
            {!initialRoom && (
              <div className="grid gap-2">
                <Label htmlFor="room">Sala</Label>
                <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Ex.: amigos" />
              </div>
            )}
            <Button
              type="submit"
              variant={initialRoom ? 'default' : 'secondary'}
              disabled={!isValidRoomName(joinRoomName)}
            >
              <LogIn />
              {initialRoom ? 'Entrar na sala' : 'Entrar como espectador'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export function MobileNotice() {
  return (
    <Alert>
      <Smartphone />
      <AlertTitle>Celular só assiste</AlertTitle>
      <AlertDescription>
        Navegadores de celular (Android e iPhone) não permitem compartilhar a tela. Você pode criar a sala e
        assistir; para transmitir, use um computador.
      </AlertDescription>
    </Alert>
  );
}
