import type { ParticipantInfo } from './participants';

export function ParticipantList({ participants }: { participants: ParticipantInfo[] }) {
  return (
    <section className="panel">
      <h3>Na sala ({participants.length})</h3>
      <ul className="participants">
        {participants.map((p) => (
          <li key={p.identity}>
            <span className="avatar" aria-hidden>
              {p.name.charAt(0).toUpperCase()}
            </span>
            <span className="participant-name">
              {p.name}
              {p.isLocal && <span className="muted"> (você)</span>}
            </span>
            {p.role === 'presenter' && (
              <span className={`badge ${p.isSharing ? 'badge-live' : ''}`}>
                {p.isSharing ? 'ao vivo' : 'apresentador'}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
