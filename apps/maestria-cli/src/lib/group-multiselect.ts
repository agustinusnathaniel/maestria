// ── Enhanced group multiselect with toggle-all (a key) ──
//
// Extends @clack/core's GroupMultiSelectPrompt to add an `a` key handler
// that toggles all items across all groups. The render logic mirrors
// @clack/prompts's internal groupMultiselect rendering (opt(), symbols,
// layout), which is not publicly exported, so it's re-implemented here.
//
// Drop-in replacement for @clack/prompts's groupMultiselect.

import { createRequire } from 'node:module';
import { styleText } from 'node:util';
import type { Option } from '@clack/prompts';

// @clack/core is a transitive dependency (not direct), so we access it
// through @clack/prompts's dependency chain (pnpm virtual store).
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const promptsRequire = createRequire(import.meta.resolve('@clack/prompts'));
const GroupMultiSelectPromptCtor: new (opts: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, cb: (...args: any[]) => void): void;
  options: unknown[];
  value: unknown;
  cursor: number;
  state: string;
  prompt(): Promise<unknown>;
  isGroupSelected(group: string): boolean;
  error: string;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
} = promptsRequire('@clack/core').GroupMultiSelectPrompt;

// ── Visual symbols (mirrors @clack/prompts internals) ────────────

const S_BAR = '\u2502';
const S_BAR_END = '\u2514';
const S_CHECKBOX_ACTIVE = '\u25FB';
const S_CHECKBOX_SELECTED = '\u25FC';
const S_CHECKBOX_INACTIVE = '\u25FB';

const S_SYMBOL_ACTIVE = '\u25C6';
const S_SYMBOL_CANCEL = '\u25A0';
const S_SYMBOL_ERROR = '\u25B2';
const S_SYMBOL_SUBMIT = '\u25C6';

// ── Public API ──────────────────────────────────────────────────

export interface GroupMultiSelectOptions<Value> {
  message: string;
  options: Record<string, Option<Value>[]>;
  initialValues?: Value[];
  maxItems?: number;
  required?: boolean;
  cursorAt?: Value;
  selectableGroups?: boolean;
  groupSpacing?: number;
  showInstructions?: boolean;
  signal?: AbortSignal;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  withGuide?: boolean;
}

// ── Color utility ───────────────────────────────────────────────

function symbol(state: string): string {
  switch (state) {
    case 'initial':
    case 'active':
      return styleText('cyan', S_SYMBOL_ACTIVE);
    case 'cancel':
      return styleText('red', S_SYMBOL_CANCEL);
    case 'error':
      return styleText('yellow', S_SYMBOL_ERROR);
    case 'submit':
      return styleText('green', S_SYMBOL_SUBMIT);
    default:
      return '';
  }
}

interface PromptInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, cb: (...args: any[]) => void): void;
  options: unknown[];
  value: unknown;
  cursor: number;
  state: string;
  error: string;
  prompt(): Promise<unknown>;
  isGroupSelected(group: string): boolean;
}

// ── Option renderer (adapted from @clack/prompts internals) ─────

function createOptionRenderer<Value>() {
  return (
    option: Option<Value> & { group: string | boolean },
    state:
      | 'inactive'
      | 'active'
      | 'selected'
      | 'active-selected'
      | 'group-active'
      | 'group-active-selected'
      | 'submitted'
      | 'cancelled',
    selectableGroups: boolean,
    options: (Option<Value> & { group: string | boolean })[] = [],
  ) => {
    const label = option.label ?? String(option.value);
    const isItem = typeof option.group === 'string';
    const next = isItem && (options[options.indexOf(option) + 1] ?? { group: true });
    const isLast = isItem && next && next.group === true;
    const prefix = isItem
      ? selectableGroups
        ? isLast
          ? `${S_BAR_END} `
          : `${S_BAR} `
        : '  '
      : '';

    const spacer = styleText('dim', prefix);

    if (state === 'active') {
      return `${spacer}${styleText('cyan', S_CHECKBOX_ACTIVE)} ${label}${option.hint ? ` ${styleText('dim', `(${option.hint})`)}` : ''}`;
    }
    if (state === 'group-active') {
      return `${prefix}${styleText('cyan', S_CHECKBOX_ACTIVE)} ${styleText('dim', label)}`;
    }
    if (state === 'group-active-selected') {
      return `${prefix}${styleText('green', S_CHECKBOX_SELECTED)} ${styleText('dim', label)}`;
    }
    if (state === 'selected') {
      const checkbox = isItem || selectableGroups ? styleText('green', S_CHECKBOX_SELECTED) : '';
      return `${spacer}${checkbox} ${styleText('dim', label)}${option.hint ? ` (${option.hint})` : ''}`;
    }
    if (state === 'cancelled') {
      return `${styleText('strikethrough', styleText('dim', label))}`;
    }
    if (state === 'active-selected') {
      return `${spacer}${styleText('green', S_CHECKBOX_SELECTED)} ${label}${option.hint ? ` ${styleText('dim', `(${option.hint})`)}` : ''}`;
    }
    if (state === 'submitted') {
      return `${styleText('dim', label)}`;
    }
    // inactive
    const checkbox = isItem || selectableGroups ? styleText('dim', S_CHECKBOX_INACTIVE) : '';
    return `${spacer}${checkbox} ${styleText('dim', label)}`;
  };
}

// ── Instructions with toggle-all hint ───────────────────────────

const ENHANCED_INSTRUCTIONS = [
  '\u2191/\u2193 to navigate',
  'Space: select',
  'a: toggle all',
  'Enter: confirm',
];

function formatInstructions(hasGuide: boolean): string[] {
  const prefix = hasGuide ? `${styleText('cyan', S_BAR)}  ` : '';
  const lastPrefix = hasGuide ? `${styleText('cyan', S_BAR_END)}` : '';
  return ENHANCED_INSTRUCTIONS.map((text, i) => {
    const p = i === ENHANCED_INSTRUCTIONS.length - 1 ? lastPrefix : prefix;
    return `${p}${styleText('dim', styleText('gray', text))}`;
  });
}

// ── Enhanced group multiselect function ─────────────────────────

export async function groupMultiselect<Value>(
  opts: GroupMultiSelectOptions<Value>,
): Promise<Value[] | symbol> {
  const { selectableGroups = true } = opts;
  const required = opts.required ?? true;
  const showInstructions = opts.showInstructions ?? true;
  const opt = createOptionRenderer<Value>();

  const prompt = new GroupMultiSelectPromptCtor({
    options: opts.options,
    signal: opts.signal,
    input: opts.input,
    output: opts.output,
    initialValues: opts.initialValues,
    required,
    cursorAt: opts.cursorAt,
    selectableGroups,
    validate(selected: Value[] | undefined) {
      if (required && (selected === undefined || selected.length === 0)) {
        return `Please select at least one option.\n${styleText('reset', styleText('dim', `Press ${styleText('gray', styleText('bgWhite', styleText('inverse', ' space ')))} to select, ${styleText('gray', styleText('bgWhite', styleText('inverse', ' enter ')))} to submit`))}`;
      }
    },
    render(this: Record<string, unknown>) {
      const self = this as unknown as PromptInstance;
      const guide = opts.withGuide ?? true;
      const title = `${guide ? `${styleText('gray', S_BAR)}\n` : ''}${symbol(self.state)}  ${opts.message}\n`;
      const value: Value[] = (self.value ?? []) as Value[];

      const styleOption = (
        option: Option<Value> & { group: string | boolean },
        active: boolean,
      ) => {
        const options = self.options as (Option<Value> & { group: string | boolean })[];
        const groupActive =
          !active &&
          typeof option.group === 'string' &&
          options[self.cursor]?.value === option.group;
        const selected =
          value.includes(option.value) ||
          (option.group === true && self.isGroupSelected(String(option.value)));
        if (groupActive) {
          return opt(
            option,
            selected ? 'group-active-selected' : 'group-active',
            selectableGroups,
            options,
          );
        }
        if (active && selected) return opt(option, 'active-selected', selectableGroups, options);
        if (selected) return opt(option, 'selected', selectableGroups, options);
        return opt(option, active ? 'active' : 'inactive', selectableGroups, options);
      };

      switch (self.state) {
        case 'submit': {
          const selectedOptions = (self.options as { value: Value }[])
            .filter(({ value: v }) => value.includes(v))
            .map((optItem) =>
              opt(
                optItem as unknown as Option<Value> & { group: string | boolean },
                'submitted',
                selectableGroups,
              ),
            );
          const optionsText =
            selectedOptions.length === 0 ? '' : `  ${selectedOptions.join(styleText('dim', ', '))}`;
          return `${title}${guide ? styleText('gray', S_BAR) : ''}${optionsText}`;
        }
        case 'cancel': {
          const label = (self.options as { value: Value }[])
            .filter(({ value: v }) => value.includes(v))
            .map((optItem) =>
              opt(
                optItem as unknown as Option<Value> & { group: string | boolean },
                'cancelled',
                selectableGroups,
              ),
            )
            .join(styleText('dim', ', '));
          return `${title}${guide ? `${styleText('gray', S_BAR)}  ` : ''}${
            label.trim() ? `${label}${guide ? `\n${styleText('gray', S_BAR)}` : ''}` : ''
          }`;
        }
        case 'error': {
          const footer = self.error
            .split('\n')
            .map((ln: string, i: number) =>
              i === 0
                ? `${guide ? `${styleText('yellow', S_BAR_END)}  ` : ''}${styleText('yellow', ln)}`
                : `   ${ln}`,
            )
            .join('\n');
          const guidePrefix = guide ? `${styleText('yellow', S_BAR)}  ` : '';
          const options = self.options as (Option<Value> & { group: string | boolean })[];
          const optionsText = options
            .map((option, idx) => styleOption(option, idx === self.cursor))
            .join(`\n${guidePrefix}`);
          return `${title}${guidePrefix}${optionsText}\n${footer}\n`;
        }
        default: {
          const guidePrefix = guide ? `${styleText('cyan', S_BAR)}  ` : '';
          const footerLines = showInstructions
            ? formatInstructions(guide)
            : guide
              ? [styleText('cyan', S_BAR_END)]
              : [];
          const footerText = footerLines.join('\n');
          const options = self.options as (Option<Value> & { group: string | boolean })[];
          const optionsText = options
            .map((option, idx) => styleOption(option, idx === self.cursor))
            .join(`\n${guidePrefix}`);
          return `${title}${guidePrefix}${optionsText}\n${footerText}\n`;
        }
      }
    },
  }) as unknown as PromptInstance;

  // Attach the toggle-all key handler
  prompt.on('key', (_char: unknown, key: Record<string, unknown>) => {
    if ((key as { name: string }).name === 'a') {
      const allItems = (prompt.options as { group: string | boolean }[]).filter(
        (o) => typeof o.group === 'string' && (o as Record<string, unknown>).disabled !== true,
      );
      const allSelected =
        prompt.value !== undefined &&
        Array.isArray(prompt.value) &&
        (prompt.value as unknown[]).length === allItems.length;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      prompt.value = allSelected
        ? []
        : (allItems as unknown as { value: Value }[]).map((o) => o.value);
    }
  });

  return prompt.prompt() as Promise<Value[] | symbol>;
}
