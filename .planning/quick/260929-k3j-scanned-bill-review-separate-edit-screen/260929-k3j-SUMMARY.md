# Quick 260929-k3j Summary

Scanned-item editing moved to a separate ScanItemsEditor screen (store step 2), photo card is now the "scanned bill review container" with outline Retake + Edit, photo h-48, and scanCheck persisted in the bill store.

Commits: 334d1e2 (store), 2bdf979 (ScanItemsEditor + page routing), b963aee (SetupStep).

Ordering: in SetupStep, setItems -> setScanCheck -> setStep(2), so items exist before the page routes to step 2. Mismatch test asserts step===2 and items length 1.

Tests: 15 failures in 7 files, identical to the known pre-existing list. tsc clean. WizardShell unmodified.

Deviations: none.
