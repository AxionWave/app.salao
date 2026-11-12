import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Alert, Badge, Button, Input, PhoneInput, Switch, Textarea } from '@/components/ui';
import { mensagemErroHttp } from '@/exceptions';
import { formatarTelefoneExibicao, telefoneValido } from '@/lib/telefone';
import {
    portalService,
    type AgendamentoCliente,
    type ContaCliente,
    type HorariosPortal,
    type MeusAgendamentos,
    type PaginaPortal,
    type PreferenciasCliente,
} from '@/services/portal.service';
import {
    AdicionarAgenda,
    brl,
    Cartao,
    GradeHorarios,
    hojeNoFuso,
    juntarHorarios,
    Opcao,
    quando,
    SeletorDia,
    somarDias,
    Titulo,
    type Horario,
} from './PortalUi';

const DIAS_VISIVEIS = 60;

type Modo =
    | { tipo: 'lista' }
    | { tipo: 'cancelar'; item: AgendamentoCliente }
    | { tipo: 'remarcar'; item: AgendamentoCliente }
    | { tipo: 'dados' };

const STATUS: Record<string, { nome: string; variant: 'copper' | 'ok' | 'danger' | 'warn' | 'faint' }> = {
    agendado: { nome: 'Marcado', variant: 'copper' },
    confirmado: { nome: 'Confirmado', variant: 'ok' },
    em_atendimento: { nome: 'Em atendimento', variant: 'ok' },
    concluido: { nome: 'Atendido', variant: 'faint' },
    cancelado: { nome: 'Cancelado', variant: 'danger' },
    no_show: { nome: 'Não compareceu', variant: 'warn' },
};

interface Props {
    endereco: string;
    pagina: PaginaPortal;
    conta: ContaCliente;
    voltar: () => void;
    /** 401: a página manda entrar de novo e volta para cá. */
    sessaoCaiu: (e: unknown) => boolean;
    onConta: (conta: ContaCliente) => void;
    marcarDeNovo: (item: AgendamentoCliente) => void;
}

/** Área do cliente: próximos horários (cancelar, remarcar, pôr na agenda), histórico e dados. */
export default function MeusHorarios({ endereco, pagina, conta, voltar, sessaoCaiu, onConta, marcarDeNovo }: Props) {
    const [dados, setDados] = useState<MeusAgendamentos | null>(null);
    const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
    const [erro, setErro] = useState('');
    const [aviso, setAviso] = useState('');
    const [ocupado, setOcupado] = useState(false);

    const fuso = pagina.fusoHorario;
    const telefoneEmpresa = pagina.empresa.telefone;
    const faleComEmpresa = `fale com ${pagina.empresa.nome}${telefoneEmpresa ? ` pelo ${telefoneEmpresa}` : ''}`;

    const carregar = useCallback(async () => {
        try {
            setDados(await portalService.meusAgendamentos(endereco));
        } catch (e) {
            if (!sessaoCaiu(e)) setErro(mensagemErroHttp(e));
        }
    }, [endereco, sessaoCaiu]);

    useEffect(() => {
        void carregar();
    }, [carregar]);

    const irPara = (m: Modo) => {
        setErro('');
        setAviso('');
        setModo(m);
    };

    const concluido = async (mensagem: string) => {
        setModo({ tipo: 'lista' });
        setErro('');
        setAviso(mensagem);
        await carregar();
    };

    if (modo.tipo === 'cancelar') {
        return (
            <Cancelar
                item={modo.item}
                fuso={fuso}
                ocupado={ocupado}
                erro={erro}
                voltar={() => irPara({ tipo: 'lista' })}
                confirmar={async (motivo) => {
                    setOcupado(true);
                    setErro('');
                    try {
                        await portalService.cancelar(endereco, modo.item.id, motivo);
                        await concluido('Horário cancelado. A empresa já foi avisada.');
                    } catch (e) {
                        if (!sessaoCaiu(e)) setErro(mensagemErroHttp(e));
                    } finally {
                        setOcupado(false);
                    }
                }}
            />
        );
    }

    if (modo.tipo === 'remarcar') {
        return (
            <Remarcar
                endereco={endereco}
                pagina={pagina}
                item={modo.item}
                voltar={() => irPara({ tipo: 'lista' })}
                sessaoCaiu={sessaoCaiu}
                feito={(novo) => void concluido(`Remarcado para ${quando(novo.inicio, fuso)}.`)}
            />
        );
    }

    if (modo.tipo === 'dados') {
        return (
            <Dados
                endereco={endereco}
                empresa={pagina.empresa.nome}
                conta={conta}
                voltar={() => irPara({ tipo: 'lista' })}
                sessaoCaiu={sessaoCaiu}
                salvo={(c) => {
                    onConta(c);
                    irPara({ tipo: 'lista' });
                    setAviso('Dados atualizados.');
                }}
            />
        );
    }

    const evento = (a: AgendamentoCliente) => ({
        cadeia: a.cadeia,
        inicio: a.inicio,
        fim: a.fim,
        servicos: a.servicos.map((s) => s.nome),
        profissional: a.profissional,
    });

    return (
        <div className="flex flex-col gap-4">
            {aviso && (
                <p
                    className="rounded-lyra border px-4 py-3 text-sm font-medium"
                    role="status"
                    style={{ borderColor: 'var(--ok)', color: 'var(--ok)', background: 'var(--panel)' }}
                >
                    {aviso}
                </p>
            )}
            {erro && <Alert titulo="Atenção">{erro}</Alert>}

            <Cartao>
                <Titulo voltar={voltar}>Meus horários</Titulo>
                {!dados ? (
                    !erro && (
                        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            Carregando…
                        </p>
                    )
                ) : dados.proximos.length === 0 ? (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            Nenhum horário marcado em {pagina.empresa.nome}.
                        </p>
                        <Button onClick={voltar}>Marcar um horário</Button>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {dados.proximos.map((a) => {
                            const status = STATUS[a.status] ?? STATUS.agendado;
                            return (
                                <li
                                    key={a.id}
                                    className="flex flex-col gap-3 rounded-lyra border p-4"
                                    style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-semibold first-letter:uppercase" style={{ color: 'var(--ink)' }}>
                                                {quando(a.inicio, fuso)}
                                            </p>
                                            {a.para && (
                                                <p className="mt-0.5 text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                                    Para {a.para}
                                                </p>
                                            )}
                                            <p className="mt-0.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                                {a.servicos.map((s) => s.nome).join(', ')} · com {a.profissional}
                                                {a.preco > 0 ? ` · ${brl.format(a.preco)}` : ''}
                                            </p>
                                        </div>
                                        <Badge size="sm" variant={status.variant}>
                                            {status.nome}
                                        </Badge>
                                    </div>
                                    {a.podeAlterar ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => irPara({ tipo: 'remarcar', item: a })}>
                                                    Remarcar
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => irPara({ tipo: 'cancelar', item: a })}>
                                                    Cancelar
                                                </Button>
                                            </div>
                                            {a.alterarAte && new Date(a.alterarAte) < new Date(a.inicio) && (
                                                <p className="text-xs" style={{ color: 'var(--faint)' }}>
                                                    Dá para alterar pelo site até {quando(a.alterarAte, fuso, true)}.
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        a.status !== 'em_atendimento' && (
                                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                {a.alterarAte
                                                    ? `O prazo para alterar pelo site acabou. Para cancelar ou remarcar, ${faleComEmpresa}.`
                                                    : `Para cancelar ou remarcar, ${faleComEmpresa}.`}
                                            </p>
                                        )
                                    )}
                                    <AdicionarAgenda evento={evento(a)} empresa={pagina.empresa.nome} local={pagina.empresa.endereco} />
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Cartao>

            {dados && dados.historico.length > 0 && (
                <Cartao>
                    <Titulo>Histórico</Titulo>
                    <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--line)' }}>
                        {dados.historico.map((a) => {
                            const status = STATUS[a.status] ?? STATUS.agendado;
                            return (
                                <li key={a.id} className="flex items-center justify-between gap-3 py-3" style={{ borderColor: 'var(--line)' }}>
                                    <div className="min-w-0">
                                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                            <span className="inline-block first-letter:uppercase">{quando(a.inicio, fuso, true)}</span>
                                            <Badge size="sm" variant={status.variant}>
                                                {status.nome}
                                            </Badge>
                                        </p>
                                        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                            {a.para ? `Para ${a.para} · ` : ''}
                                            {a.servicos.map((s) => s.nome).join(', ')} · {a.profissional}
                                            {a.status === 'cancelado' && a.motivoCancelamento ? ` · ${a.motivoCancelamento}` : ''}
                                        </p>
                                    </div>
                                    <Button size="sm" variant="secondary" className="shrink-0" onClick={() => marcarDeNovo(a)}>
                                        Marcar de novo
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                </Cartao>
            )}

            <Cartao>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                        <p className="font-semibold" style={{ color: 'var(--ink)' }}>
                            {conta.nome ?? 'Seus dados'}
                        </p>
                        <p className="truncate" style={{ color: 'var(--muted-foreground)' }}>
                            {[conta.email, conta.telefone ? formatarTelefoneExibicao(conta.telefone) : null].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => irPara({ tipo: 'dados' })}>
                        Editar
                    </Button>
                </div>
            </Cartao>
        </div>
    );
}

function Cancelar({
    item,
    fuso,
    ocupado,
    erro,
    voltar,
    confirmar,
}: {
    item: AgendamentoCliente;
    fuso: string;
    ocupado: boolean;
    erro: string;
    voltar: () => void;
    confirmar: (motivo: string | null) => Promise<void>;
}) {
    const [motivo, setMotivo] = useState('');
    return (
        <div className="flex flex-col gap-4">
            {erro && <Alert titulo="Atenção">{erro}</Alert>}
            <Cartao>
                <Titulo voltar={voltar}>Cancelar horário</Titulo>
                <div className="flex flex-col gap-4">
                    <div className="text-sm">
                        <p className="font-semibold first-letter:uppercase" style={{ color: 'var(--ink)' }}>
                            {quando(item.inicio, fuso)}
                        </p>
                        <p style={{ color: 'var(--muted-foreground)' }}>
                            {item.para ? `Para ${item.para} · ` : ''}
                            {item.servicos.map((s) => s.nome).join(', ')} · com {item.profissional}
                        </p>
                    </div>
                    <Textarea
                        id="portal-motivo"
                        label="Motivo (opcional)"
                        rows={2}
                        maxLength={200}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row-reverse">
                        <Button variant="danger" disabled={ocupado} onClick={() => void confirmar(motivo.trim() || null)}>
                            {ocupado ? 'Cancelando…' : 'Cancelar horário'}
                        </Button>
                        <Button variant="ghost" disabled={ocupado} onClick={voltar}>
                            Manter
                        </Button>
                    </div>
                </div>
            </Cartao>
        </div>
    );
}

function Remarcar({
    endereco,
    pagina,
    item,
    voltar,
    sessaoCaiu,
    feito,
}: {
    endereco: string;
    pagina: PaginaPortal;
    item: AgendamentoCliente;
    voltar: () => void;
    sessaoCaiu: (e: unknown) => boolean;
    feito: (novo: AgendamentoCliente) => void;
}) {
    const fuso = pagina.fusoHorario;
    const servicoIds = item.servicos.map((s) => s.id);
    const aptos = pagina.profissionais.filter((p) =>
        servicoIds.every((id) => pagina.servicos.find((s) => s.id === id)?.profissionalIds.includes(p.id)),
    );
    const [profissionalId, setProfissionalId] = useState<number | null>(
        aptos.some((p) => p.id === item.profissionalId) ? item.profissionalId : null,
    );
    const [dia, setDia] = useState(() => {
        try {
            return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
                new Date(item.inicio),
            );
        } catch {
            return hojeNoFuso(fuso);
        }
    });
    const [horarios, setHorarios] = useState<HorariosPortal | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [horario, setHorario] = useState<Horario | null>(null);
    const [erro, setErro] = useState('');
    const [ocupado, setOcupado] = useState(false);

    const dias = useMemo(() => {
        const hoje = hojeNoFuso(fuso);
        return Array.from({ length: Math.min(pagina.janelaDias, DIAS_VISIVEIS) + 1 }, (_, i) => somarDias(hoje, i));
    }, [fuso, pagina.janelaDias]);

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            setHorarios(await portalService.horariosRemarcar(endereco, item.id, dia, profissionalId));
        } catch (e) {
            setHorarios(null);
            if (!sessaoCaiu(e)) setErro(mensagemErroHttp(e));
        } finally {
            setCarregando(false);
        }
    }, [endereco, item.id, dia, profissionalId, sessaoCaiu]);

    useEffect(() => {
        void carregar();
    }, [carregar]);

    const atual = new Date(item.inicio).getTime();
    const mesmoProfissional = profissionalId === null || profissionalId === item.profissionalId;
    const livres = useMemo(
        () =>
            juntarHorarios(horarios?.profissionais ?? [], profissionalId).filter(
                (h) => !(mesmoProfissional && new Date(h.inicio).getTime() === atual),
            ),
        [horarios, profissionalId, mesmoProfissional, atual],
    );

    const confirmar = async () => {
        if (!horario) return;
        setOcupado(true);
        setErro('');
        try {
            feito(await portalService.remarcar(endereco, item.id, profissionalId, horario.inicio));
        } catch (e) {
            if (sessaoCaiu(e)) return;
            const msg = mensagemErroHttp(e);
            if (axios.isAxiosError(e) && e.response?.status === 409 && /não está mais livre/i.test(msg)) {
                setHorario(null);
                void carregar();
            }
            setErro(msg);
        } finally {
            setOcupado(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {erro && <Alert titulo="Atenção">{erro}</Alert>}
            <Cartao>
                <Titulo voltar={voltar}>Remarcar</Titulo>
                <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Agora: {quando(item.inicio, fuso)}, com {item.profissional}.
                    <br />
                    {item.para ? `Para ${item.para} · ` : ''}
                    {item.servicos.map((s) => s.nome).join(', ')}
                </p>

                {aptos.length > 1 && (
                    <div className="mb-4 flex flex-col gap-2">
                        <Opcao
                            selecionado={profissionalId === null}
                            onClick={() => {
                                setProfissionalId(null);
                                setHorario(null);
                            }}
                            titulo="Sem preferência"
                        />
                        {aptos.map((p) => (
                            <Opcao
                                key={p.id}
                                selecionado={profissionalId === p.id}
                                onClick={() => {
                                    setProfissionalId(p.id);
                                    setHorario(null);
                                }}
                                titulo={p.nome}
                            />
                        ))}
                    </div>
                )}

                <SeletorDia
                    dias={dias}
                    dia={dia}
                    onChange={(d) => {
                        setDia(d);
                        setHorario(null);
                        setErro('');
                    }}
                />
                <GradeHorarios carregando={carregando} livres={livres} selecionado={horario} onSelect={setHorario} />

                <Button className="mt-4" fullWidth disabled={!horario || ocupado} onClick={() => void confirmar()}>
                    {ocupado ? 'Remarcando…' : horario ? `Remarcar para ${horario.hora}` : 'Escolha o novo horário'}
                </Button>
            </Cartao>
        </div>
    );
}

function Dados({
    endereco,
    empresa,
    conta,
    voltar,
    sessaoCaiu,
    salvo,
}: {
    endereco: string;
    empresa: string;
    conta: ContaCliente;
    voltar: () => void;
    sessaoCaiu: (e: unknown) => boolean;
    salvo: (conta: ContaCliente) => void;
}) {
    const [nome, setNome] = useState(conta.nome ?? '');
    const [telefone, setTelefone] = useState(conta.telefone ?? '');
    const [erro, setErro] = useState('');
    const [ocupado, setOcupado] = useState(false);

    const salvar = async () => {
        setOcupado(true);
        setErro('');
        try {
            salvo(await portalService.salvarConta(endereco, nome.trim(), telefone));
        } catch (e) {
            if (!sessaoCaiu(e)) setErro(mensagemErroHttp(e));
        } finally {
            setOcupado(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {erro && <Alert titulo="Atenção">{erro}</Alert>}
            <Cartao>
                <Titulo voltar={voltar}>Seus dados</Titulo>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void salvar();
                    }}
                >
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        E-mail: <strong style={{ color: 'var(--ink)' }}>{conta.email}</strong>. Para usar outro, saia e entre com ele.
                    </p>
                    <Input
                        id="portal-dados-nome"
                        label="Nome"
                        autoComplete="name"
                        required
                        maxLength={120}
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                    />
                    <PhoneInput label="Telefone (WhatsApp)" required value={telefone} onChange={setTelefone} />
                    <Button type="submit" disabled={ocupado || nome.trim().length < 2 || !telefoneValido(telefone)}>
                        {ocupado ? 'Salvando…' : 'Salvar'}
                    </Button>
                </form>
            </Cartao>
            <AvisosEmail endereco={endereco} empresa={empresa} sessaoCaiu={sessaoCaiu} />
        </div>
    );
}

function AvisosEmail({
    endereco,
    empresa,
    sessaoCaiu,
}: {
    endereco: string;
    empresa: string;
    sessaoCaiu: (e: unknown) => boolean;
}) {
    const [pref, setPref] = useState<PreferenciasCliente | null>(null);
    const [erro, setErro] = useState('');
    const [ocupado, setOcupado] = useState(false);

    useEffect(() => {
        let vivo = true;
        portalService
            .preferencias(endereco)
            .then((p) => vivo && setPref(p))
            .catch((e) => vivo && !sessaoCaiu(e) && setErro(mensagemErroHttp(e)));
        return () => {
            vivo = false;
        };
    }, [endereco, sessaoCaiu]);

    const mudar = async (receber: boolean) => {
        setOcupado(true);
        setErro('');
        try {
            setPref(await portalService.salvarPreferencias(endereco, receber));
        } catch (e) {
            if (!sessaoCaiu(e)) setErro(mensagemErroHttp(e));
        } finally {
            setOcupado(false);
        }
    };

    const descricao = !pref
        ? ''
        : pref.bloqueio
          ? pref.bloqueio === 'reclamacao'
              ? 'Um e-mail daqui foi marcado como spam neste endereço, então nenhum aviso é mandado para ele. Para voltar a receber, fale com a empresa.'
              : 'Os e-mails para este endereço voltaram (ele não existe ou recusou), então nenhum aviso é mandado para ele. Para voltar a receber, fale com a empresa.'
          : pref.receberEmails
            ? `Você recebe de ${empresa} a confirmação, as mudanças e os lembretes dos seus horários.`
            : `Você não recebe mais os avisos de ${empresa} por e-mail. O código para entrar no site continua chegando.`;

    return (
        <Cartao>
            <Titulo>Avisos por e-mail</Titulo>
            {erro && <Alert titulo="Atenção">{erro}</Alert>}
            {!pref ? (
                !erro && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Carregando…
                    </p>
                )
            ) : !pref.disponivel ? (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Não dá para mudar os avisos por aqui agora.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    <Switch
                        label={`Receber avisos de ${empresa}`}
                        descricao={descricao}
                        checked={pref.receberEmails}
                        disabled={ocupado || pref.bloqueio !== null}
                        onChange={(v) => void mudar(v)}
                    />
                    {!pref.empresaEnvia && !pref.bloqueio && (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            No momento, a empresa não está mandando avisos por e-mail.
                        </p>
                    )}
                </div>
            )}
        </Cartao>
    );
}
