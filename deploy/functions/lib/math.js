// =============================================================================
// SPARTAN CUT ESTIMATOR — Math Engine v2.1 (server-only)
//
// Imports the species DB from ./species-db.js (also server-only). All cut and
// time calculations happen here. The frontend calls /api/estimate which calls
// compute() — the math itself never reaches the browser.
// =============================================================================

import {
  SPECIES,
  BRUSH_SEC_PER_CUT,
  LOG_SEC_PER_CUT,
  BRUSH_DIAM_DIST,
  ABSORB_PROFILES
} from './species-db.js';

export function greenWeightLbs(sp, dbh_in) {
  const dbh_cm = dbh_in * 2.54;
  const dryKg = Math.exp(sp.b0 + sp.b1 * Math.log(dbh_cm));
  return dryKg * sp.moisture * 2.20462;
}

export function autoHeightFt(sp, dbh_in) {
  return Math.round(4.5 + sp.heightA * (1 - Math.exp(-sp.heightB * dbh_in)));
}

export function autoCrownRadiusFt(sp, dbh_in) {
  return Math.round((sp.crownIntercept + sp.crownSlope * dbh_in) / 2);
}

function greenDensityLbsPerFt3(sp) {
  return sp.sg * 62.4 * sp.moisture;
}

function cutsFromMass(massLbs, avgDiamIn, cutLengthFt, density, forkMult) {
  if (massLbs <= 0) return 0;
  const radiusFt = (avgDiamIn / 2) / 12;
  const xsArea = Math.PI * radiusFt * radiusFt;
  const volume = massLbs / density;
  const linearFt = volume / xsArea;
  return Math.max(1, Math.round((linearFt / cutLengthFt) * forkMult));
}

function logCuts(massLbs, avgDiamIn, cutLengthFt, density) {
  if (massLbs <= 0) return 0;
  const radiusFt = (avgDiamIn / 2) / 12;
  const xsArea = Math.PI * radiusFt * radiusFt;
  const volume = massLbs / density;
  const linearFt = volume / xsArea;
  return Math.max(1, Math.round(linearFt / cutLengthFt));
}

function splitLogMassByClass(dbh_in, totalLogMass) {
  if (dbh_in <= 18) return { c12_18: totalLogMass, c18_24: 0, c24plus: 0 };
  if (dbh_in <= 24) return { c12_18: totalLogMass * 0.40, c18_24: totalLogMass * 0.60, c24plus: 0 };
  return { c12_18: totalLogMass * 0.30, c18_24: totalLogMass * 0.35, c24plus: totalLogMass * 0.35 };
}

export function compute(speciesKey, dbh_in, trimPct) {
  const sp = SPECIES[speciesKey];
  if (!sp) throw new Error('unknown species: ' + speciesKey);

  const grp = sp.diamGroup;
  const brushDist = BRUSH_DIAM_DIST[grp];
  const absorb = ABSORB_PROFILES[sp.absorbProfile] || ABSORB_PROFILES.hardwood;

  const totalGreen = greenWeightLbs(sp, dbh_in);
  const density = greenDensityLbsPerFt3(sp);

  // Pre-existing trim reduces total tree mass proportionally — applies to both
  // brush and log mass since trim work can include lead removal, not just
  // small branches.
  const trimMult = 1 - (trimPct / 100);
  const brushMass = totalGreen * sp.brushFrac * trimMult;
  const logMass = totalGreen * (1 - sp.brushFrac) * trimMult;
  const woodyBrushMass = brushMass * (1 - sp.foliageFrac);

  // Raw mass distribution by diameter class
  const m_lt4_raw   = woodyBrushMass * brushDist.frac_lt4;
  const m_4to8_raw  = woodyBrushMass * brushDist.frac_4to8;
  const m_8to12     = woodyBrushMass * brushDist.frac_8to12;

  // Absorption: smaller-class mass that's structurally attached to larger
  // limbs comes down with the larger cut. Subtract that share before counting
  // smaller-class cuts so we don't double-count cuts on the same physical
  // section. The mass itself is still in brushMass for chip-volume calcs.
  const m_4to8 = m_4to8_raw * (1 - absorb['4to8']);
  const m_lt4  = m_lt4_raw  * (1 - absorb.lt4);

  // Cut counts — segment the isolated mass into 15-ft sections, with fork
  // multipliers since branches don't run in straight lines.
  const fork_lt4   = grp === 'conifer' ? 1.20 : 1.50;
  const fork_4to8  = grp === 'conifer' ? 1.10 : 1.30;
  const fork_8to12 = 1.15;

  const cuts_lt4   = cutsFromMass(m_lt4,   brushDist.d_avg_lt4,   15, density, fork_lt4);
  const cuts_4to8  = cutsFromMass(m_4to8,  brushDist.d_avg_4to8,  15, density, fork_4to8);
  const cuts_8to12 = cutsFromMass(m_8to12, brushDist.d_avg_8to12, 15, density, fork_8to12);

  const sec_brush_lt4   = cuts_lt4   * BRUSH_SEC_PER_CUT.lt4;
  const sec_brush_4to8  = cuts_4to8  * BRUSH_SEC_PER_CUT['4to8'];
  const sec_brush_8to12 = cuts_8to12 * BRUSH_SEC_PER_CUT['8to12'];

  const brushCuts = cuts_lt4 + cuts_4to8 + cuts_8to12;
  const brushSecTotal = sec_brush_lt4 + sec_brush_4to8 + sec_brush_8to12;

  // Logs — no absorption (log cuts are structural, not branch hierarchy)
  const split = splitLogMassByClass(dbh_in, logMass);
  const cuts_log12_18  = logCuts(split.c12_18,  15, 8, density);
  const cuts_log18_24  = logCuts(split.c18_24,  21, 8, density);
  const cuts_log24plus = logCuts(split.c24plus, Math.max(28, dbh_in - 4), 8, density);
  const sec_log12_18   = cuts_log12_18  * LOG_SEC_PER_CUT['12to18'];
  const sec_log18_24   = cuts_log18_24  * LOG_SEC_PER_CUT['18to24'];
  const sec_log24plus  = cuts_log24plus * LOG_SEC_PER_CUT['24plus'];

  const logCutsTotal = cuts_log12_18 + cuts_log18_24 + cuts_log24plus;
  const logSec = sec_log12_18 + sec_log18_24 + sec_log24plus;
  const totalSec = brushSecTotal + logSec;

  return {
    speciesName: sp.name,
    speciesGroup: sp.group,
    handlingProfile: sp.brushHandling,

    autoHeight: autoHeightFt(sp, dbh_in),
    autoCrown: autoCrownRadiusFt(sp, dbh_in),

    totalGreen,
    brushMass,
    logMass,

    brushBreakdown: [
      { label: 'Brush <4″',  diam: '<4″',  cutLen: 15, cuts: cuts_lt4,   sec: BRUSH_SEC_PER_CUT.lt4,    total: sec_brush_lt4   },
      { label: 'Brush 4–8″', diam: '4–8″', cutLen: 15, cuts: cuts_4to8,  sec: BRUSH_SEC_PER_CUT['4to8'], total: sec_brush_4to8  },
      { label: 'Brush 8–12″',diam: '8–12″',cutLen: 15, cuts: cuts_8to12, sec: BRUSH_SEC_PER_CUT['8to12'],total: sec_brush_8to12 }
    ],
    logBreakdown: [
      { label: 'Log 12–18″', diam: '12–18″', cutLen: 8, cuts: cuts_log12_18,  sec: LOG_SEC_PER_CUT['12to18'], total: sec_log12_18  },
      { label: 'Log 18–24″', diam: '18–24″', cutLen: 8, cuts: cuts_log18_24,  sec: LOG_SEC_PER_CUT['18to24'], total: sec_log18_24  },
      { label: 'Log 24″+',   diam: '24″+',   cutLen: 8, cuts: cuts_log24plus, sec: LOG_SEC_PER_CUT['24plus'], total: sec_log24plus }
    ],

    brushCuts,
    logCutsTotal,
    totalCuts: brushCuts + logCutsTotal,
    brushSecTotal,
    logSec,
    totalSec
  };
}
