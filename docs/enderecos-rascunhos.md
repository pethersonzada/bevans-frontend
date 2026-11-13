# Endereços e rascunhos de turma — 13/11/2026

Relacionadas: frontend #10, #25 e #26; backend #44.

- Busca compartilhada tem um único campo: rua, número, bairro, cidade ou estabelecimento.
- Resultados de rua/região/POI são aproximados: não são enviados como residência sem confirmação explícita. Toque no mapa marca o ponto; arraste ajusta. GPS não confirma endereço automaticamente.
- Criar turma continua em duas etapas: backend aceita rascunho sem percurso, depois recebe origem e destino separadamente. Nome isolado não é geocodificado silenciosamente.
- Ao abrir mapa de origem/destino, carregar ponto salvo na lista autorizada do motorista. Falha tem nova tentativa; sessão ausente bloqueia ações.
- Sucesso só após comparar ID/coordenadas na resposta PUT. Corpo vazio exige nova consulta autorizada. Retorno de outro contexto de usuário/turma não dispara sucesso.
- Edição de endereço persiste complemento; número não é obrigatório no backend. ID do corpo não sobrescreve registro ao criar.

Validação: npm.cmd run check passou com arquitetura, TypeScript e 65 testes. Testes novos simulam campo único, pin manual/drag, seleção limpa, precisão dos resultados e verificação da resposta de persistência. Backend: 91 testes passaram, com H2 e OR-Tools nativo.

Pendente em development build Android/iOS e ambiente isolado: criar turma, escolher origem/destino, reabrir mapa e app, testar edição, perda de rede, sessão expirada, GPS negado, geocodificação real, ida/volta e passageiros confirmados. Simulações não validam comportamento nativo do Mapbox. Issues permanecem abertas.

Sem push, deploy ou alteração de banco de produção. Nenhuma migração necessária neste lote. Próxima prioridade: capacidade por turma e aprovação concorrente (backend #35/frontend #20), após validação do fluxo de endereços.
