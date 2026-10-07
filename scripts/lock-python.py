"""Pin the installed dependency closure for the supported Windows runtime.

Run with the matching prepared interpreter: python scripts/lock-python.py backend|maia.
The Maia package itself is vendored and deliberately excluded from the lock.
"""
from importlib.metadata import distribution
from pathlib import Path
import sys

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name

kind = sys.argv[1]
roots = {
    "backend": ["fastapi", "python-chess", "uvicorn[standard]", "pytest", "httpx", "pyinstaller"],
    "maia": ["torch", "numpy", "huggingface-hub", "python-chess", "pyinstaller"],
}[kind]
visited = set()
versions = {}
pending = [Requirement(root) for root in roots]
while pending:
    requirement = pending.pop()
    name = canonicalize_name(requirement.name)
    extras = tuple(sorted(requirement.extras))
    if (name, extras) in visited:
        continue
    visited.add((name, extras))
    package = distribution(name)
    versions[name] = package.version
    for raw in package.requires or []:
        dependency = Requirement(raw)
        if dependency.marker is None or any(dependency.marker.evaluate({"extra": extra}) for extra in ("", *extras)):
            pending.append(dependency)
filename = "constraints-python.txt" if kind == "backend" else "constraints-maia.txt"
Path(filename).write_text(
    "# Locked from the tested Windows Python 3.12 environment.\n"
    "# Regenerate with the matching interpreter and scripts/lock-python.py.\n"
    + "".join(f"{name}=={versions[name]}\n" for name in sorted(versions)),
    encoding="utf-8",
)
