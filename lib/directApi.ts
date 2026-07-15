// Maxiflow — клиент Яндекс Директ API v5 (только чтение: кампании + статистика).
const BASE = "https://api.direct.yandex.com/json/v5";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class DirectError extends Error {
  code: number;
  constructor(code: number, message: string, detail?: string) {
    super(detail ? `${message}: ${detail}` : message);
    this.code = code;
  }
}

type DirectCampaign = {
  Id: number;
  Name: string;
  Type?: string;
  State?: string;
  Status?: string;
};

async function directCall<T>(
  token: string, service: string, method: string, params: Record<string, unknown>,
): Promise<T> {
  const r = await fetch(`${BASE}/${service}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Language": "ru",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ method, params }),
  });
  const d = await r.json();
  if (d.error) {
    throw new DirectError(d.error.error_code, d.error.error_string, d.error.error_detail);
  }
  return d.result as T;
}

/** Список кампаний рекламодателя (без архивных). */
export async function directGetCampaigns(token: string): Promise<DirectCampaign[]> {
  const result = await directCall<{ Campaigns?: DirectCampaign[] }>(
    token, "campaigns", "get",
    {
      SelectionCriteria: { States: ["ON", "OFF", "SUSPENDED", "ENDED", "CONVERTED"] },
      FieldNames: ["Id", "Name", "Type", "State", "Status"],
    },
  );
  return result.Campaigns ?? [];
}

/** Логин аккаунта Директа (для отображения). Не критично — при ошибке вернёт null. */
export async function directGetLogin(token: string): Promise<string | null> {
  try {
    const result = await directCall<{ Clients?: { Login?: string }[] }>(
      token, "clients", "get", { FieldNames: ["Login"] },
    );
    return result.Clients?.[0]?.Login ?? null;
  } catch {
    return null;
  }
}

export type CampaignStat = {
  campaignId: number;
  name: string;
  type: string;
  impressions: number;
  clicks: number;
  cost: number;
};

/** Статистика по кампаниям за 30 дней (отчёт CAMPAIGN_PERFORMANCE_REPORT).
 *  Отчёт видит ВСЕ кампании, включая новые типы, недоступные в campaigns.get. */
export async function directGetCampaignStats(token: string): Promise<CampaignStat[]> {
  // диапазон — последние 30 дней ВКЛЮЧАЯ сегодня (иначе свежие кампании не видны).
  // даты считаем по МСК — часовой пояс рекламных аккаунтов.
  const mskNow = new Date(Date.now() + 3 * 3600 * 1000);
  const dateTo = mskNow.toISOString().slice(0, 10);
  const dateFrom = new Date(mskNow.getTime() - 29 * 86400 * 1000).toISOString().slice(0, 10);
  const body = {
    params: {
      SelectionCriteria: { DateFrom: dateFrom, DateTo: dateTo },
      FieldNames: ["CampaignId", "CampaignName", "CampaignType", "Impressions", "Clicks", "Cost"],
      ReportName: `maxiflow-camp-${Date.now()}`,
      ReportType: "CAMPAIGN_PERFORMANCE_REPORT",
      DateRangeType: "CUSTOM_DATE",
      Format: "TSV",
      IncludeVAT: "YES",
      IncludeDiscount: "NO",
    },
  };

  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`${BASE}/reports`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept-Language": "ru",
        "Content-Type": "application/json; charset=utf-8",
        processingMode: "auto",
        returnMoneyInMicros: "false",
        skipReportHeader: "true",
        skipReportSummary: "true",
      },
      body: JSON.stringify(body),
    });

    if (r.status === 200) return parseReport(await r.text());
    if (r.status === 201 || r.status === 202) {
      const retryIn = Number(r.headers.get("retryIn") || "5");
      await sleep(Math.min(Math.max(retryIn, 2), 10) * 1000);
      continue;
    }
    const txt = await r.text();
    throw new Error(`Директ отклонил отчёт (${r.status}): ${txt.slice(0, 200)}`);
  }
  throw new Error("Отчёт Директа не сформировался за отведённое время");
}

function parseReport(tsv: string): CampaignStat[] {
  const lines = tsv.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  const idx = (name: string) => headers.indexOf(name);
  const iId = idx("CampaignId"), iName = idx("CampaignName"), iType = idx("CampaignType");
  const iImp = idx("Impressions"), iClk = idx("Clicks"), iCost = idx("Cost");
  return lines.slice(1).map((line) => {
    const c = line.split("\t");
    return {
      campaignId: Number(c[iId]),
      name: (iName >= 0 ? c[iName] : "") || "",
      type: (iType >= 0 ? c[iType] : "") || "",
      impressions: Number(c[iImp]) || 0,
      clicks: Number(c[iClk]) || 0,
      cost: Number(c[iCost]) || 0,
    };
  }).filter((s) => !Number.isNaN(s.campaignId));
}
