# FontLens

A Chrome (Manifest V3) extension that inspects fonts on any web page and
shows the three things existing tools get wrong:

1. **Requested vs actually-rendered font** — when the page asks for "Söhne"
   but the browser fell back to Arial, FontLens flags it.
2. **Full type system of a selection** — every distinct style on an
   element (or whole page), grouped by family.
3. **Copy as CSS / Tailwind / Design Token** — one click.

All processing local. Zero network. Zero data exfiltration.

## Status

**Pre-implementation.** Design phase complete; implementation plan
pending.

- Design system: [`DESIGN.md`](DESIGN.md)
- Launch 1 product spec: [`docs/specs/launch1-design.md`](docs/specs/launch1-design.md)
- Mockup archive: [`docs/mockups/`](docs/mockups/)

## Repository layout

```
fontlens/
├── DESIGN.md                  source of truth for all visual decisions
├── README.md                  this file
├── LICENSE
├── docs/
│   ├── specs/                 versioned product specs
│   └── mockups/               brainstorm archives
├── src/                       extension source (populated during implementation)
└── assets/
    └── icons/                 16/32/48/128 PNGs + SVG sprite
```

## Build (placeholder)

Implementation has not started. Build instructions will be added with the
first source commit.

## License

See [`LICENSE`](LICENSE).
