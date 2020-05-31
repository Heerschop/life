function waitForInputPlugin() {
  return {
    name: 'wait-for-input',
    async buildStart(options) {
      const inputSpecifiers =
        typeof options.input === 'string'
          ? [options.input]
          : Array.isArray(options.input)
            ? options.input
            : Object.keys(input);

      let lastAwaitedSpecifier = null;
      checkSpecifiers: while (true) {
        for (const specifier of inputSpecifiers) {
          if (await this.resolve(specifier) === null) {
            if (lastAwaitedSpecifier !== specifier) {
              console.log(`Waiting for input "${specifier}"...`);
              lastAwaitedSpecifier = specifier;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            continue checkSpecifiers;
          }
        }
        break;
      }
    }
  };
}

export default {
  input: 'tmp/main.js',
  treeshake: true,
  output: {
    file: 'dist/bundle.js',
    format: 'cjs'
  },
  plugins: [waitForInputPlugin()]
};
