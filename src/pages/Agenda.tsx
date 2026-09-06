import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';
import GradeDia from '@/components/agenda/GradeDia';
import GradeSemana from '@/components/agenda/GradeSemana';
import { Alert, Badge, Button, Input, Modal, Textarea } from '@/components/ui';
import { authService } from '@core/services';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import {
    STATUS_AGENDA,
    adicionarDias,
    cloneDia,
    dataComMinutos,
    deDatetimeLocal,
    formatarDuracaoMinutos,
    formatarFaixaSemana,
    formatarHora,
    inicioDaSemana,
    intervaloNoDia,
    labelStatus,
    ocupaHorario,
    paraDatetimeLocal,
    partesDia,
    statusTerminal,
    transicoesDe,
    varianteStatus,
} from '@/lib/agenda';
import { formatarTelefoneExibicao } from '@/lib/telefone';
import { MODULO_CLIENTES, MODULO_PROFISSIONAIS, MODULO_SERVICOS } from '@/constants/moduleCodes';
import {
    agendamentoService,
    type Agendamento,
    type OpcoesAgenda,
    type SalvarAgendamento,
    rotuloServicos,
} from '@/services/agendamento.service';
import { clienteService, type Cliente } from '@/services/cliente.service';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Visao = 'dia' | 'semana';

type FormAgenda = {
    clienteId: string;
    servicoIds: number[];
    profissionalId: string;
    inicio: string;
    observacoes: string;
};

const formVazio: FormAgenda = {
    clienteId: '',
    servicoIds: [],
    profissionalId: '',
    inicio: '',
    observacoes: '',
};

function CampoSelect({
    label,
    value,
    onChange,
    children,
    required,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    children: ReactNode;
    required?: boolean;
}) {
    return (
        <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                {label}
                {required && <span style={{ color: 'var(--destructive)' }}> *</span>}
            </label>
            <select
                className="lyra-input"
                style={{ marginTop: 0 }}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {children}
            </select>
        </div>
    );
}

export default function AgendaPage() {
    const [visao, setVisao] = useState<Visao>('dia');
    const [cursor, setCursor] = useState(() => cloneDia(new Date()));
    const [filtroProf, setFiltroProf] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');
    const [opcoes, setOpcoes] = useState<OpcoesAgenda>({ profissionais: [], servicos: [] });
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [itens, setItens] = useState<Agendamento[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erroLista, setErroLista] = useState('');
    const [formAberto, setFormAberto] = useState(false);
    const [editando, setEditando] = useState<Agendamento | null>(null);
    const [form, setForm] = useState<FormAgenda>(formVazio);
    const [adicionarServicoId, setAdicionarServicoId] = useState('');
    const [formErro, setFormErro] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [statusando, setStatusando] = useState('');

    const periodo = useMemo(() => {
        if (visao === 'semana') {
            const de = inicioDaSemana(cursor);
            return { de, ate: adicionarDias(de, 7) };
        }
        const de = cloneDia(cursor);
        return { de, ate: adicionarDias(de, 1) };
    }, [cursor, visao]);

    const profissionaisVisiveis = useMemo(() => {
        const lista = opcoes.profissionais;
        if (!filtroProf) return lista;
        return lista.filter((p) => String(p.id) === filtroProf);
    }, [opcoes.profissionais, filtroProf]);

    const diasSemana = useMemo(() => {
        const ini = inicioDaSemana(cursor);
        return Array.from({ length: 7 }, (_, i) => adicionarDias(ini, i));
    }, [cursor]);

    const carregar = useCallback(async () => {
        setCarregando(true);
        setErroLista('');
        try {
            const [ops, lista, cli] = await Promise.all([
                agendamentoService.opcoes(),
                agendamentoService.listar({
                    de: periodo.de.toISOString(),
                    ate: periodo.ate.toISOString(),
                    profissionalId: filtroProf ? Number(filtroProf) : undefined,
                    status: filtroStatus || undefined,
                }),
                clienteService
                    .listar({ ativo: true, page: 1, pageSize: 200 })
                    .then((r) => r.items)
                    .catch(() => [] as Cliente[]),
            ]);
            setOpcoes(ops);
            setItens(lista.items);
            setClientes(cli);
        } catch (e) {
            setErroLista(mensagemErroHttp(e));
            setItens([]);
        } finally {
            setCarregando(false);
        }
    }, [periodo.de, periodo.ate, filtroProf, filtroStatus]);

    useEffect(() => {
        void carregar();
    }, [carregar]);

    const fecharForm = () => {
        if (salvando || statusando) return;
        setFormAberto(false);
        setEditando(null);
    };

    const preencherForm = (patch: Partial<FormAgenda>) => {
        setForm((f) => ({ ...f, ...patch }));
    };

    const abrirNovo = (seed?: { profissionalId?: number; inicio?: Date }) => {
        const profId = seed?.profissionalId ?? opcoes.profissionais[0]?.id;
        const servId = opcoes.servicos[0]?.id;
        const inicio = seed?.inicio ?? dataComMinutos(cloneDia(cursor), 9 * 60);
        setEditando(null);
        setAdicionarServicoId('');
        setForm({
            ...formVazio,
            clienteId: clientes[0] ? String(clientes[0].id) : '',
            servicoIds: servId ? [servId] : [],
            profissionalId: profId ? String(profId) : '',
            inicio: paraDatetimeLocal(inicio),
        });
        setFormErro('');
        setFormAberto(true);
    };

    const abrirDetalhe = (a: Agendamento) => {
        setEditando(a);
        setAdicionarServicoId('');
        setForm({
            clienteId: String(a.clienteId),
            servicoIds: a.servicos?.length ? a.servicos.map((s) => s.id) : [],
            profissionalId: String(a.profissionalId),
            inicio: paraDatetimeLocal(new Date(a.inicio)),
            observacoes: a.observacoes ?? '',
        });
        setFormErro('');
        setFormAberto(true);
    };

    const payload = (): SalvarAgendamento | null => {
        const clienteId = Number(form.clienteId);
        const profissionalId = Number(form.profissionalId);
        if (!clienteId || !profissionalId || form.servicoIds.length === 0 || !form.inicio) return null;
        const inicio = deDatetimeLocal(form.inicio);
        if (Number.isNaN(inicio.getTime())) return null;
        return {
            clienteId,
            servicoIds: form.servicoIds,
            profissionalId,
            inicio: inicio.toISOString(),
            observacoes: form.observacoes.trim() || null,
        };
    };

    const salvar = async () => {
        const body = payload();
        if (!body) {
            setFormErro('Preencha cliente, ao menos um serviço, profissional e horário.');
            return;
        }
        setSalvando(true);
        setFormErro('');
        try {
            if (editando) {
                await agendamentoService.atualizar(editando.id, body);
            } else {
                await agendamentoService.criar(body);
            }
            setFormAberto(false);
            setEditando(null);
            await carregar();
        } catch (e) {
            setFormErro(mensagemErroHttp(e));
        } finally {
            setSalvando(false);
        }
    };

    const mudarStatus = async (status: string) => {
        if (!editando) return;
        setStatusando(status);
        setFormErro('');
        try {
            const atualizado = await agendamentoService.alterarStatus(editando.id, status);
            setEditando(atualizado);
            await carregar();
        } catch (e) {
            setFormErro(mensagemErroHttp(e));
        } finally {
            setStatusando('');
        }
    };

    const partes = partesDia(cursor);
    const tituloPeriodo = visao === 'semana' ? formatarFaixaSemana(inicioDaSemana(cursor)) : partes.data;
    const encerrado = editando ? statusTerminal(editando.status) : false;
    const podeSalvar = Boolean(payload()) && !encerrado;
    const servicosDoForm = form.servicoIds.map((id) => {
        const cat = opcoes.servicos.find((s) => s.id === id);
        const snap = editando?.servicos.find((s) => s.id === id);
        return {
            id,
            nome: cat?.nome ?? snap?.nome ?? `Serviço #${id}`,
            duracaoMinutos: cat?.duracaoMinutos ?? snap?.duracaoMinutos ?? 0,
            preco: cat?.preco ?? snap?.preco ?? 0,
        };
    });
    const duracaoTotal = servicosDoForm.reduce((acc, s) => acc + s.duracaoMinutos, 0);
    const precoTotal = servicosDoForm.reduce((acc, s) => acc + s.preco, 0);
    const horariosAtivos = itens.filter((a) => ocupaHorario(a.status)).length;
    const ocupacao = useMemo(() => {
        const dias = visao === 'semana' ? diasSemana : [cursor];
        let cap = 0;
        for (const p of profissionaisVisiveis) {
            for (const d of dias) {
                const iv = intervaloNoDia(p.disponibilidades, d);
                if (iv) cap += iv.fim - iv.inicio;
            }
        }
        const usado = itens
            .filter((a) => ocupaHorario(a.status))
            .reduce((acc, a) => acc + Math.max(0, (new Date(a.fim).getTime() - new Date(a.inicio).getTime()) / 60000), 0);
        if (cap <= 0) return 0;
        return Math.min(100, Math.round((usado / cap) * 100));
    }, [visao, diasSemana, cursor, profissionaisVisiveis, itens]);

    return (
        <PageLayout
            titulo="Agenda"
            subtitulo="Horários e atendimentos"
            acoes={
                <Button size="sm" onClick={() => abrirNovo()}>
                    Novo horário
                </Button>
            }
        >
            <PageCard padded={false} className="lyra-card-quiet">
                <div className="flex min-h-0 flex-1 flex-col">
                    <div
                        className="shrink-0 border-b px-5 py-4 md:px-6"
                        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
                    >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        aria-label="Anterior"
                                        onClick={() => setCursor((c) => adicionarDias(c, visao === 'semana' ? -7 : -1))}
                                    >
                                        <Seta dir="esq" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setCursor(cloneDia(new Date()))}>
                                        Hoje
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        aria-label="Próximo"
                                        onClick={() => setCursor((c) => adicionarDias(c, visao === 'semana' ? 7 : 1))}
                                    >
                                        <Seta dir="dir" />
                                    </Button>
                                </div>
                                <div className="min-w-0">
                                    {visao === 'dia' ? (
                                        <>
                                            <p
                                                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                                                style={{ color: 'var(--copper)' }}
                                            >
                                                {partes.semana}
                                            </p>
                                            <h2 className="truncate font-display text-xl font-semibold tracking-tight md:text-2xl">
                                                {tituloPeriodo}
                                            </h2>
                                        </>
                                    ) : (
                                        <>
                                            <p
                                                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                                                style={{ color: 'var(--copper)' }}
                                            >
                                                Semana
                                            </p>
                                            <h2 className="truncate font-display text-xl font-semibold tracking-tight md:text-2xl">
                                                {tituloPeriodo}
                                            </h2>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-end gap-3">
                                <div
                                    className="flex rounded-lyra border p-0.5"
                                    style={{ borderColor: 'var(--line)', background: 'var(--panel2)' }}
                                >
                                    <Button
                                        size="sm"
                                        variant={visao === 'dia' ? 'primary' : 'ghost'}
                                        onClick={() => setVisao('dia')}
                                    >
                                        Dia
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={visao === 'semana' ? 'primary' : 'ghost'}
                                        onClick={() => setVisao('semana')}
                                    >
                                        Semana
                                    </Button>
                                </div>
                                <div className="flex w-full gap-2 sm:w-auto sm:min-w-[22rem]">
                                    <CampoSelect label="Profissional" value={filtroProf} onChange={setFiltroProf}>
                                        <option value="">Todas as cadeiras</option>
                                        {opcoes.profissionais.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.nome}
                                            </option>
                                        ))}
                                    </CampoSelect>
                                    <CampoSelect label="Status" value={filtroStatus} onChange={setFiltroStatus}>
                                        <option value="">Todos</option>
                                        {STATUS_AGENDA.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </CampoSelect>
                                </div>
                            </div>
                        </div>
                        {!carregando && opcoes.profissionais.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                <ResumoChip
                                    rotulo="Horários"
                                    valor={String(horariosAtivos)}
                                    detalhe={visao === 'dia' ? 'neste dia' : 'nesta semana'}
                                />
                                <ResumoChip rotulo="Ocupação" valor={`${ocupacao}%`} detalhe="das cadeiras visíveis" />
                                <ResumoChip
                                    rotulo="Equipe"
                                    valor={String(profissionaisVisiveis.length)}
                                    detalhe={profissionaisVisiveis.length === 1 ? 'profissional' : 'profissionais'}
                                />
                            </div>
                        )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto px-5 py-4 md:px-6">
                        {erroLista && (
                            <div className="mb-4">
                                <Alert titulo={tituloDeMensagem(erroLista)}>{erroLista}</Alert>
                            </div>
                        )}

                        {carregando && (
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Montando a grade⬦
                            </p>
                        )}

                        {!carregando && opcoes.profissionais.length === 0 && (
                            <div
                                className="flex flex-col items-center justify-center rounded-lyra border px-6 py-16 text-center"
                                style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                            >
                                <p
                                    className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                                    style={{ color: 'var(--copper)' }}
                                >
                                    Equipe
                                </p>
                                <p className="mt-2 font-display text-xl font-semibold">Nenhuma cadeira na agenda</p>
                                <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                    Cadastre profissionais com expediente para ver a grade do dia.
                                </p>
                                {authService.hasModulo(MODULO_PROFISSIONAIS) && (
                                    <Link to="/profissionais" className="mt-5">
                                        <Button size="sm">Cadastrar equipe</Button>
                                    </Link>
                                )}
                            </div>
                        )}

                        {!carregando && opcoes.profissionais.length > 0 && visao === 'dia' && (
                            <GradeDia
                                dia={cursor}
                                profissionais={profissionaisVisiveis}
                                agendamentos={itens}
                                onSlot={(profissionalId, inicio) => abrirNovo({ profissionalId, inicio })}
                                onAbrir={abrirDetalhe}
                            />
                        )}

                        {!carregando && opcoes.profissionais.length > 0 && visao === 'semana' && (
                            <GradeSemana
                                dias={diasSemana}
                                profissionais={profissionaisVisiveis}
                                agendamentos={itens}
                                onSlot={(profissionalId, inicio) => abrirNovo({ profissionalId, inicio })}
                                onAbrir={abrirDetalhe}
                            />
                        )}
                    </div>
                </div>
            </PageCard>

            <Modal
                aberto={formAberto}
                titulo={editando ? editando.clienteNome : 'Novo horário'}
                eyebrow={editando ? 'Agendamento' : 'Agenda'}
                subtitulo={
                    editando
                        ? `${formatarHora(editando.inicio)} � ${formatarHora(editando.fim)} · ${editando.profissionalNome}`
                        : 'Cliente, serviços e profissional. Vários serviços no mesmo horário; a duração é a soma.'
                }
                onClose={fecharForm}
                largura="36rem"
                rodape={
                    <>
                        <Button variant="ghost" onClick={fecharForm} disabled={salvando || Boolean(statusando)}>
                            Fechar
                        </Button>
                        {!encerrado && (
                            <Button onClick={() => void salvar()} disabled={salvando || !podeSalvar}>
                                {salvando ? 'Salvando⬦' : 'Salvar'}
                            </Button>
                        )}
                    </>
                }
            >
                {editando && (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <Badge variant={varianteStatus(editando.status)}>{labelStatus(editando.status)}</Badge>
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {rotuloServicos(editando)} · {brl.format(editando.preco)}
                        </span>
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    <CampoSelect
                        label="Cliente"
                        required
                        value={form.clienteId}
                        onChange={(clienteId) => preencherForm({ clienteId })}
                    >
                        <option value="">Selecione</option>
                        {clientes.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.nome}
                            </option>
                        ))}
                    </CampoSelect>
                    <CampoSelect
                        label="Profissional"
                        required
                        value={form.profissionalId}
                        onChange={(profissionalId) => preencherForm({ profissionalId })}
                    >
                        <option value="">Selecione</option>
                        {opcoes.profissionais.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.nome}
                            </option>
                        ))}
                    </CampoSelect>
                    <Input
                        label="Início"
                        type="datetime-local"
                        required
                        step={1800}
                        value={form.inicio}
                        onChange={(e) => preencherForm({ inicio: e.target.value })}
                        helperText={
                            duracaoTotal > 0 ? `Duração total: ${formatarDuracaoMinutos(duracaoTotal)}` : undefined
                        }
                    />
                </div>

                <div className="mt-4">
                    <p className="mb-1.5 text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        Serviços
                        <span style={{ color: 'var(--destructive)' }}> *</span>
                    </p>
                    <div className="flex flex-col gap-2">
                        {servicosDoForm.map((s, i) => (
                            <div
                                key={`${s.id}-${i}`}
                                className="flex items-center gap-3 rounded-lyra border px-3 py-2"
                                style={{
                                    borderColor: 'var(--line)',
                                    background: 'var(--panel)',
                                    borderLeft: '3px solid var(--copper)',
                                }}
                            >
                                <span
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold"
                                    style={{
                                        background: 'color-mix(in oklab, var(--copper) 16%, transparent)',
                                        color: 'var(--copper)',
                                    }}
                                >
                                    {i + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                        {s.nome}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                        {formatarDuracaoMinutos(s.duracaoMinutos)} · {brl.format(s.preco)}
                                    </p>
                                </div>
                                {!encerrado && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            preencherForm({
                                                servicoIds: form.servicoIds.filter((_, idx) => idx !== i),
                                            })
                                        }
                                    >
                                        Remover
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                    {!encerrado && (
                        <div className="mt-2">
                            <select
                                className="lyra-input"
                                style={{ marginTop: 0 }}
                                value={adicionarServicoId}
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    setAdicionarServicoId('');
                                    if (!id) return;
                                    preencherForm({ servicoIds: [...form.servicoIds, id] });
                                }}
                            >
                                <option value="">Adicionar serviço⬦</option>
                                {opcoes.servicos.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.nome} · {formatarDuracaoMinutos(s.duracaoMinutos)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {servicosDoForm.length > 0 && (
                        <div
                            className="mt-3 flex items-center justify-between rounded-lyra px-3 py-2"
                            style={{
                                background: 'color-mix(in oklab, var(--copper) 12%, var(--panel))',
                            }}
                        >
                            <p className="text-xs font-medium" style={{ color: 'var(--ink)' }}>
                                {servicosDoForm.length} serviço{servicosDoForm.length === 1 ? '' : 's'} em sequência
                            </p>
                            <p className="text-xs font-semibold" style={{ color: 'var(--copper)' }}>
                                {formatarDuracaoMinutos(duracaoTotal)} · {brl.format(precoTotal)}
                            </p>
                        </div>
                    )}
                </div>

                {clientes.length === 0 && (
                    <p className="mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Nenhum cliente ativo.{' '}
                        {authService.hasModulo(MODULO_CLIENTES) ? (
                            <Link to="/clientes" className="font-semibold" style={{ color: 'var(--copper)' }}>
                                Cadastre uma ficha
                            </Link>
                        ) : (
                            'Peça para o admin cadastrar o cliente.'
                        )}
                    </p>
                )}
                {opcoes.servicos.length === 0 && (
                    <p className="mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Nenhum serviço ativo.{' '}
                        {authService.hasModulo(MODULO_SERVICOS) ? (
                            <Link to="/servicos" className="font-semibold" style={{ color: 'var(--copper)' }}>
                                Cadastre o catálogo
                            </Link>
                        ) : (
                            'Peça para o admin cadastrar os serviços.'
                        )}
                    </p>
                )}

                <div className="mt-4">
                    <Textarea
                        label="Observações"
                        placeholder="Recado interno, preferência⬦"
                        value={form.observacoes}
                        onChange={(e) => preencherForm({ observacoes: e.target.value })}
                    />
                </div>

                {editando && (
                    <div className="mt-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {formatarTelefoneExibicao(editando.clienteTelefone)}
                    </div>
                )}

                {editando && transicoesDe(editando.status).length > 0 && (
                    <div className="mt-5">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--copper)' }}>
                            Status
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {transicoesDe(editando.status).map((t) => (
                                <Button
                                    key={t.id}
                                    size="sm"
                                    variant={t.perigo ? 'danger' : 'secondary'}
                                    disabled={Boolean(statusando) || salvando}
                                    onClick={() => void mudarStatus(t.id)}
                                >
                                    {statusando === t.id ? 'Atualizando⬦' : t.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {encerrado && (
                    <p className="mt-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Agendamento encerrado. Não é possível alterar horário nem status.
                    </p>
                )}

                {formErro && (
                    <div className="mt-3">
                        <Alert titulo={tituloDeMensagem(formErro)}>{formErro}</Alert>
                    </div>
                )}
            </Modal>
        </PageLayout>
    );
}

function Seta({ dir }: { dir: 'esq' | 'dir' }) {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
                d={dir === 'esq' ? 'M9 3L5 7l4 4' : 'M5 3l4 4-4 4'}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ResumoChip({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
    return (
        <div
            className="rounded-lyra border px-3 py-2"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
        >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--faint)' }}>
                {rotulo}
            </p>
            <p className="font-display text-lg font-semibold leading-tight">{valor}</p>
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                {detalhe}
            </p>
        </div>
    );
}
