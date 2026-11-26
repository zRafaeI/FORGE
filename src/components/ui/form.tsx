import { useId, type ComponentPropsWithRef, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const control =
  "w-full rounded-md border border-line bg-bg/60 px-3 text-sm text-ink placeholder:text-faint transition-colors hover:border-[#3b443b] focus:border-accent-deep focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent/20 aria-invalid:border-warn/70";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": error || hint ? descId : undefined })}
      {(error || hint) && (
        <p id={descId} className={cn("text-xs", error ? "text-warn" : "text-faint")} role={error ? "alert" : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentPropsWithRef<"input">) {
  return <input className={cn(control, "h-10", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-20 resize-y py-2.5 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(control, "h-10 appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-faint"
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Grupo de opções exclusivas, acessível como radiogroup. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-md border border-line bg-bg/60 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 flex-1 whitespace-nowrap rounded-[7px] px-1.5 text-[13px] transition-colors sm:px-2.5",
              active ? "bg-surface-3 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Botão alternável (chip) para seleções múltiplas. */
export function Toggle({
  pressed,
  onChange,
  children,
  className,
}: {
  pressed: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors",
        pressed
          ? "border-accent-deep bg-accent-deep/25 text-ink"
          : "border-line bg-bg/40 text-muted hover:border-[#3b443b] hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Interruptor liga/desliga acessível (role="switch"). */
export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-start justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-faint">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked ? "border-accent bg-accent" : "border-line bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-[1px] size-4 rounded-full transition-transform duration-200",
            checked ? "translate-x-[17px] bg-bg" : "translate-x-[1px] bg-muted",
          )}
        />
      </span>
    </button>
  );
}
