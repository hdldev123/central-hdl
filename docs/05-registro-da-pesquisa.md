# 5. Registro da pesquisa

> Conversa de 10 e 11/11/2026 entre Matheus Meigre e o Claude Code (assistente de programação), no repositório `central-hdl`. [← Voltar ao índice](README.md)

## O pedido original

O ponto de partida foi um briefing para publicar a Central na Microsoft Store. Resumo:

- **Contexto:** a Central é distribuída como instalador `.exe` sem assinatura, e o SmartScreen mostra "O Windows protegeu o computador / Fornecedor desconhecido" na instalação.
- **Objetivo:** publicar a Central na Microsoft Store como pacote MSIX, para a Microsoft assinar o app e o aviso sumir, sem custo de certificado. A conta de empresa na Store seria criada em nome da HDL (o briefing diz que ela é gratuita desde maio/2026).
- **Requisitos pedidos:**
  1. identificar a stack e propor como gerar o MSIX;
  2. criar um canal de build separado para a Store, mantendo o `.exe` atual;
  3. deixar a identidade do pacote configurável (Name, Publisher, PublisherDisplayName "HDL Soluções");
  4. desligar a autoatualização da Central na versão da Store, mantendo a instalação e atualização dos outros apps, com detecção em tempo de execução;
  5. revisar o que muda no container MSIX (caminhos de escrita, permissões, inicialização com o Windows, protocolos, onde os apps são instalados);
  6. verificar a conformidade com as políticas da Store, principalmente sobre apps que instalam outros programas e código dinâmico.

Antes de implementar, a decisão foi **avaliar se compensa** e discutir.

## O que foi analisado

1. **O código da Central** (`main.js`, `lib/windows.js`, `lib/releases.js`, `catalogo.json`, `package.json`, `README.md`): stack Electron + electron-builder com NSIS; instalação dos apps rodando instaladores NSIS em silêncio, que gravam em `%LOCALAPPDATA%\Programs` e `HKCU`; download via `net.fetch`; login por convite.
2. **As políticas da Microsoft Store**, versão 7.20, lidas na íntegra nas seções 10.1, 10.2, 10.3 e 11.13.
3. **A documentação do MSIX** sobre virtualização de arquivos e registro.
4. **Alternativas de assinatura**: Azure Artifact Signing (preço e quem pode usar) e certificados OV/EV.

## Conclusões

| Pergunta | Resposta |
|---|---|
| Dá para gerar o MSIX? | Sim, o electron-builder tem o alvo `appx`, e o Electron detecta o empacotamento por `process.windowsStore`. |
| A Store aceitaria a Central como está? | **Não.** A regra 10.1.5 só permite obter outros produtos do mesmo publicador se eles também estiverem na Store. A exceção para lojas (10.1.6) exige 20 produtos ou mais. |
| Tiraria o aviso? | Só para quem instalar pela Store. O `.exe` do site continuaria com o aviso. |
| Funcionaria tecnicamente? | Com risco alto: os instaladores dos apps tenderiam a gravar numa área virtualizada da Central, deixando os apps "escondidos" do Windows. O conserto depende de uma permissão restrita aprovada caso a caso. |
| Quantas vezes o aviso aparece hoje? | Uma vez por pessoa (primeira instalação da Central). Atualizações e apps instalados pela Central não mostram o aviso. |
| Recomendação | Não seguir com a Store agora. Orientar no convite e decidir sobre o certificado conforme o público da Central. Detalhes no [documento 4](04-alternativas-e-recomendacao.md). |

## Histórico de atualizações

Toda vez que o estudo avançar, acrescente uma linha aqui (a mais recente embaixo).

| Data | O que avançou |
|---|---|
| 10/11/2026 | Avaliação da Microsoft Store: não compensa como está (regras 10.1.5/10.1.6 e virtualização do MSIX). |
| 11/11/2026 | Documentação criada nesta branch para o estudo com os sócios. Decisão: a branch fica só para documentação, sem PR nem merge, e é atualizada a cada avanço. |

## O que não foi verificado

- Se a conta de empresa na Store é mesmo gratuita desde maio/2026 (informação do briefing).
- Se empresas brasileiras podem usar o Azure Artifact Signing (as fontes encontradas não citam o Brasil).
- Preços de certificados OV/EV de autoridades que atendem o Brasil.
- Na prática, se o instalador iniciado por uma Central empacotada em MSIX fica mesmo virtualizado (só um teste confirma).

## Fontes

- [Microsoft Store Policies 7.20](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies): regras 10.1.5, 10.1.6, 10.2.2, 10.2.3, 10.2.9, 10.3.1 e 11.13
- [MSIX: flexible virtualization](https://learn.microsoft.com/en-us/windows/msix/desktop/flexible-virtualization)
- [Manifesto MSIX: FileSystemWriteVirtualization](https://learn.microsoft.com/en-ie/uwp/schemas/appxpackage/uapmanifestschema/element-virtualization-filesystemwritevirtualization)
- [Relato de virtualização herdada por processos filhos em MSIX](https://claudeissues.com/issue/93152-bug-windows-msix-desktop-app-claude-code-sessions-inherit-appdata-filesystem-vir) (fonte de terceiros)
- [Microsoft: opções de assinatura de código para apps Windows](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- [Azure Artifact Signing: preço](https://www.gdgsoft.com/faq/azure-trusted-signing-cost-effective-exe-code-signing)
- [DevClass sobre o Azure Artifact Signing (jan/2026)](https://www.devclass.com/security/2026/01/14/code-signing-windows-apps-may-be-easier-and-more-secure-with-new-azure-artifact-service/4079554)
