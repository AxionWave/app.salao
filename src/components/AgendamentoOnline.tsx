import { useEffect, useState, type ReactNode } from 'react';
import PageCard from '@/components/layout/PageCard';
import { Alert, Button, Switch, Textarea } from '@/components/ui';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import { useTermos } from '@/contexts/TermosContext';
import { portalService, type PortalConfig, type PortalConfigResposta } from '@/services/portal.service';

const ANTECEDENCIAS = [
    { valor: 0, nome: 'Até a hora do horário' },
    { valor: 30, nome: '30 minutos antes' },
    { valor: 60, nome: '1 hora antes' },
    { valor: 120, nome: '2 horas antes' },
    { valor: 240, nome: '4 horas antes' },
    { valor: 720, nome: '12 horas antes' },
    { valor: 1440, nome: '1 dia antes' },
    { valor: 2880, nome: '2 dias antes' },
    { valor: 10080, nome: '7 dias antes' },
];
const PRAZOS = [
    { valor: '', nome: 'Não permitir (só falando com a empresa)' },
    { valor: '0', nome: 'Até a hora do horário' },
    { valor: '2', nome: 'Até 2 horas antes' },
    { valor: '6', nome: 'Até 6 horas antes' },
    { valor: '12', nome: 'Até 12 horas antes' },
    { valor: '24', nome: 'Até 1 dia antes' },
    { valor: '48', nome: 'Até 2 dias antes' },
];
const JANELAS = [7, 14, 30, 60, 90, 180, 365];
const LIMITES = [1, 2, 3, 4, 5, 10];
const PASSOS = [10, 15, 20, 30, 60];
const MAX_APRESENTACAO = 500;

const base = `${window.location.origin}${(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')}`;

function Chip({ ligado, disabled, onClick, children }: { ligado: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={ligado}
            disabled={disabled}
            onClick={onClick}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed"
            style={
                ligado
                    ? { borderColor: 'var(--copper)', background: 'var(--copper)', color: '#fff' }
                    : { borderColor: 'var(--line)', background: 'transparent', color: 'var(--muted-foreground)' }
            }
        >
            {ligado ? '✓ ' : ''}
            {children}
        </button>
    );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {label}
            {children}
        </label>
    );
}

/** Configuração da página pública onde o cliente marca sozinho. */
export default function AgendamentoOnline() {
    const t = useTermos();
    const [dados, setDados] = useState<PortalConfigResposta | null>(null);
    const [form, setForm] = useState<PortalConfig | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    const [salvoEm, setSalvoEm] = useState<Date | null>(null);
    const [checagem, setChecagem] = useState<{ endereco: string; disponivel: boolean; motivo: string | null } | null>(null);
    const [copiado, setCopiado] = useState(false);

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const r = await portalService.config();
                if (!vivo) return;
                setDados(r);
                setForm({ ...r.portal, endereco: r.portal.endereco ?? r.sugestao });
            } catch (e) {
                if (vivo) setErro(mensagemErroHttp(e));
            } finally {
                if (vivo) setCarregando(false);
            }
        })();
        return () => {
            vivo = false;
        };
    }, []);

    const endereco = form?.endereco?.trim().toLowerCase() ?? '';
    const salvo = dados?.portal.endereco ?? null;

    useEffect(() => {
        if (!endereco || endereco === salvo) return;
        let vivo = true;
        const espera = setTimeout(async () => {
            try {
                const r = await portalService.disponivel(endereco);
                if (vivo) setChecagem({ endereco, ...r });
            } catch {
                if (vivo) setChecagem(null);
            }
        }, 400);
        return () => {
            vivo = false;
            clearTimeout(espera);
        };
    }, [endereco, salvo]);

    const mudar = (parcial: Partial<PortalConfig>) => {
        setForm((f) => (f ? { ...f, ...parcial } : f));
        setSalvoEm(null);
    };

    const alternar = (lista: number[], id: number) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

    const salvar = async () => {
        if (!form) return;
        setSalvando(true);
        setErro('');
        try {
            const r = await portalService.salvarConfig({
                ...form,
                endereco: endereco || null,
                apresentacao: form.apresentacao?.trim() || null,
            });
            setDados(r);
            setForm({ ...r.portal, endereco: r.portal.endereco ?? r.sugestao });
            setSalvoEm(new Date());
        } catch (e) {
            setErro(mensagemErroHttp(e));
        } finally {
            setSalvando(false);
        }
    };

    const copiar = async () => {
        if (!salvo) return;
        try {
            await navigator.clipboard.writeText(`${base}${salvo}`);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            setCopiado(false);
        }
    };

    const clientes = t.cliente.plural.toLocaleLowerCase('pt-BR');
    const status = endereco && endereco !== salvo && checagem?.endereco === endereco ? checagem : null;
    const publicado = dados?.portal.ativo && salvo;

    return (
        <PageCard fill={false}>
            <div className="p-5 md:p-6">
                <div className="mb-4 flex flex-col gap-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--copper)' }}>
                        Online
                    </p>
                    <h2 className="font-display text-lg font-semibold">Agendamento online</h2>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Uma página da empresa onde {clientes} escolhem o horário e marcam sozinhos, entrando com um código
                        enviado por e-mail. O {t.agendamento.singular.toLocaleLowerCase('pt-BR')} cai na agenda e a equipe
                        é avisada.
                    </p>
                </div>

                {erro && (
                    <div className="mb-4">
                        <Alert titulo={tituloDeMensagem(erro)}>{erro}</Alert>
                    </div>
                )}

                {carregando && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Carregando…
                    </p>
                )}

                {!carregando && dados && form && (
                    <div className="flex flex-col gap-4">
                        <Switch
                            label="Receber agendamentos online"
                            descricao={
                                form.ativo
                                    ? 'A página fica no ar no endereço abaixo.'
                                    : 'Desligado, o endereço fica guardado mas a página não abre.'
                            }
                            checked={form.ativo}
                            disabled={salvando}
                            onChange={(v) => mudar({ ativo: v })}
                        />

                        <div>
                            <label htmlFor="portal-endereco" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                Endereço da página
                            </label>
                            <div className="lyra-input flex items-center gap-0 p-0" style={{ paddingTop: 0, paddingBottom: 0 }}>
                                <span className="shrink-0 select-none py-2.5 pl-3" style={{ color: 'var(--muted-foreground)' }}>
                                    {base.replace(/^https?:\/\//, '')}
                                </span>
                                <input
                                    id="portal-endereco"
                                    className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 outline-none"
                                    style={{ color: 'var(--ink)' }}
                                    value={form.endereco ?? ''}
                                    maxLength={40}
                                    disabled={salvando}
                                    placeholder="nome-da-empresa"
                                    onChange={(e) =>
                                        mudar({ endereco: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
                                    }
                                />
                            </div>
                            <p
                                className="mt-1 text-xs"
                                style={{
                                    color: status ? (status.disponivel ? 'var(--ok)' : 'var(--destructive)') : 'var(--faint)',
                                }}
                            >
                                {status
                                    ? status.disponivel
                                        ? 'Disponível'
                                        : status.motivo
                                    : 'Letras minúsculas, números e hífen. Mudar o endereço tira o antigo do ar.'}
                            </p>
                        </div>

                        {publicado && (
                            <div
                                className="flex flex-col gap-2 rounded-lyra border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                            >
                                <a
                                    href={`${base}${salvo}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="min-w-0 truncate text-sm font-medium underline"
                                    style={{ color: 'var(--copper)' }}
                                >
                                    {`${base}${salvo}`.replace(/^https?:\/\//, '')}
                                </a>
                                <Button size="sm" variant="secondary" onClick={() => void copiar()}>
                                    {copiado ? 'Copiado' : 'Copiar link'}
                                </Button>
                            </div>
                        )}

                        <Textarea
                            label="Apresentação"
                            placeholder="Ex.: Atendemos de segunda a sábado. Chegue 10 minutos antes."
                            rows={2}
                            maxLength={MAX_APRESENTACAO}
                            value={form.apresentacao ?? ''}
                            disabled={salvando}
                            helperText="Aparece no topo da página, abaixo do nome da empresa."
                            onChange={(e) => mudar({ apresentacao: e.target.value })}
                        />

                        <div className="grid gap-4 md:grid-cols-2">
                            <Campo label="Marcar com antecedência mínima">
                                <select
                                    className="lyra-input"
                                    value={form.antecedenciaMinutos}
                                    disabled={salvando}
                                    onChange={(e) => mudar({ antecedenciaMinutos: Number(e.target.value) })}
                                >
                                    {ANTECEDENCIAS.map((a) => (
                                        <option key={a.valor} value={a.valor}>
                                            {a.nome}
                                        </option>
                                    ))}
                                </select>
                            </Campo>
                            <Campo label="Mostrar horários até">
                                <select
                                    className="lyra-input"
                                    value={form.janelaDias}
                                    disabled={salvando}
                                    onChange={(e) => mudar({ janelaDias: Number(e.target.value) })}
                                >
                                    {JANELAS.map((d) => (
                                        <option key={d} value={d}>
                                            {d} dias à frente
                                        </option>
                                    ))}
                                </select>
                            </Campo>
                            <Campo label={`Horários marcados por ${t.cliente.singular.toLocaleLowerCase('pt-BR')}`}>
                                <select
                                    className="lyra-input"
                                    value={form.limiteAbertos}
                                    disabled={salvando}
                                    onChange={(e) => mudar({ limiteAbertos: Number(e.target.value) })}
                                >
                                    {LIMITES.map((n) => (
                                        <option key={n} value={n}>
                                            {n === 1 ? 'Só 1 por vez' : `Até ${n} ao mesmo tempo`}
                                        </option>
                                    ))}
                                </select>
                            </Campo>
                            <Campo label="Horários de quanto em quanto tempo">
                                <select
                                    className="lyra-input"
                                    value={form.passoMinutos}
                                    disabled={salvando}
                                    onChange={(e) => mudar({ passoMinutos: Number(e.target.value) })}
                                >
                                    {PASSOS.map((n) => (
                                        <option key={n} value={n}>
                                            {n === 60 ? 'De 1 em 1 hora' : `De ${n} em ${n} minutos`}
                                        </option>
                                    ))}
                                </select>
                            </Campo>
                            <Campo label="Cancelar e remarcar pelo site">
                                <select
                                    className="lyra-input"
                                    value={form.prazoAlteracaoHoras === null ? '' : String(form.prazoAlteracaoHoras)}
                                    disabled={salvando}
                                    onChange={(e) =>
                                        mudar({ prazoAlteracaoHoras: e.target.value === '' ? null : Number(e.target.value) })
                                    }
                                >
                                    {!PRAZOS.some((p) => p.valor === String(form.prazoAlteracaoHoras ?? '')) && (
                                        <option value={String(form.prazoAlteracaoHoras)}>
                                            Até {form.prazoAlteracaoHoras} horas antes
                                        </option>
                                    )}
                                    {PRAZOS.map((p) => (
                                        <option key={p.valor} value={p.valor}>
                                            {p.nome}
                                        </option>
                                    ))}
                                </select>
                            </Campo>
                        </div>

                        {dados.servicos.length > 0 && (
                            <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                    {t.servico.plural} na página
                                </p>
                                <p className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                    Desmarque o que só a equipe pode marcar.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {dados.servicos.map((s) => (
                                        <Chip
                                            key={s.id}
                                            ligado={!form.servicosOcultos.includes(s.id)}
                                            disabled={salvando}
                                            onClick={() => mudar({ servicosOcultos: alternar(form.servicosOcultos, s.id) })}
                                        >
                                            {s.nome}
                                        </Chip>
                                    ))}
                                </div>
                            </div>
                        )}

                        {dados.profissionais.length > 0 && (
                            <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                    {t.recurso.plural} na página
                                </p>
                                <p className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                    Quem fica desmarcado não recebe {t.agendamento.plural.toLocaleLowerCase('pt-BR')} online.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {dados.profissionais.map((p) => (
                                        <Chip
                                            key={p.id}
                                            ligado={!form.profissionaisOcultos.includes(p.id)}
                                            disabled={salvando}
                                            onClick={() =>
                                                mudar({ profissionaisOcultos: alternar(form.profissionaisOcultos, p.id) })
                                            }
                                        >
                                            {p.nome}
                                        </Chip>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3">
                            {salvoEm && (
                                <span className="text-xs" style={{ color: 'var(--ok)' }}>
                                    Salvo
                                </span>
                            )}
                            <Button
                                onClick={() => void salvar()}
                                disabled={salvando || (form.ativo && !endereco) || status?.disponivel === false}
                            >
                                {salvando ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </PageCard>
    );
}
