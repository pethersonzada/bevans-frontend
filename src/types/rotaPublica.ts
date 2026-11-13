import type { VagasTurma } from './turma';
export type ModoRota = 'FIXA' | 'FLEXIVEL';
export type CategoriaRota = 'ESCOLAR' | 'UNIVERSITARIA' | 'OUTROS';
export type DiaRota = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type ParadaPublica = { id: number | null; nome: string; latitude: number; longitude: number; horario: string | null };
export type PontoPublico = { paradaId: number | null; nome: string; latitude: number; longitude: number };
export type RotaPublicaDados = {
    turmaId: number; nome: string; cidade: string; categoria: CategoriaRota; modo: ModoRota;
    origemNome: string; origemLatitude: number; origemLongitude: number;
    destinoNome: string; destinoLatitude: number; destinoLongitude: number;
    dias: DiaRota[]; horarioIda: string | null; horarioVolta: string | null;
    descricao: string | null; regiao: string | null; campus: string | null;
};
export type RotaPublica = RotaPublicaDados & { id: number; publicada: boolean; ativa: boolean; vagas: VagasTurma; paradas: ParadaPublica[] };
