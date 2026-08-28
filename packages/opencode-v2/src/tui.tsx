import { Plugin } from '@opencode-ai/plugin/tui';

export default Plugin.define({
  id: 'maestria.v2.tui',
  setup(context) {
    context.ui.toast.show({
      message: 'maestria v2 TUI loaded — fein/sonar/blitz ready',
      variant: 'success',
    });

    const disposeFooter = context.ui.slot({
      append: 'prompt.footer',
      render: () => <text fg={context.theme.text.default}>maestria v2 — fein / sonar / blitz</text>,
    });

    const disposeStatus = context.ui.slot({
      append: 'prompt.footer.status',
      render: () => <text>maestria ok</text>,
    });

    context.keymap.layer(() => ({
      mode: 'global',
      priority: 10,
      commands: [
        {
          id: 'maestria.status',
          title: 'Maestria status',
          group: 'Maestria',
          bind: 'ctrl+shift+m',
          palette: true,
          run: async () => {
            context.ui.toast.show({
              message: 'maestria v2 — fein/sonar/blitz ready',
              variant: 'info',
            });
            await context.ui.dialog.alert({
              title: 'Maestria',
              message: 'maestria v2 TUI — fein / sonar / blitz modes active',
            });
          },
        },
      ],
      bindings: ['maestria.status'],
    }));

    const [tuiSettings, updateTuiSettings] = context.storage.store('maestria.tui', {
      initial: { compact: false } as { compact: boolean },
    });
    void tuiSettings;
    void updateTuiSettings;

    return () => {
      disposeFooter();
      disposeStatus();
    };
  },
});
