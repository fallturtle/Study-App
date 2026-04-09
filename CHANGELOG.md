# Changelog

## 0.2.0 - 2026-04-09
- Expanded the app into a stronger one-shot version with CRUD-like deletion for notes/cards/materials.
- Added AI generation from all materials and improved status messaging.
- Added backup export/import support (JSON).
- Added stronger progress metrics (due count and collection totals).
- Improved PDF/noisy text handling across upload + AI generation.

## 0.1.1 - 2026-04-09
- Fixed browser runtime issue causing blank app page in Codespaces previews by removing CommonJS dependency from browser entry.
- Improved AI text cleaning for PDFs and noisy/binary inputs.
- Added PDF upload handling fallback for scanned/encoded PDFs with user-facing guidance text.
- Added tests to verify PDF marker cleanup and non-gibberish AI summary output.

## 0.1.0 - 2026-04-08
- Initial Cognify MVP scaffold.
