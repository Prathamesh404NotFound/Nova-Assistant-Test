/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Nova AI OS — Personal AI Operating System
 *
 * NOTE: The app is bootstrapped via src/main.tsx which renders
 * BrowserRouter + providers + routes directly.
 * This component exists as the package entry and a fallback shell.
 */

export default function App() {
  return (
    <div className="min-h-screen bg-[#06060c] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] animate-pulse mx-auto mb-4" />
        <p className="text-sm text-[#6e6e8a]">Nova AI OS loading...</p>
      </div>
    </div>
  );
}
