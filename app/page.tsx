"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Symbol = "BTC" | "ETH";
type Interval = "1h" | "4h" | "1d" | "1w";

type CandlePoint = {
  date: string;
  close: number;
  sma?: number | null;
  ema?: number | null;
  rsi?: number | null;
};

const CHART_POINT_COUNT = 180;
const POINTS: Record<Interval, number> = {
  "1h": 60,
  "4h": 120,
  "1d": CHART_POINT_COUNT,
  "1w": 156,
};
const INTERVALS: Interval[] = ["1h", "4h", "1d", "1w"];

export default function Home() {
  const [symbol, setSymbol] = useState<Symbol>("BTC");
  const [smaWindow, setSmaWindow] = useState(20);
  const [emaSpan, setEmaSpan] = useState(12);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [seed, setSeed] = useState(1);
  const [interval, setInterval] = useState<Interval>("1d");

  const priceData = useMemo(
    () => genData(symbol, POINTS[interval], seed),
    [symbol, interval, seed],
  );

  const chartData = useMemo(() => {
    const closes = priceData.map((point) => point.close);
    const smaValues = calculateSMA(closes, smaWindow);
    const emaValues = calculateEMA(closes, emaSpan);
    const rsiValues = calculateRSI(closes, rsiPeriod);

    return priceData.map((point, index) => ({
      ...point,
      sma: smaValues[index],
      ema: emaValues[index],
      rsi: rsiValues[index],
    }));
  }, [priceData, smaWindow, emaSpan, rsiPeriod]);

  const handleRegenerate = () => setSeed((prev) => prev + 1);

  const latestClose = chartData.at(-1)?.close ?? 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <Tabs
          value={symbol}
          onValueChange={(value) => setSymbol(value as Symbol)}
          className="space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-semibold">
                Crypto Charts Dashboard
              </CardTitle>
              <CardDescription className="text-base">
                Tune technical indicators for simulated {symbol} price action.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleRegenerate} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Regenerate Data
            </Button>
          </div>

          <TabsList className="w-full gap-2 bg-muted p-1 sm:w-auto">
            <TabsTrigger value="BTC" className="px-6 py-2">BTC</TabsTrigger>
            <TabsTrigger value="ETH" className="px-6 py-2">ETH</TabsTrigger>
          </TabsList>

          <Card className="border-border bg-card/80 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Indicator Settings</CardTitle>
              <CardDescription>
                Adjust the smoothing windows to see how the overlays respond.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <IndicatorSlider
                label="SMA Window"
                value={smaWindow}
                min={5}
                max={60}
                step={1}
                onValueChange={(value) => setSmaWindow(value[0])}
              />
              <IndicatorSlider
                label="EMA Span"
                value={emaSpan}
                min={5}
                max={40}
                step={1}
                onValueChange={(value) => setEmaSpan(value[0])}
              />
              <IndicatorSlider
                label="RSI Period"
                value={rsiPeriod}
                min={5}
                max={40}
                step={1}
                onValueChange={(value) => setRsiPeriod(value[0])}
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            {INTERVALS.map((option) => (
              <Button
                key={option}
                type="button"
                variant={interval === option ? "default" : "secondary"}
                size="sm"
                onClick={() => setInterval(option)}
              >
                {option}
              </Button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border bg-card/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle>{symbol} Price & Moving Averages</CardTitle>
                <CardDescription>
                  Latest close: ${latestClose.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" minTickGap={24} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      domain={["auto", "auto"]}
                      width={70}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderRadius: 12,
                        border: "1px solid hsl(var(--border))",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="close" stroke="#38bdf8" strokeWidth={2} dot={false} name="Close" />
                    <Line type="monotone" dataKey="sma" stroke="#f97316" strokeWidth={2} dot={false} name={`SMA ${smaWindow}`} />
                    <Line type="monotone" dataKey="ema" stroke="#22c55e" strokeWidth={2} dot={false} name={`EMA ${emaSpan}`} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle>{symbol} RSI</CardTitle>
                <CardDescription>Monitor momentum with 30/70 threshold lines.</CardDescription>
              </CardHeader>
              <CardContent className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" minTickGap={24} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" width={60} />
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
                    <Legend />
                    <Line type="monotone" dataKey="rsi" stroke="#a855f7" strokeWidth={2} dot={false} name={`RSI ${rsiPeriod}`} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </Tabs>
      </div>
    </main>
  );
}

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
  if (value <= 0) {
    value += 2147483646;
  }
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
    if (i >= window) {
      sum -= values[i - window];
    }
    if (i >= window - 1) {
      result.push(parseFloat((sum / window).toFixed(2)));
    } else {
      result.push(null);
    }
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
    if (i >= span - 1) {
      result.push(parseFloat(ema.toFixed(2)));
    } else {
      result.push(null);
    }
  }
  return result;
}

function calculateRSI(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (values.length <= period) {
    return result;
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) {
      gains += delta;
    } else {
      losses -= delta;
    }
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
  if (avgLoss === 0) {
    return 100;
  }
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

type IndicatorSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number[]) => void;
};

function IndicatorSlider({ label, value, min, max, step, onValueChange }: IndicatorSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={onValueChange}
        aria-label={label}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
