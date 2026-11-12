export type Turma = {
    id: number;
    nome?: string;
    turno: string;
    codigoConvite?: string;
    codigo?: string;
    origemNome?: string;
    destinoNome?: string;
    origemLatitude?: number | null;
    origemLongitude?: number | null;
    destinoLatitude?: number | null;
    destinoLongitude?: number | null;
};

export type PassageiroTurma = { id: number; nome: string; telefone?: string; status?: string };
export type SolicitacaoTurma = { id: number; aluno?: PassageiroTurma };
