import { NextResponse } from "next/server";

const BINANCE = "https://api.binance.com/api/v3/klines";

function pair(sym: string) {
  if (sym === "BTC") return "BTCUSDT";
  if (sym === "ETH") return "ETHUSDT";
  return "BTCUSDT";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sym = (searchParams.get("symbol") || "BTC").toUpperCase();
    const interval = searchParams.get("interval") || "1d";
    const limit = Number(searchParams.get("limit") || 300);

    const url = `${BINANCE}?symbol=${pair(sym)}&interval=${interval}&limit=${limit}`;
    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: r.status });
    }

    const raw: any[] = await r.json();
    const rows = raw.map((k) => ({
      date: new Date(k[0]).toISOString().slice(0, 10),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));

    return NextResponse.json({ symbol: sym, interval, rows });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
