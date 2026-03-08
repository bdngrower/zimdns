import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database, Search, Layers, LayoutGrid } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CatalogItem {
    id: string;
    name: string;
    description: string;
    icon: string;
    status: string;
}

export function ServiceCatalog() {
    const [services, setServices] = useState<CatalogItem[]>([]);
    const [categories, setCategories] = useState<CatalogItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'categories' | 'services'>('categories');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        async function loadCatalog() {
            setIsLoading(true);
            const [servicesRes, categoriesRes] = await Promise.all([
                supabase.from('service_catalog').select('*').order('name'),
                supabase.from('block_categories').select('*').order('name'),
            ]);

            if (!servicesRes.error) setServices(servicesRes.data);
            if (!categoriesRes.error) setCategories(categoriesRes.data);

            setIsLoading(false);
        }

        loadCatalog();
    }, []);

    const filteredItems = (activeTab === 'categories' ? categories : services).filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredItems.map(item => (
                                <div key={item.id} className="group flex flex-col p-5 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-blue-200 transition-all cursor-default">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="h-12 w-12 rounded-xl bg-slate-50 group-hover:bg-blue-50/50 flex items-center justify-center border border-slate-100 transition-colors">
                                            <Database className="h-6 w-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 group-hover:text-blue-900 transition-colors">{item.name}</h4>
                                        <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                                            {item.description || 'Gere bloqueios com base nas assinaturas DNS deste perfil.'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
