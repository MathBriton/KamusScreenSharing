import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  accountApi,
  authApi,
  type AppNotification,
  type ConversationSummary,
  type DirectMessage,
  type Session,
  type User,
} from '@/api';

const SESSION_KEY = 'kamus:session';

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Sem armazenamento local: a sessão vale só nesta aba.
  }
}

type DmListener = (message: DirectMessage) => void;

interface AccountContextValue {
  session: Session | null;
  /** Já conferiu a sessão salva com o servidor. */
  ready: boolean;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;

  notifications: AppNotification[];
  unreadNotifications: number;
  markAllRead: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;

  conversations: Map<string, ConversationSummary>;
  unreadDms: number;
  /** Conversa privada aberta no painel lateral. */
  dmPeer: User | null;
  openDm: (peer: User) => void;
  closeDm: () => void;
  onDm: (listener: DmListener) => () => void;
  markDmRead: (peerId: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount fora do AccountProvider');
  return ctx;
}

function systemNotify(title: string, body: string) {
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

interface Props {
  /** Sala aberta agora (evita avisos repetidos do que já está na tela). */
  currentRoom: string | null;
  onJoinRoom: (room: string) => void;
  children: ReactNode;
}

export function AccountProvider({ currentRoom, onJoinRoom, children }: Props) {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [ready, setReady] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [conversations, setConversations] = useState<Map<string, ConversationSummary>>(new Map());
  const [dmPeer, setDmPeer] = useState<User | null>(null);
  const dmListeners = useRef(new Set<DmListener>());
  // Valores atuais para os handlers do EventSource (que não re-renderizam).
  const live = useRef({ currentRoom, dmPeer, onJoinRoom });
  live.current = { currentRoom, dmPeer, onJoinRoom };

  const token = session?.token ?? null;

  const signIn = useCallback((s: Session) => {
    saveSession(s);
    setSession(s);
    setReady(true);
  }, []);

  const clear = useCallback(() => {
    saveSession(null);
    setSession(null);
    setNotifications([]);
    setConversations(new Map());
    setDmPeer(null);
  }, []);

  const signOut = useCallback(async () => {
    if (token) await authApi.logout(token).catch(() => {});
    clear();
  }, [token, clear]);

  const updateUser = useCallback((user: User) => {
    setSession((s) => {
      if (!s) return s;
      const next = { ...s, user };
      saveSession(next);
      return next;
    });
  }, []);

  // Confere a sessão salva (pode ter expirado ou sido encerrada).
  useEffect(() => {
    const saved = loadSession();
    if (!saved) {
      setReady(true);
      return;
    }
    authApi
      .me(saved.token)
      .then((user) => signIn({ token: saved.token, user }))
      .catch(() => {
        clear();
        setReady(true);
      });
  }, [signIn, clear]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [n, c] = await Promise.all([accountApi.notifications(token), accountApi.conversations(token)]).catch(
      () => [null, null] as const,
    );
    if (n) setNotifications(n);
    if (c) setConversations(new Map(c.map((x) => [x.peerId, x])));
  }, [token]);

  // Tempo real: mensagens privadas e notificações.
  useEffect(() => {
    if (!token) return;
    void refresh();
    const source = new EventSource(accountApi.eventsUrl(token));
    source.onmessage = (e) => {
      let event: { type: string; [k: string]: unknown };
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }
      const me = session?.user.id;
      if (event.type === 'notification') {
        const n = event.notification as AppNotification;
        setNotifications((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 50));
        const { currentRoom: room, dmPeer: peer, onJoinRoom: join } = live.current;
        if (n.kind === 'dm' && peer?.id !== n.data.fromId) {
          toast(`Mensagem de ${n.data.fromName}`, {
            description: n.data.preview,
            action: { label: 'Abrir', onClick: () => setDmPeer({ id: n.data.fromId, name: n.data.fromName }) },
          });
          systemNotify(`Mensagem de ${n.data.fromName}`, n.data.preview);
        } else if (n.kind === 'mention' && n.data.room !== room) {
          toast(`${n.data.fromName} mencionou você na sala ${n.data.room}`, {
            description: n.data.preview,
            action: { label: 'Entrar', onClick: () => join(n.data.room) },
          });
          systemNotify(`${n.data.fromName} mencionou você`, n.data.preview);
        } else if (n.kind === 'live' && n.data.room !== room) {
          toast(`${n.data.fromName} está ao vivo`, {
            description: `na sala ${n.data.room}`,
            action: { label: 'Entrar', onClick: () => join(n.data.room) },
          });
          systemNotify(`${n.data.fromName} está ao vivo`, `na sala ${n.data.room}`);
        }
      } else if (event.type === 'notifications-read') {
        void accountApi.notifications(token).then(setNotifications).catch(() => {});
      } else if (event.type === 'dm') {
        const m = event.message as DirectMessage;
        const peerId = m.fromId === me ? m.toId : m.fromId;
        setConversations((prev) => {
          const next = new Map(prev);
          const current = next.get(peerId);
          const incoming = m.toId === me && live.current.dmPeer?.id !== peerId;
          next.set(peerId, { peerId, last: m, unread: (current?.unread ?? 0) + (incoming ? 1 : 0) });
          return next;
        });
        dmListeners.current.forEach((l) => l(m));
      }
    };
    // Ao reconectar (queda de rede), atualiza o que se perdeu.
    source.onopen = () => void refresh();
    return () => source.close();
  }, [token, session?.user.id, refresh]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (!token || ids.length === 0) return;
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
      await accountApi.markNotificationsRead(token, ids).catch(() => {});
    },
    [token],
  );

  const markAllRead = useCallback(async () => {
    if (!token) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await accountApi.markNotificationsRead(token).catch(() => {});
  }, [token]);

  const markDmRead = useCallback(
    (peerId: string) => {
      if (!token) return;
      setConversations((prev) => {
        const c = prev.get(peerId);
        if (!c || c.unread === 0) return prev;
        const next = new Map(prev);
        next.set(peerId, { ...c, unread: 0 });
        return next;
      });
      setNotifications((prev) =>
        prev.map((n) => (n.kind === 'dm' && n.data.fromId === peerId ? { ...n, read: true } : n)),
      );
      void accountApi.markDmRead(token, peerId).catch(() => {});
    },
    [token],
  );

  const onDm = useCallback((listener: DmListener) => {
    dmListeners.current.add(listener);
    return () => {
      dmListeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<AccountContextValue>(
    () => ({
      session,
      ready,
      signIn,
      signOut,
      updateUser,
      notifications,
      unreadNotifications: notifications.filter((n) => !n.read).length,
      markAllRead,
      markRead,
      conversations,
      unreadDms: [...conversations.values()].reduce((sum, c) => sum + c.unread, 0),
      dmPeer,
      openDm: setDmPeer,
      closeDm: () => setDmPeer(null),
      onDm,
      markDmRead,
    }),
    [session, ready, signIn, signOut, updateUser, notifications, markAllRead, markRead, conversations, dmPeer, onDm, markDmRead],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
