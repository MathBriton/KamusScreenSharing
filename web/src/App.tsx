import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AccountProvider, useAccount } from './account/AccountContext';
import { DmPanel } from './account/DmPanel';
import { Home } from './Home';
import { TopBar } from './layout/TopBar';
import { RoomView } from './room/RoomView';
import { forgetRoom, loadRecentRooms, readRoomFromUrl, rememberRoom, roomPath } from './rooms';

export function App() {
  const [room, setRoom] = useState<string | null>(readRoomFromUrl);

  useEffect(() => {
    // Normaliza links antigos (?sala=, ?apresentar) para /s/<sala>.
    const current = readRoomFromUrl();
    if (current && window.location.pathname + window.location.search !== roomPath(current)) {
      window.history.replaceState(null, '', roomPath(current));
    }
    const onPop = () => setRoom(readRoomFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((next: string | null) => {
    window.history.pushState(null, '', next ? roomPath(next) : '/');
    setRoom(next);
  }, []);

  return (
    <AccountProvider currentRoom={room} onJoinRoom={go}>
      <Shell room={room} go={go} />
      <DmPanel />
    </AccountProvider>
  );
}

function Shell({ room, go }: { room: string | null; go: (room: string | null) => void }) {
  const { session, ready } = useAccount();
  const [recentRooms, setRecentRooms] = useState(loadRecentRooms);

  const enter = (next: string) => {
    rememberRoom(next);
    setRecentRooms(loadRecentRooms());
    go(next);
  };

  // Entrar numa sala (pelo link ou pelos menus) também a coloca nas recentes.
  useEffect(() => {
    if (room && session) {
      rememberRoom(room);
      setRecentRooms(loadRecentRooms());
    }
  }, [room, session]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted-foreground">
        <Loader2 className="animate-spin" aria-label="Carregando" />
      </div>
    );
  }

  if (room && session) {
    return (
      <RoomView
        key={room}
        room={room}
        name={session.user.name}
        sessionToken={session.token}
        onLeave={() => go(null)}
        onJoinRoom={enter}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar onHome={() => go(null)} onJoinRoom={enter} />
      <Home
        initialRoom={room ?? undefined}
        recentRooms={recentRooms}
        onEnter={enter}
        onForgetRoom={(r) => {
          forgetRoom(r);
          setRecentRooms(loadRecentRooms());
        }}
      />
    </div>
  );
}
