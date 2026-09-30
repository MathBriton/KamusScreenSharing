import { useState } from 'react';
import type { Role } from './api';
import { Home } from './Home';
import { RoomView } from './RoomView';

interface Session {
  room: string;
  role: Role;
}

function readSessionFromUrl(): Session | null {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('sala');
  if (!room) return null;
  return { room, role: params.get('papel') === 'apresentador' ? 'presenter' : 'viewer' };
}

export function App() {
  const [session, setSession] = useState<Session | null>(readSessionFromUrl);
  const [name, setName] = useState(() => localStorage.getItem('kamus:name') ?? '');

  const enter = (room: string, role: Role, displayName: string) => {
    localStorage.setItem('kamus:name', displayName);
    setName(displayName);
    const params = new URLSearchParams({ sala: room });
    if (role === 'presenter') params.set('papel', 'apresentador');
    window.history.pushState(null, '', `?${params}`);
    setSession({ room, role });
  };

  const leave = () => {
    window.history.pushState(null, '', '/');
    setSession(null);
  };

  if (!session) {
    return <Home initialName={name} onEnter={enter} />;
  }
  if (!name) {
    return <Home initialName="" initialRoom={session.room} onEnter={enter} />;
  }
  return <RoomView room={session.room} role={session.role} name={name} onLeave={leave} />;
}
