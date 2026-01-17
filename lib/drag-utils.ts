/**
 * Drag and Drop utilities for typed drag IDs
 *
 * We use typed IDs to distinguish between different draggable item types:
 * - task::abc123
 * - project::def456
 * - folder::ghi789
 */

export type DragItemType = 'task' | 'project' | 'folder'

export interface ParsedDragId {
  type: DragItemType
  id: string
}

/**
 * Parse a typed drag ID into its components
 * @example parseDropId("task::abc123") -> { type: "task", id: "abc123" }
 */
export function parseDragId(typedId: string): ParsedDragId | null {
  const parts = typedId.split('::')
  if (parts.length !== 2) return null

  const [type, id] = parts
  if (!isValidDragType(type)) return null

  return { type, id }
}

/**
 * Create a typed drag ID from components
 * @example createDragId("task", "abc123") -> "task::abc123"
 */
export function createDragId(type: DragItemType, id: string): string {
  return `${type}::${id}`
}

/**
 * Check if a string is a valid drag item type
 */
function isValidDragType(type: string): type is DragItemType {
  return type === 'task' || type === 'project' || type === 'folder'
}

/**
 * Check if a drag ID is of a specific type
 */
export function isDragType(typedId: string, expectedType: DragItemType): boolean {
  const parsed = parseDragId(typedId)
  return parsed?.type === expectedType
}
