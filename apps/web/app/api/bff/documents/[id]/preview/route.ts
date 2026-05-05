import { NextResponse } from "next/server";
import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const response = await forwardJson(`/api/documents/${id}/preview`);

  if (response.status === 502) {
    return NextResponse.json({ id, preview_url: `/api/documents/${id}/preview` });
  }

  return response;
}
