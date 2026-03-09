import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database, Search, Layers, LayoutGrid, X, ExternalLink, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CatalogItem {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    status?: string;
    // Da view catalog_services_full
    category?: string;
    category_name?: string;
    category_id?: string;
    domain_count?: number;
    // Da view catalog_categories_summary
    service_count?: number;
    total_domains?: number;
}

interface BlocklistEntry {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    last_sync: string | null;
    domain_count: number;
}

// Helper defensivo: evita TypeError se o valor vier null/undefined
const safeLower = (v?: string | null) => (v ?? '').toLowerCase();

export function ServiceCatalog() {
    const [services, setServices] = useState<CatalogItem[]>([]);
    const [categories, setCategories] = useState<CatalogItem[]>([]);
    const [blocklists, setBlocklists] = useState<BlocklistEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'categories' | 'services' | 'blocklists'>('categories');
    const [searchTerm, setSearchTerm] = useState('');

    // Slideover states
    const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
    const [itemDetails, setItemDetails] = useState<{ items: { name: string, count?: number, isUrl: boolean }[], loading: boolean }>({ items: [], loading: false });

    useEffect(() => {
        async function loadCatalog() {
            setIsLoading(true);
            const [servicesRes, categoriesRes, blocklistsRes] = await Promise.all([
                // View unificada com domain_count e category_name real
                supabase.from('catalog_services_full').select('*').order('category_name').order('name'),
                // Resumo das categorias com contagem de serviços e domínios
                supabase.from('catalog_categories_summary').select('*').order('category_name'),
                supabase.from('catalog_lists').select('*').order('domain_count', { ascending: false }),
            ]);

            if (!servicesRes.error) setServices(servicesRes.data ?? []);
            if (!categoriesRes.error) {
                // catalog_categories_summary retorna "category_name" e "category_id"
                // Normalizamos para o shape de CatalogItem (name, id) aqui
                setCategories(
                    (categoriesRes.data ?? []).map((c: any) => ({
                        ...c,
                        id: c.category_id ?? c.id,   // garante campo id
                        name: c.category_name ?? c.name ?? '', // garante campo name
                    }))
                );
            }
            if (!blocklistsRes.error) setBlocklists(blocklistsRes.data ?? []);

            setIsLoading(false);
        }

        loadCatalog();
    }, []);

    const filteredItems = (activeTab === 'categories' ? categories : services).filter(item =>
        safeLower(item.name).includes(safeLower(searchTerm)) ||
        safeLower(item.description).includes(safeLower(searchTerm)) ||
        safeLower((item as any).category_name).includes(safeLower(searchTerm))
    );

    const handleSelect = async (item: CatalogItem) => {
        setSelectedItem(item);
        setItemDetails({ items: [], loading: true });

        try {
            if (activeTab === 'categories') {
                // Fetch services for this category from the unified view
                const { data, error } = await supabase
                    .from('catalog_services_full')
                    .select('name, domain_count')
                    .eq('category_id', item.id)
                    .order('name');

                if (!error && data) {
                    setItemDetails({ items: data.map(d => ({ name: d.name, count: d.domain_count, isUrl: false })), loading: false });
                } else {
                    setItemDetails({ items: [], loading: false });
                }
            } else {
                // Fetch domains for this service
                const { data, error } = await supabase
                    .from('service_domains')
                    .select('domain')
                    .eq('service_id', item.id);

                if (!error && data) {
                    setItemDetails({ items: data.map(d => ({ name: d.domain, isUrl: true })), loading: false });
                } else {
                    setItemDetails({ items: [], loading: false });
                }
            }
        } catch {
            setItemDetails({ items: [], loading: false });
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="sm:flex sm:items-center sm:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catálogo de Bloqueios</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Explore as categorias e serviços globais que podem ser bloqueados na política de cada client.
                    </p>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                {/* Header Actions */}
                <div className="border-b border-slate-200 p-4 flex flex-col sm:flex-row gap-4 justify-between bg-slate-50/50">
                    <div className="flex bg-slate-100/80 p-1 rounded-lg border border-slate-200/60 max-w-fit">
                        <button
                            onClick={() => setActiveTab('categories')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                activeTab === 'categories' ? "bg-white text-slate-900 shadow-sm border-slate-200" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <Layers className="h-4 w-4" />
                            Categorias
                        </button>
                        <button
                            onClick={() => setActiveTab('services')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                activeTab === 'services' ? "bg-white text-slate-900 shadow-sm border-slate-200" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <LayoutGrid className="h-4 w-4" />
                            Serviços
                        </button>
                        <button
                            onClick={() => setActiveTab('blocklists')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                activeTab === 'blocklists' ? "bg-white text-slate-900 shadow-sm border-slate-200" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <ShieldAlert className="h-4 w-4" />
                            Blocklists
                        </button>
                    </div>

                    <div className="relative flex-1 sm:max-w-xs">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-lg border-0 py-2 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all bg-white"
                            placeholder={`Buscar ${activeTab === 'categories' ? 'categorias' : 'serviços'}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="p-6 flex-1 bg-slate-50/30">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent animate-spin rounded-full mb-4" />
                            <p className="text-sm font-medium text-slate-500">Carregando catálogo...</p>
                        </div>
                    ) : activeTab === 'blocklists' ? (
                        // ---- ABA BLOCKLISTS (lê da view catalog_lists) ----
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {blocklists.length === 0 ? (
                                <div className="col-span-3 flex flex-col items-center justify-center h-64 text-center">
                                    <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                                        <ShieldAlert className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-900">Nenhuma blocklist sincronizada</h3>
                                    <p className="text-sm text-slate-500 mt-1 max-w-sm">Execute o cron de sincronização para popular as fontes.</p>
                                </div>
                            ) : blocklists.map(bl => (
                                <div key={bl.id} className="flex flex-col p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="h-12 w-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                                            <ShieldAlert className="h-6 w-6 text-red-500" />
                                        </div>
                                        <span className={cn(
                                            "text-xs font-semibold px-2 py-1 rounded-full",
                                            bl.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {bl.enabled ? 'Ativa' : 'Inativa'}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-slate-900 text-base mb-1">{bl.name}</h4>
                                    <a href={bl.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-blue-600 truncate mb-4 transition-colors flex items-center gap-1">
                                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        {bl.url}
                                    </a>
                                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-2xl font-bold text-slate-900">
                                            {new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(bl.domain_count)}
                                        </span>
                                        <span className="text-xs text-slate-500">domínios bloqueados</span>
                                    </div>
                                    {bl.last_sync && (
                                        <p className="text-[10px] text-slate-400 mt-2">
                                            Última sync: {new Date(bl.last_sync).toLocaleString('pt-BR')}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                                <Search className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-900">Nenhum resultado encontrado</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-sm">
                                Não encontramos nenhuma correspondência para a sua busca no banco de {activeTab === 'categories' ? 'categorias' : 'serviços'}.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {filteredItems.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className="group flex flex-col p-6 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-accent/40 transition-all duration-300 relative overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/0 to-accent/0 group-hover:from-accent/80 group-hover:via-accent/40 group-hover:to-transparent transition-all duration-500"></div>
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="h-14 w-14 rounded-2xl bg-slate-50 group-hover:bg-accent/5 flex items-center justify-center border border-slate-100 group-hover:border-accent/10 transition-colors">
                                            {activeTab === 'categories' ? (
                                                <Layers className="h-6 w-6 text-slate-400 group-hover:text-accent transition-colors" />
                                            ) : (
                                                <LayoutGrid className="h-6 w-6 text-slate-400 group-hover:text-accent transition-colors" />
                                            )}
                                        </div>
                                        <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                                            <ChevronRight className="h-4 w-4 text-accent" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-slate-900 group-hover:text-accent transition-colors text-lg">{item.name}</h4>
                                            {activeTab === 'services' && (item.domain_count ?? 0) > 0 && (
                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium border border-slate-200 shadow-sm" title={`${item.domain_count} domínios`}>
                                                    {new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(item.domain_count ?? 0)} domínios
                                                </span>
                                            )}
                                            {activeTab === 'categories' && (item.service_count ?? 0) > 0 && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-medium border border-blue-100 shadow-sm">
                                                        {item.service_count} serviços
                                                    </span>
                                                    {(item.total_domains ?? 0) > 0 && (
                                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium border border-slate-200 shadow-sm" title={`${item.total_domains} domínios agregados`}>
                                                            {new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(item.total_domains ?? 0)} domínios
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                                            {item.description || 'Assinaturas de rede vinculadas a esta política de segurança.'}
                                        </p>
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Oficial
                                        </span>
                                        {activeTab === 'categories' && (item.total_domains ?? 0) > 0 && (
                                            <span className="text-xs text-slate-400">
                                                {new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(item.total_domains ?? 0)} domínios
                                            </span>
                                        )}
                                        {activeTab === 'services' && (
                                            <span className="text-xs font-medium text-slate-400 group-hover:text-accent transition-colors">
                                                Explorar Política
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {/* Slideover para Detalhes do Item */}
                            {selectedItem && (
                                <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
                                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedItem(null)}></div>
                                    <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
                                        <div className="pointer-events-auto w-screen max-w-md transform transition-transform duration-300 ease-in-out">
                                            <div className="flex h-full flex-col bg-white shadow-2xl border-l border-slate-200">
                                                <div className="px-6 py-6 border-b border-slate-100 bg-slate-50/50">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                                                {activeTab === 'categories' ? <Layers className="h-6 w-6 text-accent" /> : <LayoutGrid className="h-6 w-6 text-accent" />}
                                                            </div>
                                                            <div>
                                                                <h2 className="text-lg font-bold text-slate-900" id="slide-over-title">
                                                                    {selectedItem.name}
                                                                </h2>
                                                                <p className="text-sm text-slate-500 font-medium">Visualização da Política</p>
                                                            </div>
                                                        </div>
                                                        <div className="ml-3 flex h-7 items-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedItem(null)}
                                                                className="relative rounded-md bg-white text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-accent"
                                                            >
                                                                <span className="absolute -inset-2.5"></span>
                                                                <span className="sr-only">Fechar painel</span>
                                                                <X className="h-6 w-6" aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="mt-6">
                                                        <p className="text-sm text-slate-600 leading-relaxed">
                                                            {selectedItem.description || 'Assinaturas de rede vinculadas a esta política de segurança que podem ser ativadas no perfil do cliente.'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                                            <ShieldAlert className="h-4 w-4 text-slate-400" />
                                                            {activeTab === 'categories' ? 'Serviços Vinculados' : 'Domínios Interceptados'}
                                                        </h3>
                                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                                                            {itemDetails.loading ? '...' : itemDetails.items.length} {activeTab === 'categories' ? 'serviços' : 'alvos'}
                                                        </span>
                                                    </div>

                                                    {itemDetails.loading ? (
                                                        <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200">
                                                            <div className="h-6 w-6 border-2 border-accent border-t-transparent animate-spin rounded-full mb-3" />
                                                            <span className="text-sm text-slate-500">Mapeando vinculações...</span>
                                                        </div>
                                                    ) : itemDetails.items.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200 border-dashed">
                                                            <Database className="h-8 w-8 text-slate-300 mb-3" />
                                                            <span className="text-sm font-medium text-slate-900">
                                                                {activeTab === 'categories' ? 'Nenhum serviço' : 'Nenhum domínio'}
                                                            </span>
                                                            <span className="text-xs text-slate-500 mt-1">O pacote não possui vinculações listadas.</span>
                                                        </div>
                                                    ) : (
                                                        <ul className="space-y-2">
                                                            {itemDetails.items.map((listItem, index) => (
                                                                <li key={index} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 group">
                                                                    <span className="text-sm font-medium text-slate-700 truncate">{listItem.name}</span>
                                                                    <div className="flex items-center gap-3">
                                                                        {listItem.count !== undefined && listItem.count > 0 && (
                                                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-medium border border-slate-200 shrink-0">
                                                                                {new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(listItem.count)} domínios
                                                                            </span>
                                                                        )}
                                                                        {listItem.isUrl && (
                                                                            <a
                                                                                href={`https://${listItem.name}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-slate-300 hover:text-accent opacity-0 group-hover:opacity-100 transition-all p-1"
                                                                            >
                                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                                <div className="border-t border-slate-200 bg-white p-6">
                                                    <button
                                                        type="button"
                                                        onClick={() => window.location.href = '/clients'}
                                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
                                                    >
                                                        Ir para Clientes
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
