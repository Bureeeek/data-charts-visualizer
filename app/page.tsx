"use client";

import { useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
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

type ChartPoint = CandlePoint & {
  bodyBase: number;
  bodyRange: number;
  wickBase: number;
  wickRange: number;
  volumeBase: number;
  volumeHeight: number;
  direction: "up" | "down";
};

const CHART_POINT_COUNT = 180;

export default function Home() {
  const [symbol, setSymbol] = useState<Symbol>("BTC");
  const [smaWindow, setSmaWindow] = useState(20);
  const [emaSpan, setEmaSpan] = useState(12);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [seed, setSeed] = useState(1);

  const priceData = useMemo(
    () => genData(symbol, CHART_POINT_COUNT, seed),
    [symbol, seed],
  );

  const { chartData, candleDomain } = useMemo(() => {
    if (priceData.length === 0) {
      return {
        chartData: [] as ChartPoint[],
        candleDomain: [0, 1] as [number, number],
      };
    }

    const closes = priceData.map((point) => point.close);
    const highs = priceData.map((point) => point.high);
    const lows = priceData.map((point) => point.low);
    const volumes = priceData.map((point) => point.volume);

    const smaValues = calculateSMA(closes, smaWindow);
    const emaValues = calculateEMA(closes, emaSpan);
    const rsiValues = calculateRSI(closes, rsiPeriod);

    const priceHigh = Math.max(...highs);
    const priceLow = Math.min(...lows);
    const priceRange = Math.max(priceHigh - priceLow, priceHigh * 0.01);
    const pricePadding = priceRange * 0.08;
    const maxVolume = Math.max(...volumes, 1);
    const volumeBand = priceRange * 0.22;
    const volumeBase = priceLow - volumeBand * 1.4;

    const enriched: ChartPoint[] = priceData.map((point, index) => {
      const { open, close, high, low, volume } = point;
      const direction = close >= open ? "up" : "down";
      const bodyBase = Math.min(open, close);
      const rawBodyRange = Math.abs(close - open);
      const bodyRange = Number(Math.max(rawBodyRange, close * 0.0015).toFixed(2));
      const wickRange = Number(Math.max(high - low, close * 0.0015).toFixed(2));
      const volumeHeight = Number(
        Math.max((volume / maxVolume) * volumeBand * 0.9, volumeBand * 0.15).toFixed(2),
      );

      return {
        ...point,
        sma: smaValues[index],
        ema: emaValues[index],
        rsi: rsiValues[index],
        bodyBase,
        bodyRange,
        wickBase: low,
        wickRange,
        volumeBase,
        volumeHeight,
        direction,
      };
    });

    const domainMin = volumeBase - pricePadding;
    const domainMax = priceHigh + pricePadding;

    return {
      chartData: enriched,
      candleDomain: [Number(domainMin.toFixed(2)), Number(domainMax.toFixed(2))] as [number, number],
    };
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

            <Card className="border-border bg-card/80 backdrop-blur lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle>{symbol} Candles & Volume</CardTitle>
                <CardDescription>Simulated OHLC candles with relative volume bars.</CardDescription>
              </CardHeader>
              <CardContent className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ left: 0, right: 20, top: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" minTickGap={24} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      yAxisId="price"
                      domain={candleDomain}
                      stroke="hsl(var(--muted-foreground))"
                      width={70}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <RechartsTooltip
                      content={<CandleTooltip />}
                      cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                    />
                    <Legend />
                    <Bar
                      dataKey="wickBase"
                      stackId="wick"
                      yAxisId="price"
                      fillOpacity={0}
                      strokeOpacity={0}
                      isAnimationActive={false}
                      legendType="none"
                    />
                    <Bar
                      dataKey="wickRange"
                      stackId="wick"
                      yAxisId="price"
                      barSize={3}
                      name="High / Low"
                      fill="#94a3b8"
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="bodyBase"
                      stackId="body"
                      yAxisId="price"
                      fillOpacity={0}
                      strokeOpacity={0}
                      isAnimationActive={false}
                      legendType="none"
                    />
                    <Bar
                      dataKey="bodyRange"
                      stackId="body"
                      yAxisId="price"
                      barSize={10}
                      radius={[2, 2, 2, 2]}
                      name="Open / Close"
                      isAnimationActive={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`body-${index}`}
                          fill={entry.direction === "up" ? "#22c55e" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="volumeBase"
                      stackId="volume"
                      yAxisId="price"
                      fillOpacity={0}
                      strokeOpacity={0}
                      isAnimationActive={false}
                      legendType="none"
                    />
                    <Bar
                      dataKey="volumeHeight"
                      stackId="volume"
                      yAxisId="price"
                      barSize={6}
                      name="Volume"
                      opacity={0.45}
                      isAnimationActive={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`volume-${index}`}
                          fill={entry.direction === "up" ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)"}
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
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
  const baseVolume = symbol === "BTC" ? 32000 : 21000;
  const random = createSeededRandom(seed + symbol.charCodeAt(0));
  let previousClose = basePrice;

  return Array.from({ length }, (_, index) => {
    const openRaw = previousClose;
    const shock = (random() - 0.5) * 2 * volatility;
    const driftFactor = 1 + drift / 100;
    const closeRaw = Math.max(1, openRaw * (driftFactor + shock));

    const swingHigh = (0.4 + random() * 0.8) * volatility;
    const swingLow = (0.4 + random() * 0.8) * volatility;

    const maxBase = Math.max(openRaw, closeRaw);
    const minBase = Math.min(openRaw, closeRaw);
    const highRaw = maxBase * (1 + swingHigh);
    const lowRaw = Math.max(1, minBase * (1 - swingLow));

    const date = new Date();
    date.setDate(date.getDate() - (length - index - 1));

    const candle = {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      open: parseFloat(openRaw.toFixed(2)),
      high: parseFloat(Math.max(highRaw, closeRaw, openRaw).toFixed(2)),
      low: parseFloat(Math.min(lowRaw, closeRaw, openRaw).toFixed(2)),
      close: parseFloat(closeRaw.toFixed(2)),
      volume: Math.round(baseVolume * (0.6 + random() * 0.8)),
    } satisfies CandlePoint;

    previousClose = closeRaw;

    return candle;
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

function CandleTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const candle = payload[0].payload as ChartPoint;

  return (
    <div className="space-y-1 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="font-semibold">{label}</p>
      <p>Open: ${candle.open.toFixed(2)}</p>
      <p>High: ${candle.high.toFixed(2)}</p>
      <p>Low: ${candle.low.toFixed(2)}</p>
      <p>Close: ${candle.close.toFixed(2)}</p>
      <p>Volume: {candle.volume.toLocaleString()}</p>
    </div>
  );
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
