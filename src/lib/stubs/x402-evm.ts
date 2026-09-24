// See src/lib/stubs/README.md for why this exists.
export function toClientEvmSigner(): never {
  throw new Error(
    "x402 EVM signing is not used by Pivah — this is a stub for an unused optional dependency.",
  );
}
