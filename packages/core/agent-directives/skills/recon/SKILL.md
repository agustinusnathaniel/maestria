---
description: Map unfamiliar code before changing it (entry points, call chains, data flow, boundaries, and conventions) and stop once every place the change must reach is known. Use when a change touches code you have not read or the affected surface is unclear; not for single-file lookups.
name: recon
---

# Recon

Start from the user-facing entry points relevant to the request, then trace call chains, module relationships, data flow, boundaries where data crosses modules or APIs, dependencies, and conventions.

Expand only until you can name every place the change must reach, then list them before editing: the files and symbols to change, every other consumer of a contract you will change, and the project docs or decisions that constrain the change. Negative findings count: "nothing else calls this" is evidence you checked. Verify an inferred claim before relying on it; if evidence stays incomplete, state what you tried and what you did not find.

Do not edit during recon; when the map is complete, continue with the change in the same session. When installed, use a browser-automation skill for web or Electron verification and a diagramming skill for architecture visualization.
