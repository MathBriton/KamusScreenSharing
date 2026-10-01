import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/api';
import { useAccount } from './AccountContext';

type Step = 'name' | 'login' | 'register';

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Entrar com nome + PIN (ou criar o perfil na primeira vez). */
export function LoginForm() {
  const { signIn } = useAccount();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      setStep((await authApi.exists(name.trim())) ? 'login' : 'register');
      setPin('');
      setConfirm('');
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'register' && pin !== confirm) {
      setError('Os PINs não conferem.');
      return;
    }
    void run(async () => {
      signIn(step === 'login' ? await authApi.login(name.trim(), pin) : await authApi.register(name.trim(), pin));
    });
  };

  const pinInput = (id: string, label: string, value: string, set: (v: string) => void, autoFocus = false) => (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete={step === 'login' ? 'current-password' : 'new-password'}
        pattern="\d{4,6}"
        maxLength={6}
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
        placeholder="4 a 6 números"
        autoFocus={autoFocus}
        className="h-10 font-mono tracking-[0.3em]"
      />
    </div>
  );

  return (
    <section className="grid max-w-md gap-4 rounded-md border bg-card p-4" aria-label="Entrar">
      {step === 'name' ? (
        <form className="grid gap-3" onSubmit={next}>
          <div className="grid gap-2">
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Maria"
              maxLength={32}
              autoFocus
              autoComplete="username"
              className="h-10"
            />
          </div>
          <Button type="submit" disabled={busy || name.trim().length < 2}>
            {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            Continuar
          </Button>
        </form>
      ) : (
        <form className="grid gap-3" onSubmit={submit}>
          <button
            type="button"
            onClick={() => setStep('name')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {name.trim()} · trocar nome
          </button>
          {step === 'login' ? (
            <>
              <p className="text-sm text-muted-foreground">Bem-vindo de volta! Digite seu PIN.</p>
              {pinInput('pin', 'PIN', pin, setPin, true)}
              <Button type="submit" disabled={busy || pin.length < 4}>
                {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Entrar
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Primeira vez com esse nome. Escolha um PIN: ele protege suas mensagens privadas e serve para
                entrar com o mesmo nome em qualquer aparelho.
              </p>
              {pinInput('pin', 'Escolha um PIN', pin, setPin, true)}
              {pinInput('pin-confirm', 'Repita o PIN', confirm, setConfirm)}
              <Button type="submit" disabled={busy || pin.length < 4 || confirm.length < 4}>
                {busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
                Criar perfil
              </Button>
            </>
          )}
        </form>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
