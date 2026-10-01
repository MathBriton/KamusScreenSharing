import { useState, type FormEvent } from 'react';
import { ChevronDown, DoorOpen, KeyRound, LogOut, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccount } from '@/account/AccountContext';
import { authApi } from '@/api';

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));
const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

interface Props {
  /** Na sala: mostra "Sair da sala". */
  onLeaveRoom?: () => void;
}

export function ProfileMenu({ onLeaveRoom }: Props) {
  const { session, signOut, updateUser } = useAccount();
  const [dialog, setDialog] = useState<'name' | 'pin' | null>(null);
  const [name, setName] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!session) return null;
  const { user, token } = session;

  const openDialog = (kind: 'name' | 'pin') => {
    setError(null);
    setName(user.name);
    setCurrentPin('');
    setNewPin('');
    setDialog(kind);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (dialog === 'name') {
        updateUser(await authApi.rename(token, name.trim()));
        toast.success('Nome atualizado');
      } else {
        await authApi.changePin(token, currentPin, newPin);
        toast.success('PIN trocado');
      }
      setDialog(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2" aria-label={`Perfil de ${user.name}`}>
            <span className="grid size-7 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary uppercase">
              {user.name.charAt(0)}
            </span>
            <span className="max-w-28 truncate max-md:hidden">{user.name}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="grid">
            <span className="truncate">{user.name}</span>
            <span className="text-xs font-normal text-muted-foreground">Perfil protegido por PIN</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => openDialog('name')}>
            <PencilLine />
            Trocar nome
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog('pin')}>
            <KeyRound />
            Trocar PIN
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {onLeaveRoom && (
            <DropdownMenuItem onSelect={onLeaveRoom}>
              <DoorOpen />
              Sair da sala
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              onLeaveRoom?.();
              void signOut();
            }}
            className="text-live focus:text-live"
          >
            <LogOut />
            Sair da conta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{dialog === 'name' ? 'Trocar nome' : 'Trocar PIN'}</DialogTitle>
              <DialogDescription>
                {dialog === 'name'
                  ? 'Seus amigos passam a ver o novo nome. Nas salas, vale a partir da próxima vez que você entrar.'
                  : 'Use o novo PIN para entrar em outros aparelhos.'}
              </DialogDescription>
            </DialogHeader>
            {dialog === 'name' ? (
              <div className="grid gap-2">
                <Label htmlFor="new-name">Nome</Label>
                <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} autoFocus />
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="current-pin">PIN atual</Label>
                  <Input
                    id="current-pin"
                    type="password"
                    inputMode="numeric"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(digits(e.target.value))}
                    autoFocus
                    className="font-mono tracking-[0.3em]"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-pin">Novo PIN</Label>
                  <Input
                    id="new-pin"
                    type="password"
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) => setNewPin(digits(e.target.value))}
                    className="font-mono tracking-[0.3em]"
                  />
                </div>
              </>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={busy || (dialog === 'name' ? name.trim().length < 2 : currentPin.length < 4 || newPin.length < 4)}
              >
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
