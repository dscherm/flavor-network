# Cleanup — Requirements

## Overview
Post-consolidation dead code removal, dependency audit, stale file cleanup, and consistency fixes across the project infrastructure.

## Current State
- `@tensorflow/tfjs` (4.22.0) installed but never imported from app code (only in unused `src/ml/embeddings.js`)
- `tesseract.js` (7.0.0) imported only in `src/ml/ocr.js` which is never imported by any app code
- `src/ml/` directory (4 files) is entirely dead — no imports from components or hooks
- `src/hooks/useFlavorData.js` is dead code (legacy Flavor Bible loader, replaced by useProData)
- `src/data/loader.js` only imported by useFlavorData.js (dead chain)
- `src/components/NetworkScene.jsx` still used by CocktailLab and SauceLab (KEEP)
- `scripts/train.js` referenced by `npm run train` but trains legacy skip-gram model (replaced by GAT)
- 6 legacy CSV files in `public/data/` not loaded by the app
- `package.json` "train" script points to stale code
- `.claude/memories.md` has outdated memory referencing Flavor Bible as data source
- `.claude/specs/ml-embeddings.md` references skip-gram training (replaced by GAT, then simplified)
- `.claude/specs/walkthrough-demo.md` references 9-step tour (now 7 steps)
- `data-engineer` agent definition references `src/ml/` which will be removed

## Target State
- Zero unused npm dependencies
- Zero dead source files
- Zero stale spec/memory references
- All agent definitions accurate to current codebase
- Legacy data files removed from public/data/ (keep only actively loaded files)
- Package.json scripts all functional

## Acceptance Criteria
1. `@tensorflow/tfjs` removed from dependencies
2. `tesseract.js` removed from dependencies (or justified if OCR is planned)
3. `src/ml/` directory removed entirely
4. `src/hooks/useFlavorData.js` removed
5. `src/data/loader.js` removed
6. `scripts/train.js` removed, "train" script removed from package.json
7. Legacy CSVs removed from `public/data/` (keep: cocktail_augment.json, sauce_augment.json, cuisine_map.json, season_region.json)
8. `.claude/memories.md` outdated entries updated or removed
9. `.claude/specs/` stale specs updated to reflect current state
10. Agent definitions accurate (data-engineer no longer references src/ml/)
11. `npm run build` passes after all changes
