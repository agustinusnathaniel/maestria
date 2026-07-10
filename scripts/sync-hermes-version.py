#!/usr/bin/env python3
"""Sync @maestria/hermes version from package.json to _version.py.

Called by the CI release workflow after `changeset version` bumps
the package.json version. Ensures the Python _version.py file stays
in sync for PyPI wheel builds.
"""

import json
from pathlib import Path


HERMES_PKG = Path(__file__).resolve().parent.parent / "packages" / "hermes"
PKG_JSON = HERMES_PKG / "package.json"
VERSION_PY = HERMES_PKG / "src" / "maestria_hermes" / "_version.py"


def main() -> None:
    if not PKG_JSON.exists():
        print(f"SKIP: {PKG_JSON} not found")
        return

    pkg = json.loads(PKG_JSON.read_text(encoding="utf-8"))
    version = pkg.get("version", "")
    if not version:
        print(f"SKIP: no version in {PKG_JSON}")
        return

    VERSION_PY.write_text(f'"""Package version -- single source of truth."""\n__version__ = "{version}"\n')
    print(f"OK: synced version {version} to {VERSION_PY}")


if __name__ == "__main__":
    main()
