import { MonitorPlay } from 'lucide-react';
import { FriendsMenu } from './FriendsMenu';

interface Props {
  name: string;
  currentRoom?: string;
  onHome: () => void;
  onJoinRoom: (room: string) => void;
}

/** Barra fixa do app. Novos menus entram em <nav>. */
export function TopBar({ name, currentRoom, onHome, onJoinRoom }: Props) {
  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onHome();
        }}
        className="mr-2 flex items-center gap-2 font-semibold"
      >
        <MonitorPlay className="size-5" />
        <span className="hidden sm:inline">Kamus</span>
      </a>
      <nav className="flex items-center gap-1" aria-label="Menu principal">
        <FriendsMenu currentRoom={currentRoom} onJoinRoom={onJoinRoom} />
      </nav>
      {name && <span className="ml-auto truncate text-sm text-muted-foreground">Olá, {name}</span>}
    </header>
  );
}
