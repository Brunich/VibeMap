import type { Lang, Role } from './analyze';

export const ROLE: Record<Role, { label: string; plural: string; color: string; hint: string }> = {
  entrada: { label: 'Entrada', plural: 'Entrada', color: '#7fe3c6', hint: 'donde arranca' },
  interfaz: { label: 'Interfaz', plural: 'Interfaz', color: '#b9a7ff', hint: 'lo que se ve' },
  logica: { label: 'Lógica', plural: 'Lógica', color: '#ffc98a', hint: 'reglas y cálculos' },
  datos: { label: 'Datos', plural: 'Datos', color: '#ff9b87', hint: 'lee, guarda o pide' },
  estilos: { label: 'Estilos', plural: 'Estilos', color: '#f3a6d8', hint: 'cómo se ve' },
  config: { label: 'Configuración', plural: 'Configuración', color: '#aeb8cc', hint: 'ajustes y docs' },
  pruebas: { label: 'Pruebas', plural: 'Pruebas', color: '#b5e37a', hint: 'revisan el código' },
};

export const LANG: Record<Lang, string> = {
  ts: 'TypeScript', js: 'JavaScript', py: 'Python', gd: 'GDScript', css: 'CSS', html: 'HTML', json: 'Config', md: 'Markdown', other: 'Otros',
};

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString('es-MX')} ${n === 1 ? one : many}`;
