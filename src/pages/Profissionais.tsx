import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAbrirNovoDaQuery } from '@/lib/queryNovo';
import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';
import ExpedienteAgenda from '@/components/ExpedienteAgenda';
import { Alert, Badge, Button, Input, Modal, PhoneInput, Switch, Table } from '@/components/ui';
import { authService } from '@core/services';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import { somenteDigitos, telefoneValido } from '@/lib/telefone';
import { pessoaService, type Pessoa } from '@/services/pessoa.service';
import { perfilAcessoService, type PerfilAcesso } from '@/services/perfilAcesso.service';
import {
    profissionalService,
    type Intervalo,
    type Profissional,
    type SalvarProfissional,
} from '@/services/profissional.service';

const PAGE_SIZE = 10;
const DIAS = [
    { id: 1, label: 'Seg' },
    { id: 2, label: 'Ter' },
    { id: 3, label: 'Qua' },
    { id: 4, label: 'Qui' },
    { id: 5, label: 'Sex' },
    { id: 6, label: 'Sáb' },
    { id: 0, label: 'Dom' },
] as const;

const CORES = [
    { id: 'copper', label: 'Cobre' },
    { id: 'ember', label: 'Âmbar' },
    { id: 'ok', label: 'Verde' },
    { id: 'warn', label: 'Ouro' },
    { id: 'destructive', label: 'Vermelho' },
] as const;

type FiltroAtivo = 'todos' | 'ativos' | 'inativos';
type DiaForm = { ativo: boolean; inicio: string; fim: string };

const padraoDias = (): Record<number, DiaForm> => ({
    1: { ativo: true, inicio: '09:00', fim: '19:00' },
    2: { ativo: true, inicio: '09:00', fim: '19:00' },
    3: { ativo: true, inicio: '09:00', fim: '19:00' },
    4: { ativo: true, inicio: '09:00', fim: '19:00' },
    5: { ativo: true, inicio: '09:00', fim: '19:00' },
    6: { ativo: true, inicio: '09:00', fim: '19:00' },
    0: { ativo: false, inicio: '09:00', fim: '19:00' },
});

function intervalosParaDias(lista: Intervalo[]): Record<number, DiaForm> {
    const base = padraoDias();
    for (const d of Object.keys(base)) {
        base[Number(d)] = { ...base[Number(d)], ativo: false };
    }
    for (const i of lista) {
        base[i.diaSemana] = { ativo: true, inicio: i.inicio.slice(0, 5), fim: i.fim.slice(0, 5) };
    }
    return base;
}

function diasParaIntervalos(dias: Record<number, DiaForm>): Intervalo[] {
    return DIAS.filter((d) => dias[d.id]?.ativo).map((d) => ({
        diaSemana: d.id,
        inicio: dias[d.id].inicio,
        fim: dias[d.id].fim,
    }));
}

function resumoHorario(lista: Intervalo[]): string {
    if (!lista.length) return 'Sem expediente';
    const iguais = lista.every((i) => i.inicio === lista[0].inicio && i.fim === lista[0].fim);
    if (iguais && lista.length === 6 && !lista.some((i) => i.diaSemana === 0)) {
        return `Seg–Sáb ${lista[0].inicio.slice(0, 5)}–${lista[0].fim.slice(0, 5)}`;
    }
    return `${lista.length} dia${lista.length === 1 ? '' : 's'}`;
}

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
    const [dias, setDias] = useState<Record<number, DiaForm>>(padraoDias);
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
        diasParaIntervalos(dias).length > 0 &&
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
                setPerfis(lista);
                setPerfilId((atual) => {
                    if (atual !== '' && lista.some((p) => p.id === atual)) return atual;
                    if (editando) return atual;
                    const profissional = lista.find((p) => /^profissional$/i.test(p.nome));
                    const func = lista.find((p) => /funcion[aá]rio\s+lyra/i.test(p.nome));
                    return profissional?.id ?? func?.id ?? lista[0]?.id ?? '';
                });
                if (!lista.length) {
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

    const abrirNovo = () => {
        setEditando(null);
        setPessoaAtual(null);
        setNome('');
        setCpf('');
        setNascimento('');
        setTelefone('');
        setPodeLogar(false);
        setEmail('');
        setPerfilId('');
        setCor('copper');
        setAtivo(true);
        setDias(padraoDias());
        setFormErro('');
        setFormAberto(true);
    };

    useAbrirNovoDaQuery(!carregando, abrirNovo);

    const abrirEditar = async (p: Profissional) => {
        setEditando(p);
        setNome(p.nome);
        setCor(p.cor);
        setAtivo(p.ativo);
        setDias(intervalosParaDias(p.disponibilidades));
        setFormErro('');
        setFormAberto(true);
        if (p.pessoaId) {
            try {
                const pessoa = await pessoaService.obter(p.pessoaId);
                setPessoaAtual(pessoa);
                setNome(pessoa.nomeCompleto || p.nome);
                setCpf(pessoa.cpf ? formatarCpf(pessoa.cpf) : '');
                setNascimento(isoDate(pessoa.dataNascimento));
                setTelefone(pessoa.telefone ?? '');
                setPodeLogar(!!pessoa.podeLogar);
                setEmail(pessoa.emailLogin || pessoa.email || '');
                setPerfilId(pessoa.perfilAcessoId ?? '');
                if (pessoa.perfilAcessoId) {
                    setPerfis((lista) => {
                        if (lista.some((p) => p.id === pessoa.perfilAcessoId)) return lista;
                        return [
                            {
                                id: pessoa.perfilAcessoId,
                                nome: pessoa.perfilAcessoNome || `Perfil #${pessoa.perfilAcessoId}`,
                            },
                            ...lista,
                        ];
                    });
                }
            } catch {
                setPessoaAtual(null);
            }
        } else {
            setPessoaAtual(null);
            setCpf('');
            setNascimento('');
            setTelefone('');
            setPodeLogar(false);
            setEmail('');
        }
    };

    const payloadPessoa = (): Pessoa => {
        const emailLogin = email.trim();
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
            senha: podeLogar ? cpfDigitos : undefined,
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
            let pessoaId = editando?.pessoaId ?? 0;
            if (editando?.pessoaId) {
                await pessoaService.atualizar(editando.pessoaId, payloadPessoa(), empresaId || undefined);
                pessoaId = editando.pessoaId;
            } else {
                const pessoa = await pessoaService.criar(payloadPessoa(), empresaId || undefined);
                if (!pessoa.id) throw new Error('Core não devolveu o id da pessoa.');
                pessoaId = pessoa.id;
            }
            const payload: SalvarProfissional = {
                nome: nome.trim(),
                pessoaId,
                cor,
                ativo,
                disponibilidades: diasParaIntervalos(dias),
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
            titulo="Profissionais"
            subtitulo="Equipe"
            acoes={
                <Button size="sm" onClick={abrirNovo}>
                    Novo profissional
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
                            ? 'Nenhum profissional encontrado com esse filtro.'
                            : 'Nenhum profissional cadastrado. Use «Novo profissional» para começar.'}
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
                                        <Table.Cell>{resumoHorario(p.disponibilidades)}</Table.Cell>
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
                titulo={editando ? 'Editar profissional' : 'Novo profissional'}
                eyebrow="Equipe"
                subtitulo={
                    editando
                        ? 'Dados pessoais ficam em pessoas (ASC). Aqui, expediente e cor da agenda.'
                        : 'Cria a pessoa no ASC e o profissional no Lyra. Padrão: seg–sáb 09:00–19:00.'
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
                        onChange={(v) => setPodeLogar(v)}
                        label="Pode fazer login"
                        descricao="Igual ao ASC: e-mail + perfil. A senha inicial é o CPF (só números)."
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
