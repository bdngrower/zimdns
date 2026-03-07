import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Bot, Users, MessageSquare, PlayCircle, MessageCircle, Gamepad2, ShieldAlert, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BlockSwitchesProps {
    tenantId: string;
}

// Mapeamento visual estático das categorias
const GROUPS = [
    {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Inteligência Artificial',
        icon: Bot,
        color: 'bg-blue-50 text-blue-600',
        servicePrefix: 'a0000000-',
        mainLabel: 'Bloquear todas as IAs'
    },
    {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Redes Sociais',
        icon: Users,
        color: 'bg-pink-50 text-pink-600',
        servicePrefix: 'b0000000-',
        mainLabel: 'Bloquear Redes Sociais'
    },
    {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Fóruns e Comunidades',
        icon: MessageSquare,
        color: 'bg-orange-50 text-orange-600',
        servicePrefix: 'c0000000-',
        mainLabel: 'Bloquear Fóruns'
    },
    {
        id: '00000000-0000-0000-0000-000000000004',
        name: 'Vídeo e Streaming',
        icon: PlayCircle,
        color: 'bg-red-50 text-red-600',
        servicePrefix: 'd0000000-',
        mainLabel: 'Bloquear Streaming'
    },
    {
        id: '00000000-0000-0000-0000-000000000005',
        name: 'Mensageria e Comunicação',
        icon: MessageCircle,
        color: 'bg-green-50 text-green-600',
        servicePrefix: 'e0000000-',
        mainLabel: 'Bloquear Mensageiros'
    },
    {
        id: '00000000-0000-0000-0000-000000000006',
        name: 'Jogos e Entretenimento',
        icon: Gamepad2,
        color: 'bg-purple-50 text-purple-600',
        servicePrefix: 'f0000000-',
        mainLabel: 'Bloquear Jogos'
    },
    {
        id: '00000000-0000-0000-0000-000000000007',
        name: 'Segurança e Conteúdo Sensível',
        icon: ShieldAlert,
        color: 'bg-red-50 text-red-600',
        customChildCategories: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555'],
        mainLabel: 'Bloqueio de Segurança Máxima'
    },
    {
        id: '00000000-0000-0000-0000-000000000008',
        name: 'Produtividade corporativa',
        icon: Briefcase,
        color: 'bg-slate-50 text-slate-600',
        servicePrefix: 'none',
        mainLabel: 'Bloquear ferramentas não homologadas'
    }
];

export function BlockSwitches({ tenantId }: BlockSwitchesProps) {
    const [categories, setCategories] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [activeToggles, setActiveToggles] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);

            const [catsRes, servsRes, togglesRes] = await Promise.all([
                supabase.from('block_categories').select('*'),
                supabase.from('service_catalog').select('*'),
                supabase.from('tenant_block_toggles').select('*').eq('tenant_id', tenantId)
            ]);

            if (catsRes.data) setCategories(catsRes.data);
            if (servsRes.data) setServices(servsRes.data);

            if (togglesRes.data) {
                const toggleMap: Record<string, boolean> = {};
                togglesRes.data.forEach(t => {
                    toggleMap[t.target_id] = t.status === 'active';
                });
                setActiveToggles(toggleMap);
            }

            // Expandir os 4 primeiros grupos por padrão
            const initialExpanded: Record<string, boolean> = {};
            GROUPS.slice(0, 4).forEach(g => initialExpanded[g.id] = true);
            setExpandedGroups(initialExpanded);

            setIsLoading(false);
        }
        loadData();
    }, [tenantId]);

    const handleToggle = async (targetId: string, type: 'category' | 'service') => {
        if (isSaving) return;
        setIsSaving(true);

        const currentlyActive = activeToggles[targetId] || false;
        const newStatus = !currentlyActive;

        setActiveToggles(prev => ({ ...prev, [targetId]: newStatus }));

        try {
            if (newStatus) {
                await supabase.from('tenant_block_toggles').upsert({
                    tenant_id: tenantId,
                    type,
                    target_id: targetId,
                    status: 'active'
                }, { onConflict: 'tenant_id, type, target_id' });
            } else {
                await supabase.from('tenant_block_toggles').delete()
                    .eq('tenant_id', tenantId)
                    .eq('target_id', targetId);
            }
        } catch (err) {
            console.error(err);
            setActiveToggles(prev => ({ ...prev, [targetId]: currentlyActive }));
        } finally {
            setIsSaving(false);
        }
    };

    const toggleGroupExpand = (groupId: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    if (isLoading) return <div className="py-8 text-center text-slate-500">Carregando catálogo de bloqueios...</div>;

    // Filtro unificado
    const q = searchQuery.toLowerCase();

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-medium text-slate-900">Switches de Bloqueio</h3>
                    <p className="text-sm text-slate-500">
                        Ative os switches para bloquear facilmente serviços populares ou categorias inteiras no motor DNS.
                    </p>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar serviço..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-border rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                </div>
            </div>

            <div className="space-y-6">
                {GROUPS.map((group) => {
                    const groupIsActive = activeToggles[group.id] || false;
                    const GroupIcon = group.icon;
                    const isExpanded = expandedGroups[group.id] || false;

                    // Filtrar serviços filhos
                    const childServices = services.filter(s => s.id.startsWith(group.servicePrefix));
                    const childCategories = categories.filter(c => group.customChildCategories?.includes(c.id));

                    const allChildren = [...childServices.map(s => ({ ...s, type: 'service' as const })), ...childCategories.map(c => ({ ...c, type: 'category' as const }))];

                    const filteredChildren = allChildren.filter(child =>
                        !q || child.name.toLowerCase().includes(q) || (child.description && child.description.toLowerCase().includes(q))
                    );

                    // Se estiver buscando e não houver filhos compatíveis, esconder o grupo inteiro
                    if (q && filteredChildren.length === 0 && !group.name.toLowerCase().includes(q)) return null;

                    const displayChildren = q ? filteredChildren : allChildren;

                    return (
                        <div key={group.id} className="bg-white border text-left border-border rounded-xl shadow-sm overflow-hidden">
                            {/* Card de Header do Grupo */}
                            <div className="p-4 bg-slate-50/50 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => toggleGroupExpand(group.id)}>
                                <div className="flex items-center gap-4">
                                    <div className={cn("p-2.5 rounded-lg", group.color)}>
                                        <GroupIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 text-base">{group.name}</h4>
                                        <p className="text-sm text-slate-500">{group.mainLabel}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Toggle do Mestre (Bloqueia TUDO do grupo se ativado - a UI marca, o backend que se vira c/ a lógica. Nós salvamos a category!) */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggle(group.id, 'category'); }}
                                        disabled={isSaving}
                                        title="Ativar bloqueio geral deste grupo"
                                        className={cn(
                                            "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
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

                            {/* Filhos granulares */}
                            {isExpanded && displayChildren.length > 0 && (
                                <div className="border-t border-slate-100 bg-white p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {displayChildren.map(child => {
                                            const childActive = activeToggles[child.id] || false;
                                            // Se o pai tá ativo, ele já bloqueia. Vamos dar um estilo disabled mas visual de "ON"? 
                                            // Vamos manter simples: operam independente, backend junta lógica
                                            return (
                                                <div key={child.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50">
                                                    <div className="flex-1 pr-3">
                                                        <h5 className="font-medium text-slate-800 text-sm">{child.name}</h5>
                                                        <p className="text-xs text-slate-500 mt-0.5 max-w-[180px] truncate">{child.description}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggle(child.id, child.type)}
                                                        disabled={isSaving}
                                                        className={cn(
                                                            "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1",
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
                                    Nenhum serviço mapeado para este grupo ainda.
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
