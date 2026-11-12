import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Alert, Button, Input, PhoneInput, Textarea } from '@/components/ui';
import { mensagemErroHttp } from '@/exceptions';
import { formatarDuracaoMinutos } from '@/lib/agenda';
import { telefoneValido } from '@/lib/telefone';
import type { Termo } from '@/services/configuracao.service';
import {
    portalService,
    salvarSessao,
    sessaoSalva,
    type AgendamentoPortal,
    type HorariosPortal,
    type PaginaPortal,
    type SessaoCliente,
} from '@/services/portal.service';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DIAS_VISIVEIS = 60;
const ESPERA_REENVIO = 30;

type Passo = 'servicos' | 'profissional' | 'horario' | 'email' | 'codigo' | 'cadastro' | 'confirmar' | 'feito';

interface Horario {
    inicio: string;
    hora: string;
}

const minusculo = (t: Termo, plural = false) => (plural ? t.plural : t.singular).toLocaleLowerCase('pt-BR');
const artigo = (t: Termo) => (t.genero === 'f' ? 'a' : 'o');

function hojeNoFuso(fuso: string): string {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
            new Date(),
        );
    } catch {
        return new Date().toISOString().slice(0, 10);
    }
}

function somarDias(dia: string, n: number): string {
    const d = new Date(`${dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

function rotuloDia(dia: string) {
    const d = new Date(`${dia}T12:00:00Z`);
    return {
        semana: new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(d).replace('.', ''),
        numero: d.getUTCDate(),
        mes: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(d).replace('.', ''),
    };
}

function quando(iso: string, fuso: string): string {
    const opcoes: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
    };
    try {
        return new Intl.DateTimeFormat('pt-BR', { ...opcoes, timeZone: fuso }).format(new Date(iso));
    } catch {
        return new Intl.DateTimeFormat('pt-BR', opcoes).format(new Date(iso));
    }
}

function Cartao({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-lyra border p-5 sm:p-6" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            {children}
        </div>
    );
}

function Titulo({ children, voltar }: { children: ReactNode; voltar?: () => void }) {
    return (
        <div className="mb-4 flex items-center gap-2">
            {voltar && (
                <button
                    type="button"
                    onClick={voltar}
                    aria-label="Voltar"
                    className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ color: 'var(--muted-foreground)' }}
                >
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                </button>
            )}
            <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                {children}
            </h2>
        </div>
    );
}

function Opcao({
    selecionado,
    onClick,
    titulo,
    detalhe,
    lateral,
}: {
    selecionado: boolean;
    onClick: () => void;
    titulo: string;
    detalhe?: string;
    lateral?: string;
}) {
    return (
        <button
            type="button"
            aria-pressed={selecionado}
            onClick={onClick}
            className="flex w-full items-center justify-between gap-3 rounded-lyra border px-4 py-3 text-left transition-colors"
            style={{
                borderColor: selecionado ? 'var(--copper)' : 'var(--line)',
                background: selecionado ? 'color-mix(in oklab, var(--copper) 10%, var(--panel))' : 'var(--card)',
            }}
        >
            <span className="min-w-0">
                <span className="block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {titulo}
                </span>
                {detalhe && (
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {detalhe}
                    </span>
                )}
            </span>
            {lateral && (
                <span className="shrink-0 text-sm tabular-nums" style={{ color: 'var(--ink)' }}>
                    {lateral}
                </span>
            )}
        </button>
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
    const topo = useRef<HTMLDivElement>(null);

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

    const livres: Horario[] = useMemo(() => {
        if (!horarios) return [];
        const porInicio = new Map<string, Horario>();
        horarios.profissionais
            .filter((p) => profissionalId === null || p.profissionalId === profissionalId)
            .flatMap((p) => p.horarios)
            .forEach((h) => porInicio.set(h.inicio, h));
        return [...porInicio.values()].sort((a, b) => a.inicio.localeCompare(b.inicio));
    }, [horarios, profissionalId]);

    const sair = () => {
        salvarSessao(null);
        setSessao(null);
    };

    /** Depois do horário: entra se precisar, completa o cadastro se faltar, e confirma. */
    const seguirComSessao = (s: SessaoCliente | null) => {
        if (!s) {
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

    const sessaoCaiu = (e: unknown) => {
        if (axios.isAxiosError(e) && e.response?.status === 401) {
            sair();
            setPasso('email');
            setErro('Sua sessão expirou. Entre de novo com o código.');
            return true;
        }
        return false;
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
            seguirComSessao(s);
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

    const recomecar = () => {
        setServicoIds([]);
        setProfissionalId(null);
        setHorario(null);
        setObservacoes('');
        setFeito(null);
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
            <dt style={{ color: 'var(--muted-foreground)' }}>{t.servico.singular}</dt>
            <dd style={{ color: 'var(--ink)' }}>{escolhidos.map((s) => s.nome).join(', ')}</dd>
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
            <dd style={{ color: 'var(--ink)' }}>{formatarDuracaoMinutos(duracao)}</dd>
            {preco > 0 && (
                <>
                    <dt style={{ color: 'var(--muted-foreground)' }}>Valor</dt>
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
            <div ref={topo} className="mx-auto flex w-full max-w-xl scroll-mt-4 flex-col gap-4">
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

                {sessao && passo !== 'email' && passo !== 'codigo' && (
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Entrou como {sessao.conta.email} ·{' '}
                        <button type="button" className="underline" onClick={sair}>
                            sair
                        </button>
                    </p>
                )}

                {erro && <Alert titulo="Atenção">{erro}</Alert>}

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
                                    Pode escolher mais de um.
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
                        <div
                            className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2"
                            style={{ scrollbarWidth: 'thin' }}
                            role="listbox"
                            aria-label="Dia"
                        >
                            {dias.map((d) => {
                                const r = rotuloDia(d);
                                const ativo = d === dia;
                                return (
                                    <button
                                        key={d}
                                        type="button"
                                        role="option"
                                        aria-selected={ativo}
                                        onClick={() => {
                                            setDia(d);
                                            setHorario(null);
                                            setErro('');
                                        }}
                                        className="flex w-14 shrink-0 flex-col items-center rounded-lyra border py-2"
                                        style={{
                                            borderColor: ativo ? 'var(--copper)' : 'var(--line)',
                                            background: ativo ? 'var(--copper)' : 'var(--card)',
                                            color: ativo ? '#fff' : 'var(--ink)',
                                        }}
                                    >
                                        <span className="text-[11px] uppercase">{r.semana}</span>
                                        <span className="text-lg font-semibold leading-tight">{r.numero}</span>
                                        <span className="text-[11px]">{r.mes}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {carregandoHorarios || (carregados !== chaveHorarios && !erro) ? (
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Buscando horários…
                            </p>
                        ) : livres.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Sem horários livres neste dia. Tente outro.
                            </p>
                        ) : (
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                                {livres.map((h) => {
                                    const ativo = horario?.inicio === h.inicio;
                                    return (
                                        <button
                                            key={h.inicio}
                                            type="button"
                                            aria-pressed={ativo}
                                            onClick={() => setHorario(h)}
                                            className="rounded-lyra border py-2 text-sm font-medium tabular-nums"
                                            style={{
                                                borderColor: ativo ? 'var(--copper)' : 'var(--line)',
                                                background: ativo ? 'var(--copper)' : 'var(--card)',
                                                color: ativo ? '#fff' : 'var(--ink)',
                                            }}
                                        >
                                            {h.hora}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <Button className="mt-4" fullWidth disabled={!horario} onClick={() => seguirComSessao(sessao)}>
                            Continuar
                        </Button>
                    </Cartao>
                )}

                {passo === 'email' && (
                    <Cartao>
                        <Titulo voltar={() => irPara('horario')}>Seu e-mail</Titulo>
                        <form
                            className="flex flex-col gap-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void pedirCodigo();
                            }}
                        >
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
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
                        <div className="flex flex-col gap-4">
                            {resumo}
                            <Textarea
                                id="portal-observacoes"
                                label="Observações (opcional)"
                                rows={2}
                                maxLength={500}
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                            />
                            <Button disabled={ocupado} onClick={() => void confirmar()}>
                                {ocupado ? 'Confirmando…' : `Confirmar ${minusculo(t.agendamento)}`}
                            </Button>
                        </div>
                    </Cartao>
                )}

                {passo === 'feito' && feito && (
                    <Cartao>
                        <div className="flex flex-col gap-4">
                            <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--ok)' }}>
                                    Horário marcado!
                                </p>
                                <h2 className="mt-1 font-display text-xl font-semibold first-letter:uppercase" style={{ color: 'var(--ink)' }}>
                                    {quando(feito.inicio, pagina.fusoHorario)}
                                </h2>
                            </div>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                                <dt style={{ color: 'var(--muted-foreground)' }}>{t.servico.singular}</dt>
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
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {sessao?.conta.email ? `Se a empresa enviar avisos por e-mail, eles chegam em ${sessao.conta.email}. ` : ''}
                                Para remarcar ou cancelar, fale com {pagina.empresa.nome}
                                {pagina.empresa.telefone ? ` pelo ${pagina.empresa.telefone}` : ''}.
                            </p>
                            <Button variant="secondary" onClick={recomecar}>
                                Marcar outro horário
                            </Button>
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
