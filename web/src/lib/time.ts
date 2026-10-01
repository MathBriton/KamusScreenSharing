const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "agora há pouco", "há 5 minutos", "há 2 horas", "ontem"... */
export function timeAgo(ms: number): string {
  const minutes = Math.round((ms - Date.now()) / 60_000);
  if (minutes > -1) return 'agora há pouco';
  if (minutes > -60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}
