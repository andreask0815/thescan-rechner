import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, ReferenceLine, LineChart, Line, Cell
} from "recharts";

const fmt = (v) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtShort = (v) => {
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M €`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k €`;
  return `${v.toFixed(0)} €`;
};
const pct = (v) => `${(v * 100).toFixed(1)}%`;

// Default cost structure (% of revenue)
const defaultCostPct = {
  hilfsstoffe: 0.1,
  wareneinkauf: 0.34,
  verbrauchsmaterial: 3.8,
  fremdleistungen: 4.8,
  gehaelter: 14.17,
  fremdpersonal: 19.77,
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
  fremdpersonal: "Fremdpersonal (Zukauf)",
  sonderzahlungen: "Sonderzahlungen",
  sozialabgaben: "Sozialabgaben",
  softwareWartung: "Software & Wartung",
  strom: "Strom / Energie",
  sonstigeKosten: "Sonstige Kosten",
};

const defaultParams = {
  scansPerHour: 4,
  revenuePerScan: 185,
  operatingStart: 7,
  operatingEnd: 17,
  daysPerWeek: 5,
  weeksPerYear: 48,
  scenarioA_extraHours: 0,
  scenarioB_extraHours: 10,
};

const InputField = ({ label, value, onChange, suffix, tooltip, min, step = 1, type = "number" }) => (
  <div className="mb-2.5">
    <label className="block text-xs font-medium text-gray-600 mb-1" title={tooltip}>
      {label}
    </label>
    <div className="flex items-center">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === "number" ? (parseFloat(e.target.value) || 0) : e.target.value)}
        min={min}
        step={step}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
      />
      {suffix && <span className="ml-2 text-xs text-gray-500 whitespace-nowrap">{suffix}</span>}
    </div>
  </div>
);

const CostRow = ({ label, value, onChange }) => (
  <div className="flex items-center gap-2 py-1 border-b border-gray-50">
    <span className="flex-1 text-xs text-gray-600">{label}</span>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      step={0.1}
      className="w-20 px-2 py-1 border border-gray-200 rounded text-xs text-right text-blue-600 font-medium bg-blue-50 focus:ring-1 focus:ring-blue-400"
    />
    <span className="text-xs text-gray-400 w-4">%</span>
  </div>
);

const KPI = ({ title, valueA, valueB, format = "currency", highlight = false }) => {
  const f = format === "currency" ? fmt : format === "pct" ? pct : (v) => v.toLocaleString("de-AT");
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200" : "bg-white border border-gray-100"}`}>
      <div className="text-xs font-medium text-gray-500 mb-2">{title}</div>
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="text-[10px] text-orange-500 font-medium mb-0.5">Szenario A</div>
          <div className="text-base font-bold text-gray-800">{f(valueA)}</div>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="flex-1">
          <div className="text-[10px] text-blue-500 font-medium mb-0.5">Szenario B</div>
          <div className="text-base font-bold text-gray-800">{f(valueB)}</div>
        </div>
      </div>
    </div>
  );
};

export default function RadiologySimulator() {
  const [params, setParams] = useState(defaultParams);
  const [costs, setCosts] = useState(defaultCostPct);
  const [activeTab, setActiveTab] = useState("overview");

  const up = (key) => (val) => setParams((p) => ({ ...p, [key]: val }));
  const uc = (key) => (val) => setCosts((c) => ({ ...c, [key]: val }));

  const calc = useMemo(() => {
    const {
      scansPerHour, revenuePerScan, operatingStart, operatingEnd,
      daysPerWeek, weeksPerYear, scenarioA_extraHours, scenarioB_extraHours
    } = params;

    const coreHoursPerDay = Math.max(0, operatingEnd - operatingStart);
    const coreHoursPerWeek = coreHoursPerDay * daysPerWeek;
    const weeksPerMonth = weeksPerYear / 12;

    // Cost percentages
    const totalCostPctWithFremd = Object.values(costs).reduce((s, v) => s + v, 0);
    const totalCostPctWithoutFremd = totalCostPctWithFremd - costs.fremdpersonal;

    const calcScenario = (extraHoursPerWeek, includeFremdpersonal) => {
      const totalHoursWeek = coreHoursPerWeek + extraHoursPerWeek;
      const totalHoursMonth = totalHoursWeek * weeksPerMonth;
      const totalHoursYear = totalHoursWeek * weeksPerYear;

      const scansWeek = totalHoursWeek * scansPerHour;
      const scansMonth = scansWeek * weeksPerMonth;
      const scansYear = scansWeek * weeksPerYear;

      const revenueWeek = scansWeek * revenuePerScan;
      const revenueMonth = scansMonth * revenuePerScan;
      const revenueYear = scansYear * revenuePerScan;

      const costPct = includeFremdpersonal ? totalCostPctWithFremd : totalCostPctWithoutFremd;

      // Individual cost items
      const costBreakdown = {};
      let totalCostsMonth = 0;
      for (const [key, pctVal] of Object.entries(costs)) {
        if (!includeFremdpersonal && key === "fremdpersonal") {
          costBreakdown[key] = 0;
          continue;
        }
        const val = revenueMonth * (pctVal / 100);
        costBreakdown[key] = val;
        totalCostsMonth += val;
      }

      const totalCostsWeek = totalCostsMonth / weeksPerMonth;
      const totalCostsYear = totalCostsMonth * 12;

      const profitWeek = revenueWeek - totalCostsWeek;
      const profitMonth = revenueMonth - totalCostsMonth;
      const profitYear = revenueYear - totalCostsYear;

      const margin = revenueMonth > 0 ? profitMonth / revenueMonth : 0;
      const costPerScan = scansMonth > 0 ? totalCostsMonth / scansMonth : 0;
      const profitPerScan = scansMonth > 0 ? profitMonth / scansMonth : 0;
      const revenuePerHour = revenueMonth / (totalHoursMonth || 1);
      const costPerHour = totalCostsMonth / (totalHoursMonth || 1);
      const profitPerHour = profitMonth / (totalHoursMonth || 1);

      return {
        totalHoursWeek, totalHoursMonth, totalHoursYear,
        scansWeek, scansMonth, scansYear,
        revenueWeek, revenueMonth, revenueYear,
        totalCostsWeek, totalCostsMonth, totalCostsYear,
        profitWeek, profitMonth, profitYear,
        margin, costPct, costBreakdown,
        costPerScan, profitPerScan,
        revenuePerHour, costPerHour, profitPerHour,
      };
    };

    // Scenario A: Kernbetrieb OHNE Zukauf (nur eigene Stunden + evtl. extra)
    const scenA = calcScenario(scenarioA_extraHours, false);
    // Scenario B: MIT Zukauf/Fremdpersonal (erweiterte Stunden)
    const scenB = calcScenario(scenarioB_extraHours, true);

    // Difference
    const diff = {
      scansMonth: scenB.scansMonth - scenA.scansMonth,
      revenueMonth: scenB.revenueMonth - scenA.revenueMonth,
      costsMonth: scenB.totalCostsMonth - scenA.totalCostsMonth,
      profitMonth: scenB.profitMonth - scenA.profitMonth,
      revenueYear: scenB.revenueYear - scenA.revenueYear,
      profitYear: scenB.profitYear - scenA.profitYear,
    };

    // Monthly comparison data
    const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    const monthlyData = monthNames.map((m, i) => ({
      monat: m,
      umsatzA: Math.round(scenA.revenueMonth),
      umsatzB: Math.round(scenB.revenueMonth),
      gewinnA: Math.round(scenA.profitMonth),
      gewinnB: Math.round(scenB.profitMonth),
      cumGewinnA: Math.round(scenA.profitMonth * (i + 1)),
      cumGewinnB: Math.round(scenB.profitMonth * (i + 1)),
      cumDiff: Math.round(diff.profitMonth * (i + 1)),
    }));

    // Cost breakdown comparison
    const costCompData = Object.entries(costLabels).map(([key, label]) => ({
      name: label.length > 20 ? label.substring(0, 18) + "…" : label,
      fullName: label,
      szenarioA: Math.round(scenA.costBreakdown[key] || 0),
      szenarioB: Math.round(scenB.costBreakdown[key] || 0),
    }));

    // Hours sensitivity
    const sensitivityData = Array.from({ length: 11 }, (_, i) => {
      const extra = i * 5;
      const withFremd = calcScenario(extra, true);
      const withoutFremd = calcScenario(extra, false);
      return {
        extraStunden: extra,
        gewinnMitZukauf: Math.round(withFremd.profitMonth),
        gewinnOhneZukauf: Math.round(withoutFremd.profitMonth),
      };
    });

    return { scenA, scenB, diff, monthlyData, costCompData, sensitivityData, coreHoursPerDay, coreHoursPerWeek, weeksPerMonth };
  }, [params, costs]);

  const tabs = [
    { key: "overview", label: "Übersicht" },
    { key: "costs", label: "Kostenstruktur" },
    { key: "charts", label: "Diagramme" },
    { key: "sensitivity", label: "Sensitivität" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-5 mb-5 text-white">
          <h1 className="text-xl font-bold mb-1">Radiologie Scan-Simulator — Szenario-Vergleich</h1>
          <p className="text-blue-200 text-xs">Vergleichsrechner für gemittelte Kostenanteile bei unterschiedlichen Betriebsstunden. Stellt nicht die tatsächliche Marge dar (ohne Leasing-, Finanzierungs- und Zinsaufwendungen).</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left: Inputs */}
          <div className="lg:w-72 flex-shrink-0 space-y-4">
            {/* Kernbetrieb */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Kernbetrieb</h2>
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 mb-1">Beginn</label>
                  <input type="number" value={params.operatingStart} onChange={(e) => up("operatingStart")(parseFloat(e.target.value)||0)} min={0} max={23} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 mb-1">Ende</label>
                  <input type="number" value={params.operatingEnd} onChange={(e) => up("operatingEnd")(parseFloat(e.target.value)||0)} min={0} max={23} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="text-[10px] text-gray-400 mb-2">{calc.coreHoursPerDay}h/Tag × {params.daysPerWeek} Tage = {calc.coreHoursPerWeek}h/Woche</div>
              <InputField label="Betriebstage/Woche" value={params.daysPerWeek} onChange={up("daysPerWeek")} suffix="Tage" min={1} />
              <InputField label="Betriebswochen/Jahr" value={params.weeksPerYear} onChange={up("weeksPerYear")} suffix="Wo" />
              <InputField label="Scans pro Stunde" value={params.scansPerHour} onChange={up("scansPerHour")} suffix="Scans/h" step={0.5} />
              <InputField label="Umsatz pro Scan" value={params.revenuePerScan} onChange={up("revenuePerScan")} suffix="€" />
            </div>

            {/* Szenarien */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Szenarien (Zusatzstunden/Wo)</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                <div className="text-[10px] font-semibold text-orange-600 mb-1">SZENARIO A — Ohne Zukauf</div>
                <InputField label="Zusätzliche Stunden/Woche" value={params.scenarioA_extraHours} onChange={up("scenarioA_extraHours")} suffix="h" min={0} />
                <div className="text-[10px] text-orange-500">Gesamt: {calc.scenA.totalHoursWeek} h/Wo</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-[10px] font-semibold text-blue-600 mb-1">SZENARIO B — Mit Zukauf</div>
                <InputField label="Zusätzliche Stunden/Woche" value={params.scenarioB_extraHours} onChange={up("scenarioB_extraHours")} suffix="h" min={0} />
                <div className="text-[10px] text-blue-500">Gesamt: {calc.scenB.totalHoursWeek} h/Wo</div>
              </div>
            </div>
          </div>

          {/* Right: Results */}
          <div className="flex-1 min-w-0">
            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-white rounded-lg p-1 border border-gray-200">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${activeTab === t.key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB: Overview */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <KPI title="Scans / Monat" valueA={calc.scenA.scansMonth} valueB={calc.scenB.scansMonth} format="number" />
                  <KPI title="Umsatz / Monat" valueA={calc.scenA.revenueMonth} valueB={calc.scenB.revenueMonth} />
                  <KPI title="Kosten / Monat" valueA={calc.scenA.totalCostsMonth} valueB={calc.scenB.totalCostsMonth} />
                  <KPI title="Deckungsbeitrag / Monat" valueA={calc.scenA.profitMonth} valueB={calc.scenB.profitMonth} highlight />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <KPI title="Marge" valueA={calc.scenA.margin} valueB={calc.scenB.margin} format="pct" />
                  <KPI title="Kosten / Scan" valueA={calc.scenA.costPerScan} valueB={calc.scenB.costPerScan} />
                  <KPI title="DB / Scan" valueA={calc.scenA.profitPerScan} valueB={calc.scenB.profitPerScan} />
                  <KPI title="DB / Stunde" valueA={calc.scenA.profitPerHour} valueB={calc.scenB.profitPerHour} />
                </div>

                {/* Difference summary */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-indigo-700 mb-2 uppercase">Differenz Szenario B vs. A (monatlich)</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    {[
                      { l: "Mehr Scans", v: calc.diff.scansMonth, f: "n" },
                      { l: "Mehr Umsatz", v: calc.diff.revenueMonth, f: "c" },
                      { l: "Mehr Kosten", v: calc.diff.costsMonth, f: "c" },
                      { l: "Mehr DB", v: calc.diff.profitMonth, f: "c" },
                    ].map((d, i) => (
                      <div key={i}>
                        <div className="text-[10px] text-indigo-500">{d.l}</div>
                        <div className={`font-bold ${d.v >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {d.v >= 0 ? "+" : ""}{d.f === "c" ? fmt(d.v) : Math.round(d.v).toLocaleString("de-AT")}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-indigo-200 text-xs text-indigo-600">
                    Jahresdifferenz: Umsatz {fmt(calc.diff.revenueYear)} | DB {fmt(calc.diff.profitYear)}
                  </div>
                </div>

                {/* Comparison chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Monatlicher Deckungsbeitrag: A vs. B</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={calc.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="gewinnA" name="DB Szenario A (ohne Zukauf)" fill="#f97316" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="gewinnB" name="DB Szenario B (mit Zukauf)" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Cumulative */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Kumulierter Deckungsbeitrag (12 Monate)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={calc.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="cumGewinnA" name="Kum. DB Szenario A" stroke="#f97316" fill="#f97316" fillOpacity={0.1} strokeWidth={2} />
                      <Area type="monotone" dataKey="cumGewinnB" name="Kum. DB Szenario B" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                      <Area type="monotone" dataKey="cumDiff" name="Kum. Differenz" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Detail table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Detailvergleich</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-2 px-2 text-gray-600 text-xs">Kennzahl</th>
                          <th className="text-right py-2 px-2 text-orange-600 text-xs">Szenario A</th>
                          <th className="text-right py-2 px-2 text-blue-600 text-xs">Szenario B</th>
                          <th className="text-right py-2 px-2 text-purple-600 text-xs">Differenz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { l: "Betriebsstunden / Woche", a: calc.scenA.totalHoursWeek, b: calc.scenB.totalHoursWeek, u: "h" },
                          { l: "Scans / Monat", a: calc.scenA.scansMonth, b: calc.scenB.scansMonth, u: "" },
                          { l: "Scans / Jahr", a: calc.scenA.scansYear, b: calc.scenB.scansYear, u: "" },
                          { l: "Umsatz / Monat", a: calc.scenA.revenueMonth, b: calc.scenB.revenueMonth, u: "€", c: true },
                          { l: "Umsatz / Jahr", a: calc.scenA.revenueYear, b: calc.scenB.revenueYear, u: "€", c: true },
                          { l: "Kosten / Monat", a: calc.scenA.totalCostsMonth, b: calc.scenB.totalCostsMonth, u: "€", c: true },
                          { l: "Kostenquote gesamt", a: calc.scenA.costPct, b: calc.scenB.costPct, u: "%", p: true },
                          { l: "Deckungsbeitrag / Monat", a: calc.scenA.profitMonth, b: calc.scenB.profitMonth, u: "€", c: true, bold: true },
                          { l: "Deckungsbeitrag / Jahr", a: calc.scenA.profitYear, b: calc.scenB.profitYear, u: "€", c: true, bold: true },
                          { l: "Marge", a: calc.scenA.margin, b: calc.scenB.margin, u: "%", p: true },
                        ].map((row, i) => {
                          const d = row.b - row.a;
                          const fv = (v) => row.c ? fmt(v) : row.p ? `${(v*100).toFixed(1)}%` : `${Math.round(v).toLocaleString("de-AT")}${row.u ? " " + row.u : ""}`;
                          return (
                            <tr key={i} className={`border-b border-gray-100 ${row.bold ? "bg-green-50" : ""}`}>
                              <td className={`py-1.5 px-2 text-xs ${row.bold ? "font-semibold" : ""}`}>{row.l}</td>
                              <td className="py-1.5 px-2 text-right text-xs">{fv(row.a)}</td>
                              <td className="py-1.5 px-2 text-right text-xs">{fv(row.b)}</td>
                              <td className={`py-1.5 px-2 text-right text-xs font-medium ${d >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {d >= 0 ? "+" : ""}{fv(d)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Kostenstruktur */}
            {activeTab === "costs" && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Zentrale Kostenvariablen (% vom Umsatz)</h3>
                  <p className="text-[10px] text-gray-400 mb-3">Diese Werte steuern die gesamte Berechnung. Änderungen wirken sich auf alle Szenarien aus.</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                    {Object.entries(costLabels).map(([key, label]) => (
                      <CostRow key={key} label={label} value={costs[key]} onChange={uc(key)} />
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-xs font-medium">
                    <span>Gesamtkostenquote (mit Zukauf):</span>
                    <span className="text-red-600">{Object.values(costs).reduce((s, v) => s + v, 0).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium mt-1">
                    <span>Gesamtkostenquote (ohne Zukauf):</span>
                    <span className="text-orange-600">{(Object.values(costs).reduce((s, v) => s + v, 0) - costs.fremdpersonal).toFixed(2)}%</span>
                  </div>
                </div>

                {/* Cost breakdown chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Kostenvergleich nach Kategorie (monatlich)</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={calc.costCompData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                      <Tooltip formatter={(v, name) => [fmt(v), name]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="szenarioA" name="Szenario A (ohne Zukauf)" fill="#f97316" radius={[0, 2, 2, 0]} />
                      <Bar dataKey="szenarioB" name="Szenario B (mit Zukauf)" fill="#3b82f6" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* TAB: Charts */}
            {activeTab === "charts" && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Umsatzvergleich (12 Monate)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={calc.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="umsatzA" name="Umsatz Szenario A" fill="#fb923c" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="umsatzB" name="Umsatz Szenario B" fill="#60a5fa" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Kostenaufteilung Szenario A</h3>
                    <div className="space-y-1">
                      {Object.entries(costLabels).filter(([k]) => k !== "fremdpersonal").map(([key, label]) => {
                        const val = calc.scenA.costBreakdown[key] || 0;
                        const maxVal = Math.max(...Object.values(calc.scenA.costBreakdown));
                        const width = maxVal > 0 ? (val / maxVal) * 100 : 0;
                        return (
                          <div key={key} className="flex items-center gap-2 text-[10px]">
                            <span className="w-32 text-gray-500 truncate">{label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-3">
                              <div className="bg-orange-400 h-3 rounded-full" style={{ width: `${width}%` }} />
                            </div>
                            <span className="w-16 text-right text-gray-600">{fmt(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Kostenaufteilung Szenario B</h3>
                    <div className="space-y-1">
                      {Object.entries(costLabels).map(([key, label]) => {
                        const val = calc.scenB.costBreakdown[key] || 0;
                        const maxVal = Math.max(...Object.values(calc.scenB.costBreakdown));
                        const width = maxVal > 0 ? (val / maxVal) * 100 : 0;
                        return (
                          <div key={key} className="flex items-center gap-2 text-[10px]">
                            <span className="w-32 text-gray-500 truncate">{label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-3">
                              <div className={`h-3 rounded-full ${key === "fremdpersonal" ? "bg-red-400" : "bg-blue-400"}`} style={{ width: `${width}%` }} />
                            </div>
                            <span className="w-16 text-right text-gray-600">{fmt(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Sensitivity */}
            {activeTab === "sensitivity" && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Sensitivitätsanalyse: DB nach Zusatzstunden/Woche</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={calc.sensitivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="extraStunden" tick={{ fontSize: 11 }} label={{ value: "Zusätzliche Stunden/Woche", position: "bottom", fontSize: 11, offset: -5 }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="gewinnOhneZukauf" name="DB ohne Zukauf" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="gewinnMitZukauf" name="DB mit Zukauf" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
                      <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Datentabelle</h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="py-2 px-2 text-left text-gray-600">Extra h/Wo</th>
                        <th className="py-2 px-2 text-right text-orange-600">DB ohne Zukauf</th>
                        <th className="py-2 px-2 text-right text-blue-600">DB mit Zukauf</th>
                        <th className="py-2 px-2 text-right text-purple-600">Differenz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.sensitivityData.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-1.5 px-2">{row.extraStunden} h</td>
                          <td className="py-1.5 px-2 text-right">{fmt(row.gewinnOhneZukauf)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(row.gewinnMitZukauf)}</td>
                          <td className={`py-1.5 px-2 text-right font-medium ${row.gewinnMitZukauf - row.gewinnOhneZukauf >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {fmt(row.gewinnMitZukauf - row.gewinnOhneZukauf)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-700">
              <strong>Hinweis:</strong> Dieser Rechner ist ein Vergleichsinstrument für gemittelte Kostenanteile bei unterschiedlichen Betriebsstunden. Er stellt nicht die tatsächliche Marge des Gesamtbetriebs dar, da Leasing-, Finanzierungs- und Zinsaufwendungen nicht berücksichtigt sind.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
