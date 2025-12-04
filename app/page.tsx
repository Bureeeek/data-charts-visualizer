"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/components/ui/theme-provider";

type Symbol = "BTC" | "ETH";
type CandlePoint = { date: string; close: number; sma?: number | null; ema?: number | null; rsi?: number | null; };
const CHART_POINT_COUNT = 180;

export default function Home() {
 const [symbol, setSymbol] = useState<Symbol>("BTC");
const [smaWindow, setSmaWindow] = useState(20);
const [emaSpan, setEmaSpan] = useState(12);
const [rsiPeriod, setRsiPeriod] = useState(14);
const [seed, setSeed] = useState(1);

const { theme, toggleTheme } = useTheme();


  const priceData = useMemo(() => genData(symbol, CHART_POINT_COUNT, seed), [symbol, seed]);

  const chartData = useMemo(() => {
    const closes = priceData.map((p) => p.close);
    const smaValues = calculateSMA(closes, smaWindow);
    const emaValues = calculateEMA(closes, emaSpan);
    const rsiValues = calculateRSI(closes, rsiPeriod);
    return priceData.map((p, i) => ({ ...p, sma: smaValues[i], ema: emaValues[i], rsi: rsiValues[i] }));
  }, [priceData, smaWindow, emaSpan, rsiPeriod]);

  const handleRegenerate = () => setSeed((prev) => prev + 1);
  const latestClose = chartData.at(-1)?.close ?? 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container-mock py-10">
        {/* Hero */}
        <header className="mb-8">
  <div className="flex items-center justify-between gap-4">
    {/* Left: Logo/Name */}
    <div className="shrink-0 text-lg font-semibold">ChartsNews</div>

    {/* Center: Searchbar */}
    <div className="flex-1 max-w-xl mx-4">
      <div className="searchbar">
        <svg className="searchbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="7" strokeWidth="2"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2"></line>
        </svg>
        <input placeholder="Hinted search text" aria-label="Search" />
      </div>
    </div>

    {/* Right: Asset-Typen und CTA */}
    <div className="flex items-center gap-3">
  <Tabs value={symbol} onValueChange={(v) => setSymbol(v as Symbol)}>
    <TabsList className="pill-tabs bg-muted/70 backdrop-blur">
      <TabsTrigger value="BTC" className="pill">Stocks</TabsTrigger>
      <TabsTrigger value="ETH" className="pill">Crypto</TabsTrigger>
      <TabsTrigger value="BTC" className="pill">Indexes</TabsTrigger>
      <TabsTrigger value="ETH" className="pill">Materials</TabsTrigger>
    </TabsList>
  </Tabs>

  {/* Dark-Mode-Toggle */}
  <Button
    variant="outline"
    onClick={toggleTheme}
    className="h-9 px-3 text-xs font-medium"
  >
    {theme === "dark" ? "Light mode" : "Dark mode"}
  </Button>

  <Button className="btn-primary-hero">Sign Up</Button>
</div>

  </div>

  {/* Hero-Title darunter */}
  <div className="mt-8">
    <h1 className="hero-title">Welcome to Charts News</h1>
    <p className="hero-sub mt-2">Your real time website for market news and charts.</p>
  </div>
</header>


        {/* Controls */}

        <Card className="card-soft border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Indicator Settings</CardTitle>
            <CardDescription>
              Adjust the smoothing windows to see how the overlays respond.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <IndicatorSlider
              label="SMA Window" value={smaWindow} min={5} max={60} step={1}
              onValueChange={(v) => setSmaWindow(v[0])}
            />
            <IndicatorSlider
              label="EMA Span" value={emaSpan} min={5} max={40} step={1}
              onValueChange={(v) => setEmaSpan(v[0])}
            />
            <IndicatorSlider
              label="RSI Period" value={rsiPeriod} min={5} max={40} step={1}
              onValueChange={(v) => setRsiPeriod(v[0])}
            />
            <Button variant="outline" onClick={handleRegenerate} className="gap-2 w-full md:w-auto">
              <RefreshCcw className="h-4 w-4" />
              Regenerate Data
            </Button>
          </CardContent>
        </Card>

        {/* Charts */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="card-soft border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">{symbol} Price & Moving Averages</CardTitle>
              <CardDescription>
                Latest close: ${latestClose.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid />
                  <XAxis dataKey="date" minTickGap={24} />
                  <YAxis
                    domain={["auto","auto"]}
                    width={70}
                    tickFormatter={(v) => `$${v.toLocaleString()}`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  {/* Optional: <Legend /> */}
                  <Line type="monotone" dataKey="close" stroke="#16a34a" strokeWidth={2} dot={false} name="Close" />
                  <Line type="monotone" dataKey="sma" stroke="#f59e0b" strokeWidth={2} dot={false} name={`SMA ${smaWindow}`} />
                  <Line type="monotone" dataKey="ema" stroke="#06b6d4" strokeWidth={2} dot={false} name={`EMA ${emaSpan}`} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="card-soft border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">{symbol} RSI</CardTitle>
              <CardDescription>Monitor momentum with 30/70 threshold lines.</CardDescription>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid />
                  <XAxis dataKey="date" minTickGap={24} />
                  <YAxis domain={[0, 100]} width={60} />
                  <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" label="70" />
                  <ReferenceLine y={30} stroke="#22d3ee" strokeDasharray="4 4" label="30" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  {/* Optional: <Legend /> */}
                  <Line type="monotone" dataKey="rsi" stroke="#7c3aed" strokeWidth={2} dot={false} name={`RSI ${rsiPeriod}`} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

/* ----- helpers and indicators (unchanged logic) ----- */
function genData(symbol: Symbol, length = CHART_POINT_COUNT, seed = 1): CandlePoint[] {
  const basePrice = symbol === "BTC" ? 45000 : 3000;
  const drift = symbol === "BTC" ? 0.18 : 0.12;
  const volatility = symbol === "BTC" ? 0.035 : 0.028;
  const random = createSeededRandom(seed + symbol.charCodeAt(0));
  let price = basePrice;

  return Array.from({ length }, (_, index) => {
    const shock = (random() - 0.5) * 2 * volatility;
    price = Math.max(1, price * (1 + drift / 100 + shock));
    const date = new Date();
    date.setDate(date.getDate() - (length - index - 1));
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      close: parseFloat(price.toFixed(2)),
    };
  });
}

function createSeededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function calculateSMA(values: number[], window: number): Array<number | null> {
  const result: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) result.push(parseFloat((sum / window).toFixed(2)));
    else result.push(null);
  }
  return result;
}

function calculateEMA(values: number[], span: number): Array<number | null> {
  const result: Array<number | null> = [];
  const alpha = 2 / (span + 1);
  let ema: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    ema = ema === null ? value : alpha * value + (1 - alpha) * ema;
    if (i >= span - 1) result.push(parseFloat(ema.toFixed(2)));
    else result.push(null);
  }
  return result;
}

function calculateRSI(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (values.length <= period) return result;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta; else losses -= delta;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = formatRsi(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = formatRsi(avgGain, avgLoss);
  }
  return result;
}
function formatRsi(avgGain: number, avgLoss: number): number | null {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

type IndicatorSliderProps = { label: string; value: number; min: number; max: number; step: number; onValueChange: (value: number[]) => void; };
function IndicatorSlider({ label, value, min, max, step, onValueChange }: IndicatorSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={onValueChange} aria-label={label} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

