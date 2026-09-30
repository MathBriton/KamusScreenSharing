import { MonitorPlay } from 'lucide-react';
import { FriendsMenu } from './FriendsMenu';

interface Props {
  name: string;
  onHome: () => void;
  onJoinRoom: (room: string) => void;
}

/** Barra fixa do app. Novos menus entram em <nav>. */
export function TopBar({ name, onHome, onJoinRoom }: Props) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:px-4">
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onHome();
        }}
        className="mr-2 flex items-center gap-2 font-semibold"
      >
        <MonitorPlay className="size-5 text-primary" />
        <span className="hidden text-sm tracking-tight uppercase sm:inline">Kamus</span>
      </a>
      <nav className="flex items-center gap-1" aria-label="Menu principal">
        <FriendsMenu onJoinRoom={onJoinRoom} />
      </nav>
      {name && <span className="ml-auto truncate text-xs text-muted-foreground">Olá, {name}</span>}
    </header>
  );
}
