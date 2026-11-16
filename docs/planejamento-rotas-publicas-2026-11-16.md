# Criação e edição de Rotas Públicas — 16/11/2026

## Experiência e escopo

O planejamento de excursões foi inspecionado antes da implementação (`PlanejarExcursao`, `ViagemUI`, `DataViagem`, picker e serviço de endereço). Rotas Públicas reutiliza diretamente `PaginaViagem`, `CabecalhoViagem`, `ProgressoViagem`, `BlocoViagem`, `AtalhoViagem`, `EscolhaEmbarque`, `DadoViagem`, `ActionButton` e os estilos `trip`. Não foi criada outra biblioteca visual nem alterado o fluxo das excursões.

A entrada continua **Criar rota pública**, abrindo **Nova rota pública**. Criação e edição usam o mesmo `PlanejarRotaPublica`:

1. **Informações:** identidade, cidade, cards de categoria/modalidade e campos opcionais já suportados pelo contrato (descrição, região, campus).
2. **Endereços:** cards de origem/destino, mapa e revisão do endereço do pin. Reutiliza o mesmo `EnderecoMapaPicker` e `resolverEnderecoExcursao` das excursões, com geocodificação nativa, descrição editável e proteção contra respostas antigas. Nomes genéricos não passam na validação.
3. **Paradas:** adições sucessivas sem gravar individualmente; mapa com origem O, destino D e paradas numeradas; seleção do marcador abre o card correspondente. Lista de cards para renomear, alterar horário, reposicionar, remover e reordenar. Chaves locais estáveis mantêm a associação mesmo em pontos novos sem ID. Reposicionar confirma nome e coordenadas juntos, preservando ID e horário.
4. **Horários:** dias selecionáveis com estado acessível e seletores nativos de horário de ida/volta. Nenhum horário é persistido apenas por abrir o seletor. Pelo menos um horário é obrigatório, conforme o backend.
5. **Revisão:** resumo, mapa, lista ordenada, pendências e associação operacional antes do salvamento.

Os valores ficam no rascunho ao avançar/voltar, abrir/cancelar o picker ou retornar de outra tela. Voltar do Android percorre as etapas; sair da primeira etapa com alterações exige decisão explícita. O gesto nativo de saída é desabilitado nesta tela para não ignorar a confirmação. Uma sessão/rota diferente remonta o editor; resultados após desmontagem não atualizam a tela nem iniciam a próxima gravação.

Depois de salvar, a gestão mantém publicação/retirada explícitas com confirmação, prévias de ida/volta (otimização para modalidade flexível), pedidos de passageiros, configuração de capacidade e início de viagem. Salvar uma nova rota não publica; uma rota já publicada mantém seu estado ao salvar alterações, conforme o contrato atual. Rascunhos pendentes bloqueiam as ações que dependem da versão salva.

## Contrato consultado, sem alterações externas

Consulta somente de leitura a `RotaPublicaRequest.java` e `RotaPublicaService.java` do backend local:

- `turmaId` obrigatório na criação; turma do motorista, uma rota pública por turma; não permite trocar a associação na atualização.
- A escolha fica na revisão. Lista somente turmas sem rota associada; falhas têm nova tentativa. Não cria turma automaticamente. Na edição, mostra a associação atual e os assentos.
- Dados: POST `/rotas-publicas` ou PUT `/rotas-publicas/{id}`. Paradas ordenadas: PUT `/rotas-publicas/{id}/paradas`. Publicação e planejamento usam os serviços/endpoints que já existiam.
- Serialização inclui somente campos atuais do contrato. Chaves locais não vão para a API. Nomes e coordenadas confirmados são relidos na verificação final e ao reabrir a rota.
- Alterações durante viagem e de paradas com embarques aprovados continuam sujeitas ao backend. Respostas 409 preservam o planejamento e oferecem carregar a versão salva após confirmação de descarte.

## Persistência e recuperação

`edicaoRotaPublica` conserva imediatamente o ID retornado pela criação. Se as paradas falham, a tentativa posterior usa a mesma rota e grava somente o necessário. Antes de atualizar, compara o snapshot visível do servidor; repete a conferência antes da gravação das paradas e após o conjunto de operações.

Resposta de criação desconhecida é consultada na lista do motorista pela associação única, exigindo dados correspondentes antes de continuar. Não repete POST cegamente. Respostas desconhecidas de dados/paradas também são conferidas por leitura; paradas novas sem ID não são reenviadas quando já confirmadas. Falha na conferência final bloqueia publicação até nova validação.

**Limite real:** a API não expõe versão/ETag para edição condicional nem transação conjunta desses endpoints. Conferências no frontend detectam conflitos visíveis, mas não eliminam a janela entre a última leitura e a escrita. Não foram inventados campos de versão ou garantias de atomicidade. É necessária evolução do backend para eliminar essa janela.

## Evidências e limites

- `npm run check`: arquitetura, TypeScript e **205 testes aprovados**, zero falhas (177 anteriores; 28 novos). Dois testes antigos do editor foram adaptados ao fluxo atual, preservando suas verificações funcionais.
- Cobertura nova: componentes compartilhados; preenchimento e navegação; revisão/seleção de endereços; múltiplas paradas; reordenação/remoção/reposicionamento; marcadores reais e sequência; dias/horários nativos; associação operacional/retry; persistência/reabertura; falhas parciais; respostas perdidas; conflitos entre gravações; bloqueio de concorrência local; publicação e retirada explícitas; falha na leitura final; rascunho offline e descarte.
- `npm run bundle:android`: exportado com sucesso em `.expo/ci-android`, em modo CI/offline sem dotenv. Não é APK, EAS Build ou deploy.
- `git diff --check` no escopo dos commits: aprovado. Alterações paralelas preexistentes em layout de abas, home, atalhos de turma e tema foram preservadas fora dos commits. O diff global mantém avisos de espaços em branco nesses arquivos.
- Revisão de hooks, desmontagem, acessibilidade, estado de rascunho e limites de sessão conforme a skill `react-best-practices`.
- Testes de API usam transporte/serviços simulados; não são comprovação de persistência remota ou geocodificação nativa real.
- Tentativa de inspeção no Motorola de homologação abriu uma tela da versão anterior. Houve navegação paralela no aparelho; não foi forçado reload da sessão em uso. Não há aprovação visual/física do novo fluxo. Capturas de diagnóstico ficaram em `.expo` ignorado, fora do Git.

Para concluir a conferência física: carregar esta versão JS no build de desenvolvimento, criar um rascunho de teste com origem, destino e pelo menos três paradas, revisar endereços, reordenar/reabrir o picker, selecionar dias/horários, salvar e reabrir. Conferir marcadores/números/nomes e só então testar publicação explícita em homologação, com capacidade configurada. Comparar o cabeçalho/progresso/cards/rodapé com Planejar Excursão. Não foram alterados backend, webapp, turmas privadas, perfil ou notificações; sem push ou deploy.
