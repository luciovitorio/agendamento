import { NextResponse } from "next/server";
import { buildN8nOpenApiSpec } from "@/lib/openapi/n8n-spec";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const origin = `${requestUrl.protocol}//${requestUrl.host}`;

  return NextResponse.json(buildN8nOpenApiSpec(origin), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
