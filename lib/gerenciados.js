// Apps instalados pela própria Central: ficam em %LOCALAPPDATA%\Central HDL\apps\<id>, sem atalhos
// e sem entrada em "Aplicativos instalados". Só a Central os atualiza.
//
// Layout por app: app/ (versão em uso, com o .exe), instalado.json, icone.png (opcional)
// e, só durante a troca, novo/ e antigo/.

import { createRequire } from 'node:module';
import nodeFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

// No Electron o fs trata .asar como pasta e o rmSync falha em resources/app.asar; o original-fs não.
const fs = process.versions.electron ? createRequire(import.meta.url)('original-fs') : nodeFs;

const RM = { recursive: true, force: true, maxRetries: 3, retryDelay: 500 };
// o antivírus costuma varrer a pasta recém-extraída (centenas de MB) por alguns segundos
const TROCA_TENTATIVAS = 10;
const TROCA_ESPERA_MS = 1000;
const EXTRAIR_TIMEOUT_MS = 10 * 60 * 1000;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pasta dos apps. Fora da pasta de instalação da Central: a atualização dela apaga a própria pasta. */
export function pastaApps() {
  return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Central HDL', 'apps');
}

/** { versao, appId, pasta } do app instalado pela Central, ou null. */
export function lerInstalado(base, id) {
  const pasta = path.join(base, id, 'app');
  try {
    const info = JSON.parse(fs.readFileSync(path.join(base, id, 'instalado.json'), 'utf8'));
    if (typeof info?.versao !== 'string' || !info.versao || !fs.statSync(pasta).isDirectory()) return null;
    return { versao: info.versao, appId: typeof info.appId === 'string' ? info.appId : null, pasta };
  } catch {
    return null;
  }
}

/**
 * A Central fechou no meio de uma troca (app/ já virou antigo/ e novo/ ainda não virou app/): devolve a
 * versão em uso, que é a do instalado.json (ele só muda depois da troca). Só onde não há instalação
 * em andamento: na abertura da Central e no começo de cada instalação.
 */
export function recuperarTroca(base, id) {
  const app = path.join(base, id, 'app');
  const antigo = path.join(base, id, 'antigo');
  if (fs.existsSync(app) || !fs.existsSync(antigo)) return false;
  fs.renameSync(antigo, app);
  return true;
}

/** recuperarTroca de todos os apps da pasta (na abertura da Central). Devolve os ids recuperados. */
export function recuperarTrocas(base) {
  let ids = [];
  try { ids = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
  return ids.filter((id) => { try { return recuperarTroca(base, id); } catch { return false; } });
}

/** Extrai o .zip com o tar do Windows (caminho absoluto: nunca o que estiver no PATH). */
export function extrair(zip, destino) {
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  return new Promise((resolve, reject) => {
    execFile(tar, ['-xf', zip, '-C', destino], { windowsHide: true, timeout: EXTRAIR_TIMEOUT_MS }, (err, _out, stderr) => {
      if (err) reject(new Error(`Não foi possível extrair o pacote (${String(stderr || err.message).trim()})`));
      else resolve();
    });
  });
}

/** Renomeia tentando de novo: antivírus ou um app recém-fechado podem segurar arquivos por instantes. */
async function renomear(de, para) {
  for (let i = 1; ; i++) {
    try {
      return fs.renameSync(de, para);
    } catch (err) {
      if (i >= TROCA_TENTATIVAS) throw err;
      await espera(TROCA_ESPERA_MS);
    }
  }
}

/**
 * Instala (ou troca) a versão do app a partir do .zip já conferido. Extrai ao lado, valida e só então
 * troca; se algo falhar antes da troca, a versão em uso continua intacta.
 */
export async function instalarPacote(base, id, zip, { versao, appId, executavel }) {
  const raiz = path.join(base, id);
  const [app, novo, antigo] = ['app', 'novo', 'antigo'].map((p) => path.join(raiz, p));
  fs.mkdirSync(raiz, { recursive: true });
  recuperarTroca(base, id); // antes de limpar antigo/: depois de uma queda ele pode ser a única cópia
  for (const resto of [novo, antigo]) {
    try { fs.rmSync(resto, RM); } catch { /* sobra de uma troca interrompida */ }
  }
  fs.mkdirSync(novo, { recursive: true });
  try {
    await extrair(zip, novo);
    if (!fs.existsSync(path.join(novo, executavel))) throw new Error(`O pacote não tem o ${executavel}.`);
  } catch (err) {
    try { fs.rmSync(novo, RM); } catch { /* best effort */ }
    throw err;
  }
  // sem o app-update.yml o app não se autoatualiza: a Central passa a ser a única que atualiza
  fs.rmSync(path.join(novo, 'resources', 'app-update.yml'), { force: true });

  const tinhaApp = fs.existsSync(app);
  if (tinhaApp) await renomear(app, antigo);
  try {
    await renomear(novo, app);
  } catch (err) {
    // devolve a versão em uso; se nem isso der, lerInstalado tenta de novo na próxima leitura
    if (tinhaApp) await renomear(antigo, app).catch(() => {});
    throw err;
  }
  fs.writeFileSync(path.join(raiz, 'instalado.json'), JSON.stringify({ versao, appId: appId ?? null, instaladoEm: new Date().toISOString() }, null, 2));
  try { fs.rmSync(antigo, RM); } catch { /* a próxima instalação limpa */ }
}

/**
 * Apaga o app e tudo o que a Central guardou dele. O instalado.json sai primeiro: sem ele o app já
 * conta como desinstalado, mesmo que algum arquivo preso fique para trás (a próxima instalação ou a
 * desinstalação da Central limpam). Devolve false se sobrou algo.
 */
export function removerInstalado(base, id) {
  const raiz = path.join(base, id);
  fs.rmSync(path.join(raiz, 'instalado.json'), { force: true });
  try {
    fs.rmSync(raiz, RM);
    return true;
  } catch {
    return false;
  }
}

/** Espera `condicao()` (async) ficar verdadeira; false se passar do prazo. */
export async function esperarAte(condicao, { ms = 60000, intervalo = 500 } = {}) {
  const limite = Date.now() + ms;
  while (!(await condicao())) {
    if (Date.now() >= limite) return false;
    await espera(intervalo);
  }
  return true;
}
