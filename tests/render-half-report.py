#!/usr/bin/env python3
"""Render a concise first-half statistical comparison without claiming full calibration."""
import json
from pathlib import Path
p=Path(__file__).resolve().parent.parent
j=json.loads((p/'calibration/sinnoh-genuine-tm-first-half.json').read_text())
assert j['completedFirstHalf'] and not j['completed90Minutes'] and j['goalLedgerConsistent']
lines=[
'# PokeFC — Genuine TacticMesh first-half calibration audit',
'',
'**Fixture:** '+j['fixture']['home']+' vs '+j['fixture']['away'],
'**Result at halftime:** '+str(j['score']['home'])+'–'+str(j['score']['away']),
'**Engine:** original TacticMesh, SHA-verified pinned source '+j['sourceCommit'],
'**Simulation:** '+str(j['gameMinutes'])+' in-game minutes · '+format(j['ticks'],',')+' real 60Hz ticks · '+str(j['elapsedWallSeconds'])+' seconds of processing',
'**Quick Sim:** '+format(j['quickSimReplicates'],',')+' complete simulated games, first-half expectations shown',
'',
'| Team | Metric | Real TacticMesh half | Quick Sim expected half | Difference |',
'|---|---|---:|---:|---:|',
]
for t in j['comparison']:
    for k in ['goals','shots','passes','completedPasses','tackles','assists']:
        lines.append(f"| {t['team']} | {k} | {t['tacticmesh'][k]} | {t['quickSimExpectedFirstHalf'][k]} | {t['differenceTMminusQuick'][k]} |")
lines += ['', '### Goals observed']
if j['goalEvents']:
    for e in j['goalEvents']:
        lines.append(f"- {e['minute']} — {e['scorerName'] or e['scorerId']} ({e['teamId']})")
else: lines.append('No goals in the first half.')
lines += ['', '### Interpretation',
 '- The original match ran for an actual first half. This was not an abbreviated-duration match and no event data was fabricated.',
 '- The halftime event ledger agrees with the authoritative engine score; franchise state was unchanged.',
 '- Quick Sim means for shots, passes and tackles are calculated as 50% of 90-minute Monte Carlo totals; goals and assists use first-half timestamps. The genuine first half included one minute of stoppage time (46 vs 45 minutes), so these are approximate rate comparisons.',
 '- One 45-minute TacticMesh segment provides an initial diagnostic **only**. Do not treat it as a statistically calibrated 90-minute model.',
 '- No Pokémon rating formulas, Quick Sim parameters, or original TacticMesh source files were modified.',
 '', '### Files',
 '- `calibration/sinnoh-genuine-tm-first-half.json`: original event ledger, player/team stats, compare output, integrity checks',
 '- `calibration/sinnoh-first-half-engine-checkpoint.json`: genuine halfway engine snapshot, usable for future continuation',
 '- `tests/benchmark-45min.cjs`: reproducible benchmark and Quick Sim comparison',
 '', 'To repeat: `python3 run_45min_test.py` (or add `--resume` after an interruption).',
]
(p/'TM_45MIN_COMPARISON.md').write_text('\n'.join(lines)+'\n')
print('Created '+str(p/'TM_45MIN_COMPARISON.md'))
