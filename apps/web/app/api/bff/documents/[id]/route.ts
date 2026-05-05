import { NextResponse } from "next/server";
import { forwardJson } from "../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const response = await forwardJson(`/api/documents/${id}`);

  if (response.status === 502) {
    return NextResponse.json(
      {
        id,
        document_model: {
          id,
          meta: {
            title: "Untitled Document",
            author: "",
            page_size: "A4",
            margins: { top: 72, bottom: 72, left: 72, right: 72 },
            export_standard: "pdf_a",
            layout_mode: "editable",
          },
          styles: {},
          blocks: [],
        },
      },
      { status: 200 }
    );
  }

  return response;
}
