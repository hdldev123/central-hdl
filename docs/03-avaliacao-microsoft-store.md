# 3. Avaliação: publicar a Central na Microsoft Store

> Pesquisa feita em 10/11/2026. Regras consultadas: **Microsoft Store Policies versão 7.20** (atualizada em 14/09/2026). [← Voltar ao índice](README.md)

## A ideia

Empacotar a Central como **MSIX** (o formato de pacote da Microsoft Store) e publicar com a conta de desenvolvedor de empresa da HDL. Quando um MSIX é publicado, **a própria Microsoft assina o pacote**, então quem instala pela Store não vê o aviso do SmartScreen, sem a HDL pagar certificado.

## Conclusão

**Do jeito que a Central funciona hoje, não compensa.** Três motivos:

1. **As regras da Store proíbem o que a Central faz**: instalar programas que vêm de fora da Store.
2. **Não resolve o aviso do site**: só quem instalar pela Store deixa de ver o aviso. O `.exe` do site continua igual.
3. **O pacote MSIX quebraria a instalação dos outros apps** (ver a seção técnica), e consertar isso depende de uma permissão especial que a Store aprova caso a caso.

Gerar o pacote em si é fácil (o electron-builder já tem o alvo `appx`). O que impede é a regra e o funcionamento do container, não a ferramenta.

## 1. O que as regras da Store dizem

Trechos da [Microsoft Store Policies 7.20](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies):

| Regra | O que diz | Impacto na Central |
|---|---|---|
| **10.1.5** | O app pode levar o usuário a obter outros produtos do mesmo publicador *"desde que esses produtos também sejam distribuídos pela Store e a obtenção seja feita pela Store"*. | **Bloqueia.** A Central baixa Prosa, Fluxo etc. do GitHub e instala direto. |
| **10.1.6** | "Lojas" (apps cuja função principal é distribuir outros produtos) são permitidas, mas precisam de um catálogo com **no mínimo 20 produtos distintos**. | **Não se aplica.** O catálogo tem 5 apps. |
| **11.13** | Lojas precisam publicar termos para quem distribui, oferecer um canal de denúncia e moderar o conteúdo. | Estrutura que não faz sentido para uma loja interna. |
| **10.2.2** | O app não pode mudar ou ampliar o que faz baixando e rodando código depois de instalado, de forma diferente do que está descrito. | Defensável (tudo é software da HDL e estaria descrito), mas a 10.1.5 já reprova antes. |
| **10.2.3** | O app não pode oferecer a instalação de software de terceiros que não melhore o próprio app. | Os apps são da HDL; o problema continua sendo a 10.1.5. |
| **10.3.1** | Se o app exige login, é preciso fornecer uma **conta demo funcionando** para os revisores. | A conta é por convite: teríamos que manter uma conta ativa para a Microsoft. |
| **10.2.9** | Também é possível publicar um `.exe`/`.msi` comum pela Store, mas ele **precisa já vir assinado** com um certificado reconhecido. | Esse caminho não economiza o certificado, que era o objetivo. |

**Resumo das regras:** para a versão da Store ser aprovada, ela teria que **deixar de instalar e atualizar os apps**, que é justamente a função principal da Central.

## 2. O que mudaria dentro do container MSIX (parte técnica)

Mesmo ignorando as regras, o pacote MSIX roda a Central num "container" que muda como o Windows trata o que ela grava.

| Ponto | Hoje (NSIS) | No MSIX | Situação |
|---|---|---|---|
| **Instaladores dos apps** | A Central roda o instalador do Prosa com `/S`, que instala em `%LOCALAPPDATA%\Programs\Prosa` e registra em `HKCU\...\Uninstall` | As gravações do instalador em `AppData` e no `HKCU` tendem a ser **redirecionadas para uma pasta privada da Central** (virtualização). O Prosa não apareceria no Menu Iniciar nem em "Aplicativos instalados", e seria apagado junto se a Central fosse desinstalada. | **Crítico.** Para desligar a virtualização é preciso a permissão restrita `unvirtualizedResources`, que a Store aprova caso a caso. Precisaria de teste para confirmar. |
| **Iniciar com o Windows** | `app.setLoginItemSettings` | Não funciona no MSIX. Precisa da extensão `StartupTask` no manifesto (o electron-builder tem a opção `addAutoLaunchExtension`), e a pessoa pode desligar pelas configurações do Windows. | Ajustável |
| **Autoatualização da Central** | electron-updater | Tem que ser **desligada** (a Store atualiza). O Electron informa se o app está empacotado (`process.windowsStore`). | Simples |
| **Configurações, sessão e logs** | `%APPDATA%\Central HDL` | Vão para a pasta virtualizada do pacote. Funciona igual para a Central. | OK |
| **Ler os apps instalados** (registro) | Lê `HKCU`/`HKLM` | A leitura funciona normalmente. | OK |
| **Protocolos e associações de arquivo** | Não usa | — | OK |
| **Identidade do pacote** | — | `Identity Name` e `Publisher` vêm do Partner Center depois de reservar o nome; `PublisherDisplayName` seria "HDL Soluções". | Configurável |

Sobre a virtualização dos processos filhos: a documentação da Microsoft descreve a opção de desligar ([flexible virtualization](https://learn.microsoft.com/en-us/windows/msix/desktop/flexible-virtualization)), mas não encontramos uma frase oficial dizendo que o instalador iniciado pela Central herda a virtualização. Os relatos de outros desenvolvedores dizem que sim. Antes de qualquer decisão nesse caminho, seria preciso um teste prático.

## 3. Caminho que respeitaria as regras (e o custo dele)

A única forma de usar a Store **dentro das regras** seria publicar **cada app** (Prosa, Fluxo, Financeiro, Mesa de Pauta, Bússola) como um MSIX próprio na Store, com visibilidade oculta ou privada. Nesse modelo:

- a Store assina e atualiza cada app;
- a Central da Store só mostraria a lista e abriria a página de cada app na Store (o que a regra 10.1.5 permite);
- seriam **5 pacotes, 5 certificações**, contas demo e a revisão da virtualização em cada app;
- a Central perderia a maior parte da razão de existir, porque a Store passaria a fazer o trabalho dela.

Esse caminho só faz sentido se a HDL quiser **presença na Store como vitrine**, por exemplo para vender apps a clientes. Ver o [documento 4](04-alternativas-e-recomendacao.md).

## Observações sobre o pedido original

- O pedido citava o instalador `Central-HDL-Setup-1.1.0.exe`; a versão atual é a **1.6.0**.
- O pedido diz que a conta de empresa na Store é gratuita desde maio/2026. Essa informação **não foi conferida** nesta pesquisa. Vale confirmar no Partner Center antes de criar a conta.
