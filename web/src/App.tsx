import { useEffect, useState } from 'react';
import type { Role } from './api';
import { Home } from './Home';
import { TopBar } from './layout/TopBar';
import { RoomView } from './RoomView';
import {
  forgetRoom,
  loadRecentRooms,
  readSessionFromUrl,
  rememberRoom,
  sessionUrl,
  type Session,
} from './rooms';

function loadName(): string {
  try {
    return localStorage.getItem('kamus:name') ?? '';
  } catch {
    return '';
  }
}

export function App() {
  const [session, setSession] = useState<Session | null>(readSessionFromUrl);
  const [name, setName] = useState(loadName);
  const [recentRooms, setRecentRooms] = useState(loadRecentRooms);

  useEffect(() => {
    // Converte links antigos (?sala=) para o formato /s/<sala>.
    const current = readSessionFromUrl();
    if (current && window.location.pathname + window.location.search !== sessionUrl(current)) {
      window.history.replaceState(null, '', sessionUrl(current));
    }
    const onPop = () => setSession(readSessionFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const enter = (room: string, role: Role, displayName: string) => {
    try {
      localStorage.setItem('kamus:name', displayName);
    } catch {
      // Sem armazenamento local: pede o nome de novo na próxima visita.
    }
    rememberRoom(room);
    setRecentRooms(loadRecentRooms());
    setName(displayName);
    window.history.pushState(null, '', sessionUrl({ room, role }));
    setSession({ room, role });
  };

  const leave = () => {
    window.history.pushState(null, '', '/');
    setSession(null);
  };

  const forget = (room: string) => {
    forgetRoom(room);
    setRecentRooms(loadRecentRooms());
  };

  // Trocar de papel não reconecta: só atualiza o link na barra de endereço.
  const changeRole = (role: Role) => {
    if (session) window.history.replaceState(null, '', sessionUrl({ room: session.room, role }));
  };

  const joinRoom = (room: string) => {
    if (name) {
      enter(room, 'viewer', name);
    } else {
      window.history.pushState(null, '', sessionUrl({ room, role: 'viewer' }));
      setSession({ room, role: 'viewer' });
    }
  };

  const inRoom = !!session && !!name;

  return (
    <div className="flex h-dvh flex-col">
      <TopBar name={name} currentRoom={inRoom ? session.room : undefined} onHome={leave} onJoinRoom={joinRoom} />
      {inRoom ? (
        <RoomView
          key={session.room}
          room={session.room}
          initialRole={session.role}
          name={name}
          onRoleChange={changeRole}
          onLeave={leave}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Home
            initialName={name}
            initialRoom={session?.room}
            initialRole={session?.role}
            recentRooms={recentRooms}
            onEnter={enter}
            onForgetRoom={forget}
          />
        </div>
      )}
    </div>
  );
}
