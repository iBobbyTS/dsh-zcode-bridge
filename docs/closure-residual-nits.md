# closure-acceptance residual NIT ledger

This ledger contains non-blocking cleanup observations only. npm compatibility, mandatory successor gaps, and unproven cross-process arbitration/approval settlement are acceptance constraints, recorded separately; they are not downgraded to NITs.

| ID | Observation | Disposition / evidence |
|---|---|---|
| N01 | New collaboration/history panel labels are English, as are the existing parity subpanels. | Follow-up localization; `packages/client/parity-controls.jsx`. Settings' existing zh/en strings remain in place. |
| N02 | Historical development probes retain deleted-fork imports and old numbered names. | Retained for provenance, outside production startup; e.g. `scripts/check-conversation-runtime-live.ts` and `scripts/install-probe.ts`. Current npm entry does not import them. interaction-plan-review-trust handoff already records the stale probe limitation. |
| N03 | session-directory-lifecycle handoff records five slot-A NITs, one closed by repair, with the others outside that packet. Original detail is not present in the supplied handoffs/review files. | Carry forward **four unspecified historical NITs, details unverified**; parent must attach the original review if further disposition is needed. No invented findings or closure claims. Local workflow source: `.agent-work/handoffs/session-directory-lifecycle.md`, repair-wave-1 status and B-3. |

Closed before closure-acceptance: contract/counter wording (session-create); obsolete real frame-causality explanation (conversation-runtime); ACK fallback and recovery-script documentation (session-directory-lifecycle); workflow action receipt label (queue-guide-goal). These are handoff facts, not new independent reviews.
