import { validarPaginaConvite } from './paginaConvite';

// Only the configured web page can receive an invite secret. Never persist the URL.
export function validarConvitePassageiro(link: string, base: string | undefined): string {
    const pagina = validarPaginaConvite(base);
    let url: URL;
    try { url = new URL(link.trim()); } catch { throw new Error('Cole o link completo enviado pelo organizador.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.origin !== pagina.origin
        || url.pathname !== pagina.pathname || url.search || !url.hash.slice(1) || /\s|%0[ad]/i.test(url.hash)) {
        throw new Error('Use um convite válido da página oficial de excursões. O link deve incluir o código após #.');
    }
    return url.toString();
}
