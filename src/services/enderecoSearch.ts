import { withDeadline } from './asyncOperation';

async function searchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return withDeadline(async activeSignal => {
    const response = await fetch(url, { signal: activeSignal });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? 'O serviço de endereços não autorizou a pesquisa. Verifique a configuração do provedor.'
      : `Falha na busca de endereços (HTTP ${response.status}).`);
    try { return await response.json() as T; }
    catch { throw new Error('O serviço de endereços retornou uma resposta inválida. Tente novamente.'); }
  }, { signal, timeoutMessage: 'A busca de endereços demorou para responder. Tente novamente.' });
}

export type EnderecoEncontrado = {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  rua: string;
  numero: string;
  bairro: string;
  tipo?: 'endereco' | 'estabelecimento';
};

type Feature = {
  id?: string;
  geometry?: { coordinates?: number[] };
  properties?: {
    full_address?: string;
    name?: string;
    place_formatted?: string;
    feature_type?: string;
    address_number?: string;
    context?: {
      street?: { name?: string };
      neighborhood?: { name?: string };
      locality?: { name?: string };
    };
  };
};

async function geocodificar(termo: string, types: string, signal?: AbortSignal): Promise<Feature[]> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) throw new Error('Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN.');
  const params = [
    `q=${encodeURIComponent(termo.trim())}`,
    'country=br', 'language=pt', 'limit=8',
    `types=${encodeURIComponent(types)}`, 'autocomplete=true',
    'permanent=true', 'proximity=-35.97,-8.28',
    `access_token=${encodeURIComponent(token)}`,
  ].join('&');
  const body = await searchJson<{ features?: Feature[] }>(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, signal);
  if (!Array.isArray(body?.features)) throw new Error('O serviço de endereços retornou resultados inválidos.');
  return body.features;
}

function converter(f: Feature, indice: number): EnderecoEncontrado | null {
  const [longitude, latitude] = f.geometry?.coordinates ?? [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      (latitude === 0 && longitude === 0)) return null;
  const p = f.properties ?? {};
  const rua = p.context?.street?.name || (p.feature_type === 'street' ? p.name : '') || p.name || '';
  const numero = String(p.address_number ?? '').trim();
  return {
    id: f.id ?? `${longitude}:${latitude}:${indice}`,
    nome: p.full_address || [p.name, p.place_formatted].filter(Boolean).join(', '),
    latitude, longitude, rua, numero,
    bairro: p.context?.neighborhood?.name || p.context?.locality?.name || '',
    tipo: 'endereco',
  };
}

export async function pesquisarEnderecos(termo: string, signal?: AbortSignal): Promise<EnderecoEncontrado[]> {
  if (termo.trim().length < 3) return [];
  const [ruas, lugares] = await Promise.allSettled([
    geocodificar(termo, 'address,street,place,neighborhood', signal),
    pesquisarEstabelecimentos(termo, signal),
  ]);
  if (signal?.aborted) return [];
  const encontrados = ruas.status === 'fulfilled'
    ? ruas.value.map(converter).filter((v): v is EnderecoEncontrado => v !== null)
    : [];
  const estabelecimentos = lugares.status === 'fulfilled' ? lugares.value : [];
  if (ruas.status === 'rejected' && (!process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || lugares.status === 'rejected')) {
    throw ruas.reason instanceof Error ? ruas.reason : new Error('Falha na busca de endereços.');
  }
  const ids = new Set<string>();
  return [...estabelecimentos, ...encontrados].filter(item => {
    const chave = `${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}`;
    if (ids.has(chave)) return false;
    ids.add(chave);
    return true;
  }).slice(0, 10);
}

/** Não usa coordenadas aproximadas da rua como se fossem da residência. */
export async function localizarNumero(
  base: EnderecoEncontrado,
  numeroDigitado: string,
  signal?: AbortSignal,
): Promise<EnderecoEncontrado> {
  const numero = numeroDigitado.trim();
  if (!numero) throw new Error('Informe o número do imóvel.');
  const rua = base.rua.trim();
  if (!rua) throw new Error('Selecione primeiro uma rua válida nas sugestões.');
  const contexto = base.nome;
  const consulta = `${rua}, ${numero}, ${contexto}`;
  const results = await geocodificar(consulta, 'address', signal);
  const normalizar = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '');
  const resultado = results.find((f) => {
    const p = f.properties;
    return p?.feature_type === 'address' && normalizar(String(p.address_number ?? '')) === normalizar(numero);
  });
  const confirmado = resultado ? converter(resultado, 0) : null;
  if (!confirmado) {
    throw new Error('Número não localizado com precisão. Confira rua, número e cidade.');
  }
  return { ...confirmado, numero };
}

/** POIs do Brasil: Geoapify (opcional). Mapbox Geocoding v6 não fornece POIs. */
async function pesquisarEstabelecimentos(termo: string, signal?: AbortSignal): Promise<EnderecoEncontrado[]> {
  const key = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;
  if (!key) return [];
  const params = [
    `text=${encodeURIComponent(termo)}`,
    'type=amenity', 'lang=pt', 'limit=6', 'format=json',
    'filter=countrycode:br', 'bias=proximity:-35.97,-8.28',
    `apiKey=${encodeURIComponent(key)}`,
  ].join('&');
  type Local = { place_id?: string; name?: string; address_line1?: string; formatted?: string;
    lat?: number; lon?: number; street?: string; housenumber?: string; suburb?: string; district?: string };
  const data = await searchJson<{ results?: Local[] }>(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, signal);
  if (!Array.isArray(data?.results)) throw new Error('O serviço de estabelecimentos retornou resultados inválidos.');
  return data.results.flatMap((p, i) => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) ||
      Math.abs(p.lat!) > 90 || Math.abs(p.lon!) > 180 ||
      (p.lat === 0 && p.lon === 0)) return [];
    return [{ id: `poi:${p.place_id || i}`, nome: p.formatted || p.name || p.address_line1 || termo,
      latitude: p.lat!, longitude: p.lon!, rua: p.street || p.name || '',
      numero: p.housenumber || 'S/N', bairro: p.suburb || p.district || '',
      tipo: 'estabelecimento' as const }];
  });
}
