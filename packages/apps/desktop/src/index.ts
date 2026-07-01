// @almanac/desktop — Tauri shell (primary client; system webview, low memory).
// Phase 2 wires the Tauri (Rust) backend + Vite React renderer and the calendar
// shell UI. Apps are the top layer: they may import core, kernels, modules (§4).
import { CORE_VERSION } from '@almanac/core';

export function bootInfo(): string {
  return `Almanac desktop (core ${CORE_VERSION})`;
}
