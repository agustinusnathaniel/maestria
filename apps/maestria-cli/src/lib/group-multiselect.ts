// ── Enhanced group multiselect with toggle-all (a key) ──
//
// Extends @clack/core's GroupMultiSelectPrompt to add an `a` key handler
// that toggles all items across all groups. The render logic mirrors
// @clack/prompts's internal groupMultiselect rendering (opt(), symbols,
// layout), which is not publicly exported, so it's re-implemented here.
//
// Drop-in replacement for @clack/prompts's groupMultiselect.

import { GroupMultiSelectPrompt } from '@clack/core';
import type { Option } from '@clack/prompts';
import type { Readable, Writable } from 'node:stream';
import { styleText } from 'node:util';

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
  input?: Readable;
  output?: Writable;
  withGuide?: boolean;
}

// ── Color utility ─────────────────────────────────────

const symbol = (state: string): string => {
  switch (state) {
    case 'initial':
    case 'active': {
      return styleText('cyan', S_SYMBOL_ACTIVE);
    }
    case 'cancel': {
      return styleText('red', S_SYMBOL_CANCEL);
    }
    case 'error': {
      return styleText('yellow', S_SYMBOL_ERROR);
    }
    case 'submit': {
      return styleText('green', S_SYMBOL_SUBMIT);
    }
    default: {
      return '';
    }
  }
};

// ── Instructions with toggle-all hint ──────────────────

const ENHANCED_INSTRUCTIONS = [
  '\u2191/\u2193 to navigate',
  'Space: select',
  'a: toggle all',
  'Enter: confirm',
];

const formatInstructions = (hasGuide: boolean): string[] => {
  const prefix = hasGuide ? `${styleText('cyan', S_BAR)}  ` : '';
  const lastPrefix = hasGuide ? styleText('cyan', S_BAR_END) : '';
  return ENHANCED_INSTRUCTIONS.map((text, i) => {
    const p = i === ENHANCED_INSTRUCTIONS.length - 1 ? lastPrefix : prefix;
    return `${p}${styleText('dim', styleText('gray', text))}`;
  });
};

// ── Extended prompt class with a key toggle-all ────────

class TogglableGroupMultiSelectPrompt<Value> extends GroupMultiSelectPrompt<Option<Value>> {
  constructor(opts: ConstructorParameters<typeof GroupMultiSelectPrompt<Option<Value>>>[0]) {
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
      (o): o is Option<Value> & { group: string } =>
        typeof o.group === 'string' && o.disabled !== true,
    );
    const allSelected = this.value !== undefined && this.value.length === allItems.length;
    this.value = allSelected ? [] : allItems.map((o) => o.value);
  }
}

// ── Option renderer ──────────────────────────────────

const optionHint = (option: { hint?: string | null }, dimmed: boolean): string => {
  if (option.hint === undefined || option.hint === null || option.hint === '') {
    return '';
  }
  return dimmed ? ` ${styleText('dim', `(${option.hint})`)}` : ` (${option.hint})`;
};

const optionPrefix = (isItem: boolean, selectableGroups: boolean, isLast: boolean): string => {
  if (!isItem) {
    return '';
  }
  if (!selectableGroups) {
    return '  ';
  }
  return isLast ? `${S_BAR_END} ` : `${S_BAR} `;
};

const createOptionRenderer =
  <Value>(selectableGroups: boolean) =>
  (
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
  ): string => {
    const label = option.label ?? String(option.value);
    const isItem = typeof option.group === 'string';
    const next = options[options.indexOf(option) + 1] ?? { group: true };
    const isLast = isItem && next?.group === true;
    const prefix = optionPrefix(isItem, selectableGroups, isLast);
    const spacer = styleText('dim', prefix);

    switch (state) {
      case 'active': {
        return `${spacer}${styleText('cyan', S_CHECKBOX_ACTIVE)} ${label}${optionHint(option, true)}`;
      }
      case 'group-active': {
        return `${prefix}${styleText('cyan', S_CHECKBOX_ACTIVE)} ${styleText('dim', label)}`;
      }
      case 'group-active-selected': {
        return `${prefix}${styleText('green', S_CHECKBOX_SELECTED)} ${styleText('dim', label)}`;
      }
      case 'selected': {
        const checkbox = isItem || selectableGroups ? styleText('green', S_CHECKBOX_SELECTED) : '';
        return `${spacer}${checkbox} ${styleText('dim', label)}${optionHint(option, false)}`;
      }
      case 'cancelled': {
        return styleText('strikethrough', styleText('dim', label));
      }
      case 'active-selected': {
        return `${spacer}${styleText('green', S_CHECKBOX_SELECTED)} ${label}${optionHint(option, true)}`;
      }
      case 'submitted': {
        return styleText('dim', label);
      }
      case 'inactive': {
        const checkbox = isItem || selectableGroups ? styleText('dim', S_CHECKBOX_INACTIVE) : '';
        return `${spacer}${checkbox} ${styleText('dim', label)}`;
      }
      default: {
        return '';
      }
    }
  };

const buildValidate = (required: boolean) => (selected: unknown[] | undefined) => {
  if (required && (selected === undefined || selected.length === 0)) {
    return `Please select at least one option.\n${styleText('reset', styleText('dim', `Press ${styleText('gray', styleText('bgWhite', styleText('inverse', ' space ')))} to select, ${styleText('gray', styleText('bgWhite', styleText('inverse', ' enter ')))} to submit`))}`;
  }
  const noValidationError = undefined;
  return noValidationError;
};

// oxlint-disable-next-line max-lines-per-function -- createGroupRender builds the GroupMultiSelect render closure that shares opt/showInstructions/guide state and implements 5 render states (submit/cancel/error/default) with shared styleOption helper; splitting would duplicate the closure and fragment the render logic.
const createGroupRender = <Value>(
  opts: GroupMultiSelectOptions<Value>,
  opt: ReturnType<typeof createOptionRenderer<Value>>,
  guideDefault: boolean,
  showInstructions: boolean,
): ConstructorParameters<typeof GroupMultiSelectPrompt<Option<Value>>>[0]['render'] =>
  // oxlint-disable-next-line max-lines-per-function -- render implements 5 visual states for the group multiselect (submit/cancel/error/default) sharing title/guide/styleOption closure; splitting would duplicate the closure and fragment the render states.
  function render(this: GroupMultiSelectPrompt<Option<Value>>) {
    const guide = opts.withGuide ?? guideDefault;
    const title = `${guide ? `${styleText('gray', S_BAR)}\n` : ''}${symbol(this.state)}  ${opts.message}\n`;
    const value: Value[] = this.value ?? [];
    type RenderOption = Option<Value> & { group: string | boolean };
    const rawOptions: RenderOption[] = this.options;
    const styleOption = (option: RenderOption, active: boolean) => {
      const groupActive =
        !active &&
        typeof option.group === 'string' &&
        rawOptions[this.cursor]?.value === option.value;
      const selected =
        value.includes(option.value) ||
        (option.group === true && this.isGroupSelected(String(option.value)));
      if (groupActive) {
        return opt(option, selected ? 'group-active-selected' : 'group-active', rawOptions);
      }
      if (active && selected) {
        return opt(option, 'active-selected', rawOptions);
      }
      if (selected) {
        return opt(option, 'selected', rawOptions);
      }
      return opt(option, active ? 'active' : 'inactive', rawOptions);
    };
    if (this.state === 'submit') {
      const selectedOptions = rawOptions
        .filter(({ value: v }) => value.includes(v))
        .map((o) => opt(o, 'submitted'));
      const optionsText =
        selectedOptions.length === 0 ? '' : `  ${selectedOptions.join(styleText('dim', ', '))}`;
      return `${title}${guide ? styleText('gray', S_BAR) : ''}${optionsText}`;
    }
    if (this.state === 'cancel') {
      const label = rawOptions
        .filter(({ value: v }) => value.includes(v))
        .map((o) => opt(o, 'cancelled'))
        .join(styleText('dim', ', '));
      return `${title}${guide ? `${styleText('gray', S_BAR)}  ` : ''}${label.trim() ? `${label}${guide ? `\n${styleText('gray', S_BAR)}` : ''}` : ''}`;
    }
    if (this.state === 'error') {
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
    const guidePrefix = guide ? `${styleText('cyan', S_BAR)}  ` : '';
    let footerLines: string[] = [];
    if (showInstructions) {
      footerLines = formatInstructions(guide);
    } else if (guide) {
      footerLines = [styleText('cyan', S_BAR_END)];
    }
    const footerText = footerLines.join('\n');
    const optionsText = rawOptions
      .map((option, idx) => styleOption(option, idx === this.cursor))
      .join(`\n${guidePrefix}`);
    return `${title}${guidePrefix}${optionsText}\n${footerText}\n`;
  };

export const groupMultiselect = async <Value>(
  opts: GroupMultiSelectOptions<Value>,
): Promise<Value[] | symbol | undefined> => {
  const { selectableGroups = true } = opts;
  const required = opts.required ?? true;
  const showInstructions = opts.showInstructions ?? true;
  const opt = createOptionRenderer<Value>(selectableGroups);
  const render = createGroupRender(opts, opt, true, showInstructions);
  const renderOptions: ConstructorParameters<typeof GroupMultiSelectPrompt<Option<Value>>>[0] = {
    cursorAt: opts.cursorAt,
    initialValues: opts.initialValues,
    input: opts.input,
    options: opts.options,
    output: opts.output,
    render,
    required,
    selectableGroups,
    signal: opts.signal,
    validate: buildValidate(required),
  };
  const prompt = new TogglableGroupMultiSelectPrompt<Value>(renderOptions);
  return await prompt.prompt();
};
