import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from 'lucide-react';

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

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catálogo de Bloqueios</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Gerencie e visualize as categorias e serviços globais que podem ser bloqueados pelos clientes.
                </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Categories */}
                <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-slate-900">Categorias Web</h2>
                        <div className="text-sm text-slate-500 flex items-center gap-1"><Database className="h-4 w-4" /> {categories.length}</div>
                    </div>
                    <div className="space-y-3">
                        {isLoading ? <p className="text-sm text-slate-500 text-center py-4">Carregando...</p> : categories.map(cat => (
                            <div key={cat.id} className="flex items-center gap-4 p-3 border border-border rounded-lg hover:border-slate-300 transition-colors">
                                <div className="h-10 w-10 shrink-0 bg-slate-100 rounded flex items-center justify-center text-slate-600">
                                    <Database className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-slate-900">{cat.name}</h4>
                                    <p className="text-xs text-slate-500">{cat.description || 'Nenhuma descrição.'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Services */}
                <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-slate-900">Serviços Específicos</h2>
                        <div className="text-sm text-slate-500 flex items-center gap-1"><Database className="h-4 w-4" /> {services.length}</div>
                    </div>
                    <div className="space-y-3">
                        {isLoading ? <p className="text-sm text-slate-500 text-center py-4">Carregando...</p> : services.map(srv => (
                            <div key={srv.id} className="flex items-center gap-4 p-3 border border-border rounded-lg hover:border-slate-300 transition-colors">
                                <div className="h-10 w-10 shrink-0 bg-slate-100 rounded flex items-center justify-center text-slate-600">
                                    <Database className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-slate-900">{srv.name}</h4>
                                    <p className="text-xs text-slate-500">{srv.description || 'Nenhuma descrição.'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
