import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Plus, Pencil, Trash2, ChevronRight, X, Save,
    Layers, LayoutGrid, Globe, AlertCircle, Loader2, CheckCircle2,
    Import
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Category {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    status?: string;
}

interface Service {
    id: string;
    name: string;
    description?: string;
    category_id?: string;
    category?: string;
    status?: string;
}

interface Domain {
    id: string;
    service_id: string;
    domain: string;
}

type Toast = { type: 'success' | 'error'; text: string } | null;

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ t, onClose }: { t: Toast; onClose: () => void }) {
    if (!t) return null;
    return (
        <div className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium transition-all',
            t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        )}>
            {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {t.text}
            <button onClick={onClose} className="ml-2 text-current opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
    );
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm border border-slate-200">
                <h3 className="text-base font-bold text-slate-900 mb-2">Confirmar exclusão</h3>
                <p className="text-sm text-slate-500 mb-6">{message}</p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</button>
                    <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700">Excluir</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CategoryPanel({ onSelectCategory }: { onSelectCategory: (c: Category) => void }) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState<Partial<Category> | null>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<Toast>(null);
    const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);

    const showToast = (t: Toast) => { setToast(t); setTimeout(() => setToast(null), 4000); };

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('block_categories').select('*').order('name');
        setCategories(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!form?.name?.trim()) return showToast({ type: 'error', text: 'Nome é obrigatório.' });
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
        showToast({ type: 'success', text: form.id ? 'Categoria atualizada.' : 'Categoria criada.' });
        setForm(null);
        load();
    };

    const remove = async (id: string) => {
        const { error } = await supabase.from('block_categories').delete().eq('id', id);
        setConfirm(null);
        if (error) return showToast({ type: 'error', text: `Erro ao excluir: ${error.message}` });
        showToast({ type: 'success', text: 'Categoria excluída.' });
        load();
    };

    return (
        <div className="space-y-4">
            <Toast t={toast} onClose={() => setToast(null)} />
            {confirm && <ConfirmDialog message={`Excluir "${confirm.name}"? Todos os serviços vinculados perderão a categoria.`} onConfirm={() => remove(confirm.id)} onCancel={() => setConfirm(null)} />}

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Categorias</h2>
                    <p className="text-sm text-slate-500">Grupos que organizam os serviços/toggles de bloqueio.</p>
                </div>
                <button onClick={() => setForm({})} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
                    <Plus className="h-4 w-4" /> Nova Categoria
                </button>
            </div>

            {/* Form inline */}
            {form !== null && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">{form.id ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                        <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Descrição curta..." />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : categories.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Nenhuma categoria. Clique em "Nova Categoria" para começar.</div>
            ) : (
                <div className="space-y-2">
                    {categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors group">
                            <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => onSelectCategory(cat)}>
                                <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <Layers className="h-4 w-4 text-slate-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 text-sm">{cat.name}</p>
                                    {cat.description && <p className="text-xs text-slate-400 line-clamp-1">{cat.description}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onSelectCategory(cat)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                                    Gerenciar Serviços <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setForm({ ...cat })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700">
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setConfirm({ id: cat.id, name: cat.name })} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ServicePanel({ category, onBack, onSelectService }: { category: Category; onBack: () => void; onSelectService: (s: Service) => void }) {
    const [services, setServices] = useState<Service[]>([]);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState<Partial<Service> | null>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<Toast>(null);
    const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);

    const showToast = (t: Toast) => { setToast(t); setTimeout(() => setToast(null), 4000); };

    const load = useCallback(async () => {
        setLoading(true);
        const [svcRes, catRes] = await Promise.all([
            supabase.from('service_catalog').select('*').eq('category_id', category.id).order('name'),
            supabase.from('block_categories').select('id, name').order('name'),
        ]);
        setServices(svcRes.data ?? []);
        setAllCategories(catRes.data ?? []);
        setLoading(false);
    }, [category.id]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!form?.name?.trim()) return showToast({ type: 'error', text: 'Nome é obrigatório.' });
        setSaving(true);
        const payload: any = {
            name: form.name.trim(),
            description: form.description || null,
            category_id: form.category_id || category.id,
            category: form.category || category.name,
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
        showToast({ type: 'success', text: form.id ? 'Serviço atualizado.' : 'Serviço criado. Já aparece nos toggles dos clientes.' });
        setForm(null);
        load();
    };

    const remove = async (id: string) => {
        const { error } = await supabase.from('service_catalog').delete().eq('id', id);
        setConfirm(null);
        if (error) return showToast({ type: 'error', text: `Erro: ${error.message}` });
        showToast({ type: 'success', text: 'Serviço excluído.' });
        load();
    };

    return (
        <div className="space-y-4">
            <Toast t={toast} onClose={() => setToast(null)} />
            {confirm && <ConfirmDialog message={`Excluir "${confirm.name}"? Os domínios vinculados também serão removidos.`} onConfirm={() => remove(confirm.id)} onCancel={() => setConfirm(null)} />}

            <div className="flex items-center gap-2 text-sm text-slate-500">
                <button onClick={onBack} className="hover:text-slate-800 font-medium transition-colors">Categorias</button>
                <ChevronRight className="h-4 w-4" />
                <span className="font-semibold text-slate-900">{category.name}</span>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Serviços em "{category.name}"</h2>
                    <p className="text-sm text-slate-500">Cada serviço vira um toggle em Clientes → Políticas de Bloqueio.</p>
                </div>
                <button onClick={() => setForm({ category_id: category.id, category: category.name })}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
                    <Plus className="h-4 w-4" /> Novo Serviço
                </button>
            </div>

            {form !== null && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">{form.id ? 'Editar Serviço' : 'Novo Serviço'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome *</label>
                            <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="ex: Facebook" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
                            <select value={form.category_id || category.id}
                                onChange={e => {
                                    const cat = allCategories.find(c => c.id === e.target.value);
                                    setForm(f => ({ ...f, category_id: e.target.value, category: cat?.name || '' }));
                                }}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                        <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Descrição curta..." />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : services.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Nenhum serviço nesta categoria. Clique em "Novo Serviço".</div>
            ) : (
                <div className="space-y-2">
                    {services.map(svc => (
                        <div key={svc.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors group">
                            <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => onSelectService(svc)}>
                                <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <LayoutGrid className="h-4 w-4 text-slate-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 text-sm">{svc.name}</p>
                                    {svc.description && <p className="text-xs text-slate-400 line-clamp-1">{svc.description}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onSelectService(svc)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                                    Gerenciar Domínios <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setForm({ ...svc })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700">
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setConfirm({ id: svc.id, name: svc.name })} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
function DomainPanel({ service, category, onBack }: { service: Service; category: Category; onBack: () => void }) {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const [newDomain, setNewDomain] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [showBulk, setShowBulk] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<Toast>(null);
    const [confirm, setConfirm] = useState<{ id: string; domain: string } | null>(null);

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
        setConfirm(null);
        if (error) return showToast({ type: 'error', text: `Erro: ${error.message}` });
        showToast({ type: 'success', text: 'Domínio removido.' });
        load();
    };

    return (
        <div className="space-y-4">
            <Toast t={toast} onClose={() => setToast(null)} />
            {confirm && <ConfirmDialog message={`Remover "${confirm.domain}" deste serviço?`} onConfirm={() => remove(confirm.id)} onCancel={() => setConfirm(null)} />}

            <div className="flex items-center gap-2 text-sm text-slate-500">
                <button onClick={() => onBack()} className="hover:text-slate-800 font-medium transition-colors">Categorias</button>
                <ChevronRight className="h-4 w-4" />
                <button onClick={onBack} className="hover:text-slate-800 font-medium transition-colors">{category.name}</button>
                <ChevronRight className="h-4 w-4" />
                <span className="font-semibold text-slate-900">{service.name}</span>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Domínios de "{service.name}"</h2>
                    <p className="text-sm text-slate-500">Quando o toggle "{service.name}" estiver ativo, todos esses domínios serão bloqueados.</p>
                </div>
                <button onClick={() => setShowBulk(s => !s)}
                    className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                    <Import className="h-4 w-4" />
                    Importar Múltiplos
                </button>
            </div>

            {/* Add single */}
            <div className="flex gap-2">
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
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Cole um domínio por linha:</p>
                    <textarea
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                        rows={6}
                        placeholder={"facebook.com\nfbcdn.net\nmessenger.com\nfacebook.net"}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                        <button onClick={bulkAdd} disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Importar
                        </button>
                        <button onClick={() => setShowBulk(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white">Fechar</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : domains.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Nenhum domínio. Adicione acima.</div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <Globe className="h-3.5 w-3.5" />
                        {domains.length} domínio(s) cadastrado(s)
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {domains.map(d => (
                            <li key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 group transition-colors">
                                <span className="text-sm font-mono text-slate-800">{d.domain}</span>
                                <button onClick={() => setConfirm({ id: d.id, domain: d.domain })}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT: CatalogAdmin
// ─────────────────────────────────────────────────────────────────────────────
type Screen =
    | { view: 'categories' }
    | { view: 'services'; category: Category }
    | { view: 'domains'; category: Category; service: Service };

export function CatalogAdmin() {
    const [screen, setScreen] = useState<Screen>({ view: 'categories' });

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administração do Catálogo</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Gerencie categorias, serviços e domínios. Qualquer alteração reflete automaticamente nos toggles dos clientes.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 min-h-[500px]">
                {screen.view === 'categories' && (
                    <CategoryPanel
                        onSelectCategory={cat => setScreen({ view: 'services', category: cat })}
                    />
                )}
                {screen.view === 'services' && (
                    <ServicePanel
                        category={screen.category}
                        onBack={() => setScreen({ view: 'categories' })}
                        onSelectService={svc => setScreen({ view: 'domains', category: screen.category, service: svc })}
                    />
                )}
                {screen.view === 'domains' && (
                    <DomainPanel
                        category={screen.category}
                        service={screen.service}
                        onBack={() => setScreen({ view: 'services', category: screen.category })}
                    />
                )}
            </div>
        </div>
    );
}
