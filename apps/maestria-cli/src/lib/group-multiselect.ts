// Custom group multiselect: native (@clack/prompts@1.8.0) lacks toggle-all,
// so this retains the renderer plus the `a` toggle and reuses native types.

import { GroupMultiSelectPrompt } from '@clack/core';
import {
  S_BAR,
  S_BAR_END,
  S_CHECKBOX_ACTIVE,
  S_CHECKBOX_INACTIVE,
  S_CHECKBOX_SELECTED,
} from '@clack/prompts';
import type {
  GroupMultiSelectOptions as NativeGroupMultiSelectOptions,
  Option,
} from '@clack/prompts';
import { styleText } from 'node:util';

export type GroupMultiSelectOptions<Value> = NativeGroupMultiSelectOptions<Value>;

// Submit diamond kept as U+25C6 to avoid visual change.
const SYMBOL_STYLE: Record<string, [Parameters<typeof styleText>[0], string]> = {
  active: ['cyan', '◆'],
  cancel: ['red', '■'],
  error: ['yellow', '▲'],
  initial: ['cyan', '◆'],
  submit: ['green', '◆'],
};

const symbol = (state: string): string => {
  const styled = SYMBOL_STYLE[state];
  return styled === undefined ? '' : styleText(styled[0], styled[1]);
};

const ENHANCED_INSTRUCTIONS = [
  '\u2191/\u2193 to navigate',
  'Space: select',
  'a: toggle all',
  'Enter: confirm',
];

const formatInstructions = (hasGuide: boolean): string[] => {
  const prefix = hasGuide ? `${styleText('cyan', S_BAR)}  ` : '';
  const last = hasGuide ? styleText('cyan', S_BAR_END) : '';
  return ENHANCED_INSTRUCTIONS.map(
    (text, i) =>
      `${i === ENHANCED_INSTRUCTIONS.length - 1 ? last : prefix}${styleText('dim', styleText('gray', text))}`,
  );
};

class TogglableGroupMultiSelectPrompt<Value> extends GroupMultiSelectPrompt<Option<Value>> {
  constructor(opts: ConstructorParameters<typeof GroupMultiSelectPrompt<Option<Value>>>[0]) {
    super(opts);
    this.on('key', (char: string | undefined) => {
      if (char === 'a') {
        this._toggleAll();
      }
    });
  }

  private _toggleAll() {
    const items = this.options.filter(
      (o): o is Option<Value> & { group: string } =>
        typeof o.group === 'string' && o.disabled !== true,
    );
    this.value =
      this.value !== undefined && this.value.length === items.length
        ? []
        : items.map((o) => o.value);
  }
}

type RenderState =
  | 'inactive'
  | 'active'
  | 'selected'
  | 'active-selected'
  | 'group-active'
  | 'group-active-selected'
  | 'submitted'
  | 'cancelled';
type GroupedOption<Value> = Option<Value> & { group: string | boolean };

const hintText = (hint: string | null | undefined, dimmed: boolean): string => {
  if (hint === undefined || hint === null || hint === '') {
    return '';
  }
  return dimmed ? ` ${styleText('dim', `(${hint})`)}` : ` (${hint})`;
};

const itemPrefix = (isItem: boolean, selectableGroups: boolean, isLast: boolean): string => {
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
    option: GroupedOption<Value>,
    state: RenderState,
    options: GroupedOption<Value>[] = [],
  ): string => {
    const label = option.label ?? String(option.value);
    const isItem = typeof option.group === 'string';
    const next = options[options.indexOf(option) + 1] ?? { group: true };
    const prefix = itemPrefix(isItem, selectableGroups, isItem && next?.group === true);
    const spacer = styleText('dim', prefix);
    switch (state) {
      case 'active': {
        return `${spacer}${styleText('cyan', S_CHECKBOX_ACTIVE)} ${label}${hintText(option.hint, true)}`;
      }
      case 'group-active': {
        return `${prefix}${styleText('cyan', S_CHECKBOX_ACTIVE)} ${styleText('dim', label)}`;
      }
      case 'group-active-selected': {
        return `${prefix}${styleText('green', S_CHECKBOX_SELECTED)} ${styleText('dim', label)}`;
      }
      case 'selected': {
        const box = isItem || selectableGroups ? styleText('green', S_CHECKBOX_SELECTED) : '';
        return `${spacer}${box} ${styleText('dim', label)}${hintText(option.hint, false)}`;
      }
      case 'cancelled': {
        return styleText('strikethrough', styleText('dim', label));
      }
      case 'active-selected': {
        return `${spacer}${styleText('green', S_CHECKBOX_SELECTED)} ${label}${hintText(option.hint, true)}`;
      }
      case 'submitted': {
        return styleText('dim', label);
      }
      case 'inactive': {
        const box = isItem || selectableGroups ? styleText('dim', S_CHECKBOX_INACTIVE) : '';
        return `${spacer}${box} ${styleText('dim', label)}`;
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

// oxlint-disable-next-line max-lines-per-function -- Group render shares title/guide/styleOption closure across 5 visual states; splitting would duplicate the closure.
const createGroupRender = <Value>(
  opts: GroupMultiSelectOptions<Value>,
  opt: ReturnType<typeof createOptionRenderer<Value>>,
): ConstructorParameters<typeof GroupMultiSelectPrompt<Option<Value>>>[0]['render'] =>
  // oxlint-disable-next-line max-lines-per-function -- Render covers submit/cancel/error/default states with shared helpers; splitting fragments the states.
  function render(this: GroupMultiSelectPrompt<Option<Value>>) {
    const guide = opts.withGuide ?? true;
    const showInstructions = opts.showInstructions ?? true;
    const title = `${guide ? `${styleText('gray', S_BAR)}\n` : ''}${symbol(this.state)}  ${opts.message}\n`;
    const value: Value[] = this.value ?? [];
    const rawOptions: GroupedOption<Value>[] = this.options;
    const styleOption = (option: GroupedOption<Value>, active: boolean) => {
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
    const listText = (guidePrefix: string) =>
      rawOptions
        .map((option, idx) => styleOption(option, idx === this.cursor))
        .join(`\n${guidePrefix}`);
    if (this.state === 'submit') {
      const selected = rawOptions
        .filter(({ value: v }) => value.includes(v))
        .map((o) => opt(o, 'submitted'));
      return `${title}${guide ? styleText('gray', S_BAR) : ''}${selected.length === 0 ? '' : `  ${selected.join(styleText('dim', ', '))}`}`;
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
      return `${title}${guidePrefix}${listText(guidePrefix)}\n${footer}\n`;
    }
    const guidePrefix = guide ? `${styleText('cyan', S_BAR)}  ` : '';
    let footerText = '';
    if (showInstructions) {
      footerText = formatInstructions(guide).join('\n');
    } else if (guide) {
      footerText = styleText('cyan', S_BAR_END);
    }
    return `${title}${guidePrefix}${listText(guidePrefix)}\n${footerText}\n`;
  };

export const groupMultiselect = async <Value>(
  opts: GroupMultiSelectOptions<Value>,
): Promise<Value[] | symbol | undefined> => {
  const { selectableGroups = true } = opts;
  const required = opts.required ?? true;
  const prompt = new TogglableGroupMultiSelectPrompt<Value>({
    cursorAt: opts.cursorAt,
    initialValues: opts.initialValues,
    input: opts.input,
    options: opts.options,
    output: opts.output,
    render: createGroupRender(opts, createOptionRenderer<Value>(selectableGroups)),
    required,
    selectableGroups,
    signal: opts.signal,
    validate: buildValidate(required),
  });
  return await prompt.prompt();
};
