'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { FolderItem } from './FolderItem'
import { ProjectItem } from './ProjectItem'

export function FolderTree() {
  const folders = useQuery(api.folders.list)
  const projects = useQuery(api.projects.list)

  if (folders === undefined || projects === undefined) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
  }

  const sortedFolders = folders.slice().sort((a, b) => a.sortOrder - b.sortOrder)

  // Projects without a folder (standalone projects)
  const standaloneProjects = projects
    .filter((p) => !p.folderId)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  if (sortedFolders.length === 0 && standaloneProjects.length === 0) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">No folders or projects yet</div>
  }

  return (
    <div className="space-y-0.5">
      {sortedFolders.map((folder) => (
        <FolderItem
          key={folder._id}
          folderId={folder._id}
          name={folder.name}
          color={folder.color}
        />
      ))}
      {standaloneProjects.map((project) => (
        <ProjectItem
          key={project._id}
          projectId={project._id}
          name={project.name}
          color={project.color}
        />
      ))}
    </div>
  )
}
