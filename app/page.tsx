"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TradingViewChart from "@/components/TradingViewChart";
import { getKlines } from "@/lib/fetchKlines";

type Symbol = "BTC" | "ETH";
type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";
type CandlePoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma?: number | null;
  ema?: number | null;
  rsi?: number | null;
};
const INTERVAL_POINTS: Record<Interval, number> = {
  "1m": 480,
  "5m": 360,
  "15m": 320,
  "1h": 240,
  "4h": 180,
  "1d": 180,
  "1w": 156,
};
const INTERVALS: Interval[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];
const DEFAULT_POINT_COUNT = INTERVAL_POINTS["1d"];

export default function Home() {
  const [symbol, setSymbol] = useState<Symbol>("BTC");
  const [smaWindow, setSmaWindow] = useState(20);
  const [emaSpan, setEmaSpan] = useState(12);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [interval, setInterval] = useState<Interval>("1d");
  const [priceData, setPriceData] = useState<CandlePoint[]>([]);
  const [lastCandle, setLastCandle] = useState<CandlePoint | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pointCount = INTERVAL_POINTS[interval];

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const rows = await getKlines(symbol, interval, pointCount);
        if (!alive) return;
        if (!rows.length) {
          throw new Error("empty klines");
        }
        setPriceData(rows);
        setLastCandle(rows.at(-1) ?? null);
      } catch {
        if (!alive) return;
        const fallback = genData(symbol, pointCount, 1, interval);
        setPriceData(fallback);
        setLastCandle(fallback.at(-1) ?? null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [symbol, interval, pointCount]);

  const chartData = useMemo(() => {
    const closes = priceData.map((p) => p.close);
    const smaValues = calculateSMA(closes, smaWindow);
    const emaValues = calculateEMA(closes, emaSpan);
    const rsiValues = calculateRSI(closes, rsiPeriod);
    return priceData.map((p, i) => ({ ...p, sma: smaValues[i], ema: emaValues[i], rsi: rsiValues[i] }));
  }, [priceData, smaWindow, emaSpan, rsiPeriod]);

  useEffect(() => {
    let active = true;
    const livePollMs = 4000;

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const closeSocket = () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        try {
          const rows = await getKlines(symbol, interval, 2);
          if (!active || !rows.length) return;
          const latest = rows.at(-1);
          if (!latest) return;
          setPriceData((prev) => mergeLiveCandle(prev, latest, pointCount));
          setLastCandle(latest);
        } catch {
          // Keep silent and try again on the next tick.
        }
      }, livePollMs);
    };

    try {
      const streamSymbol = symbol === "BTC" ? "btcusdt" : "ethusdt";
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamSymbol}@kline_${interval}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!active) return;
        const payload = JSON.parse(event.data) as {
          k?: {
            t: number;
            o: string;
            h: string;
            l: string;
            c: string;
            v: string;
          };
        };
        if (!payload?.k) return;
        const live = {
          date: new Date(payload.k.t).toISOString(),
          open: Number(payload.k.o),
          high: Number(payload.k.h),
          low: Number(payload.k.l),
          close: Number(payload.k.c),
          volume: Number(payload.k.v),
        };
        setPriceData((prev) => mergeLiveCandle(prev, live, pointCount));
        setLastCandle(live);
      };

      ws.onerror = () => {
        if (!active) return;
        closeSocket();
        startPolling();
      };

      ws.onclose = () => {
        if (!active) return;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      active = false;
      closeSocket();
      stopPolling();
    };
  }, [symbol, interval, pointCount]);

  const latestClose = lastCandle?.close ?? chartData.at(-1)?.close ?? 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container-mock py-10">
        {/* Hero */}
        <header className="mb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="shrink-0 text-lg font-semibold">ChartsNews</div>
              <div className="rounded-full bg-muted/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Crypto
              </div>
              <div className="text-sm text-muted-foreground">
                Last:{" "}
                <span className="font-semibold text-foreground">
                  ${latestClose.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="w-full sm:max-w-xs">
                <div className="searchbar">
                  <svg className="searchbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="11" cy="11" r="7" strokeWidth="2"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2"></line>
                  </svg>
                  <input placeholder="Search BTC or ETH" aria-label="Search" />
                </div>
              </div>
              <Tabs value={symbol} onValueChange={(v) => setSymbol(v as Symbol)}>
                <TabsList className="pill-tabs bg-muted/70 backdrop-blur">
                  <TabsTrigger value="BTC" className="pill">BTC</TabsTrigger>
                  <TabsTrigger value="ETH" className="pill">ETH</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

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
            <div className="space-y-2 md:col-span-3">
              <div className="text-sm font-medium">Interval</div>
              <Tabs value={interval} onValueChange={(v) => setInterval(v as Interval)}>
                <TabsList className="bg-muted/70">
                  {INTERVALS.map((value) => (
                    <TabsTrigger key={value} value={value} className="px-4 py-2">
                      {value}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="card-soft border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">{symbol} Price & Moving Averages ({interval})</CardTitle>
              <CardDescription>
                Latest close: ${latestClose.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid />
                  <XAxis
                    dataKey="date"
                    minTickGap={24}
                    tickFormatter={(value) => formatXAxisLabel(String(value), interval)}
                  />
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
                    labelFormatter={(label) => formatTooltipLabel(String(label), interval)}
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
              <CardTitle className="text-xl">{symbol} RSI ({interval})</CardTitle>
              <CardDescription>Monitor momentum with 30/70 threshold lines.</CardDescription>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid />
                  <XAxis
                    dataKey="date"
                    minTickGap={24}
                    tickFormatter={(value) => formatXAxisLabel(String(value), interval)}
                  />
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
                    labelFormatter={(label) => formatTooltipLabel(String(label), interval)}
                  />
                  {/* Optional: <Legend /> */}
                  <Line type="monotone" dataKey="rsi" stroke="#7c3aed" strokeWidth={2} dot={false} name={`RSI ${rsiPeriod}`} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8">
          <Card className="card-soft border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">TradingView Style Chart ({interval})</CardTitle>
              <CardDescription>
                Zoom, pan, and crosshair interaction powered by lightweight-charts.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[480px]">
              <TradingViewChart
                data={priceData.map((row) => ({
                  time: row.date,
                  open: row.open,
                  high: row.high,
                  low: row.low,
                  close: row.close,
                  volume: row.volume,
                }))}
                symbol={symbol}
                interval={interval}
                liveCandle={
                  lastCandle
                    ? {
                      time: lastCandle.date,
                      open: lastCandle.open,
                      high: lastCandle.high,
                      low: lastCandle.low,
                      close: lastCandle.close,
                      volume: lastCandle.volume,
                    }
                    : null
                }
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function isIntradayInterval(interval: Interval): boolean {
  return interval.endsWith("m") || interval.endsWith("h");
}

function formatXAxisLabel(value: string, interval: Interval): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (isIntradayInterval(interval)) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipLabel(value: string, interval: Interval): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (isIntradayInterval(interval)) {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function intervalToMs(interval: Interval): number {
  switch (interval) {
    case "1m":
      return 60_000;
    case "5m":
      return 5 * 60_000;
    case "15m":
      return 15 * 60_000;
    case "1h":
      return 60 * 60_000;
    case "4h":
      return 4 * 60 * 60_000;
    case "1w":
      return 7 * 24 * 60 * 60_000;
    case "1d":
    default:
      return 24 * 60 * 60_000;
  }
}

function mergeLiveCandle(
  prev: CandlePoint[],
  next: CandlePoint,
  maxPoints: number,
): CandlePoint[] {
  if (!prev.length) return [next];
  const last = prev[prev.length - 1];
  const lastTime = Date.parse(last.date);
  const nextTime = Date.parse(next.date);
  if (Number.isNaN(nextTime)) return prev;
  if (nextTime === lastTime) {
    return [...prev.slice(0, -1), { ...last, ...next }];
  }
  if (nextTime > lastTime) {
    const updated = [...prev, next];
    if (updated.length > maxPoints) {
      updated.shift();
    }
    return updated;
  }
  return prev;
}

/* ----- helpers and indicators (unchanged logic) ----- */
function genData(
  symbol: Symbol,
  length = DEFAULT_POINT_COUNT,
  seed = 1,
  interval: Interval = "1d",
): CandlePoint[] {
  const basePrice = symbol === "BTC" ? 45000 : 3000;
  const drift = symbol === "BTC" ? 0.18 : 0.12;
  const volatility = symbol === "BTC" ? 0.035 : 0.028;
  const baseVolume = symbol === "BTC" ? 38000 : 24000;
  const random = createSeededRandom(seed + symbol.charCodeAt(0));
  let previousClose = basePrice;

  return Array.from({ length }, (_, index) => {
    const openRaw = previousClose;
    const shock = (random() - 0.5) * 2 * volatility;
    const driftFactor = 1 + drift / 100;
    const closeRaw = Math.max(1, openRaw * (driftFactor + shock));

    const highNoise = (0.4 + random() * 0.8) * volatility;
    const lowNoise = (0.4 + random() * 0.8) * volatility;
    const baseHigh = Math.max(openRaw, closeRaw);
    const baseLow = Math.min(openRaw, closeRaw);
    const highRaw = baseHigh * (1 + highNoise);
    const lowRaw = Math.max(1, baseLow * (1 - lowNoise));

    const volume = Math.round(baseVolume * (0.55 + random() * 0.9));
    const stepMs = intervalToMs(interval);
    const date = new Date(Date.now() - (length - index - 1) * stepMs);
    previousClose = closeRaw;
    return {
      date: date.toISOString(),
      open: parseFloat(openRaw.toFixed(2)),
      high: parseFloat(Math.max(highRaw, openRaw, closeRaw).toFixed(2)),
      low: parseFloat(Math.min(lowRaw, openRaw, closeRaw).toFixed(2)),
      close: parseFloat(closeRaw.toFixed(2)),
      volume,
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

