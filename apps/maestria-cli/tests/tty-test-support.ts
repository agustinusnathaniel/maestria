/** Test-only TTY toggles. Each test file captures and restores its own descriptors. */
const setTty = (value: boolean): void => {
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value });
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value });
};

export const createTtyTestSupport = (): {
  restoreTty: () => void;
  setTty: (value: boolean) => void;
} => {
  const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

  const restoreTty = (): void => {
    if (stdoutTty) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutTty);
    } else {
      Reflect.deleteProperty(process.stdout, 'isTTY');
    }
    if (stdinTty) {
      Object.defineProperty(process.stdin, 'isTTY', stdinTty);
    } else {
      Reflect.deleteProperty(process.stdin, 'isTTY');
    }
  };

  return { restoreTty, setTty };
};
