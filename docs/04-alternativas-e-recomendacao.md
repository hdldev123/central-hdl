# 4. Alternativas e recomendação

> Documento para a conversa entre os sócios. [← Voltar ao índice](README.md)

## As opções lado a lado

| # | Opção | Custo | Esforço | Tira o aviso? | Observações |
|---|---|---|---|---|---|
| A | **Não mudar nada** e orientar quem instala | Zero | Mínimo: uma frase no convite | Não, mas a pessoa sabe o que fazer | O aviso aparece **uma vez por pessoa**; depois a Central cuida de tudo sem aviso |
| B | **Certificado de assinatura de código (OV)** de uma autoridade certificadora que atenda o Brasil | Anual, a cotar (inclui a exigência de guardar a chave num token ou serviço em nuvem) | Médio: validar a empresa, configurar o electron-builder e assinar cada versão | **Sim, com o tempo**: no começo some o "Fornecedor desconhecido" e o aviso para quando a HDL ganha reputação | Vale para a Central **e** para todos os apps (Prosa baixado pelo site também) |
| C | **Azure Artifact Signing** (o serviço de assinatura da Microsoft, antes chamado Trusted Signing) | A partir de US$ 9,99/mês + assinatura do Azure | Médio | Sim, com o tempo, como na B | A lista oficial de quem pode usar cobre EUA, Canadá, UE e Reino Unido. **Não encontramos o Brasil.** Precisa confirmar antes de contar com isso |
| D | **Central na Microsoft Store (MSIX)** como está | Conta gratuita (a confirmar) | Alto | Só para quem instala pela Store | **Reprovaria nas regras da Store** (ver o [documento 3](03-avaliacao-microsoft-store.md)) |
| E | **Cada app na Store**, com a Central só apontando para a Store | Conta gratuita (a confirmar) | Muito alto: 5 pacotes e 5 certificações | Sim, para quem instala pela Store | Faz sentido só se quisermos a Store como vitrine para clientes |

## Recomendação

1. **Agora: opção A.** A Central é interna e a instalação é por convite. O incômodo real é um clique a mais por pessoa nova. Sugestão de texto para o convite:
   > Ao abrir o instalador, o Windows pode mostrar "O Windows protegeu o computador". Isso acontece porque o instalador ainda não tem assinatura digital. Clique em **Mais informações** e depois em **Executar assim mesmo**. Só acontece nesta primeira instalação.
2. **Quando a Central ou algum app for para clientes: opção B** (ou C, se a Microsoft liberar para empresas do Brasil). Assinar resolve para tudo de uma vez: Central, Prosa e os outros, pelo site ou pela Central.
3. **Não seguir com a D.** Se um dia quisermos estar na Store, o caminho é a **E**, e essa decisão é de produto (vitrine e vendas), não de tirar o aviso.
4. **Opcional e sem custo:** criar a conta de empresa no Partner Center só para **reservar o nome "Central HDL"** (e os nomes dos apps), sem publicar nada.

## O que precisamos decidir juntos

1. **Para quem é a Central?** Vai continuar só para a equipe, ou vamos distribuir a Central ou algum app (Prosa, Financeiro) para clientes? É isso que define se o aviso é um detalhe ou um problema.
2. **O aviso já causou problema?** Alguém desistiu de instalar, ligou para o suporte, desconfiou da HDL?
3. **Topamos um custo anual com certificado?** Se sim, com qual teto? (Cotar com pelo menos duas autoridades certificadoras que atendam empresas brasileiras.)
4. **A Microsoft Store interessa como vitrine?** Ser encontrado na Store vale o esforço de empacotar e certificar cada app?
5. **Reservar os nomes na Store agora?** Custo zero, só o tempo de criar a conta em nome da HDL.

## Próximos passos possíveis (depois da decisão)

| Se decidirmos... | Próximo passo |
|---|---|
| Opção A | Incluir o texto acima no convite e no site |
| Opção B | Cotar certificados OV com chave em nuvem (ex.: assinatura remota), escolher, validar a HDL e configurar `build.win` no electron-builder da Central e dos apps |
| Opção C | Confirmar com a Microsoft se uma empresa brasileira pode usar o Artifact Signing |
| Opção E | Prova de conceito: empacotar **um** app (o Prosa) como MSIX, testar e submeter para ver como a certificação reage |
| Reservar nomes | Criar a conta de empresa no Partner Center em nome da HDL e reservar "Central HDL" |
