/** Aplica a classe `dark` (convenção do shadcn) seguindo o tema do sistema. */
export function followSystemTheme() {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('dark', media.matches);
  apply();
  media.addEventListener('change', apply);
}
