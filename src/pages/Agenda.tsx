import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';
import GradeDia from '@/components/agenda/GradeDia';
import GradeSemana from '@/components/agenda/GradeSemana';
import BloqueioModal from '@/components/agenda/BloqueioModal';
import CampoCliente from '@/components/agenda/CampoCliente';
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
    fusoDiferenteDoNavegador,
    inicioDaSemana,
    labelStatus,
    minutosNoDia,
    ocupaHorario,
    paraDatetimeLocal,
    parseIsoData,
    partesDia,
    statusTerminal,
    transicoesDe,
    varianteStatus,
} from '@/lib/agenda';
import { formatarTelefoneExibicao } from '@/lib/telefone';
import { MODULO_CLIENTES, MODULO_PROFISSIONAIS, MODULO_SERVICOS } from '@/constants/moduleCodes';
import {
    agendamentoService,
    atendeServicos,
    type Agendamento,
    type HorarioLivre,
    type OpcoesAgenda,
    type SalvarAgendamento,
    rotuloServicos,
} from '@/services/agendamento.service';
import { bloqueioService, type Bloqueio } from '@/services/bloqueio.service';
import { useTermos } from '@/contexts/TermosContext';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS_REMARCAVEIS = ['agendado', 'confirmado', 'no_show', 'cancelado'];
const formatarDiaHora = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

type Visao = 'dia' | 'semana';

type FormAgenda = {
    clienteId: string;
    clienteNome: string;
    servicoIds: number[];
    profissionalId: string;
    inicio: string;
    observacoes: string;
};

const formVazio: FormAgenda = {
    clienteId: '',
    clienteNome: '',
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
    const termos = useTermos();
    const [searchParams, setSearchParams] = useSearchParams();
    const queryConsumida = useRef(false);
    const [visao, setVisao] = useState<Visao>(() =>
        searchParams.get('visao') === 'semana' ? 'semana' : 'dia'
    );
    const [cursor, setCursor] = useState(() => parseIsoData(searchParams.get('data')) ?? cloneDia(new Date()));
    const [filtroProf, setFiltroProf] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');
    const [opcoes, setOpcoes] = useState<OpcoesAgenda>({ profissionais: [], servicos: [], fusoHorario: '' });
    const [livres, setLivres] = useState<HorarioLivre[] | null>(null);
    const [carregandoLivres, setCarregandoLivres] = useState(false);
    const [semClientes, setSemClientes] = useState(false);
    const [itens, setItens] = useState<Agendamento[]>([]);
    const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
    const [bloqueioAberto, setBloqueioAberto] = useState(false);
    const [bloqueioSelecionado, setBloqueioSelecionado] = useState<Bloqueio | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erroLista, setErroLista] = useState('');
    const [formAberto, setFormAberto] = useState(false);
    const [editando, setEditando] = useState<Agendamento | null>(null);
    /** Agendamento de origem enquanto o formulário marca o novo horário. */
    const [remarcando, setRemarcando] = useState<Agendamento | null>(null);
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
            const [ops, lista, blq] = await Promise.all([
                agendamentoService.opcoes(),
                agendamentoService.listar({
                    de: periodo.de.toISOString(),
                    ate: periodo.ate.toISOString(),
                    profissionalId: filtroProf ? Number(filtroProf) : undefined,
                    status: filtroStatus || undefined,
                }),
                bloqueioService
                    .listar({
                        de: periodo.de.toISOString(),
                        ate: periodo.ate.toISOString(),
                        profissionalId: filtroProf ? Number(filtroProf) : undefined,
                    })
                    .catch(() => [] as Bloqueio[]),
            ]);
            setOpcoes(ops);
            setItens(lista.items);
            setBloqueios(blq);
        } catch (e) {
            setErroLista(mensagemErroHttp(e));
            setItens([]);
            setBloqueios([]);
        } finally {
            setCarregando(false);
        }
    }, [periodo.de, periodo.ate, filtroProf, filtroStatus]);

    useEffect(() => {
        void carregar();
    }, [carregar]);

    const diaDoForm = form.inicio.slice(0, 10);
    const servicoIdsChave = form.servicoIds.join(',');
    const encerradoForm = editando ? statusTerminal(editando.status) : false;
    const ignorarNosLivres =
        editando?.id ?? (remarcando && !statusTerminal(remarcando.status) ? remarcando.id : undefined);
    useEffect(() => {
        const profissionalId = Number(form.profissionalId);
        if (!formAberto || encerradoForm || !profissionalId || !servicoIdsChave || !/^\d{4}-\d{2}-\d{2}$/.test(diaDoForm)) {
            setLivres(null);
            return;
        }
        let cancelado = false;
        setCarregandoLivres(true);
        agendamentoService
            .horariosLivres({
                data: diaDoForm,
                servicoIds: servicoIdsChave.split(',').map(Number),
                profissionalId,
                ignorarAgendamentoId: ignorarNosLivres,
            })
            .then((r) => {
                if (!cancelado) setLivres(r.profissionais.find((p) => p.profissionalId === profissionalId)?.horarios ?? []);
            })
            .catch(() => {
                if (!cancelado) setLivres(null);
            })
            .finally(() => {
                if (!cancelado) setCarregandoLivres(false);
            });
        return () => {
            cancelado = true;
        };
    }, [formAberto, encerradoForm, form.profissionalId, servicoIdsChave, diaDoForm, ignorarNosLivres]);

    useEffect(() => {
        if (!formAberto || editando || remarcando) return;
        let cancelado = false;
        agendamentoService
            .buscarClientes('', 1)
            .then((r) => {
                if (!cancelado) setSemClientes(r.total === 0);
            })
            .catch(() => {
                if (!cancelado) setSemClientes(false);
            });
        return () => {
            cancelado = true;
        };
    }, [formAberto, editando, remarcando]);

    const fecharForm = () => {
        if (salvando || statusando) return;
        setFormAberto(false);
        setEditando(null);
        setRemarcando(null);
    };

    const iniciarRemarcacao = () => {
        if (!editando) return;
        setRemarcando(editando);
        setEditando(null);
        setFormErro('');
    };

    const preencherForm = (patch: Partial<FormAgenda>) => {
        setForm((f) => ({ ...f, ...patch }));
    };

    const abrirNovo = (seed?: { profissionalId?: number; inicio?: Date }) => {
        const servico =
            (seed?.profissionalId && opcoes.servicos.find((s) => atendeServicos([s], seed.profissionalId!))) ||
            opcoes.servicos[0];
        const servId = servico?.id;
        const profId =
            seed?.profissionalId ??
            opcoes.profissionais.find((p) => !servico || atendeServicos([servico], p.id))?.id;
        const inicio = seed?.inicio ?? dataComMinutos(cloneDia(cursor), 9 * 60);
        setEditando(null);
        setRemarcando(null);
        setAdicionarServicoId('');
        setForm({
            ...formVazio,
            servicoIds: servId ? [servId] : [],
            profissionalId: profId ? String(profId) : '',
            inicio: paraDatetimeLocal(inicio),
        });
        setFormErro('');
        setFormAberto(true);
    };

    const abrirBloqueio = (b: Bloqueio) => {
        setBloqueioSelecionado(b);
        setBloqueioAberto(true);
    };

    const abrirDetalhe = (a: Agendamento) => {
        setEditando(a);
        setRemarcando(null);
        setAdicionarServicoId('');
        setForm({
            clienteId: String(a.clienteId),
            clienteNome: a.clienteNome,
            servicoIds: a.servicos?.length ? a.servicos.map((s) => s.id) : [],
            profissionalId: String(a.profissionalId),
            inicio: paraDatetimeLocal(new Date(a.inicio)),
            observacoes: a.observacoes ?? '',
        });
        setFormErro('');
        setFormAberto(true);
    };

    useEffect(() => {
        if (carregando || queryConsumida.current) return;
        const novo = searchParams.get('novo') === '1';
        const idRaw = searchParams.get('id');
        const profParam = searchParams.get('profissionalId');
        const inicioParam = searchParams.get('inicio');
        const visaoParam = searchParams.get('visao');
        const dataParam = parseIsoData(searchParams.get('data'));
        if (
            !novo &&
            !idRaw &&
            !profParam &&
            !inicioParam &&
            visaoParam !== 'dia' &&
            visaoParam !== 'semana' &&
            !dataParam
        ) {
            return;
        }

        queryConsumida.current = true;
        if (visaoParam === 'dia' || visaoParam === 'semana') setVisao(visaoParam);
        if (dataParam) setCursor(dataParam);
        else if (inicioParam) {
            const inicio = new Date(inicioParam);
            if (!Number.isNaN(inicio.getTime())) setCursor(cloneDia(inicio));
        }
        if (profParam && opcoes.profissionais.some((p) => String(p.id) === profParam)) {
            setFiltroProf(profParam);
        }
        if (idRaw) {
            const item = itens.find((a) => a.id === Number(idRaw));
            if (item) abrirDetalhe(item);
        } else if (novo) {
            const inicio = inicioParam ? new Date(inicioParam) : undefined;
            abrirNovo({
                profissionalId: profParam ? Number(profParam) : undefined,
                inicio: inicio && !Number.isNaN(inicio.getTime()) ? inicio : undefined,
            });
        }
        setSearchParams({}, { replace: true });
        // Query do início é consumida uma vez; abrirNovo/abrirDetalhe leem o estado atual.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [carregando, itens, opcoes.profissionais, searchParams, setSearchParams]);

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
            setFormErro(
                `Preencha ${termos.um('cliente')}, ao menos ${termos.servico.genero === 'f' ? 'uma' : 'um'} ${termos.um('servico')}, ${termos.um('recurso')} e início.`
            );
            return;
        }
        setSalvando(true);
        setFormErro('');
        try {
            if (editando) {
                await agendamentoService.atualizar(editando.id, body);
            } else if (remarcando) {
                await agendamentoService.remarcar(remarcando.id, body);
            } else {
                await agendamentoService.criar(body);
            }
            setFormAberto(false);
            setEditando(null);
            setRemarcando(null);
            await carregar();
        } catch (e) {
            setFormErro(mensagemErroHttp(e));
        } finally {
            setSalvando(false);
        }
    };

    const mudarStatus = async (status: string) => {
        if (!editando) return;
        const esteAgendamento = `${termos.agendamento.genero === 'f' ? 'esta' : 'este'} ${termos.um('agendamento')}`;
        let motivo: string | null = null;
        if (status === 'cancelado') {
            const resposta = window.prompt(`Cancelar ${esteAgendamento}? Se quiser, escreva o motivo (opcional).`, '');
            if (resposta === null) return;
            motivo = resposta.trim().slice(0, 200) || null;
        } else if (statusTerminal(status)) {
            const ok = window.confirm(
                `Marcar como "${labelStatus(status)}"? Depois disso não dá para alterar ${esteAgendamento}.`
            );
            if (!ok) return;
        }
        setStatusando(status);
        setFormErro('');
        try {
            const atualizado = await agendamentoService.alterarStatus(editando.id, status, motivo);
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
    const podeRemarcar = Boolean(editando && STATUS_REMARCAVEIS.includes(editando.status));
    const podeSalvar = Boolean(payload()) && !encerrado;
    const servicosDoForm = form.servicoIds.map((id) => {
        const cat = opcoes.servicos.find((s) => s.id === id);
        const snap = editando?.servicos.find((s) => s.id === id);
        return {
            id,
            nome: cat?.nome ?? snap?.nome ?? `${termos.servico.singular} #${id}`,
            duracaoMinutos: cat?.duracaoMinutos ?? snap?.duracaoMinutos ?? 0,
            preco: cat?.preco ?? snap?.preco ?? 0,
        };
    });
    const servicosAgendaDoForm = opcoes.servicos.filter((s) => form.servicoIds.includes(s.id));
    const profissionaisDoForm = opcoes.profissionais.filter(
        (p) => atendeServicos(servicosAgendaDoForm, p.id) || String(p.id) === form.profissionalId
    );
    const profissionalNaoAtende =
        Boolean(form.profissionalId) && !atendeServicos(servicosAgendaDoForm, Number(form.profissionalId));
    const duracaoTotal = servicosDoForm.reduce((acc, s) => acc + s.duracaoMinutos, 0);
    const precoTotal = servicosDoForm.reduce((acc, s) => acc + s.preco, 0);
    const horariosAtivos = itens.filter((a) => ocupaHorario(a.status)).length;
    const ocupacao = useMemo(() => {
        const dias = visao === 'semana' ? diasSemana : [cursor];
        let cap = 0;
        for (const p of profissionaisVisiveis) {
            for (const d of dias) {
                cap += minutosNoDia(p.disponibilidades, d);
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
            subtitulo={termos.agendamento.plural}
            acoes={
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                            setBloqueioSelecionado(null);
                            setBloqueioAberto(true);
                        }}
                    >
                        Bloquear horário
                    </Button>
                    <Button size="sm" onClick={() => abrirNovo()}>
                        {termos.novo('agendamento')}
                    </Button>
                </div>
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
                                    <CampoSelect label={termos.recurso.singular} value={filtroProf} onChange={setFiltroProf}>
                                        <option value="">{`${termos.adj('recurso', 'Todos')} ${termos.adj('recurso', 'os')} ${termos.varios('recurso')}`}</option>
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
                                    rotulo={termos.agendamento.plural}
                                    valor={String(horariosAtivos)}
                                    detalhe={visao === 'dia' ? 'neste dia' : 'nesta semana'}
                                />
                                <ResumoChip
                                    rotulo="Ocupação"
                                    valor={`${ocupacao}%`}
                                    detalhe={`${termos.adj('recurso', 'dos')} ${termos.varios('recurso')} ${termos.adj('recurso', 'visíveis')}`}
                                />
                                <ResumoChip
                                    rotulo="Equipe"
                                    valor={String(profissionaisVisiveis.length)}
                                    detalhe={termos.contagem('recurso', profissionaisVisiveis.length)}
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

                        {fusoDiferenteDoNavegador(opcoes.fusoHorario) && (
                            <div className="mb-4">
                                <Alert titulo="Fuso horário diferente" variant="warn">
                                    {`Este computador está num fuso diferente do da empresa (${opcoes.fusoHorario}). A grade mostra o horário deste computador; o expediente e os horários livres seguem o fuso da empresa.`}
                                </Alert>
                            </div>
                        )}

                        {carregando && (
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Montando a grade…
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
                                <p className="mt-2 font-display text-xl font-semibold">{`${termos.nenhum('recurso')} na agenda`}</p>
                                <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                    {`Cadastre ${termos.varios('recurso')} com expediente para ver a grade do dia.`}
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
                                bloqueios={bloqueios}
                                onSlot={(profissionalId, inicio) => abrirNovo({ profissionalId, inicio })}
                                onAbrir={abrirDetalhe}
                                onBloqueio={abrirBloqueio}
                            />
                        )}

                        {!carregando && opcoes.profissionais.length > 0 && visao === 'semana' && (
                            <GradeSemana
                                dias={diasSemana}
                                profissionais={profissionaisVisiveis}
                                agendamentos={itens}
                                bloqueios={bloqueios}
                                onSlot={(profissionalId, inicio) => abrirNovo({ profissionalId, inicio })}
                                onAbrir={abrirDetalhe}
                                onBloqueio={abrirBloqueio}
                                onDia={(dia) => {
                                    setCursor(dia);
                                    setVisao('dia');
                                }}
                            />
                        )}
                    </div>
                </div>
            </PageCard>

            <Modal
                aberto={formAberto}
                titulo={
                    editando ? editando.clienteNome : remarcando ? `Remarcar ${remarcando.clienteNome}` : termos.novo('agendamento')
                }
                eyebrow={editando ? termos.agendamento.singular : remarcando ? 'Remarcação' : 'Agenda'}
                subtitulo={
                    editando
                        ? `${formatarHora(editando.inicio)} – ${formatarHora(editando.fim)} · ${editando.profissionalNome}`
                        : remarcando
                          ? `Era ${formatarDiaHora(remarcando.inicio)} com ${remarcando.profissionalNome}. Escolha o novo horário.`
                          : `${termos.cliente.singular}, ${termos.varios('servico')} e ${termos.um('recurso')}. ${termos.adj('servico', 'Vários')} ${termos.varios('servico')} em sequência; a duração é a soma.`
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
                                {salvando ? 'Salvando…' : remarcando ? 'Confirmar remarcação' : 'Salvar'}
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
                        {editando.remarcadoDeId && (
                            <Badge variant="faint" size="sm">
                                Remarcado
                            </Badge>
                        )}
                        {editando.status === 'cancelado' && editando.motivoCancelamento && (
                            <span className="w-full text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                Motivo: {editando.motivoCancelamento}
                            </span>
                        )}
                    </div>
                )}

                {remarcando && (
                    <div className="mb-4">
                        <Alert variant="warn" titulo="Como funciona">
                            {statusTerminal(remarcando.status)
                                ? `O registro anterior (${labelStatus(remarcando.status).toLowerCase()}) fica como está, e um novo horário é criado.`
                                : 'Ao confirmar, o horário anterior é cancelado e o novo é criado.'}
                        </Alert>
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    <CampoCliente
                        label={termos.cliente.singular}
                        disabled={encerrado || Boolean(remarcando)}
                        valor={form.clienteId ? { id: Number(form.clienteId), nome: form.clienteNome } : null}
                        onChange={(c) =>
                            preencherForm({ clienteId: c ? String(c.id) : '', clienteNome: c?.nome ?? '' })
                        }
                    />
                    <CampoSelect
                        label={termos.recurso.singular}
                        required
                        value={form.profissionalId}
                        onChange={(profissionalId) => preencherForm({ profissionalId })}
                    >
                        <option value="">Selecione</option>
                        {profissionaisDoForm.map((p) => (
                            <option key={p.id} value={p.id}>
                                {atendeServicos(servicosAgendaDoForm, p.id) ? p.nome : `${p.nome} (não atende)`}
                            </option>
                        ))}
                    </CampoSelect>
                    <Input
                        label="Início"
                        type="datetime-local"
                        required
                        step={300}
                        value={form.inicio}
                        onChange={(e) => preencherForm({ inicio: e.target.value })}
                        helperText={
                            duracaoTotal > 0 ? `Duração total: ${formatarDuracaoMinutos(duracaoTotal)}` : undefined
                        }
                    />
                </div>

                {profissionalNaoAtende && !encerrado && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--destructive)' }}>
                        {`Est${termos.recurso.genero === 'f' ? 'a' : 'e'} ${termos.recurso.singular.toLowerCase()} não atende ${termos.adj('servico', 'todos')} ${termos.adj('servico', 'os')} ${termos.varios('servico')} escolhidos.`}
                    </p>
                )}

                {!encerrado && livres !== null && (
                    <div className="mt-3">
                        <p className="mb-1.5 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                            {carregandoLivres
                                ? 'Buscando horários livres…'
                                : livres.length
                                  ? 'Horários livres neste dia'
                                  : 'Nenhum horário livre neste dia para essa combinação.'}
                        </p>
                        {livres.length > 0 && (
                            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                                {livres.map((h) => {
                                    const valor = paraDatetimeLocal(new Date(h.inicio));
                                    const ativo = valor === form.inicio;
                                    return (
                                        <button
                                            key={h.inicio}
                                            type="button"
                                            onClick={() => preencherForm({ inicio: valor })}
                                            className="rounded-full px-2.5 py-1 font-mono text-[11px] tabular-nums"
                                            style={{
                                                border: `1px solid ${ativo ? 'var(--copper)' : 'var(--line)'}`,
                                                background: ativo
                                                    ? 'color-mix(in oklab, var(--copper) 16%, var(--panel))'
                                                    : 'var(--panel)',
                                                color: ativo ? 'var(--copper)' : 'var(--ink)',
                                            }}
                                        >
                                            {formatarHora(h.inicio)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-4">
                    <p className="mb-1.5 text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        {termos.servico.plural}
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
                                <option value="">{`Adicionar ${termos.um('servico')}…`}</option>
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
                                {servicosDoForm.length} {termos.contagem('servico', servicosDoForm.length)} em sequência
                            </p>
                            <p className="text-xs font-semibold" style={{ color: 'var(--copper)' }}>
                                {formatarDuracaoMinutos(duracaoTotal)} · {brl.format(precoTotal)}
                            </p>
                        </div>
                    )}
                </div>

                {semClientes && (
                    <p className="mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {`${termos.nenhum('cliente')} ${termos.adj('cliente', 'ativo')}.`}{' '}
                        {authService.hasModulo(MODULO_CLIENTES) ? (
                            <Link to="/clientes" className="font-semibold" style={{ color: 'var(--copper)' }}>
                                Cadastre uma ficha
                            </Link>
                        ) : (
                            `Peça para o admin fazer o cadastro.`
                        )}
                    </p>
                )}
                {opcoes.servicos.length === 0 && (
                    <p className="mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {`${termos.nenhum('servico')} ${termos.adj('servico', 'ativo')}.`}{' '}
                        {authService.hasModulo(MODULO_SERVICOS) ? (
                            <Link to="/servicos" className="font-semibold" style={{ color: 'var(--copper)' }}>
                                Cadastre o catálogo
                            </Link>
                        ) : (
                            `Peça para o admin cadastrar ${termos.adj('servico', 'os')} ${termos.varios('servico')}.`
                        )}
                    </p>
                )}

                <div className="mt-4">
                    <Textarea
                        label="Observações"
                        placeholder="Recado interno, preferência…"
                        value={form.observacoes}
                        onChange={(e) => preencherForm({ observacoes: e.target.value })}
                    />
                </div>

                {editando && (
                    <div className="mt-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {formatarTelefoneExibicao(editando.clienteTelefone)}
                    </div>
                )}

                {editando && (transicoesDe(editando.status, editando.inicio).length > 0 || podeRemarcar) && (
                    <div className="mt-5">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--copper)' }}>
                            Status
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {podeRemarcar && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={Boolean(statusando) || salvando}
                                    onClick={iniciarRemarcacao}
                                >
                                    Remarcar
                                </Button>
                            )}
                            {transicoesDe(editando.status, editando.inicio).map((t) => (
                                <Button
                                    key={t.id}
                                    size="sm"
                                    variant={t.perigo ? 'danger' : 'secondary'}
                                    disabled={Boolean(statusando) || salvando}
                                    onClick={() => void mudarStatus(t.id)}
                                >
                                    {statusando === t.id ? 'Atualizando…' : t.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {encerrado && (
                    <p className="mt-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {`${termos.agendamento.singular} ${termos.adj('agendamento', 'encerrado')}. `}
                        {podeRemarcar
                            ? 'Para atender em outro horário, use Remarcar.'
                            : 'Não é possível alterar horário nem status.'}
                    </p>
                )}

                {formErro && (
                    <div className="mt-3">
                        <Alert titulo={tituloDeMensagem(formErro)}>{formErro}</Alert>
                    </div>
                )}
            </Modal>

            <BloqueioModal
                aberto={bloqueioAberto}
                onClose={() => {
                    setBloqueioAberto(false);
                    setBloqueioSelecionado(null);
                }}
                onAlterado={() => void carregar()}
                profissionais={opcoes.profissionais}
                dia={cursor}
                profissionalId={filtroProf ? Number(filtroProf) : undefined}
                selecionado={bloqueioSelecionado}
            />
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
