#!/usr/bin/env python3
"""Publie les erreurs de compilation Rust en annotations GitHub Actions.

Les journaux de job sont hébergés sur un stockage externe ; les annotations,
elles, sont accessibles via l'API GitHub. Ce script transforme la sortie de
`cargo` en annotations lisibles, pour que les erreurs soient exploitables même
sans téléchargement du journal complet.

Usage : python .github/scripts/annotate-cargo.py cargo-check.log
"""

from __future__ import annotations

import re
import sys

# La console Windows des runners n'est pas en UTF-8 par défaut.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except AttributeError:  # pragma: no cover
    pass

ANSI = re.compile(r"\x1b\[[0-9;]*m")

MAX_BLOCKS = 12
MAX_CHARS = 8000
FULL_LOG_CHARS = 30000
TAIL_LINES = 40

ERROR_START = re.compile(r"^error(\[E\d+\])?:")


def encode(text: str) -> str:
    """Encodage attendu par les commandes de workflow GitHub Actions."""
    return (
        ANSI.sub("", text)
        .replace("%", "%25")
        .replace("\r", "")
        .replace("\n", "%0A")
    )


def encode_property(value: str) -> str:
    """Les propriétés d'une commande sont séparées par des virgules."""
    return encode(value).replace(",", "%2C").replace(":", "%3A")


def emit(title: str, message: str, location: tuple[str, str, str] | None = None) -> None:
    properties = [f"title={encode_property(title[:180])}"]
    if location:
        file_name, line, column = location
        properties.append(f"file={encode_property(file_name)}")
        properties.append(f"line={line}")
        properties.append(f"col={column}")
    print(f"::error {','.join(properties)}::{encode(message[:MAX_CHARS])}")


def main(path: str) -> int:
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            lines = handle.read().splitlines()
    except OSError:
        emit("Rust - journal introuvable", f"Impossible de lire {path}.")
        return 1

    blocks: list[list[str]] = []
    current: list[str] | None = None

    for line in lines:
        if ERROR_START.match(line.strip()):
            if current:
                blocks.append(current)
            current = [line]
            continue
        if current is None:
            continue
        if line.strip() == "" and len(current) > 2:
            blocks.append(current)
            current = None
            continue
        if len(current) < 25:
            current.append(line)

    if current:
        blocks.append(current)

    if not blocks:
        emit("Rust - echec sans message d erreur", "\n".join(lines)[-FULL_LOG_CHARS:])
        return 0

    for block in blocks[:MAX_BLOCKS]:
        location = None
        for line in block[1:8]:
            match = re.match(r"\s*-->\s*(.+?):(\d+):(\d+)", line)
            if match:
                location = (match.group(1), match.group(2), match.group(3))
                break
        body = "\n".join(block)
        emit(block[0], body, location)

    if len(blocks) > MAX_BLOCKS:
        emit(
            "Rust - erreurs supplementaires",
            f"{len(blocks) - MAX_BLOCKS} autre(s) erreur(s). Voir le journal du job.",
        )

    emit("Rust - extrait complet du journal", "\n".join(lines)[-FULL_LOG_CHARS:])
    print(f"{len(blocks)} bloc(s) d'erreur publié(s) en annotation.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "cargo-check.log"))
