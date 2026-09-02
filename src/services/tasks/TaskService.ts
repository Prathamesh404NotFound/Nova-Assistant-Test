/**
 * Nova Agent Architecture — Task Service
 * Unified task API wrapping Firebase RTDB.
 */

import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  type RTDBTask,
} from "@/lib/rtdb";

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: RTDBTask["priority"];
  dueDate?: string;
  tags?: string[];
}

class TaskService {
  /**
   * Create a new task.
   */
  async create(userId: string, input: CreateTaskInput): Promise<RTDBTask> {
    await createTask(userId, {
      title: input.title,
      description: input.description || "",
      status: "pending",
      priority: input.priority || "medium",
    });
    // Re-fetch to get the created task with its generated id
    const tasks = await getTasks(userId);
    return tasks[0]; // Most recent
  }

  /**
   * List all tasks for a user.
   */
  async list(userId: string): Promise<RTDBTask[]> {
    return getTasks(userId);
  }

  /**
   * Search tasks by title or description.
   */
  async search(userId: string, query: string): Promise<RTDBTask[]> {
    const tasks = await getTasks(userId);
    const lower = query.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(lower) ||
        (t.description && t.description.toLowerCase().includes(lower))
    );
  }

  /**
   * Update a task.
   */
  async update(
    userId: string,
    id: string,
    updates: Partial<Omit<RTDBTask, "id" | "createdAt">>
  ): Promise<void> {
    await updateTask(userId, id, updates);
  }

  /**
   * Mark a task as completed.
   */
  async complete(userId: string, id: string): Promise<void> {
    await updateTask(userId, id, { status: "completed" });
  }

  /**
   * Reopen a completed task.
   */
  async reopen(userId: string, id: string): Promise<void> {
    await updateTask(userId, id, { status: "pending" });
  }

  /**
   * Delete a task.
   */
  async delete(userId: string, id: string): Promise<void> {
    await deleteTask(userId, id);
  }

  /**
   * Get tasks by status.
   */
  async getByStatus(
    userId: string,
    status: RTDBTask["status"]
  ): Promise<RTDBTask[]> {
    const tasks = await getTasks(userId);
    return tasks.filter((t) => t.status === status);
  }
}

/** Singleton task service. */
export const taskService = new TaskService();
