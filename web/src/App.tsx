import { useEffect, useState } from 'react';
import { Home } from './Home';
import { TopBar } from './layout/TopBar';
import { RoomView } from './room/RoomView';
import { forgetRoom, loadRecentRooms, readRoomFromUrl, rememberRoom, roomPath } from './rooms';

function loadName(): string {
  try {
    return localStorage.getItem('kamus:name') ?? '';
  } catch {
    return '';
  }
}

export function App() {
  const [room, setRoom] = useState<string | null>(readRoomFromUrl);
  const [name, setName] = useState(loadName);
  const [recentRooms, setRecentRooms] = useState(loadRecentRooms);

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

  const enter = (next: string, displayName: string) => {
    try {
      localStorage.setItem('kamus:name', displayName);
    } catch {
      // Sem armazenamento local: pede o nome de novo na próxima visita.
    }
    rememberRoom(next);
    setRecentRooms(loadRecentRooms());
    setName(displayName);
    window.history.pushState(null, '', roomPath(next));
    setRoom(next);
  };

  const leave = () => {
    window.history.pushState(null, '', '/');
    setRoom(null);
  };

  const forget = (r: string) => {
    forgetRoom(r);
    setRecentRooms(loadRecentRooms());
  };

  const joinRoom = (next: string) => {
    if (name) {
      enter(next, name);
    } else {
      window.history.pushState(null, '', roomPath(next));
      setRoom(next);
    }
  };

  if (room && name) {
    return <RoomView key={room} room={room} name={name} onLeave={leave} onJoinRoom={joinRoom} />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar name={name} onHome={leave} onJoinRoom={joinRoom} />
      <Home
        initialName={name}
        initialRoom={room ?? undefined}
        recentRooms={recentRooms}
        onEnter={enter}
        onForgetRoom={forget}
      />
    </div>
  );
}
