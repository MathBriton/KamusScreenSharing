/** Comparação sem acentos e sem diferenciar maiúsculas ("Júlia" = "julia"). */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Regex das menções conhecidas (@Nome), testando os nomes mais longos primeiro
 * para "@Ana Paula" não virar só "@Ana".
 */
export function mentionPattern(names: string[]): RegExp | null {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (unique.length === 0) return null;
  return new RegExp(`@(${unique.map(escapeRegExp).join('|')})(?=$|[\\s.,!?:;)\\]])`, 'giu');
}

export type MentionPart = { type: 'text'; value: string } | { type: 'mention'; name: string };

export function splitMentions(text: string, pattern: RegExp | null): MentionPart[] {
  if (!pattern) return [{ type: 'text', value: text }];
  const parts: MentionPart[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) });
    parts.push({ type: 'mention', name: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

/** A mensagem menciona esta pessoa? */
export function mentions(text: string, name: string): boolean {
  if (!name.trim()) return false;
  const pattern = mentionPattern([name]);
  return !!pattern && pattern.test(text);
}

/** Termo de busca de menção logo antes do cursor: "olha @an|" → "an". */
export function mentionQueryAt(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const match = before.match(/(^|\s)@([^\s@]{0,30})$/u);
  if (!match) return null;
  return { query: match[2], start: caret - match[2].length - 1 };
}
