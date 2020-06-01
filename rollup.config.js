import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/main.ts',
  treeshake: true,
  output: {
    file: 'dist/bundle.js',
    format: 'cjs',
    sourcemap: true
  },
  plugins: [typescript()]
};
