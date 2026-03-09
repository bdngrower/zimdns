import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Save, Loader2, Import, Trash2, Globe, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface Category {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    status?: string;
}

export interface Service {
    id: string;
    name: string;
    description?: string;
    category_id?: string;
    category?: string;
    status?: string;
}

export interface Domain {
    id: string;
    service_id: string;
    domain: string;
}

type Toast = { type: 'success' | 'error'; text: string } | null;

function ToastMsg({ t, onClose }: { t: Toast; onClose: () => void }) {
    if (!t) return null;
    return (
        <div className={cn(
            'absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium transition-all',
            t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        )}>
            {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {t.text}
            <button onClick={onClose} className="ml-2 text-current opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY MODAL
// ─────────────────────────────────────────────────────────────────────────────
export function CategoryFormModal({ category, onClose, onSave }: { category?: Partial<Category>, onClose: () => void, onSave: () => void }) {
    const [form, setForm] = useState<Partial<Category>>(category || {});
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<Toast>(null);

    const showToast = (t: Toast) => { setToast(t); setTimeout(() => setToast(null), 4000); };

    const save = async () => {
        if (!form.name?.trim()) return showToast({ type: 'error', text: 'Nome é obrigatório.' });
        setSaving(true);
        const payload = { name: form.name.trim(), description: form.description || null, icon: form.icon || null, status: 'active' };
        let error;
        if (form.id) {
            ({ error } = await supabase.from('block_categories').update(payload).eq('id', form.id));
        } else {
            ({ error } = await supabase.from('block_categories').insert(payload));
        }
        setSaving(false);
        if (error) return showToast({ type: 'error', text: `Erro: ${error.message}` });
        onSave();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 relative overflow-hidden">
                <ToastMsg t={toast} onClose={() => setToast(null)} />
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">{form.id ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Nome *</label>
                        <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="ex: Redes Sociais" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Ícone (opcional)</label>
                        <input value={form.icon || ''} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="ex: users" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                        <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Descrição curta..." />
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white">Cancelar</button>
                    <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE MODAL
// ─────────────────────────────────────────────────────────────────────────────
export function ServiceFormModal({ service, defaultCategoryId, allCategories, onClose, onSave }: { service?: Partial<Service>, defaultCategoryId?: string, allCategories: Category[], onClose: () => void, onSave: () => void }) {
    const [form, setForm] = useState<Partial<Service>>(service || { category_id: defaultCategoryId });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<Toast>(null);

    const showToast = (t: Toast) => { setToast(t); setTimeout(() => setToast(null), 4000); };

    const save = async () => {
        if (!form.name?.trim()) return showToast({ type: 'error', text: 'Nome é obrigatório.' });
        if (!form.category_id) return showToast({ type: 'error', text: 'Categoria é obrigatória.' });

        const catName = allCategories.find(c => c.id === form.category_id)?.name || '';
        setSaving(true);
        const payload: any = {
            name: form.name.trim(),
            description: form.description || null,
            category_id: form.category_id,
            category: catName,
            status: 'active'
        };
        let error;
        if (form.id) {
            ({ error } = await supabase.from('service_catalog').update(payload).eq('id', form.id));
        } else {
            ({ error } = await supabase.from('service_catalog').insert(payload));
        }
        setSaving(false);
        if (error) return showToast({ type: 'error', text: `Erro: ${error.message}` });
        onSave();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 relative overflow-hidden">
                <ToastMsg t={toast} onClose={() => setToast(null)} />
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">{form.id ? 'Editar Serviço' : 'Novo Serviço'}</h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Nome *</label>
                        <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="ex: Facebook" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria *</label>
                        <select value={form.category_id || ''}
                            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="" disabled>Selecione uma categoria</option>
                            {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                        <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Descrição curta..." />
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white">Cancelar</button>
                    <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN MANAGER MODAL
// ─────────────────────────────────────────────────────────────────────────────
export function DomainManagerModal({ service, onClose }: { service: Service; onClose: () => void }) {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const [newDomain, setNewDomain] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [showBulk, setShowBulk] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<Toast>(null);

    const showToast = (t: Toast) => { setToast(t); setTimeout(() => setToast(null), 4000); };

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('service_domains').select('*').eq('service_id', service.id).order('domain');
        setDomains(data ?? []);
        setLoading(false);
    }, [service.id]);

    useEffect(() => { load(); }, [load]);

    const addDomain = async () => {
        const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (!d) return showToast({ type: 'error', text: 'Informe um domínio válido.' });
        setSaving(true);
        const { error } = await supabase.from('service_domains').insert({ service_id: service.id, domain: d });
        setSaving(false);
        if (error) return showToast({ type: 'error', text: error.code === '23505' ? 'Domínio já existe.' : `Erro: ${error.message}` });
        setNewDomain('');
        showToast({ type: 'success', text: `"${d}" adicionado.` });
        load();
    };

    const bulkAdd = async () => {
        const lines = bulkText.split('\n').map(l => l.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')).filter(Boolean);
        if (lines.length === 0) return showToast({ type: 'error', text: 'Cole ao menos um domínio.' });
        setSaving(true);
        const rows = lines.map(domain => ({ service_id: service.id, domain }));
        const { error } = await supabase.from('service_domains').upsert(rows, { onConflict: 'service_id,domain', ignoreDuplicates: true });
        setSaving(false);
        if (error) return showToast({ type: 'error', text: `Erro: ${error.message}` });
        showToast({ type: 'success', text: `${lines.length} domínio(s) importados.` });
        setBulkText('');
        setShowBulk(false);
        load();
    };

    const remove = async (id: string) => {
        const { error } = await supabase.from('service_domains').delete().eq('id', id);
        if (error) return showToast({ type: 'error', text: `Erro: ${error.message}` });
        load();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 relative overflow-hidden flex flex-col max-h-[85vh]">
                <ToastMsg t={toast} onClose={() => setToast(null)} />
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">Domínios de "{service.name}"</h3>
                        <p className="text-sm text-slate-500">Gerencie a lista de interceptação</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30">
                    <div className="flex justify-between mb-4">
                        <button onClick={() => setShowBulk(s => !s)}
                            className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-white transition-colors shadow-sm bg-slate-50">
                            <Import className="h-4 w-4" />
                            Importar Múltiplos
                        </button>
                    </div>

                    {/* Add single */}
                    <div className="flex gap-2 mb-6">
                        <input
                            value={newDomain}
                            onChange={e => setNewDomain(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addDomain()}
                            placeholder="ex: facebook.com"
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button onClick={addDomain} disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Adicionar
                        </button>
                    </div>

                    {/* Bulk import */}
                    {showBulk && (
                        <div className="bg-white border text-left border-blue-200 rounded-xl p-4 space-y-3 mb-6 shadow-sm">
                            <p className="text-xs font-semibold text-slate-700">Cole um domínio por linha:</p>
                            <textarea
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                                rows={6}
                                placeholder={"facebook.com\nfbcdn.net"}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2">
                                <button onClick={bulkAdd} disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Processar Lote
                                </button>
                                <button onClick={() => setShowBulk(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                    ) : domains.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-white">Nenhum domínio cadastrado.</div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    <Globe className="h-3.5 w-3.5" />
                                    {domains.length} domínio(s)
                                </span>
                            </div>
                            <ul className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto">
                                {domains.map(d => (
                                    <li key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 group transition-colors">
                                        <span className="text-sm font-mono text-slate-800">{d.domain}</span>
                                        <button onClick={() => remove(d.id)}
                                            title="Excluir Domínio"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
