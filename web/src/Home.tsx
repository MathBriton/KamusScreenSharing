import { useState, type FormEvent } from 'react';
import type { Role } from './api';

interface Props {
  initialName: string;
  initialRoom?: string;
  onEnter: (room: string, role: Role, name: string) => void;
}

function randomRoomId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function Home({ initialName, initialRoom, onEnter }: Props) {
  const [name, setName] = useState(initialName);
  const [room, setRoom] = useState(initialRoom ?? '');

  const displayName = name.trim() || 'Anônimo';

  const createRoom = () => onEnter(randomRoomId(), 'presenter', displayName);

  const joinRoom = (e: FormEvent) => {
    e.preventDefault();
    if (room.trim()) onEnter(room.trim(), 'viewer', displayName);
  };

  return (
    <main className="home">
      <h1>Kamus Screen Sharing</h1>
      <p className="subtitle">Compartilhe sua tela com muitas pessoas direto do navegador.</p>

      <label className="field">
        Seu nome
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Maria" maxLength={64} />
      </label>

      {!initialRoom && (
        <section className="card">
          <h2>Apresentar</h2>
          <p>Crie uma sala e envie o link para quem vai assistir.</p>
          <button onClick={createRoom}>Criar sala e compartilhar</button>
        </section>
      )}

      <form className="card" onSubmit={joinRoom}>
        <h2>Assistir</h2>
        <label className="field">
          Código da sala
          <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Ex.: a1b2c3d4" />
        </label>
        <button type="submit" disabled={!room.trim()}>
          Entrar como espectador
        </button>
      </form>
    </main>
  );
}
