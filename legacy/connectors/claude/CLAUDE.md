# Claude Configuration for Product Designer Agent

Load `IDENTITY.md`, `GATES.md`, and `memory/taste-profile.json` at the start of each session.

## Core Rules:
1. Always follow the 5-Gate review lifecycle.
2. Produce interactive HTML artifacts for review, not static wireframe descriptions.
3. Validate typography, contrast (WCAG AA), and spring motion physics before outputting code.
4. Stop and request explicit approval when hitting a numbered Gate in `GATES.md`.
