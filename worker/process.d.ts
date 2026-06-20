// Satisfies tsc for the worker config; esbuild's `define` substitutes the
// expression with a string literal at bundle time so `process` is never
// accessed at runtime in the WebWorker.
declare const process: { env: { SW_BUILD_ID: string } };
