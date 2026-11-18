export function dataLocal(data = new Date()): string {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

export function lerDataLocal(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Escolha uma data válida.');
    const [ano, mes, dia] = value.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia, 12);
    if (dataLocal(data) !== value) throw new Error('Escolha uma data válida.');
    return data;
}
