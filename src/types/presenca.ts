export type EnderecoPresenca = {
    id: number;
    apelido: string;
    rua: string;
    numero: string;
    bairro: string;
};

export type ConfirmacaoPresenca = {
    status: string;
    enderecoIda: EnderecoPresenca | null;
    enderecoVolta: EnderecoPresenca | null;
};
