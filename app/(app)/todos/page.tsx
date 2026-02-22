import { listTodos } from "@/lib/fsTodos";
import { EisenhowerMatrix } from "./EisenhowerMatrix";

export default async function TodosPage() {
  const todos = await listTodos();
  return <EisenhowerMatrix todos={todos} />;
}
