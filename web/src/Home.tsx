import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, History, Plus, Smartphone, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoginForm } from './account/LoginForm';
import { useAccount } from './account/AccountContext';
import { canShareScreen } from './device';
import { isValidRoomName, normalizeRoomName, randomRoomId } from './rooms';

interface Props {
  initialRoom?: string;
  recentRooms: string[];
  onEnter: (room: string) => void;
  onForgetRoom: (room: string) => void;
}

/** Painel da home: cinza escuro, borda discreta, título pequeno em caixa alta. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-card">
      <h2 className="border-b px-4 py-2.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{title}</h2>
      <div className="grid gap-4 p-4">{children}</div>
    </section>
  );
}

export function Home({ initialRoom, recentRooms, onEnter, onForgetRoom }: Props) {
  const { session } = useAccount();
  const [newRoom, setNewRoom] = useState('');
  const [room, setRoom] = useState(initialRoom ?? '');

  const newRoomName = normalizeRoomName(newRoom);
  const joinRoomName = normalizeRoomName(room);

  const create = (e: FormEvent) => {
    e.preventDefault();
    onEnter(newRoom.trim() ? newRoomName : randomRoomId());
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (isValidRoomName(joinRoomName)) onEnter(joinRoomName);
  };

  return (
    <main className="mx-auto grid w-full max-w-4xl flex-1 content-start gap-6 px-4 py-10 md:py-16">
      <header className="grid gap-2">
        <span className="font-mono text-xs text-primary">// compartilhamento de tela entre amigos</span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {initialRoom ? (
            <>
              Entrar na sala <span className="font-mono text-primary">{initialRoom}</span>
            </>
          ) : (
            'Kamus Screen Sharing'
          )}
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Várias telas ao mesmo tempo, direto do navegador. A voz continua no Discord.
        </p>
      </header>

      {!canShareScreen && <MobileNotice />}

      {!session ? (
        <LoginForm />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Criar sala">
            <form className="grid gap-3" onSubmit={create}>
              <div className="grid gap-2">
                <Label htmlFor="new-room">Nome da sala (opcional)</Label>
                <Input
                  id="new-room"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  placeholder="Ex.: amigos"
                  maxLength={64}
                />
                <p className="font-mono text-xs text-muted-foreground">
                  {newRoom.trim()
                    ? `${window.location.origin}/s/${newRoomName || '…'}`
                    : 'Vazio: gera um código aleatório. Com nome: link fixo do grupo.'}
                </p>
              </div>
              <Button type="submit" disabled={!!newRoom.trim() && !isValidRoomName(newRoomName)}>
                <Plus />
                Criar sala
              </Button>
            </form>
          </Panel>

          <Panel title="Entrar numa sala">
            <form className="grid gap-3" onSubmit={join}>
              <div className="grid gap-2">
                <Label htmlFor="room">Sala</Label>
                <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Nome ou código" />
              </div>
              <Button type="submit" variant="secondary" disabled={!isValidRoomName(joinRoomName)}>
                <ArrowRight />
                Entrar
              </Button>
            </form>
          </Panel>

          {recentRooms.length > 0 && (
            <section className="grid gap-2 md:col-span-2">
              <h2 className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <History className="size-3.5" />
                Salas recentes
              </h2>
              <div className="flex flex-wrap gap-2">
                {recentRooms.map((r) => (
                  <div key={r} className="flex items-center rounded-md border bg-card">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-r-none font-mono text-xs"
                      onClick={() => onEnter(r)}
                    >
                      {r}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-l-none text-subtle"
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
        </div>
      )}
    </main>
  );
}

export function MobileNotice() {
  return (
    <Alert className="max-w-md">
      <Smartphone />
      <AlertTitle>Celular só assiste</AlertTitle>
      <AlertDescription>
        Navegadores de celular (Android e iPhone) não permitem compartilhar a tela. Você pode criar salas e
        assistir; para transmitir, use um computador.
      </AlertDescription>
    </Alert>
  );
}
