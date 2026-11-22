export function validarPaginaConvite(base:string|undefined) {
    if(!base)throw new Error('A página HTTPS de convites do webapp ainda não está configurada.');
    let url:URL;try{url=new URL(base);}catch{throw new Error('Configure uma página HTTPS válida para os convites.');}
    if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash)throw new Error('Configure uma página HTTPS de convites sem parâmetros.');
    return url;
}
