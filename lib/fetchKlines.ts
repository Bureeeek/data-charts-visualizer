export type Row = {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
};

export async function getKlines(symbol: "BTC" | "ETH", interval: string = "1d", limit = 180): Promise<Row[]> {
  const url = `/api/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    throw new Error("fetch klines failed");
  }
  const data = await r.json();
  return data.rows as Row[];
}
