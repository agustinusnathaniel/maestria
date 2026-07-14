// ── Enhanced group multiselect with toggle-all (a key) ──
//
// Extends @clack/core's GroupMultiSelectPrompt to add an `a` key handler
// that toggles all items across all groups. The render logic mirrors
// @clack/prompts's internal groupMultiselect rendering (opt(), symbols,
// layout), which is not publicly exported, so it's re-implemented here.
//
// Drop-in replacement for @clack/prompts's groupMultiselect.

import { GroupMultiSelectPrompt } from '@clack/core';
import { styleText } from 'node:util';
import type { Option } from '@clack/prompts';

// ── Visual symbols ────────────────────────────────────

const S_BAR = '\u2502';
const S_BAR_END = '\u2514';
const S_CHECKBOX_ACTIVE = '\u25FB';
const S_CHECKBOX_SELECTED = '\u25FC';
const S_CHECKBOX_INACTIVE = '\u25FB';

const S_SYMBOL_ACTIVE = '\u25C6';
const S_SYMBOL_CANCEL = '\u25A0';
const S_SYMBOL_ERROR = '\u25B2';
const S_SYMBOL_SUBMIT = '\u25C6';

// ── Public API ────────────────────────────────────────

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

// ── Color utility ─────────────────────────────────────

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

// ── Instructions with toggle-all hint ──────────────────

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

// ── Extended prompt class with a key toggle-all ────────

class TogglableGroupMultiSelectPrompt<
  T extends { value: string },
> extends GroupMultiSelectPrompt<T> {
  constructor(opts: ConstructorParameters<typeof GroupMultiSelectPrompt<T>>[0]) {
    super(opts);
    // Register after construction so super's constructor has already set up the event system
    this.on('key', (char: string | undefined) => {
      if (char === 'a') {
        this._toggleAll();
      }
    });
  }

  private _toggleAll() {
    const allItems = this.options.filter(
      (o): o is T & { group: string } =>
        typeof o.group === 'string' && (o as Record<string, unknown>).disabled !== true,
    );
    const allSelected = this.value !== undefined && this.value.length === allItems.length;
    this.value = allSelected ? ([] as T['value'][]) : allItems.map((o) => o.value);
  }
}

// ── Option renderer ──────────────────────────────────

function createOptionRenderer<Value>(selectableGroups: boolean) {
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

// ── Enhanced group multiselect function ────────────────

export async function groupMultiselect<Value>(
  opts: GroupMultiSelectOptions<Value>,
): Promise<Value[] | symbol> {
  const { selectableGroups = true } = opts;
  const required = opts.required ?? true;
  const showInstructions = opts.showInstructions ?? true;
  const opt = createOptionRenderer<Value>(selectableGroups);

  // Build the render function options
  const renderOptions = {
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
    render(this: GroupMultiSelectPrompt<{ value: Value }>) {
      const guide = opts.withGuide ?? true;
      const title = `${guide ? `${styleText('gray', S_BAR)}\n` : ''}${symbol(this.state)}  ${opts.message}\n`;
      const value: Value[] = (this.value ?? []) as Value[];

      // Restore group headers that may have been lost in serialization
      type FlatOption = { value: Value; group: string | boolean; label?: string; hint?: string };
      // Regenerate group headers from the flat options
      // The options are stored as flat array with group markers
      const rawOptions = this.options as FlatOption[];

      const styleOption = (option: FlatOption, active: boolean) => {
        const groupActive =
          !active &&
          typeof option.group === 'string' &&
          rawOptions[this.cursor]?.value === (option as Record<string, unknown>).value;
        const selected =
          value.includes(option.value) ||
          (option.group === true && this.isGroupSelected(String(option.value)));
        if (groupActive) {
          return opt(
            option as unknown as Option<Value> & { group: string | boolean },
            selected ? 'group-active-selected' : 'group-active',
            rawOptions as unknown as (Option<Value> & { group: string | boolean })[],
          );
        }
        if (active && selected) return opt(option as any, 'active-selected', rawOptions as any);
        if (selected) return opt(option as any, 'selected', rawOptions as any);
        return opt(option as any, active ? 'active' : 'inactive', rawOptions as any);
      };

      switch (this.state) {
        case 'submit': {
          const selectedOptions = rawOptions
            .filter(({ value: v }) => value.includes(v))
            .map((optItem) => opt(optItem as any, 'submitted'));
          const optionsText =
            selectedOptions.length === 0 ? '' : `  ${selectedOptions.join(styleText('dim', ', '))}`;
          return `${title}${guide ? styleText('gray', S_BAR) : ''}${optionsText}`;
        }
        case 'cancel': {
          const label = rawOptions
            .filter(({ value: v }) => value.includes(v))
            .map((optItem) => opt(optItem as any, 'cancelled'))
            .join(styleText('dim', ', '));
          return `${title}${guide ? `${styleText('gray', S_BAR)}  ` : ''}${
            label.trim() ? `${label}${guide ? `\n${styleText('gray', S_BAR)}` : ''}` : ''
          }`;
        }
        case 'error': {
          const footer = this.error
            .split('\n')
            .map((ln: string, i: number) =>
              i === 0
                ? `${guide ? `${styleText('yellow', S_BAR_END)}  ` : ''}${styleText('yellow', ln)}`
                : `   ${ln}`,
            )
            .join('\n');
          const guidePrefix = guide ? `${styleText('yellow', S_BAR)}  ` : '';
          const optionsText = rawOptions
            .map((option, idx) => styleOption(option, idx === this.cursor))
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
          const optionsText = rawOptions
            .map((option, idx) => styleOption(option, idx === this.cursor))
            .join(`\n${guidePrefix}`);
          return `${title}${guidePrefix}${optionsText}\n${footerText}\n`;
        }
      }
    },
  };

  const prompt = new TogglableGroupMultiSelectPrompt(renderOptions as any);
  return prompt.prompt() as Promise<Value[] | symbol>;
}
