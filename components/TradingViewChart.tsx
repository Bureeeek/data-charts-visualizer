"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  HistogramSeries,
  type CandlestickData,
  type HistogramData,
  type ISeriesApi,
  type IPriceLine,
  LineStyle,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";

export type Symbol = "BTC" | "ETH";
export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";
export type Ohlcv = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Props = {
  data: Ohlcv[];
  symbol: Symbol;
  interval: Interval;
  liveCandle?: Ohlcv | null;
};

function toTimestamp(value: string): UTCTimestamp | null {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return null;
  }
  return Math.floor(ms / 1000) as UTCTimestamp;
}

function formatTime(value: number): string {
  const date = new Date(value * 1000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isIntraday(interval: Interval): boolean {
  return interval.endsWith("m") || interval.endsWith("h");
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

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function buildLiveCandleFromTrade(
  prev: Ohlcv | null,
  price: number,
  qty: number,
  tradeTimeMs: number,
  interval: Interval,
): Ohlcv {
  const bucketMs = intervalToMs(interval);
  const bucketStart = Math.floor(tradeTimeMs / bucketMs) * bucketMs;
  const nextTime = new Date(bucketStart).toISOString();
  if (!prev) {
    return {
      time: nextTime,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: qty,
    };
  }

  const prevTime = Date.parse(prev.time);
  if (!Number.isFinite(prevTime) || prevTime !== bucketStart) {
    const open = prev.close;
    return {
      time: nextTime,
      open,
      high: Math.max(open, price),
      low: Math.min(open, price),
      close: price,
      volume: qty,
    };
  }

  return {
    ...prev,
    close: price,
    high: Math.max(prev.high, price),
    low: Math.min(prev.low, price),
    volume: prev.volume + qty,
  };
}

function getChartPalette() {
  const isDark =
    document.documentElement.classList.contains("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    text: isDark ? "#e2e8f0" : "#0f172a",
    border: isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.45)",
  };
}

export default function TradingViewChart({ data, symbol, interval, liveCandle }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const lastPriceRef = useRef<HTMLDivElement | null>(null);
  const lastCandleRef = useRef<Ohlcv | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataKeyRef = useRef<string>("");
  const dataLengthRef = useRef(0);
  const symbolRef = useRef(symbol);
  const intervalRef = useRef(interval);

  useEffect(() => {
    symbolRef.current = symbol;
    intervalRef.current = interval;
  }, [symbol, interval]);

  const updateLastPriceUI = (candle: Ohlcv) => {
    const candleSeries = candleSeriesRef.current;
    const label = lastPriceRef.current;
    const container = containerRef.current;
    if (!candleSeries || !label || !container) {
      return;
    }

    const price = candle.close;
    const y = candleSeries.priceToCoordinate(price);
    if (y == null) {
      label.style.display = "none";
      return;
    }

    const isUp = candle.close >= candle.open;
    const color = isUp ? "#22c55e" : "#ef4444";
    const nextMs = intervalToMs(intervalRef.current);
    const bucketStart = Date.parse(candle.time);
    let remaining = "--:--";
    if (Number.isFinite(bucketStart)) {
      const elapsed = Date.now() - bucketStart;
      const remainder = ((elapsed % nextMs) + nextMs) % nextMs;
      const msLeft = remainder === 0 ? nextMs : nextMs - remainder;
      remaining = formatCountdown(msLeft);
    }

    label.style.display = "flex";
    label.style.background = color;
    label.style.border = "1px solid rgba(15, 23, 42, 0.25)";
    label.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.28)";
    label.style.top = `${Math.min(
      Math.max(y - label.offsetHeight / 2, 6),
      container.clientHeight - label.offsetHeight - 6,
    )}px`;
    label.innerHTML = `
      <span style="position:absolute;left:-6px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-right:6px solid ${color};"></span>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.04em;opacity:0.85;">${symbolRef.current}USDT</div>
      <div style="font-size:14px;font-weight:600;line-height:1.1;">${formatPrice(price)}</div>
      <div style="font-size:10px;opacity:0.85;">${remaining}</div>
    `;

    if (!priceLineRef.current) {
      priceLineRef.current = candleSeries.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
      });
    } else {
      priceLineRef.current.applyOptions({ price, color });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const palette = getChartPalette();
    const textColor = palette.text;
    const borderColor = palette.border;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
      },
      grid: {
        vertLines: { color: borderColor },
        horzLines: { color: borderColor },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor,
      },
      timeScale: {
        borderColor,
        timeVisible: isIntraday(intervalRef.current),
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "vol",
      color: "rgba(59, 130, 246, 0.4)",
      priceFormat: { type: "volume" },
    });

    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const tooltip = tooltipRef.current;
    if (tooltip) {
      tooltip.style.display = "none";
    }

    const handleCrosshairMove = (param: MouseEventParams) => {
      if (!tooltip) return;
      if (!param.time || !param.seriesData) {
        tooltip.style.display = "none";
        return;
      }

      const candle = param.seriesData.get(candleSeries) as CandlestickData | undefined;
      const volume = param.seriesData.get(volumeSeries) as HistogramData | undefined;
      if (!candle || !volume) {
        tooltip.style.display = "none";
        return;
      }

      const time = typeof param.time === "number" ? param.time : null;
      if (!time) {
        tooltip.style.display = "none";
        return;
      }

      tooltip.style.display = "block";
      tooltip.innerHTML = `
        <div class="text-xs font-semibold">${symbolRef.current} - ${intervalRef.current}</div>
        <div class="text-xs text-muted-foreground">${formatTime(time)}</div>
        <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span>O</span><span>${candle.open.toFixed(2)}</span>
          <span>H</span><span>${candle.high.toFixed(2)}</span>
          <span>L</span><span>${candle.low.toFixed(2)}</span>
          <span>C</span><span>${candle.close.toFixed(2)}</span>
          <span>Vol</span><span>${Number(volume.value).toLocaleString()}</span>
        </div>
      `;

      const { x, y } = param.point ?? { x: 0, y: 0 };
      tooltip.style.left = `${Math.min(x + 16, container.clientWidth - 180)}px`;
      tooltip.style.top = `${Math.min(y + 16, container.clientHeight - 120)}px`;
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    if (!countdownRef.current) {
      countdownRef.current = setInterval(() => {
        if (lastCandleRef.current) {
          updateLastPriceUI(lastCandleRef.current);
        }
      }, 1000);
    }

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    chart.timeScale().applyOptions({
      timeVisible: isIntraday(interval),
      secondsVisible: false,
    });
  }, [interval]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries) {
      return;
    }

    let active = true;
    const streamSymbol = symbol.toLowerCase() === "btc" ? "btcusdt" : "ethusdt";
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamSymbol}@trade`);

    ws.onmessage = (event) => {
      if (!active) return;
      const payload = JSON.parse(event.data) as { p?: string; q?: string; T?: number };
      const price = Number(payload?.p);
      const qty = Number(payload?.q);
      const tradeTime = Number(payload?.T);
      if (!Number.isFinite(price) || !Number.isFinite(qty) || !Number.isFinite(tradeTime)) {
        return;
      }

      const next = buildLiveCandleFromTrade(lastCandleRef.current, price, qty, tradeTime, interval);
      lastCandleRef.current = next;
      updateLastPriceUI(next);

      const time = toTimestamp(next.time);
      if (!time) return;
      candleSeries.update({
        time,
        open: next.open,
        high: next.high,
        low: next.low,
        close: next.close,
      });
      volumeSeries.update({
        time,
        value: next.volume,
        color: next.close >= next.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
      });
    };

    ws.onerror = () => {
      if (!active) return;
      ws.close();
    };

    return () => {
      active = false;
      ws.close();
    };
  }, [interval, symbol]);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries) {
      return;
    }

    const candles: CandlestickData[] = [];
    const volumes: HistogramData[] = [];
    data.forEach((row, index) => {
      const parsed = toTimestamp(row.time);
      const fallback = Math.floor(Date.now() / 1000) - (data.length - 1 - index) * 3600;
      const time = (parsed ?? fallback) as UTCTimestamp;
      candles.push({
        time,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
      });
      volumes.push({
        time,
        value: row.volume,
        color: row.close >= row.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
      });
    });

    candleSeries.setData(candles);
    volumeSeries.setData(volumes);

    const dataKey = `${symbol}-${interval}`;
    const lengthChanged = data.length !== dataLengthRef.current;
    const keyChanged = dataKey !== dataKeyRef.current;
    if (keyChanged) {
      chart.timeScale().fitContent();
    } else if (lengthChanged) {
      chart.timeScale().scrollToRealTime();
    }
    dataKeyRef.current = dataKey;
    dataLengthRef.current = data.length;

    const last = data[data.length - 1];
    if (last) {
      lastCandleRef.current = last;
      updateLastPriceUI(last);
    }
  }, [data, interval, symbol]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries || !liveCandle) {
      return;
    }

    lastCandleRef.current = liveCandle;
    updateLastPriceUI(liveCandle);
    const time = toTimestamp(liveCandle.time);
    if (!time) {
      return;
    }

    candleSeries.update({
      time,
      open: liveCandle.open,
      high: liveCandle.high,
      low: liveCandle.low,
      close: liveCandle.close,
    });
    volumeSeries.update({
      time,
      value: liveCandle.volume,
      color: liveCandle.close >= liveCandle.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
    });
  }, [liveCandle]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div
        ref={lastPriceRef}
        className="pointer-events-none absolute right-3 z-10 flex flex-col gap-0.5 rounded-md px-2 py-1 text-white backdrop-blur-sm"
      />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
      />
    </div>
  );
}
