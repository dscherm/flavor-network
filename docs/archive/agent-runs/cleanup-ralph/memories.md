## Patterns

### mem-20260324-p01
> Dead code chains: useFlavorData.js → loader.js was a 2-file dead chain. src/ml/ (4 files) was entirely unreferenced. Always trace the full import chain before deleting — a file imported only by dead code is also dead.
<!-- tags: dead-code, import-chain | created: 2026-03-24 -->

## Decisions

### mem-20260324-d01
> Removed @tensorflow/tfjs and tesseract.js. TF was only in dead src/ml/embeddings.js. Tesseract only in dead src/ml/ocr.js. Neither had any live import path. 42 sub-packages removed with TF uninstall.
<!-- tags: dependencies, cleanup | created: 2026-03-24 -->

## Fixes

## Context

### mem-20260324-c01
> Cleanup completed 2026-03-24. Removed: src/ml/ (4 files, 15.7KB), useFlavorData.js, loader.js, scripts/train.js, 8 legacy CSVs (1.95MB), @tensorflow/tfjs, tesseract.js. Updated: memories.md, data-engineer agent, CLAUDE.md. All 6 tasks complete, build passes.
<!-- tags: cleanup, summary | created: 2026-03-24 -->
