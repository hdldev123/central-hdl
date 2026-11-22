import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseLatestYml, compareVersions, download, latestRelease, latestPackage } from '../lib/releases.js';
import { parseRegistry, findInstalled, folderOf, chaveAumid, programaDoRegistro } from '../lib/windows.js';
import { entrar, renovar, perfil, sair, cadastrar } from '../lib/conta.js';
import { lerInstalado, instalarPacote, removerInstalado, recuperarTrocas, esperarAte } from '../lib/gerenciados.js';
import { validateCatalog } from '../lib/catalog.js';
import { createLog } from '../lib/log.js';
import { appRestrito, temAcesso } from '../lib/acesso.js';

test('latest.yml do electron-builder', () => {
  const yml = [
    'version: 0.4.0',
    'files:',
    '  - url: Prosa-Setup-0.4.0.exe',
    '    sha512: AAAfiles==',
    '    size: 121705106',
    'path: Prosa-Setup-0.4.0.exe',
    'sha512: BBBtopo==',
    "releaseDate: '2026-10-25T12:00:00.000Z'",
    '',
  ].join('\r\n');
  assert.deepEqual(parseLatestYml(yml), {
    version: '0.4.0', file: 'Prosa-Setup-0.4.0.exe', sha512: 'BBBtopo==', size: 121705106, releaseDate: '2026-10-25T12:00:00.000Z', appId: null,
  });
  assert.throws(() => parseLatestYml('version: 1.0.0'), /incompleto/);
});

test('comparação de versões', () => {
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0'), 0);
  assert.equal(compareVersions('v1.2.3', '1.2.4'), -1);
  assert.equal(compareVersions('1.0.0-beta.1', '1.0.0'), -1);
  assert.equal(compareVersions('1.0.0', '1.0.0-beta.1'), 1);
});

test('registro do Windows: apps instalados', () => {
  const out = [
    '',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\5f1c-guid',
    '    DisplayName    REG_SZ    Prosa 0.3.0',
    '    DisplayVersion    REG_SZ    0.3.0',
    '    InstallLocation    REG_SZ    C:\\Users\\x\\AppData\\Local\\Programs\\Prosa',
    '    QuietUninstallString    REG_SZ    "C:\\Users\\x\\AppData\\Local\\Programs\\Prosa\\Uninstall Prosa.exe" /currentuser /S',
    '',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SemNome',
    '    NoModify    REG_DWORD    0x1',
    '',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Outro',
    '    DisplayName    REG_SZ    Prosador Pro',
  ].join('\r\n');
  const entries = parseRegistry(out);
  assert.equal(entries.length, 2);
  const programs = entries.map((e) => ({ displayName: e.values.DisplayName, version: e.values.DisplayVersion }));
  assert.equal(findInstalled(programs, 'Prosa')?.version, '0.3.0');
  assert.equal(findInstalled(programs, 'Prosa Beta'), null);
  // outro programa que só começa com o mesmo nome não é confundido com o app
  const outros = [{ displayName: 'Prosa Editor 2.0', version: '2.0' }, { displayName: 'Prosa', version: '1.0.0' }];
  assert.equal(findInstalled(outros, 'Prosa')?.version, '1.0.0');
  assert.equal(findInstalled([{ displayName: 'Prosa Editor 2.0' }], 'Prosa'), null);
  assert.equal(findInstalled([{ displayName: 'Prosa 1.2.0-beta.1', version: '1.2.0-beta.1' }], 'Prosa')?.version, '1.2.0-beta.1');
  assert.match(entries[0].values.QuietUninstallString, /Uninstall Prosa\.exe" \/currentuser \/S$/);
  assert.equal(folderOf('"C:\\Users\\x\\Programs\\Prosa\\Uninstall Prosa.exe" /currentuser'), 'C:\\Users\\x\\Programs\\Prosa');
  assert.equal(folderOf(''), null);
  // do usuário (HKCU) a Central remove sozinha; de todos os usuários (HKLM) pede UAC
  assert.equal(programaDoRegistro(entries[0]).maquina, false);
  assert.equal(programaDoRegistro(entries[0]).uninstall, entries[0].values.QuietUninstallString);
  const maquina = parseRegistry([
    'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\guid',
    '    DisplayName    REG_SZ    Fluxo 1.2.0',
    '    UninstallString    REG_SZ    "C:\\Program Files\\Fluxo\\Uninstall Fluxo.exe" /allusers',
  ].join('\r\n'))[0];
  assert.deepEqual(programaDoRegistro(maquina), {
    displayName: 'Fluxo 1.2.0', version: null, location: 'C:\\Program Files\\Fluxo',
    uninstall: '"C:\\Program Files\\Fluxo\\Uninstall Fluxo.exe" /allusers /S', maquina: true,
  });
});

test('download confere o SHA-512 e apaga arquivo adulterado', async () => {
  const body = Buffer.from('instalador de teste');
  const sha512 = crypto.createHash('sha512').update(body).digest('base64');
  const fakeFetch = async () => new Response(body, { headers: { 'content-length': String(body.length) } });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'central-teste-'));
  try {
    const ok = path.join(dir, 'ok.exe');
    let last = null;
    await download(fakeFetch, { url: 'x', sha512 }, ok, (got, total) => { last = [got, total]; });
    assert.deepEqual(fs.readFileSync(ok), body);
    assert.deepEqual(last, [body.length, body.length]);
    const bad = path.join(dir, 'ruim.exe');
    await assert.rejects(download(fakeFetch, { url: 'x', sha512: 'outro' }, bad), /SHA-512/);
    assert.equal(fs.existsSync(bad), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('conta HDL: entrar, renovar, perfil e mensagens de erro', async () => {
  const cfg = { url: 'https://exemplo.supabase.co', chave: 'anon' };
  const chamadas = [];
  const resposta = (status, corpo) => async (url, init) => {
    chamadas.push({ url, init });
    return new Response(corpo === undefined ? null : JSON.stringify(corpo), { status });
  };

  const ok = { access_token: 'a1', refresh_token: 'r1', expires_at: 2000000000, user: { email: 'ana@hdl.com' } };
  const s = await entrar(resposta(200, ok), cfg, ' ana@hdl.com ', 'segredo');
  assert.deepEqual(s, { accessToken: 'a1', refreshToken: 'r1', expiraEm: 2000000000000, email: 'ana@hdl.com' });
  assert.match(chamadas[0].url, /\/auth\/v1\/token\?grant_type=password$/);
  assert.equal(chamadas[0].init.headers.apikey, 'anon');
  assert.deepEqual(JSON.parse(chamadas[0].init.body), { email: 'ana@hdl.com', password: 'segredo' });

  // os dois formatos de erro do Supabase
  await assert.rejects(entrar(resposta(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }), cfg, 'a@b', 'x'), /E-mail ou senha incorretos/);
  await assert.rejects(entrar(resposta(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }), cfg, 'a@b', 'x'), /E-mail ou senha incorretos/);
  await assert.rejects(entrar(resposta(200, ok), cfg, '', 'x'), /Informe o e-mail/);

  // renovar: recusa do servidor invalida a sessão; falta de rede não
  const recusa = await renovar(resposta(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }), cfg, 'r1').catch((e) => e);
  assert.equal(recusa.invalida, true);
  const offline = await renovar(async () => { throw new TypeError('fetch failed'); }, cfg, 'r1').catch((e) => e);
  assert.equal(offline.semConexao, true);
  assert.equal(offline.invalida, false);
  const fora = await renovar(resposta(503, {}), cfg, 'r1').catch((e) => e);
  assert.equal(fora.semConexao, true);

  // perfil (account_status): só os campos usados, cor validada, situação e papel em português
  const p = await perfil(resposta(200, { id: 7, username: 'ana', displayName: 'Ana Lima', avatarColor: '#2f6f5e', status: 'active', hdlRole: 'admin', isAdmin: true }), cfg, 'a1');
  assert.deepEqual(p, { id: 7, usuario: 'ana', nome: 'Ana Lima', cor: '#2f6f5e', situacao: 'ativa', papel: 'admin', admin: true, tags: [], regras: null });
  assert.ok(chamadas.some((c) => /\/rest\/v1\/rpc\/account_status$/.test(c.url)));
  assert.ok(chamadas.every((c) => c.init.headers.authorization === 'Bearer a1' || !/rpc/.test(c.url)));
  const pendente = await perfil(resposta(200, { id: 8, username: 'bia', avatarColor: 'red;background:url(x)', status: 'pending', hdlRole: null, isAdmin: false }), cfg, 'a1');
  assert.equal(pendente.cor, null);
  assert.equal(pendente.nome, 'bia');
  assert.equal(pendente.situacao, 'pendente');
  assert.equal(pendente.admin, false);
  await assert.rejects(perfil(resposta(200, null), cfg, 'a1'), /perfil/);

  chamadas.length = 0;
  await sair(resposta(204), cfg, 'a1');
  assert.match(chamadas[0].url, /\/auth\/v1\/logout\?scope=local$/);
});

test('conta HDL: cadastro com convite', async () => {
  const cfg = { url: 'https://exemplo.supabase.co', chave: 'pub' };
  const dados = { email: ' bia@hdl.com ', codigo: 'ABCD-EFGH-JKLM', usuario: 'Bia', nome: 'Bia Souza', senha: '12345678' };
  // responde conforme o caminho: check_signup e depois signup
  const servidor = (checagem, signup) => {
    const chamadas = [];
    const fetch = async (url, init) => {
      chamadas.push({ url, corpo: init.body ? JSON.parse(init.body) : null, auth: init.headers.authorization });
      const [status, corpo] = url.includes('check_signup') ? checagem : signup;
      return new Response(corpo === undefined ? null : JSON.stringify(corpo), { status });
    };
    return { fetch, chamadas };
  };

  const ok = servidor([200, null], [200, { access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { email: 'bia@hdl.com' } }]);
  const s = await cadastrar(ok.fetch, cfg, dados);
  assert.equal(s.refreshToken, 'r');
  assert.deepEqual(ok.chamadas[0].corpo, { p_username: 'bia', p_code: 'ABCD-EFGH-JKLM', p_email: 'bia@hdl.com' });
  assert.equal(ok.chamadas[0].auth, undefined); // conferência antes de ter conta: sem token
  assert.deepEqual(ok.chamadas[1].corpo.data, { username: 'bia', display_name: 'Bia Souza', registration_code: 'ABCD-EFGH-JKLM' });

  // o banco recusa o convite: a mensagem dele aparece e o cadastro nem é tentado
  const recusa = servidor([200, 'Convite inválido, vencido ou de outro e-mail. Peça um convite a um administrador da HDL.'], [500, {}]);
  await assert.rejects(cadastrar(recusa.fetch, cfg, dados), /Convite inválido/);
  assert.equal(recusa.chamadas.length, 1);

  // convite revogado entre a conferência e o cadastro: o gatilho do banco recusa (500)
  await assert.rejects(cadastrar(servidor([200, null], [500, { msg: 'Database error saving new user' }]).fetch, cfg, dados), /Confira o código/);
  // projeto com confirmação de e-mail ligada: conta criada sem sessão
  await assert.rejects(cadastrar(servidor([200, null], [200, { id: 'x', email: 'bia@hdl.com' }]).fetch, cfg, dados), /confirmado/);
  await assert.rejects(cadastrar(ok.fetch, cfg, { ...dados, senha: '123' }), /8 caracteres/);
  await assert.rejects(cadastrar(ok.fetch, cfg, { ...dados, codigo: ' ' }), /Preencha/);
});

/** fetch que manda um pedaço e depois trava, como uma conexão que caiu; respeita o signal como o fetch real. */
const fetchTravado = async (_url, { signal } = {}) => new Response(new ReadableStream({
  start(c) {
    c.enqueue(new Uint8Array([1, 2, 3]));
    signal?.addEventListener('abort', () => c.error(signal.reason));
  },
}));

test('download travado desiste em vez de prender a Central', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'central-teste-'));
  try {
    const dest = path.join(dir, 'travado.exe');
    await assert.rejects(download(fetchTravado, { url: 'x', sha512: 'y' }, dest, null, { stallMs: 50 }), /parou de receber dados/);
    assert.equal(fs.existsSync(dest), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('erro ao gravar o download vira rejeição, sem derrubar o processo', async () => {
  const body = Buffer.from('instalador');
  const fakeFetch = async () => new Response(body);
  const dest = path.join(os.tmpdir(), 'central-pasta-que-nao-existe', 'x.exe');
  await assert.rejects(download(fakeFetch, { url: 'x', sha512: 'y' }, dest), /ENOENT/);
});

test('latest.yml sem resposta desiste no prazo', async () => {
  // como uma conexão aberta, o intervalo mantém o processo vivo (o timer do AbortSignal.timeout sozinho não mantém)
  const fetchMudo = (_url, { signal }) => new Promise((_r, reject) => {
    const aberta = setInterval(() => {}, 1000);
    signal.addEventListener('abort', () => { clearInterval(aberta); reject(signal.reason); });
  });
  await assert.rejects(latestRelease(fetchMudo, 'dono/repo', { timeoutMs: 50 }), /não respondeu a tempo/);
});

test('catálogo: entradas inválidas são descartadas sem derrubar as outras', () => {
  const ok = { id: 'prosa', nome: 'Prosa', repo: 'hdldev123/prosa-releases', executavel: 'Prosa.exe', icone: 'https://x/p.png' };
  const { apps, problemas } = validateCatalog({
    apps: [
      ok,
      { ...ok, id: 'prosa' }, // id repetido
      { ...ok, id: 'fora', executavel: '..\\..\\Windows\\explorer.exe' }, // pastas no executável
      { ...ok, id: 'fora2', executavel: '../x/Prosa.exe' },
      { ...ok, id: 'sem-repo', repo: 'https://github.com/x/y' },
      { ...ok, id: 'Maiusculo' },
      { ...ok, id: 'icone', icone: 'javascript:alert(1)' },
      { ...ok, id: 'meu-app', nome: 'Meu App', executavel: 'Meu App (x64).exe', nomeWindows: 'Meu App' },
      null,
    ],
  });
  assert.deepEqual(apps.map((a) => a.id), ['prosa', 'meu-app']);
  assert.equal(problemas.length, 7);
  assert.match(problemas[0], /entrada 2 \(prosa\): id repetido/);
  assert.match(problemas[1], /executavel/);
  assert.match(problemas[2], /executavel/);
  assert.throws(() => validateCatalog({ aplicativos: [] }), /lista "apps"/);
});

test('registro em arquivo vira .old ao passar do limite', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'central-log-'));
  try {
    const log = createLog(dir, { maxBytes: 200 });
    for (let i = 0; i < 10; i++) log.info(`linha ${i} ${'x'.repeat(40)}`);
    log.error('último');
    const atual = fs.readFileSync(path.join(dir, 'central.log'), 'utf8');
    assert.ok(fs.existsSync(path.join(dir, 'central.old.log')));
    assert.ok(atual.length < 400);
    assert.match(atual, /ERRO  último\n$/);
    createLog(path.join(dir, 'arquivo.txt', 'sub')); // pasta impossível: não lança
    fs.writeFileSync(path.join(dir, 'arquivo.txt'), '');
    createLog(path.join(dir, 'arquivo.txt', 'sub')).error('não derruba');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('tags de acesso: catálogo e perfil', async () => {
  const base = { nome: 'Fluxo', repo: 'hdldev123/fluxo-releases', executavel: 'Fluxo.exe' };
  const { apps, problemas } = validateCatalog({
    apps: [
      { ...base, id: 'fluxo', tag: 'fluxo' },
      { ...base, id: 'livre' },                 // sem tag: livre para todos
      { ...base, id: 'god', tag: 'godmod' },    // godmod não é tag de app
      { ...base, id: 'maiuscula', tag: 'Fluxo' },
      { ...base, id: 'curta', tag: 'f' },
    ],
  });
  assert.deepEqual(apps.map((a) => a.id), ['fluxo', 'livre']);
  assert.equal(problemas.length, 3);
  assert.match(problemas[0], /god.*tag/);

  const cfg = { url: 'https://exemplo.supabase.co', chave: 'pub' };
  const resposta = (corpo) => async () => new Response(JSON.stringify(corpo), { status: 200 });
  const p = await perfil(resposta({ id: 1, username: 'ana', status: 'active', hdlRole: 'admin', isAdmin: true, tags: ['fluxo', 'godmod', 'Inválida', 7] }), cfg, 't');
  assert.deepEqual(p.tags, ['fluxo', 'godmod']);
  const antigo = await perfil(resposta({ id: 2, username: 'bia', status: 'active' }), cfg, 't'); // banco sem a migração de tags
  assert.deepEqual(antigo.tags, []);
});

test('acesso aos apps: regra do banco vence o catálogo', () => {
  const livre = { id: 'prosa' };
  const comTag = { id: 'fluxo', tag: 'fluxo' };
  // sem regra no banco: o tag do catálogo é o padrão
  assert.equal(appRestrito(livre, {}), false);
  assert.equal(appRestrito(comTag, {}), true);
  assert.equal(appRestrito(comTag, null), true);
  // a regra do banco vence, nos dois sentidos
  assert.equal(appRestrito(comTag, { fluxo: false }), false);
  assert.equal(appRestrito(livre, { prosa: true }), true);
  // livre: todo mundo; restrito: a tag é o id do app, ou godmod
  assert.equal(temAcesso(livre, [], {}), true);
  assert.equal(temAcesso(comTag, [], null), false);
  assert.equal(temAcesso(comTag, ['fluxo'], null), true);
  assert.equal(temAcesso(comTag, ['financeiro'], {}), false);
  assert.equal(temAcesso(comTag, ['godmod'], {}), true);
  assert.equal(temAcesso(comTag, [], { fluxo: false }), true);
  assert.equal(temAcesso(livre, [], { prosa: true }), false);
  assert.equal(temAcesso(livre, ['prosa'], { prosa: true }), true);
  // sem tag no catálogo, o id é a tag; o tag antigo do catálogo ainda vale por compatibilidade
  assert.equal(temAcesso({ id: 'fluxo', tag: 'outro' }, ['outro'], {}), true);
  assert.equal(temAcesso({ id: 'fluxo', tag: 'outro' }, ['fluxo'], {}), true);
});

test('perfil: regras do banco, conta removida e banco sem a função', async () => {
  const cfg = { url: 'https://exemplo.supabase.co', chave: 'pub' };
  const conta = { id: 3, username: 'caio', status: 'removed' };
  const servidor = (regras) => async (url) => (url.endsWith('/app_access_rules') ? regras() : new Response(JSON.stringify(conta), { status: 200 }));
  const p = await perfil(servidor(() => new Response(JSON.stringify({ rules: [
    { appId: 'fluxo', restricted: true }, { appId: 'prosa', restricted: false }, { appId: 'x', restricted: 'sim' }, null,
  ] }), { status: 200 })), cfg, 't');
  assert.equal(p.situacao, 'removida');
  assert.deepEqual(p.regras, { fluxo: true, prosa: false });
  // função ainda não existe no banco (404 / PGRST202) ou outro erro: o login segue, com o catálogo
  const sem = await perfil(servidor(() => new Response(JSON.stringify({ code: 'PGRST202', message: 'not found' }), { status: 404 })), cfg, 't');
  assert.equal(sem.regras, null);
  const rede = await perfil(servidor(() => { throw new TypeError('fetch failed'); }), cfg, 't');
  assert.equal(rede.regras, null);
});

const CENTRAL_YML = [
  'version: 1.3.0',
  'path: Fluxo-1.3.0-win.zip',
  'sha512: ZZZpacote==',
  'size: 153974102',
  'appId: br.hdl.fluxo',
  "releaseDate: '2026-11-22T19:48:09.208Z'",
  '',
].join('\n');

test('central.yml: lê o appId e recusa valor inválido', () => {
  assert.deepEqual(parseLatestYml(CENTRAL_YML), {
    version: '1.3.0', file: 'Fluxo-1.3.0-win.zip', sha512: 'ZZZpacote==', size: 153974102,
    releaseDate: '2026-11-22T19:48:09.208Z', appId: 'br.hdl.fluxo',
  });
  assert.equal(parseLatestYml(CENTRAL_YML.replace('br.hdl.fluxo', 'a b/c')).appId, null);
});

test('latestPackage: 404 é null; 200 devolve o pacote com a URL de download', async () => {
  assert.equal(await latestPackage(async () => new Response('', { status: 404 }), 'dono/repo'), null);
  let pedido = null;
  const ok = await latestPackage(async (url) => { pedido = url; return new Response(CENTRAL_YML); }, 'dono/repo');
  assert.equal(pedido, 'https://github.com/dono/repo/releases/latest/download/central.yml');
  assert.equal(ok.formato, 'pacote');
  assert.equal(ok.appId, 'br.hdl.fluxo');
  assert.equal(ok.url, 'https://github.com/dono/repo/releases/download/v1.3.0/Fluxo-1.3.0-win.zip');
  assert.equal(ok.notesUrl, 'https://github.com/dono/repo/releases/tag/v1.3.0');
  await assert.rejects(latestPackage(async () => new Response('', { status: 500 }), 'dono/repo'), /500/);
});

test('latestRelease marca o formato instalador', async () => {
  const yml = 'version: 1.0.0\npath: Setup.exe\nsha512: abc==\n';
  assert.equal((await latestRelease(async () => new Response(yml), 'dono/repo')).formato, 'instalador');
});

const TAR = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');

/** Monta um .zip de verdade com o tar do Windows: o .exe na raiz e resources/ como no win-unpacked. */
function montarZip(dir, nome, { exe = 'App.exe', marca = 'v1' } = {}) {
  const fonte = fs.mkdtempSync(path.join(dir, 'fonte-'));
  fs.mkdirSync(path.join(fonte, 'resources'));
  if (exe) fs.writeFileSync(path.join(fonte, exe), marca);
  fs.writeFileSync(path.join(fonte, 'resources', 'app.asar'), marca);
  fs.writeFileSync(path.join(fonte, 'resources', 'app-update.yml'), 'provider: github');
  const zip = path.join(dir, nome);
  execFileSync(TAR, ['-a', '-cf', zip, '-C', fonte, '.']);
  return zip;
}

test('pacote: instala, atualiza, preserva a versão em uso se o pacote for ruim e remove', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'central-teste-'));
  const base = path.join(dir, 'apps');
  const opts = { appId: 'br.hdl.fluxo', executavel: 'App.exe' };
  try {
    assert.equal(lerInstalado(base, 'fluxo'), null);

    // primeira instalação
    await instalarPacote(base, 'fluxo', montarZip(dir, 'v1.zip', { marca: 'v1' }), { ...opts, versao: '1.0.0' });
    const ger = lerInstalado(base, 'fluxo');
    assert.deepEqual(ger, { versao: '1.0.0', appId: 'br.hdl.fluxo', pasta: path.join(base, 'fluxo', 'app') });
    assert.equal(fs.readFileSync(path.join(ger.pasta, 'App.exe'), 'utf8'), 'v1');
    assert.equal(fs.existsSync(path.join(ger.pasta, 'resources', 'app-update.yml')), false);
    assert.equal(fs.existsSync(path.join(ger.pasta, 'resources', 'app.asar')), true);
    const json = JSON.parse(fs.readFileSync(path.join(base, 'fluxo', 'instalado.json'), 'utf8'));
    assert.equal(json.versao, '1.0.0');
    assert.equal(json.appId, 'br.hdl.fluxo');
    assert.deepEqual(fs.readdirSync(path.join(base, 'fluxo')).sort(), ['app', 'instalado.json']);

    // atualização: troca e apaga a versão antiga
    await instalarPacote(base, 'fluxo', montarZip(dir, 'v2.zip', { marca: 'v2' }), { ...opts, versao: '2.0.0' });
    assert.equal(lerInstalado(base, 'fluxo').versao, '2.0.0');
    assert.equal(fs.readFileSync(path.join(ger.pasta, 'App.exe'), 'utf8'), 'v2');
    assert.deepEqual(fs.readdirSync(path.join(base, 'fluxo')).sort(), ['app', 'instalado.json']);

    // pacote sem o exe: erro e a versão em uso continua
    await assert.rejects(
      instalarPacote(base, 'fluxo', montarZip(dir, 'ruim.zip', { exe: null }), { ...opts, versao: '3.0.0' }),
      /não tem o App\.exe/,
    );
    assert.equal(lerInstalado(base, 'fluxo').versao, '2.0.0');
    assert.equal(fs.readFileSync(path.join(ger.pasta, 'App.exe'), 'utf8'), 'v2');
    assert.deepEqual(fs.readdirSync(path.join(base, 'fluxo')).sort(), ['app', 'instalado.json']);

    // sem o json ou sem a pasta app, não conta como instalado
    fs.rmSync(path.join(base, 'fluxo', 'instalado.json'));
    assert.equal(lerInstalado(base, 'fluxo'), null);
    fs.writeFileSync(path.join(base, 'fluxo', 'instalado.json'), '{"versao":"2.0.0"}');
    assert.equal(lerInstalado(base, 'fluxo').versao, '2.0.0');
    fs.rmSync(path.join(base, 'fluxo', 'app'), { recursive: true });
    assert.equal(lerInstalado(base, 'fluxo'), null);

    await instalarPacote(base, 'fluxo', montarZip(dir, 'v4.zip'), { ...opts, versao: '4.0.0' });
    assert.equal(removerInstalado(base, 'fluxo'), true);
    assert.equal(fs.existsSync(path.join(base, 'fluxo')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('pacote: troca interrompida (app/ já virou antigo/) é recuperada na abertura e na instalação seguinte', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'central-teste-'));
  const base = path.join(dir, 'apps');
  const opts = { appId: 'br.hdl.fluxo', executavel: 'App.exe' };
  const interromper = () => fs.renameSync(path.join(base, 'fluxo', 'app'), path.join(base, 'fluxo', 'antigo'));
  try {
    await instalarPacote(base, 'fluxo', montarZip(dir, 'v1.zip', { marca: 'v1' }), { ...opts, versao: '1.0.0' });

    // abertura da Central
    interromper();
    assert.equal(lerInstalado(base, 'fluxo'), null);
    assert.deepEqual(recuperarTrocas(base), ['fluxo']);
    assert.equal(lerInstalado(base, 'fluxo').versao, '1.0.0');
    assert.deepEqual(recuperarTrocas(base), []);
    assert.deepEqual(recuperarTrocas(path.join(dir, 'nao-existe')), []);

    // a instalação seguinte não apaga a única cópia antes de recuperá-la; se o pacote for ruim, ela continua
    interromper();
    await assert.rejects(instalarPacote(base, 'fluxo', montarZip(dir, 'ruim.zip', { exe: null }), { ...opts, versao: '2.0.0' }));
    assert.equal(lerInstalado(base, 'fluxo').versao, '1.0.0');
    assert.equal(fs.readFileSync(path.join(base, 'fluxo', 'app', 'App.exe'), 'utf8'), 'v1');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('esperarAte: resolve quando a condição vira verdadeira e desiste no prazo', async () => {
  let pronto = false;
  setTimeout(() => { pronto = true; }, 200);
  assert.equal(await esperarAte(async () => pronto, { ms: 5000, intervalo: 50 }), true);
  assert.equal(await esperarAte(async () => false, { ms: 150, intervalo: 50 }), false);
});

test('notificações: chave do AppUserModelID no registro do usuário', () => {
  assert.equal(chaveAumid('br.hdl.fluxo'), 'HKCU\\Software\\Classes\\AppUserModelId\\br.hdl.fluxo');
});
