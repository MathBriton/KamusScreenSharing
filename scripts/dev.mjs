// Sobe a API (:3001) e o Vite (:5173) juntos, em qualquer sistema (inclusive Windows/cmd).
import { spawn } from 'node:child_process';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 5)) {
  console.error(`Node ${process.versions.node} é antigo demais: o servidor usa node:sqlite (Node 22.5 ou superior).`);
  process.exit(1);
}

const tasks = [
  { name: 'api', color: 36, workspace: 'server' },
  { name: 'web', color: 35, workspace: 'web' },
];

const children = tasks.map(({ name, color, workspace }) => {
  const child = spawn(`npm run dev --workspace ${workspace}`, { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let rest = '';
    stream.on('data', (chunk) => {
      const lines = (rest + chunk).split(/\r?\n/);
      rest = lines.pop() ?? '';
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    // Se um dos dois cair, avisa e encerra o outro (senão o proxy do Vite só mostra "http proxy error").
    console.error(`${prefix}encerrou (código ${code ?? 'sinal'}). Parando o restante.`);
    stopAll();
    process.exitCode = code || 1;
  });
  return child;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill();
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
