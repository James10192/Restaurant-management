import {
  useEffect,
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "../../lib/cn";
import { fieldControlClasses, isInvalid } from "./input";

export type OtpInputProps = Omit<
  ComponentProps<"div">,
  "onChange" | "defaultValue" | "children" | "id"
> & {
  /** Code saisi : uniquement des chiffres, contigus, au plus `length`. */
  value: string;
  onChange: (value: string) => void;
  /** Appelé une fois, au moment où le dernier chiffre est saisi. */
  onComplete?: (code: string) => void;
  length?: number;
  /** Identifiant posé sur la première case (celle que vise le libellé). */
  id?: string;
  name?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
};

const DIGITS = /\D/g;

function onlyDigits(text: string): string {
  return text.replace(DIGITS, "");
}

/**
 * Saisie d'un code à usage unique.
 * Le code doit pouvoir se coller (WCAG 3.3.8, DESIGN.md §12.1 ligne 18) : un collage
 * — espaces et tirets compris — se répartit dans les cases, et le remplissage
 * automatique du SMS (`one-time-code`) passe par le même chemin.
 * Les saisies sont lues à l'événement `input`, pas au clavier : plusieurs claviers
 * Android n'envoient pas de valeur de touche exploitable.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  id,
  name,
  autoFocus = false,
  disabled = false,
  invalid,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel = "Code de vérification",
  ...props
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const code = onlyDigits(value).slice(0, length);
  const hasError = invalid ?? isInvalid(ariaInvalid);

  useEffect(() => {
    if (autoFocus) inputs.current[Math.min(code.length, length - 1)]?.focus();
    // Au montage uniquement : un autofocus ne doit pas voler le focus à chaque frappe.
  }, []);

  function focusBox(index: number) {
    const box = inputs.current[Math.max(0, Math.min(index, length - 1))];
    if (box) {
      box.focus();
      box.select();
    }
  }

  function commit(next: string) {
    const clean = onlyDigits(next).slice(0, length);
    if (clean === code) return;
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  }

  /** Insère des chiffres à partir de la case `index`, en écrasant ceux qui s'y trouvent. */
  function insertAt(index: number, digits: string) {
    if (digits.length >= length) {
      // Un code complet collé ou auto-rempli remplace tout, quelle que soit la case visée.
      commit(digits);
      focusBox(length - 1);
      return;
    }
    const start = Math.min(index, code.length);
    const next = (code.slice(0, start) + digits + code.slice(start + digits.length)).slice(0, length);
    commit(next);
    focusBox(start + digits.length);
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const raw = onlyDigits(event.target.value);
    const current = code[index] ?? "";
    if (raw === "") {
      // Effacement arrivé sans événement clavier exploitable (certains claviers Android).
      if (current !== "") commit(code.slice(0, index) + code.slice(index + 1));
      return;
    }
    // La case contenait déjà un chiffre : la nouvelle frappe est celui qui s'y ajoute.
    const typed = raw.length === 2 && current !== "" ? raw.replace(current, "") || current : raw;
    insertAt(index, typed);
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = onlyDigits(event.clipboardData.getData("text"));
    if (digits !== "") insertAt(index, digits);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "Backspace": {
        event.preventDefault();
        if (code[index] !== undefined) {
          commit(code.slice(0, index) + code.slice(index + 1));
          focusBox(index);
        } else if (index > 0) {
          commit(code.slice(0, index - 1) + code.slice(index));
          focusBox(index - 1);
        }
        break;
      }
      case "Delete": {
        event.preventDefault();
        if (code[index] !== undefined) commit(code.slice(0, index) + code.slice(index + 1));
        break;
      }
      case "ArrowLeft":
        event.preventDefault();
        focusBox(index - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        focusBox(Math.min(index + 1, code.length));
        break;
      case "Home":
        event.preventDefault();
        focusBox(0);
        break;
      case "End":
        event.preventDefault();
        focusBox(code.length);
        break;
    }
  }

  function handleFocus(index: number, event: FocusEvent<HTMLInputElement>) {
    // Les chiffres restent contigus : on ne laisse pas viser une case après un trou.
    if (index > code.length) {
      focusBox(code.length);
      return;
    }
    event.target.select();
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex w-full max-w-[26rem] gap-2", className)}
      {...props}
    >
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            inputs.current[index] = node;
          }}
          id={index === 0 ? id : undefined}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={index === length - 1 ? "done" : "next"}
          aria-label={`Chiffre ${index + 1} sur ${length}`}
          aria-invalid={hasError || undefined}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
          value={code[index] ?? ""}
          onChange={(event) => handleChange(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => handleFocus(index, event)}
          className={cn(
            fieldControlClasses,
            "num h-(--control-h) min-w-0 flex-1 px-0 text-center text-title-lg",
            // Remplace le 16 px iOS de fieldControlClasses : 20 px suffit à éviter le zoom.
            "supports-[-webkit-touch-callout:none]:text-title-lg",
          )}
        />
      ))}
      {name ? <input type="hidden" name={name} value={code} /> : null}
    </div>
  );
}
