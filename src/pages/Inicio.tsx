import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import GradeDia from '@/components/agenda/GradeDia';
import GradeMes from '@/components/agenda/GradeMes';
import GradeSemana from '@/components/agenda/GradeSemana';
import { Alert, Badge, Button, Modal } from '@/components/ui';
import { authService } from '@core/services';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import {
    adicionarDias,
    adicionarMeses,
    celulasDoMes,
    cloneDia,
    formatarDiaLongo,
    formatarFaixaSemana,
    formatarHora,
    formatarMesAno,
    inicioDaSemana,
    intervaloNoDia,
    isoData,
    labelStatus,
    mesmoDia,
    ocupaHorario,
    partesDia,
    varianteStatus,
} from '@/lib/agenda';
import {
    MODULO_AGENDA,
    MODULO_CLIENTES,
    MODULO_PROFISSIONAIS,
    MODULO_SERVICOS,
} from '@/constants/moduleCodes';
import {
    agendamentoService,
    rotuloServicos,
    type Agendamento,
    type OpcoesAgenda,
} from '@/services/agendamento.service';

function saudacaoNome(): string {
    const user = authService.getStoredUserInfo();
    const raw = (user?.username || user?.email || '').split('@')[0];
    const parte = raw.split(/[._\s-]/).find((p) => p.length > 1) || raw;
    if (!parte) return '';
    return parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase();
}

export default function InicioPage() {
    const navigate = useNavigate();
    const temAgenda = authService.hasModulo(MODULO_AGENDA);
    const nome = saudacaoNome();
    const hoje = useMemo(() => cloneDia(new Date()), []);
    const partes = partesDia(hoje);
    const [visaoCal, setVisaoCal] = useState<'semana' | 'mes'>('mes');
    const [cursor, setCursor] = useState(() => cloneDia(new Date()));
    const [diaAberto, setDiaAberto] = useState<Date | null>(null);

    const [filtroProf, setFiltroProf] = useState('');
    const [opcoes, setOpcoes] = useState<OpcoesAgenda>({ profissionais: [], servicos: [] });
    const [itens, setItens] = useState<Agendamento[]>([]);
    const [carregando, setCarregando] = useState(temAgenda);
    const [erro, setErro] = useState('');

    const diasSemana = useMemo(() => {
        const ini = inicioDaSemana(cursor);
        return Array.from({ length: 7 }, (_, i) => adicionarDias(ini, i));
    }, [cursor]);
    const diasMes = useMemo(() => celulasDoMes(cursor), [cursor]);
    const periodo = useMemo(() => {
        let de = visaoCal === 'mes' ? diasMes[0] : diasSemana[0];
        let ate =
            visaoCal === 'mes'
                ? adicionarDias(diasMes[diasMes.length - 1], 1)
                : adicionarDias(diasSemana[0], 7);
        if (hoje < de) de = hoje;
        if (hoje >= ate) ate = adicionarDias(hoje, 1);
        if (diaAberto && diaAberto < de) de = diaAberto;
        if (diaAberto && diaAberto >= ate) ate = adicionarDias(diaAberto, 1);
        return { de, ate };
    }, [visaoCal, diasMes, diasSemana, hoje, diaAberto]);

    const carregar = useCallback(async () => {
        if (!temAgenda) {
            setCarregando(false);
            return;
        }
        setCarregando(true);
        setErro('');
        try {
            const [ops, lista] = await Promise.all([
                agendamentoService.opcoes(),
                agendamentoService.listar({
                    de: periodo.de.toISOString(),
                    ate: periodo.ate.toISOString(),
                    profissionalId: filtroProf ? Number(filtroProf) : undefined,
                }),
            ]);
            setOpcoes(ops);
            setItens(lista.items);
        } catch (e) {
            setErro(mensagemErroHttp(e, 'Não foi possível falar com a API Lyra. Suba a api.salao.'));
            setItens([]);
        } finally {
            setCarregando(false);
        }
    }, [temAgenda, periodo.de, periodo.ate, filtroProf]);

    useEffect(() => {
        void carregar();
    }, [carregar]);

    const profissionaisVisiveis = useMemo(() => {
        if (!filtroProf) return opcoes.profissionais;
        return opcoes.profissionais.filter((p) => String(p.id) === filtroProf);
    }, [opcoes.profissionais, filtroProf]);

    const deHoje = useMemo(
        () => itens.filter((a) => mesmoDia(a.inicio, hoje)),
        [itens, hoje]
    );
    const ativosHoje = deHoje.filter((a) => ocupaHorario(a.status));
    const proximos = ativosHoje
        .filter((a) => new Date(a.inicio).getTime() >= Date.now() - 5 * 60 * 1000)
        .sort((a, b) => a.inicio.localeCompare(b.inicio))
        .slice(0, 5);
    const aConfirmar = deHoje.filter((a) => a.status === 'agendado').length;
    const emAtendimento = deHoje.filter((a) => a.status === 'em_atendimento').length;
    const ocupacao = useMemo(() => {
        let cap = 0;
        for (const p of profissionaisVisiveis) {
            const iv = intervaloNoDia(p.disponibilidades, hoje);
            if (iv) cap += iv.fim - iv.inicio;
        }
        const usado = ativosHoje.reduce(
            (acc, a) => acc + Math.max(0, (new Date(a.fim).getTime() - new Date(a.inicio).getTime()) / 60000),
            0
        );
        if (cap <= 0) return 0;
        return Math.min(100, Math.round((usado / cap) * 100));
    }, [profissionaisVisiveis, hoje, ativosHoje]);

    const irAgenda = (opts?: {
        novo?: boolean;
        profissionalId?: number;
        inicio?: Date;
        id?: number;
        visao?: 'dia' | 'semana';
        data?: Date;
    }) => {
        const q = new URLSearchParams();
        if (opts?.novo) q.set('novo', '1');
        const pid = opts?.profissionalId ?? (filtroProf ? Number(filtroProf) : undefined);
        if (pid) q.set('profissionalId', String(pid));
        if (opts?.inicio) q.set('inicio', opts.inicio.toISOString());
        if (opts?.id) q.set('id', String(opts.id));
        if (opts?.visao) q.set('visao', opts.visao);
        const data = opts?.data ?? (opts?.inicio ? cloneDia(opts.inicio) : undefined);
        if (data) q.set('data', isoData(data));
        const s = q.toString();
        navigate(s ? `/agenda?${s}` : '/agenda');
    };

    const abrirDia = (dia: Date) => setDiaAberto(cloneDia(dia));
    const fecharDia = useCallback(() => setDiaAberto(null), []);

    const tituloAgenda =
        visaoCal === 'mes' ? formatarMesAno(cursor) : formatarFaixaSemana(inicioDaSemana(cursor));
    const partesDiaAberto = diaAberto ? partesDia(diaAberto) : null;
    const horariosDoDiaAberto = useMemo(() => {
        if (!diaAberto) return [];
        return itens
            .filter((a) => mesmoDia(a.inicio, diaAberto) && ocupaHorario(a.status))
            .sort((a, b) => a.inicio.localeCompare(b.inicio));
    }, [diaAberto, itens]);

    const acoes = [
        temAgenda && {
            to: filtroProf ? `/agenda?novo=1&profissionalId=${filtroProf}` : '/agenda?novo=1',
            titulo: 'Novo horário',
            detalhe: 'Marcar cliente na agenda',
        },
        authService.hasModulo(MODULO_CLIENTES) && {
            to: '/clientes?novo=1',
            titulo: 'Novo cliente',
            detalhe: 'Abrir ficha do salão',
        },
        authService.hasModulo(MODULO_SERVICOS) && {
            to: '/servicos?novo=1',
            titulo: 'Novo serviço',
            detalhe: 'Incluir no catálogo',
        },
        authService.hasModulo(MODULO_PROFISSIONAIS) && {
            to: '/profissionais?novo=1',
            titulo: 'Nova cadeira',
            detalhe: 'Profissional e expediente',
        },
        temAgenda && {
            to: filtroProf ? `/agenda?profissionalId=${filtroProf}` : '/agenda',
            titulo: 'Abrir agenda',
            detalhe: 'Grade do dia e da semana',
        },
    ].filter(Boolean) as { to: string; titulo: string; detalhe: string }[];

    return (
        <PageLayout titulo="Início" subtitulo="Painel do salão">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--copper)' }}>
                        {partes.semana}
                    </p>
                    <h2 className="font-display text-2xl font-semibold tracking-tight">
                        {nome ? `Olá, ${nome}` : 'Olá'}
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        {partes.data}
                    </p>
                </div>
                {temAgenda && opcoes.profissionais.length > 0 && (
                    <div className="w-full sm:max-w-xs">
                        <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                            Profissional
                        </label>
                        <select
                            className="lyra-input"
                            style={{ marginTop: 0 }}
                            value={filtroProf}
                            onChange={(e) => setFiltroProf(e.target.value)}
                        >
                            <option value="">Todas as cadeiras</option>
                            {opcoes.profissionais.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.nome}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {erro && (
                <div className="mb-4">
                    <Alert titulo={tituloDeMensagem(erro)}>{erro}</Alert>
                </div>
            )}

            {temAgenda && (
                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <CardKpi rotulo="Hoje" valor={String(ativosHoje.length)} detalhe="atendimentos na grade" />
                    <CardKpi rotulo="A confirmar" valor={String(aConfirmar)} detalhe="ainda em agendado" />
                    <CardKpi rotulo="Em atendimento" valor={String(emAtendimento)} detalhe="na cadeira agora" />
                    <CardKpi rotulo="Ocupação" valor={`${ocupacao}%`} detalhe="das cadeiras visíveis hoje" />
                </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="lyra-card lyra-card-quiet flex min-h-0 flex-col overflow-hidden">
                    <div
                        className="flex flex-col gap-3 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                        style={{ borderColor: 'var(--line)' }}
                    >
                        <div className="min-w-0">
                            <p
                                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                                style={{ color: 'var(--copper)' }}
                            >
                                Agenda
                            </p>
                            <h3 className="truncate font-display text-lg font-semibold">
                                {temAgenda ? tituloAgenda : 'Calendário'}
                            </h3>
                        </div>
                        {temAgenda && (
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        aria-label="Anterior"
                                        onClick={() =>
                                            setCursor((c) =>
                                                visaoCal === 'mes' ? adicionarMeses(c, -1) : adicionarDias(c, -7)
                                            )
                                        }
                                    >
                                        <Seta dir="esq" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setCursor(hoje)}>
                                        Hoje
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        aria-label="Próximo"
                                        onClick={() =>
                                            setCursor((c) =>
                                                visaoCal === 'mes' ? adicionarMeses(c, 1) : adicionarDias(c, 7)
                                            )
                                        }
                                    >
                                        <Seta dir="dir" />
                                    </Button>
                                </div>
                                <div
                                    className="flex rounded-lyra border p-0.5"
                                    style={{ borderColor: 'var(--line)', background: 'var(--panel2)' }}
                                >
                                    <Button
                                        size="sm"
                                        variant={visaoCal === 'mes' ? 'primary' : 'ghost'}
                                        onClick={() => setVisaoCal('mes')}
                                    >
                                        Mês
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={visaoCal === 'semana' ? 'primary' : 'ghost'}
                                        onClick={() => setVisaoCal('semana')}
                                    >
                                        Semana
                                    </Button>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => irAgenda({ visao: 'semana', data: cursor })}
                                >
                                    Ver grade
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="min-h-0 flex-1 overflow-x-auto p-4 md:p-5">
                        {!temAgenda && (
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Sem permissão de agenda neste perfil.
                            </p>
                        )}
                        {temAgenda && carregando && opcoes.profissionais.length === 0 && (
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Carregando a agenda…
                            </p>
                        )}
                        {temAgenda && !carregando && opcoes.profissionais.length === 0 && (
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Nenhuma cadeira cadastrada. A grade aparece quando houver profissionais ativos.
                            </p>
                        )}
                        {temAgenda && opcoes.profissionais.length > 0 && visaoCal === 'mes' && (
                            <GradeMes mes={cursor} dias={diasMes} agendamentos={itens} onDia={abrirDia} />
                        )}
                        {temAgenda && opcoes.profissionais.length > 0 && visaoCal === 'semana' && (
                            <GradeSemana
                                compact
                                dias={diasSemana}
                                profissionais={profissionaisVisiveis}
                                agendamentos={itens}
                                onDia={abrirDia}
                                onSlot={(profissionalId, inicio) =>
                                    irAgenda({
                                        novo: true,
                                        profissionalId,
                                        inicio,
                                        visao: 'dia',
                                        data: cloneDia(inicio),
                                    })
                                }
                                onAbrir={(a) =>
                                    irAgenda({
                                        id: a.id,
                                        profissionalId: a.profissionalId,
                                        visao: 'dia',
                                        data: cloneDia(new Date(a.inicio)),
                                    })
                                }
                            />
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="lyra-card lyra-card-quiet p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--copper)' }}>
                            Ação rápida
                        </p>
                        <h3 className="mt-1 font-display text-lg font-semibold">Atalhos</h3>
                        <div className="mt-3 flex flex-col gap-1.5">
                            {acoes.length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                    Nenhum atalho neste perfil.
                                </p>
                            )}
                            {acoes.map((a) => (
                                <Link
                                    key={a.titulo}
                                    to={a.to}
                                    className="rounded-lyra border px-3 py-2.5 transition hover:border-[color-mix(in_oklab,var(--copper)_40%,transparent)]"
                                    style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                                >
                                    <p className="text-sm font-semibold">{a.titulo}</p>
                                    <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                                        {a.detalhe}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {temAgenda && (
                        <div className="lyra-card lyra-card-quiet p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--copper)' }}>
                                Hoje
                            </p>
                            <h3 className="mt-1 font-display text-lg font-semibold">Próximos</h3>
                            <div className="mt-3 flex flex-col gap-2">
                                {carregando && (
                                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                        …
                                    </p>
                                )}
                                {!carregando && proximos.length === 0 && (
                                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                        Nenhum horário restante hoje.
                                    </p>
                                )}
                                {proximos.map((a) => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        onClick={() =>
                                            irAgenda({
                                                id: a.id,
                                                profissionalId: a.profissionalId,
                                                visao: 'dia',
                                                data: cloneDia(new Date(a.inicio)),
                                            })
                                        }
                                        className="rounded-lyra border px-3 py-2 text-left"
                                        style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-mono text-xs font-semibold tabular-nums">
                                                {formatarHora(a.inicio)}
                                            </p>
                                            <Badge variant={varianteStatus(a.status)} size="sm">
                                                {labelStatus(a.status)}
                                            </Badge>
                                        </div>
                                        <p className="mt-0.5 truncate text-sm font-medium">{a.clienteNome}</p>
                                        <p className="truncate text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                                            {a.profissionalNome} · {rotuloServicos(a)}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                aberto={Boolean(diaAberto)}
                titulo={diaAberto ? formatarDiaLongo(diaAberto) : 'Dia'}
                eyebrow={partesDiaAberto?.semana ?? 'Agenda do dia'}
                subtitulo={
                    horariosDoDiaAberto.length === 0
                        ? 'Nenhum horário neste dia'
                        : `${horariosDoDiaAberto.length} horário${horariosDoDiaAberto.length === 1 ? '' : 's'} na grade`
                }
                onClose={fecharDia}
                largura="72rem"
                rodape={
                    <>
                        <Button variant="ghost" onClick={fecharDia}>
                            Fechar
                        </Button>
                        {diaAberto && (
                            <Button onClick={() => irAgenda({ visao: 'dia', data: diaAberto })}>
                                Abrir na agenda
                            </Button>
                        )}
                    </>
                }
            >
                {diaAberto && (
                    <div className="pb-4">
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                aria-label="Dia anterior"
                                onClick={() => setDiaAberto((d) => (d ? adicionarDias(d, -1) : d))}
                            >
                                <Seta dir="esq" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDiaAberto(hoje)}>
                                Hoje
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                aria-label="Próximo dia"
                                onClick={() => setDiaAberto((d) => (d ? adicionarDias(d, 1) : d))}
                            >
                                <Seta dir="dir" />
                            </Button>
                        </div>
                        {opcoes.profissionais.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Nenhuma cadeira cadastrada.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <GradeDia
                                    dia={diaAberto}
                                    profissionais={profissionaisVisiveis}
                                    agendamentos={itens}
                                    onSlot={(profissionalId, inicio) =>
                                        irAgenda({
                                            novo: true,
                                            profissionalId,
                                            inicio,
                                            visao: 'dia',
                                            data: diaAberto,
                                        })
                                    }
                                    onAbrir={(a) =>
                                        irAgenda({
                                            id: a.id,
                                            profissionalId: a.profissionalId,
                                            visao: 'dia',
                                            data: diaAberto,
                                        })
                                    }
                                />
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </PageLayout>
    );
}

function CardKpi({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
    return (
        <div className="lyra-card lyra-card-quiet px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--faint)' }}>
                {rotulo}
            </p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{valor}</p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                {detalhe}
            </p>
        </div>
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
