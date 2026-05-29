'use client'

// Wizard step 0 (scan) — the shell imports './steps/StepScan' as a default
// export. The implementation lives in SiteScanner; this re-export keeps the
// descriptive filename while matching the shell's import contract.
export { default } from './SiteScanner'
