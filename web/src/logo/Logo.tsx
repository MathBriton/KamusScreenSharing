import { cn } from '@/lib/utils';
import logo from './kamus-logo.png';
import mark from './kamus-mark.png';

// Classes literais para o Tailwind encontrar.
const FULL_FROM = {
  sm: { full: 'hidden sm:block', mark: 'sm:hidden' },
  lg: { full: 'hidden lg:block', mark: 'lg:hidden' },
} as const;

/**
 * Logo da barra superior: completa (símbolo + "Kamus") a partir de `fullFrom`, só o símbolo abaixo.
 * As imagens são geradas de `kamus-logo-original.png` (fundo transparente, texto claro para o tema escuro).
 */
export function Logo({ fullFrom = 'sm' }: { fullFrom?: keyof typeof FULL_FROM }) {
  const v = FULL_FROM[fullFrom];
  return (
    <>
      <img src={logo} alt="" className={cn('h-7 w-auto shrink-0 select-none', v.full)} draggable={false} />
      <img src={mark} alt="" className={cn('size-7 shrink-0 select-none', v.mark)} draggable={false} />
    </>
  );
}
