import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listNotes, createNote } from "@/lib/fsNotes";

const CreateNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
});

export async function GET() {
  try {
    const notes = await listNotes();
    return NextResponse.json(notes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = CreateNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const note = await createNote(parsed.data);
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
