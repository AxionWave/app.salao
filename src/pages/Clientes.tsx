import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAbrirNovoDaQuery } from '@/lib/queryNovo';
import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';
import { Alert, Badge, Button, Input, Modal, PhoneInput, Switch, Table, Textarea } from '@/components/ui';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import { formatarTelefoneExibicao, telefoneValido } from '@/lib/telefone';
import { clienteService, type Cliente, type SalvarCliente } from '@/services/cliente.service';

const PAGE_SIZE = 10;

type FiltroAtivo = 'todos' | 'ativos' | 'inativos';

const vazio: SalvarCliente = {
    nome: '',
    telefone: '',
    email: '',
    observacoes: '',
    ativo: true,
};

export default function ClientesPage() {
    const [itens, setItens] = useState<Cliente[]>([]);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(1);
    const [busca, setBusca] = useState('');
    const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>('todos');
    const [carregando, setCarregando] = useState(true);
    const [erroLista, setErroLista] = useState('');
    const [formAberto, setFormAberto] = useState(false);
    const [editando, setEditando] = useState<Cliente | null>(null);
    const [form, setForm] = useState<SalvarCliente>(vazio);
    const [formErro, setFormErro] = useState('');
    const [salvando, setSalvando] = useState(false);

    const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const podeSalvar = form.nome.trim().length > 0 && telefoneValido(form.telefone);

    const carregar = useCallback(async () => {
        setCarregando(true);
        setErroLista('');
        try {
            const data = await clienteService.listar({
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

    const fecharForm = () => {
        if (salvando) return;
        setFormAberto(false);
    };

    const abrirNovo = () => {
        setEditando(null);
        setForm({ ...vazio });
        setFormErro('');
        setFormAberto(true);
    };

    useAbrirNovoDaQuery(!carregando, abrirNovo);

    const abrirEditar = (c: Cliente) => {
        setEditando(c);
        setForm({
            nome: c.nome,
            telefone: c.telefone,
            email: c.email ?? '',
            observacoes: c.observacoes ?? '',
            ativo: c.ativo,
        });
        setFormErro('');
        setFormAberto(true);
    };

    const salvar = async () => {
        if (!podeSalvar) {
            setFormErro('Preencha nome e um telefone válido.');
            return;
        }
        setSalvando(true);
        setFormErro('');
        const payload: SalvarCliente = {
            nome: form.nome.trim(),
            telefone: form.telefone,
            email: form.email?.trim() || null,
            observacoes: form.observacoes?.trim() || null,
            ativo: form.ativo,
        };
        try {
            if (editando) {
                await clienteService.atualizar(editando.id, payload);
                setFormAberto(false);
                await carregar();
            } else {
                await clienteService.criar(payload);
                setFormAberto(false);
                if (pagina !== 1) setPagina(1);
                else await carregar();
            }
        } catch (e) {
            setFormErro(mensagemErroHttp(e));
        } finally {
            setSalvando(false);
        }
    };

    const alternarAtivo = async (c: Cliente) => {
        setErroLista('');
        try {
            await clienteService.alterarAtivo(c.id, !c.ativo);
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

    return (
        <PageLayout
            titulo="Clientes"
            subtitulo="Fichas do salão"
            acoes={
                <Button size="sm" onClick={abrirNovo}>
                    Novo cliente
                </Button>
            }
        >
            <PageCard>
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                    <Input
                        label="Buscar"
                        placeholder="Nome ou telefone"
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
                        Carregando fichas…
                    </p>
                )}

                {vazioLista && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        {busca.trim() || filtroAtivo !== 'todos'
                            ? 'Nenhum cliente encontrado com esse filtro.'
                            : 'Nenhuma ficha cadastrada. Use «Novo cliente» para começar.'}
                    </p>
                )}

                {!carregando && itens.length > 0 && (
                    <>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Cell>Nome</Table.Cell>
                                    <Table.Cell>Telefone</Table.Cell>
                                    <Table.Cell>E-mail</Table.Cell>
                                    <Table.Cell>Status</Table.Cell>
                                    <Table.Cell></Table.Cell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {itens.map((c) => (
                                    <Table.Row key={c.id} className={c.ativo ? '' : 'opacity-60'}>
                                        <Table.Cell>
                                            <span className="font-medium" style={{ color: 'var(--ink)' }}>
                                                {c.nome}
                                            </span>
                                            {c.observacoes ? (
                                                <p className="mt-0.5 max-w-xs truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                    {c.observacoes}
                                                </p>
                                            ) : null}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="tabular-nums">{formatarTelefoneExibicao(c.telefone)}</span>
                                        </Table.Cell>
                                        <Table.Cell>{c.email || '—'}</Table.Cell>
                                        <Table.Cell>
                                            <Badge variant={c.ativo ? 'ok' : 'faint'} size="sm">
                                                {c.ativo ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => abrirEditar(c)}>
                                                    Editar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={c.ativo ? 'ghost' : 'secondary'}
                                                    onClick={() => void alternarAtivo(c)}
                                                >
                                                    {c.ativo ? 'Desativar' : 'Ativar'}
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
                titulo={editando ? 'Editar cliente' : 'Novo cliente'}
                eyebrow="Ficha"
                subtitulo={
                    editando
                        ? 'Altere contato ou observações. Ficha inativa continua editável.'
                        : 'Quem o salão atende. Telefone único por empresa.'
                }
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
                    <Input
                        label="Nome"
                        required
                        value={form.nome}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    />
                    <PhoneInput
                        label="Telefone"
                        required
                        value={form.telefone}
                        onChange={(telefone) => setForm((f) => ({ ...f, telefone }))}
                    />
                    <div className="sm:col-span-2">
                        <Input
                            label="E-mail"
                            type="email"
                            placeholder="Opcional"
                            value={form.email ?? ''}
                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <Textarea
                        label="Observações"
                        placeholder="Alergias, preferências, recados…"
                        value={form.observacoes ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                    />
                </div>
                <div className="mt-5">
                    <Switch
                        checked={form.ativo}
                        onChange={(ativo) => setForm((f) => ({ ...f, ativo }))}
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
