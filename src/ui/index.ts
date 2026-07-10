/**
 * UI Module
 *
 * Exports the Renderer interface and built-in implementations.
 */

export type { Renderer } from "./renderer.js";
export { PlainRenderer } from "./plain-renderer.js";
export { InkRenderer } from "./ink-renderer.js";
export {
  createRenderer,
  detectRendererMode,
  type RendererMode,
} from "./factory.js";
