import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Bot, Users, MessageSquare, PlayCircle, ShieldAlert, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BlockSwitchesProps {
    clientId: string;
}

// Estilos visuais auxiliares pras categorias conhecidas
const CATEGORY_UI: Record<string, any> = {
    'IA': { icon: Bot, color: 'bg-blue-50 text-blue-600', mainLabel: 'Bloquear todas as IAs' },
    'Redes sociais': { icon: Users, color: 'bg-pink-50 text-pink-600', mainLabel: 'Bloquear Redes Sociais' },
    'Fóruns e comunidades': { icon: MessageSquare, color: 'bg-orange-50 text-orange-600', mainLabel: 'Bloquear Fóruns' },
    'Streaming': { icon: PlayCircle, color: 'bg-red-50 text-red-600', mainLabel: 'Bloquear Streaming' },
    'Outros bloqueios': { icon: ShieldAlert, color: 'bg-slate-50 text-slate-800', mainLabel: 'Bloquear Segurança/Proxies' }
};
const DEFAULT_UI = { icon: Globe, color: 'bg-indigo-50 text-indigo-600', mainLabel: 'Bloqueios desta classe' };

export function BlockSwitches({ clientId }: BlockSwitchesProps) {
    const [services, setServices] = useState<any[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [activeToggles, setActiveToggles] = useState<Record<string, boolean>>({});

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);

            const [servsRes, togglesRes] = await Promise.all([
                supabase.from('service_catalog').select('*').order('name'),
                supabase.from('client_policies').select('*').eq('client_id', clientId).eq('enabled', true)
            ]);

            if (servsRes.data) {
                setServices(servsRes.data);
                const uniqueCats = Array.from(new Set(servsRes.data.map(s => s.category)));
                setCategories(uniqueCats as string[]);

                // Expandir as 4 primeiras
                const initialExpanded: Record<string, boolean> = {};
                uniqueCats.slice(0, 4).forEach((c: any) => initialExpanded[c] = true);
                setExpandedGroups(initialExpanded);
            }

            if (togglesRes.data) {
                const toggleMap: Record<string, boolean> = {};
                togglesRes.data.forEach(t => {
                    toggleMap[t.policy_name] = true;
                });
                setActiveToggles(toggleMap);
            }

            setIsLoading(false);
        }
        loadData();
    }, [clientId]);

    const handleToggle = async (policyName: string) => {
        if (isSaving) return;
        setIsSaving(true);

        const currentlyActive = activeToggles[policyName] || false;
        const newStatus = !currentlyActive;

        setActiveToggles(prev => ({ ...prev, [policyName]: newStatus }));

        try {
            // Delete safely because there isn't a robust unique constraint on (client_id, policy_name)
            await supabase.from('client_policies')
                .delete()
                .eq('client_id', clientId)
                .eq('policy_name', policyName);

            if (newStatus) {
                await supabase.from('client_policies').insert({
                    client_id: clientId,
                    policy_name: policyName,
                    enabled: true
                });
            }
        } catch (err) {
            console.error('Save failed', err);
            setActiveToggles(prev => ({ ...prev, [policyName]: currentlyActive }));
        } finally {
            setIsSaving(false);
        }
    };

    const toggleGroupExpand = (cat: string) => {
        setExpandedGroups(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    if (isLoading) return <div className="py-8 text-center text-slate-500">Carregando catálogo de bloqueios DNS...</div>;

    const q = searchQuery.toLowerCase();

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-medium text-slate-900">Switches de Bloqueio</h3>
                    <p className="text-sm text-slate-500">
                        Ative as políticas para bloquear serviços reais. O sistema processará os domínios via AdGuard API.
                    </p>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar serviço..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-border rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                </div>
            </div>

            <div className="space-y-6">
                {categories.map((category) => {
                    const groupUi = CATEGORY_UI[category] || DEFAULT_UI;
                    const GroupIcon = groupUi.icon;
                    const groupIsActive = activeToggles[category] || false;
                    const isExpanded = expandedGroups[category] || false;

                    const childServices = services.filter(s => s.category === category);
                    const filteredChildren = childServices.filter(child =>
                        !q || child.name.toLowerCase().includes(q) || (child.description && child.description.toLowerCase().includes(q))
                    );

                    if (q && filteredChildren.length === 0 && !category.toLowerCase().includes(q)) return null;

                    const displayChildren = q ? filteredChildren : childServices;

                    return (
                        <div key={category} className="bg-white border text-left border-border rounded-xl shadow-sm overflow-hidden">
                            {/* Card de Header do Grupo */}
                            <div className="p-4 bg-slate-50/50 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => toggleGroupExpand(category)}>
                                <div className="flex items-center gap-4">
                                    <div className={cn("p-2.5 rounded-lg", groupUi.color)}>
                                        <GroupIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 text-base">{category}</h4>
                                        <p className="text-sm text-slate-500">{groupUi.mainLabel}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggle(category); }}
                                        disabled={isSaving}
                                        title={`Ativar bloqueio geral para a classe: ${category}`}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2",
                                            groupIsActive ? "bg-red-500" : "bg-slate-200"
                                        )}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                groupIsActive ? "translate-x-5" : "translate-x-0"
                                            )}
                                        />
                                    </button>
                                    <div className="text-slate-400">
                                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                    </div>
                                </div>
                            </div>

                            {/* Filhos granulares (Serviços) */}
                            {isExpanded && displayChildren.length > 0 && (
                                <div className="border-t border-slate-100 bg-white p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {displayChildren.map(child => {
                                            const childActive = activeToggles[child.name] || false;
                                            return (
                                                <div key={child.name} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition-colors">
                                                    <div className="flex-1 pr-3">
                                                        <h5 className="font-medium text-slate-800 text-sm">{child.name}</h5>
                                                        <p className="text-xs text-slate-500 mt-0.5 max-w-[180px] truncate" title={child.description}>{child.description}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggle(child.name)}
                                                        disabled={isSaving}
                                                        className={cn(
                                                            "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1",
                                                            childActive ? "bg-red-400" : "bg-slate-300"
                                                        )}
                                                    >
                                                        <span
                                                            aria-hidden="true"
                                                            className={cn(
                                                                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                                childActive ? "translate-x-4" : "translate-x-0"
                                                            )}
                                                        />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {isExpanded && displayChildren.length === 0 && (
                                <div className="border-t border-slate-100 bg-white p-4 text-sm text-slate-500 text-center">
                                    Nenhum serviço mapeado para esta categoria encontrado.
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
