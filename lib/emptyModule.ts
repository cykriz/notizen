// Empty stub aliased in for Node built-ins (`fs`, `path`, `crypto`) in the
// browser bundle only (see next.config.ts turbopack.resolveAlias). The neural
// TTS engine's emscripten glue references these inside dead Node-only branches
// that never run in the browser, so an empty object satisfies the bundler
// without pulling Node built-ins into the client. Server code keeps the real
// modules via the default resolve condition.
const emptyModule = {};
export default emptyModule;
