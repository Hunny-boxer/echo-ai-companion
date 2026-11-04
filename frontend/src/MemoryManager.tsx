
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  createMemory,
  deleteMemory,
  listMemories,
  updateMemory,
  type MemoryCategory,
  type SavedMemory,
} from "./memoryService";

import "./memory-manager.css";

const categories: {
  value: MemoryCategory;
  label: string;
}[] = [
  { value: "personal", label: "Personal" },
  { value: "preference", label: "Preference" },
  { value: "work", label: "Work" },
  { value: "other", label: "Other" },
];

function formatMemoryDate(value: string | null): string {
  if (!value) {
    return "Recently saved";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently saved";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function categoryLabel(category: MemoryCategory): string {
  return (
    categories.find((item) => item.value === category)?.label ??
    "Personal"
  );
}

export default function MemoryManager() {
  const [memories, setMemories] = useState<SavedMemory[]>([]);
  const [content, setContent] = useState("");
  const [category, setCategory] =
    useState<MemoryCategory>("personal");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editingCategory, setEditingCategory] =
    useState<MemoryCategory>("personal");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyMemoryId, setBusyMemoryId] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSavedMemories() {
      try {
        const result = await listMemories();

        if (!cancelled) {
          setMemories(result);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Couldn't load your saved memories."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSavedMemories();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshMemories() {
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      const result = await listMemories();
      setMemories(result);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Couldn't refresh your memories."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateMemory(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanContent = content.trim();

    if (!cleanContent || isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const saved = await createMemory({
        content: cleanContent,
        category,
      });

      setMemories((current) => [saved, ...current]);
      setContent("");
      setCategory("personal");
      setNotice("Memory saved. Echo can now use it when relevant.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Couldn't save this memory."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(memory: SavedMemory) {
    setEditingId(memory.id);
    setEditingContent(memory.content);
    setEditingCategory(memory.category);
    setError("");
    setNotice("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingContent("");
    setEditingCategory("personal");
  }

  async function handleUpdateMemory(
    event: FormEvent<HTMLFormElement>,
    memoryId: string
  ) {
    event.preventDefault();

    const cleanContent = editingContent.trim();

    if (!cleanContent || busyMemoryId) {
      return;
    }

    setBusyMemoryId(memoryId);
    setError("");
    setNotice("");

    try {
      const updated = await updateMemory(memoryId, {
        content: cleanContent,
        category: editingCategory,
      });

      setMemories((current) =>
        current.map((memory) =>
          memory.id === memoryId ? updated : memory
        )
      );

      cancelEditing();
      setNotice("Memory updated.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Couldn't update this memory."
      );
    } finally {
      setBusyMemoryId(null);
    }
  }

  async function handleDeleteMemory(memory: SavedMemory) {
    const confirmed = window.confirm(
      "Delete this saved memory? This action cannot be undone."
    );

    if (!confirmed || busyMemoryId) {
      return;
    }

    setBusyMemoryId(memory.id);
    setError("");
    setNotice("");

    try {
      await deleteMemory(memory.id);

      setMemories((current) =>
        current.filter((item) => item.id !== memory.id)
      );

      if (editingId === memory.id) {
        cancelEditing();
      }

      setNotice("Memory deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Couldn't delete this memory."
      );
    } finally {
      setBusyMemoryId(null);
    }
  }

  return (
    <div className="memory-manager">
      <header className="memory-manager-header">
        <div>
          <span className="memory-manager-eyebrow">
            YOUR PERSONAL MEMORY
          </span>

          <h1>My memories</h1>

          <p>
            Keep the details that matter. You decide what Echo
            remembers and what it can use in future conversations.
          </p>
        </div>

        <div className="memory-manager-total">
          <strong>{memories.length}</strong>
          <span>saved</span>
        </div>
      </header>

      <section className="memory-manager-privacy">
        <span className="memory-manager-privacy-icon">◇</span>

        <div>
          <strong>You are in control</strong>
          <p>
            Echo does not automatically save conversation details.
            Only memories you explicitly add here are stored.
            You can edit or delete them at any time.
          </p>
        </div>
      </section>

      <section className="memory-manager-create">
        <div className="memory-manager-section-heading">
          <div>
            <span className="memory-manager-section-kicker">
              SAVE SOMETHING IMPORTANT
            </span>
            <h2>Add a memory</h2>
          </div>
          <span className="memory-manager-spark">✧</span>
        </div>

        <form onSubmit={handleCreateMemory}>
          <label
            className="memory-manager-label"
            htmlFor="new-memory-content"
          >
            What should Echo remember?
          </label>

          <textarea
            id="new-memory-content"
            className="memory-manager-textarea"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="For example: I prefer concise project updates with clear next steps."
            maxLength={1000}
            rows={4}
            required
          />

          <div className="memory-manager-form-footer">
            <label
              className="memory-manager-field"
              htmlFor="new-memory-category"
            >
              <span className="memory-manager-label">
                Category
              </span>

              <select
                id="new-memory-category"
                className="memory-manager-select"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as MemoryCategory)
                }
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="memory-manager-save-area">
              <span className="memory-manager-character-count">
                {content.length}/1000
              </span>

              <button
                className="memory-manager-primary-button"
                type="submit"
                disabled={!content.trim() || isSaving}
              >
                {isSaving ? "Saving..." : "＋ Save memory"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {error && (
        <div className="memory-manager-alert memory-manager-alert-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void refreshMemories()}>
            Retry
          </button>
        </div>
      )}

      {notice && (
        <div
          className="memory-manager-alert memory-manager-alert-success"
          role="status"
        >
          {notice}
        </div>
      )}

      <section className="memory-manager-list-section">
        <div className="memory-manager-list-heading">
          <div>
            <span className="memory-manager-section-kicker">
              YOUR SAVED DETAILS
            </span>
            <h2>Memory library</h2>
          </div>

          <button
            className="memory-manager-refresh"
            type="button"
            onClick={() => void refreshMemories()}
            disabled={isLoading}
          >
            ↻ Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="memory-manager-empty" role="status">
            <span className="memory-manager-empty-icon">◌</span>
            <strong>Loading your memories</strong>
            <p>Connecting to your private memory library...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="memory-manager-empty">
            <span className="memory-manager-empty-icon">◇</span>
            <strong>Your memory library is empty</strong>
            <p>
              Add your first memory above. Echo will only use
              information you choose to save.
            </p>
          </div>
        ) : (
          <div className="memory-manager-list">
            {memories.map((memory) => {
              const isEditing = editingId === memory.id;
              const isBusy = busyMemoryId === memory.id;

              return (
                <article
                  className="memory-manager-item"
                  key={memory.id}
                >
                  {isEditing ? (
                    <form
                      className="memory-manager-edit-form"
                      onSubmit={(event) =>
                        void handleUpdateMemory(event, memory.id)
                      }
                    >
                      <label
                        className="memory-manager-label"
                        htmlFor={`edit-memory-${memory.id}`}
                      >
                        Edit memory
                      </label>

                      <textarea
                        id={`edit-memory-${memory.id}`}
                        className="memory-manager-textarea"
                        value={editingContent}
                        onChange={(event) =>
                          setEditingContent(event.target.value)
                        }
                        maxLength={1000}
                        rows={3}
                        required
                      />

                      <label
                        className="memory-manager-field"
                        htmlFor={`edit-category-${memory.id}`}
                      >
                        <span className="memory-manager-label">
                          Category
                        </span>

                        <select
                          id={`edit-category-${memory.id}`}
                          className="memory-manager-select"
                          value={editingCategory}
                          onChange={(event) =>
                            setEditingCategory(
                              event.target.value as MemoryCategory
                            )
                          }
                        >
                          {categories.map((item) => (
                            <option
                              key={item.value}
                              value={item.value}
                            >
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="memory-manager-item-actions">
                        <button
                          className="memory-manager-secondary-button"
                          type="button"
                          onClick={cancelEditing}
                          disabled={isBusy}
                        >
                          Cancel
                        </button>

                        <button
                          className="memory-manager-primary-button"
                          type="submit"
                          disabled={!editingContent.trim() || isBusy}
                        >
                          {isBusy ? "Saving..." : "Save changes"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="memory-manager-item-top">
                        <span
                          className={`memory-manager-category memory-category-${memory.category}`}
                        >
                          {categoryLabel(memory.category)}
                        </span>

                        <span className="memory-manager-date">
                          {formatMemoryDate(memory.updated_at)}
                        </span>
                      </div>

                      <p className="memory-manager-item-content">
                        {memory.content}
                      </p>

                      <div className="memory-manager-item-actions">
                        <button
                          className="memory-manager-secondary-button"
                          type="button"
                          onClick={() => startEditing(memory)}
                          disabled={isBusy || busyMemoryId !== null}
                        >
                          Edit
                        </button>

                        <button
                          className="memory-manager-delete-button"
                          type="button"
                          onClick={() =>
                            void handleDeleteMemory(memory)
                          }
                          disabled={isBusy || busyMemoryId !== null}
                        >
                          {isBusy ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
