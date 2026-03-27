import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, ReferenceLine, LineChart, Line
} from "recharts";

/* ── thescan.at brand colors ── */
const COLORS = {
  primary: "#2F7CFF",
  primaryDark: "#1863DC",
  orange: "#F17C20",
  teal: "#4EBA9A",
  grayBlue: "#697687",
  dark: "#2B2D42",
  white: "#FFFFFF",
  lightBg: "#F7F8FA",
  cardBorder: "#E8EBF0",
  scenarioA: "#F17C20",
  scenarioB: "#2F7CFF",
  red: "#DC2626",
};

const fmt = (v) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtShort = (v) => {
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M €`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k €`;
  return `${v.toFixed(0)} €`;
};
const pct = (v) => `${(v * 100).toFixed(1)}%`;

const defaultCostPct = {
  hilfsstoffe: 0.1,
  wareneinkauf: 0.34,
  verbrauchsmaterial: 3.8,
  fremdleistungen: 4.8,
  gehaelter: 14.17,
  sonderzahlungen: 2.6,
  sozialabgaben: 4.0,
  softwareWartung: 3.0,
  strom: 3.27,
  sonstigeKosten: 6.0,
};

const costLabels = {
  hilfsstoffe: "Hilfsstoffverbrauch",
  wareneinkauf: "Wareneinkauf (ig. Erwerb)",
  verbrauchsmaterial: "Verbrauchs- u. Hilfsmaterial",
  fremdleistungen: "Fremdleistungen",
  gehaelter: "Gehälter",
  sonderzahlungen: "Sonderzahlungen",
  sozialabgaben: "Sozialabgaben",
  softwareWartung: "Software & Wartung",
  strom: "Strom / Energie",
  sonstigeKosten: "Sonstige Kosten",
};

const coreOnlyCosts = new Set([
  "strom", "sonderzahlungen", "gehaelter",
  "fremdleistungen", "softwareWartung", "sozialabgaben"
]);

const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const defaultMonthlyAdj = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const defaultParams = {
  operatingStart: 7,
  operatingEnd: 17,
  daysPerWeek: 5,
  weeksPerYear: 48,
  coreScansPerHour: 5,
  coreRevenuePerScan: 170,
  // Scenario A
  scenarioA_extraHours: 0,
  scenarioA_scansPerHour: 5,
  scenarioA_revenuePerScan: 170,
  scenarioA_sickDayPct: 0,
  scenarioA_standbyEnabled: false,
  scenarioA_standbyCost: 2000,
  // Scenario B
  scenarioB_extraHours: 10,
  scenarioB_scansPerHour: 5,
  scenarioB_revenuePerScan: 170,
  scenarioB_fremdpersonalPerHour: 120,
  scenarioB_sickDayPct: 0,
  scenarioB_standbyEnabled: false,
  scenarioB_standbyCost: 2000,
};

/* ── Reusable Components ── */
const InputField = ({ label, value, onChange, suffix, min, step = 1 }) => (
  <div className="mb-3">
    <label className="block text-xs font-semibold mb-1" style={{ color: COLORS.grayBlue }}>{label}</label>
    <div className="flex items-center">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        step={step}
        className="w-full px-3 py-2 border rounded-md text-sm transition-all focus:outline-none focus:ring-2"
        style={{ borderColor: COLORS.cardBorder, color: COLORS.dark }}
      />
      {suffix && <span className="ml-2 text-xs whitespace-nowrap" style={{ color: COLORS.grayBlue }}>{suffix}</span>}
    </div>
  </div>
);

const Toggle = ({ label, checked, onChange, color = COLORS.primary }) => (
  <div className="flex items-center gap-2 mb-3">
    <button
      onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
      style={{ backgroundColor: checked ? color : "#D0D5D2" }}
    >
      <div
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
        style={{ left: checked ? 20 : 2 }}
      />
    </button>
    <span className="text-xs font-semibold" style={{ color: checked ? color : COLORS.grayBlue }}>{label}</span>
  </div>
);

const CostRow = ({ label, value, onChange, coreOnly }) => (
  <div className="flex items-center gap-2 py-1.5 border-b" style={{ borderColor: `${COLORS.cardBorder}88` }}>
    <span className="flex-1 text-xs" style={{ color: COLORS.grayBlue }}>
      {label}
      {coreOnly && <span className="ml-1 text-[9px]" style={{ color: COLORS.orange }} title="In Szenario B nur auf Kernbetrieb-Umsatz berechnet">&#9679;</span>}
    </span>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      step={0.1}
      className="w-20 px-2 py-1 border rounded-md text-xs text-right font-semibold focus:outline-none focus:ring-1"
      style={{ borderColor: COLORS.cardBorder, color: COLORS.primary, backgroundColor: `${COLORS.primary}08` }}
    />
    <span className="text-xs w-4" style={{ color: COLORS.grayBlue }}>%</span>
  </div>
);

const KPI = ({ title, valueA, valueB, format = "currency", highlight = false }) => {
  const f = format === "currency" ? fmt : format === "pct" ? pct : (v) => Math.round(v).toLocaleString("de-AT");
  return (
    <div
      className="rounded-md p-3.5 transition-shadow hover:shadow-md"
      style={{
        backgroundColor: highlight ? `${COLORS.teal}0A` : COLORS.white,
        border: `1px solid ${highlight ? COLORS.teal + "33" : COLORS.cardBorder}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="text-xs font-semibold mb-2" style={{ color: COLORS.grayBlue }}>{title}</div>
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="text-[10px] font-bold mb-0.5 uppercase tracking-wider" style={{ color: COLORS.scenarioA }}>Sz. A</div>
          <div className="text-base font-bold" style={{ color: COLORS.dark }}>{f(valueA)}</div>
        </div>
        <div className="w-px" style={{ backgroundColor: COLORS.cardBorder }} />
        <div className="flex-1">
          <div className="text-[10px] font-bold mb-0.5 uppercase tracking-wider" style={{ color: COLORS.scenarioB }}>Sz. B</div>
          <div className="text-base font-bold" style={{ color: COLORS.dark }}>{f(valueB)}</div>
        </div>
      </div>
    </div>
  );
};

const Card = ({ children, className = "" }) => (
  <div
    className={`rounded-md p-5 ${className}`}
    style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.cardBorder}`, boxShadow: "0 -1px 10px 0 rgba(172,171,171,0.15)" }}
  >
    {children}
  </div>
);

/* ── Main App ── */
export default function RadiologySimulator() {
  const [params, setParams] = useState(defaultParams);
  const [costs, setCosts] = useState(defaultCostPct);
  const [monthlyAdj, setMonthlyAdj] = useState(defaultMonthlyAdj);
  const [activeTab, setActiveTab] = useState("overview");
  const [viewMode, setViewMode] = useState("monthly");
  const [showMonthlyAdj, setShowMonthlyAdj] = useState(false);

  const up = (key) => (val) => setParams((p) => ({ ...p, [key]: val }));
  const uc = (key) => (val) => setCosts((c) => ({ ...c, [key]: val }));
  const uAdj = (idx) => (val) => setMonthlyAdj((a) => { const n = [...a]; n[idx] = val; return n; });

  const isYearly = viewMode === "yearly";
  const periodLabel = isYearly ? "Jahr" : "Monat";

  const calc = useMemo(() => {
    const {
      operatingStart, operatingEnd, daysPerWeek, weeksPerYear,
      coreScansPerHour, coreRevenuePerScan,
      scenarioA_extraHours, scenarioA_scansPerHour, scenarioA_revenuePerScan,
      scenarioA_sickDayPct, scenarioA_standbyEnabled, scenarioA_standbyCost,
      scenarioB_extraHours, scenarioB_scansPerHour, scenarioB_revenuePerScan,
      scenarioB_fremdpersonalPerHour,
      scenarioB_sickDayPct, scenarioB_standbyEnabled, scenarioB_standbyCost,
    } = params;

    const coreHoursPerDay = Math.max(0, operatingEnd - operatingStart);
    const coreHoursPerWeek = coreHoursPerDay * daysPerWeek;
    const weeksPerMonth = weeksPerYear / 12;

    // Calculate one month for a scenario, with optional monthly adjustment %
    const calcMonth = (extraHoursPerWeek, extraScansPerHour, extraRevenuePerScan, isScenarioB, adjPct, sickDayPct, standbyEnabled, standbyCost) => {
      const coreHoursMonth = coreHoursPerWeek * weeksPerMonth;
      const extraHoursMonth = extraHoursPerWeek * weeksPerMonth;
      const totalHoursMonth = coreHoursMonth + extraHoursMonth;

      // Base scans & revenue (before adjustment)
      const coreScansMonth = coreHoursMonth * coreScansPerHour;
      const extraScansMonth = extraHoursMonth * extraScansPerHour;
      const baseTotalScans = coreScansMonth + extraScansMonth;

      const coreRevenueBase = coreScansMonth * coreRevenuePerScan;
      const extraRevenueBase = extraScansMonth * extraRevenuePerScan;
      const baseRevenue = coreRevenueBase + extraRevenueBase;

      // Apply monthly adjustment
      const adjFactor = 1 + (adjPct / 100);
      const adjScans = baseTotalScans * adjFactor;
      const adjCoreRevenue = coreRevenueBase * adjFactor;
      const adjTotalRevenue = baseRevenue * adjFactor;

      // Apply sick day reduction (revenue loss)
      // If standby is enabled, sick days are covered → no revenue loss
      const sickFactor = standbyEnabled ? 1 : (1 - sickDayPct / 100);
      const finalScans = adjScans * sickFactor;
      const finalCoreRevenue = adjCoreRevenue * sickFactor;
      const finalTotalRevenue = adjTotalRevenue * sickFactor;

      // Calculate costs based on revenue
      const costBreakdown = {};
      let totalCosts = 0;

      for (const [key, pctVal] of Object.entries(costs)) {
        let val;
        if (isScenarioB && coreOnlyCosts.has(key)) {
          // These costs only scale with core revenue
          val = finalCoreRevenue * (pctVal / 100);
        } else {
          val = finalTotalRevenue * (pctVal / 100);
        }
        costBreakdown[key] = val;
        totalCosts += val;
      }

      // Fremdpersonal costs (Scenario B only)
      let fremdpersonalCosts = 0;
      if (isScenarioB) {
        fremdpersonalCosts = extraHoursMonth * scenarioB_fremdpersonalPerHour;
        totalCosts += fremdpersonalCosts;
      }
      costBreakdown.fremdpersonal = fremdpersonalCosts;

      // Standby costs
      let standbyMonthlyCost = 0;
      if (standbyEnabled) {
        standbyMonthlyCost = standbyCost;
        totalCosts += standbyMonthlyCost;
      }
      costBreakdown.standby = standbyMonthlyCost;

      // Sick day revenue loss (for display, even if covered by standby)
      const sickDayLoss = adjTotalRevenue * (sickDayPct / 100);

      const profit = finalTotalRevenue - totalCosts;
      const margin = finalTotalRevenue > 0 ? profit / finalTotalRevenue : 0;

      return {
        coreHoursMonth, extraHoursMonth, totalHoursMonth,
        coreScansMonth: coreScansMonth * adjFactor * sickFactor,
        extraScansMonth: extraScansMonth * adjFactor * sickFactor,
        totalScans: finalScans,
        coreRevenue: finalCoreRevenue,
        extraRevenue: finalTotalRevenue - finalCoreRevenue,
        totalRevenue: finalTotalRevenue,
        totalCosts, costBreakdown, fremdpersonalCosts, standbyMonthlyCost,
        sickDayLoss, sickDayPctApplied: standbyEnabled ? 0 : sickDayPct,
        profit, margin,
      };
    };

    // Calculate full scenario (12 months with individual adjustments)
    const calcFullScenario = (extraHours, extraScans, extraRev, isB, sickPct, standbyOn, standbyCostVal) => {
      const months = monthNames.map((name, i) => {
        const m = calcMonth(extraHours, extraScans, extraRev, isB, monthlyAdj[i], sickPct, standbyOn, standbyCostVal);
        return { ...m, monat: name, monthIndex: i };
      });

      // Averages and totals
      const sumField = (field) => months.reduce((s, m) => s + m[field], 0);
      const avgField = (field) => sumField(field) / 12;

      const avgMonth = {
        totalHoursMonth: avgField("totalHoursMonth"),
        totalScans: avgField("totalScans"),
        totalRevenue: avgField("totalRevenue"),
        totalCosts: avgField("totalCosts"),
        profit: avgField("profit"),
        coreRevenue: avgField("coreRevenue"),
        fremdpersonalCosts: avgField("fremdpersonalCosts"),
        standbyMonthlyCost: avgField("standbyMonthlyCost"),
        sickDayLoss: avgField("sickDayLoss"),
      };

      const year = {
        totalScans: sumField("totalScans"),
        totalRevenue: sumField("totalRevenue"),
        totalCosts: sumField("totalCosts"),
        profit: sumField("profit"),
      };

      const margin = avgMonth.totalRevenue > 0 ? avgMonth.profit / avgMonth.totalRevenue : 0;
      const costPerScan = avgMonth.totalScans > 0 ? avgMonth.totalCosts / avgMonth.totalScans : 0;
      const profitPerScan = avgMonth.totalScans > 0 ? avgMonth.profit / avgMonth.totalScans : 0;
      const profitPerHour = avgMonth.totalHoursMonth > 0 ? avgMonth.profit / avgMonth.totalHoursMonth : 0;
      const totalHoursWeek = coreHoursPerWeek + extraHours;
      const costPct = avgMonth.totalRevenue > 0 ? (avgMonth.totalCosts / avgMonth.totalRevenue) * 100 : 0;

      // Aggregate cost breakdown (average month)
      const costBreakdown = {};
      const allKeys = [...Object.keys(costLabels), "fremdpersonal", "standby"];
      for (const key of allKeys) {
        costBreakdown[key] = months.reduce((s, m) => s + (m.costBreakdown[key] || 0), 0) / 12;
      }

      return {
        months, avgMonth, year, margin, costPct,
        costPerScan, profitPerScan, profitPerHour,
        totalHoursWeek, costBreakdown,
        // Convenience aliases
        revenueMonth: avgMonth.totalRevenue,
        totalCostsMonth: avgMonth.totalCosts,
        profitMonth: avgMonth.profit,
        scansMonth: avgMonth.totalScans,
        revenueYear: year.totalRevenue,
        totalCostsYear: year.totalCosts,
        profitYear: year.profit,
        scansYear: year.totalScans,
        fremdpersonalCosts: avgMonth.fremdpersonalCosts,
        coreRevenueMonth: avgMonth.coreRevenue,
      };
    };

    const scenA = calcFullScenario(
      scenarioA_extraHours, scenarioA_scansPerHour, scenarioA_revenuePerScan,
      false, scenarioA_sickDayPct, scenarioA_standbyEnabled, scenarioA_standbyCost
    );
    const scenB = calcFullScenario(
      scenarioB_extraHours, scenarioB_scansPerHour, scenarioB_revenuePerScan,
      true, scenarioB_sickDayPct, scenarioB_standbyEnabled, scenarioB_standbyCost
    );

    const diff = {
      scansMonth: scenB.scansMonth - scenA.scansMonth,
      revenueMonth: scenB.revenueMonth - scenA.revenueMonth,
      costsMonth: scenB.totalCostsMonth - scenA.totalCostsMonth,
      profitMonth: scenB.profitMonth - scenA.profitMonth,
      scansYear: scenB.scansYear - scenA.scansYear,
      revenueYear: scenB.revenueYear - scenA.revenueYear,
      costsYear: scenB.totalCostsYear - scenA.totalCostsYear,
      profitYear: scenB.profitYear - scenA.profitYear,
    };

    // Monthly comparison data
    const monthlyData = monthNames.map((m, i) => {
      const a = scenA.months[i];
      const b = scenB.months[i];
      return {
        monat: m,
        umsatzA: Math.round(a.totalRevenue),
        umsatzB: Math.round(b.totalRevenue),
        kostenA: Math.round(a.totalCosts),
        kostenB: Math.round(b.totalCosts),
        gewinnA: Math.round(a.profit),
        gewinnB: Math.round(b.profit),
        cumGewinnA: Math.round(scenA.months.slice(0, i + 1).reduce((s, x) => s + x.profit, 0)),
        cumGewinnB: Math.round(scenB.months.slice(0, i + 1).reduce((s, x) => s + x.profit, 0)),
        cumDiff: Math.round(scenB.months.slice(0, i + 1).reduce((s, x, j) => s + x.profit - scenA.months[j].profit, 0)),
        scansA: Math.round(a.totalScans),
        scansB: Math.round(b.totalScans),
      };
    });

    // Cost comparison
    const allCostKeys = [...Object.keys(costLabels), "fremdpersonal", "standby"];
    const allCostLabels = { ...costLabels, fremdpersonal: "Fremdpersonal (Zukauf)", standby: "Bereitschaft" };
    const costCompData = allCostKeys
      .filter((key) => (scenA.costBreakdown[key] || 0) > 0 || (scenB.costBreakdown[key] || 0) > 0)
      .map((key) => ({
        name: (allCostLabels[key] || key).length > 20 ? (allCostLabels[key] || key).substring(0, 18) + "…" : (allCostLabels[key] || key),
        fullName: allCostLabels[key] || key,
        szenarioA: Math.round(scenA.costBreakdown[key] || 0),
        szenarioB: Math.round(scenB.costBreakdown[key] || 0),
      }));

    // Sensitivity
    const sensitivityData = Array.from({ length: 11 }, (_, i) => {
      const extra = i * 5;
      const withFremd = calcFullScenario(extra, scenarioB_scansPerHour, scenarioB_revenuePerScan, true, scenarioB_sickDayPct, scenarioB_standbyEnabled, scenarioB_standbyCost);
      const withoutFremd = calcFullScenario(extra, scenarioA_scansPerHour, scenarioA_revenuePerScan, false, scenarioA_sickDayPct, scenarioA_standbyEnabled, scenarioA_standbyCost);
      return {
        extraStunden: extra,
        gewinnMitZukauf: Math.round(withFremd.profitMonth),
        gewinnOhneZukauf: Math.round(withoutFremd.profitMonth),
      };
    });

    return { scenA, scenB, diff, monthlyData, costCompData, sensitivityData, coreHoursPerDay, coreHoursPerWeek, weeksPerMonth, allCostLabels };
  }, [params, costs, monthlyAdj]);

  const tabs = [
    { key: "overview", label: "Übersicht" },
    { key: "costs", label: "Kostenstruktur" },
    { key: "charts", label: "Diagramme" },
    { key: "sensitivity", label: "Sensitivität" },
  ];

  const periodMult = isYearly ? 12 : 1;

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.lightBg }}>
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div
          className="rounded-md p-6 mb-5 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${COLORS.dark} 0%, #1a1b2e 50%, ${COLORS.primaryDark}33 100%)` }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-1">
              <img src="/logo-white.png" alt="TheScan" className="h-10 object-contain" />
              <div className="w-px h-8 bg-white/20" />
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Scan-Rechner</h1>
                <p className="text-xs" style={{ color: `${COLORS.white}88` }}>Radiologie Szenario-Vergleich</p>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-full opacity-10" style={{ background: `radial-gradient(circle at 80% 50%, ${COLORS.primary}, transparent 70%)` }} />
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          {/* ═══════ LEFT SIDEBAR: Inputs ═══════ */}
          <div className="lg:w-80 flex-shrink-0 space-y-4">

            {/* ── Kernbetrieb ── */}
            <Card>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: COLORS.dark }}>
                Kernbetrieb (Sockelauslastung)
              </h2>
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: COLORS.grayBlue }}>Beginn</label>
                  <input type="number" value={params.operatingStart} onChange={(e) => up("operatingStart")(parseFloat(e.target.value)||0)} min={0} max={23}
                    className="w-full px-2 py-2 border rounded-md text-sm focus:outline-none" style={{ borderColor: COLORS.cardBorder, color: COLORS.dark }} />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: COLORS.grayBlue }}>Ende</label>
                  <input type="number" value={params.operatingEnd} onChange={(e) => up("operatingEnd")(parseFloat(e.target.value)||0)} min={0} max={23}
                    className="w-full px-2 py-2 border rounded-md text-sm focus:outline-none" style={{ borderColor: COLORS.cardBorder, color: COLORS.dark }} />
                </div>
              </div>
              <div className="text-[10px] mb-3 font-medium" style={{ color: COLORS.grayBlue }}>
                {calc.coreHoursPerDay}h/Tag × {params.daysPerWeek} Tage = <span style={{ color: COLORS.primary }} className="font-bold">{calc.coreHoursPerWeek}h/Woche</span>
              </div>
              <InputField label="Betriebstage / Woche" value={params.daysPerWeek} onChange={up("daysPerWeek")} suffix="Tage" min={1} />
              <InputField label="Betriebswochen / Jahr" value={params.weeksPerYear} onChange={up("weeksPerYear")} suffix="Wo" />
              <div className="pt-2 mt-2" style={{ borderTop: `1px solid ${COLORS.cardBorder}` }}>
                <InputField label="Untersuchungen / Stunde (Kern)" value={params.coreScansPerHour} onChange={up("coreScansPerHour")} suffix="U/h" step={0.5} min={0.5} />
                <InputField label="Umsatz / Untersuchung (Kern)" value={params.coreRevenuePerScan} onChange={up("coreRevenuePerScan")} suffix="€" min={0} />
              </div>
            </Card>

            {/* ── Monatliche Anpassung ── */}
            <div
              className="rounded-md overflow-hidden"
              style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.cardBorder}`, boxShadow: "0 -1px 10px 0 rgba(172,171,171,0.15)" }}
            >
              <button
                onClick={() => setShowMonthlyAdj(!showMonthlyAdj)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.dark }}>Monatliche Anpassung</div>
                  <div className="text-[10px]" style={{ color: COLORS.grayBlue }}>Saisonale Schwankungen (%)</div>
                </div>
                <span className="text-sm" style={{ color: COLORS.grayBlue }}>{showMonthlyAdj ? "▲" : "▼"}</span>
              </button>
              {showMonthlyAdj && (
                <div className="px-4 pb-4 space-y-1.5">
                  <p className="text-[10px] mb-2" style={{ color: COLORS.grayBlue }}>
                    Prozentuale Zu-/Abschläge pro Monat. Z.B. -10% = 10% weniger Scans als Basis.
                  </p>
                  {monthNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-8 text-xs font-semibold" style={{ color: COLORS.dark }}>{name}</span>
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        value={monthlyAdj[i]}
                        onChange={(e) => uAdj(i)(parseInt(e.target.value))}
                        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{ accentColor: monthlyAdj[i] >= 0 ? COLORS.teal : COLORS.red }}
                      />
                      <input
                        type="number"
                        value={monthlyAdj[i]}
                        onChange={(e) => uAdj(i)(parseInt(e.target.value) || 0)}
                        className="w-14 px-1 py-0.5 border rounded text-xs text-right"
                        style={{ borderColor: COLORS.cardBorder, color: monthlyAdj[i] >= 0 ? COLORS.teal : COLORS.red }}
                      />
                      <span className="text-[10px] w-3" style={{ color: COLORS.grayBlue }}>%</span>
                    </div>
                  ))}
                  <button
                    onClick={() => setMonthlyAdj([0,0,0,0,0,0,0,0,0,0,0,0])}
                    className="mt-2 text-[10px] px-2 py-1 rounded border"
                    style={{ borderColor: COLORS.cardBorder, color: COLORS.grayBlue }}
                  >
                    Alle zurücksetzen
                  </button>
                </div>
              )}
            </div>

            {/* ── Szenario A ── */}
            <div className="rounded-md p-4" style={{ backgroundColor: COLORS.white, border: `2px solid ${COLORS.scenarioA}33`, boxShadow: `0 2px 8px ${COLORS.scenarioA}11` }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-6 rounded-full" style={{ backgroundColor: COLORS.scenarioA }} />
                <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.scenarioA }}>Szenario A — Ohne Zukauf</h2>
              </div>
              <InputField label="Zusätzliche Stunden / Woche" value={params.scenarioA_extraHours} onChange={up("scenarioA_extraHours")} suffix="h" min={0} />
              <InputField label="Untersuchungen / Stunde (Zusatz)" value={params.scenarioA_scansPerHour} onChange={up("scenarioA_scansPerHour")} suffix="U/h" step={0.5} min={0.5} />
              <InputField label="Umsatz / Untersuchung (Zusatz)" value={params.scenarioA_revenuePerScan} onChange={up("scenarioA_revenuePerScan")} suffix="€" min={0} />

              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.scenarioA}22` }}>
                <InputField label="Krankenstand-Ausfallquote" value={params.scenarioA_sickDayPct} onChange={up("scenarioA_sickDayPct")} suffix="%" step={0.5} min={0} />
                <Toggle
                  label="Bereitschaft aktivieren"
                  checked={params.scenarioA_standbyEnabled}
                  onChange={up("scenarioA_standbyEnabled")}
                  color={COLORS.scenarioA}
                />
                {params.scenarioA_standbyEnabled && (
                  <InputField label="Bereitschaftskosten / Monat" value={params.scenarioA_standbyCost} onChange={up("scenarioA_standbyCost")} suffix="€/Mo" min={0} />
                )}
                {params.scenarioA_standbyEnabled && params.scenarioA_sickDayPct > 0 && (
                  <div className="text-[10px] px-2 py-1.5 rounded" style={{ backgroundColor: `${COLORS.teal}10`, color: COLORS.teal }}>
                    ✓ Bereitschaft deckt {params.scenarioA_sickDayPct}% Krankenstand ab
                  </div>
                )}
              </div>

              <div className="mt-2 pt-2 text-[10px] font-medium" style={{ borderTop: `1px solid ${COLORS.scenarioA}22`, color: COLORS.scenarioA }}>
                Gesamt: {calc.scenA.totalHoursWeek} h/Wo | ∅ {Math.round(calc.scenA.scansMonth)} Scans/Mo
              </div>
            </div>

            {/* ── Szenario B ── */}
            <div className="rounded-md p-4" style={{ backgroundColor: COLORS.white, border: `2px solid ${COLORS.scenarioB}33`, boxShadow: `0 2px 8px ${COLORS.scenarioB}11` }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-6 rounded-full" style={{ backgroundColor: COLORS.scenarioB }} />
                <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.scenarioB }}>Szenario B — Mit Zukauf</h2>
              </div>
              <InputField label="Zusätzliche Stunden / Woche" value={params.scenarioB_extraHours} onChange={up("scenarioB_extraHours")} suffix="h" min={0} />
              <InputField label="Untersuchungen / Stunde (Zusatz)" value={params.scenarioB_scansPerHour} onChange={up("scenarioB_scansPerHour")} suffix="U/h" step={0.5} min={0.5} />
              <InputField label="Umsatz / Untersuchung (Zusatz)" value={params.scenarioB_revenuePerScan} onChange={up("scenarioB_revenuePerScan")} suffix="€" min={0} />
              <InputField label="Fremdpersonal Kosten / Stunde" value={params.scenarioB_fremdpersonalPerHour} onChange={up("scenarioB_fremdpersonalPerHour")} suffix="€/h" min={0} />

              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.scenarioB}22` }}>
                <InputField label="Krankenstand-Ausfallquote" value={params.scenarioB_sickDayPct} onChange={up("scenarioB_sickDayPct")} suffix="%" step={0.5} min={0} />
                <Toggle
                  label="Bereitschaft aktivieren"
                  checked={params.scenarioB_standbyEnabled}
                  onChange={up("scenarioB_standbyEnabled")}
                  color={COLORS.scenarioB}
                />
                {params.scenarioB_standbyEnabled && (
                  <InputField label="Bereitschaftskosten / Monat" value={params.scenarioB_standbyCost} onChange={up("scenarioB_standbyCost")} suffix="€/Mo" min={0} />
                )}
                {params.scenarioB_standbyEnabled && params.scenarioB_sickDayPct > 0 && (
                  <div className="text-[10px] px-2 py-1.5 rounded" style={{ backgroundColor: `${COLORS.teal}10`, color: COLORS.teal }}>
                    ✓ Bereitschaft deckt {params.scenarioB_sickDayPct}% Krankenstand ab
                  </div>
                )}
              </div>

              <div className="mt-2 pt-2 text-[10px] font-medium" style={{ borderTop: `1px solid ${COLORS.scenarioB}22`, color: COLORS.scenarioB }}>
                Gesamt: {calc.scenB.totalHoursWeek} h/Wo | ∅ {Math.round(calc.scenB.scansMonth)} Scans/Mo
              </div>
              <div className="text-[10px] mt-1" style={{ color: COLORS.grayBlue }}>
                Fremdpersonal: <span className="font-semibold" style={{ color: COLORS.scenarioB }}>{fmt(calc.scenB.fremdpersonalCosts)}/Mo</span>
              </div>
            </div>
          </div>

          {/* ═══════ RIGHT: Results ═══════ */}
          <div className="flex-1 min-w-0">
            {/* Tabs + View Toggle */}
            <div className="flex gap-1 mb-4 rounded-md p-1 items-center" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.cardBorder}` }}>
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className="flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: activeTab === t.key ? COLORS.primaryDark : "transparent",
                    color: activeTab === t.key ? COLORS.white : COLORS.grayBlue,
                  }}>
                  {t.label}
                </button>
              ))}
              <div className="w-px h-6 mx-1" style={{ backgroundColor: COLORS.cardBorder }} />
              <div className="flex rounded-md p-0.5" style={{ backgroundColor: COLORS.lightBg }}>
                {["monthly", "yearly"].map((mode) => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    className="px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      backgroundColor: viewMode === mode ? COLORS.white : "transparent",
                      color: viewMode === mode ? COLORS.primary : COLORS.grayBlue,
                      boxShadow: viewMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}>
                    {mode === "monthly" ? "Monatlich" : "Jährlich"}
                  </button>
                ))}
              </div>
            </div>

            {/* ═══ TAB: Overview ═══ */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <KPI title={`Scans / ${periodLabel}`} valueA={isYearly ? calc.scenA.scansYear : calc.scenA.scansMonth} valueB={isYearly ? calc.scenB.scansYear : calc.scenB.scansMonth} format="number" />
                  <KPI title={`Umsatz / ${periodLabel}`} valueA={isYearly ? calc.scenA.revenueYear : calc.scenA.revenueMonth} valueB={isYearly ? calc.scenB.revenueYear : calc.scenB.revenueMonth} />
                  <KPI title={`Kosten / ${periodLabel}`} valueA={isYearly ? calc.scenA.totalCostsYear : calc.scenA.totalCostsMonth} valueB={isYearly ? calc.scenB.totalCostsYear : calc.scenB.totalCostsMonth} />
                  <KPI title={`DB / ${periodLabel}`} valueA={isYearly ? calc.scenA.profitYear : calc.scenA.profitMonth} valueB={isYearly ? calc.scenB.profitYear : calc.scenB.profitMonth} highlight />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <KPI title="Marge" valueA={calc.scenA.margin} valueB={calc.scenB.margin} format="pct" />
                  <KPI title="Kosten / Scan" valueA={calc.scenA.costPerScan} valueB={calc.scenB.costPerScan} />
                  <KPI title="DB / Scan" valueA={calc.scenA.profitPerScan} valueB={calc.scenB.profitPerScan} />
                  <KPI title="DB / Stunde" valueA={calc.scenA.profitPerHour} valueB={calc.scenB.profitPerHour} />
                </div>

                {/* Difference summary */}
                <div className="rounded-md p-4" style={{ background: `linear-gradient(135deg, ${COLORS.dark}08, ${COLORS.primary}08)`, border: `1px solid ${COLORS.primary}22` }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: COLORS.primaryDark }}>
                    Differenz B vs. A ({isYearly ? "jährlich" : "∅ monatlich"})
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    {[
                      { l: "Mehr Scans", v: isYearly ? calc.diff.scansYear : calc.diff.scansMonth, f: "n" },
                      { l: "Mehr Umsatz", v: isYearly ? calc.diff.revenueYear : calc.diff.revenueMonth, f: "c" },
                      { l: "Mehr Kosten", v: isYearly ? calc.diff.costsYear : calc.diff.costsMonth, f: "c" },
                      { l: "Mehr DB", v: isYearly ? calc.diff.profitYear : calc.diff.profitMonth, f: "c" },
                    ].map((d, i) => (
                      <div key={i}>
                        <div className="text-[10px] font-semibold" style={{ color: COLORS.grayBlue }}>{d.l}</div>
                        <div className="font-bold" style={{ color: d.v >= 0 ? COLORS.teal : COLORS.red }}>
                          {d.v >= 0 ? "+" : ""}{d.f === "c" ? fmt(d.v) : Math.round(d.v).toLocaleString("de-AT")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comparison chart */}
                <Card>
                  <h3 className="text-sm font-bold mb-3" style={{ color: COLORS.dark }}>Monatlicher Deckungsbeitrag: A vs. B</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={calc.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.cardBorder}88`} />
                      <XAxis dataKey="monat" tick={{ fontSize: 11, fill: COLORS.grayBlue }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: COLORS.grayBlue }} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 6, border: `1px solid ${COLORS.cardBorder}` }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="gewinnA" name="DB Szenario A" fill={COLORS.scenarioA} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="gewinnB" name="DB Szenario B" fill={COLORS.scenarioB} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Cumulative */}
                <Card>
                  <h3 className="text-sm font-bold mb-3" style={{ color: COLORS.dark }}>Kumulierter Deckungsbeitrag (12 Monate)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={calc.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.cardBorder}88`} />
                      <XAxis dataKey="monat" tick={{ fontSize: 11, fill: COLORS.grayBlue }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: COLORS.grayBlue }} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 6, border: `1px solid ${COLORS.cardBorder}` }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="cumGewinnA" name="Kum. DB Sz. A" stroke={COLORS.scenarioA} fill={COLORS.scenarioA} fillOpacity={0.08} strokeWidth={2} />
                      <Area type="monotone" dataKey="cumGewinnB" name="Kum. DB Sz. B" stroke={COLORS.scenarioB} fill={COLORS.scenarioB} fillOpacity={0.08} strokeWidth={2} />
                      <Area type="monotone" dataKey="cumDiff" name="Kum. Differenz" stroke={COLORS.teal} fill={COLORS.teal} fillOpacity={0.06} strokeWidth={2} strokeDasharray="5 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                {/* Monthly table */}
                <Card>
                  <h3 className="text-sm font-bold mb-3" style={{ color: COLORS.dark }}>Monatsaufstellung im Vergleich</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${COLORS.cardBorder}` }}>
                          <th className="py-2 px-2 text-left" style={{ color: COLORS.grayBlue }}>Monat</th>
                          <th className="py-2 px-2 text-right" style={{ color: COLORS.scenarioA }}>Umsatz A</th>
                          <th className="py-2 px-2 text-right" style={{ color: COLORS.scenarioB }}>Umsatz B</th>
                          <th className="py-2 px-2 text-right" style={{ color: COLORS.scenarioA }}>Kosten A</th>
                          <th className="py-2 px-2 text-right" style={{ color: COLORS.scenarioB }}>Kosten B</th>
                          <th className="py-2 px-2 text-right" style={{ color: COLORS.scenarioA }}>DB A</th>
                          <th className="py-2 px-2 text-right" style={{ color: COLORS.scenarioB }}>DB B</th>
                          <th className="py-2 px-2 text-right" style={{ color: COLORS.teal }}>Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calc.monthlyData.map((row, i) => {
                          const diffDB = row.gewinnB - row.gewinnA;
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${COLORS.cardBorder}66` }}>
                              <td className="py-1.5 px-2 font-semibold" style={{ color: COLORS.dark }}>{row.monat}</td>
                              <td className="py-1.5 px-2 text-right">{fmt(row.umsatzA)}</td>
                              <td className="py-1.5 px-2 text-right">{fmt(row.umsatzB)}</td>
                              <td className="py-1.5 px-2 text-right">{fmt(row.kostenA)}</td>
                              <td className="py-1.5 px-2 text-right">{fmt(row.kostenB)}</td>
                              <td className="py-1.5 px-2 text-right">{fmt(row.gewinnA)}</td>
                              <td className="py-1.5 px-2 text-right">{fmt(row.gewinnB)}</td>
                              <td className="py-1.5 px-2 text-right font-semibold" style={{ color: diffDB >= 0 ? COLORS.teal : COLORS.red }}>
                                {diffDB >= 0 ? "+" : ""}{fmt(diffDB)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="font-bold" style={{ borderTop: `2px solid ${COLORS.dark}`, backgroundColor: `${COLORS.dark}06` }}>
                          <td className="py-2 px-2" style={{ color: COLORS.dark }}>Gesamt</td>
                          <td className="py-2 px-2 text-right">{fmt(calc.scenA.revenueYear)}</td>
                          <td className="py-2 px-2 text-right">{fmt(calc.scenB.revenueYear)}</td>
                          <td className="py-2 px-2 text-right">{fmt(calc.scenA.totalCostsYear)}</td>
                          <td className="py-2 px-2 text-right">{fmt(calc.scenB.totalCostsYear)}</td>
                          <td className="py-2 px-2 text-right">{fmt(calc.scenA.profitYear)}</td>
                          <td className="py-2 px-2 text-right">{fmt(calc.scenB.profitYear)}</td>
                          <td className="py-2 px-2 text-right" style={{ color: calc.diff.profitYear >= 0 ? COLORS.teal : COLORS.red }}>
                            {calc.diff.profitYear >= 0 ? "+" : ""}{fmt(calc.diff.profitYear)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Detail table */}
                <Card>
                  <h3 className="text-sm font-bold mb-3" style={{ color: COLORS.dark }}>Detailvergleich ({isYearly ? "Jährlich" : "∅ Monatlich"})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${COLORS.cardBorder}` }}>
                          <th className="text-left py-2 px-2 text-xs" style={{ color: COLORS.grayBlue }}>Kennzahl</th>
                          <th className="text-right py-2 px-2 text-xs" style={{ color: COLORS.scenarioA }}>Szenario A</th>
                          <th className="text-right py-2 px-2 text-xs" style={{ color: COLORS.scenarioB }}>Szenario B</th>
                          <th className="text-right py-2 px-2 text-xs" style={{ color: COLORS.teal }}>Differenz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { l: "Betriebsstunden / Woche", a: calc.scenA.totalHoursWeek, b: calc.scenB.totalHoursWeek, u: "h" },
                          { l: `Scans / ${periodLabel}`, a: isYearly ? calc.scenA.scansYear : calc.scenA.scansMonth, b: isYearly ? calc.scenB.scansYear : calc.scenB.scansMonth },
                          { l: `Umsatz / ${periodLabel}`, a: isYearly ? calc.scenA.revenueYear : calc.scenA.revenueMonth, b: isYearly ? calc.scenB.revenueYear : calc.scenB.revenueMonth, c: true },
                          { l: `Kosten / ${periodLabel}`, a: isYearly ? calc.scenA.totalCostsYear : calc.scenA.totalCostsMonth, b: isYearly ? calc.scenB.totalCostsYear : calc.scenB.totalCostsMonth, c: true },
                          { l: "Kostenquote", a: calc.scenA.costPct / 100, b: calc.scenB.costPct / 100, p: true },
                          { l: `DB / ${periodLabel}`, a: isYearly ? calc.scenA.profitYear : calc.scenA.profitMonth, b: isYearly ? calc.scenB.profitYear : calc.scenB.profitMonth, c: true, bold: true },
                          { l: "Marge", a: calc.scenA.margin, b: calc.scenB.margin, p: true },
                          { l: "Kosten / Scan", a: calc.scenA.costPerScan, b: calc.scenB.costPerScan, c: true },
                          { l: "DB / Scan", a: calc.scenA.profitPerScan, b: calc.scenB.profitPerScan, c: true },
                          { l: "DB / Stunde", a: calc.scenA.profitPerHour, b: calc.scenB.profitPerHour, c: true },
                        ].map((row, i) => {
                          const d = row.b - row.a;
                          const fv = (v) => row.c ? fmt(v) : row.p ? pct(v) : `${Math.round(v).toLocaleString("de-AT")}${row.u ? " " + row.u : ""}`;
                          return (
                            <tr key={i} style={{
                              borderBottom: `1px solid ${COLORS.cardBorder}66`,
                              backgroundColor: row.bold ? `${COLORS.teal}08` : "transparent",
                            }}>
                              <td className={`py-1.5 px-2 text-xs ${row.bold ? "font-bold" : ""}`} style={{ color: COLORS.dark }}>{row.l}</td>
                              <td className="py-1.5 px-2 text-right text-xs">{fv(row.a)}</td>
                              <td className="py-1.5 px-2 text-right text-xs">{fv(row.b)}</td>
                              <td className="py-1.5 px-2 text-right text-xs font-semibold" style={{ color: d >= 0 ? COLORS.teal : COLORS.red }}>
                                {d >= 0 ? "+" : ""}{fv(d)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* ═══ TAB: Kostenstruktur ═══ */}
            {activeTab === "costs" && (
              <div className="space-y-4">
                <Card>
                  <h3 className="text-sm font-bold mb-1" style={{ color: COLORS.dark }}>Zentrale Kostenvariablen (% vom Umsatz)</h3>
                  <p className="text-[10px] mb-1" style={{ color: COLORS.grayBlue }}>Änderungen wirken sich auf beide Szenarien aus.</p>
                  <p className="text-[10px] mb-3" style={{ color: COLORS.orange }}>
                    <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS.orange }} />
                    = In Szenario B nur auf Kernbetrieb-Umsatz berechnet
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                    {Object.entries(costLabels).map(([key, label]) => (
                      <CostRow key={key} label={label} value={costs[key]} onChange={uc(key)} coreOnly={coreOnlyCosts.has(key)} />
                    ))}
                  </div>
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.cardBorder}` }}>
                    <div className="flex justify-between text-xs font-semibold">
                      <span style={{ color: COLORS.grayBlue }}>Summe Kostenquoten:</span>
                      <span style={{ color: COLORS.dark }}>{Object.values(costs).reduce((s, v) => s + v, 0).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold mt-1">
                      <span style={{ color: COLORS.grayBlue }}>Effektive Kostenquote Sz. A:</span>
                      <span style={{ color: COLORS.scenarioA }}>{calc.scenA.costPct.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold mt-1">
                      <span style={{ color: COLORS.grayBlue }}>Effektive Kostenquote Sz. B:</span>
                      <span style={{ color: COLORS.scenarioB }}>{calc.scenB.costPct.toFixed(2)}%</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="text-sm font-bold mb-3" style={{ color: COLORS.dark }}>Kostenvergleich nach Kategorie ({isYearly ? "jährlich" : "∅ monatlich"})</h3>
                  <ResponsiveContainer width="100%" height={Math.max(300, calc.costCompData.length * 38)}>
                    <BarChart data={calc.costCompData.map(d => isYearly ? { ...d, szenarioA: d.szenarioA * 12, szenarioB: d.szenarioB * 12 } : d)} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.cardBorder}88`} />
                      <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: COLORS.grayBlue }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: COLORS.grayBlue }} width={140} />
                      <Tooltip formatter={(v, name) => [fmt(v), name]} contentStyle={{ borderRadius: 6, border: `1px solid ${COLORS.cardBorder}` }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="szenarioA" name="Szenario A" fill={COLORS.scenarioA} radius={[0, 3, 3, 0]} />
                      <Bar dataKey="szenarioB" name="Szenario B" fill={COLORS.scenarioB} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* ═══ TAB: Charts ═══ */}
            {activeTab === "charts" && (
              <div className="space-y-4">
                <Card>
                  <h3 className="text-sm font-bold mb-3" style={{ color: COLORS.dark }}>Umsatzvergleich (12 Monate)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={calc.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.cardBorder}88`} />
                      <XAxis dataKey="monat" tick={{ fontSize: 11, fill: COLORS.grayBlue }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: COLORS.grayBlue }} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 6, border: `1px solid ${COLORS.cardBorder}` }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="umsatzA" name="Umsatz Sz. A" fill={`${COLORS.scenarioA}cc`} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="umsatzB" name="Umsatz Sz. B" fill={`${COLORS.scenarioB}cc`} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <h3 className="text-sm font-bold mb-3" style={{ color: COLORS.dark }}>Scans pro Monat</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={calc.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.cardBorder}88`} />
                      <XAxis dataKey="monat" tick={{ fontSize: 11, fill: COLORS.grayBlue }} />
                      <YAxis tick={{ fontSize: 11, fill: COLORS.grayBlue }} />
                      <Tooltip contentStyle={{ borderRadius: 6, border: `1px solid ${COLORS.cardBorder}` }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="scansA" name="Scans Sz. A" fill={`${COLORS.scenarioA}88`} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="scansB" name="Scans Sz. B" fill={`${COLORS.scenarioB}88`} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <h3 className="text-sm font-bold mb-2" style={{ color: COLORS.dark }}>Kosten Szenario A</h3>
                    <div className="space-y-1.5">
                      {Object.entries(calc.scenA.costBreakdown).filter(([,v]) => v > 0).map(([key, val]) => {
                        const maxVal = Math.max(...Object.values(calc.scenA.costBreakdown));
                        const width = maxVal > 0 ? (val / maxVal) * 100 : 0;
                        const label = calc.allCostLabels[key] || key;
                        return (
                          <div key={key} className="flex items-center gap-2 text-[10px]">
                            <span className="w-32 truncate" style={{ color: COLORS.grayBlue }}>{label}</span>
                            <div className="flex-1 rounded-full h-3" style={{ backgroundColor: `${COLORS.cardBorder}66` }}>
                              <div className="h-3 rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: COLORS.scenarioA }} />
                            </div>
                            <span className="w-16 text-right font-medium" style={{ color: COLORS.dark }}>{fmt(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                  <Card>
                    <h3 className="text-sm font-bold mb-2" style={{ color: COLORS.dark }}>Kosten Szenario B</h3>
                    <div className="space-y-1.5">
                      {Object.entries(calc.scenB.costBreakdown).filter(([,v]) => v > 0).map(([key, val]) => {
                        const maxVal = Math.max(...Object.values(calc.scenB.costBreakdown));
                        const width = maxVal > 0 ? (val / maxVal) * 100 : 0;
                        const label = calc.allCostLabels[key] || key;
                        return (
                          <div key={key} className="flex items-center gap-2 text-[10px]">
                            <span className="w-32 truncate" style={{ color: COLORS.grayBlue }}>{label}</span>
                            <div className="flex-1 rounded-full h-3" style={{ backgroundColor: `${COLORS.cardBorder}66` }}>
                              <div className="h-3 rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: key === "fremdpersonal" ? COLORS.red : key === "standby" ? COLORS.teal : COLORS.scenarioB }} />
                            </div>
                            <span className="w-16 text-right font-medium" style={{ color: COLORS.dark }}>{fmt(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* ═══ TAB: Sensitivity ═══ */}
            {activeTab === "sensitivity" && (
              <div className="space-y-4">
                <Card>
                  <h3 className="text-sm font-bold mb-3" style={{ color: COLORS.dark }}>
                    Sensitivität: DB nach Zusatzstunden ({isYearly ? "jährlich" : "∅ monatlich"})
                  </h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={calc.sensitivityData.map(d => isYearly ? { ...d, gewinnMitZukauf: d.gewinnMitZukauf * 12, gewinnOhneZukauf: d.gewinnOhneZukauf * 12 } : d)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.cardBorder}88`} />
                      <XAxis dataKey="extraStunden" tick={{ fontSize: 11, fill: COLORS.grayBlue }} label={{ value: "Zusätzliche h/Woche", position: "bottom", fontSize: 11, fill: COLORS.grayBlue, offset: -5 }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: COLORS.grayBlue }} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 6, border: `1px solid ${COLORS.cardBorder}` }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="gewinnOhneZukauf" name="DB ohne Zukauf" stroke={COLORS.scenarioA} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.scenarioA }} />
                      <Line type="monotone" dataKey="gewinnMitZukauf" name="DB mit Zukauf" stroke={COLORS.scenarioB} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.scenarioB }} />
                      <ReferenceLine y={0} stroke={COLORS.grayBlue} strokeDasharray="3 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <h3 className="text-sm font-bold mb-3" style={{ color: COLORS.dark }}>Datentabelle ({isYearly ? "Jährlich" : "∅ Monatlich"})</h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${COLORS.cardBorder}` }}>
                        <th className="py-2 px-2 text-left" style={{ color: COLORS.grayBlue }}>Extra h/Wo</th>
                        <th className="py-2 px-2 text-right" style={{ color: COLORS.scenarioA }}>DB ohne Zukauf</th>
                        <th className="py-2 px-2 text-right" style={{ color: COLORS.scenarioB }}>DB mit Zukauf</th>
                        <th className="py-2 px-2 text-right" style={{ color: COLORS.teal }}>Differenz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.sensitivityData.map((row, i) => {
                        const m = isYearly ? 12 : 1;
                        const d = row.gewinnMitZukauf - row.gewinnOhneZukauf;
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${COLORS.cardBorder}66` }}>
                            <td className="py-1.5 px-2 font-medium" style={{ color: COLORS.dark }}>{row.extraStunden} h</td>
                            <td className="py-1.5 px-2 text-right">{fmt(row.gewinnOhneZukauf * m)}</td>
                            <td className="py-1.5 px-2 text-right">{fmt(row.gewinnMitZukauf * m)}</td>
                            <td className="py-1.5 px-2 text-right font-semibold" style={{ color: d >= 0 ? COLORS.teal : COLORS.red }}>
                              {fmt(d * m)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}

            {/* Disclaimer */}
            <div className="mt-4 p-4 rounded-md text-[11px]" style={{ backgroundColor: `${COLORS.dark}06`, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.grayBlue }}>
              <strong style={{ color: COLORS.dark }}>Disclaimer:</strong> Die in diesem Rechner verwendeten Daten basieren auf statistischen Durchschnittswerten und Annahmen. Sie treffen nicht notwendigerweise auf die Realität eines spezifischen Instituts oder Betriebs zu. Dieser Rechner dient ausschließlich als Vergleichsinstrument und stellt keine betriebswirtschaftliche Beratung dar. Leasing-, Finanzierungs- und Zinsaufwendungen sind nicht berücksichtigt.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
