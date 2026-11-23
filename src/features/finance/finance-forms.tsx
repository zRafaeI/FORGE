"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { FinancialGoal, MoneyFlow, Transaction } from "@/lib/domain/types";
import { categoryInputSchema, fieldErrors, goalInputSchema, transactionInputSchema } from "@/lib/domain/schemas";
import {
  addCategory,
  addContribution,
  addGoal,
  addTransaction,
  deleteCategory,
  renameCategory,
  setOpeningBalance,
  updateGoal,
  updateTransaction,
} from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { centsToInput, formatMoney, goalSaved, parseMoney } from "@/lib/logic/finance";
import { Dialog } from "@/components/ui/dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Segmented, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";

const moneyError = (v: number | undefined) =>
  v === undefined ? "Informe o valor." : Number.isNaN(v) ? "Use o formato 49,90 ou 1.234,56." : v <= 0 ? "O valor precisa ser maior que zero." : null;

/* ---------- Lançamento ---------- */

export function TransactionDialog({
  open,
  onClose,
  transaction,
  initialFlow,
  today,
}: {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction;
  initialFlow?: MoneyFlow;
  today: string;
}) {
  const { data, update } = useForge();
  const toast = useToast();
  const [flow, setFlow] = useState<MoneyFlow>("despesa");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const categories = data.finance.categories.filter((c) => c.flow === flow);

  useEffect(() => {
    if (!open) return;
    const f = transaction?.flow ?? initialFlow ?? "despesa";
    setFlow(f);
    setAmount(centsToInput(transaction?.amountCents));
    setDate(transaction?.date ?? today);
    setCategoryId(transaction?.categoryId ?? data.finance.categories.find((c) => c.flow === f)?.id ?? "");
    setDescription(transaction?.description ?? "");
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id, initialFlow]);

  function changeFlow(f: MoneyFlow) {
    setFlow(f);
    setCategoryId(data.finance.categories.find((c) => c.flow === f)?.id ?? "");
  }

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const cents = parseMoney(amount);
    const mErr = moneyError(cents);
    const r = transactionInputSchema.safeParse({
      date,
      flow,
      amountCents: mErr ? undefined : cents,
      categoryId,
      description: description.trim() || undefined,
    });
    if (!r.success || mErr) {
      setErrors({ ...(r.success ? {} : fieldErrors(r.error)), ...(mErr ? { amountCents: mErr } : {}) });
      return;
    }
    if (transaction) {
      update((d) => updateTransaction(d, transaction.id, r.data));
      toast({ message: "Lançamento atualizado." });
    } else {
      update((d) => addTransaction(d, r.data));
      toast({ message: flow === "entrada" ? "Entrada registrada." : "Despesa registrada." });
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={transaction ? "Editar lançamento" : flow === "entrada" ? "Nova entrada" : "Nova despesa"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {transaction ? "Salvar alterações" : flow === "entrada" ? "Registrar entrada" : "Registrar despesa"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <Segmented
          label="Tipo"
          value={flow}
          onChange={changeFlow}
          options={[
            { value: "despesa", label: "Despesa" },
            { value: "entrada", label: "Entrada" },
          ]}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Valor (R$)" error={errors.amountCents}>
            {(p) => <Input {...p} autoFocus inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
          <Field label="Data" error={errors.date}>
            {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
        <Field label="Categoria" error={errors.categoryId}>
          {(p) => (
            <Select {...p} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Descrição" hint="Opcional" error={errors.description}>
          {(p) => (
            <Input {...p} placeholder={flow === "entrada" ? "Ex.: Salário de novembro" : "Ex.: Mercado"} value={description} onChange={(e) => setDescription(e.target.value)} />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Meta ---------- */

export function GoalDialog({
  open,
  onClose,
  goal,
  emergency,
  suggestions,
}: {
  open: boolean;
  onClose: () => void;
  goal?: FinancialGoal;
  emergency?: boolean;
  /** Valores de referência (ex.: 3 e 6 meses de despesas). */
  suggestions?: { label: string; cents: number }[];
}) {
  const { update } = useForge();
  const toast = useToast();
  const isEmergency = goal?.emergency ?? !!emergency;
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? (isEmergency ? "Reserva de emergência" : ""));
    setTarget(centsToInput(goal?.targetCents));
    setDeadline(goal?.deadline ?? "");
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal?.id]);

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const cents = parseMoney(target);
    const mErr = moneyError(cents);
    const r = goalInputSchema.safeParse({ name, targetCents: mErr ? undefined : cents, deadline: deadline || undefined, emergency: isEmergency });
    if (!r.success || mErr) {
      setErrors({ ...(r.success ? {} : fieldErrors(r.error)), ...(mErr ? { targetCents: mErr } : {}) });
      return;
    }
    if (goal) {
      update((d) => updateGoal(d, goal.id, r.data));
      toast({ message: "Meta atualizada." });
    } else {
      update((d) => addGoal(d, r.data));
      toast({ message: isEmergency ? "Reserva de emergência criada." : "Meta criada." });
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={goal ? "Editar meta" : isEmergency ? "Reserva de emergência" : "Nova meta"}
      description={
        isEmergency
          ? "Dinheiro guardado para imprevistos. Você define o valor."
          : "Algo que você quer conquistar guardando dinheiro: uma viagem, um curso, um equipamento."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {goal ? "Salvar alterações" : "Criar meta"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        {!isEmergency && (
          <Field label="Nome" error={errors.name}>
            {(p) => <Input {...p} autoFocus placeholder="Ex.: Notebook novo" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
        )}
        <Field label="Valor da meta (R$)" error={errors.targetCents}>
          {(p) => <Input {...p} autoFocus={isEmergency} inputMode="decimal" placeholder="0,00" value={target} onChange={(e) => setTarget(e.target.value)} />}
        </Field>
        {isEmergency && suggestions && suggestions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs leading-relaxed text-faint">
              Referência com base na sua média de despesas registradas. Uma referência comum é entre 3 e 6 meses — não é uma regra; ajuste à sua realidade.
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Button key={s.label} size="sm" onClick={() => setTarget(centsToInput(s.cents))}>
                  {s.label}: {formatMoney(s.cents)}
                </Button>
              ))}
            </div>
          </div>
        )}
        {!isEmergency && (
          <Field label="Prazo" hint="Opcional" error={errors.deadline}>
            {(p) => <Input {...p} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Guardar / retirar ---------- */

export function ContributionDialog({
  goal,
  direction,
  onClose,
  today,
}: {
  goal: FinancialGoal | null;
  direction: "guardar" | "retirar";
  onClose: () => void;
  today: string;
}) {
  const { data, update } = useForge();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string>();
  useEffect(() => {
    setAmount("");
    setDate(today);
    setError(undefined);
  }, [goal?.id, direction, today]);
  const saved = goal ? goalSaved(data.finance, goal.id) : 0;

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!goal) return;
    const cents = parseMoney(amount);
    const err = moneyError(cents);
    if (err) return setError(err);
    if (direction === "retirar" && cents! > saved) return setError(`Há ${formatMoney(saved)} guardados nesta meta.`);
    update((d) => addContribution(d, goal.id, date, direction === "guardar" ? cents! : -cents!));
    toast({ message: direction === "guardar" ? `${formatMoney(cents!)} guardados.` : `${formatMoney(cents!)} retirados.` });
    onClose();
  }

  return (
    <Dialog
      open={goal !== null}
      onClose={onClose}
      size="sm"
      title={direction === "guardar" ? "Guardar dinheiro" : "Retirar dinheiro"}
      description={goal ? `${goal.name}: ${formatMoney(saved)} guardados até agora.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {direction === "guardar" ? "Guardar" : "Retirar"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="grid grid-cols-2 gap-4" noValidate>
        <Field label="Valor (R$)" error={error}>
          {(p) => <Input {...p} autoFocus inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field label="Data">
          {(p) => <Input {...p} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Saldo inicial ---------- */

export function OpeningBalanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, update } = useForge();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [negative, setNegative] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!open) return;
    const v = data.finance.openingBalanceCents;
    setValue(v === undefined ? "" : centsToInput(Math.abs(v)));
    setNegative((v ?? 0) < 0);
    setError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const cents = parseMoney(value);
    if (cents === undefined) {
      update((d) => setOpeningBalance(d, undefined));
      onClose();
      return;
    }
    if (Number.isNaN(cents)) return setError("Use o formato 1.234,56.");
    update((d) => setOpeningBalance(d, negative ? -cents : cents));
    toast({ message: "Saldo inicial salvo." });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Saldo inicial"
      description="Quanto você tinha disponível quando começou a registrar. Com ele, o FORGE estima seu saldo atual. Deixe vazio para não usar."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            Salvar
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <Field label="Valor (R$)" error={error}>
          {(p) => <Input {...p} autoFocus inputMode="decimal" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} />}
        </Field>
        <label className="flex items-center gap-2.5 text-sm text-muted">
          <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} className="size-4 accent-[#A5B89B]" />
          O saldo estava negativo
        </label>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Categorias ---------- */

export function CategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, update } = useForge();
  const [flow, setFlow] = useState<MoneyFlow>("despesa");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const used = new Set(data.finance.transactions.map((t) => t.categoryId));
  const list = data.finance.categories.filter((c) => c.flow === flow);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const r = categoryInputSchema.safeParse({ name, flow });
    if (!r.success) return setError(r.error.issues[0].message);
    if (list.some((c) => c.name.toLowerCase() === r.data.name.toLowerCase())) return setError("Já existe uma categoria com esse nome.");
    update((d) => addCategory(d, r.data));
    setName("");
    setError(undefined);
  }

  return (
    <Dialog open={open} onClose={onClose} size="sm" title="Categorias" description="Renomeie, crie ou remova. Categorias com lançamentos não podem ser removidas." footer={<Button onClick={onClose}>Concluir</Button>}>
      <div className="flex flex-col gap-4">
        <Segmented
          label="Tipo de categoria"
          value={flow}
          onChange={setFlow}
          options={[
            { value: "despesa", label: "Despesas" },
            { value: "entrada", label: "Entradas" },
          ]}
        />
        <ul className="flex flex-col gap-2">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <Input
                aria-label={`Nome da categoria ${c.name}`}
                defaultValue={c.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v.length >= 2 && v !== c.name) update((d) => renameCategory(d, c.id, v));
                  else e.target.value = c.name;
                }}
              />
              <IconButton
                label={used.has(c.id) ? `${c.name} tem lançamentos e não pode ser removida` : `Remover ${c.name}`}
                disabled={used.has(c.id)}
                className="size-10 disabled:opacity-30"
                onClick={() => update((d) => deleteCategory(d, c.id))}
              >
                <Trash2 size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="flex gap-2" noValidate>
          <Input aria-label="Nova categoria" placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" icon={<Plus size={15} />}>
            Criar
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-xs text-warn">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
