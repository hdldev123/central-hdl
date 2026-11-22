// O que está instalado e rodando no Windows, e como instalar/desinstalar em silêncio.

import { execFile, spawn } from 'node:child_process';
import { APP_ID_RE } from './releases.js';

const UNINSTALL_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

// o timeout evita que um reg/tasklist travado prenda a verificação em segundo plano
const run = (file, args) => new Promise((resolve) => {
  execFile(file, args, { windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 60 * 1000 }, (err, stdout) => resolve(err && !stdout ? '' : String(stdout)));
});

/** Converte a saída de "reg query /s" em uma lista de chaves com seus valores. */
export function parseRegistry(text) {
  const entries = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^HKEY_/.test(line)) {
      cur = { key: line.trim(), values: {} };
      entries.push(cur);
      continue;
    }
    const m = line.match(/^ {4}(.+?) {4}(REG_\w+)(?: {4}(.*))?$/);
    if (m && cur) cur.values[m[1]] = m[3] ?? '';
  }
  return entries.filter((e) => e.values.DisplayName);
}

/** Apps instalados (entradas de "Aplicativos instalados" do Windows). */
export async function installedPrograms() {
  const outs = await Promise.all(UNINSTALL_KEYS.map((k) => run('reg', ['query', k, '/s'])));
  return outs.flatMap(parseRegistry).map(programaDoRegistro);
}

/** Uma entrada do parseRegistry no formato que a Central usa. */
export function programaDoRegistro(e) {
  return {
    displayName: e.values.DisplayName,
    version: e.values.DisplayVersion || null,
    // o NSIS do electron-builder não grava InstallLocation: a pasta é a do desinstalador
    location: e.values.InstallLocation || folderOf(e.values.UninstallString),
    uninstall: e.values.QuietUninstallString || (e.values.UninstallString ? `${e.values.UninstallString} /S` : null),
    // instalado "para todos os usuários": o desinstalador pede elevação (UAC)
    maquina: !e.key.startsWith('HKEY_CURRENT_USER'),
  };
}

/** Pasta do executável no início de um comando: "C:\Pasta\Uninstall X.exe" /S → C:\Pasta */
export function folderOf(command) {
  const exe = command?.match(/^"([^"]+)"/)?.[1] ?? command?.match(/^(\S+\.exe)/i)?.[1];
  return exe ? exe.replace(/[\\/][^\\/]+$/, '') : null;
}

const VERSION_RE = /^\d+(\.\d+)*([-+][\w.-]+)?$/;

/**
 * O electron-builder registra "Nome 1.2.3"; aceita também só "Nome". Depois do nome só pode vir
 * uma versão, então um programa de outra empresa que comece igual ("Nome Editor 2.0") não conta.
 */
export function findInstalled(programs, windowsName) {
  const prefix = `${windowsName} `;
  return programs.find((p) => p.displayName === windowsName
    || (p.displayName.startsWith(prefix) && VERSION_RE.test(p.displayName.slice(prefix.length)))) ?? null;
}

export async function isRunning(exe) {
  const out = await run('tasklist', ['/FI', `IMAGENAME eq ${exe}`, '/FO', 'CSV', '/NH']);
  return out.toLowerCase().includes(`"${exe.toLowerCase()}"`);
}

/** Se o app já mostra alguma janela. Usa Get-Process porque o título do tasklist /V muda com o idioma do Windows. */
export async function hasWindow(exe) {
  const name = exe.replace(/\.exe$/i, '').replace(/'/g, "''");
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `@(Get-Process -Name '${name}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }).Count`]);
  return Number(out.trim()) > 0;
}

export async function kill(exe) {
  await run('taskkill', ['/IM', exe, '/F', '/T']);
  await new Promise((r) => setTimeout(r, 800)); // o Windows solta os arquivos logo depois
}

// Códigos de saída do NSIS: 1 = cancelado pelo usuário, 2 = abortado pelo script
// (arquivo travado ou bloqueado pelo antivírus, falha ao remover a versão anterior).
const NSIS_EXIT = {
  1: 'A instalação foi cancelada.',
  2: 'O instalador foi interrompido (arquivo em uso, bloqueio do antivírus ou falha ao remover a versão anterior).',
};

/** Roda um instalador NSIS e espera terminar; silencioso por padrão, ou com as telas do instalador. */
export function runInstaller(file, { silent = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, silent ? ['/S'] : [], { windowsHide: silent });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      const err = new Error(`${NSIS_EXIT[code] ?? 'O instalador falhou.'} (código ${code})`);
      err.exitCode = code;
      reject(err);
    });
  });
}

/** Desinstala pelo comando registrado no Windows (já vem com o caminho entre aspas). */
export function runUninstall(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, windowsHide: true });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`A desinstalação terminou com código ${code}.`))));
  });
}

export const chaveAumid = (appId) => `HKCU\\Software\\Classes\\AppUserModelId\\${appId}`;

/**
 * Sem atalho no menu Iniciar, o Windows só mostra as notificações de um app desktop se o
 * AppUserModelID estiver registrado aqui, com nome e (opcional) ícone.
 */
export async function registrarAumid(appId, nome, icone) {
  if (!APP_ID_RE.test(appId ?? '')) return;
  const chave = chaveAumid(appId);
  await run('reg', ['add', chave, '/v', 'DisplayName', '/t', 'REG_SZ', '/d', nome, '/f']);
  if (icone) await run('reg', ['add', chave, '/v', 'IconUri', '/t', 'REG_SZ', '/d', icone, '/f']);
}

export async function removerAumid(appId) {
  if (!APP_ID_RE.test(appId ?? '')) return;
  await run('reg', ['delete', chaveAumid(appId), '/f']);
}
