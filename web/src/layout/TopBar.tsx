import { Logo } from '@/logo/Logo';
import { useAccount } from '@/account/AccountContext';
import { FriendsMenu } from './FriendsMenu';
import { NotificationsMenu } from './NotificationsMenu';
import { ProfileMenu } from './ProfileMenu';
import { RoomsMenu } from './RoomsMenu';

interface Props {
  onHome: () => void;
  onJoinRoom: (room: string) => void;
}

/** Barra fixa da home. Na sala, os mesmos menus ficam em room/RoomTopBar. */
export function TopBar({ onHome, onJoinRoom }: Props) {
  const { session } = useAccount();
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-1 border-b bg-card px-3 md:px-4">
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onHome();
        }}
        className="mr-2 flex items-center gap-2 font-semibold"
        aria-label="Kamus: início"
      >
        <Logo />
      </a>
      {session && (
        <>
          <nav className="flex items-center gap-1" aria-label="Menu principal">
            <RoomsMenu onJoinRoom={onJoinRoom} />
            <FriendsMenu onJoinRoom={onJoinRoom} />
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsMenu onJoinRoom={onJoinRoom} />
            <ProfileMenu />
          </div>
        </>
      )}
    </header>
  );
}
