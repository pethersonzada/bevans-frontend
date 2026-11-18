
import { apiFetch, apiRequest, readApiError, readApiJson } from '../config/api';
import { paginaValida, recursoId, type Pagina } from './catalogo';

export type Notificacao = {
    id: number;
    tipo: string;
    contextoTipo: string;
    contextoId: number;
    titulo: string;
    mensagem: string;
    criadaEm: string;
    lidaEm: string | null;
};

export type PreferenciasNotificacao = {
    pushOperacional: boolean;
    pushInformativo: boolean;
};

type PaginaSpring<T> = {
    content: T[];
    number: number;
    totalPages: number;
    totalElements: number;
};

export function parseNotificacao(value: unknown): Notificacao {
    const n = value as Notificacao | null;
    if (!n || typeof n !== 'object' || !Number.isSafeInteger(n.id) || n.id <= 0 ||
        !Number.isSafeInteger(n.contextoId) || n.contextoId <= 0 ||
        ['tipo', 'contextoTipo', 'titulo', 'mensagem'].some(key => typeof n[key as keyof Notificacao] !== 'string') ||
        !n.tipo || !n.contextoTipo || !n.titulo.trim() || !Number.isFinite(Date.parse(n.criadaEm)) ||
        !(n.lidaEm === null || (typeof n.lidaEm === 'string' && Number.isFinite(Date.parse(n.lidaEm))))) {
        throw new Error('O servidor retornou uma notificação inválida. Atualize o histórico.');
    }
    return n;
}

export function tituloEvento(n: Notificacao) {
    const tipos: Record<string, string> = {
        NOVA_SOLICITACAO: n.contextoTipo === 'EMBARQUE' ? 'Novo pedido de embarque' : 'Novo pedido de vínculo',
        SOLICITACAO_APROVADA: n.contextoTipo === 'EMBARQUE' ? 'Embarque autorizado' : 'Vínculo aprovado',
        SOLICITACAO_RECUSADA: n.contextoTipo === 'EMBARQUE' ? 'Pedido de embarque recusado' : 'Vínculo recusado',
        VIAGEM_INICIADA: 'Viagem iniciada', VIAGEM_FINALIZADA: 'Viagem finalizada', VIAGEM_CANCELADA: 'Viagem cancelada',
        EMBARQUE_CONFIRMADO: 'Embarque confirmado', DESEMBARQUE_CONFIRMADO: 'Desembarque confirmado',
        NOVA_INSCRICAO: 'Nova inscrição', INSCRICAO_CONFIRMADA: 'Inscrição confirmada', INSCRICAO_CANCELADA: 'Inscrição cancelada',
        VOCE_E_PROXIMO: 'Seu ponto é o próximo', VAN_APROXIMANDO: 'Van se aproximando', VAN_CHEGOU: 'Van no ponto',
        HORARIO_ALTERADO: 'Horário alterado', TRAJETO_ALTERADO: 'Trajeto alterado',
        PASSAGEIROS_AGUARDANDO: 'Passageiros aguardando', TODOS_EMBARCARAM: 'Todos embarcaram', NAO_EMBARCOU: 'Ausência registrada',
    };
    return tipos[n.tipo] || n.titulo;
}

const listeners = new Set<() => void>();

export function onNotificacoesChanged(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function avisarNotificacoesChanged() {
    listeners.forEach(listener => listener());
}

export async function listarNotificacoes(
    pagina: number,
    signal?: AbortSignal
): Promise<Pagina<Notificacao>> {
    if (!Number.isSafeInteger(pagina) || pagina < 0) throw new Error('Página inválida.');
    const resposta = await apiRequest<
        Pagina<Notificacao> | PaginaSpring<Notificacao>
    >(`/notificacoes?pagina=${pagina}&tamanho=20`, { signal });

    const resultado = resposta && 'content' in resposta
        ? paginaValida<Notificacao>({
            itens: resposta.content,
            pagina: resposta.number,
            totalPaginas: resposta.totalPages,
            total: resposta.totalElements,
        }) : paginaValida<Notificacao>(resposta);
    if (resultado.pagina !== pagina) throw new Error('O servidor retornou outra página de notificações.');
    const itens = resultado.itens.map(parseNotificacao);
    return { ...resultado, itens: [...new Map(itens.map(n => [n.id, n])).values()] };
}

export async function localizarNotificacao(
    id: string,
    signal?: AbortSignal
) {
    recursoId(id);

    let pagina = 0;

    while (pagina < 100) {
        const r = await listarNotificacoes(pagina, signal);

        const aviso = r.itens.find(n => String(n.id) === id);

        if (aviso) {
            return aviso;
        }

        if (pagina + 1 >= r.totalPaginas) {
            break;
        }

        pagina++;
    }

    throw new Error(
        'O aviso não está disponível no histórico recente da sua conta.'
    );
}

export async function contarNaoLidas(signal?: AbortSignal) {
    const r = await apiRequest<number>(
        '/notificacoes/nao-lidas',
        { signal }
    );

    if (
        !Number.isSafeInteger(r) ||
        r === null ||
        r < 0
    ) {
        throw new Error('Contagem de notificações inválida.');
    }

    return r;
}

export async function lerNotificacao(id: number) {
    const r = await apiFetch(
        `/notificacoes/${recursoId(id)}/leitura`,
        { method: 'PUT' }
    );

    if (!r.ok) {
        throw await readApiError(r);
    }

    avisarNotificacoesChanged();
}

export async function preferenciasNotificacao(
    signal?: AbortSignal
) {
    const r = await apiRequest<PreferenciasNotificacao>(
        '/notificacoes/preferencias',
        { signal }
    );

    if (
        !r ||
        typeof r.pushOperacional !== 'boolean' ||
        typeof r.pushInformativo !== 'boolean'
    ) {
        throw new Error('Preferências inválidas.');
    }

    return r;
}

export async function salvarPreferenciasNotificacao(
    dados: PreferenciasNotificacao
) {
    const r = await apiFetch(
        '/notificacoes/preferencias',
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dados),
        }
    );

    if (!r.ok) {
        throw await readApiError(r);
    }
}

export async function registrarDispositivo(
    instalacaoId: string,
    token: string
) {
    if (
        !/^[A-Za-z0-9_-]{16,128}$/.test(instalacaoId) ||
        !token.trim()
    ) {
        throw new Error('Dispositivo inválido.');
    }

    const r = await apiFetch(
        '/notificacoes/dispositivos',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instalacaoId,
                token,
                consentePush: true,
            }),
        }
    );

    if (!r.ok) {
        throw await readApiError(r);
    }

    const info = await readApiJson<{
        id: number;
        instalacaoId: string;
        ativo: boolean;
    }>(r);

    if (
        !info ||
        !Number.isSafeInteger(info.id) ||
        info.id <= 0 ||
        info.instalacaoId !== instalacaoId ||
        info.ativo !== true
    ) {
        throw new Error(
            'O servidor não confirmou o registro desta instalação. Tente novamente para conferir o estado.'
        );
    }
}

export async function revogarDispositivo(
    instalacaoId: string
) {
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(instalacaoId)) {
        throw new Error('Dispositivo inválido.');
    }

    const r = await apiFetch(
        `/notificacoes/dispositivos/${instalacaoId}`,
        {
            method: 'DELETE',
            timeoutMs: 5000,
        }
    );

    if (!r.ok) {
        throw await readApiError(r);
    }
}

export function destinoNotificacao(n: Notificacao) {
    const id = String(recursoId(n.contextoId));

    if (n.contextoTipo === 'VIAGEM') {
        return {
            pathname: '/controle-viagem' as const,
            params: {
                tipo: 'VIAGEM',
                id,
            },
        };
    }

    if (n.contextoTipo === 'EXECUCAO_EXCURSAO') {
        return {
            pathname: '/controle-viagem' as const,
            params: {
                tipo: 'EXCURSAO',
                id,
            },
        };
    }

    if (n.contextoTipo === 'ROTA_PUBLICA') {
        return {
            pathname: '/detalhe-rota' as const,
            params: { id },
        };
    }

    if (n.contextoTipo === 'EXCURSAO') {
        return {
            pathname: '/editar-excursao' as const,
            params: { id },
        };
    }

    return {
        pathname: '/(tabs)/home' as const,
    };
}

export async function destinoAutorizadoNotificacao(
    n: Notificacao,
    motorista: boolean,
    usuarioId?: string
) {
    const id = recursoId(n.contextoId);

    let path: string | null = null;

    switch (n.contextoTipo) {
        case 'TURMA':
        case 'SOLICITACAO_VAGA':
        case 'EMBARQUE': {
            if (!usuarioId) throw new Error('Entre novamente para consultar suas solicitações.');
            const usuario = recursoId(usuarioId);
            const turmas = await apiRequest<{ id: number }[]>(motorista
                ? `/turmas/motorista/${usuario}` : `/turmas/usuario/${usuario}/todas`);
            if (!Array.isArray(turmas)) throw new Error('Não foi possível confirmar suas turmas.');
            if (n.contextoTipo === 'TURMA' && !turmas.some(t => t.id === id)) throw new Error('Esta turma não está disponível para sua conta.');
            // Os IDs de vínculo e pedido não são IDs de turma/rota. A área consulta
            // apenas coleções autorizadas e nunca deduz a associação por esses IDs.
            return { pathname: '/solicitacoes' as const, params: { contexto: n.contextoTipo, avisoId: String(id) } };
        }
        case 'VIAGEM':
            path = `/operacoes/VIAGEM/${id}${motorista ? '' : '/minha'}`;
            break;

        case 'EXECUCAO_EXCURSAO':
            if (!motorista) {
                throw new Error(
                    'Consulte esta excursão pela página da sua inscrição.'
                );
            }

            path = `/operacoes/EXCURSAO/${id}`;
            break;

        case 'ROTA_PUBLICA':
            if(motorista){
                const rotas=await apiRequest<{id:number}[]>('/rotas-publicas/minhas');
                if(!Array.isArray(rotas)||!rotas.some(r=>r.id===id))throw new Error('Esta rota não pertence à sua conta.');
                return {pathname:'/editar-rota-publica' as const,params:{id:String(id)}};
            }
            path = `/rotas-publicas/${id}`;
            break;

        case 'EXCURSAO':
            if (!motorista) {
                throw new Error(
                    'Consulte esta excursão pela página da sua inscrição.'
                );
            }

            path = `/excursoes/${id}`;
            break;
        default:
            throw new Error('Este tipo de aviso ainda não possui uma ação disponível. Consulte o histórico.');
    }

    if (path) {
        const r = await apiRequest<unknown>(path);

        if (!r) {
            throw new Error(
                'Este recurso não está mais disponível.'
            );
        }
    }

    return destinoNotificacao(n);
}

export function mensagemErroNotificacao(error: unknown) {
    const e = error as {
        status?: number;
        kind?: string;
        message?: string;
    };

    if (e?.status === 401 || e?.kind === 'session') return 'Sua sessão expirou. Entre novamente para consultar seus avisos.';
    if (e?.status === 403) return 'Você não tem permissão para consultar este recurso.';
    if (e?.status === 404) {
        return 'O recurso foi removido ou não está disponível para sua conta.';
    }

    if (e?.kind === 'network') {
        return 'Sem conexão. A central será atualizada quando a conexão retornar.';
    }

    return (
        e?.message ||
        'Não foi possível atualizar as notificações.'
    );
}
