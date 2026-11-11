# Documentação de estudo: a Central HDL e o alerta do Windows

> Branch de estudo `feature/docs-central-e-assinatura-digital`, criada em 11/11/2026 a partir da `main` (Central **v1.6.0**).
> Esta branch não muda nenhum código. Ela serve para os sócios da HDL estudarem, juntos, como a Central funciona hoje e quais caminhos existem para tirar o aviso de "software não reconhecido" que o Windows mostra na instalação.

## Por onde começar

Leia na ordem. Cada documento cabe em uns 10 minutos.

| # | Documento | O que responde | Para quem |
|---|---|---|---|
| 1 | [Como a Central HDL funciona hoje](01-como-a-central-funciona.md) | O que a Central faz, de onde vêm os apps, como se atualiza, conta e acessos, onde fica cada coisa | Todos (tem uma parte resumida no topo e os detalhes técnicos depois) |
| 2 | [O alerta do SmartScreen](02-alerta-do-smartscreen.md) | O que é o aviso "O Windows protegeu o computador", por que aparece e **quando** aparece de fato na Central | Todos |
| 3 | [Avaliação: publicar na Microsoft Store](03-avaliacao-microsoft-store.md) | Se dá para publicar a Central na Store para a Microsoft assinar, o que as regras da Store dizem e o que quebraria | Todos (a seção técnica é opcional) |
| 4 | [Alternativas e recomendação](04-alternativas-e-recomendacao.md) | Comparação das opções (custo, esforço, efeito), recomendação e **as perguntas que precisamos decidir juntos** | Todos: é o documento da reunião |
| 5 | [Registro da pesquisa](05-registro-da-pesquisa.md) | O pedido original, o que foi analisado, as conclusões e todas as fontes consultadas | Consulta, para quem quiser conferir |

O manual operacional (publicar versões, colocar um app no catálogo) continua no [README principal](../README.md).

## Resumo em quatro linhas

1. A Central é a "loja interna" da HDL: instala e mantém atualizados o Prosa, o Fluxo, o Financeiro HDL, a Mesa de Pauta e a Bússola.
2. O Windows mostra um aviso na **primeira** instalação da Central porque o instalador não tem assinatura digital. As atualizações e os apps instalados por ela **não** mostram o aviso.
3. Publicar a Central na Microsoft Store, do jeito que ela funciona hoje, **não passa** nas regras da Store e não tiraria o aviso do instalador baixado do site.
4. A recomendação é não mexer agora e decidir juntos se vale pagar por um certificado de assinatura. Isso depende de **para quem** a Central vai ser distribuída (só equipe ou clientes também).

## Como ler no GitHub

Abra a branch `feature/docs-central-e-assinatura-digital` no repositório `hdldev123/central-hdl` e entre na pasta `docs/`. O GitHub mostra os documentos formatados, com os diagramas.

Comentários e dúvidas: abra uma *issue* ou comente direto no PR desta branch, se ele for aberto.
