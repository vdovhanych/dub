import { getEvents } from "@/lib/analytics/get-events";
import { convertToCSV, validDateRangeForPlan } from "@/lib/analytics/utils";
import { withWorkspace } from "@/lib/auth";
import { getDomainViaEdge } from "@/lib/planetscale";
import { eventsQuerySchema } from "@/lib/zod/schemas/analytics";
import { clickEventEnrichedSchema } from "@/lib/zod/schemas/clicks";
import { leadEventEnrichedSchema } from "@/lib/zod/schemas/leads";
import { saleEventEnrichedSchema } from "@/lib/zod/schemas/sales";
import { COUNTRIES, capitalize } from "@dub/utils";
import { z } from "zod";

type ClickEvent = z.infer<typeof clickEventEnrichedSchema>;
type LeadEvent = z.infer<typeof leadEventEnrichedSchema>;
type SaleEvent = z.infer<typeof saleEventEnrichedSchema>;

type Row = ClickEvent | LeadEvent | SaleEvent;

const columnNames: Record<string, string> = {
  trigger: "Event",
  os: "OS",
  timestamp: "Date",
  invoiceId: "Invoice ID",
  amount: "Sales Amount",
};

const columnAccessors = {
  trigger: (r: Row) => (r.qr ? "QR scan" : "Link click"),
  event: (r: LeadEvent | SaleEvent) => r.event_name,
  link: (r: Row) => r.domain + (r.key === "_root" ? "" : `/${r.key}`),
  country: (r: Row) =>
    r.country ? COUNTRIES[r.country] ?? r.country : r.country,
  customer: (r: LeadEvent | SaleEvent) =>
    r.customer_name + (r.customer_email ? ` <${r.customer_email}>` : ""),
  invoiceId: (r: SaleEvent) => r.invoice_id,
  amount: (r: SaleEvent) => "$" + (r.amount / 100).toFixed(2),
};

// GET /api/analytics/events/export – get export data for analytics
export const GET = withWorkspace(
  async ({ searchParams, workspace, link }) => {
    const parsedParams = eventsQuerySchema
      .and(
        z.object({
          columns: z
            .string()
            .transform((c) => c.split(","))
            .pipe(z.string().array()),
        }),
      )
      .parse(searchParams);
    const { event, domain, key, interval, start, end, columns } = parsedParams;

    validDateRangeForPlan({
      plan: workspace.plan,
      interval,
      start,
      end,
      throwError: true,
    });

    const linkId = link
      ? link.id
      : domain && key === "_root"
        ? await getDomainViaEdge(domain).then((d) => d?.id)
        : null;

    const response = await getEvents({
      ...parsedParams,
      ...(linkId && { linkId }),
      workspaceId: workspace.id,
      limit: 100000,
    });

    const data = response.map((row) =>
      Object.fromEntries(
        columns.map((c) => [
          columnNames?.[c] ?? capitalize(c),
          columnAccessors[c]?.(row) ?? row?.[c],
        ]),
      ),
    );

    const csvData = convertToCSV(data);

    return new Response(csvData, {
      headers: {
        "Content-Type": "application/csv",
        "Content-Disposition": `attachment; filename=${event}_export.csv`,
      },
    });
  },
  {
    needNotExceededClicks: true,
  },
);
