# 2. O alerta do SmartScreen

> [← Voltar ao índice](README.md)

## O que a pessoa vê

Ao abrir o `Central-HDL-Setup-x.y.z.exe` baixado do site ou do GitHub, o Windows mostra uma tela azul:

> **O Windows protegeu o computador**
> O Microsoft Defender SmartScreen impediu a inicialização de um aplicativo não reconhecido.
> Fornecedor: **Fornecedor desconhecido**

Para seguir, a pessoa clica em **Mais informações** e depois em **Executar assim mesmo**. Para quem não conhece, o aviso parece de vírus, e isso passa uma imagem ruim da HDL.

## Por que aparece

O SmartScreen olha duas coisas no arquivo baixado:

1. **Assinatura digital**: um "carimbo" que prova quem publicou o programa e que ele não foi alterado. Para assinar é preciso um **certificado de assinatura de código**, emitido por uma autoridade certificadora depois de verificar a empresa. Os instaladores da HDL **não são assinados**, então o Windows mostra "Fornecedor desconhecido".
2. **Reputação**: quantas pessoas já baixaram e rodaram aquele programa, ou programas daquele publicador, sem problema. Arquivo novo e sem assinatura não tem reputação nenhuma.

Pontos que costumam confundir:

- **A assinatura sozinha não tira o aviso na hora.** Com um certificado comum (OV), o aviso continua até o publicador ganhar reputação, o que leva algumas semanas ou centenas de instalações. Desde 2024 nem o certificado EV, mais caro, dá reputação imediata.
- **Não é um aviso de vírus.** O SmartScreen diz "não conheço", não "é perigoso". Se o antivírus detectasse algo, a mensagem seria outra.
- O aviso depende da **marca "veio da internet"** (*Mark-of-the-Web*) que o navegador coloca no arquivo baixado. Sem essa marca, o SmartScreen não é consultado.

## Quando aparece na prática, no caso da HDL

| Situação | Mostra o aviso? | Por quê |
|---|---|---|
| Primeira instalação da Central, com o `.exe` baixado pelo navegador | **Sim** | Sem assinatura, sem reputação e com a marca de internet |
| Atualização da própria Central | Não | Feita pelo electron-updater, sem passar pelo navegador |
| Instalar ou atualizar Prosa, Fluxo etc. **pela Central** | Não | A Central baixa direto (`net.fetch`), sem a marca de internet |
| Baixar o Prosa direto pelo navegador, sem a Central | **Sim** | Mesmo motivo da primeira instalação da Central |

Ou seja: **para quem usa a Central, o aviso aparece uma única vez**, na instalação dela. Depois disso tudo passa por ela, sem aviso.

## Por que isso importa para a decisão

O custo de eliminar o aviso precisa ser comparado com o tamanho real do problema:

- **Hoje** a Central é interna e a instalação é por convite: cada pessoa nova da equipe vê o aviso **uma vez**, normalmente com alguém da HDL orientando.
- **Se** a Central (ou algum app) passar a ser distribuída para **clientes**, o aviso vira um problema de imagem e de suporte, e o peso da decisão muda.

As formas de resolver estão nos documentos [3 (Microsoft Store)](03-avaliacao-microsoft-store.md) e [4 (alternativas)](04-alternativas-e-recomendacao.md).
