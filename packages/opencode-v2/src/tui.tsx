import { Plugin } from '@opencode-ai/plugin/tui';

export default Plugin.define({
  id: 'maestria.v2.tui',
  setup(context) {
    context.ui.toast.show({
      message: 'maestria v2 TUI loaded - fein/sonar/blitz ready',
      variant: 'success',
    });

    const disposeFooter = context.ui.slot({
      append: 'prompt.footer',
      render: () => <text fg={context.theme.text.default}>maestria v2 - fein / sonar / blitz</text>,
    });

    const disposeStatus = context.ui.slot({
      append: 'prompt.footer.status',
      render: () => <text>maestria ok</text>,
    });

    context.keymap.layer(() => ({
      bindings: ['maestria.status'],
      commands: [
        {
          bind: 'ctrl+shift+m',
          group: 'Maestria',
          id: 'maestria.status',
          palette: true,
          run: async () => {
            context.ui.toast.show({
              message: 'maestria v2 - fein/sonar/blitz ready',
              variant: 'info',
            });
            await context.ui.dialog.alert({
              message: 'maestria v2 TUI - fein / sonar / blitz modes active',
              title: 'Maestria',
            });
          },
          title: 'Maestria status',
        },
      ],
      mode: 'global',
      priority: 10,
    }));

    return () => {
      disposeFooter();
      disposeStatus();
    };
  },
});
