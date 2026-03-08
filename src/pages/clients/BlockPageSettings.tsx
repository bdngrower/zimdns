import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface BlockPageSettingsProps {
    clientId: string;
}

export function BlockPageSettings({ clientId }: BlockPageSettingsProps) {
    const [config, setConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        async function loadData() {
            const { data } = await supabase.from('block_pages').select('*').eq('client_id', clientId).single();
            if (data) {
                setConfig(data);
            } else {
                setConfig({
                    title: 'Acesso Bloqueado',
                    subtitle: 'Política de Rede',
                    description: 'Este conteúdo foi bloqueado pelo administrador.',
                    primary_color: '#ef4444',
                    button_text: 'Voltar',
                    show_domain: true,
                    show_reason: true
                });
            }
            setIsLoading(false);
        }
        loadData();
    }, [clientId]);

    const handleChange = (field: string, value: any) => {
        setConfig((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await supabase.from('block_pages').upsert({
            client_id: clientId,
            ...config,
            updated_at: new Date().toISOString()
        }, { onConflict: 'client_id' });
        setIsSaving(false);
    };

    if (isLoading || !config) return <div className="py-8 text-center text-slate-500">Caregando preview...</div>;

    return (
        <div className="grid lg:grid-cols-2 gap-8">
            {/* Editor */}
            <div>
                <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-slate-900">Personalização</h3>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-50"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cor Principal</label>
                        <div className="flex gap-3 items-center">
                            <input
                                type="color"
                                value={config.primary_color}
                                onChange={(e) => handleChange('primary_color', e.target.value)}
                                className="h-9 w-14 rounded cursor-pointer"
                            />
                            <span className="text-xs text-slate-500 font-mono">{config.primary_color}</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                        <input type="text" value={config.title} onChange={(e) => handleChange('title', e.target.value)} className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Subtítulo</label>
                        <input type="text" value={config.subtitle || ''} onChange={(e) => handleChange('subtitle', e.target.value)} className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição Adicional</label>
                        <textarea rows={3} value={config.description || ''} onChange={(e) => handleChange('description', e.target.value)} className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6" />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <input type="checkbox" id="showDomain" checked={config.show_domain} onChange={(e) => handleChange('show_domain', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent" />
                        <label htmlFor="showDomain" className="text-sm text-slate-700">Exibir domínio bloqueado na tela</label>
                    </div>
                </div>
            </div>

            {/* Preview */}
            <div className="bg-slate-100 rounded-xl border border-border p-4 flex items-center justify-center min-h-[500px] overflow-hidden relative">
                <div className="absolute top-2 left-2 text-xs font-semibold text-slate-400">PREVIEW</div>

                {/* Mock Context for preview */}
                <div className="bg-white max-w-sm w-full rounded-lg shadow-xl overflow-hidden text-center">
                    <div className="h-2 w-full" style={{ backgroundColor: config.primary_color }}></div>
                    <div className="p-8">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-6" style={{ backgroundColor: `${config.primary_color}15` }}>
                            <svg className="w-8 h-8" style={{ color: config.primary_color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>

                        <h1 className="text-xl font-bold text-slate-900">{config.title}</h1>
                        {config.subtitle && <p className="text-sm font-medium mt-1" style={{ color: config.primary_color }}>{config.subtitle}</p>}

                        <p className="mt-4 text-sm text-slate-500">{config.description}</p>

                        {config.show_domain && (
                            <div className="mt-6 p-3 bg-slate-50 rounded border border-slate-100">
                                <p className="text-xs text-slate-400 mb-1">Domínio restrito:</p>
                                <p className="text-sm font-mono text-slate-800 break-all">exemplo-bloqueado.com</p>
                            </div>
                        )}

                        <button className="mt-6 w-full py-2 px-4 rounded font-medium text-white text-sm" style={{ backgroundColor: config.primary_color }}>
                            {config.button_text}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
