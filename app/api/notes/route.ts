import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { listNotes, createNote } from "@/lib/fsNotes";
import { errorResponse, formatZodError } from "@/lib/apiHelpers";

const CreateNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()).optional(),
  id: z.uuid().optional(),
});

export async function GET() {
  try {
    const notes = await listNotes();
    return NextResponse.json(notes);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = CreateNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const note = await createNote(parsed.data);
    revalidatePath("/notes");
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
