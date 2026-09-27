import type { ProjectFile } from './analyze';
export { rpgSample } from './sample-rpg';

// Dos proyectos para probar sin subir nada: el propio código de VibeMap y un RPG chico en Godot.
const own = import.meta.glob(['./*.{ts,tsx,css}', '!./samples.ts', '!./sample-rpg.ts', '!./vite-env.d.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const vibemapSample: ProjectFile[] = [
  { path: 'index.html', content: '<!doctype html>\n<html lang="es">\n<body>\n<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n' },
  ...Object.entries(own).map(([p, content]) => ({ path: `src/${p.slice(2)}`, content })),
];
