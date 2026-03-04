import fs from "fs/promises";
import path from "path";
import { createTodo, listTodos, getTodo, updateTodo, deleteTodo } from "./fsTodos";

/* eslint-disable no-console */
async function runTests() {
  const sep = "─".repeat(50);
  console.log(`\n${sep}\n  fsTodos Tests\n${sep}\n`);

  const originalRoot = process.env.NOTES_ROOT;
  const testRoot = path.join(process.cwd(), `.test-todos-${String(Date.now())}`);
  process.env.NOTES_ROOT = testRoot;

  try {
    const todo = await createTodo({ title: "Test", quadrant: "do", description: "desc" });
    if (todo.id === "" || todo.title !== "Test" || todo.quadrant !== "do") {
      throw new Error("createTodo fields wrong");
    }

    console.log("✓ createTodo — fields correct");

    const all = await listTodos();
    if (all.length !== 1) {
      throw new Error(`Expected 1 todo, got ${String(all.length)}`);
    }

    console.log("✓ listTodos — found 1 todo");

    const fetched = await getTodo(todo.id);
    if (fetched?.description !== "desc") {
      throw new Error("getTodo description mismatch");
    }

    console.log("✓ getTodo — description matches");

    const updated = await updateTodo(todo.id, { title: "Updated", completed: true });
    if (updated.title !== "Updated" || !updated.completed) {
      throw new Error("updateTodo fields wrong");
    }

    console.log("✓ updateTodo — title and completed updated");

    await deleteTodo(todo.id);
    const afterDelete = await listTodos();
    if (afterDelete.length !== 0) {
      throw new Error("Todo not deleted");
    }

    console.log("✓ deleteTodo — todo removed");

    console.log(`\n${sep}\n  ALL TESTS PASSED ✓\n${sep}\n`);
  } finally {
    process.env.NOTES_ROOT = originalRoot;
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}

runTests().catch((err: unknown) => {
  console.error("\n  TEST FAILED ✗", err);
  process.exit(1);
});
