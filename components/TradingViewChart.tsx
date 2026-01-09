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
  type UTCTimestamp,
} from "lightweight-charts";

export type Symbol = "BTC" | "ETH";
export type Interval = "1h" | "4h" | "1d" | "1w";
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

function getChartPalette() {
  const isDark =
    document.documentElement.classList.contains("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    text: isDark ? "#e2e8f0" : "#0f172a",
    border: isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.45)",
  };
}

export default function TradingViewChart({ data, symbol, interval }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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
    chart.timeScale().fitContent();

    const tooltip = tooltipRef.current;
    if (tooltip) {
      tooltip.style.display = "none";
    }

    chart.subscribeCrosshairMove((param) => {
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
        <div class="text-xs font-semibold">${symbol} - ${interval}</div>
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
    });

    return () => {
      chart.remove();
    };
  }, [data, interval, symbol]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
      />
    </div>
  );
}
