import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAbrirNovoDaQuery } from '@/lib/queryNovo';
import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';
import ExpedienteAgenda, {
    erroExpediente,
    expedienteDeIntervalos,
    expedientePadrao,
    intervalosDoExpediente,
    resumoExpediente,
    type ExpedienteDia,
} from '@/components/ExpedienteAgenda';
import { Alert, Badge, Button, Input, Modal, PhoneInput, Switch, Table } from '@/components/ui';
import { authService } from '@core/services';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import { somenteDigitos, telefoneValido } from '@/lib/telefone';
import { pessoaService, type Pessoa } from '@/services/pessoa.service';
import { perfilAcessoService, ehClienteAdmin, ehFuncionarioLyra, type PerfilAcesso } from '@/services/perfilAcesso.service';
import {
    profissionalService,
    type Profissional,
    type SalvarProfissional,
} from '@/services/profissional.service';
import { useTermos } from '@/contexts/TermosContext';

const PAGE_SIZE = 10;
const CORES = [
    { id: 'copper', label: 'Cobre' },
    { id: 'ember', label: 'Âmbar' },
    { id: 'ok', label: 'Verde' },
    { id: 'warn', label: 'Ouro' },
    { id: 'destructive', label: 'Vermelho' },
] as const;

type FiltroAtivo = 'todos' | 'ativos' | 'inativos';
function formatarCpf(digits: string): string {
    const d = somenteDigitos(digits).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function validarCpf(cpf: string): boolean {
    const n = somenteDigitos(cpf);
    if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
    let soma = 0;
    for (let i = 1; i <= 9; i++) soma += Number(n[i - 1]) * (11 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== Number(n[9])) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += Number(n[i - 1]) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === Number(n[10]);
}

function isoDate(valor?: string): string {
    if (!valor) return '';
    return valor.slice(0, 10);
}

export default function ProfissionaisPage() {
    const termos = useTermos();
    const empresaId = Number(authService.getStoredUserInfo()?.empresaId || 0);
    const [itens, setItens] = useState<Profissional[]>([]);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(1);
    const [busca, setBusca] = useState('');
    const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>('todos');
    const [carregando, setCarregando] = useState(true);
    const [erroLista, setErroLista] = useState('');
    const [formAberto, setFormAberto] = useState(false);
    const [editando, setEditando] = useState<Profissional | null>(null);
    const [pessoaAtual, setPessoaAtual] = useState<Pessoa | null>(null);
    const [carregandoPessoa, setCarregandoPessoa] = useState(false);
    const [erroPessoa, setErroPessoa] = useState('');
    /** Pessoa criada no Core numa tentativa que falhou no Lyra: a próxima tentativa reaproveita. */
    const [pessoaCriadaId, setPessoaCriadaId] = useState<number | null>(null);
    const pedidoPessoa = useRef(0);
    const [nome, setNome] = useState('');
    const [cpf, setCpf] = useState('');
    const [nascimento, setNascimento] = useState('');
    const [telefone, setTelefone] = useState('');
    const [podeLogar, setPodeLogar] = useState(false);
    const [email, setEmail] = useState('');
    const [perfilId, setPerfilId] = useState<number | ''>('');
    const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
    const [perfisErro, setPerfisErro] = useState('');
    const [cor, setCor] = useState('copper');
    const [ativo, setAtivo] = useState(true);
    const [dias, setDias] = useState<Record<number, ExpedienteDia>>(expedientePadrao);
    const [formErro, setFormErro] = useState('');
    const [salvando, setSalvando] = useState(false);

    const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const cpfDigitos = somenteDigitos(cpf);
    const telDigitos = somenteDigitos(telefone);
    const loginOk = !podeLogar || (email.trim().includes('@') && typeof perfilId === 'number');
    const podeSalvar =
        nome.trim().length > 0 &&
        validarCpf(cpf) &&
        nascimento.length > 0 &&
        telefoneValido(telefone) &&
        intervalosDoExpediente(dias).length > 0 &&
        !erroExpediente(dias) &&
        !carregandoPessoa &&
        !erroPessoa &&
        loginOk;

    const carregar = useCallback(async () => {
        setCarregando(true);
        setErroLista('');
        try {
            const data = await profissionalService.listar({
                search: busca.trim() || undefined,
                ativo: filtroAtivo === 'todos' ? undefined : filtroAtivo === 'ativos',
                page: pagina,
                pageSize: PAGE_SIZE,
            });
            const ultima = Math.max(1, Math.ceil(data.total / data.pageSize));
            if (data.items.length === 0 && data.total > 0 && pagina > ultima) {
                setPagina(ultima);
                return;
            }
            setItens(data.items);
            setTotal(data.total);
        } catch (e) {
            setErroLista(mensagemErroHttp(e));
            setItens([]);
            setTotal(0);
        } finally {
            setCarregando(false);
        }
    }, [busca, filtroAtivo, pagina]);

    useEffect(() => {
        void carregar();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- busca só recarrega no Filtrar
    }, [pagina, filtroAtivo]);

    useEffect(() => {
        if (!formAberto) return;
        setPerfisErro('');
        void perfilAcessoService
            .listarLyra(empresaId || undefined)
            .then((lista) => {
                const equipe = lista.filter((p) => !ehClienteAdmin(p.nome));
                setPerfis(equipe);
                setPerfilId((atual) => {
                    if (atual !== '' && equipe.some((p) => p.id === atual)) return atual;
                    if (editando) return atual;
                    const func = equipe.find((p) => ehFuncionarioLyra(p.nome));
                    return func?.id ?? equipe[0]?.id ?? '';
                });
                if (!equipe.length) {
                    setPerfisErro('Nenhum perfil Lyra encontrado para esta empresa.');
                }
            })
            .catch((e) => {
                setPerfis([]);
                setPerfisErro(mensagemErroHttp(e));
            });
    }, [formAberto, empresaId, editando]);

    const fecharForm = () => {
        if (salvando) return;
        setFormAberto(false);
    };

    const limparPessoa = () => {
        pedidoPessoa.current += 1;
        setPessoaAtual(null);
        setCarregandoPessoa(false);
        setErroPessoa('');
        setPessoaCriadaId(null);
        setCpf('');
        setNascimento('');
        setTelefone('');
        setPodeLogar(false);
        setEmail('');
        setPerfilId('');
    };

    const abrirNovo = () => {
        setEditando(null);
        limparPessoa();
        setNome('');
        setCor('copper');
        setAtivo(true);
        setDias(expedientePadrao());
        setFormErro('');
        setFormAberto(true);
    };

    useAbrirNovoDaQuery(!carregando, abrirNovo);

    const abrirEditar = async (p: Profissional) => {
        limparPessoa();
        setEditando(p);
        setNome(p.nome);
        setCor(p.cor);
        setAtivo(p.ativo);
        setDias(expedienteDeIntervalos(p.disponibilidades));
        setFormErro('');
        setFormAberto(true);
        if (p.pessoaId) {
            const pedido = pedidoPessoa.current;
            setCarregandoPessoa(true);
            try {
                const pessoa = await pessoaService.obter(p.pessoaId);
                if (pedido !== pedidoPessoa.current) return;
                setPessoaAtual(pessoa);
                setNome(pessoa.nomeCompleto || p.nome);
                setCpf(pessoa.cpf ? formatarCpf(pessoa.cpf) : '');
                setNascimento(isoDate(pessoa.dataNascimento));
                setTelefone(pessoa.telefone ?? '');
                setPodeLogar(!!pessoa.podeLogar);
                setEmail(pessoa.emailLogin || pessoa.email || '');
                setPerfilId(pessoa.perfilAcessoId ?? '');
                const perfilDaPessoa = pessoa.perfilAcessoId;
                if (perfilDaPessoa) {
                    setPerfis((lista) => {
                        if (lista.some((p) => p.id === perfilDaPessoa)) return lista;
                        return [
                            {
                                id: perfilDaPessoa,
                                nome: pessoa.perfilAcessoNome || `Perfil #${perfilDaPessoa}`,
                            },
                            ...lista,
                        ];
                    });
                }
            } catch (e) {
                if (pedido !== pedidoPessoa.current) return;
                setErroPessoa(`Não foi possível carregar os dados pessoais (${mensagemErroHttp(e)}). Feche e abra de novo para editar.`);
            } finally {
                if (pedido === pedidoPessoa.current) setCarregandoPessoa(false);
            }
        }
    };

    const payloadPessoa = (): Pessoa => {
        const emailLogin = email.trim();
        // Senha inicial = CPF só quando o login nasce agora; reenviar redefiniria a senha da pessoa.
        const loginNovo = podeLogar && !pessoaAtual?.podeLogar;
        return {
            ...pessoaAtual,
            nomeCompleto: nome.trim(),
            cpf: cpfDigitos,
            telefone: telDigitos,
            dataNascimento: nascimento,
            email: emailLogin || undefined,
            emailLogin: podeLogar ? emailLogin : undefined,
            podeLogar: podeLogar && !!emailLogin,
            estaAtivo: true,
            perfilAcessoId: podeLogar && typeof perfilId === 'number' ? perfilId : undefined,
            senha: loginNovo ? cpfDigitos : undefined,
        };
    };

    const salvar = async () => {
        if (!podeSalvar) {
            setFormErro('Preencha nome, CPF válido, nascimento, telefone e expediente.');
            return;
        }
        if (podeLogar && !email.trim().includes('@')) {
            setFormErro('Informe um e-mail para o login.');
            return;
        }
        if (podeLogar && typeof perfilId !== 'number') {
            setFormErro('Selecione o perfil de acesso.');
            return;
        }
        setSalvando(true);
        setFormErro('');
        try {
            let pessoaId = editando?.pessoaId ?? pessoaCriadaId ?? 0;
            if (pessoaId) {
                await pessoaService.atualizar(pessoaId, payloadPessoa(), empresaId || undefined);
            } else {
                const pessoa = await pessoaService.criar(payloadPessoa(), empresaId || undefined);
                if (!pessoa.id) throw new Error('Core não devolveu o id da pessoa.');
                pessoaId = pessoa.id;
                setPessoaCriadaId(pessoa.id);
            }
            const payload: SalvarProfissional = {
                nome: nome.trim(),
                pessoaId,
                cor,
                ativo,
                disponibilidades: intervalosDoExpediente(dias),
            };
            if (editando) {
                await profissionalService.atualizar(editando.id, payload);
            } else {
                await profissionalService.criar(payload);
            }
            setFormAberto(false);
            if (!editando && pagina !== 1) setPagina(1);
            else await carregar();
        } catch (e) {
            setFormErro(mensagemErroHttp(e));
        } finally {
            setSalvando(false);
        }
    };

    const alternarAtivo = async (p: Profissional) => {
        setErroLista('');
        try {
            await profissionalService.alterarAtivo(p.id, !p.ativo);
            await carregar();
        } catch (e) {
            setErroLista(mensagemErroHttp(e));
        }
    };

    const aplicarFiltro = () => {
        if (pagina !== 1) setPagina(1);
        else void carregar();
    };

    const vazioLista = useMemo(
        () => !carregando && itens.length === 0 && !erroLista,
        [carregando, itens.length, erroLista]
    );

    const de = total === 0 ? 0 : (pagina - 1) * PAGE_SIZE + 1;
    const ate = Math.min(pagina * PAGE_SIZE, total);
    const hoje = new Date().toISOString().slice(0, 10);

    return (
        <PageLayout
            titulo={termos.recurso.plural}
            subtitulo="Equipe"
            acoes={
                <Button size="sm" onClick={abrirNovo}>
                    {termos.novo('recurso')}
                </Button>
            }
        >
            <PageCard>
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                    <Input
                        label="Buscar"
                        placeholder="Nome"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') aplicarFiltro();
                        }}
                    />
                    <Button variant="secondary" onClick={aplicarFiltro}>
                        Filtrar
                    </Button>
                    <div className="flex flex-wrap gap-2">
                        {([
                            ['todos', 'Todos'],
                            ['ativos', 'Ativos'],
                            ['inativos', 'Inativos'],
                        ] as const).map(([id, label]) => (
                            <Button
                                key={id}
                                size="sm"
                                variant={filtroAtivo === id ? 'primary' : 'secondary'}
                                onClick={() => {
                                    setFiltroAtivo(id);
                                    setPagina(1);
                                }}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>

                {erroLista && (
                    <div className="mb-4">
                        <Alert titulo={tituloDeMensagem(erroLista)}>{erroLista}</Alert>
                    </div>
                )}

                {carregando && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Carregando equipe…
                    </p>
                )}

                {vazioLista && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        {busca.trim() || filtroAtivo !== 'todos'
                            ? `${termos.nenhum('recurso')} ${termos.adj('recurso', 'encontrado')} com esse filtro.`
                            : `${termos.nenhum('recurso')} ${termos.adj('recurso', 'cadastrado')}. Use «${termos.novo('recurso')}» para começar.`}
                    </p>
                )}

                {!carregando && itens.length > 0 && (
                    <>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Cell>Nome</Table.Cell>
                                    <Table.Cell>Expediente</Table.Cell>
                                    <Table.Cell>Status</Table.Cell>
                                    <Table.Cell></Table.Cell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {itens.map((p) => (
                                    <Table.Row key={p.id} className={p.ativo ? '' : 'opacity-60'}>
                                        <Table.Cell>
                                            <span className="inline-flex items-center gap-2 font-medium" style={{ color: 'var(--ink)' }}>
                                                <span
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{ background: `var(--${p.cor})` }}
                                                    aria-hidden
                                                />
                                                {p.nome}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>{resumoExpediente(p.disponibilidades)}</Table.Cell>
                                        <Table.Cell>
                                            <Badge variant={p.ativo ? 'ok' : 'faint'} size="sm">
                                                {p.ativo ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => void abrirEditar(p)}>
                                                    Editar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={p.ativo ? 'ghost' : 'secondary'}
                                                    onClick={() => void alternarAtivo(p)}
                                                >
                                                    {p.ativo ? 'Desativar' : 'Ativar'}
                                                </Button>
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {de}–{ate} de {total}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={pagina <= 1}
                                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                                >
                                    Anterior
                                </Button>
                                <span className="text-sm tabular-nums" style={{ color: 'var(--ink)' }}>
                                    {pagina} / {totalPaginas}
                                </span>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={pagina >= totalPaginas}
                                    onClick={() => setPagina((p) => p + 1)}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </PageCard>

            <Modal
                aberto={formAberto}
                titulo={editando ? termos.editar('recurso') : termos.novo('recurso')}
                eyebrow="Equipe"
                subtitulo={
                    editando
                        ? 'Dados pessoais ficam na ficha da pessoa. Aqui, expediente e cor da agenda.'
                        : `Cria a pessoa e o cadastro de ${termos.um('recurso')} no Lyra. Padrão: seg–sáb 09:00–19:00.`
                }
                variante="lateral"
                largura="34rem"
                onClose={fecharForm}
                rodape={
                    <>
                        <Button variant="ghost" onClick={fecharForm} disabled={salvando}>
                            Cancelar
                        </Button>
                        <Button onClick={() => void salvar()} disabled={salvando || !podeSalvar}>
                            {salvando ? 'Salvando…' : 'Salvar'}
                        </Button>
                    </>
                }
            >
                {carregandoPessoa && (
                    <p className="mb-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Carregando dados pessoais…
                    </p>
                )}
                {erroPessoa && (
                    <div className="mb-3">
                        <Alert titulo="Dados pessoais">{erroPessoa}</Alert>
                    </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                    <Input
                        label="CPF"
                        required
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e) => setCpf(formatarCpf(e.target.value))}
                        error={cpfDigitos.length === 11 && !validarCpf(cpf) ? 'CPF inválido' : undefined}
                    />
                    <Input
                        label="Data de nascimento"
                        required
                        type="date"
                        max={hoje}
                        value={nascimento}
                        onChange={(e) => setNascimento(e.target.value)}
                    />
                    <PhoneInput
                        label="Telefone"
                        required
                        value={telefone}
                        onChange={setTelefone}
                    />
                </div>
                <div className="mt-5">
                    <Switch
                        checked={podeLogar}
                        onChange={(v) => {
                            setPodeLogar(v);
                            if (v) {
                                setPerfilId((atual) => {
                                    if (atual !== '') return atual;
                                    const func = perfis.find((p) => ehFuncionarioLyra(p.nome));
                                    return func?.id ?? '';
                                });
                            }
                        }}
                        label="Pode fazer login"
                        descricao="E-mail + perfil Lyra. Senha inicial = CPF (só números); no primeiro acesso o Lyra pede outra."
                    />
                </div>
                {podeLogar && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Input
                            label="E-mail de login"
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <div className="w-full">
                            <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                Perfil de acesso <span style={{ color: 'var(--destructive)' }}>*</span>
                            </label>
                            <select
                                className="lyra-input"
                                value={perfilId}
                                onChange={(e) => setPerfilId(e.target.value ? Number(e.target.value) : '')}
                            >
                                <option value="">Selecione</option>
                                {perfis.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.nome}
                                    </option>
                                ))}
                            </select>
                            {perfisErro && (
                                <p className="mt-1.5 text-xs" style={{ color: 'var(--destructive)' }} role="alert">
                                    {perfisErro}
                                </p>
                            )}
                        </div>
                    </div>
                )}
                <div className="mt-5">
                    <p className="mb-1.5 text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        Cor na agenda
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {CORES.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
                                style={{
                                    border: `1px solid ${cor === c.id ? 'var(--ring)' : 'var(--line)'}`,
                                    background: cor === c.id ? 'color-mix(in oklab, var(--copper) 14%, transparent)' : 'var(--card)',
                                    color: 'var(--ink)',
                                }}
                                onClick={() => setCor(c.id)}
                            >
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--${c.id})` }} />
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
                <ExpedienteAgenda
                    key={editando?.id ?? 'novo'}
                    dias={dias}
                    onChange={setDias}
                    cor={cor}
                />
                <div className="mt-5">
                    <Switch
                        checked={ativo}
                        onChange={setAtivo}
                        label="Ativo na agenda"
                        descricao="Inativos continuam na lista e podem ser editados."
                    />
                </div>
                {formErro && (
                    <div className="mt-3">
                        <Alert titulo={tituloDeMensagem(formErro)}>{formErro}</Alert>
                    </div>
                )}
            </Modal>
        </PageLayout>
    );
}
