type SearchableTurma = {
    nome?: string; codigoConvite?: string; codigo?: string; turno?: string;
    origemNome?: string; destinoNome?: string;
};

function normalize(text: string) {
    return text.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

// Search only the already authorized list; never resolve an arbitrary code globally.
export function filterTurmas<T extends SearchableTurma>(turmas: T[], query: string): T[] {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return turmas;
    return turmas.filter(turma => {
        const text = normalize([turma.nome, turma.codigoConvite, turma.codigo, turma.turno,
            turma.origemNome, turma.destinoNome].filter(Boolean).join(' '));
        return terms.every(term => text.includes(term));
    });
}
