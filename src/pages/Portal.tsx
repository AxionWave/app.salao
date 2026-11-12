import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import MeusHorarios from '@/components/portal/MeusHorarios';
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
} from '@/components/portal/PortalUi';
import { Alert, Button, Input, PhoneInput, Textarea } from '@/components/ui';
import { mensagemErroHttp } from '@/exceptions';
import { formatarDuracaoMinutos } from '@/lib/agenda';
import { telefoneValido } from '@/lib/telefone';
import type { Termo } from '@/services/configuracao.service';
import {
    portalService,
    salvarSessao,
    sessaoSalva,
    type AgendamentoCliente,
    type AgendamentoPortal,
    type HorariosPortal,
    type PaginaPortal,
    type PessoaFamilia,
    type SessaoCliente,
} from '@/services/portal.service';

const DIAS_VISIVEIS = 60;
const ESPERA_REENVIO = 30;

type Passo = 'servicos' | 'profissional' | 'horario' | 'email' | 'codigo' | 'cadastro' | 'confirmar' | 'feito' | 'meus';

const fimDe = (inicio: string, minutos: number) => new Date(new Date(inicio).getTime() + minutos * 60_000).toISOString();

function horaLocal(iso: string, fuso: string): string {
    const opcoes: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    try {
        return new Intl.DateTimeFormat('pt-BR', { ...opcoes, timeZone: fuso }).format(new Date(iso));
    } catch {
        return new Intl.DateTimeFormat('pt-BR', opcoes).format(new Date(iso));
    }
}

const minusculo = (t: Termo, plural = false) => (plural ? t.plural : t.singular).toLocaleLowerCase('pt-BR');
const artigo = (t: Termo) => (t.genero === 'f' ? 'a' : 'o');

/**
 * Troca dos serviços na confirmação: mostra o novo tempo total e até quando o horário fica reservado.
 * Os botões só aparecem depois que algo muda (`alterado`).
 */
function EditarServicos({
    pagina,
    ids,
    alterado,
    inicio,
    horaInicio,
    ocupado,
    termoRecurso,
    onChange,
    onCancelar,
    onAplicar,
}: {
    pagina: PaginaPortal;
    ids: number[];
    alterado: boolean;
    inicio: string | null;
    horaInicio: string | null;
    ocupado: boolean;
    termoRecurso: string;
    onChange: (ids: number[]) => void;
    onCancelar: () => void;
    onAplicar: () => void;
}) {
    const escolhidos = pagina.servicos.filter((s) => ids.includes(s.id));
    const total = escolhidos.reduce((soma, s) => soma + s.duracaoMinutos, 0);
    const preco = escolhidos.reduce((soma, s) => soma + s.preco, 0);
    const alguemFaz = pagina.profissionais.some((p) => escolhidos.every((s) => s.profissionalIds.includes(p.id)));
    return (
        <div className="flex flex-col gap-2 rounded-lyra border p-3" style={{ borderColor: 'var(--line)' }}>
            {pagina.servicos.map((s) => (
                <Opcao
                    key={s.id}
                    selecionado={ids.includes(s.id)}
                    onClick={() => onChange(ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id])}
                    titulo={s.nome}
                    detalhe={formatarDuracaoMinutos(s.duracaoMinutos)}
                    lateral={s.preco > 0 ? brl.format(s.preco) : undefined}
                />
            ))}
            {alterado && ids.length > 0 && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Total: {formatarDuracaoMinutos(total)}
                    {preco > 0 ? ` · ${brl.format(preco)}` : ''}
                    {inicio && horaInicio
                        ? ` · ficaria reservado das ${horaInicio} às ${horaLocal(fimDe(inicio, total), pagina.fusoHorario)}`
                        : ''}
                </p>
            )}
            {ids.length > 0 && !alguemFaz && (
                <Alert variant="warn">Nenhum {termoRecurso} faz todos estes juntos. Tire algum.</Alert>
            )}
            {alterado && (
                <div className="flex gap-2">
                    <Button size="sm" disabled={ocupado || ids.length === 0 || !alguemFaz} onClick={onAplicar}>
                        {ocupado ? 'Conferindo horário…' : 'Aplicar'}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={ocupado} onClick={onCancelar}>
                        Cancelar
                    </Button>
                </div>
            )}
        </div>
    );
}

/** Página pública da empresa (lyra.lumensoft.com.br/{endereco}): o cliente escolhe e marca o horário. */
export default function PortalPage() {
    const { endereco = '' } = useParams();
    const [pagina, setPagina] = useState<PaginaPortal | null>(null);
    const [naoExiste, setNaoExiste] = useState(false);
    const [erroPagina, setErroPagina] = useState('');
    const [passo, setPasso] = useState<Passo>('servicos');
    const [erro, setErro] = useState('');
    const [ocupado, setOcupado] = useState(false);

    const [servicoIds, setServicoIds] = useState<number[]>([]);
    const [profissionalId, setProfissionalId] = useState<number | null>(null);
    const [dia, setDia] = useState('');
    const [horarios, setHorarios] = useState<HorariosPortal | null>(null);
    const [carregandoHorarios, setCarregandoHorarios] = useState(false);
    const [horario, setHorario] = useState<Horario | null>(null);

    const [sessao, setSessao] = useState<SessaoCliente | null>(() => sessaoSalva());
    const [email, setEmail] = useState(() => sessaoSalva()?.conta.email ?? '');
    const [codigo, setCodigo] = useState('');
    const [reenvioEm, setReenvioEm] = useState(0);
    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [feito, setFeito] = useState<AgendamentoPortal | null>(null);
    /** Quem da família a conta pode agendar (a empresa monta); vazio na maioria das contas. */
    const [familia, setFamilia] = useState<PessoaFamilia[]>([]);
    /** Para quem é o horário: alguém da família, ou null para o próprio cliente. */
    const [paraId, setParaId] = useState<number | null>(null);
    /** Serviços sendo trocados na confirmação; null quando não está editando. */
    const [rascunho, setRascunho] = useState<number[] | null>(null);
    /** Para onde o login leva: terminar o agendamento ou abrir "Meus horários". */
    const [destino, setDestino] = useState<'agendar' | 'meus'>('agendar');
    const topo = useRef<HTMLDivElement>(null);
    const passoAtual = useRef(passo);
    useEffect(() => {
        passoAtual.current = passo;
    }, [passo]);

    useEffect(() => {
        let vivo = true;
        portalService
            .pagina(endereco)
            .then((p) => {
                if (!vivo) return;
                setPagina(p);
                setDia(hojeNoFuso(p.fusoHorario));
                document.title = `${p.empresa.nome} · Agendamento online`;
            })
            .catch((e) => {
                if (!vivo) return;
                if (axios.isAxiosError(e) && e.response?.status === 404) setNaoExiste(true);
                else setErroPagina(mensagemErroHttp(e));
            });
        return () => {
            vivo = false;
        };
    }, [endereco]);

    useEffect(() => {
        const salva = sessaoSalva();
        if (!salva) return;
        let vivo = true;
        portalService
            .conta(endereco)
            .then((conta) => {
                if (!vivo) return;
                const s = { ...salva, conta };
                salvarSessao(s);
                setSessao(s);
            })
            .catch((e) => {
                if (vivo && axios.isAxiosError(e) && e.response?.status === 401) {
                    salvarSessao(null);
                    setSessao(null);
                }
            });
        return () => {
            vivo = false;
        };
    }, [endereco]);

    useEffect(() => {
        if (passo !== 'confirmar' || !sessao) return;
        let vivo = true;
        portalService
            .familia(endereco)
            .then((f) => {
                if (!vivo) return;
                setFamilia(f);
                setParaId((id) => (id !== null && f.some((p) => p.id === id) ? id : null));
            })
            .catch(() => {
                if (vivo) setFamilia([]);
            });
        return () => {
            vivo = false;
        };
    }, [passo, endereco, sessao]);

    useEffect(() => {
        if (reenvioEm <= 0) return;
        const t = setTimeout(() => setReenvioEm((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [reenvioEm]);

    const irPara = (p: Passo) => {
        setErro('');
        setPasso(p);
        topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const t = pagina?.termos;
    const escolhidos = useMemo(
        () => pagina?.servicos.filter((s) => servicoIds.includes(s.id)) ?? [],
        [pagina, servicoIds],
    );
    const duracao = escolhidos.reduce((soma, s) => soma + s.duracaoMinutos, 0);
    const preco = escolhidos.reduce((soma, s) => soma + s.preco, 0);
    /** Quem faz todos os serviços escolhidos. */
    const aptos = useMemo(
        () => pagina?.profissionais.filter((p) => escolhidos.every((s) => s.profissionalIds.includes(p.id))) ?? [],
        [pagina, escolhidos],
    );
    const profissional = pagina?.profissionais.find((p) => p.id === profissionalId) ?? null;

    const dias = useMemo(() => {
        if (!pagina) return [];
        const hoje = hojeNoFuso(pagina.fusoHorario);
        return Array.from({ length: Math.min(pagina.janelaDias, DIAS_VISIVEIS) + 1 }, (_, i) => somarDias(hoje, i));
    }, [pagina]);

    const chaveHorarios = `${dia}|${servicoIds.join(',')}|${profissionalId ?? ''}`;
    const [carregados, setCarregados] = useState('');

    const carregarHorarios = useCallback(async () => {
        if (!dia || servicoIds.length === 0) return;
        setCarregandoHorarios(true);
        try {
            setHorarios(await portalService.horarios(endereco, dia, servicoIds, profissionalId));
            setCarregados(`${dia}|${servicoIds.join(',')}|${profissionalId ?? ''}`);
        } catch (e) {
            setHorarios(null);
            setErro(mensagemErroHttp(e));
        } finally {
            setCarregandoHorarios(false);
        }
    }, [endereco, dia, servicoIds, profissionalId]);

    useEffect(() => {
        if (passo === 'horario') void carregarHorarios();
    }, [passo, carregarHorarios]);

    const livres: Horario[] = useMemo(
        () => juntarHorarios(horarios?.profissionais ?? [], profissionalId),
        [horarios, profissionalId],
    );

    const sair = () => {
        salvarSessao(null);
        setSessao(null);
        setFamilia([]);
        setParaId(null);
        if (passo === 'meus') setPasso('servicos');
    };

    /** Depois do horário: entra se precisar, completa o cadastro se faltar, e confirma. */
    const seguirComSessao = (s: SessaoCliente | null) => {
        if (!s) {
            setDestino('agendar');
            irPara('email');
            return;
        }
        if (!s.conta.nome || !s.conta.telefone) {
            setNome(s.conta.nome ?? '');
            setTelefone(s.conta.telefone ?? '');
            irPara('cadastro');
            return;
        }
        irPara('confirmar');
    };

    const sessaoCaiu = useCallback(
        (e: unknown) => {
            if (axios.isAxiosError(e) && e.response?.status === 401) {
                salvarSessao(null);
                setSessao(null);
                if (passoAtual.current === 'meus') setDestino('meus');
                setPasso('email');
                setErro('Sua sessão expirou. Entre de novo com o código.');
                return true;
            }
            return false;
        },
        [],
    );

    const abrirMeus = () => {
        if (sessao) {
            irPara('meus');
        } else {
            setDestino('meus');
            irPara('email');
        }
    };

    /** Mesmos serviços e profissional, se ainda estiverem na página; segue para escolher o dia. */
    const marcarDeNovo = (a: AgendamentoCliente) => {
        if (!pagina) return;
        const ids = a.servicos.map((s) => s.id).filter((id) => pagina.servicos.some((s) => s.id === id));
        if (ids.length === 0) {
            irPara('servicos');
            setErro('Este serviço não está mais disponível online. Escolha outro.');
            return;
        }
        const faz = (pid: number) => ids.every((id) => pagina.servicos.find((s) => s.id === id)?.profissionalIds.includes(pid));
        setServicoIds(ids);
        setProfissionalId(pagina.profissionais.some((p) => p.id === a.profissionalId) && faz(a.profissionalId) ? a.profissionalId : null);
        setHorario(null);
        setDia(hojeNoFuso(pagina.fusoHorario));
        irPara('horario');
    };

    const pedirCodigo = async () => {
        setOcupado(true);
        setErro('');
        try {
            await portalService.pedirCodigo(endereco, email.trim());
            setCodigo('');
            setReenvioEm(ESPERA_REENVIO);
            irPara('codigo');
        } catch (e) {
            setErro(mensagemErroHttp(e));
        } finally {
            setOcupado(false);
        }
    };

    const entrar = async () => {
        setOcupado(true);
        setErro('');
        try {
            const s = await portalService.entrar(endereco, email.trim(), codigo);
            salvarSessao(s);
            setSessao(s);
            if (destino === 'meus') irPara('meus');
            else seguirComSessao(s);
        } catch (e) {
            setErro(mensagemErroHttp(e));
        } finally {
            setOcupado(false);
        }
    };

    const salvarCadastro = async () => {
        if (!sessao) return;
        setOcupado(true);
        setErro('');
        try {
            const conta = await portalService.salvarConta(endereco, nome.trim(), telefone);
            const s = { ...sessao, conta };
            salvarSessao(s);
            setSessao(s);
            irPara('confirmar');
        } catch (e) {
            if (!sessaoCaiu(e)) setErro(mensagemErroHttp(e));
        } finally {
            setOcupado(false);
        }
    };

    const confirmar = async () => {
        if (!horario) return;
        setOcupado(true);
        setErro('');
        try {
            const r = await portalService.agendar(endereco, {
                servicoIds,
                profissionalId,
                inicio: horario.inicio,
                observacoes: observacoes.trim() || null,
                clienteId: paraId,
            });
            setFeito(r);
            irPara('feito');
        } catch (e) {
            if (sessaoCaiu(e)) return;
            const msg = mensagemErroHttp(e);
            if (axios.isAxiosError(e) && e.response?.status === 409 && /não está mais livre/i.test(msg)) {
                setHorario(null);
                setPasso('horario');
            }
            setErro(msg);
        } finally {
            setOcupado(false);
        }
    };

    /**
     * Troca os serviços sem perder o horário, se o novo tempo total ainda couber nele (com o mesmo
     * profissional, ou com quem fizer todos). Se não couber, volta para a escolha do horário.
     */
    const aplicarServicos = async (ids: number[]) => {
        if (!pagina || !horario) return;
        const novos = pagina.servicos.filter((s) => ids.includes(s.id));
        const aptosNovos = pagina.profissionais.filter((p) => novos.every((s) => s.profissionalIds.includes(p.id)));
        const pid = profissionalId !== null && aptosNovos.some((p) => p.id === profissionalId) ? profissionalId : null;
        setOcupado(true);
        setErro('');
        try {
            const r = await portalService.horarios(endereco, dia, ids, pid);
            const cabe = juntarHorarios(r.profissionais, pid).some((h) => h.inicio === horario.inicio);
            setServicoIds(ids);
            setProfissionalId(pid);
            setHorarios(r);
            setCarregados(`${dia}|${ids.join(',')}|${pid ?? ''}`);
            setRascunho(null);
            if (!cabe) {
                const total = novos.reduce((soma, s) => soma + s.duracaoMinutos, 0);
                setHorario(null);
                irPara('horario');
                setErro(
                    `Com ${formatarDuracaoMinutos(total)} no total, o horário das ${horario.hora} não cabe mais na agenda. Escolha outro.`,
                );
            }
        } catch (e) {
            setErro(mensagemErroHttp(e));
        } finally {
            setOcupado(false);
        }
    };

    const recomecar = () => {
        setServicoIds([]);
        setProfissionalId(null);
        setHorario(null);
        setObservacoes('');
        setFeito(null);
        setParaId(null);
        if (pagina) setDia(hojeNoFuso(pagina.fusoHorario));
        irPara('servicos');
    };

    const fundo = {
        background: 'var(--lyra-bg)',
        color: 'var(--lyra-text)',
    };

    if (naoExiste || erroPagina || !pagina || !t) {
        return (
            <div
                className="flex min-h-[100dvh] items-center justify-center px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[calc(2.5rem+var(--lyra-safe-top))]"
                style={fundo}
            >
                <div className="w-full max-w-md">
                    {naoExiste ? (
                        <Cartao>
                            <h1 className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                                Página não encontrada
                            </h1>
                            <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Confira o endereço. Se ele veio da empresa, peça o link de novo: o agendamento online pode
                                ter sido desligado.
                            </p>
                        </Cartao>
                    ) : erroPagina ? (
                        <Alert titulo="Não deu para abrir a página">{erroPagina}</Alert>
                    ) : (
                        <p className="text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            Carregando…
                        </p>
                    )}
                </div>
            </div>
        );
    }

    const resumo = (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt style={{ color: 'var(--muted-foreground)' }}>{escolhidos.length > 1 ? t.servico.plural : t.servico.singular}</dt>
            <dd style={{ color: 'var(--ink)' }}>
                <ul className="flex flex-col gap-1">
                    {escolhidos.map((s) => (
                        <li key={s.id} className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0">
                                {s.nome}
                                <span style={{ color: 'var(--muted-foreground)' }}> · {formatarDuracaoMinutos(s.duracaoMinutos)}</span>
                            </span>
                            {s.preco > 0 && escolhidos.length > 1 && (
                                <span className="shrink-0 tabular-nums">{brl.format(s.preco)}</span>
                            )}
                        </li>
                    ))}
                </ul>
            </dd>
            <dt style={{ color: 'var(--muted-foreground)' }}>Com</dt>
            <dd style={{ color: 'var(--ink)' }}>{profissional?.nome ?? (aptos.length === 1 ? aptos[0].nome : 'Quem estiver livre')}</dd>
            {horario && (
                <>
                    <dt style={{ color: 'var(--muted-foreground)' }}>Quando</dt>
                    <dd className="first-letter:uppercase" style={{ color: 'var(--ink)' }}>
                        {quando(horario.inicio, pagina.fusoHorario)}
                    </dd>
                </>
            )}
            <dt style={{ color: 'var(--muted-foreground)' }}>Duração</dt>
            <dd style={{ color: 'var(--ink)' }}>
                {formatarDuracaoMinutos(duracao)}
                {horario && ` (reservado das ${horario.hora} às ${horaLocal(fimDe(horario.inicio, duracao), pagina.fusoHorario)})`}
            </dd>
            {preco > 0 && (
                <>
                    <dt style={{ color: 'var(--muted-foreground)' }}>{escolhidos.length > 1 ? 'Total' : 'Valor'}</dt>
                    <dd style={{ color: 'var(--ink)' }}>{brl.format(preco)}</dd>
                </>
            )}
        </dl>
    );

    return (
        <div
            className="min-h-[100dvh] px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[calc(1.5rem+var(--lyra-safe-top))]"
            style={fundo}
        >
            <div
                ref={topo}
                className={`mx-auto flex w-full max-w-xl scroll-mt-4 flex-col gap-4 ${passo === 'confirmar' ? 'md:max-w-4xl' : ''}`}
            >
                <header className="flex items-start gap-4">
                    {pagina.empresa.logoUrl && (
                        <img
                            src={pagina.empresa.logoUrl}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-lyra object-cover"
                            style={{ background: 'var(--panel)' }}
                        />
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--copper)' }}>
                            Agendamento online
                        </p>
                        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
                            {pagina.empresa.nome}
                        </h1>
                        {pagina.apresentacao && (
                            <p className="mt-1 whitespace-pre-line text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                {pagina.apresentacao}
                            </p>
                        )}
                        {(pagina.empresa.endereco || pagina.empresa.telefone) && (
                            <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {[pagina.empresa.endereco, pagina.empresa.telefone].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>
                </header>

                {passo !== 'email' && passo !== 'codigo' && (
                    <p className="flex flex-wrap gap-x-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {sessao && <span>Entrou como {sessao.conta.email}</span>}
                        {passo !== 'meus' && (
                            <button type="button" className="font-medium underline" style={{ color: 'var(--copper)' }} onClick={abrirMeus}>
                                {sessao ? 'Meus horários' : 'Já marcou? Ver meus horários'}
                            </button>
                        )}
                        {sessao && (
                            <button type="button" className="underline" onClick={sair}>
                                sair
                            </button>
                        )}
                    </p>
                )}

                {erro && passo !== 'meus' && <Alert titulo="Atenção">{erro}</Alert>}

                {passo === 'meus' && sessao && (
                    <MeusHorarios
                        endereco={endereco}
                        pagina={pagina}
                        conta={sessao.conta}
                        voltar={() => irPara('servicos')}
                        sessaoCaiu={sessaoCaiu}
                        onConta={(conta) => {
                            const s = { ...sessao, conta };
                            salvarSessao(s);
                            setSessao(s);
                        }}
                        marcarDeNovo={marcarDeNovo}
                    />
                )}

                {passo === 'servicos' && (
                    <Cartao>
                        <Titulo>
                            Escolha {artigo(t.servico)} {minusculo(t.servico)}
                        </Titulo>
                        {pagina.servicos.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Nenhum {minusculo(t.servico)} disponível online agora. Fale com a empresa
                                {pagina.empresa.telefone ? ` pelo ${pagina.empresa.telefone}` : ''}.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {pagina.servicos.map((s) => (
                                    <Opcao
                                        key={s.id}
                                        selecionado={servicoIds.includes(s.id)}
                                        onClick={() =>
                                            setServicoIds((ids) =>
                                                ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id],
                                            )
                                        }
                                        titulo={s.nome}
                                        detalhe={formatarDuracaoMinutos(s.duracaoMinutos)}
                                        lateral={s.preco > 0 ? brl.format(s.preco) : undefined}
                                    />
                                ))}
                                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                    {escolhidos.length > 1
                                        ? `${escolhidos.length} escolhidos, feitos em sequência: ${formatarDuracaoMinutos(duracao)} no total${preco > 0 ? ` · ${brl.format(preco)}` : ''}.`
                                        : 'Pode escolher mais de um.'}
                                </p>
                                {servicoIds.length > 0 && aptos.length === 0 && (
                                    <Alert variant="warn">
                                        Nenhum {minusculo(t.recurso)} faz todos estes {minusculo(t.servico, true)} juntos.
                                        Marque um de cada vez.
                                    </Alert>
                                )}
                                <Button
                                    className="mt-2"
                                    disabled={servicoIds.length === 0 || aptos.length === 0}
                                    onClick={() => {
                                        if (profissionalId !== null && !aptos.some((p) => p.id === profissionalId)) {
                                            setProfissionalId(null);
                                        }
                                        setHorario(null);
                                        irPara(aptos.length > 1 ? 'profissional' : 'horario');
                                    }}
                                >
                                    Continuar
                                </Button>
                            </div>
                        )}
                    </Cartao>
                )}

                {passo === 'profissional' && (
                    <Cartao>
                        <Titulo voltar={() => irPara('servicos')}>Com quem?</Titulo>
                        <div className="flex flex-col gap-2">
                            <Opcao
                                selecionado={profissionalId === null}
                                onClick={() => {
                                    setProfissionalId(null);
                                    irPara('horario');
                                }}
                                titulo="Sem preferência"
                                detalhe="Mostra os horários de todos"
                            />
                            {aptos.map((p) => (
                                <Opcao
                                    key={p.id}
                                    selecionado={profissionalId === p.id}
                                    onClick={() => {
                                        setProfissionalId(p.id);
                                        irPara('horario');
                                    }}
                                    titulo={p.nome}
                                />
                            ))}
                        </div>
                    </Cartao>
                )}

                {passo === 'horario' && (
                    <Cartao>
                        <Titulo voltar={() => irPara(aptos.length > 1 ? 'profissional' : 'servicos')}>Dia e horário</Titulo>
                        <p className="-mt-2 mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            {escolhidos.map((s) => s.nome).join(', ')} · {formatarDuracaoMinutos(duracao)}
                            {escolhidos.length > 1 ? ' no total' : ''}. Só aparecem horários com tempo livre para tudo.{' '}
                            <button
                                type="button"
                                className="font-medium underline"
                                style={{ color: 'var(--copper)' }}
                                onClick={() => irPara('servicos')}
                            >
                                Alterar
                            </button>
                        </p>
                        <SeletorDia
                            dias={dias}
                            dia={dia}
                            onChange={(d) => {
                                setDia(d);
                                setHorario(null);
                                setErro('');
                            }}
                        />
                        <GradeHorarios
                            carregando={carregandoHorarios || (carregados !== chaveHorarios && !erro)}
                            livres={livres}
                            selecionado={horario}
                            onSelect={setHorario}
                        />

                        <Button className="mt-4" fullWidth disabled={!horario} onClick={() => seguirComSessao(sessao)}>
                            Continuar
                        </Button>
                    </Cartao>
                )}

                {passo === 'email' && (
                    <Cartao>
                        <Titulo voltar={() => irPara(destino === 'meus' ? 'servicos' : 'horario')}>Seu e-mail</Titulo>
                        <form
                            className="flex flex-col gap-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void pedirCodigo();
                            }}
                        >
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                {destino === 'meus' ? 'Use o e-mail com que você marcou. ' : ''}
                                Vamos mandar um código de 6 números para confirmar que é você. Sem senha.
                            </p>
                            <Input
                                id="portal-email"
                                label="E-mail"
                                type="email"
                                autoComplete="email"
                                inputMode="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <Button type="submit" disabled={ocupado || !email.includes('@')}>
                                {ocupado ? 'Enviando…' : 'Enviar código'}
                            </Button>
                        </form>
                    </Cartao>
                )}

                {passo === 'codigo' && (
                    <Cartao>
                        <Titulo voltar={() => irPara('email')}>Digite o código</Titulo>
                        <form
                            className="flex flex-col gap-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void entrar();
                            }}
                        >
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Mandamos para <strong style={{ color: 'var(--ink)' }}>{email.trim()}</strong>. Vale por 10
                                minutos. Não chegou? Olhe a caixa de spam.
                            </p>
                            <Input
                                id="portal-codigo"
                                label="Código"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                required
                                className="text-center text-xl tracking-[0.5em] tabular-nums"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            />
                            <Button type="submit" disabled={ocupado || codigo.length !== 6}>
                                {ocupado ? 'Entrando…' : 'Entrar'}
                            </Button>
                            <div className="flex flex-wrap justify-between gap-2 text-sm">
                                <button
                                    type="button"
                                    className="underline disabled:no-underline disabled:opacity-60"
                                    style={{ color: 'var(--muted-foreground)' }}
                                    disabled={ocupado || reenvioEm > 0}
                                    onClick={() => void pedirCodigo()}
                                >
                                    {reenvioEm > 0 ? `Reenviar em ${reenvioEm}s` : 'Reenviar código'}
                                </button>
                                <button
                                    type="button"
                                    className="underline"
                                    style={{ color: 'var(--muted-foreground)' }}
                                    onClick={() => irPara('email')}
                                >
                                    Trocar e-mail
                                </button>
                            </div>
                        </form>
                    </Cartao>
                )}

                {passo === 'cadastro' && (
                    <Cartao>
                        <Titulo voltar={() => irPara('horario')}>Seus dados</Titulo>
                        <form
                            className="flex flex-col gap-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void salvarCadastro();
                            }}
                        >
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Só na primeira vez. A empresa usa para falar com você sobre o horário.
                            </p>
                            <Input
                                id="portal-nome"
                                label="Nome"
                                autoComplete="name"
                                required
                                maxLength={120}
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                            />
                            <PhoneInput label="Telefone (WhatsApp)" required value={telefone} onChange={setTelefone} />
                            <Button
                                type="submit"
                                disabled={ocupado || nome.trim().length < 2 || !telefoneValido(telefone)}
                            >
                                {ocupado ? 'Salvando…' : 'Continuar'}
                            </Button>
                        </form>
                    </Cartao>
                )}

                {passo === 'confirmar' && (
                    <Cartao>
                        <Titulo voltar={() => irPara('horario')}>Confira e confirme</Titulo>
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* No celular a lista só abre por "Alterar"; no computador fica sempre à esquerda. */}
                            <div className={`flex-col gap-2 ${rascunho === null ? 'hidden md:flex' : 'flex'}`}>
                                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                    {t.servico.plural}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                    Toque para incluir ou tirar. O horário continua o mesmo se o novo tempo couber.
                                </p>
                                <EditarServicos
                                    pagina={pagina}
                                    ids={rascunho ?? servicoIds}
                                    alterado={rascunho !== null}
                                    inicio={horario?.inicio ?? null}
                                    horaInicio={horario?.hora ?? null}
                                    ocupado={ocupado}
                                    termoRecurso={minusculo(t.recurso)}
                                    onChange={setRascunho}
                                    onCancelar={() => setRascunho(null)}
                                    onAplicar={() => rascunho && void aplicarServicos(rascunho)}
                                />
                            </div>
                            <div className="flex min-w-0 flex-col gap-4">
                                {familia.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                            Para quem é?
                                        </p>
                                        <Opcao
                                            selecionado={paraId === null}
                                            onClick={() => setParaId(null)}
                                            titulo={sessao?.conta.nome ?? 'Para mim'}
                                            detalhe="Você"
                                        />
                                        {familia.map((p) => (
                                            <Opcao
                                                key={p.id}
                                                selecionado={paraId === p.id}
                                                onClick={() => setParaId(p.id)}
                                                titulo={p.nome}
                                                detalhe={p.parentesco ?? undefined}
                                            />
                                        ))}
                                    </div>
                                )}
                                {resumo}
                                {rascunho === null && (
                                    <button
                                        type="button"
                                        className="self-start text-sm font-medium underline md:hidden"
                                        style={{ color: 'var(--copper)' }}
                                        disabled={ocupado}
                                        onClick={() => {
                                            setRascunho(servicoIds);
                                            topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }}
                                    >
                                        Alterar {minusculo(t.servico, true)}
                                    </button>
                                )}
                                <Textarea
                                    id="portal-observacoes"
                                    label="Observações (opcional)"
                                    rows={2}
                                    maxLength={500}
                                    value={observacoes}
                                    onChange={(e) => setObservacoes(e.target.value)}
                                />
                                <Button disabled={ocupado || rascunho !== null} onClick={() => void confirmar()}>
                                    {ocupado && rascunho === null ? 'Confirmando…' : `Confirmar ${minusculo(t.agendamento)}`}
                                </Button>
                                {rascunho !== null && (
                                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                        Aplique ou cancele a troca de {minusculo(t.servico, true)} para confirmar.
                                    </p>
                                )}
                            </div>
                        </div>
                    </Cartao>
                )}

                {passo === 'feito' && feito && (
                    <Cartao>
                        <div className="flex flex-col gap-4">
                            <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--ok)' }}>
                                    {feito.status === 'confirmado' ? 'Horário marcado e confirmado!' : 'Horário marcado!'}
                                </p>
                                <h2 className="mt-1 font-display text-xl font-semibold first-letter:uppercase" style={{ color: 'var(--ink)' }}>
                                    {quando(feito.inicio, pagina.fusoHorario)}
                                </h2>
                            </div>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                                {feito.para && (
                                    <>
                                        <dt style={{ color: 'var(--muted-foreground)' }}>Para</dt>
                                        <dd style={{ color: 'var(--ink)' }}>{feito.para}</dd>
                                    </>
                                )}
                                <dt style={{ color: 'var(--muted-foreground)' }}>
                                    {feito.servicos.length > 1 ? t.servico.plural : t.servico.singular}
                                </dt>
                                <dd style={{ color: 'var(--ink)' }}>{feito.servicos.join(', ')}</dd>
                                <dt style={{ color: 'var(--muted-foreground)' }}>Com</dt>
                                <dd style={{ color: 'var(--ink)' }}>{feito.profissional}</dd>
                                {pagina.empresa.endereco && (
                                    <>
                                        <dt style={{ color: 'var(--muted-foreground)' }}>Onde</dt>
                                        <dd style={{ color: 'var(--ink)' }}>{pagina.empresa.endereco}</dd>
                                    </>
                                )}
                            </dl>
                            <AdicionarAgenda
                                evento={{
                                    cadeia: feito.id,
                                    inicio: feito.inicio,
                                    fim: feito.fim,
                                    servicos: feito.servicos,
                                    profissional: feito.profissional,
                                }}
                                empresa={pagina.empresa.nome}
                                local={pagina.empresa.endereco}
                            />
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {sessao?.conta.email ? `Se a empresa enviar avisos por e-mail, eles chegam em ${sessao.conta.email}. ` : ''}
                                {pagina.prazoAlteracaoHoras !== null
                                    ? 'Para remarcar ou cancelar, use "Meus horários".'
                                    : `Para remarcar ou cancelar, fale com ${pagina.empresa.nome}${pagina.empresa.telefone ? ` pelo ${pagina.empresa.telefone}` : ''}.`}
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button variant="secondary" className="flex-1" onClick={abrirMeus}>
                                    Meus horários
                                </Button>
                                <Button variant="secondary" className="flex-1" onClick={recomecar}>
                                    Marcar outro horário
                                </Button>
                            </div>
                        </div>
                    </Cartao>
                )}

                <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--faint)' }}>
                    Agendamento online por Lyra
                </p>
            </div>
        </div>
    );
}
