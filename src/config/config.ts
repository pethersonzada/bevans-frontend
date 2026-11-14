export function resolveApiUrl(environment: string | undefined, urls: {development?:string;staging?:string;production?:string;legacy?:string}) {
    const name=environment||'development';
    if(!['development','staging','production'].includes(name))return undefined;
    const value=(name==='staging'?urls.staging:name==='production'?urls.production:urls.development||urls.legacy)?.trim();
    if(!value)return undefined;
    try {const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)return undefined;
        if(name!=='development'&&url.protocol!=='https:')return undefined;
        return value.replace(/\/+$/,'');}catch{return undefined;}
}
export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_APP_ENV, {
    development:process.env.EXPO_PUBLIC_API_URL_DEVELOPMENT,
    staging:process.env.EXPO_PUBLIC_API_URL_STAGING,
    production:process.env.EXPO_PUBLIC_API_URL_PRODUCTION,
    legacy:process.env.EXPO_PUBLIC_API_URL,
});
