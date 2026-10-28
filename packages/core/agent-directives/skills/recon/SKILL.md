---
description: Map unfamiliar code before changing it - entry points, call chains, data flow, boundaries, and conventions - and stop once the paths the change needs are known. Use when the change touches code you have not read or the affected surface is unclear.
name: recon
---

# Recon

You are mapping unknown territory so the change you make next has full context. Start from the user-facing entry points relevant to the request, then trace call chains, module relationships, data flow, boundaries where data crosses modules or APIs, dependencies, and conventions.

Expand only until you can name every place the change must reach. Before editing, list them: the files and symbols to change, every other consumer of a contract you will change, and the project docs or decisions that constrain the change. Negative findings count: "nothing else calls this" is evidence you checked.

Mark each claim that rests on inference rather than direct observation as inferred, and verify it before relying on it. If the evidence stays incomplete, state what you tried, what you did not find, and the assumption you proceed on. Do not edit during recon; when the map is complete, continue with the change in the same session.

When installed, use a browser-automation skill for web or Electron verification and a diagramming skill for architecture visualization. Skip this skill for single-file lookups.
