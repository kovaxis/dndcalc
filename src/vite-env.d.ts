/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module '*.md' {
    // When "Mode.HTML" is requested
    const html: string;

    export { html };
}
