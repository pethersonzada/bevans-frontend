# Lote frontend — issues #5, #6, #7 e #10

Implementação local de 12/11/2026. Bateria manual adiada conforme combinado.

- #5: leituras de turmas, passageiros e solicitações da Home do motorista extraídas
  para services/motoristaHome.ts, com validação de listas e resposta vazia.
- #6: serviço de localização compartilhado valida permissões, GPS desligado e
  coordenadas; espera total limitada a 20s. Picker não solicita GPS quando já há
  posição salva. A Home ignora resposta de GPS após sair; navegação rejeita amostras
  inválidas e limita a espera inicial por posição atual/última posição conhecida.
- #6: acompanhamento pausa ao detectar falta de rede; reconexão retoma um único
  ciclo. Homes revalidam ao reconectar enquanto estão em foco. Listeners são removidos
  ao sair da tela. Estado de conectividade desconhecido permite tentativa inicial.
- #7: novos testes para deadline/cancelamento, permissões, GPS inválido/zero,
  retorno da conexão, provedores de endereço, formato das listas e pesquisa por código.
- #10: pesquisa local de turmas por nome, código, turno, origem e destino, com
  normalização de acentos/maiúsculas e manutenção da seleção por lista. Não faz
  consulta global nem amplia o acesso às turmas. Na UI atual a seleção é comum
  às ações de ida/volta; não há dois seletores de código independentes.
- #10: geocodificação possui deadline de 15s incluindo leitura do corpo. Falha do
  Mapbox não é interpretada como resultado vazio quando Geoapify não foi configurado.
  Provedor opcional configurado continua servindo de fallback quando funciona.

Cancelamento/timeout de uma chamada nativa não interrompe necessariamente o
trabalho interno do sistema operacional; a UI deixa de esperar e descarta resultados
tardios. Não houve alteração de contratos de API, tema ou dados de produção.

## Verificação

```powershell
npm.cmd test
npx.cmd tsc --noEmit
git diff --check
```

## Acrescentar à bateria manual

- [ ] Desligar GPS, negar/revogar permissão e atrasar resposta; conferir fallback
  para pesquisa manual, encerramento do indicador e ausência de coordenadas inválidas.
- [ ] Abrir endereço já salvo: não solicitar GPS desnecessariamente.
- [ ] Sair da Home durante busca de GPS e confirmar que resposta tardia não altera a tela.
- [ ] Em viagem, alternar entre rede/offline/rede e Home/Perfil/segundo plano;
  conferir retomada única e ausência de ciclos de radar enquanto offline/fora de foco.
- [ ] Confirmar que retornar à rede atualiza Home sem precisar reinstalar ou reiniciar.
- [ ] Pesquisar código válido/inválido, nome acentuado e turno; limpar busca e selecionar
  pela lista. Iniciar ida/volta deve manter a turma escolhida.
- [ ] Testar provedor de endereços indisponível com e sem Geoapify configurado;
  diferenciar falha, resultado vazio e fallback disponível.
- [ ] Testar HTTP 204 e resposta malformada nas listagens em ambiente isolado.

As issues continuam abertas: ainda há refatoração incremental (#5), testes completos
de navegação/viagem (#7) e cenários de localização em dispositivo (#6). Funcionalidades
dependentes de backend e tema claro/escuro (#21) não pertencem a este lote.
